import { createHash } from "node:crypto"
import { RedisClientType } from "redis"
import { AnyRedisClient, ClientConfiguration, RedisModelOptions } from "~/types"
import * as crypto from "crypto"
import { pack, unpack } from "jsonpack"

/**
 * Executor class that handles serialization, compression,
 * and interactions with Redis for a given schema template.
 */
class RedisModel<T> {
  /** Original redis client */
  protected readonly client: RedisClientType<any, any, any, any, any>
  protected readonly options: Required<Omit<RedisModelOptions, "ttl">> & { ttl?: number }
  protected readonly randomKeyBytesCount: number = 16

  /**
   * @param client redis client instance
   * @param options schema options
   * @param config
   */
  constructor(client: AnyRedisClient, options: RedisModelOptions, config?: Partial<ClientConfiguration>) {
    const namespace = options?.namespace ?? createHash("shake256", { outputLength: config?.randomNamespaceLength || 8 })
      .update(JSON.stringify([options]))
      .digest("base64url")

    this.client = client
    this.options = {
      ttl: options?.ttl,
      readOnce: options?.readOnce ?? false,
      namespace
    }
    if (config?.randomKeyBytesCount) this.randomKeyBytesCount = config.randomKeyBytesCount
  }

  /**
   * Compresses and writes the specified value to Redis.
   *
   * @param key key under which the value will be stored (without namespace).
   * @param value value to store.
   * @returns key used in Redis (without namespace).
   */
  public async set(key: string, value: T): Promise<string> {
    await this.waitWhenReady()
    const serializedValue = pack(value as any)
    if (typeof this.options.ttl === "number") {
      this.client.setEx(this.fullKey(key), this.options.ttl, serializedValue)
    }
    else this.client.set(this.fullKey(key), serializedValue)

    return key
  }

  /**
   * Expire key after a specific ttl or date
   */
  public async expire(key: string, ttl: number | Date, mode?: "NX" | "XX" | "GT" | "LT") {
    if (typeof ttl === "number") this.client.expire(key, ttl, mode)
    else this.client.expireAt(key, ttl, mode)
  }

  /**
   * Retrieves data from Redis and validates it against the template.
   *
   * @param key key in Redis (without a namespace).
   * @param force if true, throws an error instead of returning null when
   * data is missing or fails validation.
   * @returns parsed data matching the template, or null if not in force mode.
   */
  public async get<F extends boolean | undefined>(key: string, force?: F): Promise<F extends true ? T : T | null> {
    await this.waitWhenReady()
    const rawValue = await this.client.get(this.fullKey(key))
    if (!rawValue) {
      if (force) throw new Error(`Key ${ key } not found`)

      return null as any
    }

    if (this.options.readOnce) this.delete(key)

    return unpack(Buffer.isBuffer(rawValue) ? rawValue.toString("utf8") : rawValue)
  }

  /**
   * Deletes the specified key from Redis.
   *
   * @param key key to delete (without a namespace).
   * @returns result of the deletion operation.
   */
  public async delete(key: string) {
    await this.waitWhenReady()
    return this.client.del(this.fullKey(key))
  }

  /**
   * Retrieves data from Redis and executes a callback if the data exists
   * and matches the template.
   *
   * @param key key to retrieve.
   * @param callback function to execute with the retrieved payload.
   * @returns callback result or null if no data.
   */
  public async with<R extends any>(key: string, callback: (payload: T) => R): Promise<R | null> {
    const payload = await this.get(key)
    if (payload) return callback(payload)
    return null
  }

  /**
   * Provides a method to set a value with an auto-generated random key.
   */
  public get randomKey() {
    const executor = this
    return {
      /**
       * Compresses and writes the value under a random key.
       *
       * @param value value to store.
       * @returns generated a Redis key (without a namespace).
       */
      set(value: T): Promise<string> {
        const key = crypto.randomBytes(executor.randomKeyBytesCount).toString("base64url")
        return executor.set(key, value)
      }
    }
  }

  private fullKey(key: string) {
    return this.options.namespace + "+" + key
  }

  private async waitWhenReady() {
    if (this.client.isReady) return

    let attempt = 0
    return new Promise<void>(resolve => {
      const interval = setInterval(() => {
        attempt += 1
        if (attempt > 300) {
          clearInterval(interval)
          throw new Error("Redis initialization timeout, if this is only error you encounter, double-check that Sigil" +
            " app starts listening BEFORE any redis interactions")
        }

        if (!this.client.isReady) return

        clearInterval(interval)
        resolve()
      }, 100)
    })
  }
}


/**
 * Redis client abstraction
 */
export default class RedisClient {
  public readonly client: RedisClientType<any, any, any, any, any>
  readonly #clientConfig: Partial<ClientConfiguration>

  constructor(client: RedisClientType<any, any, any, any, any>, clientConfig?: Partial<ClientConfiguration>) {
    this.client = client
    this.#clientConfig = clientConfig || {}
  }

  /**
   * Defines a new data schema with the given template and options.
   *
   * @param options schema options.
   * @returns a RedisSchema instance for data operations.
   */
  public model<T>(options: RedisModelOptions): RedisModel<T> {
    return new RedisModel(this.client, options, this.#clientConfig)
  }

  /**
   * Disconnects and cleans up the Redis client.
   */
  public destroy() {
    this.client.destroy()
  }

  public async connect() {
    await this.client.connect()

    return this.client
  }
}

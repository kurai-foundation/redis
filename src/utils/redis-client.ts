import { ObjectSchema, seal } from "@sigiljs/seal"
import { InferSchema } from "@sigiljs/seal/types"
import { createHash } from "node:crypto"
import { RedisClientType } from "redis"
import { AnyRedisClient, ClientConfiguration, RedisModelOptions, RedisModelTemplate } from "~/types"
import sealJsonParser from "./seal-json-parser"
import * as crypto from "crypto"

/**
 * Executor class that handles serialization, compression,
 * and interactions with Redis for a given schema template.
 */
class RedisModel<T extends RedisModelTemplate> {
  protected readonly client: RedisClientType<any, any, any, any, any>
  protected readonly template: T
  protected readonly options: Required<Omit<RedisModelOptions, "ttl">> & { ttl?: number }
  protected readonly randomKeyBytesCount: number = 16

  /**
   * @param client redis client instance
   * @param template seal schema template
   * @param options schema options
   * @param config
   */
  constructor(client: AnyRedisClient, template: T, options?: RedisModelOptions, config?: Partial<ClientConfiguration>) {
    const namespace = options?.namespace ?? createHash("shake256", { outputLength: config?.randomNamespaceLength || 8 })
      .update(JSON.stringify([seal.exportMetadataOf(template), options || {}]))
      .digest("base64url")

    this.client = client
    this.options = {
      ttl: options?.ttl,
      readOnce: options?.readOnce ?? false,
      namespace
    }
    this.template = template
    if (config?.randomKeyBytesCount) this.randomKeyBytesCount = config.randomKeyBytesCount
  }

  /**
   * Compresses and writes the specified value to Redis.
   *
   * @param key key under which the value will be stored (without namespace).
   * @param value value to store.
   * @returns key used in Redis (without namespace).
   */
  public async set(key: string, value: InferSchema<T>): Promise<string> {
    await this.waitWhenReady()
    const serializedValue = JSON.stringify(this.serialize(value))
    if (typeof this.options.ttl === "number") {
      this.client.setEx(this.fullKey(key), this.options.ttl, serializedValue)
    }
    else this.client.set(this.fullKey(key), serializedValue)

    return key
  }

  /**
   * Retrieves data from Redis and validates it against the template.
   *
   * @param key key in Redis (without namespace).
   * @param force if true, throws an error instead of returning null when
   * data is missing or fails validation.
   * @returns parsed data matching the template, or null if not in force mode.
   */
  public async get<F extends boolean | undefined>(key: string, force?: F): Promise<F extends true ? InferSchema<T> : InferSchema<T> | null> {
    await this.waitWhenReady()
    const rawValue = await this.client.get(this.fullKey(key))
    if (!rawValue) {
      if (force) throw new Error(`Key ${ key } not found`)

      return null as any
    }

    if (this.options.readOnce) this.delete(key)

    return sealJsonParser(Buffer.isBuffer(rawValue) ? rawValue.toString("utf8") : rawValue, this.template) as any
  }

  /**
   * Deletes the specified key from Redis.
   *
   * @param key key to delete (without namespace).
   * @returns result of the deletion operation.
   */
  public async delete(key: string) {
    await this.waitWhenReady()
    return this.client.del(key)
  }

  /**
   * Retrieves data from Redis and executes a callback if the data exists
   * and matches the template.
   *
   * @param key key to retrieve.
   * @param callback function to execute with the retrieved payload.
   * @returns callback result or null if no data.
   */
  public async with<R extends any>(key: string, callback: (payload: InferSchema<T>) => R): Promise<R | null> {
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
       * @returns generated Redis key (without namespace).
       */
      set(value: InferSchema<T>): Promise<string> {
        const key = crypto.randomBytes(executor.randomKeyBytesCount).toString("base64url")
        return executor.set(key, value)
      }
    }
  }

  private fullKey(key: string) {
    return this.options.namespace + "+" + key
  }

  private serialize(payload: any): Array<any> {
    if (typeof payload !== "object") return payload

    const schemaShapeKeys = Object.keys(seal.exportMetadataOf(this.template).shape || {})
    if (schemaShapeKeys.length) {
      const response: any[] = []
      for (const key of schemaShapeKeys) {
        const v = payload[key]
        response.push((v && typeof v === "object") ? this.serialize(v) : v)
      }
      return response
    }

    return Object.values(payload).map(v => (v && typeof v === "object") ? this.serialize(v) : v)
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
  readonly #client: RedisClientType<any, any, any, any, any>
  readonly #clientConfig: Partial<ClientConfiguration>

  constructor(client: RedisClientType<any, any, any, any, any>, clientConfig?: Partial<ClientConfiguration>) {
    this.#client = client
    this.#clientConfig = clientConfig || {}
  }

  /**
   * Creates a new object schema template compatible with Seal.
   *
   * @param template schema definition.
   * @returns an ObjectSchema based on the provided template.
   */
  public template<T extends { [key: string]: RedisModelTemplate }>(template: T): ObjectSchema<T> {
    return seal.object(template)
  }

  /**
   * Defines a new data schema with the given template and options.
   *
   * @param template redis schema template.
   * @param options schema options.
   * @returns a RedisSchema instance for data operations.
   */
  public model<T extends RedisModelTemplate>(template: T, options?: RedisModelOptions): RedisModel<T> {
    return new RedisModel(this.#client, template, options, this.#clientConfig)
  }

  /**
   * Disconnects and cleans up the Redis client.
   */
  public destroy() {
    this.#client.destroy()
  }

  public async connect() {
    await this.#client.connect()

    return this.#client
  }
}

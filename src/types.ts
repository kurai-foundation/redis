import { RedisClientOptions } from "@redis/client"
import { RedisClientType } from "redis"

export interface ClientConfiguration {
  /**
   * Bytes count for the generated entry name
   *
   * @default 16
   */
  randomKeyBytesCount: number
  /**
   * Length of the generated namespace length
   *
   * Does not apply when namespace is specified manually
   *
   * @default 8
   */
  randomNamespaceLength: number
}

export interface RedisModelOptions {
  /** Time in seconds after which record will be deleted */
  ttl?: number
  /**
   * Delete record after the first successful read
   *
   * @deafult false
   */
  readOnce?: boolean
  /**
   * Model namespace
   *
   * When not set, namespace automatically generates from the template as follows:
   * @example
   * createHash("shake256", { outputLength: config?.randomNamespaceLength || 8 })
   *   .update(JSON.stringify([options]))
   *   .digest("base64url")
   *
   * @default shake256 hash
   */
  namespace: string
}

export type RedisOptions = RedisClientOptions & Partial<ClientConfiguration>

export type AnyRedisClient = RedisClientType<any, any, any, any, any>
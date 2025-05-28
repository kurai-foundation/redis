import { RedisClientOptions } from "@redis/client"
import { ArraySchema, BasePrimitive, NullableSchema, ObjectSchema } from "@sigiljs/seal"
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
   * Does not apply when namespace specified manually
   *
   * @default 8
   */
  randomNamespaceLength: number
}

export type RedisModelTemplate = BasePrimitive<any>
  | ArraySchema<BasePrimitive<any> | NullableSchema<BasePrimitive<any>>>
  | NullableSchema<BasePrimitive<any>>
  | ObjectSchema<any>

export interface RedisModelOptions {
  /** Time in seconds after which record will be deleted */
  ttl?: number
  /**
   * Delete record after first successful read
   *
   * @deafult false
   */
  readOnce?: boolean
  /**
   * Model namespace
   *
   * When not set, namespace automatically generates from template as follows:
   * @example
   * createHash("shake256", { outputLength: config?.randomNamespaceLength || 8 })
   *   .update(JSON.stringify([seal.exportMetadataOf(template), options || {}]))
   *   .digest("base64url")
   *
   * @default shake256 hash
   */
  namespace?: string
}

export type RedisOptions = RedisClientOptions & Partial<ClientConfiguration>

export type AnyRedisClient = RedisClientType<any, any, any, any, any>
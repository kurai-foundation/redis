import { createClient as createRedisClient } from "redis"
import RedisClient from "~/utils/redis-client"
import { AnyRedisClient, RedisOptions } from "~/types"


export const redis = {
  /**
   * Create new RedisClient instance
   * @param {RedisOptions} options redis client configuration
   */
  createClient(options?: RedisOptions) {
    const client = createRedisClient(options)

    return new RedisClient(client, options)
  },

  /**
   * Convert redis client or RedisClient instance into a new RedisClient instance
   * @param {AnyRedisClient | RedisClient} client redis client or RedisClient instance
   */
  withClient(client: AnyRedisClient | RedisClient) {
    if (client instanceof RedisClient) return client

    return new RedisClient(client)
  }
}

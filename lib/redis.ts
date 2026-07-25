import { createClient, type RedisClientType } from "redis";

let clientPromise: Promise<RedisClientType> | null = null;

/**
 * Shared Redis client for multi-instance coordination (rate limits, etc.).
 * Uses REDIS_URL. Connection is reused across warm serverless/Node processes.
 */
export async function getRedisClient(): Promise<RedisClientType> {
  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    throw new Error("REDIS_URL is not configured");
  }

  if (!clientPromise) {
    clientPromise = (async () => {
      const client = createClient({ url }) as RedisClientType;
      client.on("error", (error) => {
        console.error("Redis client error", error);
      });
      await client.connect();
      return client;
    })();
  }

  return clientPromise;
}

/** Test helper — drop the singleton so the next call reconnects. */
export function resetRedisClientForTests() {
  clientPromise = null;
}

// cache.js
import { createClient } from "redis";

const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
  },
  password: process.env.REDIS_PASSWORD,
});

redisClient.connect().catch((err) => {
  console.error("Error connecting to Redis:", err);
});

redisClient.on("connect", () => {
  console.log("Successfully connected to Redis");
});

export default redisClient;

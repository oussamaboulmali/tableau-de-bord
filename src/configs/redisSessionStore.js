import { RedisStore } from "connect-redis";
import redisClient from "./cache.js";

const redisStore = new RedisStore({
  client: redisClient,
  prefix: "WebApsApp:",
});

export default redisStore;

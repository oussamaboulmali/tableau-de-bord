import { PrismaClient } from "@prisma/client";
import { buildDatabaseUrl } from "../utils/dbUrl.js";
const prisma = new PrismaClient({
  datasourceUrl: buildDatabaseUrl(),
  // log: [
  //   {
  //     emit: "event",
  //     level: "query",
  //   },
  //   {
  //     emit: "stdout",
  //     level: "error",
  //   },
  //   {
  //     emit: "stdout",
  //     level: "info",
  //   },
  //   {
  //     emit: "stdout",
  //     level: "warn",
  //   },
  // ],
});

// prisma.$on("query", (e) => {
//   console.log("Query: " + e.query);
//   console.log("Params: " + e.params);
//   console.log("Duration: " + e.duration + "ms");
// });

export default prisma;

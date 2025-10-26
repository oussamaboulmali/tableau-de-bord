export function buildDatabaseUrl() {
  const password = process.env.DATABASE_PASSWORD;
  const connectionString = `postgresql://${
    process.env.DATABASE_USER
  }:${encodeURIComponent(password)}@${process.env.DATABASE_HOST}:${
    process.env.DATABASE_PORT
  }/${process.env.DATABASE_NAME}`;
  return connectionString;
}

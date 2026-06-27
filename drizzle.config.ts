import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit talks to Postgres directly (NOT through Hyperdrive — Hyperdrive is
 * only for the Worker's runtime queries). It reads `DATABASE_URL`, falling back
 * to the local docker-compose Postgres for `db:push` during development.
 *
 * For production, set `DATABASE_URL` to a direct connection string to your
 * managed Postgres and run `db:generate` then `db:migrate`.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/worker/db/schema/index.ts",
  out: "./drizzle",
  casing: "snake_case",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/app",
  },
});

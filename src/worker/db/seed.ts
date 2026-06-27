/**
 * Dev seed. Run with `bun run db:seed` after `db:push`. Connects to Postgres
 * directly (NOT through Hyperdrive — that's only for the Worker runtime), using
 * `DATABASE_URL` or the local docker-compose default.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { todos } from "./schema/index.ts";

const url = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/app";

const client = postgres(url, { max: 1 });
const db = drizzle(client, { casing: "snake_case" });

await db.delete(todos);
await db.insert(todos).values([
  { title: "Read the README", completed: true },
  { title: "Build something" },
]);

console.log("Seeded todos.");
await client.end();

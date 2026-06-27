import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../db/schema/index.ts";

/**
 * Create a Drizzle client for one request.
 *
 * Workers forbids opening sockets at the top level — connections must be created
 * inside the `fetch` handler — so we can't build a long-lived module-level client
 * the way a Node server would. `getDb` is therefore called per request with the
 * Hyperdrive binding. That's cheap and the recommended pattern: Hyperdrive pools
 * the real Postgres connections on Cloudflare's edge, so `postgres()` here just
 * opens a socket to the local Hyperdrive proxy.
 *
 *   const db = getDb(c.env.HYPERDRIVE);
 *   const rows = await db.select().from(todos);
 *
 * Do NOT call `db.$client.end()` / `sql.end()`. With Hyperdrive the Worker's
 * client connection is garbage-collected automatically when the request ends,
 * and calling `.end()` explicitly is a known cause of hangs / "Stream was
 * cancelled" errors. (Cloudflare removed `sql.end()` from its Hyperdrive
 * examples for this reason.)
 *
 * `max: 5` respects the Workers per-request connection ceiling, and
 * `fetch_types: false` skips postgres.js's startup type-introspection round-trip
 * (Hyperdrive recommends this).
 */
export function getDb(hyperdrive: Hyperdrive) {
  const client = postgres(hyperdrive.connectionString, {
    max: 5,
    fetch_types: false,
  });

  return drizzle(client, { schema, casing: "snake_case" });
}

export type Db = ReturnType<typeof getDb>;

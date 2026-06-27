import { createMiddleware } from "hono/factory";
import { getDb, type Db } from "./db.ts";

/**
 * Shared Hono environment for every app/route in this Worker.
 *
 * `Bindings` is the generated `Env` (Cloudflare bindings); `Variables` is what
 * middleware stashes on the context via `c.set(...)` and handlers read via
 * `c.var` / `c.get(...)`.
 *
 * IMPORTANT: a parent app's `.use(...)` adds the middleware at RUNTIME for all
 * mounted routes, but it does NOT propagate the `Variables` TYPE into
 * `.route()`-mounted sub-apps. So every sub-app must be created as
 * `new Hono<AppEnv>()` to see `c.var.db` typed — even though the middleware
 * itself is registered only once, on the root router (see routes/_router.ts).
 */
export type AppEnv = {
  Bindings: Env;
  Variables: {
    db: Db;
  };
};

/**
 * Builds the per-request app context. Right now that's just the Drizzle client
 * (one per request — see lib/db.ts), exposed as `c.var.db`. Add more shared
 * per-request values here (auth'd user, request-scoped logger, …) as the app grows.
 *
 * No teardown after `next()`: with Hyperdrive the connection is GC'd when the
 * request ends, and calling `db.$client.end()` is a known cause of hangs.
 */
export const appContextMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  c.set("db", getDb(c.env.HYPERDRIVE));
  await next();
});

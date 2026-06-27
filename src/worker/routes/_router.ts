import { Hono } from "hono";
import { appContextMiddleware, type AppEnv } from "../lib/app-context.ts";
import todos from "./todos.ts";
import todosById from "./todos.$id.ts";

const app = new Hono<AppEnv>();

/**
 * `appContextMiddleware` runs for every route and puts the per-request Drizzle
 * client on `c.var.db`. Registering it once here is enough at runtime for the
 * mounted sub-apps; each sub-app declares `new Hono<AppEnv>()` so `c.var.db` is
 * also typed inside it (see lib/app-context.ts).
 *
 * Mount each route module under its base path. Both modules live at
 * `/api/todos`; chaining `.use()`/`.route()` keeps the inferred type complete so
 * the `hc` RPC client on the front end stays fully typed.
 *
 * The files under `routes/` follow Remix's flat-route naming (`$id` = dynamic
 * segment), but mounting is wired up manually here. The todo routes are backed
 * by Postgres (Drizzle + Hyperdrive) — see routes/todos.ts and lib/db.ts.
 */
const routes = app
  .use(appContextMiddleware)
  .route("/api/todos", todos)
  .route("/api/todos", todosById);

export type AppType = typeof routes;

export default app;

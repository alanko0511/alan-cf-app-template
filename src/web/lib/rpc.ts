import { hc } from "hono/client";
import type { AppType } from "../../worker";

/**
 * Typed Hono RPC client. Because the Worker runs first for `/api/*` (see
 * `run_worker_first` in wrangler.json) we can point this at the same origin in
 * both dev and production.
 */
export const client = hc<AppType>("/");

export const api = client.api;

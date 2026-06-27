/**
 * The client imports the Worker's `AppType` (for the `hc` RPC client), which
 * pulls `src/worker/index.ts` into this project's compilation. That file types
 * its Hono bindings with the ambient `Env` global from `worker-configuration.d.ts`
 * — but that file is loaded only by the Worker tsconfig, and pulling the full
 * Workers runtime types in here would collide with the DOM lib.
 *
 * This minimal ambient declaration is enough to resolve `AppType` on the client.
 * The real binding types still live in `worker-configuration.d.ts` for the Worker.
 *
 * The Worker's route handlers reference `c.env.HYPERDRIVE` and the `Hyperdrive`
 * global (via getDb), so the shim has to carry just enough of both for the
 * imported worker source to type-check here. Only `connectionString` is used; the
 * full type lives in `worker-configuration.d.ts` for the Worker project.
 */
declare interface Hyperdrive {
  readonly connectionString: string;
}

declare interface Env {
  HYPERDRIVE: Hyperdrive;
}

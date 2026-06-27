# AGENTS.md

Orientation for agents working in this repo. It's a full-stack template: a single Cloudflare Worker serving a Hono API and a React SPA. This file is the architecture map and the list of non-obvious gotchas — read it before changing build config, routing, or the API/client boundary. The files referenced here are real; open them rather than trusting a copy.

> **Lost the demo code?** This doc derives from a template whose `todos` demo shows every pattern working end-to-end. If that demo has been deleted from this repo (it's meant to be — see "Customizing") and you want a live reference, pull it from the upstream template on GitHub instead of reconstructing it from memory: `gh repo view alanko0511/alan-cf-app-template`, then `gh api repos/alanko0511/alan-cf-app-template/contents/<path>` (or just browse https://github.com/alanko0511/alan-cf-app-template). Good files to look at: `src/web/routes/_index.tsx` (RPC + react-query), `src/worker/routes/todos.ts` + `todos.$id.ts` (DB CRUD), `src/worker/db/schema/todos.ts` (table).

## Stack

| Concern         | Choice                                          |
| --------------- | ----------------------------------------------- |
| Runtime         | Cloudflare Workers                              |
| API             | Hono                                            |
| Build / dev     | Vite + `@cloudflare/vite-plugin`                |
| UI              | React 19                                        |
| Routing (web)   | wouter                                          |
| Data fetching   | TanStack Query                                  |
| API client      | Hono `hc` RPC (types imported from the Worker)  |
| Validation      | zod + `@hono/zod-validator`                     |
| Database        | Postgres 18 + Drizzle ORM (postgres.js driver)  |
| DB connection   | Cloudflare Hyperdrive (pooling at the edge)     |
| Migrations      | drizzle-kit (`push` for dev, `generate`+`migrate` for prod) |
| Local DB        | Docker Compose (`docker-compose.yml`)           |
| Package manager | Bun                                             |

The Worker runs first for `/api/*` (`run_worker_first` in `wrangler.json`); every other path falls through to the SPA (`not_found_handling: "single-page-application"`).

The todo API is backed by Postgres: requests flow Worker → Hono route → `c.var.db` (Drizzle, set by `appContextMiddleware`) → Hyperdrive → Postgres. In production Hyperdrive pools the real database connections at Cloudflare's edge; in local dev `wrangler`/Miniflare connects directly to the database in `hyperdrive[].localConnectionString` (the docker-compose Postgres).

## Commands

```sh
bun install
bun run cf-typegen   # generate worker-configuration.d.ts (run once after clone, and after editing wrangler.json)
docker compose up -d # local Postgres 18 (data under ./tmp/postgres, gitignored)
bun run db:push      # sync schema to the DB (dev: no migration files)
bun run db:seed      # insert demo todos (optional)
bun run dev          # Vite dev server, Worker running in workerd
bun run build        # tsc -b && vite build
bun run deploy       # build + wrangler deploy
bun run test         # Worker tests in workerd (Vitest); test:watch for watch mode
```

Database scripts (drizzle-kit; see `drizzle.config.ts`):

```sh
bun run db:push      # push schema straight to the DB — use in local dev
bun run db:generate  # generate a SQL migration in ./drizzle from schema changes — use for prod
bun run db:migrate   # apply pending migrations — use for prod
bun run db:studio    # Drizzle Studio (browse/edit data)
bun run db:seed      # run src/worker/db/seed.ts
```

drizzle-kit connects to Postgres **directly** (not through Hyperdrive) via `DATABASE_URL`, defaulting to the local docker Postgres. For prod, set `DATABASE_URL` to a direct connection string and run `db:generate` then `db:migrate`. `bun run test` needs Postgres up (`docker compose up -d`) and the schema pushed (`bun run db:push`) — see invariant #10.

Run everything under **Node ≥ 22.15** (`fnm use` reads `.nvmrc` → 24). See invariant #1.

## Directory map

```
src/
  worker/
    index.ts             entry; re-exports app + AppType from routes/_router.ts
    db/
      schema/
        index.ts         schema barrel — drizzle.config + getDb point here
        todos.ts         todos table (Drizzle, snake_case columns)
      seed.ts            dev seed script (Bun; bun run db:seed)
    lib/
      db.ts              getDb(hyperdrive) → per-request Drizzle client
      app-context.ts     AppEnv type + appContextMiddleware (sets c.var.db)
    routes/
      _router.ts         .use(appContextMiddleware) + .route() mounts, exports AppType
      todos.ts           GET/POST     /api/todos  (uses c.var.db)
      todos.$id.ts       PATCH/DELETE /api/todos/:id
  web/
    main.tsx             React entry + QueryClientProvider
    App.tsx              layout shell (header/nav) + <Router/>
    index.css            styles
    worker-env.d.ts      the Env shim (invariant #3)
    lib/rpc.ts           hc<AppType> client
    routes/
      _router.tsx        wouter route table
      _index.tsx         "/"        (todos UI)
      about.tsx          "/about"
      settings.tsx       nested layout — the <Outlet/> equivalent
      settings._index.tsx    "/settings"
      settings.account.tsx   "/settings/account"
test/
  api.test.ts            Worker tests (integration via exports.default.fetch + unit via direct handler)
  tsconfig.json          test project; types from @cloudflare/vitest-pool-workers/types
docker-compose.yml       local Postgres 18 (volume → ./tmp/postgres)
drizzle.config.ts        drizzle-kit config (schema barrel, snake_case, out: ./drizzle)
drizzle/                 generated SQL migrations (commit these)
vitest.config.ts         cloudflareTest() plugin; reuses wrangler.json
```

## Invariants — easy to get wrong, will break the build

1. **Node ≥ 22.15 is required.** `@cloudflare/vite-plugin` imports `module.registerHooks` (added in Node 22.15.0). Older Node fails `vite build`/`dev` with `SyntaxError: ... 'node:module' does not provide an export named 'registerHooks'`. Bun is the package manager, but `vite`/`wrangler` run under Node, so the active Node version matters even via `bun run`. Use `fnm use` (`.nvmrc` pins 24) or `fnm exec --using=24 bun run <script>`.

2. **Vite does not type-check.** esbuild strips types. The type-check gate is `tsc -b` in `build` (`tsc -b && vite build`). All tsconfigs are `noEmit`, so `tsc -b` emits nothing — it only fails on type errors. `-b` is mandatory because of TS project references (`tsconfig.json` → app/worker/node); plain `tsc` doesn't follow `references` and would check zero files.

3. **The `Env` shim in `src/web/worker-env.d.ts` must stay and must cover every binding the Worker code references.** `lib/rpc.ts` does `import type { AppType } from "../../worker"`, which pulls the Worker source into the *web* TS project, where `new Hono<{ Bindings: Env }>()` references the ambient `Env` global. That global only exists in `worker-configuration.d.ts` (Worker project only); importing the full Workers runtime types into the web project would clash with the DOM lib ("Cannot redeclare `Request`/`Response`/…"). The minimal shim resolves `AppType` without the clash. It now also declares a minimal `Hyperdrive` interface and `Env.HYPERDRIVE`, because the imported Worker source touches `c.env.HYPERDRIVE`/`getDb`. **When you add a binding the Worker references in code, add a matching minimal field here too**, or the web project's `tsc -b` fails with "Property '…' does not exist on type 'Env'".

4. **RPC types only flow if routes are chained and the type is re-exported.** Build the app by chaining (`.get().post()…` or `.route().route()`), assign to `const routes`, and `export type AppType = typeof routes`. Splitting into sub-apps combined with `.route(base, sub)` preserves the type. The client imports it **type-only**. If `api.todos.$get` loses its types, something broke the chain.

5. **`worker-configuration.d.ts` is generated and gitignored.** A fresh clone lacks it; `tsconfig.worker.json` lists it under `include`, so `bun run build` fails until `bun run cf-typegen` runs once. `bun run dev` works without it (no type-check). Re-run `cf-typegen` after editing `wrangler.json`.

6. **Import local TS files with explicit extensions.** tsconfigs set `allowImportingTsExtensions` + `verbatimModuleSyntax`, so local imports use `./foo.ts` / `./foo.tsx`. Directory specifiers (`wrangler.json` `main`, `import … from "../../worker"`) resolve to `index.*`.

7. **Don't set `assets.directory` in `wrangler.json`.** `@cloudflare/vite-plugin` builds the client and wires the asset directory itself. Only set `binding`, `not_found_handling`, and `run_worker_first`.

8. **`nodejs_compat` + the Hyperdrive binding are required.** postgres.js needs the `nodejs_compat` compatibility flag. The `hyperdrive[0].id` in `wrangler.json` is a **placeholder** (`REPLACE_WITH_YOUR_HYPERDRIVE_ID`) — replace it before `wrangler deploy` (create one with `wrangler hyperdrive create <name> --connection-string=...`). `localConnectionString` is what local dev (`wrangler dev`/Miniflare/Vitest) connects to; the `id` is ignored locally. An env var `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` overrides `localConnectionString` if set.

9. **Never call `db.$client.end()` / `sql.end()`.** With Hyperdrive the per-request client connection is garbage-collected when the request ends; calling `.end()` explicitly is a known cause of hangs and "Stream was cancelled" unhandled rejections (Cloudflare removed it from their Hyperdrive examples). Create the client per request inside the handler/middleware (see `lib/db.ts`) and just let it go.

10. **DB tests need a running Postgres.** `test/api.test.ts` exercises the real Drizzle→Hyperdrive→Postgres path in workerd (Miniflare reads `localConnectionString`). Before `bun run test`: `docker compose up -d` and `bun run db:push`. Each test truncates `todos` in `beforeEach`. Test imports use the **non-deprecated** API: `import { env, exports } from "cloudflare:workers"` (not `cloudflare:test`) with `exports.default.fetch()` in place of `SELF.fetch()`; `createExecutionContext`/`waitOnExecutionContext` still come from `cloudflare:test`.

11. **`seed.ts` is a Bun script, not Worker code.** It uses `process.env` and runs outside the Workers runtime, so it's **excluded** from `tsconfig.worker.json` (which sets `types: []`) and type-checked by `tsconfig.node.json` instead (along with `drizzle.config.ts`). That node project carries `@types/node`; the worker project deliberately does not.

12. **Per-request `db` lives on `c.var.db`, typed via `AppEnv`.** `appContextMiddleware` (`lib/app-context.ts`) runs once — registered on the root router with `.use()` — and sets `c.var.db` for every route at runtime. But a parent's `.use()` does **not** propagate the `Variables` *type* into `.route()`-mounted sub-apps, so **every sub-app must be `new Hono<AppEnv>()`** (not `new Hono<{ Bindings: Env }>()`) for `c.var.db` to be typed. Runtime propagates; types don't. (`tsc -b` is the check — it fails if a sub-app uses `c.var.db` without the `AppEnv` generic.)

## Conventions

- **Route file names mirror Remix flat-routes** (`_index`, `$id` dynamic segment, `parent.child` nesting), but routing is wired **manually** — there's no file-based router. The names are convention; the wiring is explicit in `_router.ts` (Hono `.route()`) and `_router.tsx` (wouter `<Switch>`).
- **Adding an API resource:** create `src/worker/routes/<name>.ts` exporting a chained Hono sub-app — `export default new Hono<AppEnv>().get(...)…` (use the `AppEnv` generic from `lib/app-context.ts`, not `{ Bindings: Env }`, so `c.var.db` is typed — see invariant #12). Mount it in `_router.ts` with `.route("/api/<name>", <name>)`. Read the DB via `c.var.db` (don't call `getDb` in handlers — the middleware already did). Validate bodies with `zValidator("json", zodSchema)` (and `zValidator("param", …)` for uuid params) so the request type reaches the `hc` client. Item routes go in `<name>.$id.ts`.
- **Accessing the database:** the per-request Drizzle client is `c.var.db` — use it as a standard Drizzle query builder over the tables in `db/schema/` (imported from the barrel: `import { todos } from "../db/schema/index.ts"`). Template-specific rules: it's set by `appContextMiddleware`, so **never call `getDb` yourself in a handler**, and **never `.end()` the client** (invariant #9 — causes hangs). See `routes/todos.ts` + `todos.$id.ts` for the CRUD shapes if the demo is still around.
- **Adding a DB table:** create `src/worker/db/schema/<name>.ts` (`pgTable(...)`, columns in camelCase — the `snake_case` casing in `drizzle.config.ts` + `getDb` maps them to snake_case), export `$inferSelect`/`$inferInsert` types, then add one `export * from "./<name>.ts"` line to `db/schema/index.ts` (the barrel both `drizzle.config.ts` and `getDb` read). In dev, `bun run db:push`. For prod, `bun run db:generate` then `db:migrate`.
- **Calling the API from the web:** import `api` from `lib/rpc.ts` and use it inside TanStack Query. `param` and `json` are typed from the Worker route; responses are typed too. The canonical end-to-end pattern (mirrors `routes/_index.tsx` — kept here so it survives a frontend rewrite):

  ```tsx
  import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
  import { api } from "../lib/rpc.ts";

  // Read: GET /api/todos
  function useTodos() {
    return useQuery({
      queryKey: ["todos"],
      queryFn: async () => {
        const res = await api.todos.$get();
        if (!res.ok) throw new Error("Failed to load todos");
        return res.json(); // typed from the Worker route
      },
    });
  }

  // Write: POST /api/todos, then refetch
  function useAddTodo() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (input: { title: string }) => {
        const res = await api.todos.$post({ json: input }); // `json` is typed
        if (!res.ok) throw new Error("Failed to add todo");
        return res.json();
      },
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["todos"] }),
    });
  }

  // Dynamic segments use bracket syntax; `param` + `json` are both typed:
  //   api.todos[":id"].$patch({ param: { id }, json: { completed } })
  //   api.todos[":id"].$delete({ param: { id } })
  ```
- **Nested layouts (the `<Outlet/>` equivalent):** wouter has no `<Outlet/>`. A layout renders `{children}` as the outlet slot; `_router.tsx` wraps the nested routes in it under a `<Route path="/x" nest>`. `nest` makes child paths/links relative to the prefix. See `routes/settings.tsx` + its `settings.*` children.
- **Tests run in workerd, not Node.** `@cloudflare/vitest-pool-workers` (Vitest 4) runs tests in the real runtime via `vitest.config.ts`'s `cloudflareTest()` plugin, reusing `wrangler.json`. Test utilities: `env` + `exports` (`exports.default.fetch()` for full-Worker integration) from `cloudflare:workers`; `createExecutionContext`/`waitOnExecutionContext` (direct-handler unit) from `cloudflare:test`. The types are at the `@cloudflare/vitest-pool-workers/types` subpath, not the package root — `test/tsconfig.json` sets `"types": ["@cloudflare/vitest-pool-workers/types"]`. `test/` is wired into `tsc -b` (4th project reference), so `bun run build` type-checks tests too. These tests hit Postgres — see invariant #10 for the prerequisites.

## Customizing

**The todos feature is a throwaway demo — delete it wholesale when building a real app.** It exists only to exercise the stack end-to-end (typed RPC, react-query, Drizzle, Hyperdrive, zod, tests). The *patterns* it demonstrates are documented as copyable snippets above ("Calling the API from the web", "Accessing the database"), so you lose nothing by removing the code. When asked to adapt this template into an app, the expected move is to **remove the demo, not refactor it in place**.

The demo surface to delete: `web/routes/_index.tsx` (todos UI), `worker/routes/todos.ts` + `todos.$id.ts`, `db/schema/todos.ts` (and its `export *` line in `db/schema/index.ts`), `db/seed.ts`'s todo rows, and the todo cases in `test/api.test.ts`. Keep the scaffolding that isn't demo-specific: `lib/rpc.ts`, `lib/db.ts`, `lib/app-context.ts`, the router files, build/config, and the `web/routes/about.*` + `settings.*` pages (kept as routing/layout examples — delete if unwanted).

Keep the patterns intact when you swap: `index.css` (styles) and any added packages are free to change. After a clone: rename `name` in `package.json` + `wrangler.json`, bump `compatibility_date`, replace the Hyperdrive `id` placeholder (invariant #8), and point `localConnectionString` / `DATABASE_URL` at your database.

**Adding a binding (D1/KV/R2/…):** add it to `wrangler.json`, run `bun run cf-typegen` to refresh `Env`, then use `c.env.<BINDING>` in the Worker. If Worker code (not just the Worker project) references it, also add a minimal field to the web `Env` shim (invariant #3).

## Verifying a change

1. `bun run build` exits 0 (type-check + build).
2. **RPC types reach the web:** temporarily break a call (e.g. `api.todos[":id"].$patch({ param: { wrongKey: id }, … })`) and confirm `tsc -b` reports it. Revert.
3. **DB up:** `docker compose up -d` then `bun run db:push` (and `bun run db:seed` for data).
4. **Runtime:** `bun run dev`, then `GET /api/todos` returns JSON from Postgres, `POST /api/todos` with `{"title":"x"}` → 201 (empty title → 400 via zod), `PATCH`/`DELETE /api/todos/:id` work (malformed uuid → 400), and `/about` → 200 serving the SPA (Worker didn't intercept).
5. `bun run test` exits 0 (needs the DB from step 3).

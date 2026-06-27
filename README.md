# Full-stack starter

My **opinionated** template for full-stack projects: a single Cloudflare Worker serving a typed Hono API and a React SPA, backed by Postgres. It's deliberately not a blank canvas or a menu of options — the stack is chosen, the wiring is done, and the conventions are decided, so I can clone it and start building features instead of re-litigating setup. If a choice below isn't yours, this probably isn't the template for you — fork it and make it yours.

Everything runs on one Cloudflare Worker:

- **Hono** API on **Cloudflare Workers** — the Worker runs first for `/api/*` (`run_worker_first`), everything else falls through to the SPA.
- **Vite + React** front end, built and served as static assets by the same Worker.
- **wouter** for client-side routing.
- **`hc`** (Hono's typed RPC client) wired into **TanStack Query** — the client imports `AppType` straight from the Worker, so API calls are end-to-end typed with no codegen.
- **Postgres** via **Drizzle ORM** (postgres.js) over **Cloudflare Hyperdrive** — a per-request Drizzle client on `c.var.db`, `snake_case` columns, a schema folder, and `drizzle-kit` for migrations. Local Postgres 18 via Docker Compose.
- **Bun** as the package manager, **TypeScript** strict throughout, and **Vitest** running tests in the real `workerd` runtime.

It ships with a small todo example (API + UI, **backed by Postgres**) demonstrating the patterns end-to-end; swap it for your own. See [AGENTS.md](./AGENTS.md) for an agent-oriented tour of the architecture and the non-obvious gotchas.

## Use this template

Click **Use this template** on GitHub (or `gh repo create <name> --template <owner>/<repo>`), then:

1. Rename `"name"` in `package.json` and `wrangler.json` to your project.
2. Set `"compatibility_date"` in `wrangler.json` to today's date.
3. `fnm use` (or `nvm use`) to pick up Node from `.nvmrc`.
4. `bun install`
5. `bun run cf-typegen` — **required before the first build** (see below).
6. `docker compose up -d` — start local Postgres 18 (data under `./tmp/postgres`, gitignored).
7. `bun run db:push` — create the tables. `bun run db:seed` for demo data (optional).
8. `bun run dev`

Before deploying, replace the Hyperdrive `id` placeholder in `wrangler.json` (`REPLACE_WITH_YOUR_HYPERDRIVE_ID`) — see [Database](#database).

## Requirements

- **Node ≥ 22.15** (the `@cloudflare/vite-plugin` uses `module.registerHooks`). `.nvmrc` pins this — run `fnm use` / `nvm use`.
- **Bun** as the package manager.
- **Docker** (Docker Compose) for the local Postgres, or any other Postgres you point `localConnectionString` / `DATABASE_URL` at.

## Scripts

```sh
bun install
bun run cf-typegen # generate worker-configuration.d.ts (run once after clone, and after editing wrangler.json)
bun run dev        # Vite dev server with the Worker running in workerd
bun run build      # tsc -b && vite build  ->  dist/
bun run preview    # preview the production build
bun run deploy     # build + wrangler deploy
bun run test       # run the Worker tests once (Vitest; needs Postgres — see Database)
bun run test:watch # watch mode

# Database (drizzle-kit)
bun run db:push     # push schema straight to the DB — local dev
bun run db:generate # generate a SQL migration in ./drizzle — for prod
bun run db:migrate  # apply pending migrations — for prod
bun run db:studio   # browse/edit data in Drizzle Studio
bun run db:seed     # insert demo todos (src/worker/db/seed.ts)
```

> **First build:** `worker-configuration.d.ts` (the generated `Env`/Workers types) is gitignored, so a fresh clone doesn't have it. `bun run dev` works without it (Vite doesn't type-check), but `bun run build` runs `tsc -b` first and **fails until you run `bun run cf-typegen` once**.

## Layout

```
src/
  worker/
    index.ts             Worker entry; re-exports the app + AppType
    db/
      schema/            one file per table + an index.ts barrel
      seed.ts            dev seed script (bun run db:seed)
    lib/
      db.ts              getDb(hyperdrive) → per-request Drizzle client
      app-context.ts     AppEnv type + appContextMiddleware (sets c.var.db)
    routes/
      _router.ts         .use(appContextMiddleware) + .route() mounts, exports AppType
      todos.ts           GET/POST     /api/todos  (reads c.var.db)
      todos.$id.ts       PATCH/DELETE /api/todos/:id
  web/
    main.tsx             React entry + QueryClientProvider
    App.tsx              layout shell
    lib/rpc.ts           typed hc client (import type { AppType })
    routes/
      _router.tsx        wouter route table
      _index.tsx         "/"                  todos UI
      about.tsx          "/about"
      settings.tsx       layout (the <Outlet/> equivalent)
      settings._index.tsx   "/settings"
      settings.account.tsx  "/settings/account"
```

### Nested layouts (the `<Outlet/>` equivalent)

wouter has no `<Outlet/>`. Instead a layout renders `{children}` as the outlet
slot, and `_router.tsx` wraps the nested routes in it. The `nest` prop matches
`/settings` as a prefix and makes the child paths relative:

```tsx
<Route path="/settings" nest>
  <SettingsLayout>            {/* renders a sidebar + {children} */}
    <Switch>
      <Route path="/" component={SettingsIndex} />        {/* /settings */}
      <Route path="/account" component={SettingsAccount} /> {/* /settings/account */}
    </Switch>
  </SettingsLayout>
</Route>
```

The sidebar persists across child navigations; only the outlet content swaps.

Files under both `routes/` dirs mirror Remix's flat-route naming (`_index` = index
route, `$id` = dynamic segment), but routing is wired up manually — wouter on the
web (`_router.tsx`), Hono `.route()` in the Worker (`_router.ts`). There's no
file-based router.

## Database

The todo API is backed by Postgres through **Drizzle ORM** (postgres.js driver) over **Cloudflare Hyperdrive**:

- **Schema** lives in `src/worker/db/schema/` — one file per table, re-exported from `index.ts`. Columns are written in camelCase; the `snake_case` casing in `drizzle.config.ts` and `getDb()` maps them to snake_case in Postgres (`createdAt` → `created_at`).
- **Connections.** Workers can't open sockets at the top level, so `getDb(c.env.HYPERDRIVE)` (`lib/db.ts`) creates a Drizzle client **per request**. `appContextMiddleware` does this once and exposes it as `c.var.db`; handlers just use `c.var.db`. Don't call `.end()` — Hyperdrive pools the real connections at the edge and the per-request client is cleaned up automatically.
- **Local vs prod.** In local dev (`wrangler dev`/Vite/Vitest) Hyperdrive connects directly to the database in `wrangler.json`'s `hyperdrive[].localConnectionString` — the Docker Compose Postgres. In production it uses the Hyperdrive config referenced by `id`, so **replace the `REPLACE_WITH_YOUR_HYPERDRIVE_ID` placeholder** before deploying (create one with `wrangler hyperdrive create <name> --connection-string="postgres://…"`).
- **Migrations.** Use `bun run db:push` for local iteration (no migration files). For production, `bun run db:generate` writes a SQL migration to `./drizzle/`, and `bun run db:migrate` applies it. drizzle-kit connects to Postgres **directly** via `DATABASE_URL` (defaulting to the local docker DB), not through Hyperdrive.

The Postgres 18 container stores its data under `./tmp/postgres` (gitignored). `docker compose down` stops it; the data persists for next time.

## Testing

Worker tests run inside the real `workerd` runtime via [`@cloudflare/vitest-pool-workers`](https://developers.cloudflare.com/workers/testing/vitest-integration/) (Vitest 4). `vitest.config.ts` reuses the Worker config from `wrangler.json`; tests live in `test/` with their own `tsconfig.json`.

`test/api.test.ts` shows both styles:

- **Integration** — `exports.default.fetch(...)` (from `cloudflare:workers`) dispatches a request through the whole Worker (Hono routing, `run_worker_first`, zod, Drizzle), exactly as deployed.
- **Unit** — `worker.fetch(request, env, ctx)` calls the handler directly with `createExecutionContext()` / `waitOnExecutionContext()`.

The tests exercise the real Drizzle → Hyperdrive → Postgres path, so **start Postgres and push the schema first**: `docker compose up -d && bun run db:push`. Each test truncates the `todos` table before it runs.

`bun run build` also type-checks the tests (the `test/` project is part of `tsc -b`), so run `bun run cf-typegen` first on a fresh clone.

## Adding bindings

1. Add the binding (D1, KV, R2, …) to `wrangler.json`.
2. Run `bun run cf-typegen` to refresh the `Env` types.
3. Use `c.env.<BINDING>` inside the Worker.

If Worker code that the web project imports (transitively, via `AppType`) references the new binding, also add a minimal field for it to the web `Env` shim in `src/web/worker-env.d.ts` — otherwise `tsc -b` fails in the web project. The Hyperdrive binding is already wired up this way; see [AGENTS.md](./AGENTS.md) invariant #3.

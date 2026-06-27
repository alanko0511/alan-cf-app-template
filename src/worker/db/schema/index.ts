/**
 * Schema barrel. Each table lives in its own file under this folder; re-export
 * them all here. `drizzle.config.ts` and `getDb()` both point at this barrel, so
 * adding a table means creating `./<name>.ts` and adding one line below.
 */
export * from "./todos.ts";

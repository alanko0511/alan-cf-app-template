import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";

/**
 * The todos table. Columns are declared in camelCase; the `snake_case` casing
 * configured in drizzle.config.ts and getDb() maps them to snake_case in
 * Postgres (`createdAt` -> `created_at`).
 *
 * `createdAt` uses `mode: "string"` so Drizzle returns an ISO string rather than
 * a `Date`. That keeps the inferred row type honest end-to-end: it matches what
 * actually arrives over the wire after JSON serialization, so the `hc` RPC
 * client on the front end sees `createdAt: string`.
 */
export const todos = pgTable("todos", {
  id: uuid().primaryKey().defaultRandom(),
  title: text().notNull(),
  completed: boolean().notNull().default(false),
  createdAt: timestamp({ withTimezone: true, mode: "string" }).notNull().defaultNow(),
});

export type Todo = typeof todos.$inferSelect;
export type NewTodo = typeof todos.$inferInsert;

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../lib/app-context.ts";
import { todos } from "../db/schema/index.ts";

const updateTodoSchema = z.object({
  completed: z.boolean(),
});

// `id` is a uuid; validating the param keeps a malformed id a clean 400 rather
// than a Postgres "invalid input syntax for type uuid" 500.
const paramSchema = z.object({
  id: z.uuid(),
});

/** Single-item routes, mounted at `/api/todos` by the router. The per-request
 * Drizzle client comes from `c.var.db` (set by appContextMiddleware). */
const route = new Hono<AppEnv>()
  .patch(
    "/:id",
    zValidator("param", paramSchema),
    zValidator("json", updateTodoSchema),
    async (c) => {
      const [todo] = await c.var.db
        .update(todos)
        .set({ completed: c.req.valid("json").completed })
        .where(eq(todos.id, c.req.valid("param").id))
        .returning();
      if (!todo) return c.json({ error: "Not found" }, 404);
      return c.json(todo);
    },
  )
  .delete("/:id", zValidator("param", paramSchema), async (c) => {
    const deleted = await c.var.db
      .delete(todos)
      .where(eq(todos.id, c.req.valid("param").id))
      .returning({ id: todos.id });
    if (deleted.length === 0) return c.json({ error: "Not found" }, 404);
    return c.body(null, 204);
  });

export default route;

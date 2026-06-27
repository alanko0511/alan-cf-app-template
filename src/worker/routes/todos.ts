import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { desc } from "drizzle-orm";
import type { AppEnv } from "../lib/app-context.ts";
import { todos } from "../db/schema/index.ts";

const newTodoSchema = z.object({
  title: z.string().trim().min(1).max(200),
});

/**
 * Collection routes, mounted at `/api/todos` by the router. Backed by Postgres
 * via Drizzle + Hyperdrive. The per-request Drizzle client comes from
 * `c.var.db`, set by `appContextMiddleware` (see lib/app-context.ts).
 */
const route = new Hono<AppEnv>()
  .get("/", async (c) => {
    const rows = await c.var.db.select().from(todos).orderBy(desc(todos.createdAt));
    return c.json({ todos: rows });
  })
  .post("/", zValidator("json", newTodoSchema), async (c) => {
    const [todo] = await c.var.db
      .insert(todos)
      .values({ title: c.req.valid("json").title })
      .returning();
    return c.json(todo, 201);
  });

export default route;

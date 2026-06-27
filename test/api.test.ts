import { env, exports } from "cloudflare:workers";
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import postgres from "postgres";
import worker from "../src/worker";

// These tests exercise the real Postgres path: requests flow through the Worker,
// Drizzle, and the Hyperdrive binding, which Miniflare points at the local
// database via `localConnectionString` in wrangler.json. Prerequisites:
//
//   docker compose up -d   # start Postgres
//   bun run db:push        # create the todos table
//
// Each test starts from an empty table. We truncate via the same Hyperdrive
// connection the Worker uses, so no extra config is needed here. The connection
// is left to be garbage-collected (do not call `.end()` with Hyperdrive — see
// lib/db.ts); the truncate is already committed once awaited.
beforeEach(async () => {
  const sql = postgres(env.HYPERDRIVE.connectionString, { max: 1, fetch_types: false });
  await sql`truncate table todos`;
});

function postTodo(title: string) {
  return exports.default.fetch("https://example.com/api/todos", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title }),
  });
}

// Integration style: `exports.default.fetch` dispatches a real request through
// the whole Worker (Hono routing, run_worker_first, zValidator, Drizzle), exactly
// as deployed.
describe("todos API (integration via exports.default.fetch)", () => {
  it("lists todos", async () => {
    await postTodo("First");
    await postTodo("Second");

    const res = await exports.default.fetch("https://example.com/api/todos");
    expect(res.status).toBe(200);
    const body = await res.json<{ todos: unknown[] }>();
    expect(body.todos.length).toBe(2);
  });

  it("creates a todo", async () => {
    const res = await postTodo("Write tests");
    expect(res.status).toBe(201);
    const todo = await res.json<{ id: string; title: string; completed: boolean }>();
    expect(todo).toMatchObject({ title: "Write tests", completed: false });
    expect(todo.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("rejects an invalid body with 400 (zod)", async () => {
    const res = await postTodo("");
    expect(res.status).toBe(400);
  });

  it("toggles, then deletes, then 404s a todo", async () => {
    const created = await (await postTodo("Temp")).json<{ id: string }>();

    const patched = await exports.default.fetch(`https://example.com/api/todos/${created.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ completed: true }),
    });
    expect(patched.status).toBe(200);
    expect((await patched.json<{ completed: boolean }>()).completed).toBe(true);

    const deleted = await exports.default.fetch(`https://example.com/api/todos/${created.id}`, {
      method: "DELETE",
    });
    expect(deleted.status).toBe(204);

    const missing = await exports.default.fetch(`https://example.com/api/todos/${created.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ completed: false }),
    });
    expect(missing.status).toBe(404);
  });
});

// Unit style: call the Worker's fetch handler directly with a fresh execution
// context. Useful when you want to assert on a single handler in isolation.
describe("todos API (unit via direct handler)", () => {
  it("handles GET /api/todos", async () => {
    const request = new Request("https://example.com/api/todos");
    const ctx = createExecutionContext();
    const res = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(200);
  });
});

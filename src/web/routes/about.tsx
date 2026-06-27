export default function About() {
  return (
    <section>
      <h2>About</h2>
      <p>
        A minimal full-stack starter: Hono on Cloudflare Workers, Vite + React
        on the front end, wouter for routing, and a typed Hono RPC client
        (<code>hc</code>) wired into TanStack Query.
      </p>
      <p>
        The Worker handles <code>/api/*</code> first (via{" "}
        <code>run_worker_first</code>); every other path falls through to the
        SPA.
      </p>
    </section>
  );
}

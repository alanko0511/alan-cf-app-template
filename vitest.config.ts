import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// Tests run inside the real workerd runtime (via Miniflare), reusing the Worker
// config from wrangler.json. This is a standalone config — Vitest uses it
// instead of vite.config.ts, so the @cloudflare/vite-plugin is not involved here.
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.json" },
    }),
  ],
});

// Production build for this VPS (run via `npm run deploy`, see
// scripts/deploy.sh). Same as vite.config.ts, but nitro targets a plain Node
// server instead of the Cloudflare default, so the site is served with
// `node --env-file=.env .output/server/index.mjs` rather than `vite dev`.
// It builds into .output-next so the live .output is never half-written;
// deploy.sh swaps the folders once the build succeeds. vite.config.ts stays
// untouched for dev and for Lovable.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  nitro: {
    preset: "node-server",
    output: {
      dir: ".output-next",
    },
  },

  tanstackStart: {
    server: {
      entry: "server",
    },
  },
});

// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    server: {
      host: "0.0.0.0",
      port: 8080,
      allowedHosts: [
        "srmpretech.online",
        "www.srmpretech.online",
        // Lets a local Evolution API Docker container (infra/evolution-api/)
        // reach this dev server to deliver WhatsApp webhook calls — from
        // inside that container, "localhost" means the container itself,
        // so it calls back via this special Docker DNS name instead.
        "host.docker.internal",
      ],
    },
  },

  tanstackStart: {
    server: {
      entry: "server",
    },
  },
});

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
      // The site is only reachable through OpenLiteSpeed's HTTPS reverse
      // proxy (443 → this dev server's 8080, see
      // /usr/local/lsws/conf/vhosts/Example/vhconf.conf) — without this,
      // the HMR client defaults to ws://<host>:8080 (Vite's own port),
      // which is never exposed publicly, so every page load logged a
      // "failed to connect to websocket" console error. clientPort: 443
      // with no explicit host lets it keep using location.hostname, so
      // this works for both srmpretech.online and www.srmpretech.online.
      // (Vite 8 renamed server.hmr.* to server.ws.* for this.)
      ws: {
        protocol: "wss",
        clientPort: 443,
      },
    },
  },

  tanstackStart: {
    server: {
      entry: "server",
    },
  },
});

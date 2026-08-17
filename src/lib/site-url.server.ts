// VITE_-prefixed vars in this project are only injected into
// import.meta.env, never into process.env (verified against the running
// dev process — see site-admin.functions.ts's origemPublicaServer, the
// first place this was worked out). site-url.ts's origemPublica() falls
// back to window.location.origin, which doesn't exist server-side, so this
// reads VITE_SITE_URL directly instead — the shared version of a helper
// duplicated a few times before this file existed.
export function origemPublicaServer(): string {
  return import.meta.env["VITE_SITE_URL"] ?? "";
}

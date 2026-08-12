// Customer-facing absolute links (QR code "Área do Cliente", "Copiar Link",
// password-reset e-mails, magic-link signup redirect) need the real public
// domain. window.location.origin bakes in whatever host/port the browser
// happens to be on — on this project that's the internal dev port
// (http://host:8080), not the https:// domain a reverse proxy maps to it
// in production. VITE_SITE_URL, when set, wins; otherwise this falls back
// to window.location.origin so it still works with zero extra config in
// other environments (previews, other deployments) that don't set it.
export function origemPublica(): string {
  return import.meta.env["VITE_SITE_URL"] || window.location.origin;
}

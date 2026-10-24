// The single operator account behind /admin (see site-admin.functions.ts for
// why this is hardcoded rather than a role). Kept in its own module so
// server-only code (e.g. the WhatsApp alerts to the operator) can read it
// without importing the server functions.
export const SITE_ADMIN_EMAIL = "admin@spacetech.app";

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// crypto.randomUUID() only exists in "secure contexts" (HTTPS or localhost).
// This app is also reachable over plain HTTP on a bare IP in some
// environments, where the browser leaves it undefined — anything that needs
// a client-side unique id (storage file paths, invite codes, local React
// keys) should go through this instead of calling crypto.randomUUID()
// directly, so it keeps working there too.
export function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
}

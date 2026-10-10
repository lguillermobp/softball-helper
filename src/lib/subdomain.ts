/** Club subdomain rules — reserved names + format validation. Pure (no deps). */

export const RESERVED_SUBDOMAINS = new Set([
  "www", "app", "api", "admin", "login", "register", "dashboard",
  "clubs", "club", "team", "teams", "league", "leagues", "stripe",
  "mail", "email", "static", "assets", "cdn", "help", "demo", "og",
  "support", "public", "status", "blog", "docs",
]);

export function normalizeSubdomain(input: string | null | undefined): string {
  return (input ?? "").trim().toLowerCase();
}

export function validateSubdomain(input: string): { ok: true; value: string } | { ok: false; error: string } {
  const s = normalizeSubdomain(input);
  if (!/^[a-z0-9-]+$/.test(s)) return { ok: false, error: "Use only lowercase letters, numbers, and hyphens." };
  if (s.length < 3 || s.length > 30) return { ok: false, error: "Must be 3–30 characters." };
  if (s.startsWith("-") || s.endsWith("-") || s.includes("--")) return { ok: false, error: "No leading, trailing, or double hyphens." };
  if (RESERVED_SUBDOMAINS.has(s)) return { ok: false, error: "That subdomain is reserved." };
  return { ok: true, value: s };
}

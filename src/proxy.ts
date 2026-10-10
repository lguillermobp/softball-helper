import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { RESERVED_SUBDOMAINS } from "@/lib/subdomain";

// NOTE: only the Stripe *webhook* is public — Stripe calls it with no session.
// /api/stripe/checkout and /api/stripe/portal stay protected (hit by a signed-in admin).
// /club is the public club site (reached directly, or via a subdomain rewrite below).
const PUBLIC_PATHS = ["/", "/login", "/register", "/set-password", "/api/auth", "/api/register", "/api/ig-img", "/league", "/league-bg", "/team", "/demo", "/help", "/api/help", "/api/stripe/webhook", "/club"];

const PRIMARY_HOST = "dugoutadmin.com";
const LEGACY_HOSTS = new Set(["softballhelper.com", "www.softballhelper.com"]);

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Permanent cutover: send the old domain to the new one, keeping path + query.
  // The Stripe webhook is excluded so the existing endpoint keeps receiving events
  // (Stripe does not follow 3xx) until it is repointed in the Stripe dashboard.
  const host = (req.headers.get("host") ?? "").toLowerCase();
  if (LEGACY_HOSTS.has(host) && pathname !== "/api/stripe/webhook") {
    const dest = new URL(`${pathname}${req.nextUrl.search}`, `https://${PRIMARY_HOST}`);
    return NextResponse.redirect(dest, 308);
  }

  // Club subdomain → rewrite to the public club site (no auth). A single-label
  // subdomain of the primary host that isn't reserved maps to /club/<label>.
  const hostname = host.split(":")[0];
  if (hostname.endsWith("." + PRIMARY_HOST)) {
    const label = hostname.slice(0, -(PRIMARY_HOST.length + 1));
    if (label && !label.includes(".") && label !== "www" && !RESERVED_SUBDOMAINS.has(label)
        && !pathname.startsWith("/_next") && !pathname.startsWith("/api")) {
      const url = req.nextUrl.clone();
      url.pathname = `/club/${label}`;
      return NextResponse.rewrite(url);
    }
  }

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (!isPublic && !req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  // Exclude Next internals AND any static asset file served from /public
  // (favicon, icon.png, og.png, logo-mark.png, league-bg/*, …) from auth,
  // so social scrapers and logged-out visitors can load them.
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:ico|png|jpg|jpeg|gif|svg|webp|avif|woff2?|ttf|txt|xml)$).*)"],
};

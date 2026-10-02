import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// NOTE: only the Stripe *webhook* is public — Stripe calls it with no session.
// /api/stripe/checkout and /api/stripe/portal stay protected (hit by a signed-in admin).
const PUBLIC_PATHS = ["/", "/login", "/register", "/set-password", "/api/auth", "/api/register", "/api/ig-img", "/league", "/league-bg", "/team", "/demo", "/help", "/api/help", "/api/stripe/webhook"];

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

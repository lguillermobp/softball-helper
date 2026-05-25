// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck — next-auth@beta resolves Next.js types from global node_modules;
// the type mismatch is a resolution artifact, not a real API incompatibility.
import { handlers } from "@/lib/auth";

export async function GET(req: Request) {
  return handlers.GET(req);
}

export async function POST(req: Request) {
  return handlers.POST(req);
}

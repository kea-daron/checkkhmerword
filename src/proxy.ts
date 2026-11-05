import { NextResponse, type NextRequest } from "next/server";
import meta from "../data/generated/meta.json";

/**
 * Entry pages stream a static shell before the lookup runs, so an unknown id
 * would otherwise come back as a 200 with "not found" content. Reject ids that
 * cannot exist up front with a real 404.
 */
export function proxy(request: NextRequest) {
  const id = request.nextUrl.pathname.split("/").pop() ?? "";
  if (!/^[1-9]\d{0,6}$/.test(id) || Number(id) > meta.maxId) {
    return NextResponse.rewrite(new URL("/__not_found__", request.url), { status: 404 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/word/:id", "/api/word/:id"],
};

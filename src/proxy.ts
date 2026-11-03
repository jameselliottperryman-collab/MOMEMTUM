import { NextRequest, NextResponse } from "next/server";
// Desktop-only defense: other local applications cannot reach the bundled server
// without the per-launch header injected by Electron's isolated session.
// The ordinary web application is unchanged when this variable is absent.
export function proxy(request: NextRequest) {
  const token = process.env.RELAYWORK_DESKTOP_TOKEN;
  if (token && request.headers.get("x-relaywork-desktop-token") !== token) {
    return new NextResponse("Unavailable", {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  }
  return NextResponse.next();
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg).*)"],
};

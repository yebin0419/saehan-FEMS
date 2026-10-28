import { NextRequest, NextResponse } from "next/server";

/**
 * Basic Auth middleware.
 * ADMIN_USER / ADMIN_PASSWORD 환경변수가 **둘 다 설정된 경우에만** 인증을 강제한다.
 * (로컬 개발 시 .env.local에서 값을 비워두면 인증 없이 바로 접근 가능)
 */
export function middleware(req: NextRequest) {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASSWORD;

  if (!user || !pass) return NextResponse.next();

  const auth = req.headers.get("authorization");
  if (auth) {
    const [scheme, encoded] = auth.split(" ");
    if (scheme === "Basic" && encoded) {
      try {
        const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
        const decoded = new TextDecoder().decode(bytes);
        const idx = decoded.indexOf(":");
        if (idx >= 0) {
          const u = decoded.slice(0, idx);
          const p = decoded.slice(idx + 1);
          if (safeEqual(u, user) && safeEqual(p, pass)) {
            return NextResponse.next();
          }
        }
      } catch {
        /* fallthrough → 401 */
      }
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="saehanFEMS", charset="UTF-8"',
    },
  });
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

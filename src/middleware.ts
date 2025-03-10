import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decrypt } from "./lib/session";

export const config = {
  matcher: [
    /*
     * ? もしかすると下の静的ファイルに対しても認証を要求したほうがよいかもしれない
     * 下のパス以外のルートに対して認証を要求:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};

export default async function middleware(request: NextRequest) {
  const signInPage = "/api/auth/signin";

  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value;
  const decryptedSession = session ? await decrypt(session) : undefined;
  const authorized = !!decryptedSession?.homeAccountId;

  if (!authorized && request.nextUrl.pathname !== signInPage) {
    return NextResponse.redirect(new URL(signInPage, request.nextUrl));
  }

  return NextResponse.next();
}

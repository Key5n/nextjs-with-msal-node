import { NextRequest } from "next/server";
import { authProvider } from "@/auth";

export async function GET(request: NextRequest) {
  const redirectUri = process.env.REDIRECT_URI || request.nextUrl.origin;

  await authProvider.acquireToken({
    successRedirect: "/",
    redirectUri: redirectUri,
    scopes: [],
  });
}

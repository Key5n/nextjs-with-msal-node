import { NextRequest } from "next/server";
import { authProvider } from "@/auth";

export async function POST(request: NextRequest) {
  const redirectUri = process.env.REDIRECT_URI || request.nextUrl.origin;

  await authProvider.handleRedirect(request, {
    scopes: [],
    redirectUri: redirectUri,
  });
}

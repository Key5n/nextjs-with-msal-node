import { NextRequest } from "next/server";
import { authProvider, CLIENT_ID } from "@/auth";

export async function GET(request: NextRequest) {
  const redirectUri = process.env.REDIRECT_URI || request.nextUrl.origin;

  await authProvider.login({
    successRedirect: "/",
    redirectUri: redirectUri,
    scopes: [],
    extraScopesToConsent: [`api://${CLIENT_ID}/Access`],
  });
}

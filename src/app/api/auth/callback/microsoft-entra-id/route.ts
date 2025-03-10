import { NextRequest } from "next/server";
import { authProvider } from "@/lib/auth";
import { REDIRECT_URI } from "@/lib/env";

export async function POST(request: NextRequest) {
  await authProvider.handleRedirect(request, {
    scopes: ["User.Read"],
    redirectUri: REDIRECT_URI,
  });
}

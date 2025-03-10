import { authProvider } from "@/lib/auth";
import { CLIENT_ID, REDIRECT_URI } from "@/lib/env";

export async function GET() {
  await authProvider.login({
    successRedirect: "/",
    redirectUri: REDIRECT_URI,
    scopes: ["User.Read"],
    extraScopesToConsent: [`api://${CLIENT_ID}/Access`],
  });
}

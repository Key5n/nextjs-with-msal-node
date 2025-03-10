import { authProvider } from "@/lib/auth";
// import { CLIENT_ID } from "@/lib/env";

export async function GET() {
  await authProvider.login({
    successRedirect: "/",
    scopes: ["User.Read"],
    // extraScopesToConsent: [`api://${CLIENT_ID}/Access`],
  });
}

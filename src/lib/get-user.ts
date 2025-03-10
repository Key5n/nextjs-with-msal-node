import { authProvider } from "@/lib/auth";
import { verifySession } from "./session";

export async function getUser() {
  const session = await verifySession();
  if (!session) return null;

  const accessToken = await authProvider.acquireToken({
    scopes: ["User.Read"],
    successRedirect: "/",
    homeAccountId: session.homeAccountId,
  });

  const fetchOptions: RequestInit = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  };

  const response = await fetch(
    "https://graph.microsoft.com/v1.0/me",
    fetchOptions,
  );

  if (!response.ok) {
    // TODO: improve error handling
    throw new Error("An error occurred while fetching the data");
  }

  const json = await response.json();

  return json;
}

import "server-only";
import { type JWTPayload, SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";

const secretKey = process.env.SESSION_SECRET;
const encodedKey = new TextEncoder().encode(secretKey);

export async function encrypt(payload: JWTPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .sign(encodedKey);
}

export async function decrypt(session: string | undefined = "") {
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ["HS256"],
    });
    return payload;
  } catch (error) {
    console.error(error);
  }
}

export async function createSession(homeAccountId: string) {
  const session = await encrypt({ homeAccountId });
  const cookieStore = await cookies();

  cookieStore.set("session", session);
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}

export const verifySession: () => Promise<{
  isAuth: boolean;
  homeAccountId: string;
}> = cache(async () => {
  const cookie = (await cookies()).get("session")?.value;
  const data = await decrypt(cookie);

  if (!data?.homeAccountId || typeof data?.homeAccountId !== "string") {
    redirect("/api/auth/signin");
  }

  return { isAuth: true, homeAccountId: data.homeAccountId };
});

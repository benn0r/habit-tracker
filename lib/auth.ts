import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET || "development-only-change-me");

export async function createSession(userId: string) {
  return new SignJWT({ userId }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("30d").sign(secret());
}

export async function getUserId() {
  const token = (await cookies()).get("ritual_session")?.value;
  if (!token) return null;
  try { return String((await jwtVerify(token, secret())).payload.userId); }
  catch { return null; }
}

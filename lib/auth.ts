import { cookies } from "next/headers";
import { createHash, randomBytes } from "crypto";
import { jwtVerify } from "jose";
import { getDb } from "@/lib/db";

const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET || "development-only-change-me");
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + 30 * 86400000).toISOString();
  const db = getDb();
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(new Date().toISOString());
  db.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)").run(hash(token), userId, expires);
  return token;
}

export async function getUserId() {
  const token = (await cookies()).get("ritual_session")?.value;
  if (!token) return null;
  const session = getDb().prepare(
    "SELECT user_id FROM sessions WHERE token_hash=? AND expires_at>?"
  ).get(hash(token), new Date().toISOString()) as { user_id: string } | undefined;
  if (session) return session.user_id;
  // Keep cookies issued by earlier versions valid during the migration.
  try { return String((await jwtVerify(token, secret())).payload.userId); }
  catch { return null; }
}

import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST() {
  if (process.env.E2E_TEST_MODE !== "1") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const userId = `e2e-reauth-${randomBytes(8).toString("hex")}`;
  const session = randomBytes(32).toString("base64url");
  const sessionHash = createHash("sha256").update(session).digest("hex");
  const database = getDb();
  database.prepare(
    "INSERT INTO users(id,name,email,access_token) VALUES(?,?,?,?)"
  ).run(userId, "Fantasy Athlete", "athlete@example.test", "expired-token");
  database.prepare(
    "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)"
  ).run(sessionHash, userId, new Date(Date.now() + 60_000).toISOString());

  return NextResponse.json({ session });
}

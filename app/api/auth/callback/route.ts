import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { todoist } from "@/lib/todoist";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const stored = (await cookies()).get("todoist_state")?.value;
  const origin = process.env.APP_URL || url.origin;
  if (!code || !state || state !== stored) return NextResponse.redirect(`${origin}/?error=oauth`);

  const tokenResponse = await fetch("https://api.todoist.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.TODOIST_CLIENT_ID,
      client_secret: process.env.TODOIST_CLIENT_SECRET,
      code,
    }),
  });
  if (!tokenResponse.ok) return NextResponse.redirect(`${origin}/?error=token`);
  const { access_token } = await tokenResponse.json();
  const user = await todoist<{ id: string; full_name: string; email?: string; avatar_big?: string }>(
    "/user",
    access_token,
  );
  getDb()
    .prepare(
      `INSERT INTO users(id,name,email,avatar,access_token) VALUES(?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email,
     avatar=excluded.avatar,access_token=excluded.access_token`,
    )
    .run(user.id, user.full_name, user.email || null, user.avatar_big || null, access_token);
  const response = NextResponse.redirect(`${origin}/app?sync=1`);
  response.cookies.set("ritual_session", await createSession(user.id), {
    httpOnly: true,
    secure: origin.startsWith("https"),
    sameSite: "lax",
    maxAge: 2592000,
  });
  response.cookies.delete("todoist_state");
  return response;
}

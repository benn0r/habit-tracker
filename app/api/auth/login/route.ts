import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

export async function GET(request: Request) {
  const state = randomBytes(24).toString("hex");
  const origin = process.env.APP_URL || new URL(request.url).origin;
  const url = new URL("https://todoist.com/oauth/authorize");
  url.searchParams.set("client_id", process.env.TODOIST_CLIENT_ID || "");
  url.searchParams.set("scope", "data:read");
  url.searchParams.set("state", state);
  const response = NextResponse.redirect(url);
  response.cookies.set("todoist_state", state, { httpOnly: true, secure: origin.startsWith("https"), sameSite: "lax", maxAge: 600 });
  return response;
}

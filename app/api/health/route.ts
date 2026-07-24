import { NextResponse } from "next/server";
export function GET() {
  return NextResponse.json({ status: "ok", version: (process.env.APP_VERSION || "dev").slice(0, 7) });
}

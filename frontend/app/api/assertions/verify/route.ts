import { NextRequest, NextResponse } from "next/server";
import { verifyJwt } from "@/lib/server/assertion";

export async function POST(request: NextRequest) {
  const body = await request.json();
  try {
    return NextResponse.json({ valid: true, payload: verifyJwt(body.assertion) });
  } catch (error) {
    return NextResponse.json({ valid: false, detail: error instanceof Error ? error.message : "invalid_assertion" }, { status: 401 });
  }
}


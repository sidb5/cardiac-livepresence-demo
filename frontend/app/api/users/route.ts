import { NextResponse } from "next/server";
import { users } from "@/lib/server/data";

export function GET() {
  return NextResponse.json(users);
}


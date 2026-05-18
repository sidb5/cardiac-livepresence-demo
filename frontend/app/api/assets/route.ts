import { NextResponse } from "next/server";
import { assets } from "@/lib/server/data";

export function GET() {
  return NextResponse.json(assets);
}


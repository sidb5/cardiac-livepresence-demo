import { NextResponse } from "next/server";
import { getAuditLog } from "@/lib/server/audit";

export function GET() {
  return NextResponse.json(getAuditLog());
}


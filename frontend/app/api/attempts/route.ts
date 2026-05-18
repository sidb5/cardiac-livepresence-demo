import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { runAdapters } from "@/lib/server/adapters";
import { makeAssertionPayload, signJwt } from "@/lib/server/assertion";
import { appendAuditRecord } from "@/lib/server/audit";
import { assets, users } from "@/lib/server/data";
import { evaluatePolicy } from "@/lib/server/policy";
import { extractFeatures } from "@/lib/server/processing";
import { simulateSignal } from "@/lib/server/simulator";
import type { AssetRecord, IdentityMode, Scenario } from "@/lib/server/types";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    user_id: string;
    asset_id: string;
    scenario: Scenario;
    identity_mode: IdentityMode;
    threat_level?: "normal" | "elevated" | "critical";
  };

  const user = users.find((u) => u.id === body.user_id);
  const asset = assets.find((a) => a.id === body.asset_id) as AssetRecord | undefined;
  if (!user) return NextResponse.json({ detail: "unknown_user" }, { status: 404 });
  if (!asset) return NextResponse.json({ detail: "unknown_asset" }, { status: 404 });

  const signal = simulateSignal(user.id, body.scenario);
  const features = extractFeatures(signal, user.ecg_template);
  const policyResult = evaluatePolicy(features, asset.asset_type, body.identity_mode, body.threat_level ?? "normal");
  const attemptId = `attempt-${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const assertionPayload = makeAssertionPayload({
    attemptId,
    userId: user.id,
    assetId: asset.id,
    assetType: asset.asset_type,
    identityMode: body.identity_mode,
    features,
    policyResult,
  });
  const assertion = signJwt(assertionPayload);
  const adapterOutputs = runAdapters(policyResult, assertion, asset.asset_type);

  appendAuditRecord(attemptId, "access_attempt", {
    user_id: user.id,
    asset_id: asset.id,
    asset_type: asset.asset_type,
    scenario: body.scenario,
    identity_mode: body.identity_mode,
    decision: policyResult.decision,
    reason_codes: policyResult.reason_codes,
    assertion_hash: crypto.createHash("sha256").update(assertion).digest("hex"),
  });

  return NextResponse.json({
    attempt_id: attemptId,
    decision: policyResult.decision,
    confidence: policyResult.confidence,
    reason_codes: policyResult.reason_codes,
    features,
    assertion,
    assertion_payload: assertionPayload,
    adapter_outputs: adapterOutputs,
    traces: {
      time: signal.time,
      ecg: signal.ecg,
      ppg: signal.ppg,
      r_peaks: signal.r_peaks,
      ppg_peaks: signal.ppg_peaks,
      raw_signal_persisted: false,
    },
  });
}


import crypto from "node:crypto";

const ISSUER = "live-presence-mvp-vercel-demo";
const SIGNING_KEY = process.env.JWT_SIGNING_KEY ?? "dev-local-demo-key-change-before-any-real-pilot";

export function makeAssertionPayload(input: {
  attemptId: string;
  userId: string;
  assetId: string;
  assetType: string;
  identityMode: string;
  features: Record<string, any>;
  policyResult: Record<string, any>;
}) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + input.policyResult.policy.token_seconds;
  return {
    iss: ISSUER,
    sub: input.userId,
    jti: input.attemptId,
    iat,
    exp,
    asset_id: input.assetId,
    asset_type: input.assetType,
    identity_mode: input.identityMode,
    live_presence_status: input.policyResult.confidence >= input.policyResult.policy.live_threshold ? "pass" : "degraded",
    confidence: input.policyResult.confidence,
    ecg_identity_match_status: input.features.ecg_identity_status,
    ecg_identity_score: input.features.ecg_identity_score,
    signal_quality_state: { ecg: input.features.ecg_quality, ppg: input.features.ppg_quality },
    ecg_ppg_coupling_state: input.features.ecg_ppg_coupling_status,
    sensor_source_metadata: input.features.source_metadata,
    policy_result: input.policyResult.decision,
    session_action: input.policyResult.session_action,
    duress_alert: input.policyResult.duress_alert,
    reason_codes: input.policyResult.reason_codes,
  };
}

export function signJwt(payload: Record<string, any>) {
  const header = { alg: "HS256", typ: "JWT" };
  const h = b64(JSON.stringify(header));
  const p = b64(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", SIGNING_KEY).update(`${h}.${p}`).digest("base64url");
  return `${h}.${p}.${sig}`;
}

export function verifyJwt(token: string) {
  const [h, p, sig] = token.split(".");
  if (!h || !p || !sig) throw new Error("malformed_assertion");
  const expected = crypto.createHmac("sha256", SIGNING_KEY).update(`${h}.${p}`).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) throw new Error("invalid_signature");
  const payload = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
  if (Math.floor(Date.now() / 1000) >= payload.exp) throw new Error("assertion_expired");
  return payload;
}

function b64(value: string) {
  return Buffer.from(value).toString("base64url");
}


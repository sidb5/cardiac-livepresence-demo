import crypto from "node:crypto";

type AuditRecord = {
  sequence: number;
  event_id: string;
  event_type: string;
  payload: Record<string, any>;
  previous_hash: string;
  record_hash: string;
  created_at: string;
};

const g = globalThis as typeof globalThis & { __livePresenceAudit?: AuditRecord[] };
if (!g.__livePresenceAudit) g.__livePresenceAudit = [];

const GENESIS_HASH = "0".repeat(64);

export function appendAuditRecord(eventId: string, eventType: string, payload: Record<string, any>) {
  const records = g.__livePresenceAudit!;
  const previousHash = records.at(-1)?.record_hash ?? GENESIS_HASH;
  const recordHash = computeHash(previousHash, eventId, eventType, payload);
  const record = {
    sequence: records.length + 1,
    event_id: eventId,
    event_type: eventType,
    payload,
    previous_hash: previousHash,
    record_hash: recordHash,
    created_at: new Date().toISOString(),
  };
  records.push(record);
  return record;
}

export function getAuditLog() {
  const records = g.__livePresenceAudit!;
  return { chain: verifyAuditChain(), records: [...records].reverse().slice(0, 100) };
}

function verifyAuditChain() {
  let previousHash = GENESIS_HASH;
  for (const record of g.__livePresenceAudit!) {
    const expected = computeHash(previousHash, record.event_id, record.event_type, record.payload);
    if (record.previous_hash !== previousHash || record.record_hash !== expected) return { valid: false, failed_sequence: record.sequence };
    previousHash = record.record_hash;
  }
  return { valid: true, records_checked: g.__livePresenceAudit!.length };
}

function computeHash(previousHash: string, eventId: string, eventType: string, payload: Record<string, any>) {
  return crypto.createHash("sha256").update(JSON.stringify({ previous_hash: previousHash, event_id: eventId, event_type: eventType, payload })).digest("hex");
}


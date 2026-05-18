from __future__ import annotations

import hashlib
import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import AuditRecord


GENESIS_HASH = "0" * 64


def append_audit_record(db: Session, event_id: str, event_type: str, payload: dict[str, Any]) -> AuditRecord:
    previous = db.execute(select(AuditRecord).order_by(AuditRecord.sequence.desc())).scalars().first()
    previous_hash = previous.record_hash if previous else GENESIS_HASH
    record_hash = compute_hash(previous_hash, event_id, event_type, payload)
    record = AuditRecord(
        event_id=event_id,
        event_type=event_type,
        payload=payload,
        previous_hash=previous_hash,
        record_hash=record_hash,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def compute_hash(previous_hash: str, event_id: str, event_type: str, payload: dict[str, Any]) -> str:
    body = json.dumps(
        {"previous_hash": previous_hash, "event_id": event_id, "event_type": event_type, "payload": payload},
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(body.encode()).hexdigest()


def verify_audit_chain(db: Session) -> dict[str, Any]:
    records = db.execute(select(AuditRecord).order_by(AuditRecord.sequence.asc())).scalars().all()
    previous_hash = GENESIS_HASH
    for record in records:
        expected = compute_hash(previous_hash, record.event_id, record.event_type, record.payload)
        if record.previous_hash != previous_hash or record.record_hash != expected:
            return {"valid": False, "failed_sequence": record.sequence}
        previous_hash = record.record_hash
    return {"valid": True, "records_checked": len(records)}


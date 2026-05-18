from __future__ import annotations

from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session

from .adapters.simulated import run_adapters
from .assertions.signer import make_assertion_payload, sign_jwt, verify_jwt
from .audit.chain import append_audit_record, verify_audit_chain
from .db import SessionLocal, get_db, init_db
from .models import AccessAttempt, Asset, AuditRecord, User
from .policy.engine import evaluate_policy, get_policy, set_policy_override
from .schemas import AttemptRequest, AttemptResponse, AssetOut, PolicyConfigIn, UserOut
from .signal.processing import extract_features
from .signal.simulator import USER_PROFILES, enrollment_template, simulate_signal


app = FastAPI(
    title="Live-Presence Authorization Demo API",
    description="Local-only MVP for signed cardiac live-presence authorization assertions.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


DEMO_ASSETS = [
    ("door-main-scif", "SCIF Door Reader", "secure_door", "standard"),
    ("terminal-alpha", "Classified Terminal Alpha", "classified_terminal", "high"),
    ("armory-drawer-2", "Armory Drawer 2", "armory", "critical"),
    ("vehicle-gate-7", "Secure Vehicle Gate 7", "vehicle", "high"),
    ("drone-console-raven", "Drone Console Raven", "drone", "critical"),
    ("command-console-1", "Command Console 1", "command_console", "critical"),
    ("water-plant-hmi", "Water Plant HMI", "critical_infrastructure", "critical"),
]


@app.on_event("startup")
def startup() -> None:
    init_db()
    with SessionLocal() as db:
        seed_demo_data(db)


def seed_demo_data(db: Session) -> None:
    for user_id in USER_PROFILES:
        if db.get(User, user_id) is None:
            db.add(
                User(
                    id=user_id,
                    display_name=user_id.replace("-", " ").title(),
                    role="supervisor" if user_id.startswith("supervisor") else "operator",
                    ecg_template=enrollment_template(user_id),
                )
            )
    for asset_id, name, asset_type, risk in DEMO_ASSETS:
        if db.get(Asset, asset_id) is None:
            db.add(
                Asset(
                    id=asset_id,
                    name=name,
                    asset_type=asset_type,
                    risk_level=risk,
                    metadata_json={"integration": "simulated", "production_certified": False},
                )
            )
    db.commit()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "mode": "local"}


@app.get("/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)) -> list[User]:
    return list(db.execute(select(User).order_by(User.id)).scalars())


@app.get("/assets", response_model=list[AssetOut])
def list_assets(db: Session = Depends(get_db)) -> list[Asset]:
    return list(db.execute(select(Asset).order_by(Asset.asset_type)).scalars())


@app.get("/policy/{asset_type}")
def read_policy(asset_type: str, threat_level: str = "normal") -> dict:
    try:
        return get_policy(asset_type, threat_level)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="unknown_asset_type") from exc


@app.post("/policy")
def update_policy(config: PolicyConfigIn) -> dict:
    return set_policy_override(config.asset_type, config.model_dump(exclude_none=True))


@app.post("/attempts", response_model=AttemptResponse)
def create_attempt(request: AttemptRequest, db: Session = Depends(get_db)) -> AttemptResponse:
    user = db.get(User, request.user_id)
    asset = db.get(Asset, request.asset_id)
    if user is None:
        raise HTTPException(status_code=404, detail="unknown_user")
    if asset is None:
        raise HTTPException(status_code=404, detail="unknown_asset")

    signal = simulate_signal(user.id, request.scenario)
    features = extract_features(signal, user.ecg_template)
    policy_result = evaluate_policy(features, asset.asset_type, request.identity_mode, request.threat_level)
    attempt_id = f"attempt-{uuid4().hex[:12]}"
    payload = make_assertion_payload(
        attempt_id=attempt_id,
        user_id=user.id,
        asset_id=asset.id,
        asset_type=asset.asset_type,
        identity_mode=request.identity_mode,
        features=features,
        policy_result=policy_result,
    )
    assertion = sign_jwt(payload)
    adapters = run_adapters(policy_result, assertion, asset.asset_type, request.adapter_mode)

    attempt = AccessAttempt(
        id=attempt_id,
        user_id=user.id,
        asset_id=asset.id,
        asset_type=asset.asset_type,
        identity_mode=request.identity_mode,
        scenario=request.scenario,
        decision=policy_result["decision"],
        confidence=policy_result["confidence"],
        features={k: v for k, v in features.items() if k not in {"r_peak_times", "ppg_peak_times"}},
        reason_codes=policy_result["reason_codes"],
        assertion_jwt=assertion,
        adapter_outputs=adapters,
    )
    db.add(attempt)
    db.commit()

    append_audit_record(
        db,
        event_id=attempt_id,
        event_type="access_attempt",
        payload={
            "user_id": user.id,
            "asset_id": asset.id,
            "asset_type": asset.asset_type,
            "scenario": request.scenario,
            "identity_mode": request.identity_mode,
            "decision": policy_result["decision"],
            "reason_codes": policy_result["reason_codes"],
            "assertion_hash": assertion_hash(assertion),
        },
    )

    return AttemptResponse(
        attempt_id=attempt_id,
        decision=policy_result["decision"],
        confidence=policy_result["confidence"],
        reason_codes=policy_result["reason_codes"],
        features=features,
        assertion=assertion,
        assertion_payload=payload,
        adapter_outputs=adapters,
        traces={
            "time": signal.time,
            "ecg": signal.ecg,
            "ppg": signal.ppg,
            "r_peaks": signal.r_peaks,
            "ppg_peaks": signal.ppg_peaks,
            "raw_signal_persisted": False,
        },
    )


@app.get("/attempts")
def list_attempts(db: Session = Depends(get_db)) -> list[dict]:
    rows = db.execute(select(AccessAttempt).order_by(AccessAttempt.created_at.desc()).limit(50)).scalars()
    return [
        {
            "id": row.id,
            "user_id": row.user_id,
            "asset_id": row.asset_id,
            "asset_type": row.asset_type,
            "identity_mode": row.identity_mode,
            "scenario": row.scenario,
            "decision": row.decision,
            "confidence": row.confidence,
            "reason_codes": row.reason_codes,
            "created_at": row.created_at.isoformat(),
        }
        for row in rows
    ]


@app.post("/assertions/verify")
def verify_assertion(body: dict) -> dict:
    try:
        payload = verify_jwt(body["assertion"])
    except KeyError as exc:
        raise HTTPException(status_code=400, detail="missing_assertion") from exc
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    return {"valid": True, "payload": payload}


@app.get("/audit")
def audit_log(db: Session = Depends(get_db)) -> dict:
    rows = db.execute(select(AuditRecord).order_by(AuditRecord.sequence.desc()).limit(100)).scalars()
    return {
        "chain": verify_audit_chain(db),
        "records": [
            {
                "sequence": row.sequence,
                "event_id": row.event_id,
                "event_type": row.event_type,
                "payload": row.payload,
                "previous_hash": row.previous_hash,
                "record_hash": row.record_hash,
                "created_at": row.created_at.isoformat(),
            }
            for row in rows
        ],
    }


def assertion_hash(assertion: str) -> str:
    import hashlib

    return hashlib.sha256(assertion.encode()).hexdigest()

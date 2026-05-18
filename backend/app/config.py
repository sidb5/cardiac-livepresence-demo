from __future__ import annotations

import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR / 'livepresence.db'}")
JWT_ISSUER = os.getenv("JWT_ISSUER", "live-presence-mvp-local")
JWT_SIGNING_KEY = os.getenv(
    "JWT_SIGNING_KEY",
    "dev-local-demo-key-change-before-any-real-pilot",
)
LOCAL_ONLY_MODE = os.getenv("LOCAL_ONLY_MODE", "true").lower() in {"1", "true", "yes"}


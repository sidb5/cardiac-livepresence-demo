from __future__ import annotations


ASSET_PROFILES = {
    "secure_door": {
        "live_threshold": 0.72,
        "identity_threshold": 0.72,
        "require_ppg": False,
        "token_seconds": 45,
        "fail_secure": "deny/relock",
    },
    "classified_terminal": {
        "live_threshold": 0.78,
        "identity_threshold": 0.76,
        "require_ppg": True,
        "token_seconds": 30,
        "fail_secure": "freeze_or_lock_session",
    },
    "armory": {
        "live_threshold": 0.84,
        "identity_threshold": 0.80,
        "require_ppg": True,
        "token_seconds": 20,
        "fail_secure": "relock_drawer_and_alert_supervisor",
    },
    "vehicle": {
        "live_threshold": 0.78,
        "identity_threshold": 0.76,
        "require_ppg": True,
        "token_seconds": 25,
        "fail_secure": "safe_stop_or_ignition_deny_simulation",
    },
    "drone": {
        "live_threshold": 0.82,
        "identity_threshold": 0.78,
        "require_ppg": True,
        "token_seconds": 18,
        "fail_secure": "return_to_home_or_command_hold_simulation",
    },
    "command_console": {
        "live_threshold": 0.86,
        "identity_threshold": 0.82,
        "require_ppg": True,
        "token_seconds": 15,
        "fail_secure": "command_hold_and_supervisor_approval",
    },
    "critical_infrastructure": {
        "live_threshold": 0.83,
        "identity_threshold": 0.80,
        "require_ppg": True,
        "token_seconds": 20,
        "fail_secure": "read_only_mode_or_command_quarantine",
    },
}


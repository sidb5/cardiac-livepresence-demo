# Live-Presence Authorization Demo

This MVP demonstrates a software-led security layer that receives physiological signal data, evaluates live presence, applies an asset-specific policy, and issues a signed live-presence authorization assertion.

The Vercel demo version is a single Next.js app. The dashboard and API are served by the same server using in-memory demo data.

It is not a medical device, does not diagnose health conditions, and is not production-certified for access-control deployment.

## What It Does

- Simulates ECG and optional PPG / blood-flow pulse signals.
- Supports two demo modes:
  - live-presence only, where an existing credential selects the user
  - ECG identity + live-presence, where derived ECG features are matched to a user template
- Evaluates ECG quality, R-peak timing, PPG timing, ECG-to-PPG coupling, replay indicators, synthetic/spoof indicators, contact plausibility, and duress-like deviation.
- Applies deterministic policy rules by protected asset type.
- Issues short-lived signed JWT live-presence assertions.
- Simulates REST, Wiegand-style, OSDP-style, relay, zero-trust, and offline/local outputs.
- Logs tamper-evident audit records using an in-memory hash chain for the hosted demo.
- Does not store raw ECG/PPG by default.

## What It Does Not Do

- It does not connect to real ECG/PPG hardware yet.
- It does not provide medical monitoring or diagnosis.
- It does not claim spoof-proof security.
- It does not implement certified Wiegand, OSDP, relay, or government access-panel integration.
- It does not replace CAC/PIV, badge, PIN, face, iris, fingerprint, or passkey workflows.

## Run Locally

Single-server Vercel-style demo:

```powershell
cd E:\PROJECTS\ECG+PPG-Biometric-Security\PROTOTYPE\frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

Optional Python edge-reference backend:

```powershell
cd E:\PROJECTS\ECG+PPG-Biometric-Security\PROTOTYPE\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The dashboard does not require the Python backend unless `NEXT_PUBLIC_API_BASE` is explicitly set.

## Simulated Access Attempts

The dashboard lets you choose:

- user profile
- protected asset
- demo mode
- threat level
- signal scenario

Scenarios include normal live ECG, live ECG + PPG, poor signal, replayed ECG, synthetic/spoofed ECG, missing PPG, bad ECG-to-PPG timing, and duress-like deviation.

## Inspect Assertions

Each access attempt returns a signed JWT containing:

- user/session identifier
- asset identifier and type
- issue and expiration time
- identity mode
- ECG identity score/status
- live-presence confidence
- signal quality state
- ECG/PPG coupling state
- policy result
- reason codes
- sensor/source metadata

Use the dashboard assertion viewer or `POST /assertions/verify`.

## Inspect Audit Logs

Use the dashboard audit log viewer or call:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/audit
```

Audit records are hash-chained in memory for the hosted demo. Raw ECG/PPG traces are not persisted in the default data model.

## Add Real Sensor Providers Later

Implement a new provider behind the same signal-provider boundary currently used by the simulator. Future providers should normalize data into:

- sample rate
- ECG samples
- optional PPG/pulse samples
- sensor metadata
- timestamp/nonce
- optional sensor attestation reference

Planned provider types:

- simulated ECG
- simulated ECG + PPG
- file replay provider
- serial/USB ECG provider
- BLE wearable provider
- future attested sensor provider

## Add Access-Control Adapters Later

The MVP adapters are simulations. Real deployments should use certified hardware and a professional access-control/security integrator.

Future adapters can replace the simulated modules for:

- REST access decision API
- OSDP secure reader path
- Wiegand compatibility path
- dry-contact relay hardware
- local terminal agent
- zero-trust / identity-provider token handoff

## Tests

Backend reference tests:

```powershell
cd E:\PROJECTS\ECG+PPG-Biometric-Security\PROTOTYPE\backend
pytest
```

Frontend build:

```powershell
cd E:\PROJECTS\ECG+PPG-Biometric-Security\PROTOTYPE\frontend
npm run build
```

## Vercel Demo Notes

Deploy the `frontend` folder to Vercel. The demo uses in-memory data, so audit history resets when the serverless/runtime instance resets. That is acceptable for BD walkthroughs. For a persistent hosted demo, add Postgres later.

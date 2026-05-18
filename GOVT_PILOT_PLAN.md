# Government Pilot Plan

## 90-Day Structure

The pilot should prove the software-led authorization workflow first, then validate real signal acquisition and integration assumptions under controlled conditions.

## Phase 1: Software-Only Simulation

Duration: days 1-20.

- Demonstrate user selection, protected asset selection, signal scenarios, policy decisions, signed assertions, adapter simulations, and hash-chained audit logs.
- Validate local-only operation.
- Confirm no raw physiological signal storage by default.

## Phase 2: Bench ECG/PPG Hardware Demo

Duration: days 21-45.

- Add prototype ECG and PPG providers behind the existing provider interface.
- Validate signal quality, latency, ECG event detection, and ECG-to-PPG timing.
- Keep the access-control side simulated.

## Phase 3: Retrofit Access-Control Simulation

Duration: days 46-70.

- Connect to a bench panel, relay test rig, terminal agent, or isolated lab controller.
- Demonstrate allow, deny, step-up, limited, terminate, maintain, and fail-secure transitions.
- Keep any Wiegand/OSDP/relay demo non-production and clearly labeled.

## Phase 4: Controlled Facility Pilot Planning

Duration: days 71-90.

- Select one asset type: secure door, armory drawer, classified terminal, or command console.
- Define operator workflow.
- Define logging and privacy boundaries.
- Define success metrics and stop criteria.
- Engage certified access-control and hardware-security integrators.

## Success Metrics

- Decision latency.
- False reject rate under controlled conditions.
- Denial of replay, synthetic, missing-signal, and bad-timing scenarios.
- Local-only operation.
- No raw physiological data export by default.
- Verifiable audit trail.
- Compatibility with existing access-control workflow.

## Risks and Mitigations

- Signal quality variation: test multiple electrode placements and contact surfaces.
- Motion artifacts: add quality gates and step-up/degraded modes.
- False rejects: tune thresholds by asset type.
- Spoof/replay claims: validate only against tested attack models.
- Integration risk: use certified integrators for facility interfaces.
- Privacy risk: store derived features and assertions, not raw waveforms by default.

## What The Pilot Proves

- The software authorization workflow is practical.
- Live-presence assertions can be signed, verified, and audited locally.
- Existing access workflows can consume a live-presence decision.
- ECG/PPG coupling can be represented in a policy decision.

## What The Pilot Does Not Prove

- Production security certification.
- Medical validity.
- Universal spoof resistance.
- Facility-wide readiness.
- Final ECG biometric performance across all users, environments, and sensor placements.


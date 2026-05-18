# Integration Guide

The system is designed as a live-presence authorization layer that complements existing credentials and access-control workflows.

## Existing Access-Control Panels

The preferred deployment model is retrofit. Existing badge, PIN, CAC/PIV, face, fingerprint, iris, or passkey workflows remain the identity layer. This system adds a local live-presence decision before access is granted, maintained, limited, or terminated.

## Wiegand Path

The MVP simulates Wiegand-style allow/deny behavior. Real Wiegand deployments require certified integrator involvement and careful risk review because Wiegand is limited for modern secure reader-to-panel communication.

## OSDP Path

OSDP should be preferred for higher-security deployments. A real integration would use certified OSDP-capable readers/controllers and would pass a live-presence decision or assertion reference through the secure reader/panel workflow.

## Relay Path

The MVP simulates dry-contact relay behavior. A real relay path may be acceptable for bench demos or isolated controls, but facility deployment needs safety analysis, supervised wiring, tamper monitoring, and integrator signoff.

## USB / Local Terminal Path

A classified terminal or protected workstation can consume assertions from a local agent over USB, local IPC, localhost REST, or a signed file/socket handoff. The terminal should verify the assertion signature, asset binding, expiration, and policy result.

## REST API Path

The backend exposes an API-style access decision. A protected asset can submit or consume an assertion and verify that it was issued by the trusted local module.

## Zero Trust / JWT / Identity Provider Path

The signed live-presence assertion can be represented as a JWT claim for a zero-trust policy engine, identity provider, privileged access gateway, or command authorization service. The downstream service should verify signature, expiration, asset binding, sensor metadata, and reason codes.

## Air-Gapped Deployment Path

Air-gapped mode uses local processing, local database storage, local signing keys, and local audit logs. No cloud service is required. Raw physiological waveforms should remain local and should not be stored by default.

## Existing Credential Workflow

Recommended sequence:

1. User presents CAC/PIV/badge/PIN/biometric/passkey.
2. Existing identity system confirms claimed identity.
3. User touches live-presence sensor surface.
4. Local module evaluates live presence and optional ECG identity match.
5. Module signs short-lived asset-bound assertion.
6. Existing system consumes decision or token.
7. Audit chain records the event.

## Government Pilot Deployment Model

Start with a software-only demo, then a bench hardware demo, then a retrofit simulation attached to a non-production panel or terminal, then controlled pilot planning for one asset class.

Do not represent simulated Wiegand, OSDP, or relay outputs as production-certified.


# Hardware Evaluation

This MVP is software-first and sensor-agnostic. Hardware is an input path, not the product boundary.

## Prototype-Grade Options

- Edge compute: Raspberry Pi 5 or mini-PC.
- ECG front end: ADS1292R / ADS1293-type evaluation modules or similar ECG analog front ends.
- PPG / pulse sensing: MAX30102 for bench demos; MAX86141-class optical AFE for stronger prototype work.
- Contact surface: conductive pads, dry electrodes, palm pad, handle grip, or terminal palm rest.
- Relay simulation: USB/GPIO relay board for bench fail-secure demos.
- Optional device identity: TPM module or secure element such as OPTIGA TPM or ATECC608-class component.

## Pilot-Grade Direction

- Industrial mini-PC or embedded Linux edge box.
- Rugged sealed enclosure.
- Better ECG analog front end with stable electrode geometry.
- Reliable PPG placement with ambient-light control.
- Tamper switch and enclosure-open detection.
- Local signing key storage in TPM, secure element, HSM, or validated cryptographic module.
- OSDP-capable interface.
- Sealed retrofit reader or protected terminal module.

## What Must Be Validated

- Signal quality across users and placements.
- False reject rate and false accept risk.
- Decision latency.
- Replay resistance.
- ECG/PPG timing reliability.
- Skin/contact variation.
- Motion artifacts.
- Environmental electrical and optical noise.
- Operator usability in real workflows.
- Session drift for ECG identity matching.

## What Requires a Professional Hardware/Security Integrator

- Physical enclosure and tamper hardening.
- Facility panel integration.
- Certified OSDP/Wiegand integration.
- Relay safety design.
- Compliance testing.
- Ruggedization.
- Government deployment hardening.
- Key provisioning and secure manufacturing process.

## Notes

The MVP uses simulated ECG and PPG. Real hardware should be introduced only through a replaceable provider interface so the product does not become hardcoded around one ECG board, one PPG module, or one access-panel vendor.


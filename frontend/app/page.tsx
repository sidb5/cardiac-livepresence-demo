"use client";

import { useEffect, useMemo, useState } from "react";
import { AssertionViewer } from "@/components/AssertionViewer";
import { AuditLogViewer } from "@/components/AuditLogViewer";
import { SignalTraceChart } from "@/components/SignalTraceChart";
import { TimingCouplingChart } from "@/components/TimingCouplingChart";
import { createAttempt, getAssets, getAudit, getUsers } from "@/lib/api";
import type { Asset, AttemptResponse, IdentityMode, Scenario, User } from "@/lib/types";

const scenarios: { id: Scenario; label: string }[] = [
  { id: "live_ecg_ppg", label: "Normal live ECG + PPG" },
  { id: "live_ecg", label: "Normal live ECG only" },
  { id: "poor_signal", label: "Poor signal quality" },
  { id: "replayed_ecg", label: "Replayed ECG" },
  { id: "synthetic_spoof", label: "Synthetic/spoofed ECG" },
  { id: "missing_ppg", label: "Missing PPG" },
  { id: "bad_ecg_ppg_timing", label: "Bad ECG-to-PPG timing" },
  { id: "duress_deviation", label: "Duress-like deviation" },
];

const modes: { id: IdentityMode; label: string; detail: string }[] = [
  { id: "live_presence_only", label: "Live-presence only", detail: "Credential selects identity; ECG/PPG validates live presence." },
  { id: "ecg_identity_live_presence", label: "ECG identity + live-presence", detail: "Derived ECG template match is required before policy allows access." },
];

const baseChecks = [
  "Is the ECG clean enough to trust for a security decision?",
  "Can we find real heartbeat events in the ECG trace?",
  "Do the heartbeat intervals vary like a live person instead of a recording?",
  "Does the sensor contact look physically plausible?",
  "Does the signal show signs of replay, injection, or synthetic generation?",
  "Does this result satisfy the policy for this exact asset?",
  "Create a short-lived signed token bound to this user and asset.",
  "Add the event to a hash-chained audit log for later review.",
];

const ppgChecks = [
  "Is a downstream pulse / blood-flow signal present?",
  "Does each ECG heartbeat line up with a later pulse signal?",
  "Is the ECG-to-pulse delay in a believable human range?",
  "Does that delay vary naturally from beat to beat?",
];

const scenarioChecks: Record<Scenario, string[]> = {
  live_ecg: [
    "Only ECG is available, so the system treats this as reduced assurance.",
    "High-risk assets may require step-up because no pulse signal is present.",
  ],
  live_ecg_ppg: [
    "Both ECG and pulse signals are present for the same access attempt.",
    "The system checks whether the two signals behave like one live body.",
  ],
  poor_signal: [
    "The signal is noisy, unstable, or hard to trust.",
    "Policy may deny access or require another authentication step.",
  ],
  replayed_ecg: [
    "The heartbeat timing looks too repeated, like a recording being played back.",
    "The system raises replay risk and blocks the access decision.",
  ],
  synthetic_spoof: [
    "The waveform looks too artificial or too regular to trust.",
    "The system treats this as a possible generated or injected signal.",
  ],
  missing_ppg: [
    "ECG is present, but the expected pulse / blood-flow signal is missing.",
    "Assets that require dual-signal liveness will deny or step up.",
  ],
  bad_ecg_ppg_timing: [
    "The pulse arrives too early or too late after the ECG heartbeat.",
    "That breaks the live-body timing relationship, so access is denied.",
  ],
  duress_deviation: [
    "The current pattern differs sharply from the expected user state.",
    "The system can limit access while silently flagging a covert alert.",
  ],
};

export default function Home() {
  const [users, setUsers] = useState<User[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [userId, setUserId] = useState("operator-014");
  const [assetId, setAssetId] = useState("door-main-scif");
  const [scenario, setScenario] = useState<Scenario>("live_ecg_ppg");
  const [identityMode, setIdentityMode] = useState<IdentityMode>("ecg_identity_live_presence");
  const [threatLevel, setThreatLevel] = useState<"normal" | "elevated" | "critical">("normal");
  const [attempt, setAttempt] = useState<AttemptResponse | null>(null);
  const [audit, setAudit] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([getUsers(), getAssets(), getAudit()])
      .then(([u, a, auditData]) => {
        setUsers(u);
        setAssets(a);
        setAudit(auditData);
        if (u[0]) setUserId(u[0].id);
        if (a[0]) setAssetId(a[0].id);
      })
      .catch((err) => setError(String(err)));
  }, []);

  const selectedAsset = useMemo(() => assets.find((asset) => asset.id === assetId), [assets, assetId]);
  const selectedUser = useMemo(() => users.find((user) => user.id === userId), [users, userId]);

  async function runAttempt() {
    setLoading(true);
    setError(null);
    try {
      const result = await createAttempt({ user_id: userId, asset_id: assetId, scenario, identity_mode: identityMode, threat_level: threatLevel });
      setAttempt(result);
      setAudit(await getAudit());
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <header className="topbar">
        <div>
          <div className="eyebrow">Local-only security MVP</div>
          <h1>Live-Presence Authorization Demo</h1>
        </div>
        <div className="statusPill">Raw ECG/PPG storage off</div>
      </header>

      {error && <div className="error">{error}</div>}

      <section className="layout">
        <aside className="side">
          <Panel title="Enrollment / User">
            <select value={userId} onChange={(event) => setUserId(event.target.value)}>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.display_name}
                </option>
              ))}
            </select>
            <div className="templateBox">
              <div className="smallLabel">Derived ECG Template</div>
              <code>{userId}</code>
              <span>Raw waveform stored: false</span>
            </div>
          </Panel>

          <Panel title="Protected Asset">
            <select value={assetId} onChange={(event) => setAssetId(event.target.value)}>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </select>
            {selectedAsset && (
              <div className="assetMeta">
                <span>{selectedAsset.asset_type.replaceAll("_", " ")}</span>
                <b>{selectedAsset.risk_level}</b>
              </div>
            )}
          </Panel>

          <Panel title="Demo Mode">
            <div className="segmented">
              {modes.map((mode) => (
                <button key={mode.id} className={identityMode === mode.id ? "active" : ""} onClick={() => setIdentityMode(mode.id)}>
                  <strong>{mode.label}</strong>
                  <span>{mode.detail}</span>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Simulation Controls">
            <select value={scenario} onChange={(event) => setScenario(event.target.value as Scenario)}>
              {scenarios.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <select value={threatLevel} onChange={(event) => setThreatLevel(event.target.value as any)}>
              <option value="normal">Normal threat level</option>
              <option value="elevated">Elevated threat level</option>
              <option value="critical">Critical threat level</option>
            </select>
            <button className="primary" onClick={runAttempt} disabled={loading || !userId || !assetId}>
              {loading ? "Running..." : "Run Access Attempt"}
            </button>
          </Panel>

          <Panel title="Checks Running">
            <CheckList scenario={scenario} identityMode={identityMode} selectedAsset={selectedAsset} />
          </Panel>
        </aside>

        <section className="workspace">
          <DecisionNarrative
            attempt={attempt}
            scenario={scenario}
            identityMode={identityMode}
            selectedAsset={selectedAsset}
            selectedUser={selectedUser}
          />

          <div className="decisionBand" id="decision-summary">
            <Metric label="Decision" value={attempt?.decision ?? "waiting"} tone={attempt?.decision ?? "waiting"} />
            <Metric label="Live Confidence" value={attempt ? `${Math.round(attempt.confidence * 100)}%` : "--"} />
            <Metric label="ECG Identity" value={attempt?.features.ecg_identity_status ?? "--"} />
            <Metric label="Coupling" value={attempt?.features.ecg_ppg_coupling_status ?? "--"} />
          </div>

          {attempt ? (
            <>
              <div className="charts" id="signal-evidence">
                <SignalTraceChart title="ECG Trace" time={attempt.traces.time} values={attempt.traces.ecg} markers={attempt.traces.r_peaks} color="#58d68d" />
                <SignalTraceChart title="PPG / Blood-Flow Pulse Trace" time={attempt.traces.time} values={attempt.traces.ppg} markers={attempt.traces.ppg_peaks} color="#5dade2" />
                <TimingCouplingChart rPeaks={attempt.traces.r_peaks} ppgPeaks={attempt.traces.ppg_peaks} />
              </div>

              <Panel title="Policy Result And Reason Codes" id="policy-reasons">
                <div className="reasonList">
                  {attempt.reason_codes.map((reason) => (
                    <span key={reason}>{reason}</span>
                  ))}
                </div>
              </Panel>

              <div className="twoCol">
                <Panel title="Signed Assertion Viewer" id="assertion-view">
                  <AssertionViewer assertion={attempt.assertion} payload={attempt.assertion_payload} />
                </Panel>
                <Panel title="Integration Adapter Outputs" id="integration-output">
                  <pre>{JSON.stringify(attempt.adapter_outputs, null, 2)}</pre>
                </Panel>
              </div>

              <div id="audit-log">
                <Panel title="Audit Log Viewer">
                  <AuditLogViewer audit={audit} />
                </Panel>
              </div>
            </>
          ) : (
            <div className="twoCol">
              <Panel title="Signal Evidence" id="signal-evidence">
                <div className="emptyBlock">Run an access attempt to show ECG, PPG, and timing evidence.</div>
              </Panel>
              <Panel title="Policy Result And Reason Codes" id="policy-reasons">
                <div className="emptyBlock">The decision path and reason codes will appear here after a test.</div>
              </Panel>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function Panel({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section className="panel" id={id}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className={`metric ${tone ?? ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DecisionNarrative({
  attempt,
  scenario,
  identityMode,
  selectedAsset,
  selectedUser,
}: {
  attempt: AttemptResponse | null;
  scenario: Scenario;
  identityMode: IdentityMode;
  selectedAsset?: Asset;
  selectedUser?: User;
}) {
  const scenarioLabel = scenarios.find((item) => item.id === scenario)?.label ?? scenario;
  const userLabel = selectedUser?.display_name ?? "selected user";
  const assetLabel = selectedAsset?.name ?? "selected asset";
  const assetType = selectedAsset?.asset_type.replaceAll("_", " ") ?? "asset";
  const modeLabel = identityMode === "ecg_identity_live_presence" ? "ECG identity plus live-presence" : "live-presence only";

  if (!attempt) {
    return (
      <section className="narrativeCard">
        <div>
          <div className="eyebrow">How to read the demo</div>
          <h2>Run a test to see the full authorization chain.</h2>
          <p>
            Choose a user, asset, demo mode, and signal scenario. The system will score live presence, apply the asset policy,
            issue a signed assertion, simulate downstream integrations, and write an audit record.
          </p>
        </div>
        <SectionLinks />
      </section>
    );
  }

  const identityText =
    identityMode === "ecg_identity_live_presence"
      ? `The current ECG was compared to ${userLabel}'s enrolled ECG template and returned ${attempt.features.ecg_identity_status} at ${Math.round(attempt.features.ecg_identity_score * 100)}%.`
      : "Identity is assumed to come from an external credential; ECG/PPG is used only to prove live presence for this event.";

  const ppgText =
    attempt.features.ecg_ppg_coupling_status === "valid"
      ? `The ECG heartbeat events aligned with later pulse events, with an average delay of ${Math.round((attempt.features.ptt_mean_seconds ?? 0) * 1000)} ms.`
      : attempt.features.ecg_ppg_coupling_status === "ppg_missing"
        ? "No PPG / pulse signal was available, so the policy treated this as a reduced-assurance attempt."
        : "The ECG-to-pulse timing was not plausible, so the live-body timing relationship failed.";

  return (
    <section className={`narrativeCard ${attempt.decision}`}>
      <div>
        <div className="eyebrow">Decision narrative</div>
        <h2>
          {prettyDecision(attempt.decision)} for {assetLabel}
        </h2>
        <p>
          The test ran <strong>{scenarioLabel}</strong> in <strong>{modeLabel}</strong> mode for <strong>{userLabel}</strong>.
          The policy for this <strong>{assetType}</strong> returned <strong>{prettyDecision(attempt.decision).toLowerCase()}</strong>{" "}
          with {Math.round(attempt.confidence * 100)}% live-presence confidence.
        </p>
      </div>

      <ol className="narrativeSteps">
        <li>
          <a href="#signal-evidence">Signal evidence</a>
          <span>{identityText}</span>
        </li>
        <li>
          <a href="#signal-evidence">ECG-to-PPG timing</a>
          <span>{ppgText}</span>
        </li>
        <li>
          <a href="#policy-reasons">Policy reasons</a>
          <span>{humanizeReasons(attempt.reason_codes)}</span>
        </li>
        <li>
          <a href="#assertion-view">Signed assertion</a>
          <span>A short-lived token was generated and bound to this user, asset, policy result, and expiration time.</span>
        </li>
        <li>
          <a href="#integration-output">Integration outputs</a>
          <span>The same result was translated into REST, Wiegand-style, OSDP-style, relay, zero-trust, and offline adapter outputs.</span>
        </li>
        <li>
          <a href="#audit-log">Audit trail</a>
          <span>The event was added to a tamper-evident hash chain without storing raw ECG or PPG by default.</span>
        </li>
      </ol>
      <SectionLinks />
    </section>
  );
}

function SectionLinks() {
  return (
    <nav className="sectionLinks" aria-label="Dashboard sections">
      <a href="#decision-summary">Result</a>
      <a href="#signal-evidence">Signals</a>
      <a href="#policy-reasons">Reasons</a>
      <a href="#assertion-view">Assertion</a>
      <a href="#integration-output">Adapters</a>
      <a href="#audit-log">Audit</a>
    </nav>
  );
}

function humanizeReasons(reasons: string[]) {
  if (reasons.includes("policy_allow")) return "All required checks passed for this asset policy.";
  if (reasons.includes("replay_pattern_detected")) return "The signal looked replayed, so the policy produced a hard deny.";
  if (reasons.includes("synthetic_signal_risk")) return "The signal looked synthetic or injected, so the policy produced a hard deny.";
  if (reasons.includes("ecg_ppg_timing_invalid")) return "The ECG and pulse timing did not match a live-body pattern.";
  if (reasons.includes("ecg_identity_mismatch")) return "The ECG identity score did not match the claimed user.";
  if (reasons.includes("ppg_required_missing")) return "This asset requires a pulse signal, but PPG was missing.";
  if (reasons.includes("covert_duress_flag")) return "The event was limited and silently flagged for covert duress review.";
  if (reasons.includes("live_presence_below_threshold")) return "The live-presence confidence was below the asset threshold.";
  return reasons.map((reason) => reason.replaceAll("_", " ")).join(", ");
}

function prettyDecision(decision: string) {
  return decision
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function CheckList({
  scenario,
  identityMode,
  selectedAsset,
}: {
  scenario: Scenario;
  identityMode: IdentityMode;
  selectedAsset?: Asset;
}) {
  const modeChecks =
    identityMode === "ecg_identity_live_presence"
      ? [
          "Compare the current ECG features to the selected user's enrolled ECG template.",
          "Use the ECG match score as an identity signal before issuing access.",
        ]
      : [
          "Assume identity was already checked by badge, PIN, CAC/PIV, face, or another credential.",
          "Use ECG/PPG only to decide whether the person is live and present now.",
        ];
  const bloodFlowChecks = scenario === "live_ecg"
    ? ["No pulse / blood-flow signal is available in this scenario, so the system lowers assurance."]
    : ppgChecks;
  const assetCheck = selectedAsset
    ? `If this check fails, the ${selectedAsset.asset_type.replaceAll("_", " ")} uses its configured fail-secure response.`
    : "If this check fails, the selected asset uses its configured fail-secure response.";

  return (
    <div className="checkList">
      <CheckGroup title="Scenario-Specific" tone="hot" checks={scenarioChecks[scenario]} />
      <CheckGroup title="Demo Mode" checks={modeChecks} />
      <CheckGroup title="Blood-Flow / PPG Path" checks={bloodFlowChecks} />
      <CheckGroup title="Asset Policy" checks={[assetCheck]} />
      <CheckGroup title="Common Security Pipeline" checks={baseChecks} compact />
    </div>
  );
}

function CheckGroup({ title, checks, compact, tone }: { title: string; checks: string[]; compact?: boolean; tone?: "hot" }) {
  return (
    <div className={`checkGroup ${tone ?? ""}`}>
      <div className="checkGroupTitle">{title}</div>
      {checks.map((check, index) => (
        <div className={`checkItem ${compact ? "compact" : ""}`} key={`${title}-${check}-${index}`}>
          <span>{index + 1}</span>
          <p>{check}</p>
        </div>
      ))}
    </div>
  );
}

"use client";

export function AssertionViewer({ assertion, payload }: { assertion?: string; payload?: Record<string, any> }) {
  if (!assertion || !payload) {
    return <div className="emptyBlock">Run an access attempt to inspect the signed assertion.</div>;
  }
  return (
    <div className="assertionGrid">
      <div>
        <div className="smallLabel">Signed JWT</div>
        <pre className="tokenBox">{assertion}</pre>
      </div>
      <div>
        <div className="smallLabel">Decoded Payload</div>
        <pre>{JSON.stringify(payload, null, 2)}</pre>
      </div>
    </div>
  );
}


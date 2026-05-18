"use client";

export function AuditLogViewer({ audit }: { audit: any }) {
  if (!audit) return <div className="emptyBlock">Audit log has not been loaded.</div>;
  return (
    <div>
      <div className={audit.chain?.valid ? "chainGood" : "chainBad"}>
        Chain status: {audit.chain?.valid ? "valid" : "invalid"} · Records checked: {audit.chain?.records_checked ?? 0}
      </div>
      <div className="auditList">
        {(audit.records ?? []).slice(0, 8).map((record: any) => (
          <div className="auditItem" key={record.sequence}>
            <div>
              <strong>#{record.sequence}</strong> {record.payload?.decision} · {record.payload?.asset_type}
            </div>
            <code>{record.record_hash}</code>
          </div>
        ))}
      </div>
    </div>
  );
}


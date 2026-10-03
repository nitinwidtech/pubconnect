import { useEffect, useState } from "react";
import api from "@/lib/api";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/Layout";
import { Card, EmptyState } from "@/components/ui-bits";
import { ScrollText, ShieldAlert, ShieldCheck } from "lucide-react";

const ACTION_TONE = {
  ACCESS_DENIED: "text-destructive bg-destructive/15",
  MANUAL_ADJUSTMENT: "text-[hsl(38_92%_55%)] bg-[hsl(32_95%_44%)]/15",
  REVERSAL: "text-[hsl(38_92%_55%)] bg-[hsl(32_95%_44%)]/15",
  REFUND: "text-[hsl(38_92%_55%)] bg-[hsl(32_95%_44%)]/15",
  CREATE: "text-emerald bg-emerald/15",
  CASH_DEPOSIT: "text-emerald bg-emerald/15",
};

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/audit-logs").then((r) => setLogs(r.data)).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader title="Audit Logs" subtitle="Immutable record of sensitive actions and admin changes" />
      <Card className="overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-muted-foreground">Loading…</div>
        ) : logs.length === 0 ? (
          <EmptyState title="No audit entries" icon={ScrollText} />
        ) : (
          <div className="divide-y divide-border">
            {logs.map((l) => {
              const tone = ACTION_TONE[l.action_type] || "text-muted-foreground bg-secondary";
              const denied = l.action_type === "ACCESS_DENIED";
              return (
                <div key={l.id} className="flex items-start gap-3 px-5 py-3.5" data-testid={`audit-row-${l.id}`}>
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${tone}`}>
                    {denied ? <ShieldAlert className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${tone}`}>{l.action_type}</span>
                      <span className="text-xs text-muted-foreground">{l.entity_type}</span>
                    </div>
                    <div className="text-sm mt-1">{l.description}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{l.actor_name} · {formatDate(l.created_at)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

import { TXN_META, formatPenceToGBP } from "@/lib/format";
import { Inbox } from "lucide-react";

export function Card({ className = "", children, ...rest }) {
  return (
    <div className={`bg-card border border-border rounded-xl ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function StatCard({ label, value, hint, icon: Icon, tone = "default", testid }) {
  const toneMap = {
    default: "text-foreground",
    positive: "text-emerald",
    negative: "text-crimson",
    brass: "text-primary",
  };
  return (
    <Card className="p-5" data-testid={testid}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
        {Icon && <Icon className="h-4 w-4 text-primary" />}
      </div>
      <div className={`font-heading font-bold text-2xl sm:text-3xl tracking-tight mono ${toneMap[tone]}`}>
        {value}
      </div>
      {hint && <div className="text-xs text-muted-foreground mt-1.5">{hint}</div>}
    </Card>
  );
}

export function TxnBadge({ type }) {
  const meta = TXN_META[type] || { label: type, tone: "default" };
  const cls = {
    positive: "bg-emerald/15 text-emerald",
    negative: "bg-crimson/15 text-crimson",
    warning: "bg-[hsl(32_95%_44%)]/15 text-[hsl(38_92%_55%)]",
    default: "bg-secondary text-muted-foreground",
  }[meta.tone];
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${cls}`}>
      {meta.label}
    </span>
  );
}

export function Money({ pence, signed = false, className = "" }) {
  const n = Number(pence || 0);
  const tone = n > 0 ? "text-emerald" : n < 0 ? "text-crimson" : "";
  const prefix = signed && n > 0 ? "+" : "";
  return (
    <span className={`mono font-semibold ${signed ? tone : ""} ${className}`}>
      {prefix}{formatPenceToGBP(pence)}
    </span>
  );
}

export function RoleBadge({ role }) {
  const cls = {
    OWNER: "bg-primary/15 text-primary",
    MANAGER: "bg-accent/30 text-[hsl(14_60%_62%)]",
    BAR_STAFF: "bg-secondary text-muted-foreground",
  }[role] || "bg-secondary text-muted-foreground";
  const label = { OWNER: "Owner", MANAGER: "Manager", BAR_STAFF: "Bar Staff" }[role] || role;
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${cls}`}>{label}</span>;
}

export function StatusPill({ active }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${active ? "bg-emerald/15 text-emerald" : "bg-secondary text-muted-foreground"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald" : "bg-muted-foreground"}`} />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export function EmptyState({ title, subtitle, icon: Icon = Inbox }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-12 w-12 rounded-xl bg-secondary flex items-center justify-center mb-3">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="font-medium">{title}</div>
      {subtitle && <div className="text-sm text-muted-foreground mt-1">{subtitle}</div>}
    </div>
  );
}

export function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="text-sm font-medium block mb-1.5">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground mt-1 block">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full h-11 px-3.5 rounded-lg bg-background border border-input text-sm outline-none focus:border-primary transition-colors";

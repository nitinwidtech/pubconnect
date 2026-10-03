import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { apiError } from "@/lib/api";
import { formatPenceToGBP, formatDate, parseGBPToPence } from "@/lib/format";
import { Card, Money, TxnBadge, EmptyState, Field, inputCls } from "@/components/ui-bits";
import { useAuth } from "@/context/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ArrowLeft, Wallet, Gift, Banknote, Loader2, Settings2, Zap } from "lucide-react";
import { toast } from "sonner";

export default function CustomerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [c, setC] = useState(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const { can } = useAuth();

  const load = useCallback(async () => {
    const { data } = await api.get(`/customers/${id}`);
    setC(data);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (!c) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div>
      <button data-testid="back-btn" onClick={() => navigate("/customers")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to customers
      </button>

      <div className="flex items-start justify-between gap-4 mb-7 flex-wrap">
        <div>
          <h1 className="font-heading font-bold text-2xl sm:text-3xl tracking-tight">{c.full_name}</h1>
          <p className="text-muted-foreground text-sm mt-1.5 mono">{c.customer_code} · {c.mobile_number}</p>
        </div>
        <div className="flex gap-2">
          <button data-testid="profile-service-btn" onClick={() => navigate(`/service?customer=${c.id}`)} className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-[hsl(39_80%_62%)] transition-colors">
            <Zap className="h-4 w-4" /> Deposit / Redeem
          </button>
          {can("manual_adjustment") && (
            <button data-testid="open-adjustment-btn" onClick={() => setAdjustOpen(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-border text-sm font-semibold hover:bg-secondary transition-colors">
              <Settings2 className="h-4 w-4" /> Manual Adjust
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <Card className="p-5" data-testid="profile-total-balance">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Total Balance</span>
            <Wallet className="h-4 w-4 text-primary" />
          </div>
          <div className="font-heading font-bold text-3xl mono text-primary">{formatPenceToGBP(c.balance.total_minor)}</div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Real Cash</span>
            <Banknote className="h-4 w-4 text-emerald" />
          </div>
          <div className="font-heading font-bold text-3xl mono text-emerald">{formatPenceToGBP(c.balance.cash_minor)}</div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Promo Credit</span>
            <Gift className="h-4 w-4 text-primary" />
          </div>
          <div className="font-heading font-bold text-3xl mono">{formatPenceToGBP(c.balance.promo_minor)}</div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-heading font-semibold text-lg">Transaction History</h2>
        </div>
        {c.transactions.length === 0 ? (
          <EmptyState title="No transactions yet" />
        ) : (
          <div className="divide-y divide-border">
            {c.transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-5 py-3.5" data-testid={`profile-txn-${t.id}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <TxnBadge type={t.transaction_type} />
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground mono">{t.reference_code}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(t.created_at)}{t.reason ? ` · ${t.reason}` : ""}</div>
                  </div>
                </div>
                <Money pence={t.balance_effect_minor} signed />
              </div>
            ))}
          </div>
        )}
      </Card>

      <AdjustmentDialog open={adjustOpen} setOpen={setAdjustOpen} customerId={c.id} onDone={load} />
    </div>
  );
}

function AdjustmentDialog({ open, setOpen, customerId, onDone }) {
  const [direction, setDirection] = useState("credit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [ack, setAck] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const pence = parseGBPToPence(amount) * (direction === "debit" ? -1 : 1);
    if (!pence) { toast.error("Enter a valid amount"); return; }
    if (!reason.trim()) { toast.error("Reason is required"); return; }
    if (!ack) { toast.error("Please confirm this exceptional action"); return; }
    setSaving(true);
    try {
      await api.post("/ledger/adjustment", { customer_id: customerId, amount_minor: pence, reason });
      toast.success("Manual adjustment recorded");
      setOpen(false); setAmount(""); setReason(""); setAck(false);
      onDone();
    } catch (e) {
      toast.error(apiError(e.response?.data?.detail));
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="bg-card border-border" data-testid="adjustment-dialog">
        <DialogHeader><DialogTitle className="font-heading flex items-center gap-2"><Settings2 className="h-5 w-5 text-[hsl(38_92%_55%)]" /> Manual Adjustment</DialogTitle></DialogHeader>
        <div className="bg-[hsl(32_95%_44%)]/10 border border-[hsl(32_95%_44%)]/30 rounded-lg px-3.5 py-2.5 text-xs text-[hsl(38_92%_55%)]">
          Exceptional action. This is logged to the audit trail and flagged in reports. Use only when no normal transaction applies.
        </div>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-2">
            <button data-testid="adjust-credit-btn" onClick={() => setDirection("credit")} className={`h-10 rounded-lg text-sm font-semibold transition-colors ${direction === "credit" ? "bg-emerald/20 text-emerald border border-emerald/40" : "border border-border text-muted-foreground"}`}>Credit (+)</button>
            <button data-testid="adjust-debit-btn" onClick={() => setDirection("debit")} className={`h-10 rounded-lg text-sm font-semibold transition-colors ${direction === "debit" ? "bg-crimson/20 text-crimson border border-crimson/40" : "border border-border text-muted-foreground"}`}>Debit (−)</button>
          </div>
          <Field label="Amount (£)">
            <input data-testid="adjust-amount-input" className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" inputMode="decimal" />
          </Field>
          <Field label="Reason (required)">
            <input data-testid="adjust-reason-input" className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain why this adjustment is needed" />
          </Field>
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input data-testid="adjust-ack-checkbox" type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="h-4 w-4 mt-0.5 accent-[hsl(39_77%_57%)]" />
            <span className="text-sm text-muted-foreground">I confirm this is an exceptional manual change that cannot be done via a normal deposit or redemption.</span>
          </label>
        </div>
        <DialogFooter>
          <button data-testid="submit-adjustment-btn" onClick={submit} disabled={saving} className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[hsl(39_80%_62%)] transition-colors disabled:opacity-60">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Record Adjustment
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

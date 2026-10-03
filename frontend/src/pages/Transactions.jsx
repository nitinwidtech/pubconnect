import { useEffect, useState, useCallback } from "react";
import api, { apiError } from "@/lib/api";
import { formatDate, TXN_META, parseGBPToPence } from "@/lib/format";
import { PageHeader } from "@/components/Layout";
import { Card, Money, TxnBadge, EmptyState, Field, inputCls } from "@/components/ui-bits";
import { useAuth } from "@/context/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ReceiptText, Undo2, RotateCcw, Loader2, Link2 } from "lucide-react";
import { toast } from "sonner";

const TYPES = ["CASH_DEPOSIT", "PROMOTIONAL_BONUS", "PURCHASE", "REFUND", "REVERSAL", "MANUAL_ADJUSTMENT"];

export default function Transactions() {
  const [txns, setTxns] = useState([]);
  const [type, setType] = useState("ALL");
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const { can } = useAuth();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (type !== "ALL") params.type = type;
      const { data } = await api.get("/transactions", { params });
      setTxns(data);
    } finally { setLoading(false); }
  }, [type]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (id) => {
    const { data } = await api.get(`/transactions/${id}`);
    setDetail(data);
  };

  return (
    <div>
      <PageHeader title="Transactions" subtitle="Append-only ledger · nothing is ever edited or deleted" />

      <div className="mb-5 flex gap-3 items-center">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger data-testid="txn-type-filter" className="w-56 bg-background border-input"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            {TYPES.map((t) => <SelectItem key={t} value={t}>{TXN_META[t].label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-muted-foreground">Loading…</div>
        ) : txns.length === 0 ? (
          <EmptyState title="No transactions" icon={ReceiptText} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground uppercase tracking-wide border-b border-border">
                  <th className="px-5 py-3 font-medium">Reference</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium text-right">Effect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {txns.map((t) => (
                  <tr key={t.id} data-testid={`txn-row-${t.id}`} onClick={() => openDetail(t.id)} className="cursor-pointer hover:bg-secondary/50 transition-colors">
                    <td className="px-5 py-3.5 mono text-xs text-muted-foreground">{t.reference_code}{t.related_transaction_id && <Link2 className="inline h-3 w-3 ml-1 text-primary" />}</td>
                    <td className="px-5 py-3.5"><TxnBadge type={t.transaction_type} /></td>
                    <td className="px-5 py-3.5 font-medium">{t.customer_name}</td>
                    <td className="px-5 py-3.5 text-muted-foreground text-xs">{formatDate(t.created_at)}</td>
                    <td className="px-5 py-3.5 text-right"><Money pence={t.balance_effect_minor} signed /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <TxnDetailDialog detail={detail} setDetail={setDetail} can={can} onAction={() => { load(); setDetail(null); }} />
    </div>
  );
}

function TxnDetailDialog({ detail, setDetail, can, onAction }) {
  const [refundOpen, setRefundOpen] = useState(false);
  const [reversalOpen, setReversalOpen] = useState(false);
  if (!detail) return null;

  const isPurchase = detail.transaction_type === "PURCHASE";
  const canReverse = !detail.linked_transactions?.some((l) => l.transaction_type === "REVERSAL") && detail.transaction_type !== "REVERSAL";

  return (
    <>
      <Dialog open={!!detail && !refundOpen && !reversalOpen} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="bg-card border-border" data-testid="txn-detail-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2"><TxnBadge type={detail.transaction_type} /></DialogTitle>
          </DialogHeader>
          <div className="space-y-2.5 py-2 text-sm">
            <Row label="Reference" value={<span className="mono">{detail.reference_code}</span>} />
            <Row label="Customer" value={detail.customer_name} />
            <Row label="Performed by" value={detail.performed_by_name} />
            <Row label="Date" value={formatDate(detail.created_at)} />
            <Row label="Amount" value={<span className="mono font-semibold">{(detail.amount_minor / 100).toFixed(2)} GBP</span>} />
            <Row label="Balance effect" value={<Money pence={detail.balance_effect_minor} signed />} />
            {detail.reason && <Row label="Reason" value={detail.reason} />}
            {detail.related_transaction && (
              <div className="p-3 rounded-lg bg-secondary/60 mt-2">
                <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5"><Link2 className="h-3 w-3" /> Linked to original</div>
                <div className="flex items-center justify-between">
                  <span className="mono text-xs">{detail.related_transaction.reference_code}</span>
                  <TxnBadge type={detail.related_transaction.transaction_type} />
                </div>
              </div>
            )}
            {detail.linked_transactions?.length > 0 && (
              <div className="p-3 rounded-lg bg-secondary/60 mt-2">
                <div className="text-xs text-muted-foreground mb-2">Linked entries</div>
                {detail.linked_transactions.map((l) => (
                  <div key={l.id} className="flex items-center justify-between py-1">
                    <span className="mono text-xs">{l.reference_code}</span>
                    <div className="flex items-center gap-2"><TxnBadge type={l.transaction_type} /><Money pence={l.balance_effect_minor} signed /></div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {(can("refund") || can("reversal")) && (
            <DialogFooter className="gap-2">
              {isPurchase && can("refund") && (
                <button data-testid="open-refund-btn" onClick={() => setRefundOpen(true)} className="flex-1 h-10 rounded-lg border border-border font-semibold text-sm flex items-center justify-center gap-2 hover:bg-secondary transition-colors"><Undo2 className="h-4 w-4" /> Refund</button>
              )}
              {canReverse && can("reversal") && (
                <button data-testid="open-reversal-btn" onClick={() => setReversalOpen(true)} className="flex-1 h-10 rounded-lg border border-[hsl(32_95%_44%)]/40 text-[hsl(38_92%_55%)] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[hsl(32_95%_44%)]/10 transition-colors"><RotateCcw className="h-4 w-4" /> Reverse</button>
              )}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <RefundDialog open={refundOpen} setOpen={setRefundOpen} original={detail} onDone={onAction} />
      <ReversalDialog open={reversalOpen} setOpen={setReversalOpen} original={detail} onDone={onAction} />
    </>
  );
}

function Row({ label, value }) {
  return <div className="flex justify-between gap-4"><span className="text-muted-foreground">{label}</span><span className="text-right">{value}</span></div>;
}

function RefundDialog({ open, setOpen, original, onDone }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    const pence = parseGBPToPence(amount);
    if (!pence) { toast.error("Enter a valid amount"); return; }
    if (!reason.trim()) { toast.error("Reason is required"); return; }
    setSaving(true);
    try {
      await api.post("/ledger/refund", { original_transaction_id: original.id, amount_minor: pence, reason });
      toast.success("Refund recorded"); setOpen(false); setAmount(""); setReason(""); onDone();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="bg-card border-border" data-testid="refund-dialog">
        <DialogHeader><DialogTitle className="font-heading">Refund Purchase</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">Against {original?.reference_code} · max {(original?.amount_minor / 100).toFixed(2)} GBP. Creates a linked REFUND entry.</p>
        <div className="space-y-4 py-2">
          <Field label="Refund amount (£)"><input data-testid="refund-amount-input" className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" /></Field>
          <Field label="Reason (required)"><input data-testid="refund-reason-input" className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this being refunded?" /></Field>
        </div>
        <DialogFooter>
          <button data-testid="submit-refund-btn" onClick={submit} disabled={saving} className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[hsl(39_80%_62%)] transition-colors disabled:opacity-60">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Process Refund</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReversalDialog({ open, setOpen, original, onDone }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!reason.trim()) { toast.error("Reason is required"); return; }
    setSaving(true);
    try {
      await api.post("/ledger/reversal", { transaction_id: original.id, reason });
      toast.success("Transaction reversed"); setOpen(false); setReason(""); onDone();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="bg-card border-border" data-testid="reversal-dialog">
        <DialogHeader><DialogTitle className="font-heading">Reverse Transaction</DialogTitle></DialogHeader>
        <div className="bg-[hsl(32_95%_44%)]/10 border border-[hsl(32_95%_44%)]/30 rounded-lg px-3.5 py-2.5 text-xs text-[hsl(38_92%_55%)]">This creates an opposite entry. The original {original?.reference_code} stays visible forever.</div>
        <div className="space-y-4 py-2">
          <Field label="Reason (required)"><input data-testid="reversal-reason-input" className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this being reversed?" /></Field>
        </div>
        <DialogFooter>
          <button data-testid="submit-reversal-btn" onClick={submit} disabled={saving} className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[hsl(39_80%_62%)] transition-colors disabled:opacity-60">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Confirm Reversal</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

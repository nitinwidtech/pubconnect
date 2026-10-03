import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import api, { apiError } from "@/lib/api";
import { formatPenceToGBP, parseGBPToPence } from "@/lib/format";
import { PageHeader } from "@/components/Layout";
import { Card, Money, inputCls } from "@/components/ui-bits";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Search, Banknote, HandCoins, Loader2, CheckCircle2, Wallet, Gift, User } from "lucide-react";
import { toast } from "sonner";

export default function ServiceWorkflow() {
  const [params] = useSearchParams();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [offers, setOffers] = useState([]);
  const [mode, setMode] = useState("deposit"); // deposit | redeem
  const [amount, setAmount] = useState("");
  const [offerId, setOfferId] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(null);

  const loadCustomer = useCallback(async (id) => {
    const { data } = await api.get(`/customers/${id}`);
    setSelected(data);
    setResults([]);
    setSearch("");
  }, []);

  useEffect(() => {
    api.get("/offers").then((r) => setOffers(r.data.filter((o) => o.is_active))).catch(() => {});
    const cid = params.get("customer");
    if (cid) loadCustomer(cid);
  }, [params, loadCustomer]);

  useEffect(() => {
    if (!search || selected) { setResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await api.get("/customers", { params: { search } });
      setResults(data);
    }, 250);
    return () => clearTimeout(t);
  }, [search, selected]);

  const matchingOffer = offers.find((o) => o.deposit_amount === parseGBPToPence(amount) && o.id === offerId);
  const autoOffers = offers.filter((o) => o.deposit_amount === parseGBPToPence(amount));

  const pence = parseGBPToPence(amount);

  const doSubmit = async () => {
    setSaving(true);
    try {
      if (mode === "deposit") {
        const body = { customer_id: selected.id, amount_minor: pence };
        if (offerId) body.offer_id = offerId;
        const { data } = await api.post("/ledger/deposit", body);
        setSuccess({ type: "Deposit", amount: pence, bonus: data.bonus_transaction?.amount_minor || 0, balance: data.balance.total_minor });
      } else {
        const { data } = await api.post("/ledger/redeem", { customer_id: selected.id, amount_minor: pence });
        setSuccess({ type: "Redemption", amount: pence, bonus: 0, balance: data.balance.total_minor });
      }
      toast.success(`${mode === "deposit" ? "Deposit" : "Redemption"} recorded`);
      setConfirmOpen(false);
      setAmount(""); setOfferId("");
      await loadCustomer(selected.id);
    } catch (e) {
      toast.error(apiError(e.response?.data?.detail));
    } finally { setSaving(false); }
  };

  const reset = () => { setSelected(null); setSuccess(null); setAmount(""); setOfferId(""); };

  return (
    <div>
      <PageHeader title="Fast Service" subtitle="Rapid deposit & redemption at the bar" />

      {!selected ? (
        <Card className="p-6 max-w-xl">
          <div className="text-sm font-medium mb-3">Step 1 · Find customer</div>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input autoFocus data-testid="service-search-input" className={`${inputCls} pl-10`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Phone number or name…" />
          </div>
          <div className="mt-3 divide-y divide-border">
            {results.map((c) => (
              <button key={c.id} data-testid={`service-result-${c.id}`} onClick={() => loadCustomer(c.id)} className="w-full flex items-center justify-between px-3 py-3 hover:bg-secondary rounded-lg transition-colors text-left">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-accent flex items-center justify-center"><User className="h-4 w-4 text-accent-foreground" /></div>
                  <div>
                    <div className="text-sm font-medium">{c.full_name}</div>
                    <div className="text-xs text-muted-foreground mono">{c.mobile_number}</div>
                  </div>
                </div>
                <Money pence={c.balance.total_minor} />
              </button>
            ))}
          </div>
        </Card>
      ) : success ? (
        <Card className="p-8 max-w-xl text-center" data-testid="service-success">
          <div className="h-16 w-16 rounded-full bg-emerald/15 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-9 w-9 text-emerald" />
          </div>
          <h2 className="font-heading font-bold text-2xl">{success.type} Complete</h2>
          <p className="text-muted-foreground text-sm mt-1">{selected.full_name}</p>
          <div className="mono font-bold text-4xl my-5">{formatPenceToGBP(success.amount)}</div>
          {success.bonus > 0 && <div className="text-emerald text-sm mb-3">+ {formatPenceToGBP(success.bonus)} promo bonus applied</div>}
          <div className="text-sm text-muted-foreground">New balance: <span className="mono text-foreground font-semibold">{formatPenceToGBP(success.balance)}</span></div>
          <div className="flex gap-2 mt-6">
            <button data-testid="service-another-btn" onClick={() => setSuccess(null)} className="flex-1 h-11 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-[hsl(39_80%_62%)] transition-colors">New Transaction</button>
            <button data-testid="service-newcustomer-btn" onClick={reset} className="flex-1 h-11 rounded-lg border border-border font-semibold text-sm hover:bg-secondary transition-colors">Different Customer</button>
          </div>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-5 gap-5 max-w-4xl">
          <Card className="p-6 lg:col-span-2 h-fit" data-testid="service-balance-preview">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-heading font-semibold text-lg">{selected.full_name}</div>
                <div className="text-xs text-muted-foreground mono">{selected.mobile_number}</div>
              </div>
              <button data-testid="service-change-customer-btn" onClick={reset} className="text-xs text-muted-foreground hover:text-foreground">Change</button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10">
                <span className="text-sm flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" /> Total balance</span>
                <span className="mono font-bold text-primary text-lg">{formatPenceToGBP(selected.balance.total_minor)}</span>
              </div>
              <div className="flex items-center justify-between px-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-2"><Banknote className="h-4 w-4" /> Real cash</span>
                <span className="mono">{formatPenceToGBP(selected.balance.cash_minor)}</span>
              </div>
              <div className="flex items-center justify-between px-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-2"><Gift className="h-4 w-4" /> Promo credit</span>
                <span className="mono">{formatPenceToGBP(selected.balance.promo_minor)}</span>
              </div>
            </div>
          </Card>

          <Card className="p-6 lg:col-span-3">
            <div className="grid grid-cols-2 gap-2 mb-5">
              <button data-testid="mode-deposit-btn" onClick={() => setMode("deposit")} className={`h-12 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${mode === "deposit" ? "bg-emerald/20 text-emerald border border-emerald/40" : "border border-border text-muted-foreground"}`}>
                <Banknote className="h-4 w-4" /> Deposit
              </button>
              <button data-testid="mode-redeem-btn" onClick={() => setMode("redeem")} className={`h-12 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${mode === "redeem" ? "bg-crimson/20 text-crimson border border-crimson/40" : "border border-border text-muted-foreground"}`}>
                <HandCoins className="h-4 w-4" /> Redeem
              </button>
            </div>

            <label className="text-sm font-medium block mb-1.5">Amount (£)</label>
            <input autoFocus data-testid="service-amount-input" className={`${inputCls} h-14 text-xl mono`} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" inputMode="decimal" />

            <div className="grid grid-cols-4 gap-2 mt-3">
              {["5", "10", "20", "50"].map((v) => (
                <button key={v} data-testid={`quick-amount-${v}`} onClick={() => setAmount(v)} className="h-9 rounded-lg border border-border text-sm font-medium hover:bg-secondary hover:border-primary/40 transition-colors mono">£{v}</button>
              ))}
            </div>

            {mode === "deposit" && autoOffers.length > 0 && (
              <div className="mt-4">
                <label className="text-sm font-medium block mb-1.5">Apply offer</label>
                <div className="space-y-2">
                  {autoOffers.map((o) => (
                    <button key={o.id} data-testid={`service-offer-${o.id}`} onClick={() => setOfferId(offerId === o.id ? "" : o.id)} className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg border text-left text-sm transition-colors ${offerId === o.id ? "border-primary bg-primary/10" : "border-border hover:bg-secondary"}`}>
                      <span>{o.name}</span>
                      <span className="text-emerald mono font-semibold">+{formatPenceToGBP(o.bonus_value)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mode === "redeem" && pence > selected.balance.total_minor && pence > 0 && (
              <div className="mt-4 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">Exceeds available balance of {formatPenceToGBP(selected.balance.total_minor)}</div>
            )}

            <button
              data-testid="service-continue-btn"
              disabled={!pence}
              onClick={() => setConfirmOpen(true)}
              className="w-full h-12 mt-5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-[hsl(39_80%_62%)] transition-colors disabled:opacity-50"
            >
              Review {mode === "deposit" ? "Deposit" : "Redemption"}
            </button>
          </Card>
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="bg-card border-border" data-testid="service-confirm-dialog">
          <DialogHeader><DialogTitle className="font-heading">Confirm {mode === "deposit" ? "Deposit" : "Redemption"}</DialogTitle></DialogHeader>
          {selected && (
            <div className="py-2 space-y-3">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Customer</span><span className="font-medium">{selected.full_name}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Action</span><span className="font-medium">{mode === "deposit" ? "Cash Deposit" : "Wallet Redemption"}</span></div>
              {mode === "deposit" && offerId && (
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Offer bonus</span><span className="text-emerald mono">+{formatPenceToGBP(offers.find((o) => o.id === offerId)?.bonus_value || 0)}</span></div>
              )}
              <div className="flex justify-between items-center pt-3 border-t border-border">
                <span className="text-sm text-muted-foreground">Amount</span>
                <span className="mono font-bold text-2xl">{formatPenceToGBP(pence)}</span>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <button data-testid="service-cancel-btn" onClick={() => setConfirmOpen(false)} className="flex-1 h-11 rounded-lg border border-border font-semibold text-sm hover:bg-secondary transition-colors">Cancel</button>
            <button data-testid="service-confirm-btn" onClick={doSubmit} disabled={saving} className="flex-1 h-11 rounded-lg bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[hsl(39_80%_62%)] transition-colors disabled:opacity-60">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Confirm &amp; Save
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

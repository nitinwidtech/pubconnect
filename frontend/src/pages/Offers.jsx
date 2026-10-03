import { useEffect, useState, useCallback } from "react";
import api, { apiError } from "@/lib/api";
import { formatPenceToGBP, parseGBPToPence, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/Layout";
import { Card, StatusPill, EmptyState, Field, inputCls } from "@/components/ui-bits";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tag, Plus, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

export default function Offers() {
  const [offers, setOffers] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    const { data } = await api.get("/offers");
    setOffers(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (o) => {
    try { await api.patch(`/offers/${o.id}/toggle`); toast.success(`Offer ${o.is_active ? "deactivated" : "activated"}`); load(); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (o) => { setEditing(o); setOpen(true); };

  return (
    <div>
      <PageHeader
        title="Offers"
        subtitle="Deposit bonus promotions · offers are never deleted, only deactivated"
        action={<button data-testid="open-create-offer-btn" onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-[hsl(39_80%_62%)] transition-colors"><Plus className="h-4 w-4" /> New Offer</button>}
      />

      {offers.length === 0 ? (
        <Card><EmptyState title="No offers yet" subtitle="Create a deposit bonus offer" icon={Tag} /></Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {offers.map((o) => (
            <Card key={o.id} className="p-5 flex flex-col" data-testid={`offer-card-${o.id}`}>
              <div className="flex items-start justify-between gap-2 mb-3">
                <h3 className="font-heading font-semibold text-lg leading-tight">{o.name}</h3>
                <StatusPill active={o.is_active} />
              </div>
              <p className="text-sm text-muted-foreground mb-4 flex-1">{o.description}</p>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex-1 rounded-lg bg-secondary/60 px-3 py-2 text-center">
                  <div className="text-xs text-muted-foreground">Deposit</div>
                  <div className="mono font-semibold">{formatPenceToGBP(o.deposit_amount)}</div>
                </div>
                <div className="text-primary font-bold">→</div>
                <div className="flex-1 rounded-lg bg-emerald/10 px-3 py-2 text-center">
                  <div className="text-xs text-muted-foreground">Bonus</div>
                  <div className="mono font-semibold text-emerald">+{formatPenceToGBP(o.bonus_value)}</div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground space-y-1 mb-4">
                <div>Redeemed: <span className="mono text-foreground">{o.times_redeemed}{o.max_total_redemptions ? ` / ${o.max_total_redemptions}` : ""}</span></div>
                <div>Per customer: <span className="mono text-foreground">{o.max_uses_per_customer || "∞"}</span></div>
                {o.end_date && <div>Ends: {formatDate(o.end_date)}</div>}
              </div>
              <div className="flex gap-2 mt-auto">
                <button data-testid={`edit-offer-${o.id}`} onClick={() => openEdit(o)} className="flex-1 h-9 rounded-lg border border-border text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-secondary transition-colors"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                <button data-testid={`toggle-offer-${o.id}`} onClick={() => toggle(o)} className={`flex-1 h-9 rounded-lg text-sm font-semibold transition-colors ${o.is_active ? "border border-border text-muted-foreground hover:bg-secondary" : "bg-emerald/15 text-emerald hover:bg-emerald/25"}`}>{o.is_active ? "Deactivate" : "Activate"}</button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <OfferDialog open={open} setOpen={setOpen} editing={editing} onDone={load} />
    </div>
  );
}

function OfferDialog({ open, setOpen, editing, onDone }) {
  const empty = { name: "", description: "", deposit: "", bonus: "", max_uses_per_customer: "", max_total_redemptions: "", end_date: "" };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name,
        description: editing.description || "",
        deposit: (editing.deposit_amount / 100).toString(),
        bonus: (editing.bonus_value / 100).toString(),
        max_uses_per_customer: editing.max_uses_per_customer?.toString() || "",
        max_total_redemptions: editing.max_total_redemptions?.toString() || "",
        end_date: editing.end_date ? editing.end_date.slice(0, 10) : "",
      });
    } else setForm(empty);
  }, [editing, open]);

  const submit = async () => {
    if (!form.name || !form.deposit) { toast.error("Name and deposit amount are required"); return; }
    const body = {
      name: form.name,
      description: form.description,
      deposit_amount: parseGBPToPence(form.deposit),
      bonus_value: parseGBPToPence(form.bonus),
      max_uses_per_customer: form.max_uses_per_customer ? parseInt(form.max_uses_per_customer) : null,
      max_total_redemptions: form.max_total_redemptions ? parseInt(form.max_total_redemptions) : null,
      end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
      is_active: editing ? editing.is_active : true,
    };
    setSaving(true);
    try {
      if (editing) await api.patch(`/offers/${editing.id}`, body);
      else await api.post("/offers", body);
      toast.success(editing ? "Offer updated" : "Offer created");
      setOpen(false); onDone();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto" data-testid="offer-dialog">
        <DialogHeader><DialogTitle className="font-heading">{editing ? "Edit Offer" : "New Offer"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <Field label="Offer name"><input data-testid="offer-name-input" className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Deposit £50 Get £5 Free" /></Field>
          <Field label="Description"><input data-testid="offer-description-input" className={inputCls} value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Deposit amount (£)" hint="Must match deposit exactly"><input data-testid="offer-deposit-input" className={inputCls} value={form.deposit} onChange={(e) => set("deposit", e.target.value)} inputMode="decimal" placeholder="50.00" /></Field>
            <Field label="Bonus value (£)"><input data-testid="offer-bonus-input" className={inputCls} value={form.bonus} onChange={(e) => set("bonus", e.target.value)} inputMode="decimal" placeholder="5.00" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Max uses / customer"><input data-testid="offer-maxuses-input" className={inputCls} value={form.max_uses_per_customer} onChange={(e) => set("max_uses_per_customer", e.target.value)} inputMode="numeric" placeholder="∞" /></Field>
            <Field label="Max total redemptions"><input data-testid="offer-maxtotal-input" className={inputCls} value={form.max_total_redemptions} onChange={(e) => set("max_total_redemptions", e.target.value)} inputMode="numeric" placeholder="∞" /></Field>
          </div>
          <Field label="End date"><input data-testid="offer-enddate-input" type="date" className={inputCls} value={form.end_date} onChange={(e) => set("end_date", e.target.value)} /></Field>
        </div>
        <DialogFooter>
          <button data-testid="submit-offer-btn" onClick={submit} disabled={saving} className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[hsl(39_80%_62%)] transition-colors disabled:opacity-60">{saving && <Loader2 className="h-4 w-4 animate-spin" />} {editing ? "Save Changes" : "Create Offer"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

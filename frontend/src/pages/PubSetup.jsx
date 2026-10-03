import { useState } from "react";
import api, { apiError } from "@/lib/api";
import { PageHeader } from "@/components/Layout";
import { Card, Field, inputCls } from "@/components/ui-bits";
import { useAuth } from "@/context/AuthContext";
import { Loader2, Store } from "lucide-react";
import { toast } from "sonner";

export default function PubSetup() {
  const { pub, setPub } = useAuth();
  const [form, setForm] = useState({
    name: pub?.name || "",
    address: pub?.address || "",
    receipt_header: pub?.receipt_header || "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch("/pub", form);
      setPub(data);
      toast.success("Pub profile updated");
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <PageHeader title="Pub Setup" subtitle="Tenant configuration for your pilot pub" />
      <div className="grid lg:grid-cols-3 gap-5">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center"><Store className="h-5 w-5 text-primary" /></div>
            <div><div className="font-heading font-semibold text-lg">Pub Profile</div><div className="text-xs text-muted-foreground">Tenant ID: <span className="mono">{pub?.id}</span></div></div>
          </div>
          <div className="space-y-4">
            <Field label="Pub name"><input data-testid="pub-name-input" className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
            <Field label="Address"><input data-testid="pub-address-input" className={inputCls} value={form.address} onChange={(e) => set("address", e.target.value)} /></Field>
            <Field label="Receipt header"><input data-testid="pub-receipt-input" className={inputCls} value={form.receipt_header} onChange={(e) => set("receipt_header", e.target.value)} /></Field>
            <Field label="Currency" hint="Fixed to GBP in Phase 1"><input className={`${inputCls} opacity-60`} value="GBP (£)" disabled /></Field>
          </div>
          <button data-testid="save-pub-btn" onClick={save} disabled={saving} className="mt-6 h-11 px-6 rounded-lg bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[hsl(39_80%_62%)] transition-colors disabled:opacity-60">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Save Changes</button>
        </Card>

        <Card className="p-6 h-fit">
          <div className="font-heading font-semibold mb-3">Phase 1 Scope</div>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>✓ Append-only wallet ledger</li>
            <li>✓ Integer pence (GBP) accounting</li>
            <li>✓ Backend-enforced roles</li>
            <li>✓ Tenant isolation via pub_id</li>
            <li className="text-muted-foreground/60">✗ SMS / mobile apps</li>
            <li className="text-muted-foreground/60">✗ Payment gateway / POS</li>
            <li className="text-muted-foreground/60">✗ Gift vouchers / analytics</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

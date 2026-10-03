import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api, { apiError } from "@/lib/api";
import { formatPenceToGBP } from "@/lib/format";
import { PageHeader } from "@/components/Layout";
import { Card, Money, EmptyState, Field, inputCls } from "@/components/ui-bits";
import { useAuth } from "@/context/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Search, UserPlus, Loader2, Users } from "lucide-react";
import { toast } from "sonner";

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { can } = useAuth();
  const navigate = useNavigate();

  const load = useCallback(async (q = "") => {
    setLoading(true);
    try {
      const { data } = await api.get("/customers", { params: q ? { search: q } : {} });
      setCustomers(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setTimeout(() => load(search), 300);
    return () => clearTimeout(t);
  }, [search, load]);

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Search, create and manage customer wallets"
        action={
          can("customer_create") && (
            <button
              data-testid="open-create-customer-btn"
              onClick={() => setOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-[hsl(39_80%_62%)] transition-colors"
            >
              <UserPlus className="h-4 w-4" /> New Customer
            </button>
          )
        }
      />

      <div className="relative mb-5 max-w-md">
        <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          data-testid="customer-search-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone or code…"
          className={`${inputCls} pl-10`}
        />
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-muted-foreground">Loading…</div>
        ) : customers.length === 0 ? (
          <EmptyState title="No customers found" subtitle="Create a customer to get started" icon={Users} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground uppercase tracking-wide border-b border-border">
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Phone</th>
                  <th className="px-5 py-3 font-medium text-right">Balance</th>
                  <th className="px-5 py-3 font-medium text-right">Promo</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {customers.map((c) => (
                  <tr
                    key={c.id}
                    data-testid={`customer-row-${c.id}`}
                    onClick={() => navigate(`/customers/${c.id}`)}
                    className="cursor-pointer hover:bg-secondary/50 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-medium">{c.full_name}</div>
                      <div className="text-xs text-muted-foreground mono">{c.customer_code}</div>
                    </td>
                    <td className="px-5 py-3.5 mono text-muted-foreground">{c.mobile_number}</td>
                    <td className="px-5 py-3.5 text-right"><Money pence={c.balance.total_minor} /></td>
                    <td className="px-5 py-3.5 text-right text-muted-foreground mono">{formatPenceToGBP(c.balance.promo_minor)}</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-xs text-emerald">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald" /> {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CreateCustomerDialog open={open} setOpen={setOpen} onCreated={() => load(search)} />
    </div>
  );
}

function CreateCustomerDialog({ open, setOpen, onCreated }) {
  const [form, setForm] = useState({ full_name: "", mobile_number: "", email: "", marketing_consent: false });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.full_name || !form.mobile_number) {
      toast.error("Name and mobile number are required");
      return;
    }
    setSaving(true);
    try {
      await api.post("/customers", form);
      toast.success("Customer created");
      setOpen(false);
      setForm({ full_name: "", mobile_number: "", email: "", marketing_consent: false });
      onCreated();
    } catch (e) {
      toast.error(apiError(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="bg-card border-border" data-testid="create-customer-dialog">
        <DialogHeader><DialogTitle className="font-heading">New Customer</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <Field label="Full name">
            <input data-testid="customer-name-input" className={inputCls} value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
          </Field>
          <Field label="Mobile number" hint="Unique per pub">
            <input data-testid="customer-mobile-input" className={inputCls} value={form.mobile_number} onChange={(e) => set("mobile_number", e.target.value)} />
          </Field>
          <Field label="Email (optional)">
            <input data-testid="customer-email-input" className={inputCls} value={form.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input data-testid="customer-consent-checkbox" type="checkbox" checked={form.marketing_consent} onChange={(e) => set("marketing_consent", e.target.checked)} className="h-4 w-4 accent-[hsl(39_77%_57%)]" />
            <span className="text-sm">Marketing consent given</span>
          </label>
        </div>
        <DialogFooter>
          <button data-testid="submit-customer-btn" onClick={submit} disabled={saving} className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[hsl(39_80%_62%)] transition-colors disabled:opacity-60">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Create Customer
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

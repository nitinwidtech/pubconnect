import { useEffect, useState, useCallback } from "react";
import api, { apiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/Layout";
import { Card, RoleBadge, StatusPill, EmptyState, Field, inputCls } from "@/components/ui-bits";
import { useAuth } from "@/context/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { UserPlus, Loader2, UserCog } from "lucide-react";
import { toast } from "sonner";

export default function Staff() {
  const [staff, setStaff] = useState([]);
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  const load = useCallback(async () => {
    const { data } = await api.get("/staff");
    setStaff(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (s) => {
    try {
      await api.patch(`/staff/${s.id}`, { is_active: !s.is_active });
      toast.success(`${s.full_name} ${s.is_active ? "deactivated" : "activated"}`);
      load();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };

  const changeRole = async (s, role) => {
    try {
      await api.patch(`/staff/${s.id}`, { role });
      toast.success("Role updated");
      load();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };

  return (
    <div>
      <PageHeader
        title="Staff"
        subtitle="Manage team members and role-based access"
        action={
          <button data-testid="open-create-staff-btn" onClick={() => setOpen(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-[hsl(39_80%_62%)] transition-colors">
            <UserPlus className="h-4 w-4" /> Add Staff
          </button>
        }
      />

      <Card className="overflow-hidden">
        {staff.length === 0 ? (
          <EmptyState title="No staff yet" icon={UserCog} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground uppercase tracking-wide border-b border-border">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Actions logged</th>
                  <th className="px-5 py-3 font-medium text-right">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {staff.map((s) => {
                  const isSelf = s.id === user.id;
                  const lockOwner = s.role === "OWNER" && user.role !== "OWNER";
                  return (
                    <tr key={s.id} data-testid={`staff-row-${s.id}`}>
                      <td className="px-5 py-3.5 font-medium">{s.full_name}{isSelf && <span className="text-xs text-muted-foreground ml-1">(you)</span>}</td>
                      <td className="px-5 py-3.5 text-muted-foreground mono text-xs">{s.email}</td>
                      <td className="px-5 py-3.5">
                        {lockOwner ? <RoleBadge role={s.role} /> : (
                          <Select value={s.role} onValueChange={(v) => changeRole(s, v)}>
                            <SelectTrigger data-testid={`staff-role-select-${s.id}`} className="w-36 h-9 bg-background border-input"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {user.role === "OWNER" && <SelectItem value="OWNER">Owner</SelectItem>}
                              <SelectItem value="MANAGER">Manager</SelectItem>
                              <SelectItem value="BAR_STAFF">Bar Staff</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                      <td className="px-5 py-3.5"><StatusPill active={s.is_active} /></td>
                      <td className="px-5 py-3.5 text-right mono text-muted-foreground">{s.action_count}</td>
                      <td className="px-5 py-3.5 text-right">
                        {!isSelf && !lockOwner && (
                          <button data-testid={`staff-toggle-${s.id}`} onClick={() => toggleActive(s)} className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${s.is_active ? "text-destructive hover:bg-destructive/10" : "text-emerald hover:bg-emerald/10"}`}>
                            {s.is_active ? "Deactivate" : "Activate"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CreateStaffDialog open={open} setOpen={setOpen} canOwner={user.role === "OWNER"} onDone={load} />
    </div>
  );
}

function CreateStaffDialog({ open, setOpen, canOwner, onDone }) {
  const [form, setForm] = useState({ full_name: "", email: "", password: "", role: "BAR_STAFF" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = async () => {
    if (!form.full_name || !form.email || !form.password) { toast.error("All fields are required"); return; }
    setSaving(true);
    try {
      await api.post("/staff", form);
      toast.success("Staff member added");
      setOpen(false); setForm({ full_name: "", email: "", password: "", role: "BAR_STAFF" }); onDone();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="bg-card border-border" data-testid="create-staff-dialog">
        <DialogHeader><DialogTitle className="font-heading">Add Staff</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <Field label="Full name"><input data-testid="staff-name-input" className={inputCls} value={form.full_name} onChange={(e) => set("full_name", e.target.value)} /></Field>
          <Field label="Email"><input data-testid="staff-email-input" className={inputCls} value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Temporary password"><input data-testid="staff-password-input" className={inputCls} value={form.password} onChange={(e) => set("password", e.target.value)} /></Field>
          <Field label="Role">
            <Select value={form.role} onValueChange={(v) => set("role", v)}>
              <SelectTrigger data-testid="staff-role-input" className="bg-background border-input"><SelectValue /></SelectTrigger>
              <SelectContent>
                {canOwner && <SelectItem value="OWNER">Owner</SelectItem>}
                <SelectItem value="MANAGER">Manager</SelectItem>
                <SelectItem value="BAR_STAFF">Bar Staff</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <DialogFooter>
          <button data-testid="submit-staff-btn" onClick={submit} disabled={saving} className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[hsl(39_80%_62%)] transition-colors disabled:opacity-60">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Add Staff</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

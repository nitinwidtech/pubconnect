import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { formatPenceToGBP, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/Layout";
import { Card, StatCard, TxnBadge, Money, EmptyState } from "@/components/ui-bits";
import { Users, UserCheck, Banknote, HandCoins, Gift, Tag, Zap } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const navigate = useNavigate();
  const { user, pub } = useAuth();

  useEffect(() => {
    api.get("/dashboard").then((r) => setData(r.data)).catch(() => {});
  }, []);

  if (!data) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div>
      <PageHeader
        title={`Good day, ${user?.full_name?.split(" ")[0] || "there"}`}
        subtitle={`Real-time wallet overview for ${pub?.name?.trim() || "your pub"}`}
        action={
          <button
            data-testid="dashboard-fast-service-btn"
            onClick={() => navigate("/service")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-[hsl(39_80%_62%)] transition-colors"
          >
            <Zap className="h-4 w-4" /> Start Service
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
        <StatCard testid="stat-total-customers" label="Total Customers" value={data.total_customers} icon={Users} />
        <StatCard testid="stat-active-customers" label="Active Customers" value={data.active_customers} icon={UserCheck} />
        <StatCard testid="stat-active-offers" label="Active Offers" value={data.active_offers} icon={Tag} tone="brass" />
        <StatCard testid="stat-deposits" label="Wallet Deposits" value={formatPenceToGBP(data.total_deposits_minor)} icon={Banknote} tone="positive" />
        <StatCard testid="stat-redemptions" label="Redemptions" value={formatPenceToGBP(data.total_redemptions_minor)} icon={HandCoins} tone="negative" />
        <StatCard testid="stat-promo" label="Promo Issued" value={formatPenceToGBP(data.promo_issued_minor)} icon={Gift} tone="brass" />
      </div>

      <Card className="overflow-hidden" data-testid="recent-transactions-card">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-heading font-semibold text-lg">Recent Transactions</h2>
        </div>
        {data.recent_transactions.length === 0 ? (
          <EmptyState title="No transactions yet" subtitle="Deposits and redemptions will appear here" />
        ) : (
          <div className="divide-y divide-border">
            {data.recent_transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-5 py-3.5" data-testid={`recent-txn-${t.id}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <TxnBadge type={t.transaction_type} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{t.customer_name}</div>
                    <div className="text-xs text-muted-foreground mono">{t.reference_code} · {formatDate(t.created_at)}</div>
                  </div>
                </div>
                <Money pence={t.balance_effect_minor} signed />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

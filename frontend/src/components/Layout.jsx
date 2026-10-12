import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ROLE_LABEL } from "@/lib/format";
import {
  LayoutDashboard, Users, Zap, ReceiptText, UserCog, Tag,
  ScrollText, Store, LogOut, Beer,
} from "lucide-react";

// Extract a short town/city from a full address line (e.g. "14 Fleet Street, London EC4Y 1AA" -> "London").
function deriveLocality(address) {
  if (!address) return "";
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return "";
  const last = parts[parts.length - 1];
  // If the last segment looks like a "Town POSTCODE" (UK style), take the town portion.
  const townFromLast = last.replace(/\s+[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}.*$/i, "").trim();
  if (parts.length >= 2) {
    const candidate = parts[parts.length - 2];
    const candTown = candidate.replace(/\s+[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}.*$/i, "").trim();
    return townFromLast || candTown || candidate || address;
  }
  return townFromLast || last || address;
}

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, perm: "dashboard", end: true },
  { to: "/service", label: "Fast Service", icon: Zap, perm: "deposit" },
  { to: "/customers", label: "Customers", icon: Users, perm: "customer_view" },
  { to: "/transactions", label: "Transactions", icon: ReceiptText, perm: "view_transactions" },
  { to: "/offers", label: "Offers", icon: Tag, perm: "manage_offers" },
  { to: "/staff", label: "Staff", icon: UserCog, perm: "manage_staff" },
  { to: "/audit-logs", label: "Audit Logs", icon: ScrollText, perm: "view_audit" },
  { to: "/pub-setup", label: "Pub Setup", icon: Store, perm: "manage_pub" },
];

export function Layout({ children }) {
  const { user, pub, can, logout } = useAuth();
  const navigate = useNavigate();
  const items = NAV.filter((n) => can(n.perm));

  return (
    <div className="min-h-screen pub-surface flex">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-border bg-card/60 backdrop-blur-xl hidden md:flex flex-col fixed h-screen z-20">
        <div className="px-5 py-6 flex items-center gap-3 border-b border-border">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center brass-glow">
            <Beer className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-heading font-bold text-lg leading-none tracking-tight">PubConnect</div>
            <div className="text-xs text-muted-foreground mt-1">Wallet Admin</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {items.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              data-testid={`nav-${n.label.toLowerCase().replace(/\s+/g, "-")}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`
              }
            >
              <n.icon className="h-[18px] w-[18px]" />
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-border">
          <div className="px-3 py-2 rounded-lg bg-secondary/60 mb-2">
            <div className="text-xs text-muted-foreground">Active Pub</div>
            <div className="text-sm font-medium truncate">{pub?.name || "—"}</div>
          </div>
          <button
            data-testid="logout-btn"
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-[18px] w-[18px]" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 md:ml-64 min-w-0">
        <header className="h-16 border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-10 flex items-center justify-between px-5 md:px-8">
          <div className="flex items-center gap-3">
            {pub?.name && (
              <>
                <span data-testid="header-pub-name" className="text-sm text-muted-foreground hidden sm:inline">
                  {pub.name.trim()}{deriveLocality(pub.address) ? ` · ${deriveLocality(pub.address)}` : ""}
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald hidden sm:inline-block" />
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              data-testid="header-fast-service-btn"
              onClick={() => navigate("/service")}
              className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-[hsl(39_80%_62%)] transition-colors"
            >
              <Zap className="h-4 w-4" /> Fast Service
            </button>
            <div className="flex items-center gap-2.5 pl-2">
              <div className="h-9 w-9 rounded-full bg-accent flex items-center justify-center text-accent-foreground font-heading font-semibold text-sm">
                {(user?.full_name || "?").charAt(0)}
              </div>
              <div className="hidden sm:block leading-tight">
                <div className="text-sm font-medium">{user?.full_name}</div>
                <div className="text-xs text-primary font-medium">{ROLE_LABEL[user?.role]}</div>
              </div>
            </div>
          </div>
        </header>
        <main className="p-5 md:p-8 max-w-[1400px] mx-auto animate-fade-up">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-7">
      <div>
        <h1 className="font-heading font-bold text-2xl sm:text-3xl tracking-tight">{title}</h1>
        {subtitle && <p className="text-muted-foreground text-sm mt-1.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

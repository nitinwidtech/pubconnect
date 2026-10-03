import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiError } from "@/lib/api";
import { Beer, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("nitinwidtech@gmail.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back");
      window.location.href = "/";
    } catch (err) {
      setError(apiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  const fill = (e, p) => { setEmail(e); setPassword(p); };

  return (
    <div className="min-h-screen pub-surface flex items-center justify-center p-5">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center brass-glow mb-4">
            <Beer className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="font-heading font-bold text-3xl tracking-tight">PubConnect</h1>
          <p className="text-muted-foreground text-sm mt-1.5">Staff Portal · Wallet Administration</p>
        </div>

        <form onSubmit={submit} className="bg-card border border-border rounded-2xl p-7 space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">Email</label>
            <input
              data-testid="login-email-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full h-11 px-3.5 rounded-lg bg-background border border-input text-sm outline-none focus:border-primary transition-colors"
              placeholder="you@pub.com"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Password</label>
            <input
              data-testid="login-password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full h-11 px-3.5 rounded-lg bg-background border border-input text-sm outline-none focus:border-primary transition-colors"
              placeholder="••••••••"
            />
          </div>
          {error && (
            <div data-testid="login-error" className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <button
            data-testid="login-submit-btn"
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[hsl(39_80%_62%)] transition-colors disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Sign in
          </button>
        </form>

        <div className="mt-5 bg-card/50 border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground mb-2.5 font-medium">Demo accounts — tap to fill</div>
          <div className="space-y-1.5">
            {[
              ["Owner", "nitinwidtech@gmail.com", "PubConnect2026!"],
              ["Manager", "manager@crownanchor.demo", "Manager2026!"],
              ["Bar Staff", "barstaff@crownanchor.demo", "BarStaff2026!"],
            ].map(([role, e, p]) => (
              <button
                key={e}
                type="button"
                data-testid={`demo-fill-${role.toLowerCase().replace(/\s+/g, "-")}`}
                onClick={() => fill(e, p)}
                className="w-full flex items-center justify-between text-left px-3 py-2 rounded-lg hover:bg-secondary transition-colors text-sm"
              >
                <span className="font-medium text-primary">{role}</span>
                <span className="text-muted-foreground mono text-xs">{e}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

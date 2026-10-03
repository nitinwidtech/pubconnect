import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Layout } from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Customers from "@/pages/Customers";
import CustomerProfile from "@/pages/CustomerProfile";
import ServiceWorkflow from "@/pages/ServiceWorkflow";
import Transactions from "@/pages/Transactions";
import Staff from "@/pages/Staff";
import Offers from "@/pages/Offers";
import AuditLogs from "@/pages/AuditLogs";
import PubSetup from "@/pages/PubSetup";
import { Beer } from "lucide-react";

function Loading() {
  return (
    <div className="min-h-screen pub-surface flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 animate-pulse">
        <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
          <Beer className="h-6 w-6 text-primary-foreground" />
        </div>
        <span className="text-muted-foreground text-sm">Loading PubConnect…</span>
      </div>
    </div>
  );
}

function Protected({ children, perm }) {
  const { user, loading, can } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (perm && !can(perm)) return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

function Routed() {
  const { user, loading } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={loading ? <Loading /> : user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<Protected perm="dashboard"><Dashboard /></Protected>} />
      <Route path="/service" element={<Protected perm="deposit"><ServiceWorkflow /></Protected>} />
      <Route path="/customers" element={<Protected perm="customer_view"><Customers /></Protected>} />
      <Route path="/customers/:id" element={<Protected perm="customer_view"><CustomerProfile /></Protected>} />
      <Route path="/transactions" element={<Protected perm="view_transactions"><Transactions /></Protected>} />
      <Route path="/offers" element={<Protected perm="manage_offers"><Offers /></Protected>} />
      <Route path="/staff" element={<Protected perm="manage_staff"><Staff /></Protected>} />
      <Route path="/audit-logs" element={<Protected perm="view_audit"><AuditLogs /></Protected>} />
      <Route path="/pub-setup" element={<Protected perm="manage_pub"><PubSetup /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routed />
        <Toaster position="top-right" richColors />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

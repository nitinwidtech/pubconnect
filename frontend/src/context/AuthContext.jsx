import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [pub, setPub] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    const token = localStorage.getItem("pc_token");
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
      setPub(data.pub);
      setPermissions(data.permissions || []);
    } catch (e) {
      localStorage.removeItem("pc_token");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("pc_token", data.token);
    setUser(data.user);
    setPub(data.pub);
    setPermissions(data.permissions || []);
    return data;
  };

  const logout = () => {
    localStorage.removeItem("pc_token");
    setUser(null);
    setPub(null);
    setPermissions([]);
    window.location.href = "/login";
  };

  const can = (action) => permissions.includes(action);

  return (
    <AuthContext.Provider value={{ user, pub, setPub, permissions, loading, login, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

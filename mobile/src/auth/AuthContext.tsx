import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import * as SecureStore from "expo-secure-store";
import client, { setAuthToken } from "../api/client";

const TOKEN_KEY = "pc_customer_token";

type Customer = any;
type Pub = any;

type AuthState = {
  customer: Customer | null;
  pub: Pub | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  setCustomer: (c: Customer) => void;
};

export type RegisterPayload = {
  full_name: string;
  password: string;
  email?: string;
  mobile_number?: string;
  marketing_consent?: boolean;
};

const AuthContext = createContext<AuthState>({} as AuthState);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [pub, setPub] = useState<Pub | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!token) {
        setLoading(false);
        return;
      }
      setAuthToken(token);
      const { data } = await client.get("/customer/auth/me");
      setCustomer(data.customer);
      setPub(data.pub);
    } catch (e) {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      setAuthToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const persistSession = async (token: string, c: Customer, p: Pub) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    setAuthToken(token);
    setCustomer(c);
    setPub(p);
  };

  const login = async (identifier: string, password: string) => {
    const { data } = await client.post("/customer/auth/login", { identifier, password });
    await persistSession(data.token, data.customer, data.pub);
  };

  const register = async (payload: RegisterPayload) => {
    const { data } = await client.post("/customer/auth/register", payload);
    await persistSession(data.token, data.customer, data.pub);
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setAuthToken(null);
    setCustomer(null);
    setPub(null);
  };

  const refreshMe = async () => {
    const { data } = await client.get("/customer/auth/me");
    setCustomer(data.customer);
    setPub(data.pub);
  };

  return (
    <AuthContext.Provider
      value={{ customer, pub, loading, login, register, logout, refreshMe, setCustomer }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

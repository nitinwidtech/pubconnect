import axios from "axios";

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;
export const API_BASE = `${BACKEND}/api`;

const client = axios.create({ baseURL: API_BASE });

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

client.interceptors.request.use((config) => {
  if (authToken) {
    (config.headers as any) = config.headers || {};
    (config.headers as any).Authorization = `Bearer ${authToken}`;
  }
  return config;
});

export function apiError(err: any): string {
  const detail = err?.response?.data?.detail;
  if (detail == null) return err?.message || "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e: any) => e?.msg || JSON.stringify(e)).join(" ");
  if (detail?.msg) return detail.msg;
  return String(detail);
}

export default client;

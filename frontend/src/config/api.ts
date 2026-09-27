/**
 * Centralized API configuration for React and Frontend components.
 * Resolves API requests using import.meta.env.VITE_API_URL or import.meta.env.VITE_BACKEND_URL
 * with fallback to the configured production backend:
 * https://expensetracker2-0-jl02.onrender.com
 */

const DEFAULT_RENDER_BACKEND_URL = "https://expensetracker2-0-jl02.onrender.com";

export const getApiBaseUrl = (): string => {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname || "";

    // In local development or same-host preview (*.run.app, localhost, 127.0.0.1):
    // Always use relative URL ("") so requests go to the running Express backend
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".run.app")
    ) {
      return "";
    }

    // When deployed on an external frontend host (such as Vercel *.vercel.app):
    const metaEnv = ((import.meta as any).env) || {};
    const envUrl = metaEnv.VITE_API_URL || metaEnv.VITE_BACKEND_URL;
    if (envUrl && typeof envUrl === "string" && envUrl.trim() && envUrl !== "__VITE_API_URL__") {
      return envUrl.trim().replace(/\/+$/, "");
    }
    if ((window as any).VITE_API_URL) {
      return (window as any).VITE_API_URL.trim().replace(/\/+$/, "");
    }
    if ((window as any).__ENV__?.VITE_API_URL) {
      return (window as any).__ENV__.VITE_API_URL.trim().replace(/\/+$/, "");
    }
    if ((window as any).__ENV__?.VITE_BACKEND_URL) {
      return (window as any).__ENV__.VITE_BACKEND_URL.trim().replace(/\/+$/, "");
    }

    // Default for Vercel deployment if VITE_API_URL was not set
    if (hostname.endsWith(".vercel.app")) {
      return DEFAULT_RENDER_BACKEND_URL;
    }

    return "";
  }
  return "";
};

export const getApiUrl = (endpoint: string): string => {
  const baseUrl = getApiBaseUrl();
  if (!endpoint) return baseUrl;
  if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
    return endpoint;
  }
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return baseUrl ? `${baseUrl}${cleanEndpoint}` : cleanEndpoint;
};

export const getAuthToken = (): string => {
  if (typeof window !== "undefined") {
    if (typeof (window as any).getAuthToken === "function" && (window as any).getAuthToken !== getAuthToken) {
      return (window as any).getAuthToken();
    }
    try {
      return localStorage.getItem("expense_tracker_token") || "";
    } catch (e) {
      return "";
    }
  }
  return "";
};

export const setAuthToken = (token?: string | null): void => {
  if (typeof window !== "undefined") {
    try {
      if (token) {
        localStorage.setItem("expense_tracker_token", token);
      } else {
        localStorage.removeItem("expense_tracker_token");
      }
    } catch (e) {}
  }
};

export const clearAuthToken = (): void => {
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem("expense_tracker_token");
      localStorage.removeItem("expense_tracker_user");
    } catch (e) {}
  }
};

export const getAuthHeaders = (extraHeaders?: Record<string, string>): Record<string, string> => {
  const headers: Record<string, string> = { ...extraHeaders };
  const token = getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
};

// Expose globally so all vanilla scripts and HTML pages share the exact same backend URL
if (typeof window !== "undefined") {
  (window as any).API_URL = getApiBaseUrl();
  (window as any).BACKEND_URL = getApiBaseUrl();
  (window as any).getApiUrl = getApiUrl;
  (window as any).getAuthToken = getAuthToken;
  (window as any).setAuthToken = setAuthToken;
  (window as any).clearAuthToken = clearAuthToken;
  (window as any).getAuthHeaders = getAuthHeaders;
}


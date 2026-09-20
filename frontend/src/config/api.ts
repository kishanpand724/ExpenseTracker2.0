/**
 * Centralized API configuration for React and Frontend components.
 * Resolves API requests using import.meta.env.VITE_BACKEND_URL with fallback to Render backend:
 * https://expensetracker2-0-jl02.onrender.com
 */

const DEFAULT_RENDER_BACKEND_URL = "https://expensetracker2-0-jl02.onrender.com";

export const getApiBaseUrl = (): string => {
  const envUrl = (import.meta as any).env?.VITE_BACKEND_URL;
  if (envUrl && typeof envUrl === "string" && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, "");
  }
  if (typeof window !== "undefined") {
    if ((window as any).BACKEND_URL) {
      return (window as any).BACKEND_URL;
    }
  }
  return DEFAULT_RENDER_BACKEND_URL;
};

export const getApiUrl = (endpoint: string): string => {
  const baseUrl = getApiBaseUrl();
  if (!endpoint) return baseUrl;
  if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
    return endpoint;
  }
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${baseUrl}${cleanEndpoint}`;
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
  (window as any).BACKEND_URL = getApiBaseUrl();
  (window as any).getApiUrl = getApiUrl;
  (window as any).getAuthToken = getAuthToken;
  (window as any).setAuthToken = setAuthToken;
  (window as any).clearAuthToken = clearAuthToken;
  (window as any).getAuthHeaders = getAuthHeaders;
}


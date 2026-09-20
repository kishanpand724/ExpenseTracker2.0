/**
 * Centralized API configuration for React components.
 * Resolves API requests to the deployed Render backend (https://expensetracker2-0-jl02.onrender.com)
 * while preserving localhost development support.
 */

const DEFAULT_RENDER_BACKEND_URL = "https://expensetracker2-0-jl02.onrender.com";

export const getApiBaseUrl = (): string => {
  if (typeof window !== "undefined") {
    if ((window as any).BACKEND_URL !== undefined && (window as any).BACKEND_URL !== null) {
      return (window as any).BACKEND_URL;
    }
    const hostname = window.location.hostname || "";
    if (hostname.includes("vercel.app")) {
      return DEFAULT_RENDER_BACKEND_URL;
    }
    const isLocalhost =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".run.app") ||
      hostname.includes("ai.studio");
    if (isLocalhost) {
      return "";
    }
  }
  const envUrl = (import.meta as any).env?.VITE_BACKEND_URL;
  if (envUrl) {
    return envUrl.trim().replace(/\/+$/, "");
  }
  return DEFAULT_RENDER_BACKEND_URL;
};

export const getApiUrl = (endpoint: string): string => {
  if (typeof window !== "undefined" && typeof (window as any).getApiUrl === "function") {
    return (window as any).getApiUrl(endpoint);
  }
  if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
    return endpoint;
  }
  const baseUrl = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${baseUrl}${cleanEndpoint}`;
};

export const getAuthToken = (): string => {
  if (typeof window !== "undefined") {
    if (typeof (window as any).getAuthToken === "function") {
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

export const getAuthHeaders = (extraHeaders?: Record<string, string>): Record<string, string> => {
  const headers: Record<string, string> = { ...extraHeaders };
  const token = getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
};

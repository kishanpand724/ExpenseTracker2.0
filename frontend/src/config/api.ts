/**
 * Centralized API configuration for React components.
 * Resolves API requests to the backend (localhost or deployed Render backend).
 */

export const getApiBaseUrl = (): string => {
  if (typeof window !== "undefined" && (window as any).BACKEND_URL) {
    return (window as any).BACKEND_URL;
  }
  const envUrl = (import.meta as any).env?.VITE_BACKEND_URL;
  if (envUrl) {
    return envUrl.trim().replace(/\/+$/, "");
  }
  return "";
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

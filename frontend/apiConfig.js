/**
 * Centralized API & Backend Configuration for ExpenseTracker
 * Configured for production (Vercel frontend -> Render backend: https://expensetracker2-0-jl02.onrender.com)
 */
(function () {
  const DEFAULT_RENDER_BACKEND_URL = "https://expensetracker2-0-jl02.onrender.com";

  function determineBackendUrl() {
    if (typeof window === "undefined") return "";

    const hostname = window.location.hostname || "";

    // 1. Same-host preview or local development: always use relative URL ("")
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".run.app")
    ) {
      return "";
    }

    // 2. Explicit window or env overrides (for standalone frontend deployments)
    if (window.VITE_API_URL && typeof window.VITE_API_URL === "string" && window.VITE_API_URL.trim()) {
      return window.VITE_API_URL.trim().replace(/\/+$/, "");
    }
    if (window.__ENV__ && (window.__ENV__.VITE_API_URL || window.__ENV__.VITE_BACKEND_URL)) {
      const envVal = (window.__ENV__.VITE_API_URL || window.__ENV__.VITE_BACKEND_URL).trim().replace(/\/+$/, "");
      if (envVal) return envVal;
    }

    // 3. Custom meta tags (if non-empty and not default placeholder)
    const metaTag = document.querySelector('meta[name="api-url"]') || document.querySelector('meta[name="backend-url"]');
    if (metaTag && metaTag.content) {
      const val = metaTag.content.trim().replace(/\/+$/, "");
      if (val && val !== "__API_URL__" && val !== "__BACKEND_URL__" && val !== DEFAULT_RENDER_BACKEND_URL) {
        return val;
      }
    }

    // 4. If deployed on Vercel and no VITE_API_URL set, fallback to Render backend
    if (hostname.endsWith(".vercel.app")) {
      return DEFAULT_RENDER_BACKEND_URL;
    }

    // 5. Default: relative path ("")
    return "";
  }

  const backendUrl = determineBackendUrl();

  window.API_URL = backendUrl;
  window.BACKEND_URL = backendUrl;

  /**
   * Resolves an API endpoint with the backend URL prefix.
   * @param {string} endpoint - The relative endpoint path (e.g. "login", "view-transactions")
   * @returns {string} The full or relative URL
   */
  window.getApiUrl = function (endpoint) {
    const base = (window.API_URL || window.BACKEND_URL || "").trim().replace(/\/+$/, "");
    if (!endpoint) return base;
    if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
      return endpoint;
    }
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : "/" + endpoint;
    return base ? (base + cleanEndpoint) : cleanEndpoint;
  };

  /**
   * Retrieves the stored authentication token if present.
   */
  window.getAuthToken = function () {
    try {
      return localStorage.getItem("expense_tracker_token") || "";
    } catch (e) {
      return "";
    }
  };

  /**
   * Attaches the Authorization header if an auth token exists.
   */
  window.getAuthHeaders = function (extraHeaders) {
    const headers = Object.assign({}, extraHeaders || {});
    const token = window.getAuthToken();
    if (token) {
      headers["Authorization"] = "Bearer " + token;
    }
    return headers;
  };

  /**
   * Stores the authentication token in localStorage.
   */
  window.setAuthToken = function (token) {
    try {
      if (token) {
        localStorage.setItem("expense_tracker_token", token);
      } else {
        localStorage.removeItem("expense_tracker_token");
      }
    } catch (e) {}
  };

  /**
   * Clears stored authentication data.
   */
  window.clearAuthToken = function () {
    try {
      localStorage.removeItem("expense_tracker_token");
      localStorage.removeItem("expense_tracker_user");
    } catch (e) {}
  };
})();

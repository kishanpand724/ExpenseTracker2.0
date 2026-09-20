/**
 * Centralized API & Backend Configuration for ExpenseTracker
 * Configured for production (Vercel frontend -> Render backend: https://expensetracker2-0-jl02.onrender.com)
 */
(function () {
  const RENDER_BACKEND_URL = "https://expensetracker2-0-jl02.onrender.com";
  let backendUrl = RENDER_BACKEND_URL;

  if (typeof window !== "undefined") {
    // 1. Check window-level override or Vite config (import.meta.env.VITE_BACKEND_URL)
    if (window.BACKEND_URL) {
      backendUrl = window.BACKEND_URL;
    } else if (window.BACKEND_API_URL) {
      backendUrl = window.BACKEND_API_URL;
    }
    // 2. Check injected environment object
    else if (window.__ENV__ && window.__ENV__.VITE_BACKEND_URL) {
      backendUrl = window.__ENV__.VITE_BACKEND_URL.trim().replace(/\/+$/, "");
    }
    // 3. Check meta tag in HTML <meta name="backend-url" content="...">
    else if (document.querySelector('meta[name="backend-url"]')) {
      const metaTag = document.querySelector('meta[name="backend-url"]');
      const content = metaTag.content ? metaTag.content.trim().replace(/\/+$/, "") : "";
      if (content && content !== "__BACKEND_URL__") {
        backendUrl = content;
      }
    } else {
      backendUrl = RENDER_BACKEND_URL;
    }
  }

  // Ensure ALL API requests use the Render backend URL
  window.BACKEND_URL = backendUrl || RENDER_BACKEND_URL;

  /**
   * Resolves an API endpoint with the Render backend URL prefix.
   * @param {string} endpoint - The relative endpoint path (e.g. "login", "view-transactions")
   * @returns {string} The full URL
   */
  window.getApiUrl = function (endpoint) {
    const base = (window.BACKEND_URL || RENDER_BACKEND_URL).trim().replace(/\/+$/, "");
    if (!endpoint) return base;
    if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
      return endpoint;
    }
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : "/" + endpoint;
    return base + cleanEndpoint;
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

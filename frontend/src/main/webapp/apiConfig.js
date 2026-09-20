/**
 * Centralized API & Backend Configuration for ExpenseTracker
 * Configured for production (Vercel frontend -> Render backend: https://expensetracker2-0-jl02.onrender.com)
 * while preserving localhost development support.
 */
(function () {
  const RENDER_BACKEND_URL = "https://expensetracker2-0-jl02.onrender.com";
  let backendUrl = RENDER_BACKEND_URL;

  if (typeof window !== "undefined") {
    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    // 1. Check window-level override
    if (window.BACKEND_API_URL) {
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
    }

    // Preserve localhost support: if running on localhost and no explicit remote backend flag is provided,
    // use local backend (relative URL)
    if (isLocalhost && !window.BACKEND_API_URL && !window.FORCE_REMOTE_BACKEND) {
      backendUrl = "";
    }
  }

  window.BACKEND_URL = backendUrl;

  /**
   * Resolves an API endpoint with the appropriate backend URL prefix.
   * @param {string} endpoint - The relative endpoint path (e.g. "login", "view-transactions")
   * @returns {string} The full URL or relative path
   */
  window.getApiUrl = function (endpoint) {
    if (!endpoint) return window.BACKEND_URL || "";
    if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
      return endpoint;
    }
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : "/" + endpoint;
    return (window.BACKEND_URL ? window.BACKEND_URL : "") + cleanEndpoint;
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

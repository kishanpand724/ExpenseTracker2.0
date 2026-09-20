/**
 * Centralized API & Backend Configuration for ExpenseTracker
 * Configured to use the Render backend: https://expensetracker2-0-jl02.onrender.com
 */
(function () {
  const RENDER_BACKEND_URL = "https://expensetracker2-0-jl02.onrender.com";
  let backendUrl = RENDER_BACKEND_URL;

  if (typeof window !== "undefined") {
    // 1. Check window-level override
    if (window.BACKEND_API_URL) {
      backendUrl = window.BACKEND_API_URL;
    } else {
      // 2. Check meta tag in HTML <meta name="backend-url" content="...">
      const metaTag = document.querySelector('meta[name="backend-url"]');
      if (metaTag && metaTag.content && metaTag.content !== "__BACKEND_URL__") {
        backendUrl = metaTag.content.trim().replace(/\/+$/, "");
      }
      // 3. Check injected environment object
      else if (window.__ENV__ && window.__ENV__.VITE_BACKEND_URL) {
        backendUrl = window.__ENV__.VITE_BACKEND_URL.trim().replace(/\/+$/, "");
      }
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
})();

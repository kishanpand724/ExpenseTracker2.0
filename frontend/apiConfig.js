/**
 * Centralized API & Backend Configuration for ExpenseTracker
 * Automatically adapts between:
 * - Local Development: uses localhost backend (e.g., http://localhost:3000)
 * - Production: uses deployed Render backend (configured via meta tag or VITE_BACKEND_URL)
 * - Same-origin / Monolith: uses relative paths
 */
(function () {
  let backendUrl = "";

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

    // If still empty and running on external static host (e.g. Vercel without meta tag set yet)
    // and not running on localhost/127.0.0.1 or the preview container port 3000
    const origin = window.location.origin;
    const isLocalhost = origin.includes("localhost") || origin.includes("127.0.0.1");
    const isCloudPreview = origin.includes("run.app") || origin.includes(":3000");

    if (!backendUrl && !isLocalhost && !isCloudPreview) {
      // When deployed standalone on Vercel without custom backend URL,
      // you can configure window.BACKEND_API_URL or <meta name="backend-url" content="https://your-backend.onrender.com">
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

// Registers the service worker in production builds only.
// Dev (`npm run dev`) stays SW-free to avoid stale-cache confusion.
// To test the install flow locally: `npm run build && npm run preview`.
export function registerPWA() {
  if (!import.meta.env.PROD) return;
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* SW unsupported or blocked (e.g. insecure origin) - app still works */
    });
  });
}

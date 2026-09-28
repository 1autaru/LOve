// ==========================================================================
// NOI — Indicator offline (bază; coada de operațiuni vine în Faza 7/19)
// ==========================================================================

export function initOfflineBanner() {
  const banner = document.getElementById("offline-banner");
  if (!banner) return;

  function update() {
    banner.classList.toggle("visible", !navigator.onLine);
  }

  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
}

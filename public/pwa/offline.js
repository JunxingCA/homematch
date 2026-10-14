try {
  document.documentElement.dataset.theme =
    localStorage.getItem("homematch-theme") === "light" ? "light" : "dark";
} catch {
  /* Storage may be unavailable in private browsing. */
}
window.addEventListener("online", () => {
  document.getElementById("connection").textContent =
    "Connection detected. Open HomeMatch to reconnect securely.";
});
window.addEventListener("offline", () => {
  document.getElementById("connection").textContent =
    "Still offline. Reconnect, then open HomeMatch.";
});
// Never replay an OAuth code/recovery token or automatically reload an unsaved form.

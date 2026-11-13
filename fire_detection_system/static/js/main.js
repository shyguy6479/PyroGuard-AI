document.addEventListener("DOMContentLoaded", () => {
  const toggleBtn = document.getElementById("themeToggle");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      document.body.classList.toggle("dark");
    });
  }

  const alertBox = document.getElementById("liveAlertBox");
  if (alertBox) {
    setInterval(async () => {
      try {
        const res = await fetch("/api/status");
        const data = await res.json();
        alertBox.className = `status-banner ${data.status}`;
        if (data.status === "fire_emergency") {
          alertBox.textContent = `⚠ FIRE DETECTED! (${data.last_confidence}% confidence)`;
        } else if (data.status === "smoke_warning") {
          alertBox.textContent = `⚠ SMOKE DETECTED! (${data.last_confidence}% confidence)`;
        } else {
          alertBox.textContent = "System Active – No Fire Detected";
        }
      } catch (err) {
        console.error(err);
      }
    }, 1000);
  }
});

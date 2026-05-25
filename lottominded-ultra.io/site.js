const year = document.querySelector("#site-year");
if (year) year.textContent = String(new Date().getFullYear());

const viewButtons = Array.from(document.querySelectorAll("[data-view-mode]"));
const appStage = document.querySelector("#app-view");
const heroMotion = document.querySelector(".hero-motion");
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const viewStorageKey = "lottomindedUltra.viewMode";

function getStoredValue(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

function setStoredValue(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    // Static file previews can disable storage. The visible UI still updates.
  }
}

function setViewMode(mode, shouldScroll = false) {
  const nextMode = mode === "app" ? "app" : "site";
  document.body.classList.toggle("app-mode", nextMode === "app");
  viewButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.viewMode === nextMode));
  });
  setStoredValue(viewStorageKey, nextMode);

  if (!shouldScroll) return;
  if (nextMode === "app" && appStage) {
    appStage.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    document.querySelector("#top")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

const savedViewMode = getStoredValue(viewStorageKey) || "site";
setViewMode(savedViewMode);

viewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setViewMode(button.dataset.viewMode, true);
  });
});

document.querySelector('a[href="#app-view"]')?.addEventListener("click", () => {
  setViewMode("app", false);
});

document.querySelector('a[href="#top"]')?.addEventListener("click", () => {
  setViewMode("site", false);
});

function syncHeroMotionPreference() {
  if (!heroMotion) return;
  if (reducedMotionQuery.matches) {
    heroMotion.pause();
    return;
  }
  heroMotion.play().catch(() => {
    // Some static-file previews block autoplay until the user interacts.
  });
}

reducedMotionQuery.addEventListener?.("change", syncHeroMotionPreference);
syncHeroMotionPreference();

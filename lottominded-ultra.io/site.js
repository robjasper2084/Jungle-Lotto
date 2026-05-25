const year = document.querySelector("#site-year");
if (year) year.textContent = String(new Date().getFullYear());

const viewButtons = Array.from(document.querySelectorAll("[data-view-mode]"));
const mobileButtons = Array.from(document.querySelectorAll("[data-mobile-toggle]"));
const mobileSection = document.querySelector("#mobile");
const appStage = document.querySelector("#app-view");
const viewStorageKey = "lottomindedUltra.viewMode";
const mobileStorageKey = "lottomindedUltra.mobileMode";

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

function setButtonLabel(button, enabled) {
  const label = button.querySelector("strong") || button;
  if (!button.dataset.offLabel) {
    button.dataset.offLabel = label.textContent.trim();
  }
  label.textContent = enabled ? button.dataset.onLabel || "Mobile On" : button.dataset.offLabel;
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

function setMobileMode(enabled, shouldScroll = false) {
  document.body.classList.toggle("mobile-mode", enabled);
  mobileButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(enabled));
    setButtonLabel(button, enabled);
  });
  setStoredValue(mobileStorageKey, enabled ? "on" : "off");
  if (!enabled || !shouldScroll) return;

  if (document.body.classList.contains("app-mode") && appStage) {
    appStage.scrollIntoView({ behavior: "smooth", block: "start" });
  } else if (mobileSection) {
    mobileSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

const savedViewMode = getStoredValue(viewStorageKey) || "site";
const savedMobileMode = getStoredValue(mobileStorageKey) === "on";
setViewMode(savedViewMode);
setMobileMode(savedMobileMode);

viewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setViewMode(button.dataset.viewMode, true);
  });
});

mobileButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setMobileMode(!document.body.classList.contains("mobile-mode"), true);
  });
});

document.querySelector('a[href="#app-view"]')?.addEventListener("click", () => {
  setViewMode("app", false);
});

document.querySelector('a[href="#top"]')?.addEventListener("click", () => {
  setViewMode("site", false);
});

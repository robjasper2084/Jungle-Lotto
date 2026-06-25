(() => {
  const SETTINGS_KEY = "lottomind-vault-run-settings-v1";
  const isTouchDevice =
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    navigator.msMaxTouchPoints > 0 ||
    window.matchMedia?.("(any-pointer: coarse)").matches;

  if (!isTouchDevice) return;

  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") || {};
    saved.touch = true;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(saved));
  } catch {
    // Storage can be unavailable in private browsing; CSS fallbacks still apply.
  }

  const markTouch = () => {
    document.body?.classList.add("touch-forced");
    document.body?.classList.remove("touch-hidden");
  };

  const injectTouchCss = () => {
    if (document.getElementById("mobileTouchCss")) return;
    const style = document.createElement("style");
    style.id = "mobileTouchCss";
    style.textContent = `
      html, body {
        -webkit-user-select: none;
        -webkit-touch-callout: none;
        overscroll-behavior: none;
        touch-action: none;
      }
      .game-shell,
      #game,
      .touchbar,
      .touch-cluster button {
        touch-action: none;
        -webkit-tap-highlight-color: transparent;
      }
      .touchbar {
        --touch-size: clamp(52px, 7.5vw, 68px);
      }
      .touch-cluster {
        grid-template-columns: repeat(5, var(--touch-size)) !important;
      }
      .touch-cluster--move {
        grid-template-columns: repeat(4, var(--touch-size)) !important;
      }
      .touch-cluster button {
        width: var(--touch-size) !important;
        min-width: var(--touch-size) !important;
        height: var(--touch-size) !important;
        min-height: var(--touch-size) !important;
        user-select: none;
      }
      @media (max-width: 580px) {
        .touchbar {
          --touch-size: clamp(48px, 11.5vw, 54px);
        }
      }
    `;
    document.head.appendChild(style);
  };

  const preventGameGesture = (event) => {
    if (event.target?.closest?.(".game-shell")) event.preventDefault();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      markTouch();
      injectTouchCss();
    }, { once: true });
  } else {
    markTouch();
    injectTouchCss();
  }

  document.addEventListener("gesturestart", preventGameGesture, { passive: false });
  document.addEventListener("gesturechange", preventGameGesture, { passive: false });
  document.addEventListener("touchmove", preventGameGesture, { passive: false });
})();

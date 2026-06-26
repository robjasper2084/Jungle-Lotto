(() => {
  const SETTINGS_KEY = "lottomind-vault-run-settings-v1";
  const isTouchDevice =
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    navigator.msMaxTouchPoints > 0 ||
    window.matchMedia?.("(any-pointer: coarse)").matches;

  if (!isTouchDevice) return;

  const setTouchPreference = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") || {};
      saved.touch = true;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(saved));
    } catch {
      // Storage can be unavailable in private browsing; CSS fallbacks still apply.
    }
  };

  const updateOrientation = () => {
    const portrait = window.innerHeight >= window.innerWidth;
    document.body?.classList.toggle("touch-portrait", portrait);
    document.body?.classList.toggle("touch-landscape", !portrait);
  };

  const markTouch = () => {
    document.body?.classList.add("touch-forced");
    document.body?.classList.remove("touch-hidden");
    updateOrientation();
  };

  const injectTouchCss = () => {
    if (document.getElementById("mobileTouchCss")) return;
    const style = document.createElement("style");
    style.id = "mobileTouchCss";
    style.textContent = `
      html, body {
        width: 100%;
        min-height: 100%;
        overflow: hidden;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
        overscroll-behavior: none;
        touch-action: none;
      }
      body.touch-forced .game-shell {
        width: 100vw;
        height: 100vh;
        height: 100dvh;
        padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
        box-sizing: border-box;
      }
      body.touch-forced #game {
        width: min(100vw, 177.78dvh) !important;
        height: min(56.25vw, 100dvh) !important;
        max-width: 100vw !important;
        max-height: 100dvh !important;
      }
      .game-shell,
      #game,
      .touchbar,
      .touch-cluster button {
        touch-action: none;
        -webkit-tap-highlight-color: transparent;
      }
      body.touch-forced .touchbar {
        --touch-size: clamp(56px, 8vw, 74px);
        inset: auto max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left)) !important;
        gap: clamp(8px, 2vw, 16px);
        align-items: end;
        justify-content: space-between;
      }
      body.touch-forced .touch-cluster {
        grid-template-columns: repeat(5, var(--touch-size)) !important;
        gap: clamp(6px, 1.2vw, 10px) !important;
      }
      body.touch-forced .touch-cluster--move {
        grid-template-columns: repeat(4, var(--touch-size)) !important;
      }
      body.touch-forced .touch-cluster button {
        width: var(--touch-size) !important;
        min-width: var(--touch-size) !important;
        height: var(--touch-size) !important;
        min-height: var(--touch-size) !important;
        border-width: 2px;
        font-size: clamp(0.52rem, 1.55vw, 0.72rem) !important;
        user-select: none;
      }
      body.touch-forced .touch-cluster button:active,
      body.touch-forced .touch-cluster button.is-touching {
        transform: translateY(2px) scale(0.98);
        border-color: rgba(56, 219, 255, 0.95);
        color: #fff7cf;
        box-shadow:
          0 0 0 2px rgba(56, 219, 255, 0.18),
          0 0 24px rgba(255, 79, 154, 0.34),
          inset 0 0 0 1px rgba(255, 239, 180, 0.28);
      }
      body.touch-forced.touch-landscape.compact-play #game,
      body.touch-forced.touch-landscape #game {
        margin-top: 0 !important;
      }
      body.touch-forced.touch-portrait .game-shell {
        place-items: start center !important;
      }
      body.touch-forced.touch-portrait #game {
        width: 100vw !important;
        height: min(56.25vw, calc(100dvh - 172px)) !important;
        margin-top: clamp(118px, 15dvh, 168px) !important;
      }
      body.touch-forced.touch-portrait .touchbar {
        --touch-size: clamp(48px, 13vw, 62px);
        flex-wrap: wrap;
        row-gap: 8px;
        align-content: end;
      }
      body.touch-forced.touch-portrait .touch-cluster {
        grid-template-columns: repeat(5, var(--touch-size)) !important;
      }
      body.touch-forced.touch-portrait .touch-cluster--move {
        grid-template-columns: repeat(4, var(--touch-size)) !important;
      }
      body.touch-forced.touch-portrait .hud {
        transform: scale(0.94);
        transform-origin: top center;
      }
      body.touch-forced.touch-portrait .objective-chip {
        top: clamp(104px, 15dvh, 148px) !important;
      }
      @media (max-width: 580px) {
        body.touch-forced .touchbar {
          --touch-size: clamp(50px, 12vw, 58px);
        }
        body.touch-forced.touch-portrait .touchbar {
          --touch-size: clamp(44px, 12vw, 52px);
        }
      }
      @media (max-width: 380px) {
        body.touch-forced.touch-portrait .touchbar {
          --touch-size: clamp(40px, 11.5vw, 48px);
        }
        body.touch-forced.touch-portrait .touch-cluster {
          gap: 5px !important;
        }
      }
    `;
    document.head.appendChild(style);
  };

  const bindButtonFeedback = () => {
    document.querySelectorAll("[data-touch]").forEach((button) => {
      if (button.dataset.mobileTouchBound) return;
      button.dataset.mobileTouchBound = "true";

      const setActive = () => button.classList.add("is-touching");
      const clearActive = () => button.classList.remove("is-touching");

      button.addEventListener("pointerdown", setActive, { passive: true });
      button.addEventListener("pointerup", clearActive, { passive: true });
      button.addEventListener("pointercancel", clearActive, { passive: true });
      button.addEventListener("pointerleave", clearActive, { passive: true });
      button.addEventListener("lostpointercapture", clearActive, { passive: true });
    });
  };

  const preventGameGesture = (event) => {
    if (event.target?.closest?.(".game-shell")) event.preventDefault();
  };

  const boot = () => {
    setTouchPreference();
    markTouch();
    injectTouchCss();
    bindButtonFeedback();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  document.addEventListener("gesturestart", preventGameGesture, { passive: false });
  document.addEventListener("gesturechange", preventGameGesture, { passive: false });
  document.addEventListener("touchmove", preventGameGesture, { passive: false });
  window.addEventListener("resize", updateOrientation, { passive: true });
  window.addEventListener("orientationchange", () => setTimeout(updateOrientation, 80), { passive: true });
})();

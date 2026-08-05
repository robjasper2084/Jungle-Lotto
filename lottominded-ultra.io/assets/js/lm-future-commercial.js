(() => {
  "use strict";

  if (document.querySelector("[data-lm-future-commercial]")) return;

  const root = String(window.__LOTTOMIND_ROOT__ || "").replace(/\/$/, "");
  const assetBase = `${root}/lottominded-ultra.io/assets/merch`;
  const modal = document.createElement("aside");
  modal.className = "lm-future-commercial";
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  modal.setAttribute("data-lm-future-commercial", "");
  modal.innerHTML = `
    <div class="lm-future-commercial__panel" role="dialog" aria-modal="true" aria-labelledby="lmFutureCommercialTitle">
      <header class="lm-future-commercial__header">
        <div><span>LM App / Future membership uplink</span><h2 id="lmFutureCommercialTitle">Future Signal Online.</h2></div>
        <button class="lm-future-commercial__close" type="button" aria-label="Close future commercial">X</button>
      </header>
      <div class="lm-future-commercial__stage">
        <video controls playsinline preload="none" poster="${assetBase}/lottomind-future-membership-commercial-poster-20260626.webp">
          <source data-src="${assetBase}/lottomind-future-membership-commercial-20260626.opt.mp4" type="video/mp4" />
        </video>
      </div>
      <footer class="lm-future-commercial__footer">
        <p>A cinematic preview of the LottoMind membership signal.</p>
        <div class="lm-future-commercial__actions">
          <button class="lm-future-commercial__action" type="button" data-lm-future-replay>Replay</button>
          <button class="lm-future-commercial__action lm-future-commercial__action--primary" type="button" data-lm-future-enter>Enter LottoMind App</button>
        </div>
      </footer>
    </div>`;

  const panel = modal.querySelector("[role=dialog]");
  const video = modal.querySelector("video");
  const source = video.querySelector("source");
  const closeButton = modal.querySelector(".lm-future-commercial__close");
  const enterButton = modal.querySelector("[data-lm-future-enter]");
  const replayButton = modal.querySelector("[data-lm-future-replay]");
  let returnFocus = null;

  const ensureSource = () => {
    if (!source.hasAttribute("src")) {
      source.src = source.dataset.src;
      video.load();
    }
  };

  const close = () => {
    video.pause();
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.documentElement.style.removeProperty("overflow");
    returnFocus?.focus?.();
  };

  const play = async (restart = false) => {
    ensureSource();
    if (restart) video.currentTime = 0;
    video.muted = false;
    video.volume = 0.76;
    try {
      await video.play();
    } catch (_) {
      video.muted = true;
      video.defaultMuted = true;
      video.setAttribute("muted", "");
      await video.play().catch(() => {});
    }
  };

  const open = () => {
    returnFocus = document.activeElement;
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.documentElement.style.overflow = "hidden";
    closeButton.focus();
    void play(true);
  };

  closeButton.addEventListener("click", close);
  enterButton.addEventListener("click", close);
  replayButton.addEventListener("click", () => void play(true));
  video.addEventListener("ended", close);
  modal.addEventListener("click", (event) => { if (event.target === modal) close(); });
  modal.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
    if (event.key !== "Tab") return;
    const focusable = [...panel.querySelectorAll("button, video[controls]")].filter((node) => !node.hidden);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  document.body.append(modal);
  window.setTimeout(open, 450);
})();

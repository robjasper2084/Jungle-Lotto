(() => {
  "use strict";

  const body = document.body;
  const root = document.getElementById("lmMembership");
  const hero = document.getElementById("dust");
  if (!body?.classList.contains("memberships-page") || !root || !hero) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const cards = [
    ...root.querySelectorAll(".membership-plan-card, .membership-support-card--guardian"),
  ];

  body.classList.add("lm-membership-depth-ready");
  body.dataset.lmMembershipDepth = reducedMotion.matches || !finePointer.matches ? "static" : "interactive";
  cards.forEach((card) => card.classList.add("lm-membership-depth-card"));

  const resetCard = (card) => {
    card.style.setProperty("--lm-depth-rotate-x", "0deg");
    card.style.setProperty("--lm-depth-rotate-y", "0deg");
    card.style.setProperty("--lm-depth-glare-x", "50%");
    card.style.setProperty("--lm-depth-glare-y", "20%");
  };

  const syncMode = () => {
    const interactive = finePointer.matches && !reducedMotion.matches;
    body.dataset.lmMembershipDepth = interactive ? "interactive" : "static";
    if (!interactive) {
      cards.forEach(resetCard);
      hero.style.setProperty("--lm-hero-depth-x", "0deg");
      hero.style.setProperty("--lm-hero-depth-y", "0deg");
      hero.style.setProperty("--lm-hero-shift-x", "0px");
      hero.style.setProperty("--lm-hero-shift-y", "0px");
      hero.style.setProperty("--lm-hero-hud-depth-x", "0deg");
      hero.style.setProperty("--lm-hero-hud-depth-y", "0deg");
      hero.style.setProperty("--lm-hero-hud-shift-x", "0px");
      hero.style.setProperty("--lm-hero-hud-shift-y", "0px");
      hero.style.setProperty("--lm-hero-control-shift-x", "0px");
      hero.style.setProperty("--lm-hero-control-shift-y", "0px");
    }
  };

  const updateCardDepth = (card, event) => {
    if (body.dataset.lmMembershipDepth !== "interactive") return;
    const rect = card.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    card.style.setProperty("--lm-depth-rotate-x", `${((0.5 - y) * 9).toFixed(2)}deg`);
    card.style.setProperty("--lm-depth-rotate-y", `${((x - 0.5) * 11).toFixed(2)}deg`);
    card.style.setProperty("--lm-depth-glare-x", `${(x * 100).toFixed(1)}%`);
    card.style.setProperty("--lm-depth-glare-y", `${(y * 100).toFixed(1)}%`);
  };

  cards.forEach((card) => {
    card.addEventListener("pointermove", (event) => updateCardDepth(card, event), { passive: true });
    card.addEventListener("pointerleave", () => resetCard(card), { passive: true });
    card.addEventListener("focusin", () => card.classList.add("is-depth-focused"));
    card.addEventListener("focusout", (event) => {
      if (!card.contains(event.relatedTarget)) card.classList.remove("is-depth-focused");
    });
  });

  let heroFrame = 0;
  let heroPointerEvent = null;
  const renderHeroDepth = () => {
    heroFrame = 0;
    if (!heroPointerEvent || body.dataset.lmMembershipDepth !== "interactive") return;
    const rect = hero.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (heroPointerEvent.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (heroPointerEvent.clientY - rect.top) / rect.height));
    hero.style.setProperty("--lm-hero-depth-x", `${((0.5 - y) * 3.2).toFixed(2)}deg`);
    hero.style.setProperty("--lm-hero-depth-y", `${((x - 0.5) * 4.8).toFixed(2)}deg`);
    hero.style.setProperty("--lm-hero-shift-x", `${((x - 0.5) * 12).toFixed(1)}px`);
    hero.style.setProperty("--lm-hero-shift-y", `${((y - 0.5) * 8).toFixed(1)}px`);
    hero.style.setProperty("--lm-hero-hud-depth-x", `${((y - 0.5) * 1.15).toFixed(2)}deg`);
    hero.style.setProperty("--lm-hero-hud-depth-y", `${((0.5 - x) * 1.72).toFixed(2)}deg`);
    hero.style.setProperty("--lm-hero-hud-shift-x", `${((0.5 - x) * 5).toFixed(1)}px`);
    hero.style.setProperty("--lm-hero-hud-shift-y", `${((0.5 - y) * 3.4).toFixed(1)}px`);
    hero.style.setProperty("--lm-hero-control-shift-x", `${((0.5 - x) * 2.4).toFixed(1)}px`);
    hero.style.setProperty("--lm-hero-control-shift-y", `${((0.5 - y) * 1.6).toFixed(1)}px`);
  };

  hero.addEventListener("pointermove", (event) => {
    heroPointerEvent = event;
    if (!heroFrame) heroFrame = window.requestAnimationFrame(renderHeroDepth);
  }, { passive: true });

  hero.addEventListener("pointerleave", () => {
    heroPointerEvent = null;
    if (heroFrame) window.cancelAnimationFrame(heroFrame);
    heroFrame = 0;
    hero.style.setProperty("--lm-hero-depth-x", "0deg");
    hero.style.setProperty("--lm-hero-depth-y", "0deg");
    hero.style.setProperty("--lm-hero-shift-x", "0px");
    hero.style.setProperty("--lm-hero-shift-y", "0px");
    hero.style.setProperty("--lm-hero-hud-depth-x", "0deg");
    hero.style.setProperty("--lm-hero-hud-depth-y", "0deg");
    hero.style.setProperty("--lm-hero-hud-shift-x", "0px");
    hero.style.setProperty("--lm-hero-hud-shift-y", "0px");
    hero.style.setProperty("--lm-hero-control-shift-x", "0px");
    hero.style.setProperty("--lm-hero-control-shift-y", "0px");
  }, { passive: true });

  reducedMotion.addEventListener?.("change", syncMode);
  finePointer.addEventListener?.("change", syncMode);
  syncMode();
})();

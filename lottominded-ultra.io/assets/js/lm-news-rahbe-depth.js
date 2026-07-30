(() => {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const coarsePointer = window.matchMedia("(pointer: coarse)");
  if (reducedMotion.matches || coarsePointer.matches) return;

  let frame = 0;
  window.addEventListener("pointermove", (event) => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      const x = ((event.clientX / window.innerWidth) - 0.5) * -18;
      const y = ((event.clientY / window.innerHeight) - 0.5) * -12;
      document.documentElement.style.setProperty("--lm-news-depth-x", `${x.toFixed(2)}px`);
      document.documentElement.style.setProperty("--lm-news-depth-y", `${y.toFixed(2)}px`);
    });
  }, { passive: true });
})();

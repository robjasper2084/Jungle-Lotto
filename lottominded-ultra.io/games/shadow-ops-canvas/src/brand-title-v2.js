(() => {
  const BRAND = "ROBOT RAHBE";
  const BRAND_COOP = "ROBOT RAHBE CO-OP";
  const BRAND_2P = "ROBOT RAHBE 2P";
  const LEGACY_PATTERNS = [
    /KLNM WITH KNDNSS/g,
    /\.KLN WITH KNDNSS/g,
    /KLN WITH KNDNSS/g,
    /KLMN with KNDNSS/g,
    /KLMN WITH KNDNSS/g,
    /\. LIL MAN'S/g,
    /\. LiL Man's/g,
    /LIL MAN'S/g,
    /Lil- MAN's KLMN with KNDNSS/g,
    /\.KLMN with KNDNSS/g
  ];

  const rewriteText = (text) => {
    if (!text) return text;
    let next = text;
    for (const pattern of LEGACY_PATTERNS) {
      next = next.replace(pattern, BRAND);
    }
    next = next.replace(`${BRAND} CO-OP`, BRAND_COOP);
    next = next.replace(`${BRAND} 2P`, BRAND_2P);
    return next;
  };

  const applyBrand = () => {
    document.title = BRAND;
    document.querySelector(".game-shell")?.setAttribute("aria-label", `${BRAND} browser game`);
    document.getElementById("game")?.setAttribute("aria-label", `${BRAND} playfield`);

    document.querySelectorAll("#titleScreen h1, #hudTitle").forEach((node) => {
      const next = rewriteText(node.textContent);
      if (next !== node.textContent) node.textContent = next;
    });
  };

  let pending = false;
  const scheduleBrand = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      applyBrand();
    });
  };

  const observeTarget = (observer, target, options) => {
    if (!observer || !target || typeof target.nodeType !== "number") return false;
    try {
      observer.observe(target, options);
      return true;
    } catch (_error) {
      return false;
    }
  };

  const boot = () => {
    applyBrand();
    const observer = new MutationObserver(scheduleBrand);
    document.querySelectorAll("#titleScreen h1, #hudTitle").forEach((node) => {
      observeTarget(observer, node, {
        childList: true,
        characterData: true,
        subtree: true
      });
    });
    const bodyObserver = new MutationObserver(scheduleBrand);
    if (observeTarget(bodyObserver, document.body, {
        childList: true,
        subtree: false
      }) === false) bodyObserver.disconnect();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();

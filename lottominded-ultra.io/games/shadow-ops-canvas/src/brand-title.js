(() => {
  const BRAND = ".KLN WITH KNDNSS";
  const BRAND_COOP = ".KLN WITH KNDNSS CO-OP";
  const BRAND_2P = ".KLN WITH KNDNSS 2P";
  const LEGACY_PATTERNS = [
    /KLMN with KNDNSS/g,
    /KLMN WITH KNDNSS/g,
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
    document.title = `${BRAND} | Shadow Ops`;
    document.querySelector(".game-shell")?.setAttribute("aria-label", `${BRAND} browser game`);
    document.getElementById("game")?.setAttribute("aria-label", `${BRAND} playfield`);

    document.querySelectorAll("#titleScreen h1, #loadingScreen .small-label, #hudTitle").forEach((node) => {
      node.textContent = rewriteText(node.textContent);
    });

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const next = rewriteText(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
    });
  };

  const boot = () => {
    applyBrand();
    new MutationObserver(applyBrand).observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();

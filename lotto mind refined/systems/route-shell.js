(function bootSystemsRoute() {
  "use strict";
  const base = window.__LOTTOMIND_BASE__;
  const root = window.__LOTTOMIND_ROOT__;
  const local = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";
  if (local) window.LOTTOMIND_API_BASE_URL = "http://127.0.0.1:8142";

  function addStyle(href, systems) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    if (systems) link.dataset.lottomindSystems = "true";
    document.head.appendChild(link);
  }

  function addScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", reject, { once: true });
      document.body.appendChild(script);
    });
  }

  async function start() {
    addStyle(`${base}/styles.css?v=systems-lab-1`);
    addStyle(`${base}/systems/styles.css?v=systems-lab-1`, true);
    const sources = [
      `${root}/assets/js/lottomind-merch-prices.js?v=merch-catalog-20260626c`,
      `${root}/lottominded-ultra.io/assets/js/lottomind-runtime-config.js?v=trivia-rewards-1`,
      `${root}/lottominded-ultra.io/assets/js/lottomind-account-service.js?v=trivia-rewards-2`,
      `${base}/systems/core.js?v=systems-lab-1`,
      `${base}/systems/registry.js?v=systems-lab-1`,
      `${base}/systems/store.js?v=systems-lab-1`,
      `${base}/systems/ui.js?v=systems-lab-1`,
      `${base}/app.js?v=systems-lab-1`,
    ];
    for (const source of sources) await addScript(source);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
}());

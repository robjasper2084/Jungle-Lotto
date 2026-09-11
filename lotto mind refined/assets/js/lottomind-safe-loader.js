(function installLottoMindSafeLoader(global) {
  "use strict";

  if (global.__LOTTOMIND_LOAD_SCRIPT__) return;

  global.__LOTTOMIND_ASSET_URL__ = function lottomindAssetUrl(source) {
    const url = new URL(String(source || ""), global.location.href);
    const allowedProtocol = /^(?:https?:|file:|capacitor:)$/.test(url.protocol);
    const networkOriginMismatch = /^(?:https?:)$/.test(url.protocol) && url.origin !== global.location.origin;
    if (!allowedProtocol || networkOriginMismatch) throw new Error("Blocked non-local LottoMind asset URL.");
    return url.href;
  };

  global.__LOTTOMIND_LOAD_STYLE__ = function loadLottoMindStyle(href, attributes) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = global.__LOTTOMIND_ASSET_URL__(href);
    Object.keys(attributes || {}).forEach((name) => link.setAttribute(name, attributes[name]));
    document.head.appendChild(link);
  };

  global.__LOTTOMIND_LOAD_SCRIPT__ = function loadLottoMindScript(src) {
    const script = document.createElement("script");
    script.src = global.__LOTTOMIND_ASSET_URL__(src);
    script.async = false;
    document.head.appendChild(script);
  };
})(window);

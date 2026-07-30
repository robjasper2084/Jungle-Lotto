(function loadDeferredSiteShell() {
  "use strict";

  var attempts = 0;
  var maximumAttempts = 120;

  function loadShell() {
    if (document.querySelector("[data-site-header], .feature-topbar, .lm-live-topbar, [data-guide-header]")) {
      var script = document.createElement("script");
      script.src = "../site.js?v=platform-route-restore-1";
      document.body.appendChild(script);
      return;
    }

    attempts += 1;
    if (attempts < maximumAttempts) window.setTimeout(loadShell, 50);
  }

  loadShell();
})();

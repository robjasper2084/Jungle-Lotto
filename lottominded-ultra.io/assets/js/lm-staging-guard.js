(function initLottoMindStagingGuard(global, document) {
  "use strict";

  var environment = global.LottoMindEnvironment;
  if (!environment || environment.isProduction) return;

  var marker = global.__LOTTOMIND_ENVIRONMENT_MARKER__ || {};
  var bannerText = "LottoMind Upgrade Preview — Not Production";
  var statusId = "lm-staging-guard-status";
  var analyticsHostPattern = /(^|\.)(?:google-analytics\.com|googletagmanager\.com|doubleclick\.net|segment\.io|segment\.com|mixpanel\.com|amplitude\.com)$/i;
  var analyticsPathPattern = /\/(?:analytics|collect|g\/collect)(?:\/|$)/i;
  var billingPathPattern = /\/(?:billing\/(?:checkout|portal)|checkout\/sessions?)(?:\/|$)/i;
  var redemptionPathPattern = /\/(?:redemption|redeem|collectibles?\/claim)(?:\/|$)/i;
  var accountMutationPathPattern = /\/(?:auth\/(?:register|login|logout)|credits\/(?:spend|refund)|account\/|game-sessions?)(?:\/|$)/i;
  var protectedRuntimeValues = {
    LOTTOMIND_API_BASE_URL: marker.stagingBackendUrl || "",
    LOTTOMIND_SUPABASE_URL: marker.stagingSupabaseUrl || "",
    LOTTOMIND_SUPABASE_PUBLISHABLE_KEY: marker.stagingSupabasePublishableKey || "",
    LOTTOMIND_REWARDS_API_BASE_URL: marker.stagingBackendUrl || "",
    LOTTOMIND_API_SAME_ORIGIN: false,
  };

  function createBlockedError(message, code) {
    var error = new Error(message);
    error.name = "LottoMindStagingBlockedError";
    error.code = code || "LM_STAGING_BLOCKED";
    error.blockedByStagingGuard = true;
    return error;
  }

  function ensureBanner() {
    var banner = document.querySelector("[data-lm-staging-banner]");
    if (banner) return banner;
    banner = document.createElement("div");
    banner.dataset.lmStagingBanner = "true";
    banner.setAttribute("role", "note");
    banner.textContent = bannerText;
    document.body.prepend(banner);
    return banner;
  }

  function ensureStatus() {
    var status = document.getElementById(statusId);
    if (status) return status;
    status = document.createElement("div");
    status.id = statusId;
    status.dataset.lmStagingGuardStatus = "ready";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.setAttribute("aria-atomic", "true");
    status.textContent = "Preview safety is active. Live payments, production account changes, real redemptions, and production analytics are disabled.";
    var banner = ensureBanner();
    banner.insertAdjacentElement("afterend", status);
    return status;
  }

  function announce(message, code) {
    var update = function updateStatus() {
      var status = ensureStatus();
      status.textContent = message;
      status.dataset.lmStagingGuardStatus = code || "blocked";
      global.dispatchEvent(new CustomEvent("lottomind:staging-blocked", {
        detail: Object.freeze({ code: code || "LM_STAGING_BLOCKED", message: message }),
      }));
    };
    if (document.body) update();
    else document.addEventListener("DOMContentLoaded", update, { once: true });
  }

  function blockedPromise(message, code) {
    announce(message, code);
    return Promise.reject(createBlockedError(message, code));
  }

  function parseUrl(value) {
    try {
      var raw = value && typeof value === "object" && "url" in value ? value.url : value;
      return new URL(String(raw || ""), global.location.href);
    } catch (_error) {
      return null;
    }
  }

  function isStagingBackend(url) {
    return Boolean(
      url &&
      environment.hasIsolatedStagingBackend &&
      environment.stagingBackendOrigin &&
      url.origin === environment.stagingBackendOrigin
    );
  }

  function requestBlock(url, method) {
    if (!url) return null;
    var normalizedMethod = String(method || "GET").toUpperCase();
    var isMutation = !["GET", "HEAD", "OPTIONS"].includes(normalizedMethod);

    if (analyticsHostPattern.test(url.hostname) || analyticsPathPattern.test(url.pathname)) {
      return {
        code: "LM_STAGING_ANALYTICS_BLOCKED",
        message: "Production analytics are disabled in the LottoMind upgrade preview.",
      };
    }
    if (!isMutation) return null;

    if (billingPathPattern.test(url.pathname)) {
      if (environment.allowTestPayments && isStagingBackend(url)) return null;
      return {
        code: "LM_STAGING_PAYMENT_BLOCKED",
        message: "Checkout is disabled in this preview. No live charge was created.",
      };
    }
    if (redemptionPathPattern.test(url.pathname)) {
      if (environment.allowRedemptions && isStagingBackend(url)) return null;
      return {
        code: "LM_STAGING_REDEMPTION_BLOCKED",
        message: "Collectible redemption is disabled in this preview. No code was consumed.",
      };
    }
    if (accountMutationPathPattern.test(url.pathname)) {
      if (environment.allowAccountWrites && isStagingBackend(url)) return null;
      return {
        code: "LM_STAGING_ACCOUNT_WRITE_BLOCKED",
        message: "Production account changes are disabled in this preview. No account data was changed.",
      };
    }
    return null;
  }

  function installRuntimeConfigGuards() {
    Object.keys(protectedRuntimeValues).forEach(function protectRuntimeValue(name) {
      var current = protectedRuntimeValues[name];
      try {
        Object.defineProperty(global, name, {
          configurable: true,
          enumerable: true,
          get: function getProtectedValue() { return current; },
          set: function setProtectedValue(value) {
            if (name === "LOTTOMIND_API_SAME_ORIGIN") {
              current = false;
              return;
            }
            if (!environment.hasIsolatedStagingBackend) return;
            if (name === "LOTTOMIND_SUPABASE_PUBLISHABLE_KEY") {
              if (/^(?:sb_publishable_|pk_test_)/.test(String(value || ""))) current = String(value);
              return;
            }
            var candidate = parseUrl(value);
            if (candidate && isStagingBackend(candidate)) current = String(value).replace(/\/$/, "");
          },
        });
      } catch (_error) {
        global[name] = current;
      }
    });
  }

  function installFetchGuard() {
    if (typeof global.fetch !== "function") return;
    var nativeFetch = global.fetch.bind(global);
    global.fetch = function stagingFetch(input, init) {
      var method = (init && init.method) || (input && typeof input === "object" && input.method) || "GET";
      var blocked = requestBlock(parseUrl(input), method);
      if (blocked) return blockedPromise(blocked.message, blocked.code);
      return nativeFetch(input, init);
    };
  }

  function installXhrGuard() {
    if (!global.XMLHttpRequest) return;
    var nativeOpen = global.XMLHttpRequest.prototype.open;
    var nativeSend = global.XMLHttpRequest.prototype.send;
    global.XMLHttpRequest.prototype.open = function stagingOpen(method, url) {
      this.__lmStagingRequest = { method: method, url: url };
      return nativeOpen.apply(this, arguments);
    };
    global.XMLHttpRequest.prototype.send = function stagingSend() {
      var request = this.__lmStagingRequest || {};
      var blocked = requestBlock(parseUrl(request.url), request.method);
      if (!blocked) return nativeSend.apply(this, arguments);
      announce(blocked.message, blocked.code);
      this.abort();
      var xhr = this;
      global.queueMicrotask(function dispatchBlockedXhr() { xhr.dispatchEvent(new Event("error")); });
      return undefined;
    };
  }

  function installBeaconGuard() {
    if (!global.navigator || typeof global.navigator.sendBeacon !== "function") return;
    var nativeBeacon = global.navigator.sendBeacon.bind(global.navigator);
    global.navigator.sendBeacon = function stagingBeacon(url, data) {
      var blocked = requestBlock(parseUrl(url), "POST");
      if (blocked) {
        announce(blocked.message, blocked.code);
        return false;
      }
      return nativeBeacon(url, data);
    };
  }

  function wrapAccountService(service) {
    if (!service || service.__lmStagingWrapped) return service;
    var wrapped = Object.assign({}, service);
    var blockAccountWrite = function blockAccountWrite() {
      return blockedPromise(
        "Production account changes are disabled in this preview. No account data was changed.",
        "LM_STAGING_ACCOUNT_WRITE_BLOCKED"
      );
    };
    var blockRedemption = function blockRedemption() {
      return blockedPromise(
        "Collectible redemption is disabled in this preview. No code was consumed.",
        "LM_STAGING_REDEMPTION_BLOCKED"
      );
    };

    if (!environment.allowAccountWrites) {
      ["register", "signIn", "signOut", "spendCredits", "refundCredits"].forEach(function blockMethod(name) {
        if (typeof wrapped[name] === "function") wrapped[name] = blockAccountWrite;
      });
    }
    if (!environment.allowRedemptions && typeof wrapped.redeemCollectible === "function") {
      wrapped.redeemCollectible = blockRedemption;
    }
    if (!environment.allowProductionAnalytics && typeof wrapped.analytics === "function") {
      wrapped.analytics = function blockedAnalytics() {
        announce("Production analytics are disabled in the LottoMind upgrade preview.", "LM_STAGING_ANALYTICS_BLOCKED");
        return Promise.resolve(Object.freeze({ blocked: true }));
      };
    }
    Object.defineProperty(wrapped, "__lmStagingWrapped", { value: true });
    return Object.freeze(wrapped);
  }

  function installAccountServiceGuard() {
    var current = null;
    try {
      Object.defineProperty(global, "LottoMindAccountService", {
        configurable: true,
        enumerable: true,
        get: function getAccountService() { return current; },
        set: function setAccountService(service) { current = wrapAccountService(service); },
      });
    } catch (_error) {
      if (global.LottoMindAccountService) global.LottoMindAccountService = wrapAccountService(global.LottoMindAccountService);
    }
  }

  function installFormAndLinkGuards() {
    var checkoutSelector = "[data-stripe-lookup-key], [data-stripe-portal], a[href*='checkout.stripe.com']";
    var redemptionSelector = "[data-code-form], [data-collector-redeem-form], [data-redeem], form[action*='redeem']";
    var accountSelector = "[data-auth-form], [data-collector-auth-form], [data-sign-out], [data-collector-logout]";

    document.addEventListener("click", function blockProtectedClick(event) {
      var target = event.target && event.target.closest ? event.target.closest("a, button") : null;
      if (!target) return;
      if (target.matches(checkoutSelector) && !environment.allowTestPayments) {
        event.preventDefault();
        event.stopImmediatePropagation();
        announce("Checkout is disabled in this preview. No live charge was created.", "LM_STAGING_PAYMENT_BLOCKED");
      } else if ((target.matches("[data-sign-out], [data-collector-logout]") || target.closest(accountSelector)) && !environment.allowAccountWrites) {
        event.preventDefault();
        event.stopImmediatePropagation();
        announce("Production account changes are disabled in this preview. No account data was changed.", "LM_STAGING_ACCOUNT_WRITE_BLOCKED");
      }
    }, true);

    document.addEventListener("submit", function blockProtectedSubmit(event) {
      var form = event.target;
      if (!form || !form.matches) return;
      if (form.matches(redemptionSelector) && !environment.allowRedemptions) {
        event.preventDefault();
        event.stopImmediatePropagation();
        announce("Collectible redemption is disabled in this preview. No code was consumed.", "LM_STAGING_REDEMPTION_BLOCKED");
      } else if (form.matches(accountSelector) && !environment.allowAccountWrites) {
        event.preventDefault();
        event.stopImmediatePropagation();
        announce("Production account changes are disabled in this preview. No account data was changed.", "LM_STAGING_ACCOUNT_WRITE_BLOCKED");
      }
    }, true);
  }

  function installAnalyticsScriptGuard() {
    var removeAnalyticsScript = function removeAnalyticsScript(node) {
      if (!node || node.nodeType !== 1) return;
      var scripts = node.matches && node.matches("script[src]") ? [node] : Array.from(node.querySelectorAll ? node.querySelectorAll("script[src]") : []);
      scripts.forEach(function removeScript(script) {
        var url = parseUrl(script.src);
        if (url && analyticsHostPattern.test(url.hostname)) script.remove();
      });
    };
    new MutationObserver(function onMutation(records) {
      records.forEach(function inspectRecord(record) {
        record.addedNodes.forEach(removeAnalyticsScript);
      });
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  function disableServiceWorkers() {
    if (!global.navigator || !global.navigator.serviceWorker) return;
    try {
      Object.defineProperty(global.navigator.serviceWorker, "register", {
        configurable: true,
        value: function blockedServiceWorkerRegistration() {
          return blockedPromise("Service workers are disabled in this preview to keep staging isolated.", "LM_STAGING_SERVICE_WORKER_BLOCKED");
        },
      });
    } catch (_error) {}
    global.navigator.serviceWorker.getRegistrations().then(function unregisterPreviewWorkers(registrations) {
      registrations.forEach(function unregister(registration) { registration.unregister(); });
    }).catch(function ignoreUnavailableServiceWorkers() {});
  }

  installRuntimeConfigGuards();
  installFetchGuard();
  installXhrGuard();
  installBeaconGuard();
  installAccountServiceGuard();
  installFormAndLinkGuards();
  installAnalyticsScriptGuard();
  disableServiceWorkers();

  if (document.body) {
    ensureBanner();
    ensureStatus();
  } else {
    document.addEventListener("DOMContentLoaded", function showStagingSafety() {
      ensureBanner();
      ensureStatus();
    }, { once: true });
  }

  global.LottoMindStagingGuard = Object.freeze({
    active: true,
    environment: environment,
    announceBlockedAction: announce,
    requestBlock: function publicRequestBlock(url, method) {
      return requestBlock(parseUrl(url), method);
    },
  });
})(window, document);

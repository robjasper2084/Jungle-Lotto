(function initLottoMindAccountService(global) {
  "use strict";

  if (global.LottoMindAccountService) return;

  var CACHE_KEY = "lottomind.account.snapshot.v1";
  var SESSION_KEY = "lottomind.account.session.v1";
  var API_BASE_KEY = "lottomind.api.base";
  var PROTECTED_API_BASE_KEY = "lottomind.protected.api.base";
  var CACHE_TTL = 30000;
  var snapshotCache = null;
  var snapshotTime = 0;
  var sessionPersistence = "local";
  var subscribers = new Set();
  var channel = "BroadcastChannel" in global ? new BroadcastChannel("lottomind-account-v1") : null;

  function defaultApiBase() {
    if (typeof global.LOTTOMIND_API_BASE_URL === "string") return global.LOTTOMIND_API_BASE_URL.replace(/\/$/, "");
    var configured = "";
    try { configured = localStorage.getItem(API_BASE_KEY) || ""; } catch (_error) {}
    if (configured) return configured.replace(/\/$/, "");
    if (location.hostname === "127.0.0.1" && location.port === "8170") return "http://127.0.0.1:8142";
    if (location.hostname === "localhost" && location.port === "8170") return "http://127.0.0.1:8142";
    return "";
  }

  function apiUrl(path) {
    var base = defaultApiBase();
    if (base) return base + (base.indexOf("/functions/v1/") >= 0 ? path : "/api" + path);
    if (global.LOTTOMIND_API_SAME_ORIGIN === true) return "/api" + path;
    return "";
  }

  function defaultProtectedApiBase() {
    if (typeof global.LOTTOMIND_PROTECTED_API_BASE_URL === "string") return global.LOTTOMIND_PROTECTED_API_BASE_URL.replace(/\/$/, "");
    var configured = "";
    try { configured = localStorage.getItem(PROTECTED_API_BASE_KEY) || ""; } catch (_error) {}
    if (configured) return configured.replace(/\/$/, "");
    var publicBase = defaultApiBase();
    if (/\/functions\/v1\/lottomind-api$/.test(publicBase)) return publicBase.replace(/\/lottomind-api$/, "/lottomind-protected");
    return "";
  }

  function protectedApiUrl(path) {
    var base = defaultProtectedApiBase();
    return base ? base + path : "";
  }

  function isConfigured() {
    return Boolean(defaultApiBase()) || global.LOTTOMIND_API_SAME_ORIGIN === true;
  }

  function cachedOfflineSnapshot() {
    try {
      var parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (!parsed || typeof parsed !== "object") return null;
      return Object.assign({}, parsed, { verified: false, offline: true });
    } catch (_error) {
      return null;
    }
  }

  function saveSnapshot(snapshot) {
    snapshotCache = Object.assign({}, snapshot, { verified: true, offline: false });
    snapshotTime = Date.now();
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(snapshotCache)); } catch (_error) {}
    subscribers.forEach(function notify(callback) {
      try { callback(snapshotCache); } catch (_error) {}
    });
    global.dispatchEvent(new CustomEvent("lottomind:account-refresh", { detail: snapshotCache }));
    return snapshotCache;
  }

  function readSession() {
    try {
      var transientSession = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
      if (transientSession) {
        sessionPersistence = "session";
        return transientSession;
      }
      sessionPersistence = "local";
      return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    } catch (_error) { return null; }
  }

  function saveSession(session, remember) {
    if (!session || !session.access_token) return;
    if (typeof remember === "boolean") sessionPersistence = remember ? "local" : "session";
    try {
      var selectedStorage = sessionPersistence === "local" ? localStorage : sessionStorage;
      var otherStorage = sessionPersistence === "local" ? sessionStorage : localStorage;
      selectedStorage.setItem(SESSION_KEY, JSON.stringify(session));
      otherStorage.removeItem(SESSION_KEY);
    } catch (_error) {}
  }

  function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch (_error) {}
    try { sessionStorage.removeItem(SESSION_KEY); } catch (_error) {}
  }

  function capturePasswordRecovery() {
    var parameters = new URLSearchParams(String(global.location.hash || "").replace(/^#/, ""));
    if (parameters.get("type") !== "recovery" || !parameters.get("access_token")) return false;
    saveSession({
      access_token: parameters.get("access_token"),
      refresh_token: parameters.get("refresh_token") || "",
      expires_at: Number(parameters.get("expires_at") || 0),
      expires_in: Number(parameters.get("expires_in") || 0),
      token_type: parameters.get("token_type") || "bearer",
    }, false);
    global.history.replaceState(null, "", global.location.pathname + global.location.search);
    return true;
  }

  async function getAccessToken() {
    var session = readSession();
    if (!session || !session.access_token) return "";
    var expiresAt = Number(session.expires_at || 0) * 1000;
    if (!expiresAt || expiresAt - Date.now() > 60000 || !session.refresh_token) return session.access_token;
    var supabaseUrl = global.LOTTOMIND_SUPABASE_URL;
    var publishableKey = global.LOTTOMIND_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !publishableKey) return session.access_token;
    try {
      var response = await fetch(supabaseUrl + "/auth/v1/token?grant_type=refresh_token", {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": publishableKey },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      });
      if (!response.ok) throw new Error("Session refresh failed");
      var refreshed = await response.json();
      saveSession(refreshed);
      return refreshed.access_token || "";
    } catch (_error) {
      clearSession();
      return "";
    }
  }

  async function serviceRequest(path, options, protectedRoute) {
    var url = protectedRoute ? protectedApiUrl(path) : apiUrl(path);
    if (!url) {
      var previewDisabled = global.LottoMindEnvironment && global.LottoMindEnvironment.isProduction === false;
      var configurationError = new Error(previewDisabled
        ? "Production account services are configured but disabled in this preview."
        : "Account services are not configured for this static site.");
      configurationError.code = previewDisabled ? "ACCOUNT_PREVIEW_DISABLED" : "ACCOUNT_NOT_CONFIGURED";
      throw configurationError;
    }
    var response;
    var requestOptions = options || {};
    var headers = Object.assign({ "Content-Type": "application/json", "X-Requested-With": "LottoMind-Web" }, requestOptions.headers || {});
    var accessToken = await getAccessToken();
    if (protectedRoute && !accessToken) {
      var authError = new Error("Sign in is required before using this protected LottoMind service.");
      authError.code = "AUTH_REQUIRED";
      authError.status = 401;
      throw authError;
    }
    if (accessToken) headers.Authorization = "Bearer " + accessToken;
    try {
      response = await fetch(url, Object.assign({}, requestOptions, {
        credentials: "include",
        headers: headers,
      }));
    } catch (error) {
      var networkError = new Error("The account service is offline. Your verified balance cannot be changed right now.");
      networkError.code = "ACCOUNT_OFFLINE";
      networkError.cause = error;
      throw networkError;
    }
    if (response.status === 204) return null;
    var payload = await response.json().catch(function noJson() { return {}; });
    if (!response.ok) {
      var message = payload && payload.error && payload.error.message ? payload.error.message : "The account request could not be completed.";
      var requestError = new Error(message);
      requestError.code = payload && payload.error && payload.error.code ? payload.error.code : "ACCOUNT_REQUEST_FAILED";
      requestError.status = response.status;
      throw requestError;
    }
    return payload;
  }

  function request(path, options) {
    return serviceRequest(path, options, false);
  }

  function protectedRequest(path, options) {
    return serviceRequest(path, options, true);
  }

  function signedOutSnapshot() {
    return {
      authenticated: false,
      user: null,
      wallet: { balance: 0 },
      currentPlan: { code: "free", status: "active", currentPeriodEnd: null },
      memberships: [],
      entitlements: [],
      orders: [],
      downloads: [],
      collector: { redeemed: false, complimentaryUntil: null },
    };
  }

  async function getSnapshot(options) {
    var force = options && options.force;
    if (!force && snapshotCache && Date.now() - snapshotTime < CACHE_TTL) return snapshotCache;
    try {
      if (!(await getAccessToken())) return saveSnapshot(signedOutSnapshot());
      return saveSnapshot(await protectedRequest("/account/snapshot"));
    } catch (error) {
      var cached = cachedOfflineSnapshot();
      if (cached) {
        snapshotCache = cached;
        subscribers.forEach(function notify(callback) { try { callback(cached); } catch (_error) {} });
        return cached;
      }
      throw error;
    }
  }

  function checkEntitlement(code) {
    var normalized = String(code || "").trim().toLowerCase();
    if (!/^[a-z0-9_.-]{1,80}$/.test(normalized)) return Promise.reject(new Error("Choose a valid entitlement."));
    return protectedRequest("/entitlements/" + encodeURIComponent(normalized));
  }

  function broadcastRefresh(reason) {
    if (channel) channel.postMessage({ type: "refresh", reason: reason || "account-change", at: Date.now() });
  }

  async function mutation(path, body, options) {
    var payload = await request(path, { method: "POST", body: JSON.stringify(body || {}) });
    if (payload && payload.session) saveSession(payload.session, options && options.remember);
    var snapshot = payload && payload.snapshot ? payload.snapshot : payload;
    if (snapshot && typeof snapshot.authenticated === "boolean") saveSnapshot(snapshot);
    else await getSnapshot({ force: true });
    broadcastRefresh(path);
    return payload;
  }

  async function protectedMutation(path, body) {
    var payload = await protectedRequest(path, { method: "POST", body: JSON.stringify(body || {}) });
    var nextSnapshot = payload && payload.snapshot ? payload.snapshot : null;
    if (nextSnapshot && typeof nextSnapshot.authenticated === "boolean") saveSnapshot(nextSnapshot);
    else await getSnapshot({ force: true });
    broadcastRefresh(path);
    return payload;
  }

  function createIdempotencyKey(prefix) {
    var random = global.crypto && global.crypto.randomUUID ? global.crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
    return String(prefix || "action").replace(/[^a-zA-Z0-9:_-]/g, "-").slice(0, 40) + ":" + random;
  }

  if (channel) {
    channel.addEventListener("message", function onMessage(event) {
      if (!event.data || event.data.type !== "refresh") return;
      snapshotTime = 0;
      getSnapshot({ force: true }).catch(function ignoreOffline() {});
    });
  }
  global.addEventListener("storage", function onStorage(event) {
    if (event.key === CACHE_KEY) {
      snapshotTime = 0;
      getSnapshot({ force: true }).catch(function ignoreOffline() {});
    }
  });

  global.LottoMindAccountService = Object.freeze({
    getApiBase: defaultApiBase,
    getProtectedApiBase: defaultProtectedApiBase,
    isConfigured: isConfigured,
    getAccessToken: getAccessToken,
    getSnapshot: getSnapshot,
    getSession: async function getSession() {
      var snapshot = await getSnapshot();
      return { authenticated: snapshot.authenticated, user: snapshot.user, verified: snapshot.verified, offline: snapshot.offline };
    },
    getWallet: async function getWallet() { return (await getSnapshot()).wallet; },
    getCurrentPlan: async function getCurrentPlan() { return (await getSnapshot()).currentPlan || { code: "free", status: "active" }; },
    getMemberships: async function getMemberships() { return (await getSnapshot()).memberships || []; },
    getDownloads: async function getDownloads() { return (await getSnapshot()).downloads || []; },
    getCollectorStatus: async function getCollectorStatus() { return (await getSnapshot()).collector; },
    register: function register(input) { return mutation("/auth/register", input); },
    signIn: function signIn(input) {
      var credentials = { email: input && input.email, password: input && input.password };
      return mutation("/auth/login", credentials, { remember: Boolean(input && input.remember) });
    },
    requestPasswordReset: function requestPasswordReset(email) {
      return request("/auth/password-reset", { method: "POST", body: JSON.stringify({ email: String(email || "").trim() }) });
    },
    capturePasswordRecovery: capturePasswordRecovery,
    completePasswordRecovery: function completePasswordRecovery(password) {
      return request("/auth/password-update", { method: "POST", body: JSON.stringify({ password: String(password || "") }) });
    },
    signOut: async function signOut() {
      try { await request("/auth/logout", { method: "POST", body: "{}" }); } catch (_error) {}
      clearSession();
      try { localStorage.removeItem(CACHE_KEY); } catch (_error) {}
      snapshotCache = null;
      snapshotTime = 0;
      broadcastRefresh("logout");
      return getSnapshot({ force: true });
    },
    redeemCollectible: function redeemCollectible(code) {
      return protectedMutation("/redemption/claim", {
        code: String(code || "").trim(),
        idempotencyKey: createIdempotencyKey("collector-redemption"),
      });
    },
    spendCredits: async function spendCredits(action, idempotencyKey, context) {
      var result = await protectedRequest("/credits/spend", { method: "POST", body: JSON.stringify({ action: action, idempotencyKey: idempotencyKey, context: context || {} }) });
      await getSnapshot({ force: true });
      broadcastRefresh("credit-spend");
      return result;
    },
    refundCredits: async function refundCredits(transactionId, idempotencyKey, refundToken) {
      var result = await protectedRequest("/credits/refund", { method: "POST", body: JSON.stringify({ transactionId: transactionId, idempotencyKey: idempotencyKey, refundToken: refundToken }) });
      await getSnapshot({ force: true });
      broadcastRefresh("credit-refund");
      return result;
    },
    createTriviaSession: function createTriviaSession(input) {
      return protectedRequest("/trivia/sessions", { method: "POST", body: JSON.stringify({ mode: input && input.mode, buildId: input && input.buildId }) });
    },
    submitTriviaAnswer: function submitTriviaAnswer(sessionId, input) {
      return protectedRequest("/trivia/sessions/" + encodeURIComponent(sessionId) + "/answer", {
        method: "POST",
        body: JSON.stringify({ questionId: input && input.questionId, selectedIndex: input && input.selectedIndex, sequence: input && input.sequence, elapsedMs: input && input.elapsedMs }),
      });
    },
    claimTriviaReward: async function claimTriviaReward(sessionId, idempotencyKey) {
      var result = await protectedRequest("/trivia/sessions/" + encodeURIComponent(sessionId) + "/claim", {
        method: "POST",
        body: JSON.stringify({ idempotencyKey: idempotencyKey }),
      });
      await getSnapshot({ force: true });
      broadcastRefresh("trivia-reward");
      return result;
    },
    checkEntitlement: checkEntitlement,
    getBeat2LottoEntitlements: function getBeat2LottoEntitlements() { return checkEntitlement("beat2lotto"); },
    analytics: function analytics(event, metadata) {
      return request("/analytics", { method: "POST", body: JSON.stringify({ event: event, metadata: metadata || {} }) }).catch(function ignoreAnalytics() {});
    },
    subscribeToWallet: function subscribeToWallet(callback) {
      subscribers.add(callback);
      if (snapshotCache) callback(snapshotCache);
      return function unsubscribe() { subscribers.delete(callback); };
    },
    createIdempotencyKey: createIdempotencyKey,
    getAccessToken: getAccessToken,
    refresh: function refresh() { snapshotTime = 0; return getSnapshot({ force: true }); },
  });
})(window);

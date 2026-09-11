(function initLottoMindAccountService(global) {
  "use strict";

  if (global.LottoMindAccountService) return;

  var CACHE_KEY = "lottomind.account.snapshot.v1";
  var SESSION_KEY = "lottomind.account.session.v1";
  var CACHE_TTL = 30000;
  var snapshotCache = null;
  var snapshotTime = 0;
  var sessionPersistence = "session";
  var subscribers = new Set();
  var channel = "BroadcastChannel" in global ? new BroadcastChannel("lottomind-account-v1") : null;

  function safeApiBase(value) {
    try {
      var url = new URL(String(value || ""), global.location.href);
      var localHttp = url.protocol === "http:" && /^(?:127\.0\.0\.1|localhost)$/i.test(url.hostname);
      if (url.protocol !== "https:" && !localHttp) return "";
      return url.href.replace(/\/$/, "");
    } catch (_error) {
      return "";
    }
  }

  function defaultApiBase() {
    if (typeof global.LOTTOMIND_API_BASE_URL === "string" && global.LOTTOMIND_API_BASE_URL.trim()) {
      return safeApiBase(global.LOTTOMIND_API_BASE_URL);
    }
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
    if (typeof global.LOTTOMIND_PROTECTED_API_BASE_URL === "string" && global.LOTTOMIND_PROTECTED_API_BASE_URL.trim()) {
      return safeApiBase(global.LOTTOMIND_PROTECTED_API_BASE_URL);
    }
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

  function limitedText(value, maxLength) {
    return String(value == null ? "" : value).trim().slice(0, maxLength || 160);
  }

  function safeDateTime(value) {
    if (!value) return null;
    var date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }

  function safeCreditValue(value, options) {
    var numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    var minimum = options && options.signed ? -1000000000 : 0;
    return Math.max(minimum, Math.min(1000000000, Math.round(numeric)));
  }

  function normalizeSnapshot(input, flags) {
    var source = input && typeof input === "object" ? input : {};
    var userSource = source.user && typeof source.user === "object" ? source.user : {};
    var userId = limitedText(userSource.id, 120);
    var authenticated = source.authenticated === true && Boolean(userId);
    var allowedPlans = new Set(["free", "gold", "ultra", "vault", "guardian_bundle"]);
    var allowedStatuses = new Set(["active", "trialing", "grace_period", "past_due", "canceled", "expired", "refunded"]);
    var normalizePlanCode = function normalizePlanCode(value) {
      var code = limitedText(value, 40).toLowerCase();
      return allowedPlans.has(code) ? code : "free";
    };
    var normalizeStatus = function normalizeStatus(value) {
      var status = limitedText(value, 40).toLowerCase();
      return allowedStatuses.has(status) ? status : "expired";
    };
    var normalizeProvider = function normalizeProvider(value) {
      var provider = limitedText(value, 30).toLowerCase();
      return ["stripe", "collector", "manual", "revenuecat"].includes(provider) ? provider : "";
    };
    var walletSource = authenticated && source.wallet && typeof source.wallet === "object" ? source.wallet : {};
    var entries = Array.isArray(walletSource.entries) ? walletSource.entries.slice(0, 50).map(function normalizeEntry(entry) {
      var row = entry && typeof entry === "object" ? entry : {};
      return {
        entryId: limitedText(row.entryId, 120),
        amountDelta: safeCreditValue(row.amountDelta, { signed: true }),
        reason: limitedText(row.reason, 160),
        sourceId: limitedText(row.sourceId, 120),
        createdAt: safeDateTime(row.createdAt),
      };
    }).filter(function validEntry(entry) { return Boolean(entry.entryId && entry.createdAt); }) : [];
    var planSource = authenticated && source.currentPlan && typeof source.currentPlan === "object" ? source.currentPlan : {};
    var planCode = normalizePlanCode(planSource.code);
    var planStatus = planCode === "free" ? "active" : normalizeStatus(planSource.status);
    var memberships = authenticated && Array.isArray(source.memberships) ? source.memberships.slice(0, 20).map(function normalizeMembership(entry) {
      var row = entry && typeof entry === "object" ? entry : {};
      return {
        subscriptionId: limitedText(row.subscriptionId, 120),
        planCode: normalizePlanCode(row.planCode),
        status: normalizeStatus(row.status),
        currentPeriodEnd: safeDateTime(row.currentPeriodEnd),
        cancelAtPeriodEnd: row.cancelAtPeriodEnd === true,
        provider: normalizeProvider(row.provider),
      };
    }).filter(function validMembership(entry) { return Boolean(entry.subscriptionId); }) : [];
    var entitlements = authenticated && Array.isArray(source.entitlements) ? source.entitlements.slice(0, 100).map(function normalizeEntitlement(entry) {
      var row = entry && typeof entry === "object" ? entry : {};
      var code = limitedText(row.code, 80).toLowerCase();
      return {
        code: /^[a-z0-9_.-]{1,80}$/.test(code) ? code : "",
        active: row.active === true,
        endsAt: safeDateTime(row.endsAt),
      };
    }).filter(function validEntitlement(entry) { return Boolean(entry.code); }) : [];
    var collectorSource = authenticated && source.collector && typeof source.collector === "object" ? source.collector : {};
    var allowanceSource = authenticated && source.allowances && typeof source.allowances === "object" ? source.allowances : {};
    var allowanceFeatures = authenticated && allowanceSource.authority === "server" && Array.isArray(allowanceSource.features)
      ? allowanceSource.features.slice(0, 20).map(function normalizeAllowance(entry) {
        var row = entry && typeof entry === "object" ? entry : {};
        var code = limitedText(row.code, 80).toLowerCase();
        var limit = Math.max(0, Math.min(1000, Math.round(Number(row.limit) || 0)));
        var used = Math.max(0, Math.min(limit, Math.round(Number(row.used) || 0)));
        return {
          code: /^[a-z0-9][a-z0-9_.-]{0,79}$/.test(code) ? code : "",
          limit: limit,
          used: used,
          remaining: Math.max(0, limit - used),
        };
      }).filter(function validAllowance(entry) { return Boolean(entry.code && entry.limit > 0); })
      : [];
    return {
      authenticated: authenticated,
      user: authenticated ? {
        id: userId,
        email: limitedText(userSource.email, 254) || null,
        displayName: limitedText(userSource.displayName, 120) || "LottoMind Member",
      } : null,
      wallet: {
        balance: authenticated ? safeCreditValue(walletSource.balance) : 0,
        updatedAt: safeDateTime(walletSource.updatedAt),
        entries: entries,
      },
      currentPlan: authenticated ? {
        code: planCode,
        status: planStatus,
        currentPeriodEnd: safeDateTime(planSource.currentPeriodEnd),
        cancelAtPeriodEnd: planSource.cancelAtPeriodEnd === true,
        provider: normalizeProvider(planSource.provider),
      } : { code: "free", status: "active", currentPeriodEnd: null, cancelAtPeriodEnd: false, provider: "" },
      memberships: memberships,
      entitlements: entitlements,
      orders: [],
      downloads: authenticated && Array.isArray(source.downloads) ? source.downloads.slice(0, 100).map(function normalizeDownload(entry) {
        var row = entry && typeof entry === "object" ? entry : {};
        return {
          id: limitedText(row.id, 120),
          title: limitedText(row.title, 160),
          createdAt: safeDateTime(row.createdAt),
        };
      }).filter(function validDownload(entry) { return Boolean(entry.id && entry.title); }) : [],
      collector: {
        redeemed: collectorSource.redeemed === true,
        redeemedAt: safeDateTime(collectorSource.redeemedAt),
        complimentaryUntil: safeDateTime(collectorSource.complimentaryUntil),
      },
      allowances: {
        authority: authenticated && allowanceSource.authority === "server" ? "server" : "none",
        period: allowanceSource.period === "utc-day" ? "utc-day" : "",
        resetAt: safeDateTime(allowanceSource.resetAt),
        features: allowanceFeatures,
      },
      verified: flags && flags.verified === true,
      offline: flags && flags.offline === true,
    };
  }

  function cachedOfflineSnapshot() {
    try {
      var parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (!parsed || typeof parsed !== "object") return null;
      return normalizeSnapshot(parsed, { verified: false, offline: true });
    } catch (_error) {
      return null;
    }
  }

  function saveSnapshot(snapshot, options) {
    snapshotCache = normalizeSnapshot(snapshot, { verified: true, offline: false });
    snapshotTime = Date.now();
    try {
      if (options && options.persist === false) localStorage.removeItem(CACHE_KEY);
      else localStorage.setItem(CACHE_KEY, JSON.stringify(snapshotCache));
    } catch (_error) {}
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

  function clearCachedAuthority() {
    clearSession();
    try { localStorage.removeItem(CACHE_KEY); } catch (_error) {}
    snapshotCache = null;
    snapshotTime = 0;
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
    var response;
    try {
      response = await fetch(supabaseUrl + "/auth/v1/token?grant_type=refresh_token", {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": publishableKey },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      });
    } catch (_error) {
      return session.access_token;
    }
    if (!response.ok) {
      if (response.status === 400 || response.status === 401 || response.status === 403) {
        clearCachedAuthority();
        return "";
      }
      return session.access_token;
    }
    try {
      var refreshed = await response.json();
      saveSession(refreshed);
      return refreshed.access_token || "";
    } catch (_error) {
      return session.access_token;
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
      allowances: { authority: "none", period: "utc-day", resetAt: null, features: [] },
    };
  }

  async function getSnapshot(options) {
    var force = options && options.force;
    if (!force && snapshotCache && Date.now() - snapshotTime < CACHE_TTL) return snapshotCache;
    try {
      if (!(await getAccessToken())) return saveSnapshot(signedOutSnapshot(), { persist: false });
      return saveSnapshot(await protectedRequest("/account/snapshot"));
    } catch (error) {
      if (error && (error.status === 401 || error.status === 403 || error.code === "AUTH_REQUIRED")) {
        clearCachedAuthority();
        return saveSnapshot(signedOutSnapshot(), { persist: false });
      }
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
    var random = "";
    if (global.crypto && typeof global.crypto.randomUUID === "function") {
      random = global.crypto.randomUUID();
    } else if (global.crypto && typeof global.crypto.getRandomValues === "function") {
      var bytes = new Uint8Array(16);
      global.crypto.getRandomValues(bytes);
      random = Array.from(bytes, function toHex(byte) { return byte.toString(16).padStart(2, "0"); }).join("");
    } else {
      throw new Error("Secure random generation is required for protected account operations.");
    }
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
    if (event.key === CACHE_KEY || event.key === SESSION_KEY) {
      if (event.key === SESSION_KEY && !event.newValue) snapshotCache = null;
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
      clearCachedAuthority();
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
    startGameRun: function startGameRun(input) {
      return protectedRequest("/game-runs", {
        method: "POST",
        body: JSON.stringify({
          gameCode: input && input.gameCode,
          buildId: input && input.buildId,
          clientRunKey: input && input.clientRunKey,
          metadata: input && input.metadata || {},
        }),
      });
    },
    recordGameRunEvent: function recordGameRunEvent(runId, input) {
      return protectedRequest("/game-runs/" + encodeURIComponent(runId) + "/events", {
        method: "POST",
        body: JSON.stringify({
          sequence: input && input.sequence,
          eventType: input && input.eventType,
          elapsedMs: input && input.elapsedMs,
          eventKey: input && input.eventKey,
          metadata: input && input.metadata || {},
        }),
      });
    },
    claimGameRunReward: async function claimGameRunReward(runId, idempotencyKey) {
      var result = await protectedRequest("/game-runs/" + encodeURIComponent(runId) + "/claim", {
        method: "POST",
        body: JSON.stringify({ idempotencyKey: idempotencyKey }),
      });
      await getSnapshot({ force: true });
      broadcastRefresh("arcade-run-reward");
      return result;
    },
    getGameRuns: function getGameRuns() {
      return protectedRequest("/game-runs");
    },
    consumeAllowance: function consumeAllowance(featureCode, idempotencyKey) {
      var code = String(featureCode || "").trim().toLowerCase();
      if (!/^[a-z0-9][a-z0-9_.-]{0,79}$/.test(code)) return Promise.reject(new Error("Choose a valid feature allowance."));
      return protectedMutation("/usage/consume", { featureCode: code, idempotencyKey: idempotencyKey });
    },
    searchLotteryHistory: function searchLotteryHistory(query) {
      var value = String(query || "").trim().slice(0, 500);
      if (value.length < 3) {
        var queryError = new Error("Enter a lottery-history question of at least 3 characters.");
        queryError.code = "INVALID_AI_QUERY";
        queryError.status = 400;
        return Promise.reject(queryError);
      }
      return protectedRequest("/ai/lottery-history", {
        method: "POST",
        body: JSON.stringify({ query: value }),
      });
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
    refresh: function refresh() { snapshotTime = 0; return getSnapshot({ force: true }); },
  });
})(window);

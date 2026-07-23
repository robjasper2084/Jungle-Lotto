(function () {
  "use strict";

  const BASE = window.__LOTTOMIND_BASE__ || "/lotto%20mind%20refined";
  const CONFIG_URL = `${BASE}/revenuecat-config.json?v=revenuecat-web-20260722`;
  const API_KEY_STORAGE = "lottomind.revenuecat.apiKey";
  const USER_ID_STORAGE = "lottomind.revenuecat.appUserId";
  const MOCK_ACCESS_STORAGE = "lottomind.revenuecat.mockAccess";
  const CONFIG_DEFAULTS = {
    apiKey: "",
    entitlementIds: ["pro", "premium", "vip"],
    offeringId: "",
    packageId: "",
    sdkUrl: "https://cdn.jsdelivr.net/npm/@revenuecat/purchases-js@1.47.3/dist/Purchases.es.js",
  };

  let configPromise = null;
  let purchasesPromise = null;
  let offeringsPromise = null;
  const listeners = new Set();
  const snapshot = {
    status: "idle",
    message: "RevenueCat is waiting for setup.",
    isConfigured: false,
    isEntitled: false,
    entitlementIds: CONFIG_DEFAULTS.entitlementIds,
    priceLabel: "",
    packageLabel: "",
    appUserId: "",
    error: "",
  };

  function emit(next = {}) {
    Object.assign(snapshot, next);
    listeners.forEach((listener) => {
      try {
        listener({ ...snapshot });
      } catch {
        // A subscriber should not break checkout state delivery.
      }
    });
    return { ...snapshot };
  }

  function normalizeConfig(raw = {}) {
    const merged = { ...CONFIG_DEFAULTS, ...raw };
    if (typeof merged.entitlementIds === "string") {
      merged.entitlementIds = merged.entitlementIds.split(",").map((item) => item.trim()).filter(Boolean);
    }
    if (!Array.isArray(merged.entitlementIds) || merged.entitlementIds.length === 0) {
      merged.entitlementIds = CONFIG_DEFAULTS.entitlementIds;
    }
    merged.apiKey = String(merged.apiKey || "").trim();
    merged.offeringId = String(merged.offeringId || "").trim();
    merged.packageId = String(merged.packageId || "").trim();
    merged.sdkUrl = String(merged.sdkUrl || CONFIG_DEFAULTS.sdkUrl).trim();
    return merged;
  }

  async function loadJsonConfig() {
    try {
      const response = await fetch(CONFIG_URL, { cache: "no-store" });
      if (!response.ok) return {};
      return await response.json();
    } catch {
      return {};
    }
  }

  async function getConfig() {
    if (!configPromise) {
      configPromise = (async () => {
        const params = new URLSearchParams(window.location.search);
        const queryKey = params.get("rc_api_key");
        if (queryKey) localStorage.setItem(API_KEY_STORAGE, queryKey.trim());
        const storedKey = localStorage.getItem(API_KEY_STORAGE) || "";
        const jsonConfig = await loadJsonConfig();
        const windowConfig = window.LOTTOMIND_REVENUECAT_CONFIG || {};
        return normalizeConfig({
          ...jsonConfig,
          ...windowConfig,
          ...(storedKey ? { apiKey: storedKey } : {}),
          ...(queryKey ? { apiKey: queryKey } : {}),
          mockMode: params.has("rc_mock") || windowConfig.mockMode === true || jsonConfig.mockMode === true,
        });
      })();
    }
    return configPromise;
  }

  function hasValidApiKey(config) {
    return /^rcb(_sb)?_/i.test(config.apiKey);
  }

  function isMockConfigured(config) {
    return Boolean(config.mockMode);
  }

  function activeEntitlement(customerInfo, entitlementIds) {
    const active = customerInfo?.entitlements?.active || {};
    return entitlementIds.find((id) => Boolean(active[id])) || "";
  }

  function getProductFromPackage(rcPackage) {
    return rcPackage?.webBillingProduct || rcPackage?.product || {};
  }

  function packagePriceLabel(rcPackage) {
    const product = getProductFromPackage(rcPackage);
    return product.price?.formatted
      || product.currentPrice?.formattedPrice
      || product.displayPrice
      || product.priceString
      || product.price?.amount
      || "";
  }

  function packageTitle(rcPackage) {
    const product = getProductFromPackage(rcPackage);
    return product.title
      || product.name
      || rcPackage?.identifier
      || rcPackage?.packageType
      || "RevenueCat package";
  }

  async function loadPurchasesModule(config) {
    const module = await import(config.sdkUrl);
    return module.Purchases || module.default?.Purchases || module.default || window.Purchases?.Purchases || window.Purchases;
  }

  function storedAnonymousId(Purchases) {
    const existing = localStorage.getItem(USER_ID_STORAGE);
    if (existing) return existing;
    const generated = Purchases.generateRevenueCatAnonymousAppUserId
      ? Purchases.generateRevenueCatAnonymousAppUserId()
      : `lottomind_${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)}`;
    localStorage.setItem(USER_ID_STORAGE, generated);
    return generated;
  }

  async function configurePurchases() {
    const config = await getConfig();
    emit({ entitlementIds: config.entitlementIds });

    if (isMockConfigured(config)) {
      const isEntitled = localStorage.getItem(MOCK_ACCESS_STORAGE) === "true";
      return emit({
        status: isEntitled ? "active" : "ready",
        message: isEntitled ? "RevenueCat mock entitlement is active." : "RevenueCat mock checkout is ready for local QA.",
        isConfigured: true,
        isEntitled,
        priceLabel: "Mock Pro",
        packageLabel: "QA package",
        appUserId: "mock-user",
      });
    }

    if (!hasValidApiKey(config)) {
      return emit({
        status: "setup-required",
        message: "Add a RevenueCat Web Billing public API key in revenuecat-config.json.",
        isConfigured: false,
        isEntitled: false,
      });
    }

    if (!purchasesPromise) {
      purchasesPromise = (async () => {
        emit({ status: "loading", message: "Connecting to RevenueCat...", isConfigured: false });
        const Purchases = await loadPurchasesModule(config);
        const appUserId = storedAnonymousId(Purchases);
        const purchases = Purchases.isConfigured?.()
          ? Purchases.getSharedInstance()
          : Purchases.configure({ apiKey: config.apiKey, appUserId });
        emit({ isConfigured: true, appUserId, message: "RevenueCat connected." });
        return purchases;
      })();
    }

    const purchases = await purchasesPromise;
    await refreshCustomerInfo(purchases);
    await loadOfferings(purchases);
    return { ...snapshot };
  }

  async function refreshCustomerInfo(existingPurchases) {
    const config = await getConfig();
    if (isMockConfigured(config)) return configurePurchases();
    const purchases = existingPurchases || await configurePurchases();
    if (!purchases?.getCustomerInfo) return { ...snapshot };
    const customerInfo = await purchases.getCustomerInfo();
    const entitlementId = activeEntitlement(customerInfo, config.entitlementIds);
    return emit({
      status: entitlementId ? "active" : "ready",
      message: entitlementId ? `RevenueCat entitlement active: ${entitlementId}.` : "RevenueCat is ready. No active Pro entitlement yet.",
      isEntitled: Boolean(entitlementId),
      activeEntitlementId: entitlementId,
      customerInfo,
      error: "",
    });
  }

  async function loadOfferings(existingPurchases) {
    const config = await getConfig();
    if (isMockConfigured(config) || !hasValidApiKey(config)) return { ...snapshot };
    const purchases = existingPurchases || await configurePurchases();
    if (!purchases?.getOfferings) return { ...snapshot };
    if (!offeringsPromise) offeringsPromise = purchases.getOfferings();
    const offerings = await offeringsPromise;
    const offering = config.offeringId ? offerings?.all?.[config.offeringId] : offerings?.current;
    const packages = offering?.availablePackages || [];
    const rcPackage = config.packageId
      ? packages.find((pkg) => pkg.identifier === config.packageId || pkg.webBillingProduct?.identifier === config.packageId)
      : (offering?.monthly || packages[0]);
    return emit({
      offerings,
      offering,
      rcPackage,
      packageLabel: rcPackage ? packageTitle(rcPackage) : "",
      priceLabel: rcPackage ? packagePriceLabel(rcPackage) : "",
      message: rcPackage ? snapshot.message : "RevenueCat connected, but no Offering package was returned.",
    });
  }

  async function purchase(options = {}) {
    const config = await getConfig();
    if (isMockConfigured(config)) {
      localStorage.setItem(MOCK_ACCESS_STORAGE, "true");
      return emit({
        status: "active",
        message: "RevenueCat mock purchase complete.",
        isConfigured: true,
        isEntitled: true,
        priceLabel: "Mock Pro",
        packageLabel: "QA package",
        appUserId: "mock-user",
      });
    }

    if (!hasValidApiKey(config)) {
      throw new Error("Add a RevenueCat Web Billing public API key in revenuecat-config.json first.");
    }

    await configurePurchases();
    const purchases = await purchasesPromise;
    const offeringSnapshot = await loadOfferings(purchases);
    const rcPackage = offeringSnapshot.rcPackage || snapshot.rcPackage;
    if (!rcPackage) throw new Error("RevenueCat returned no package. Check your Offering and package configuration.");

    emit({ status: "checkout", message: "Opening RevenueCat checkout..." });
    const purchaseParams = { rcPackage };
    if (options.htmlTarget) purchaseParams.htmlTarget = options.htmlTarget;
    const purchaseResult = await purchases.purchase(purchaseParams);
    const entitlementId = activeEntitlement(purchaseResult?.customerInfo, config.entitlementIds);
    return emit({
      status: entitlementId ? "active" : "ready",
      message: entitlementId ? `RevenueCat entitlement active: ${entitlementId}.` : "Checkout finished. Refreshing RevenueCat entitlement status.",
      isEntitled: Boolean(entitlementId),
      activeEntitlementId: entitlementId,
      redemptionInfo: purchaseResult?.redemptionInfo || null,
      customerInfo: purchaseResult?.customerInfo || null,
    });
  }

  async function init() {
    try {
      return await configurePurchases();
    } catch (error) {
      return emit({
        status: "error",
        message: "RevenueCat could not initialize.",
        error: error?.message || String(error),
        isConfigured: false,
      });
    }
  }

  window.LottoMindRevenueCat = {
    init,
    purchase,
    refresh: () => configurePurchases().then(() => refreshCustomerInfo()),
    getSnapshot: () => ({ ...snapshot }),
    hasActiveEntitlement: () => Boolean(snapshot.isEntitled),
    subscribe(listener) {
      listeners.add(listener);
      listener({ ...snapshot });
      return () => listeners.delete(listener);
    },
  };
})();

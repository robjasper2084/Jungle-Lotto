(function () {
  "use strict";

  const BASE = window.__LOTTOMIND_BASE__ || ".";
  const CONFIG_URL = `${BASE}/revenuecat-native-config.json?v=revenuecat-native-20260726`;
  const listeners = new Set();
  const snapshot = {
    status: "idle",
    message: "Native store billing is waiting for setup.",
    isConfigured: false,
    isEntitled: false,
    entitlementIds: ["pro", "premium", "vip"],
    activeEntitlementId: "",
    priceLabel: "",
    packageLabel: "",
    platform: window.Capacitor?.getPlatform?.() || "",
    error: "",
  };

  let configPromise = null;
  let configurePromise = null;
  let selectedPackage = null;

  function emit(next = {}) {
    Object.assign(snapshot, next);
    listeners.forEach((listener) => {
      try {
        listener({ ...snapshot });
      } catch {
        // Subscriber failures should not interrupt native billing.
      }
    });
    return { ...snapshot };
  }

  async function getConfig() {
    if (!configPromise) {
      configPromise = fetch(CONFIG_URL, { cache: "no-store" })
        .then((response) => response.ok ? response.json() : {})
        .catch(() => ({}))
        .then((raw) => ({
          useTestStore: raw.useTestStore === true,
          testApiKey: String(raw.testApiKey || "").trim(),
          iosApiKey: String(raw.iosApiKey || "").trim(),
          androidApiKey: String(raw.androidApiKey || "").trim(),
          entitlementIds: Array.isArray(raw.entitlementIds) && raw.entitlementIds.length
            ? raw.entitlementIds.map((id) => String(id).trim()).filter(Boolean)
            : ["pro", "premium", "vip"],
          offeringId: String(raw.offeringId || "").trim(),
          packageId: String(raw.packageId || "").trim(),
        }));
    }
    return configPromise;
  }

  function nativePlugins() {
    return {
      purchases: window.Capacitor?.Plugins?.Purchases,
      ui: window.Capacitor?.Plugins?.RevenueCatUI,
    };
  }

  function publicKeyForPlatform(config, platform) {
    if (config.useTestStore) return config.testApiKey;
    if (platform === "ios") return config.iosApiKey;
    if (platform === "android") return config.androidApiKey;
    return "";
  }

  function isPublicSdkKey(key) {
    return /^(appl|goog|test)_[A-Za-z0-9]+$/i.test(key);
  }

  function customerInfoFrom(result) {
    return result?.customerInfo || result || null;
  }

  function activeEntitlement(customerInfo, entitlementIds) {
    const active = customerInfo?.entitlements?.active || {};
    return entitlementIds.find((id) => Boolean(active[id])) || "";
  }

  function packagePrice(rcPackage) {
    const product = rcPackage?.product || {};
    return product.priceString
      || product.price?.formatted
      || product.currentPrice?.formattedPrice
      || product.displayPrice
      || "";
  }

  function packageTitle(rcPackage) {
    return rcPackage?.product?.title
      || rcPackage?.product?.name
      || rcPackage?.identifier
      || "LottoMind Pro";
  }

  async function refreshCustomerInfo(purchases, config) {
    const result = await purchases.getCustomerInfo();
    const customerInfo = customerInfoFrom(result);
    const entitlementId = activeEntitlement(customerInfo, config.entitlementIds);
    return emit({
      status: entitlementId ? "active" : "ready",
      message: entitlementId
        ? `Native RevenueCat entitlement active: ${entitlementId}.`
        : "Native store billing is ready.",
      isConfigured: true,
      isEntitled: Boolean(entitlementId),
      activeEntitlementId: entitlementId,
      customerInfo,
      error: "",
    });
  }

  async function loadOffering(purchases, config) {
    const offerings = await purchases.getOfferings();
    const offering = config.offeringId ? offerings?.all?.[config.offeringId] : offerings?.current;
    const packages = offering?.availablePackages || [];
    selectedPackage = config.packageId
      ? packages.find((item) => item.identifier === config.packageId || item.product?.identifier === config.packageId)
      : (offering?.monthly || packages[0] || null);
    return emit({
      offerings,
      offering,
      rcPackage: selectedPackage,
      packageLabel: selectedPackage ? packageTitle(selectedPackage) : "",
      priceLabel: selectedPackage ? packagePrice(selectedPackage) : "",
      message: selectedPackage
        ? snapshot.message
        : "RevenueCat is connected, but the current Offering has no package.",
    });
  }

  async function configureNative() {
    if (configurePromise) return configurePromise;
    configurePromise = (async () => {
      const platform = window.Capacitor?.getPlatform?.() || "";
      const config = await getConfig();
      const { purchases } = nativePlugins();
      const apiKey = publicKeyForPlatform(config, platform);
      emit({ platform, entitlementIds: config.entitlementIds });

      if (!purchases || !["ios", "android"].includes(platform)) {
        throw new Error("Native RevenueCat billing is available only in the iOS or Android app.");
      }
      if (!isPublicSdkKey(apiKey)) {
        throw new Error(config.useTestStore
          ? "Add the RevenueCat Test Store public SDK key to revenuecat-native-config.json."
          : `Add the RevenueCat ${platform === "ios" ? "Apple" : "Google"} public SDK key to revenuecat-native-config.json.`);
      }

      const configured = await purchases.isConfigured().catch(() => ({ isConfigured: false }));
      if (!configured?.isConfigured) {
        await purchases.configure({ apiKey });
      }
      emit({ isConfigured: true, status: "loading", message: "Connecting to native RevenueCat billing..." });
      await refreshCustomerInfo(purchases, config);
      await loadOffering(purchases, config);
      return { purchases, config };
    })().catch((error) => {
      configurePromise = null;
      emit({
        status: "setup-required",
        message: error?.message || "Native RevenueCat billing could not initialize.",
        error: error?.message || String(error),
        isConfigured: false,
      });
      throw error;
    });
    return configurePromise;
  }

  async function init() {
    try {
      await configureNative();
    } catch {
      // The snapshot already contains a store-safe setup message.
    }
    return { ...snapshot };
  }

  async function refresh() {
    const { purchases, config } = await configureNative();
    await refreshCustomerInfo(purchases, config);
    await loadOffering(purchases, config);
    return { ...snapshot };
  }

  async function purchase() {
    const { purchases, config } = await configureNative();
    const { ui } = nativePlugins();
    emit({ status: "checkout", message: "Opening the native LottoMind Pro paywall..." });

    if (ui?.presentPaywall) {
      await ui.presentPaywall({ displayCloseButton: true });
    } else {
      if (!selectedPackage) await loadOffering(purchases, config);
      if (!selectedPackage) throw new Error("RevenueCat returned no package for the current Offering.");
      await purchases.purchasePackage({ aPackage: selectedPackage });
    }

    await refreshCustomerInfo(purchases, config);
    return { ...snapshot };
  }

  async function restore() {
    const { purchases, config } = await configureNative();
    const result = await purchases.restorePurchases();
    const customerInfo = customerInfoFrom(result);
    const entitlementId = activeEntitlement(customerInfo, config.entitlementIds);
    return emit({
      status: entitlementId ? "active" : "ready",
      message: entitlementId ? "Purchases restored." : "No active store purchase was found.",
      isEntitled: Boolean(entitlementId),
      activeEntitlementId: entitlementId,
      customerInfo,
      error: "",
    });
  }

  async function manage() {
    await configureNative();
    const { ui } = nativePlugins();
    if (!ui?.presentCustomerCenter) {
      throw new Error("RevenueCat Customer Center is unavailable in this native build.");
    }
    await ui.presentCustomerCenter();
    return refresh();
  }

  window.LottoMindRevenueCat = {
    init,
    purchase,
    refresh,
    restore,
    manage,
    restorePurchases: restore,
    manageSubscription: manage,
    presentCustomerCenter: manage,
    getSnapshot: () => ({ ...snapshot }),
    hasActiveEntitlement: () => Boolean(snapshot.isEntitled),
    subscribe(listener) {
      listeners.add(listener);
      listener({ ...snapshot });
      return () => listeners.delete(listener);
    },
  };
})();

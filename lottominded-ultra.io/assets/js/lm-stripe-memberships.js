(() => {
  const status = document.querySelector("[data-stripe-membership-status]");
  const checkoutButtons = [...document.querySelectorAll("[data-stripe-lookup-key]")];
  const portalButton = document.querySelector("[data-stripe-portal]");
  const accountService = window.LottoMindAccountService;
  const REQUEST_TIMEOUT_MS = 12000;
  const LOOKUP_KEY_PATTERN = /^[a-z0-9_]{1,80}$/;
  let configuration = null;

  const setStatus = (message, state = "") => {
    if (!status) return;
    status.textContent = message;
    status.dataset.state = state;
  };

  const billingUrl = (path) => {
    const base = accountService?.getApiBase?.() || "";
    if (base) return `${base}${base.includes("/functions/v1/") ? path : `/api${path}`}`;
    if (window.LOTTOMIND_API_SAME_ORIGIN === true) return `/api${path}`;
    return "";
  };

  const billingError = (code, message, details = {}) => Object.assign(new Error(message), { code, ...details });

  const parseResponse = async (response) => {
    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        throw billingError(
          "BILLING_INVALID_RESPONSE",
          `The billing service returned an unreadable response (HTTP ${response.status}). Try again shortly.`,
          { status: response.status }
        );
      }
    }

    if (!response.ok) {
      const serverError = payload?.error;
      const message = typeof serverError?.message === "string" && serverError.message.trim()
        ? serverError.message.trim()
        : response.status === 401
          ? "Your sign-in could not be verified. Sign in again before checkout."
          : response.status === 429
            ? "Billing is receiving too many requests. Wait a moment and try again."
            : response.status >= 500
              ? "The secure billing service is temporarily unavailable. Try again shortly."
              : `The billing request was not accepted (HTTP ${response.status}).`;
      throw billingError(serverError?.code || "BILLING_REQUEST_FAILED", message, {
        status: response.status,
        payload,
      });
    }

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw billingError(
        "BILLING_INVALID_RESPONSE",
        "The billing service returned an incomplete response. No checkout was opened.",
        { status: response.status }
      );
    }
    return payload;
  };

  const request = async (path, options = {}) => {
    const url = billingUrl(path);
    if (!url) throw billingError("BILLING_NOT_CONFIGURED", "Secure membership checkout is not configured for this static site.");
    const accessToken = await accountService?.getAccessToken?.();
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const { headers: extraHeaders = {}, ...fetchOptions } = options;
    try {
      const response = await fetch(url, {
        ...fetchOptions,
        credentials: "include",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...extraHeaders,
        },
      });
      return await parseResponse(response);
    } catch (error) {
      if (error?.code) throw error;
      if (error?.name === "AbortError") {
        throw billingError("BILLING_TIMEOUT", "The billing service took too long to respond. No checkout was opened.");
      }
      throw billingError(
        "BILLING_NETWORK_ERROR",
        "The secure billing response could not be read. Check your connection, then sign in again if needed.",
        { cause: error }
      );
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const validateConfiguration = (payload) => {
    if (typeof payload.enabled !== "boolean" || !Array.isArray(payload.plans)) {
      throw billingError("BILLING_INVALID_CONFIG", "The billing service returned invalid plan configuration. Checkout remains disabled.");
    }
    const plans = payload.plans.filter((plan) => (
      plan
      && typeof plan === "object"
      && LOOKUP_KEY_PATTERN.test(String(plan.lookupKey || ""))
      && typeof plan.available === "boolean"
    ));
    if (payload.enabled && !plans.some((plan) => plan.available)) {
      throw billingError("BILLING_INVALID_CONFIG", "No validated membership plans are available. Checkout remains disabled.");
    }
    return {
      enabled: payload.enabled,
      plans,
      mode: payload.mode === "test" || payload.mode === "live" ? payload.mode : "unknown",
      message: typeof payload.message === "string" && payload.message.trim()
        ? payload.message.trim()
        : payload.enabled
          ? "Secure Stripe checkout is ready."
          : "Secure checkout is unavailable.",
    };
  };

  const validatedRedirect = (payload, kind) => {
    const expectedHost = kind === "portal" ? "billing.stripe.com" : "checkout.stripe.com";
    let target;
    try {
      target = new URL(String(payload?.url || ""));
    } catch {
      target = null;
    }
    if (!target || target.protocol !== "https:" || target.hostname !== expectedHost) {
      throw billingError(
        "BILLING_INVALID_REDIRECT",
        `The billing service returned an invalid ${kind} link. No redirect was opened.`
      );
    }
    return target.href;
  };

  const signedIn = async () => {
    if (accountService?.getSnapshot) {
      const snapshot = await accountService.getSnapshot();
      return Boolean(snapshot?.authenticated);
    }
    return false;
  };

  const requireAccount = async () => {
    try {
      if (await signedIn()) return true;
    } catch {
      setStatus("LottoMind could not verify your sign-in. Check your connection and sign in again.", "error");
      return false;
    }
    setStatus("Sign in through Collector Access before starting secure checkout.", "auth-required");
    const collector = document.querySelector("#lm-access-hero, .membership-collector-section");
    collector?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => collector?.querySelector("[data-collector-trigger]")?.click(), 450);
    return false;
  };

  const beginCheckout = async (button) => {
    if (!configuration?.enabled) {
      setStatus(configuration?.message || "Secure membership checkout is not configured.", "disabled");
      return;
    }
    if (!(await requireAccount())) return;
    const lookupKey = button.dataset.stripeLookupKey || "";
    if (!LOOKUP_KEY_PATTERN.test(lookupKey)) {
      setStatus("That membership option has an invalid plan identifier.", "error");
      return;
    }
    const configured = configuration.plans?.find((plan) => plan.lookupKey === lookupKey)?.available;
    if (!configured) {
      setStatus("That membership option is not available yet.", "disabled");
      return;
    }
    const original = button.textContent;
    button.disabled = true;
    button.textContent = "Opening Stripe...";
    setStatus("Creating a secure Stripe checkout...", "updating");
    try {
      const payload = await request("/billing/checkout", { method: "POST", body: JSON.stringify({ lookupKey }) });
      window.location.assign(validatedRedirect(payload, "checkout"));
    } catch (error) {
      setStatus(error.message, "error");
      button.disabled = false;
      button.textContent = original;
    }
  };

  checkoutButtons.forEach((button) => button.addEventListener("click", () => beginCheckout(button)));

  portalButton?.addEventListener("click", async () => {
    if (!configuration?.enabled) {
      setStatus(configuration?.message || "Secure billing is not available.", "disabled");
      return;
    }
    if (!(await requireAccount())) return;
    portalButton.disabled = true;
    setStatus("Opening secure billing...", "updating");
    try {
      const payload = await request("/billing/portal", { method: "POST", body: "{}" });
      window.location.assign(validatedRedirect(payload, "portal"));
    } catch (error) {
      setStatus(error.message, "error");
      portalButton.disabled = false;
    }
  });

  const checkoutState = new URLSearchParams(window.location.search).get("checkout");
  const planLabels = {
    free: "Free Signal Pass",
    gold: "Gold membership",
    ultra: "Ultra membership",
    vault: "Vault membership",
    guardian_bundle: "Guardian bundle membership",
  };

  const confirmCheckoutMembership = async () => {
    setStatus("Stripe returned to LottoMind. Verifying membership activation...", "updating");
    if (!accountService?.getSnapshot) {
      setStatus("Stripe returned to LottoMind, but membership activation could not be verified yet.", "pending");
      return;
    }

    let verificationError = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        const snapshot = await accountService.getSnapshot({ force: true });
        const memberships = Array.isArray(snapshot?.memberships) ? snapshot.memberships : [];
        const planCodeFor = (entry) => entry?.kind || entry?.planCode || entry?.plan_code || "";
        const isActive = (entry) => entry?.active === true || ["active", "trialing"].includes(entry?.status);
        const activeMembership = memberships.find((entry) => isActive(entry) && planCodeFor(entry) !== "free")
          || memberships.find(isActive);
        if (activeMembership) {
          const planCode = planCodeFor(activeMembership);
          const label = planLabels[planCode] || "Membership";
          document.body.dataset.membershipPlan = planCode || "active";
          setStatus(`${label} is active. Secure billing is connected.`, "success");
          return;
        }
      } catch (error) {
        verificationError = error;
        // Stripe can redirect before its webhook reaches Supabase. Retry briefly.
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1000));
    }

    setStatus(
      verificationError
        ? "Stripe returned to LottoMind, but the account service could not verify activation. Refresh shortly or contact billing support."
        : "Stripe returned to LottoMind. Membership activation is still processing; refresh shortly to verify it.",
      "pending"
    );
  };

  if (checkoutState === "success") void confirmCheckoutMembership();
  if (checkoutState === "cancelled") setStatus("Checkout was cancelled. No charge was made.", "cancelled");

  const disableBilling = (message) => {
    configuration = { enabled: false, plans: [], message };
    checkoutButtons.forEach((button) => {
      button.disabled = true;
      button.setAttribute("aria-disabled", "true");
    });
    if (portalButton) {
      portalButton.disabled = true;
      portalButton.setAttribute("aria-disabled", "true");
    }
    if (!checkoutState) setStatus(message, "disabled");
  };

  if (!billingUrl("/billing/config")) {
    disableBilling("Membership plans are visible, but secure checkout is not connected on this static site.");
    return;
  }

  request("/billing/config", { method: "GET", headers: {} })
    .then((payload) => {
      configuration = validateConfiguration(payload);
      checkoutButtons.forEach((button) => {
        const available = Boolean(configuration.enabled && configuration.plans.find((plan) => plan.lookupKey === button.dataset.stripeLookupKey)?.available);
        button.disabled = !available;
        button.setAttribute("aria-disabled", String(!available));
      });
      if (portalButton) {
        portalButton.disabled = !configuration.enabled;
        portalButton.setAttribute("aria-disabled", String(!configuration.enabled));
      }
      if (!checkoutState) setStatus(configuration.message, configuration.enabled ? "ready" : "disabled");
    })
    .catch((error) => disableBilling(`${error.message || "The billing service is unavailable."} Membership details remain visible.`));
})();

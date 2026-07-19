(() => {
  const status = document.querySelector("[data-stripe-membership-status]");
  const checkoutButtons = [...document.querySelectorAll("[data-stripe-lookup-key]")];
  const portalButton = document.querySelector("[data-stripe-portal]");
  const accountService = window.LottoMindAccountService;
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

  const request = async (path, options = {}) => {
    const url = billingUrl(path);
    if (!url) throw Object.assign(new Error("Secure membership checkout is not configured for this static site."), { code: "BILLING_NOT_CONFIGURED" });
    const accessToken = await accountService?.getAccessToken?.();
    const response = await fetch(url, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...(options.headers || {}) },
      ...options,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(payload?.error?.message || "The billing request failed."), { status: response.status, payload });
    return payload;
  };

  const signedIn = async () => {
    if (accountService?.getSnapshot) {
      const snapshot = await accountService.getSnapshot();
      return Boolean(snapshot?.authenticated);
    }
    return false;
  };

  const requireAccount = async () => {
    if (await signedIn()) return true;
    setStatus("Sign in through Collector Access before starting secure checkout.", "auth-required");
    const collector = document.querySelector(".membership-collector-section");
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
      window.location.assign(payload.url);
    } catch (error) {
      setStatus(error.message, "error");
      button.disabled = false;
      button.textContent = original;
    }
  };

  checkoutButtons.forEach((button) => button.addEventListener("click", () => beginCheckout(button)));

  portalButton?.addEventListener("click", async () => {
    if (!(await requireAccount())) return;
    portalButton.disabled = true;
    setStatus("Opening secure billing...", "updating");
    try {
      const payload = await request("/billing/portal", { method: "POST", body: "{}" });
      window.location.assign(payload.url);
    } catch (error) {
      setStatus(error.message, "error");
      portalButton.disabled = false;
    }
  });

  const checkoutState = new URLSearchParams(window.location.search).get("checkout");
  if (checkoutState === "success") setStatus("Checkout completed. Your account will update after payment confirmation.", "success");
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
      configuration = payload;
      checkoutButtons.forEach((button) => {
        const available = Boolean(payload.enabled && payload.plans?.find((plan) => plan.lookupKey === button.dataset.stripeLookupKey)?.available);
        button.disabled = !available;
        button.setAttribute("aria-disabled", String(!available));
      });
      if (portalButton) {
        portalButton.disabled = !payload.enabled;
        portalButton.setAttribute("aria-disabled", String(!payload.enabled));
      }
      if (!checkoutState) setStatus(payload.message, payload.enabled ? "ready" : "disabled");
    })
    .catch(() => disableBilling("The billing service is unavailable. Membership details remain visible."));
})();

(() => {
  "use strict";

  const service = window.LottoMindAccountService;
  const status = document.querySelector("[data-account-status]");
  const signedOut = document.querySelector("[data-account-signed-out]");
  const signedIn = document.querySelector("[data-account-signed-in]");
  const form = document.querySelector("[data-account-form]");
  const registerButton = document.querySelector("[data-account-register]");
  const signOutButton = document.querySelector("[data-account-sign-out]");
  const environment = window.LottoMindEnvironment || { allowAccountWrites: true };
  const isLocalPreview = /^(localhost|127(?:\.\d{1,3}){3}|::1)$/.test(window.location.hostname);

  function setStatus(message) {
    if (status) status.textContent = message;
  }

  function displaySnapshot(snapshot) {
    const authenticated = Boolean(snapshot?.authenticated);
    signedOut.hidden = authenticated;
    signedIn.hidden = !authenticated;
    if (!authenticated) {
      setStatus(snapshot?.offline
        ? "Account verification is offline. Sign-in and account changes are unavailable."
        : "Signed out. Collector Access is ready.");
      return;
    }

    const identity = snapshot.user?.email || snapshot.user?.displayName || snapshot.user?.id || "Signed-in collector";
    const balance = snapshot.wallet?.balance;
    const memberships = Array.isArray(snapshot.memberships) ? snapshot.memberships : [];
    document.querySelector("[data-account-identity]").textContent = identity;
    document.querySelector("[data-account-verification]").textContent = snapshot.offline ? "Cached / read-only" : "Verified online";
    document.querySelector("[data-account-credits]").textContent = Number.isFinite(Number(balance)) ? String(balance) : "Unavailable";
    document.querySelector("[data-account-membership]").textContent = memberships.length
      ? memberships.map((membership) => membership.name || membership.tier || membership.status).filter(Boolean).join(", ")
      : "None active";
    setStatus(snapshot.offline
      ? "Showing cached account data. Verification is unavailable and all account changes are disabled."
      : "Account verified through the connected LottoMind service.");
  }

  async function refresh() {
    if (isLocalPreview) {
      setStatus("Local preview is read-only. Sign-in and account changes are not connected.");
      return;
    }
    if (!service) {
      setStatus("The account service is unavailable. Contact support for account help.");
      return;
    }
    try {
      displaySnapshot(await service.getSnapshot({ force: true }));
    } catch (error) {
      setStatus(error?.message || "Account verification is unavailable.");
    }
  }

  async function submitAccount(mode) {
    if (isLocalPreview || !environment.allowAccountWrites) {
      setStatus("Account changes are disabled in this preview. No request was sent.");
      return;
    }
    if (!form?.reportValidity()) return;
    const payload = Object.fromEntries(new FormData(form));
    setStatus(mode === "register" ? "Creating your account..." : "Signing in...");
    try {
      const result = mode === "register"
        ? await service.register(payload)
        : await service.signIn(payload);
      displaySnapshot(result?.snapshot || await service.getSnapshot({ force: true }));
      form.reset();
    } catch (error) {
      setStatus(error?.message || "Account access could not be completed.");
    }
  }

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitAccount("sign-in");
  });
  registerButton?.addEventListener("click", () => void submitAccount("register"));
  signOutButton?.addEventListener("click", async () => {
    if (isLocalPreview || !environment.allowAccountWrites) {
      setStatus("Account changes are disabled in this preview.");
      return;
    }
    setStatus("Signing out...");
    try {
      displaySnapshot(await service.signOut());
    } catch (error) {
      setStatus(error?.message || "Sign out could not be completed.");
    }
  });
  service?.subscribeToWallet?.(displaySnapshot);
  void refresh();
})();

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
  const localKeys = Object.freeze({
    savedSets: "lottomind.oracle.real.history.v1",
    dreams: "lottomind.oracle.real.dreams.v1",
    recentGames: "lottomindArcadeRecent",
  });

  function setText(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  }

  function readLocalArray(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.valueOf())
      ? ""
      : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
  }

  function renderList(selector, entries, emptyMessage) {
    const list = document.querySelector(selector);
    if (!list) return;
    list.replaceChildren();
    if (!entries.length) {
      const empty = document.createElement("li");
      empty.className = "lm-dashboard-empty";
      empty.textContent = emptyMessage;
      list.append(empty);
      return;
    }
    entries.slice(0, 3).forEach((entry) => {
      const item = document.createElement("li");
      const primary = document.createElement(entry.href ? "a" : "span");
      primary.textContent = entry.label;
      if (entry.href) primary.href = entry.href;
      item.append(primary);
      if (entry.meta) {
        const meta = document.createElement("small");
        meta.textContent = entry.meta;
        item.append(meta);
      }
      list.append(item);
    });
  }

  function renderLocalActivity() {
    const savedSets = readLocalArray(localKeys.savedSets).filter((item) => item && typeof item === "object");
    const dreams = readLocalArray(localKeys.dreams).filter((item) => item && typeof item === "object");
    const recentIds = readLocalArray(localKeys.recentGames)
      .map((item) => typeof item === "string" ? item : String(item?.id || item?.gameId || ""))
      .filter(Boolean);
    const games = Array.isArray(window.LottoMindArcadeGames) ? window.LottoMindArcadeGames : [];
    const gameById = new Map(games.map((game) => [String(game.id), game]));

    setText("[data-dashboard-saved-count]", `${savedSets.length} saved`);
    renderList("[data-dashboard-saved-list]", savedSets.map((item) => ({
      label: item.gameName || item.title || "Saved number set",
      meta: [Array.isArray(item.numbers) ? item.numbers.join(" - ") : "", formatDate(item.createdAt || item.savedAt)].filter(Boolean).join(" / "),
    })), "No saved sets found on this device.");

    setText("[data-dashboard-dream-count]", `${dreams.length} saved`);
    renderList("[data-dashboard-dream-list]", dreams.map((item) => ({
      label: item.title || "Dream reading",
      meta: [item.tone || item.gameName || "", formatDate(item.createdAt || item.savedAt)].filter(Boolean).join(" / "),
    })), "No dream readings found on this device.");

    const recentGames = recentIds.map((id) => gameById.get(id)).filter(Boolean);
    setText("[data-dashboard-recent-count]", `${recentGames.length} recent`);
    renderList("[data-dashboard-recent-list]", recentGames.map((game) => ({
      label: game.title,
      meta: game.status || "Arcade route",
      href: game.path,
    })), "No recent arcade activity found on this device.");
  }

  function planName(membership) {
    const raw = membership?.name || membership?.tier || membership?.planCode || membership?.plan_code || "Membership";
    return String(raw)
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function displayDashboard(snapshot) {
    const authenticated = Boolean(snapshot?.authenticated);
    if (!authenticated) {
      setText("[data-dashboard-plan-name]", "Sign in to verify");
      setText("[data-dashboard-plan-detail]", "No membership record is shown while signed out.");
      setText("[data-dashboard-credit-balance]", "--");
      setText("[data-dashboard-credit-detail]", "Sign in to view the connected wallet balance.");
      setText("[data-dashboard-collector-state]", "Sign in to verify");
      setText("[data-dashboard-collector-detail]", "Collector status is never inferred from local activity.");
      return;
    }

    const memberships = Array.isArray(snapshot.memberships) ? snapshot.memberships : [];
    const currentMembership = memberships.find((membership) => ["active", "trialing"].includes(String(membership?.status).toLowerCase())) || memberships[0];
    const planDetail = currentMembership
      ? [currentMembership.status, formatDate(currentMembership.currentPeriodEnd || currentMembership.current_period_end)].filter(Boolean).join(" / ")
      : "No active membership returned by the account service.";
    const balance = Number(snapshot.wallet?.balance);
    const collector = snapshot.collector || {};

    setText("[data-dashboard-plan-name]", currentMembership ? planName(currentMembership) : "No active plan");
    setText("[data-dashboard-plan-detail]", snapshot.offline ? `${planDetail} Cached read-only snapshot.` : planDetail);
    setText("[data-dashboard-credit-balance]", Number.isFinite(balance) ? String(balance) : "Unavailable");
    setText("[data-dashboard-credit-detail]", snapshot.offline ? "Cached read-only wallet snapshot." : "Verified through the connected LottoMind wallet.");
    setText("[data-dashboard-collector-state]", collector.redeemed ? "Guardian linked" : "Not linked");
    setText("[data-dashboard-collector-detail]", collector.redeemed
      ? ["Verified by the account service", formatDate(collector.complimentaryUntil)].filter(Boolean).join(" / ")
      : "No redeemed Guardian was returned by the account service.");
  }

  function setStatus(message) {
    if (status) status.textContent = message;
  }

  function displaySnapshot(snapshot) {
    const authenticated = Boolean(snapshot?.authenticated);
    displayDashboard(snapshot);
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
  renderLocalActivity();
  window.addEventListener("storage", (event) => {
    if (Object.values(localKeys).includes(event.key)) renderLocalActivity();
  });
  void refresh();
})();

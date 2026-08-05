(function () {
  "use strict";

  const dialog = document.querySelector("[data-first-use-dialog]");
  if (!dialog) return;

  const workspace = dialog.querySelector("[data-first-use-workspace]");
  const result = dialog.querySelector("[data-first-use-result]");
  const title = dialog.querySelector("[data-first-use-title]");
  const saveButton = dialog.querySelector("[data-first-use-save]");
  const summary = document.querySelector("[data-first-use-summary]");
  const storageKey = "lottomind.guest.first-use.v1";
  const usageKey = "lottomind.guest.usage.v1";
  const limits = { numbers: 10, dream: 3, beat: 3, game: 2, saves: 5 };
  let activeChoice = "";
  let pendingResult = null;

  const readJson = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || "null") || fallback; } catch (_) { return fallback; }
  };
  const readUsage = () => ({ numbers: 0, dream: 0, beat: 0, game: 0, saves: 0, ...readJson(usageKey, {}) });
  const writeUsage = (usage) => localStorage.setItem(usageKey, JSON.stringify(usage));
  const escapeHtml = (value) => String(value).replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character]));
  const secureNumber = (max) => {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return (values[0] % max) + 1;
  };
  const makeNumberSet = () => {
    const values = new Set();
    while (values.size < 6) values.add(secureNumber(69));
    return [...values].sort((a, b) => a - b);
  };
  const canUse = (choice) => readUsage()[choice] < limits[choice];
  const setResult = (heading, body, detail) => {
    pendingResult = { type: activeChoice, heading, body, detail, createdAt: new Date().toISOString() };
    result.hidden = false;
    result.innerHTML = `<span>Result ready</span><h3>${escapeHtml(heading)}</h3><p>${escapeHtml(body)}</p><strong>${escapeHtml(detail)}</strong>`;
    saveButton.disabled = false;
  };
  const consume = () => {
    const usage = readUsage();
    usage[activeChoice] += 1;
    writeUsage(usage);
  };

  const render = (choice) => {
    activeChoice = choice;
    pendingResult = null;
    result.hidden = true;
    result.innerHTML = "";
    saveButton.disabled = true;
    const remaining = Math.max(0, limits[choice] - readUsage()[choice]);
    const labels = { numbers: "Explore My Numbers", dream: "Interpret a Dream", beat: "Create From a Beat", game: "Play a Game" };
    title.textContent = labels[choice];
    if (!remaining) {
      workspace.innerHTML = `<p class="lm-first-use-dialog__notice">You used the free ${escapeHtml(labels[choice])} allowance on this device. Your saved result remains available below.</p>`;
      return;
    }
    if (choice === "numbers") workspace.innerHTML = `<p>Create an entertainment-only set. It does not predict or improve lottery outcomes.</p><button type="button" data-first-use-action>Generate my set</button><small>${remaining} of ${limits.numbers} free sets remaining.</small>`;
    if (choice === "dream") workspace.innerHTML = `<label>What do you remember?<textarea data-first-use-input rows="4" maxlength="280" placeholder="A place, feeling, person, color, or change..."></textarea></label><button type="button" data-first-use-action>Create reflection card</button><small>${remaining} of ${limits.dream} free entries remaining. Creative reflection only.</small>`;
    if (choice === "beat") workspace.innerHTML = `<label>Describe the beat or mood<input data-first-use-input maxlength="120" placeholder="Warm Detroit drums, hopeful midnight drive..."></label><button type="button" data-first-use-action>Build creative prompt</button><small>${remaining} of ${limits.beat} free generations remaining.</small>`;
    if (choice === "game") workspace.innerHTML = `<p>Lock all three signals to complete this guest mission.</p><div class="lm-first-use-mission" data-first-use-mission><button type="button">Dust</button><button type="button">Ignition</button><button type="button">Worlds</button></div><small>${remaining} of ${limits.game} free missions remaining. No verified LottoCredits are issued in guest mode.</small>`;

    workspace.querySelector("[data-first-use-action]")?.addEventListener("click", () => {
      if (!canUse(choice)) return render(choice);
      if (choice === "numbers") {
        const numbers = makeNumberSet();
        consume();
        setResult("Creative number set", "A locally generated entertainment-only set.", numbers.map((number) => String(number).padStart(2, "0")).join(" - "));
      } else {
        const input = workspace.querySelector("[data-first-use-input]")?.value.trim();
        if (!input) return workspace.querySelector("[data-first-use-input]")?.focus();
        consume();
        if (choice === "dream") setResult("Dream reflection card", "Notice the strongest feeling, the symbol that changed, and one question the dream leaves with you.", input);
        if (choice === "beat") setResult("Beat-seeded creative prompt", `Build a 20-second visual around ${input}. Begin close, reveal the wider world, then end on one memorable signal.`, "Creative prompt / locally generated");
      }
    });

    if (choice === "game") {
      const mission = workspace.querySelector("[data-first-use-mission]");
      mission.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => {
        button.classList.add("is-locked");
        button.disabled = true;
        if (mission.querySelectorAll(".is-locked").length === 3 && canUse(choice)) {
          consume();
          setResult("Signal-lock mission complete", "Three signals secured in guest mode.", `Local demo receipt LM-${Date.now().toString(36).toUpperCase()} / 0 verified credits`);
        }
      }));
    }
  };

  document.querySelectorAll("[data-first-use-choice]").forEach((button) => button.addEventListener("click", () => {
    render(button.dataset.firstUseChoice);
    dialog.showModal();
  }));

  saveButton.addEventListener("click", () => {
    if (!pendingResult) return;
    const usage = readUsage();
    if (usage.saves >= limits.saves) {
      summary.textContent = "Five guest items are already saved on this device. Create an account to keep more connected results.";
      dialog.close();
      return;
    }
    const saved = readJson(storageKey, []);
    saved.unshift(pendingResult);
    localStorage.setItem(storageKey, JSON.stringify(saved.slice(0, limits.saves)));
    usage.saves = Math.min(limits.saves, usage.saves + 1);
    writeUsage(usage);
    summary.textContent = `${pendingResult.heading} saved on this device. Create an account to keep results connected across sessions.`;
    dialog.close();
  });

  const saved = readJson(storageKey, []);
  if (saved.length) summary.textContent = `${saved.length} guest ${saved.length === 1 ? "result" : "results"} saved on this device. Create an account to keep them connected.`;
}());

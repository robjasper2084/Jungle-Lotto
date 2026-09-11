(function systemsUiFactory(root) {
  "use strict";
  const ui = { results: {}, filters: "" };
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const registry = () => root.LottoMindSystemsRegistry;
  const store = () => root.LottoMindSystemsStore;
  const core = () => root.LottoMindSystems;
  const toolFor = (route) => registry()?.byRoute?.[route];
  const sourceLabel = (value) => ({ live: "Live API", cached: "Cached", manual: "Manual", import: "Imported", offline: "Offline formula", "no-history": "No history" }[value] || String(value || "Offline formula"));

  function field(label, name, value, options) {
    const settings = { type: "text", hint: "", ...options };
    const attrs = [
      `name="${escapeHtml(name)}"`,
      `type="${escapeHtml(settings.type)}"`,
      settings.min !== undefined ? `min="${escapeHtml(settings.min)}"` : "",
      settings.max !== undefined ? `max="${escapeHtml(settings.max)}"` : "",
      settings.step !== undefined ? `step="${escapeHtml(settings.step)}"` : "",
      settings.maxlength ? `maxlength="${escapeHtml(settings.maxlength)}"` : "",
    ].filter(Boolean).join(" ");
    return `<label class="systems-field"><span>${escapeHtml(label)}</span><input ${attrs} value="${escapeHtml(value)}" />${settings.hint ? `<small>${escapeHtml(settings.hint)}</small>` : ""}</label>`;
  }

  function textarea(label, name, value, hint) {
    return `<label class="systems-field systems-field-wide"><span>${escapeHtml(label)}</span><textarea name="${escapeHtml(name)}" rows="6" spellcheck="false">${escapeHtml(value)}</textarea>${hint ? `<small>${escapeHtml(hint)}</small>` : ""}</label>`;
  }

  function selectField(label, name, value, values) {
    return `<label class="systems-field"><span>${escapeHtml(label)}</span><select name="${escapeHtml(name)}">${values.map(([key, text]) => `<option value="${escapeHtml(key)}" ${String(value) === String(key) ? "selected" : ""}>${escapeHtml(text)}</option>`).join("")}</select></label>`;
  }

  function checkField(label, name, checked) {
    return `<label class="systems-check"><input name="${escapeHtml(name)}" type="checkbox" value="true" ${checked ? "checked" : ""} /><span>${escapeHtml(label)}</span></label>`;
  }

  function defaults(route) {
    const date = new Date();
    const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const sharedHistory3 = "194\n038\n842\n339\n173\n804\n268\n715\n049\n622";
    const sharedHistory4 = "1940\n0382\n8426\n3391\n1738\n8042\n2681\n7150\n0497\n6225";
    const values = {
      dateMath: { date: today },
      monthlyPlaylist: { month: String(date.getMonth() + 1), year: String(date.getFullYear()), history: `${sharedHistory3}\n${sharedHistory4}` },
      pairCluster3: { history: sharedHistory3, mode: "unordered", includeDoublePairs: true },
      pairCluster4: { history: sharedHistory4, mode: "unordered", includeDoublePairs: true, cap: "60" },
      dailyRundown: { digits: "194" },
      top10Generator: { digits: "194", history: sharedHistory3 },
      digitWheeler: { digits: "329069", length: "3", straight: false, cap: "120", required: "", excluded: "" },
      vtracPredictor: { digits: "842", length: "3", cap: "80", includeMirrors: true, history: "" },
    };
    return { ...(values[route] || {}), ...(store()?.getState()?.inputs?.[route] || {}) };
  }

  function toolFields(route, values) {
    if (route === "dateMath") return field("Calendar date", "date", values.date, { type: "date" });
    if (route === "monthlyPlaylist") return `${field("Month", "month", values.month, { type: "number", min: 1, max: 12 })}${field("Year", "year", values.year, { type: "number", min: 2000, max: 2200 })}${textarea("Optional Pick 3 / Pick 4 history", "history", values.history, "One exact 3- or 4-digit draw per line. Leading zeroes stay intact.")}`;
    if (route === "pairCluster3" || route === "pairCluster4") return `${selectField("Pair mode", "mode", values.mode, [["unordered", "Unordered pairs"], ["position", "Position pairs"], ["chain", "Chain view"]])}${route === "pairCluster4" ? field("Wheel cap", "cap", values.cap, { type: "number", min: 1, max: 500 }) : ""}${checkField("Include double pairs", "includeDoublePairs", values.includeDoublePairs !== false)}${textarea(`${route === "pairCluster3" ? "Pick 3" : "Pick 4"} draw history`, "history", values.history, "One exact draw per line; invalid tokens are reported, never guessed.")}`;
    if (route === "dailyRundown") return field("Pick 3 or Pick 4 digits", "digits", values.digits, { maxlength: 4, hint: "Uses the existing LottoMind mirror, root, rotation, and box rules." });
    if (route === "top10Generator") return `${field("Seed digits", "digits", values.digits, { maxlength: 4 })}${textarea("Optional history", "history", values.history, "History can add up to five transparent score points per digit.")}`;
    if (route === "digitWheeler") return `${field("Digit pool", "digits", values.digits, { maxlength: 10, hint: "First occurrence order is preserved; actual repeated digits enable repeat combinations." })}${selectField("Pick length", "length", values.length, [["3", "Pick 3"], ["4", "Pick 4"]])}${field("Result cap", "cap", values.cap, { type: "number", min: 1, max: 1000 })}${field("Required digits", "required", values.required || "", { maxlength: 10 })}${field("Excluded digits", "excluded", values.excluded || "", { maxlength: 10 })}${checkField("Expand to straight permutations", "straight", values.straight === true || values.straight === "true")}`;
    if (route === "vtracPredictor") return `${field("Seed digits", "digits", values.digits, { maxlength: 4 })}${selectField("Pick length", "length", values.length, [["3", "Pick 3"], ["4", "Pick 4"]])}${field("Result cap", "cap", values.cap, { type: "number", min: 1, max: 500 })}${checkField("Include mirror families", "includeMirrors", values.includeMirrors !== false && values.includeMirrors !== "false")}${textarea("Optional matching history", "history", values.history || "", "Leave blank for deterministic offline ranking.")}`;
    return "";
  }

  function collectInputs(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    form.querySelectorAll('input[type="checkbox"]').forEach((input) => { data[input.name] = input.checked; });
    return data;
  }

  function run(route, inputs) {
    const engine = core();
    if (route === "dateMath") return engine.dateMath(inputs.date);
    if (route === "monthlyPlaylist") return engine.monthlyPlaylist(inputs);
    if (route === "pairCluster3") return engine.pairCluster3(inputs);
    if (route === "pairCluster4") return engine.pairCluster4(inputs);
    if (route === "dailyRundown") return engine.easyDailyRundown(inputs.digits);
    if (route === "top10Generator") return engine.top10Generator(inputs);
    if (route === "digitWheeler") return engine.digitWheeler(inputs);
    if (route === "vtracPredictor") return engine.vtracPredictor(inputs);
    throw new Error("Unknown Systems Lab route");
  }

  function chips(values, className) {
    return `<div class="systems-chip-row ${className || ""}">${(values || []).map((value) => `<span>${escapeHtml(typeof value === "object" ? value.pick : value)}</span>`).join("")}</div>`;
  }

  function metric(label, value) {
    return `<div class="systems-metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
  }

  function pairTable(rows) {
    return `<div class="systems-table-wrap"><table class="systems-table"><thead><tr><th>Pair</th><th>Score</th><th>Raw</th><th>Freq</th><th>Gap</th><th>5 / 10</th><th>Heat</th></tr></thead><tbody>${rows.map((row) => `<tr><td><strong>${escapeHtml(row.pair)}</strong></td><td>${escapeHtml(row.score)}</td><td>${escapeHtml(row.raw)}</td><td>${escapeHtml(row.frequencyPct)}%</td><td>${escapeHtml(row.gap)}</td><td>${escapeHtml(row.recent5)} / ${escapeHtml(row.recent10)}</td><td>${escapeHtml(row.heat)}</td></tr>`).join("")}</tbody></table></div>`;
  }

  function resultHtml(route, result) {
    if (!result) return `<div class="systems-empty"><strong>Console ready</strong><p>Set the controls, then run the formula. Results stay local unless you export them.</p></div>`;
    if (route === "dateMath") return `<div class="systems-metrics">${metric("Day root", result.dayRoot)}${metric("Month root", result.monthRoot)}${metric("Month + day", result.monthDayTotal)}${metric("Tail", result.monthDayTail)}${metric("Full-date root", result.fullDateRoot)}</div><h3>Seed lane</h3>${chips(result.seedDigits)}<div class="systems-dual">${metric("Pick 3", result.pick3)}${metric("Pick 4", result.pick4)}</div>`;
    if (route === "monthlyPlaylist") return `<div class="systems-metrics">${metric("History source", sourceLabel(result.source))}${metric("Top six", result.top6.join(" · "))}${metric("Rejected", result.rejected.length)}</div><h3>20 singles</h3>${chips(result.singles)}<h3>12 doubles</h3>${chips(result.doubles)}<h3>4 triples</h3>${chips(result.triples)}`;
    if (route === "pairCluster3" || route === "pairCluster4") return `<div class="systems-metrics">${metric("Draws", result.drawCount)}${metric("Source", sourceLabel(result.source))}${metric("Mode", result.mode)}${metric("Selected", result.selected.map((row) => row.pair).join(" · "))}${metric("Backups", result.backups.map((row) => row.pair).join(" · "))}</div>${pairTable(result.rows)}<h3>${route === "pairCluster4" ? "Capped pair wheel" : "Candidate lane"}</h3>${chips(route === "pairCluster4" ? result.wheel : result.candidates)}${route === "pairCluster4" ? `<p class="systems-callout">Generated ${result.wheel.length} combinations. Cap ${result.cap}${result.capped ? " reached" : " not reached"}. Credit cost: 0.</p>` : ""}`;
    if (route === "dailyRundown") return `<div class="systems-metrics">${metric("Input", result.input)}${metric("Sum", result.sum)}${metric("Root", result.root)}${metric("Plays", result.picks.length)}</div><div class="systems-result-list">${result.picks.map((item, index) => `<div><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(item.pick)}</strong><small>${escapeHtml(item.formula)} · ${escapeHtml(item.boxWays)} box ways</small></div>`).join("")}</div>`;
    if (route === "top10Generator") return `<div class="systems-metrics">${metric("Top five", result.top5.join(" · "))}${metric("Source", sourceLabel(result.source))}</div><h3>10 singles</h3>${chips(result.singles)}<h3>10 main doubles</h3>${chips(result.mainDoubles)}<h3>10 sister doubles</h3>${chips(result.sisterDoubles)}`;
    if (route === "digitWheeler") return `<div class="systems-metrics">${metric("Unique digits", result.uniqueDigits.join(" · "))}${metric("Repeated", result.repeatedDigits.join(" · ") || "None")}${metric("Base C(n,k)", result.baseCombinationCount)}${metric("Repeat combos", result.repeatCombinationCount)}${metric("Before cap", result.totalBeforeCap)}${metric("Output", result.combinations.length)}</div>${chips(result.combinations, "systems-wheel-chips")}<p class="systems-callout">Cap ${result.cap}${result.capped ? " applied" : " not reached"}. Credit cost: 0.</p>`;
    if (route === "vtracPredictor") return `<div class="systems-metrics">${metric("Input", result.input)}${metric("V-Trac", result.vtrac.join("-"))}${metric("Source", sourceLabel(result.source))}${metric("Candidates", result.candidateCount)}</div><h3>Nearby patterns</h3>${chips(result.nearby)}<h3>Expanded family</h3>${chips(result.candidates.map((item) => `${item.pick} · ${item.score}`), "systems-wheel-chips")}<p class="systems-callout">Showing ${result.candidates.length} of ${result.candidateCount}. Deterministic offline ranking is used when no history is supplied.</p>`;
    return `<pre>${escapeHtml(JSON.stringify(result, null, 2))}</pre>`;
  }

  function renderLab() {
    const state = store()?.getState() || { favorites: [], recents: [], savedReports: [] };
    const tools = registry()?.tools || [];
    const groups = Array.from(new Set(tools.map((tool) => tool.group)));
    const favoriteTools = state.favorites.map(toolFor).filter(Boolean);
    const recentTools = state.recents.map(toolFor).filter(Boolean);
    const card = (tool) => `<article class="systems-tool-card" data-system-card data-system-search="${escapeHtml(`${tool.title} ${tool.short} ${tool.description} ${tool.tags}`.toLowerCase())}"><button class="systems-favorite ${state.favorites.includes(tool.route) ? "active" : ""}" type="button" data-action="systems-favorite" data-system-route="${tool.route}" aria-label="${state.favorites.includes(tool.route) ? "Remove from favorites" : "Add to favorites"}" aria-pressed="${state.favorites.includes(tool.route)}">★</button><button class="systems-card-main" type="button" data-route="${tool.route}"><span>${escapeHtml(tool.short)}</span><strong>${escapeHtml(tool.title)}</strong><small>${escapeHtml(tool.description)}</small><em>Formula ${escapeHtml(tool.version)}</em></button></article>`;
    return `<section class="screen systems-screen systems-lab-screen">
      <div class="panel art-panel systems-hero"><div><span class="eyebrow">LottoMind Power Tools</span><h1>Pick 3 + Pick 4 Systems Lab</h1><p>Eight deterministic, transparent systems for daily digits, pairs, wheels, V-Trac families, and saved reports.</p><div class="systems-status-strip"><span>Local-first</span><span>0-credit tools</span><span>No outcome guarantees</span></div></div><div class="systems-orb" aria-hidden="true"><i></i><b>8</b><span>systems</span></div></div>
      <div class="panel systems-filter-panel"><label class="search-pill slim"><span>Find</span><input type="search" data-system-filter placeholder="Search date, pair, wheel, V-Trac..." value="${escapeHtml(ui.filters)}" /></label><div class="systems-filter-actions"><button class="ghost-btn" data-route="dailyTools">Open Daily 3 / 4</button><button class="ghost-btn" data-route="history">History Vault</button></div></div>
      ${favoriteTools.length ? `<div class="panel systems-section"><div class="section-head"><div><span class="eyebrow">Pinned</span><h2>Favorites</h2></div><span>${favoriteTools.length}</span></div><div class="systems-grid">${favoriteTools.map(card).join("")}</div></div>` : ""}
      ${groups.map((group) => `<div class="panel systems-section"><div class="section-head"><div><span class="eyebrow">Systems deck</span><h2>${escapeHtml(group)}</h2></div><span>${tools.filter((tool) => tool.group === group).length}</span></div><div class="systems-grid">${tools.filter((tool) => tool.group === group).map(card).join("")}</div></div>`).join("")}
      <div class="systems-lab-columns">${recentTools.length ? `<div class="panel systems-mini-panel"><h2>Recent systems</h2>${recentTools.map((tool) => `<button data-route="${tool.route}"><strong>${escapeHtml(tool.title)}</strong><small>${escapeHtml(tool.short)}</small></button>`).join("")}</div>` : ""}<div class="panel systems-mini-panel"><h2>Saved reports</h2>${state.savedReports.length ? state.savedReports.slice(0, 5).map((report) => `<button data-route="history"><strong>${escapeHtml(report.title)}</strong><small>${escapeHtml(new Date(report.createdAt).toLocaleString())}</small></button>`).join("") : `<p>No Systems Lab reports saved yet.</p>`}</div><div class="panel systems-mini-panel"><h2>Draw-time help</h2><p>Draw times and game rules vary by state. Confirm the current schedule with the official lottery before playing.</p><button data-route="help"><strong>How To Use</strong><small>Open responsible-play and app help</small></button></div></div>
      <div class="panel disclaimer-card systems-responsible"><strong>Responsible Play</strong><p>These systems organize number ideas for entertainment and education. Lottery drawings are random; no formula predicts or guarantees a winning result. Set a budget and verify tickets with the official lottery.</p></div>
    </section>`;
  }

  function renderTool(route) {
    const tool = toolFor(route);
    if (!tool || !core()) return `<section class="screen"><div class="panel"><h1>Loading Systems Lab…</h1></div></section>`;
    const values = ui.results[route]?.inputs || defaults(route);
    const result = ui.results[route]?.result || null;
    const favorite = store()?.getState()?.favorites?.includes(route);
    return `<section class="screen systems-screen systems-tool-screen">
      <div class="panel art-panel systems-tool-hero"><div><span class="eyebrow">${escapeHtml(tool.group)} · Formula ${escapeHtml(tool.version)}</span><h1>${escapeHtml(tool.title)}</h1><p>${escapeHtml(tool.description)}</p><div class="systems-status-strip"><span>Offline-ready</span><span>0 credits</span><span>Leading zero safe</span></div></div><button class="systems-favorite large ${favorite ? "active" : ""}" type="button" data-action="systems-favorite" data-system-route="${route}" aria-pressed="${Boolean(favorite)}">★<small>${favorite ? "Pinned" : "Pin"}</small></button></div>
      <form class="panel systems-console" data-system-form="${route}"><div class="section-head"><div><span class="eyebrow">Input console</span><h2>Controls</h2></div><span>${escapeHtml(tool.short)}</span></div><div class="systems-fields">${toolFields(route, values)}</div><div class="hero-actions systems-run-actions"><button type="button" class="primary-btn" data-action="systems-run" data-system-route="${route}">Run System</button>${route === "dailyRundown" ? `<button type="button" class="ghost-btn" data-action="systems-quickplay" data-system-route="${route}">Quick Play · Random</button>` : ""}<button type="button" class="ghost-btn" data-action="systems-reset" data-system-route="${route}">Reset</button><button type="button" class="ghost-btn" data-route="systemsLab">All Systems</button></div></form>
      <div class="panel systems-results" aria-live="polite"><div class="section-head"><div><span class="eyebrow">Analysis output</span><h2>${result ? "System Result" : "Ready"}</h2></div><span>${result ? `v${escapeHtml(result.formulaVersion || tool.version)}` : "Waiting"}</span></div>${resultHtml(route, result)}${result ? `<div class="hero-actions systems-output-actions"><button class="primary-btn" data-action="systems-save" data-system-route="${route}">Save Report</button><button class="ghost-btn" data-action="systems-copy" data-system-route="${route}">Copy</button><button class="ghost-btn" data-action="systems-export-json" data-system-route="${route}">JSON</button><button class="ghost-btn" data-action="systems-export-csv" data-system-route="${route}">CSV</button></div>` : ""}</div>
      <div class="panel systems-breakdown"><div><span class="eyebrow">Formula breakdown</span><h2>How this works</h2></div><p>The result is deterministic for the same inputs and formula version. Manual history is parsed as exact 3- or 4-digit tokens; rejected tokens are disclosed and no missing digits are invented.</p><div class="systems-source-legend"><span>Live API</span><span>Cached</span><span>Manual</span><span>Imported</span><span>Offline</span><span>No history</span></div></div>
      <div class="panel disclaimer-card systems-responsible"><strong>Responsible Play</strong><p>Pattern tools do not change random odds and do not guarantee outcomes. Use them for entertainment, organization, and learning; spend only what you can afford.</p></div>
      <div class="panel systems-related"><h2>Related tools</h2><div class="hero-actions"><button class="ghost-btn" data-route="dailyTools">Daily 3 / 4</button><button class="ghost-btn" data-route="sequence">Pattern Scanner</button><button class="ghost-btn" data-route="history">History Vault</button></div></div>
    </section>`;
  }

  function flattenForCsv(result) {
    const rows = [["field", "value"]];
    Object.entries(result || {}).forEach(([key, value]) => {
      if (Array.isArray(value)) value.forEach((item, index) => rows.push([`${key}.${index + 1}`, typeof item === "object" ? JSON.stringify(item) : item]));
      else rows.push([key, typeof value === "object" ? JSON.stringify(value) : value]);
    });
    const safe = (value) => {
      let text = String(value ?? "");
      if (/^[=+\-@]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };
    return rows.map((row) => row.map(safe).join(",")).join("\r\n");
  }

  function download(name, text, type) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function handleAction(action, target, context) {
    if (!String(action).startsWith("systems-")) return false;
    const route = target.getAttribute("data-system-route") || context.state.route;
    const tool = toolFor(route);
    if (action === "systems-favorite") {
      store().toggleFavorite(route);
      context.toast(`${tool?.title || "System"} ${store().getState().favorites.includes(route) ? "pinned" : "unpinned"}`);
      return true;
    }
    if (action === "systems-reset") {
      delete ui.results[route];
      store().saveInputs(route, {});
      context.render();
      return true;
    }
    const form = target.closest("form") || document.querySelector(`[data-system-form="${route}"]`);
    if (action === "systems-quickplay") {
      const input = form?.querySelector('[name="digits"]');
      const length = String(input?.value || "").replace(/\D/g, "").length > 3 ? 4 : 3;
      if (!root.crypto?.getRandomValues || !input) {
        context.toast("Secure random Quick Play is unavailable here");
        return true;
      }
      const random = new Uint8Array(length);
      root.crypto.getRandomValues(random);
      input.value = Array.from(random, (value) => value % 10).join("");
      const inputs = collectInputs(form);
      const result = run(route, inputs);
      ui.results[route] = { inputs, result, createdAt: new Date().toISOString() };
      store().saveInputs(route, inputs);
      store().touchRecent(route);
      context.toast("Cryptographic Quick Play generated");
      return true;
    }
    if (action === "systems-run") {
      const inputs = collectInputs(form);
      try {
        const result = run(route, inputs);
        ui.results[route] = { inputs, result, createdAt: new Date().toISOString() };
        store().saveInputs(route, inputs);
        store().touchRecent(route);
        context.toast(`${tool.title} complete`);
      } catch (error) {
        context.toast(error?.message || "The formula could not run");
      }
      return true;
    }
    const current = ui.results[route];
    if (!current) {
      context.toast("Run the system first");
      return true;
    }
    const payload = { route, title: tool.title, formulaVersion: current.result.formulaVersion || tool.version, source: current.result.source || "offline", inputs: current.inputs, result: current.result, createdAt: current.createdAt };
    if (action === "systems-save") {
      store().saveReport(payload);
      context.toast("System analysis saved to History Vault");
    } else if (action === "systems-copy") {
      const text = `${tool.title}\nFormula ${payload.formulaVersion}\n${JSON.stringify(payload.result, null, 2)}\n\nEntertainment only. Lottery outcomes are random.`;
      root.navigator?.clipboard?.writeText(text).then(() => context.toast("Result copied")).catch(() => context.toast("Copy was blocked; use JSON export"));
    } else if (action === "systems-export-json") {
      download(`lottomind-${route}.json`, JSON.stringify(payload, null, 2), "application/json");
      context.toast("JSON exported");
    } else if (action === "systems-export-csv") {
      download(`lottomind-${route}.csv`, flattenForCsv(payload.result), "text/csv");
      context.toast("CSV exported");
    }
    return true;
  }

  function handleInput(target) {
    const filter = target?.closest?.("[data-system-filter]");
    if (!filter) return false;
    ui.filters = filter.value;
    const query = ui.filters.trim().toLowerCase();
    document.querySelectorAll("[data-system-card]").forEach((card) => {
      card.hidden = Boolean(query) && !String(card.getAttribute("data-system-search") || "").includes(query);
    });
    return true;
  }

  function historyRows() {
    const reports = store()?.getState()?.savedReports || [];
    if (!reports.length) return "";
    return `<div class="panel vault-section systems-history-section"><div class="vault-heading"><span>Systems Lab</span><h2>System Analyses</h2></div>${reports.map((report) => `<div class="history-row"><strong>${escapeHtml(report.title)}</strong><small>${escapeHtml(sourceLabel(report.source))} · Formula ${escapeHtml(report.formulaVersion)} · ${escapeHtml(new Date(report.createdAt).toLocaleString())}</small><button class="tiny-btn" data-route="${escapeHtml(report.route)}">Open system</button></div>`).join("")}</div>`;
  }

  function touch(route) {
    if (toolFor(route)) store()?.touchRecent(route);
  }

  root.LottoMindSystemsUI = Object.freeze({ handleAction, handleInput, historyRows, renderLab, renderTool, touch });
}(typeof globalThis !== "undefined" ? globalThis : this));

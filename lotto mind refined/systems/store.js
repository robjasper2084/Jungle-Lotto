(function systemsStoreFactory(root) {
  "use strict";
  const KEY = "lottomind.systems.v1";
  const VERSION = 1;
  const MAX_REPORTS = 40;
  const MAX_RECENTS = 12;
  const emptyState = () => ({ version: VERSION, favorites: [], recents: [], savedReports: [], inputs: {} });

  function read() {
    try {
      const parsed = JSON.parse(root.localStorage?.getItem(KEY) || "null");
      if (!parsed || parsed.version !== VERSION) return emptyState();
      return {
        ...emptyState(),
        ...parsed,
        favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
        recents: Array.isArray(parsed.recents) ? parsed.recents : [],
        savedReports: Array.isArray(parsed.savedReports) ? parsed.savedReports : [],
        inputs: parsed.inputs && typeof parsed.inputs === "object" ? parsed.inputs : {},
      };
    } catch {
      return emptyState();
    }
  }

  function write(next) {
    const safe = { ...emptyState(), ...next, version: VERSION };
    try { root.localStorage?.setItem(KEY, JSON.stringify(safe)); } catch {}
    return safe;
  }

  function update(mutator) {
    const next = read();
    mutator(next);
    return write(next);
  }

  function toggleFavorite(route) {
    return update((state) => {
      state.favorites = state.favorites.includes(route)
        ? state.favorites.filter((item) => item !== route)
        : [route, ...state.favorites].slice(0, 16);
    });
  }

  function touchRecent(route) {
    return update((state) => {
      state.recents = [route, ...state.recents.filter((item) => item !== route)].slice(0, MAX_RECENTS);
    });
  }

  function saveInputs(route, inputs) {
    return update((state) => { state.inputs[route] = { ...inputs }; });
  }

  function saveReport(report) {
    const safeReport = {
      id: report.id || `system-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: "system-analysis",
      route: String(report.route || "systemsLab"),
      title: String(report.title || "Systems Lab Report"),
      createdAt: report.createdAt || new Date().toISOString(),
      formulaVersion: String(report.formulaVersion || "1.0.0"),
      source: String(report.source || "offline"),
      inputs: report.inputs && typeof report.inputs === "object" ? report.inputs : {},
      result: report.result && typeof report.result === "object" ? report.result : {},
    };
    update((state) => {
      state.savedReports = [safeReport, ...state.savedReports.filter((item) => item.id !== safeReport.id)].slice(0, MAX_REPORTS);
    });
    return safeReport;
  }

  function clearReports() {
    return update((state) => { state.savedReports = []; });
  }

  root.LottoMindSystemsStore = Object.freeze({
    KEY,
    VERSION,
    clearReports,
    getState: read,
    saveInputs,
    saveReport,
    toggleFavorite,
    touchRecent,
  });
}(typeof globalThis !== "undefined" ? globalThis : this));

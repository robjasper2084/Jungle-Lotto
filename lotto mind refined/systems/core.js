(function systemsCoreFactory(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.LottoMindSystems = Object.assign(root.LottoMindSystems || {}, api);
}(typeof globalThis !== "undefined" ? globalThis : this, function buildSystemsCore() {
  "use strict";

  const FORMULA_VERSIONS = Object.freeze({
    dateMath: "1.0.0",
    monthlyPlaylist: "1.0.0",
    pairCluster3: "1.0.0",
    pairCluster4: "1.0.0",
    dailyRundown: "1.0.0",
    top10Generator: "1.0.0",
    digitWheeler: "1.0.0",
    vtracPredictor: "1.0.0",
  });
  const MIRRORS = Object.freeze([5, 6, 7, 8, 9, 0, 1, 2, 3, 4]);
  const DEFAULT_CAP = 240;

  function dedupe(values) {
    return Array.from(new Set(values));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function digitalRoot(value) {
    const safe = Math.abs(Math.trunc(Number(value) || 0));
    return safe === 0 ? 0 : ((safe - 1) % 9) + 1;
  }

  function mirrorDigit(value) {
    const digit = Math.abs(Math.trunc(Number(value) || 0)) % 10;
    return MIRRORS[digit];
  }

  function mirror(value) {
    return String(value ?? "").replace(/\D/g, "").split("").map((digit) => mirrorDigit(digit)).join("");
  }

  function vtrac(value) {
    const digit = Math.abs(Math.trunc(Number(value) || 0)) % 10;
    return (digit % 5) + 1;
  }

  function digitsForVtrac(value) {
    const lane = clamp(Math.trunc(Number(value) || 1), 1, 5);
    return lane === 1 ? [0, 5] : [lane - 1, lane + 4];
  }

  function stableHash(value) {
    let hash = 2166136261;
    const text = String(value ?? "");
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function seededRandom(seed) {
    let state = stableHash(seed) || 0x6d2b79f5;
    return function nextRandom() {
      state += 0x6d2b79f5;
      let result = state;
      result = Math.imul(result ^ (result >>> 15), result | 1);
      result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
      return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
  }

  function normalizeScore(value, min, max) {
    if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || max === min) return 0;
    return Math.round(clamp((value - min) / (max - min), 0, 1) * 1000) / 10;
  }

  function formatPickNumber(value, length) {
    const digits = Array.isArray(value) ? value.join("") : String(value ?? "").replace(/\D/g, "");
    return digits.padStart(length, "0").slice(-length);
  }

  function parseDigitInput(input, options) {
    const settings = { lengths: [3, 4], maxEntries: 500, ...options };
    const lengths = dedupe(settings.lengths.map(Number).filter((item) => item > 0));
    const raw = Array.isArray(input) ? input.join("\n") : String(input ?? "");
    const tokens = raw.split(/[\s,;|/]+/).map((token) => token.trim()).filter(Boolean);
    const entries = [];
    const rejected = [];
    tokens.forEach((token) => {
      if (!/^\d+$/.test(token) || !lengths.includes(token.length)) {
        rejected.push(token);
        return;
      }
      if (entries.length >= settings.maxEntries) return;
      entries.push(token);
    });
    return {
      entries,
      rejected,
      capped: Math.max(0, tokens.length - rejected.length - entries.length),
      source: entries.length ? (settings.source || "manual") : "no-history",
    };
  }

  function combinations(values, size) {
    const result = [];
    const walk = (start, path) => {
      if (path.length === size) {
        result.push(path.slice());
        return;
      }
      for (let index = start; index <= values.length - (size - path.length); index += 1) {
        path.push(values[index]);
        walk(index + 1, path);
        path.pop();
      }
    };
    if (size >= 0 && size <= values.length) walk(0, []);
    return result;
  }

  function multisetCombos(values, size) {
    const counts = new Map();
    values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
    const keys = Array.from(counts.keys());
    const result = [];
    const walk = (index, path) => {
      if (path.length === size) {
        result.push(path.slice());
        return;
      }
      if (index >= keys.length) return;
      const key = keys[index];
      const remaining = size - path.length;
      for (let amount = 0; amount <= Math.min(counts.get(key), remaining); amount += 1) {
        for (let count = 0; count < amount; count += 1) path.push(key);
        walk(index + 1, path);
        path.splice(path.length - amount, amount);
      }
    };
    walk(0, []);
    return result.filter((combo) => combo.length === size);
  }

  function uniquePermutations(values) {
    const input = Array.isArray(values) ? values.slice() : String(values ?? "").split("");
    const result = [];
    const counts = new Map();
    input.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
    const keys = Array.from(counts.keys());
    const walk = (path) => {
      if (path.length === input.length) {
        result.push(path.slice());
        return;
      }
      keys.forEach((key) => {
        const count = counts.get(key) || 0;
        if (!count) return;
        counts.set(key, count - 1);
        path.push(key);
        walk(path);
        path.pop();
        counts.set(key, count);
      });
    };
    walk([]);
    return result;
  }

  function boxPermutationCount(value) {
    const digits = Array.isArray(value) ? value : String(value ?? "").split("");
    const counts = new Map();
    digits.forEach((digit) => counts.set(digit, (counts.get(digit) || 0) + 1));
    let numerator = 1;
    for (let index = 2; index <= digits.length; index += 1) numerator *= index;
    counts.forEach((count) => {
      for (let index = 2; index <= count; index += 1) numerator /= index;
    });
    return numerator;
  }

  function analyzeDailyDigits(input) {
    const digits = String(input ?? "").replace(/\D/g, "").slice(0, 4);
    const length = digits.length <= 3 ? 3 : 4;
    const clean = digits.padEnd(length, "0").slice(0, length);
    const values = clean.split("").map(Number);
    const sum = values.reduce((total, digit) => total + digit, 0);
    const odd = values.filter((digit) => digit % 2 === 1).length;
    const even = values.length - odd;
    const sorted = values.slice().sort((a, b) => a - b);
    const consecutivePairs = sorted.flatMap((digit, index) => sorted[index + 1] === digit + 1 ? [`${digit}-${digit + 1}`] : []);
    return {
      input: clean,
      digits: values,
      mirrors: values.map(mirrorDigit),
      vtrac: values.map(vtrac),
      pairs: combinations(values.map(String), 2).map((pair) => pair.join("")),
      boxedCount: boxPermutationCount(values),
      sum,
      root: digitalRoot(sum),
      repeatDigits: dedupe(values.filter((digit, index) => values.indexOf(digit) !== index)),
      sequence: {
        odd,
        even,
        consecutivePairs,
        note: consecutivePairs.length ? "Consecutive pressure detected." : odd === even ? "Balanced odd/even structure." : "Asymmetric pattern with room for filtering.",
      },
      formulaVersion: "1.0.0",
    };
  }

  function dateMath(dateValue) {
    const safeText = String(dateValue || "");
    const date = /^\d{4}-\d{2}-\d{2}$/.test(safeText) ? new Date(`${safeText}T12:00:00`) : new Date(dateValue || Date.now());
    const year = Number.isFinite(date.getTime()) ? date.getFullYear() : new Date().getFullYear();
    const month = Number.isFinite(date.getTime()) ? date.getMonth() + 1 : 1;
    const day = Number.isFinite(date.getTime()) ? date.getDate() : 1;
    const monthRoot = digitalRoot(month);
    const dayRoot = digitalRoot(day);
    const monthDayTotal = month + day;
    const monthDayTail = monthDayTotal % 10;
    const fullDateRoot = digitalRoot(month + day + year);
    const seedDigits = [dayRoot, monthRoot, monthDayTail, fullDateRoot];
    return {
      date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      year,
      month,
      day,
      monthRoot,
      dayRoot,
      monthDayTotal,
      monthDayTail,
      fullDateRoot,
      seedDigits,
      pick3: seedDigits.slice(0, 3).join(""),
      pick4: seedDigits.join(""),
      formulaVersion: FORMULA_VERSIONS.dateMath,
    };
  }

  function historyEntries(history, length) {
    if (Array.isArray(history)) {
      return parseDigitInput(history, { lengths: [length], maxEntries: 500, source: "import" });
    }
    return parseDigitInput(history, { lengths: [length], maxEntries: 500, source: "manual" });
  }

  function digitFrequency(entries) {
    const counts = Array(10).fill(0);
    entries.forEach((entry) => entry.split("").forEach((digit) => { counts[Number(digit)] += 1; }));
    return counts;
  }

  function rankDigits(scoreRows, seed) {
    const rng = seededRandom(seed);
    return scoreRows.map((row) => ({ ...row, tie: rng() }))
      .sort((a, b) => b.score - a.score || a.tie - b.tie || a.digit - b.digit);
  }

  function monthlyPlaylist(input) {
    const settings = { month: new Date().getMonth() + 1, year: new Date().getFullYear(), history: "", ...input };
    const parsed = parseDigitInput(settings.history, { lengths: [3, 4], maxEntries: 500, source: settings.historySource || "manual" });
    const entries = parsed.entries;
    const overall = digitFrequency(entries);
    const recent30 = digitFrequency(entries.slice(0, 30));
    const recent10 = digitFrequency(entries.slice(0, 10));
    const monthLane = entries.filter((_, index) => index % 12 === (Number(settings.month) - 1 + 12) % 12);
    const sameMonth = digitFrequency(monthLane);
    const pairScore = Array(10).fill(0);
    entries.forEach((entry) => combinations(entry.split(""), 2).forEach((pair) => pair.forEach((digit) => { pairScore[Number(digit)] += 1; })));
    const max = (values) => Math.max(1, ...values);
    const rows = Array.from({ length: 10 }, (_, digit) => ({
      digit,
      score: (overall[digit] / max(overall)) * 35
        + (recent30[digit] / max(recent30)) * 25
        + (recent10[digit] / max(recent10)) * 20
        + (sameMonth[digit] / max(sameMonth)) * 10
        + (pairScore[digit] / max(pairScore)) * 10,
    }));
    if (!entries.length) {
      const rng = seededRandom(`${settings.year}-${settings.month}-monthly-playlist`);
      rows.forEach((row) => { row.score = 20 + (rng() * 80); });
    }
    const ranking = rankDigits(rows, `${settings.year}-${settings.month}|${entries.join("|")}`);
    const top6 = ranking.slice(0, 6).map((row) => row.digit);
    const top4 = top6.slice(0, 4);
    const singles = combinations(top6, 3).map((combo) => combo.join(""));
    const doubles = top4.flatMap((digit, index) => uniquePermutations([digit, digit, top4[(index + 1) % top4.length]]).map((pick) => pick.join("")));
    const triples = top4.map((digit) => `${digit}${digit}${digit}`);
    return {
      month: Number(settings.month),
      year: Number(settings.year),
      source: parsed.source,
      rejected: parsed.rejected,
      top6,
      ranking: ranking.map((row) => ({ digit: row.digit, score: Math.round(row.score * 10) / 10 })),
      singles: singles.slice(0, 20),
      doubles: doubles.slice(0, 12),
      triples,
      formulaVersion: FORMULA_VERSIONS.monthlyPlaylist,
    };
  }

  function pairKey(a, b, ordered) {
    return ordered ? `${a}${b}` : [a, b].sort().join("");
  }

  function pairCluster(input, length) {
    const settings = { history: "", mode: "unordered", includeDoublePairs: true, ...input };
    const parsed = historyEntries(settings.history, length);
    const entries = parsed.entries;
    const ordered = settings.mode === "position" || settings.mode === "chain";
    const stats = new Map();
    entries.forEach((entry, drawIndex) => {
      const digits = entry.split("");
      const pairIndexes = settings.mode === "chain"
        ? digits.slice(0, -1).map((_, index) => [index, index + 1])
        : combinations(digits.map((_, index) => index), 2);
      pairIndexes.forEach(([left, right]) => {
        const a = digits[left];
        const b = digits[right];
        if (!settings.includeDoublePairs && a === b) return;
        const key = settings.mode === "position" ? `${left + 1}${right + 1}:${a}${b}` : pairKey(a, b, ordered);
        const item = stats.get(key) || { pair: key, digits: `${a}${b}`, raw: 0, weighted: 0, recent5: 0, recent10: 0, lastSeen: Number.POSITIVE_INFINITY };
        item.raw += 1;
        item.weighted += Math.pow(0.94, drawIndex);
        if (drawIndex < 5) item.recent5 += 1;
        if (drawIndex < 10) item.recent10 += 1;
        item.lastSeen = Math.min(item.lastSeen, drawIndex);
        stats.set(key, item);
      });
    });
    if (!stats.size) {
      const rng = seededRandom(`pair-${length}-${settings.mode}`);
      for (let a = 0; a <= 9; a += 1) {
        for (let b = settings.includeDoublePairs ? a : a + 1; b <= 9; b += 1) {
          if (!settings.includeDoublePairs && a === b) continue;
          const key = pairKey(a, b, false);
          stats.set(key, { pair: key, digits: key, raw: 0, weighted: rng(), recent5: 0, recent10: 0, lastSeen: 99 });
        }
      }
    }
    const rows = Array.from(stats.values());
    const maxRaw = Math.max(1, ...rows.map((row) => row.raw));
    const maxWeighted = Math.max(1, ...rows.map((row) => row.weighted));
    rows.forEach((row) => {
      row.frequencyPct = entries.length ? Math.round((row.raw / entries.length) * 1000) / 10 : 0;
      row.gap = Number.isFinite(row.lastSeen) ? row.lastSeen : entries.length;
      row.momentum = row.recent5 - Math.max(0, row.recent10 - row.recent5);
      row.heat = Math.round(((row.weighted / maxWeighted) * 70 + (row.recent5 / 5) * 30) * 10) / 10;
      row.score = Math.round(((row.weighted / maxWeighted) * 45 + (row.recent10 / 10) * 25 + (1 / (row.gap + 1)) * 15 + (row.heat / 100) * 15) * 10) / 10;
      row.rawNormalized = Math.round((row.raw / maxRaw) * 1000) / 10;
    });
    rows.sort((a, b) => b.score - a.score || a.pair.localeCompare(b.pair));
    const selected = rows.slice(0, 3);
    const backups = rows.slice(3, 5);
    const seedDigits = dedupe(selected.flatMap((row) => row.digits.split(""))).map(Number);
    const fillDigits = dedupe([...seedDigits, ...Array.from({ length: 10 }, (_, digit) => digit)]);
    const candidates = combinations(fillDigits.slice(0, Math.max(length + 2, 6)), length).slice(0, 12).map((combo) => combo.join(""));
    return {
      length,
      mode: settings.mode,
      source: parsed.source,
      rejected: parsed.rejected,
      drawCount: entries.length,
      selected,
      backups,
      rows: rows.slice(0, 20),
      candidates,
      formulaVersion: length === 3 ? FORMULA_VERSIONS.pairCluster3 : FORMULA_VERSIONS.pairCluster4,
    };
  }

  function pairCluster3(input) {
    return pairCluster(input, 3);
  }

  function pairCluster4(input) {
    const result = pairCluster(input, 4);
    const rawSelectedDigits = result.selected.flatMap((row) => row.digits.split(""));
    const selectedDigits = dedupe(rawSelectedDigits);
    const source = selectedDigits.length >= 4 ? selectedDigits : dedupe([...selectedDigits, "0", "1", "2", "3"]);
    const cap = clamp(input?.cap || 60, 1, 500);
    const base = combinations(source, 4);
    const repeats = input?.includeDoublePairs === false ? [] : multisetCombos(rawSelectedDigits, 4).filter((combo) => new Set(combo).size < combo.length);
    const beforeCap = dedupe([...base, ...repeats].flatMap(uniquePermutations).map((pick) => pick.join("")));
    const wheel = beforeCap.slice(0, cap);
    return { ...result, wheel, cap, capped: beforeCap.length > cap, totalBeforeCap: beforeCap.length, creditCost: 0 };
  }

  function rotate(value, amount) {
    const text = String(value);
    const offset = ((amount % text.length) + text.length) % text.length;
    return text.slice(offset) + text.slice(0, offset);
  }

  function easyDailyRundown(input) {
    const analysis = analyzeDailyDigits(input);
    const original = analysis.input;
    const shifted = original.split("").map((digit) => (Number(digit) + analysis.root) % 10).join("");
    const labeled = [
      [original, "Original"],
      [rotate(original, 1), "Rotation 1"],
      [rotate(original, 2), "Rotation 2"],
      [mirror(original), "Full mirror"],
      [rotate(mirror(original), 1), "Mirror rotation 1"],
      [rotate(mirror(original), 2), "Mirror rotation 2"],
      [original.split("").reverse().join(""), "Reverse"],
      [mirror(original.split("").reverse().join("")), "Reverse mirror"],
      [shifted, `Root shift +${analysis.root}`],
    ];
    original.split("").forEach((digit, index) => {
      const copy = original.split("");
      copy[index] = String(mirrorDigit(digit));
      labeled.push([copy.join(""), `Position ${index + 1} mirror`]);
    });
    const seen = new Set();
    const picks = [];
    labeled.forEach(([pick, formula]) => {
      if (seen.has(pick) || picks.length >= 10) return;
      seen.add(pick);
      picks.push({ pick, formula, boxWays: boxPermutationCount(pick) });
    });
    const rng = seededRandom(`${original}|daily-rundown`);
    while (picks.length < 10) {
      const candidate = original.split("").map((digit, index) => (Number(digit) + analysis.root + index + Math.floor(rng() * 10)) % 10).join("");
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      picks.push({ pick: candidate, formula: "Deterministic root fill", boxWays: boxPermutationCount(candidate) });
    }
    return { input: original, sum: analysis.sum, root: analysis.root, picks, formulaVersion: FORMULA_VERSIONS.dailyRundown };
  }

  function top10Generator(input) {
    const settings = { digits: "", history: "", ...input };
    const clean = String(settings.digits ?? "").replace(/\D/g, "").slice(0, 4);
    const sourceDigits = clean.split("").map(Number);
    const parsed = parseDigitInput(settings.history, { lengths: [3, 4], maxEntries: 500, source: settings.historySource || "manual" });
    const frequency = digitFrequency(parsed.entries);
    const maxFrequency = Math.max(1, ...frequency);
    const sum = sourceDigits.reduce((total, digit) => total + digit, 0);
    const pairTails = combinations(sourceDigits, 2).map((pair) => (pair[0] + pair[1]) % 10);
    const pairRoots = combinations(sourceDigits, 2).map((pair) => digitalRoot(pair[0] + pair[1]));
    const totalTail = sum % 10;
    const totalRoot = digitalRoot(sum);
    const rows = Array.from({ length: 10 }, (_, digit) => {
      let score = sourceDigits.includes(digit) ? 10 : 0;
      score += pairTails.includes(digit) ? 6 : 0;
      score += pairRoots.includes(digit) ? 4 : 0;
      score += digit === totalTail ? 5 : 0;
      score += digit === totalRoot ? 5 : 0;
      score += sourceDigits.map(mirrorDigit).includes(digit) ? 3 : 0;
      score += (frequency[digit] / maxFrequency) * 5;
      return { digit, score };
    });
    const ranking = rankDigits(rows, `${clean}|${parsed.entries.join("|")}`);
    const top5 = ranking.slice(0, 5).map((row) => row.digit);
    const singles = combinations(top5, 3).map((combo) => combo.join(""));
    const mainDoubles = combinations(top5, 2).map(([a, b]) => `${a}${a}${b}`);
    const sisterDoubles = combinations(top5, 2).map(([a, b]) => `${a}${b}${b}`);
    return {
      input: clean,
      source: parsed.source,
      top5,
      ranking: ranking.map((row) => ({ digit: row.digit, score: Math.round(row.score * 10) / 10 })),
      singles: singles.slice(0, 10),
      mainDoubles: mainDoubles.slice(0, 10),
      sisterDoubles: sisterDoubles.slice(0, 10),
      formulaVersion: FORMULA_VERSIONS.top10Generator,
    };
  }

  function digitWheeler(input) {
    const settings = { digits: "", length: 3, straight: false, cap: DEFAULT_CAP, required: "", excluded: "", ...input };
    const length = clamp(Math.trunc(settings.length), 3, 4);
    const rawDigits = String(settings.digits ?? "").replace(/\D/g, "").split("");
    const uniqueDigits = dedupe(rawDigits);
    const baseCombos = combinations(uniqueDigits, length);
    const repeatCombos = multisetCombos(rawDigits, length).filter((combo) => new Set(combo).size < combo.length);
    const required = dedupe(String(settings.required ?? "").replace(/\D/g, "").split(""));
    const excluded = new Set(String(settings.excluded ?? "").replace(/\D/g, "").split(""));
    let combos = dedupe([...baseCombos, ...repeatCombos].map((combo) => combo.join("")))
      .filter((pick) => required.every((digit) => pick.includes(digit)))
      .filter((pick) => !pick.split("").some((digit) => excluded.has(digit)));
    if (settings.straight) combos = dedupe(combos.flatMap((pick) => uniquePermutations(pick.split("")).map((item) => item.join(""))));
    const cap = clamp(Math.trunc(settings.cap || DEFAULT_CAP), 1, 1000);
    const totalBeforeCap = combos.length;
    combos = combos.slice(0, cap);
    return {
      length,
      uniqueDigits,
      repeatedDigits: dedupe(rawDigits.filter((digit, index) => rawDigits.indexOf(digit) !== index)),
      baseCombinationCount: baseCombos.length,
      repeatCombinationCount: repeatCombos.length,
      totalBeforeCap,
      cap,
      capped: totalBeforeCap > cap,
      combinations: combos,
      creditCost: 0,
      formulaVersion: FORMULA_VERSIONS.digitWheeler,
    };
  }

  function cartesian(groups, cap) {
    let result = [[]];
    groups.forEach((group) => {
      const next = [];
      result.forEach((path) => group.forEach((value) => {
        if (next.length < cap) next.push([...path, value]);
      }));
      result = next;
    });
    return result;
  }

  function vtracPredictor(input) {
    const settings = { digits: "", length: 3, cap: 160, includeMirrors: true, history: "", ...input };
    const length = clamp(Math.trunc(settings.length), 3, 4);
    const digits = String(settings.digits ?? "").replace(/\D/g, "").slice(0, length).padEnd(length, "0").split("").map(Number);
    const lanes = digits.map(vtrac);
    const nearby = dedupe([
      lanes.map((lane) => lane === 5 ? 1 : lane + 1).join("-"),
      lanes.map((lane) => lane === 1 ? 5 : lane - 1).join("-"),
      lanes.slice().reverse().join("-"),
    ]);
    const groups = lanes.map(digitsForVtrac);
    let candidates = cartesian(groups, clamp(settings.cap * 2, 1, 1000)).map((pick) => pick.join(""));
    if (settings.includeMirrors) candidates = dedupe([...candidates, ...candidates.map(mirror)]);
    const parsed = historyEntries(settings.history, length);
    const frequency = new Map();
    parsed.entries.forEach((entry, index) => frequency.set(entry, (frequency.get(entry) || 0) + Math.pow(0.95, index)));
    candidates = candidates.map((pick) => ({
      pick,
      score: Math.round(((frequency.get(pick) || 0) * 20 + (stableHash(`${pick}|${lanes.join("")}`) % 1000) / 100) * 10) / 10,
    })).sort((a, b) => b.score - a.score || a.pick.localeCompare(b.pick));
    const cap = clamp(settings.cap, 1, 500);
    return {
      input: digits.join(""),
      vtrac: lanes.map((lane) => `V${lane}`),
      nearby: nearby.map((pattern) => pattern.split("-").map((lane) => `V${lane}`).join("-")),
      source: parsed.source,
      candidateCount: candidates.length,
      cap,
      capped: candidates.length > cap,
      candidates: candidates.slice(0, cap),
      formulaVersion: FORMULA_VERSIONS.vtracPredictor,
    };
  }

  return Object.freeze({
    FORMULA_VERSIONS,
    analyzeDailyDigits,
    boxPermutationCount,
    combinations,
    dateMath,
    dedupe,
    digitWheeler,
    digitsForVtrac,
    digitalRoot,
    easyDailyRundown,
    formatPickNumber,
    mirror,
    mirrorDigit,
    monthlyPlaylist,
    multisetCombos,
    normalizeScore,
    pairCluster3,
    pairCluster4,
    parseDigitInput,
    seededRandom,
    stableHash,
    top10Generator,
    uniquePermutations,
    vtrac,
    vtracPredictor,
  });
}));

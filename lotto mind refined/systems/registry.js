(function systemsRegistryFactory(root) {
  "use strict";
  const tools = [
    { key: "dateMath", route: "dateMath", path: "systems/date-math", title: "Date Math", short: "Auto Daily", group: "Daily Signals", description: "Build transparent Pick 3 and Pick 4 seed digits from a calendar date.", tags: "date daily root month day seed", version: "1.0.0" },
    { key: "monthlyPlaylist", route: "monthlyPlaylist", path: "systems/monthly-playlist", title: "Monthly Playlist", short: "Auto Monthly", group: "Daily Signals", description: "Rank digit lanes with deterministic monthly and history-weighted scoring.", tags: "month history ranking singles doubles triples", version: "1.0.0" },
    { key: "pairCluster3", route: "pairCluster3", path: "systems/pair-cluster-3", title: "Pick 3 Pair Cluster", short: "Pair Radar", group: "Pair Intelligence", description: "Measure Pick 3 pair frequency, recency, momentum, and heat.", tags: "pick 3 pair cluster history heat", version: "1.0.0" },
    { key: "pairCluster4", route: "pairCluster4", path: "systems/pair-cluster-4", title: "Pick 4 Pair Cluster + Wheeler", short: "Pair Wheel", group: "Pair Intelligence", description: "Score all six Pick 4 pairs and build a capped straight wheel.", tags: "pick 4 pair cluster wheel coverage", version: "1.0.0" },
    { key: "dailyRundown", route: "dailyRundown", path: "systems/daily-rundown", title: "Easy Daily Rundown", short: "10 Plays", group: "Generators", description: "Turn one Pick 3 or Pick 4 input into ten labeled transforms.", tags: "daily rundown mirror rotation root", version: "1.0.0" },
    { key: "top10Generator", route: "top10Generator", path: "systems/top-10", title: "Top 10 Generator", short: "Digit Rank", group: "Generators", description: "Score input digits, sum tails, roots, mirrors, and optional history.", tags: "top 10 singles doubles sister", version: "1.0.0" },
    { key: "digitWheeler", route: "digitWheeler", path: "systems/digit-wheeler", title: "Pick 3 / Pick 4 Digit Wheeler", short: "Coverage", group: "Coverage", description: "Build transparent base, repeat, and straight digit combinations.", tags: "wheel digits repeats combinations straight box", version: "1.0.0" },
    { key: "vtracPredictor", route: "vtracPredictor", path: "systems/vtrac", title: "Pick 3 V-Trac Family Map", short: "V-Trac", group: "Coverage", description: "Map digits into V-Trac lanes and expand deterministic families.", tags: "vtrac family mirror reference", version: "1.0.0" },
  ];
  const byRoute = Object.freeze(Object.fromEntries(tools.map((tool) => [tool.route, Object.freeze(tool)])));
  root.LottoMindSystemsRegistry = Object.freeze({ tools: Object.freeze(tools.map(Object.freeze)), byRoute });
}(typeof globalThis !== "undefined" ? globalThis : this));

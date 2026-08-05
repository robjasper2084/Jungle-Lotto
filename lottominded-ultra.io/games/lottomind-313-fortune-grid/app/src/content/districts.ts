export const districts = [
  { id: "downtown", name: "Downtown Lights", symbol: "◆", pattern: "lines", bonus: "Pulse Preview: view the next City Pulse card before resolving." },
  { id: "riverfront", name: "Riverfront Circuit", symbol: "≈", pattern: "waves", bonus: "River Route: gain one extra route option at Transit Junctions." },
  { id: "midtown", name: "Midtown Arts", symbol: "✦", pattern: "stars", bonus: "Perfect Tempo: Beat Studio awards one additional Focus Token." },
  { id: "innovation", name: "Innovation Corridor", symbol: "⬡", pattern: "grid", bonus: "Efficient Build: upgrades cost 20 Detroit Dollars less." },
  { id: "eastside", name: "Eastside Markets", symbol: "●", pattern: "dots", bonus: "Market Loop: collect 25 Detroit Dollars when your turn begins." },
  { id: "southwest", name: "Southwest Spirit", symbol: "▲", pattern: "chevrons", bonus: "Signal Blend: matching Signal digits award 1 Legacy Point." },
  { id: "northwest", name: "Northwest Style", symbol: "◇", pattern: "diamonds", bonus: "Open Exchange: partnership and trade fees are waived." },
  { id: "legacy", name: "Neighborhood Legacy", symbol: "✚", pattern: "cross", bonus: "Legacy Spark: gain 2 Legacy Points at the start of each round." }
] as const;
export type DistrictId = typeof districts[number]["id"];

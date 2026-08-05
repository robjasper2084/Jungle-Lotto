export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface DetroitStop extends GeoPoint {
  street: string;
  spot: string;
}

export interface DetroitLandmark extends GeoPoint {
  name: string;
  kind: "tower" | "station" | "stadium" | "market" | "island" | "bridge";
  accent: number;
  height: number;
}

const bounds = { west: -83.145, east: -82.97, north: 42.385, south: 42.275 } as const;

export function projectDetroit(point: GeoPoint): { x: number; y: number } {
  return {
    x: 8 + ((point.lon - bounds.west) / (bounds.east - bounds.west)) * 84,
    y: 6 + ((bounds.north - point.lat) / (bounds.north - bounds.south)) * 63,
  };
}

// Geographic metadata for the illustrated Detroit circuit. The selected visual
// renderer composes these stops into a readable clockwise property-board loop.
export const detroitStops: DetroitStop[] = [
  { lat: 42.3317, lon: -83.0466, street: "Woodward Ave & Michigan Ave", spot: "Campus Martius" },
  { lat: 42.3356, lon: -83.0498, street: "Woodward Ave", spot: "Grand Circus Park" },
  { lat: 42.3390, lon: -83.0485, street: "Woodward Ave", spot: "Comerica Park" },
  { lat: 42.3400, lon: -83.0456, street: "Brush St", spot: "Ford Field" },
  { lat: 42.3411, lon: -83.0553, street: "Woodward Ave", spot: "Little Caesars Arena" },
  { lat: 42.3517, lon: -83.0645, street: "Woodward Ave & Canfield St", spot: "Midtown" },
  { lat: 42.3594, lon: -83.0646, street: "Woodward Ave", spot: "Detroit Institute of Arts" },
  { lat: 42.3695, lon: -83.0764, street: "W Grand Blvd", spot: "Fisher Building" },
  { lat: 42.3702, lon: -83.0920, street: "W Grand Blvd", spot: "Virginia Park" },
  { lat: 42.3628, lon: -83.1030, street: "Grand River Ave", spot: "Northwest Goldberg" },
  { lat: 42.3780, lon: -83.1370, street: "Grand River Ave & Livernois Ave", spot: "Grandmont Corridor" },
  { lat: 42.3500, lon: -83.1390, street: "Livernois Ave & Warren Ave", spot: "Livernois Corridor" },
  { lat: 42.3310, lon: -83.1290, street: "Livernois Ave & Michigan Ave", spot: "West Side Junction" },
  { lat: 42.3310, lon: -83.1080, street: "Michigan Ave", spot: "Chadsey-Condon" },
  { lat: 42.3289, lon: -83.0778, street: "Michigan Ave", spot: "Michigan Central" },
  { lat: 42.3124, lon: -83.0743, street: "Ambassador Bridge", spot: "Ambassador Bridge" },
  { lat: 42.3180, lon: -83.0950, street: "W Vernor Hwy", spot: "Southwest Detroit" },
  { lat: 42.2881, lon: -83.0978, street: "W Jefferson Ave", spot: "Gordie Howe International Bridge" },
  { lat: 42.3025, lon: -83.1080, street: "Fort St", spot: "Delray" },
  { lat: 42.2860, lon: -83.1240, street: "W Jefferson Ave", spot: "River Rouge Gateway" },
  { lat: 42.3045, lon: -83.0730, street: "W Jefferson Ave", spot: "Riverside Park" },
  { lat: 42.3190, lon: -83.0660, street: "W Jefferson Ave", spot: "West Riverfront" },
  { lat: 42.3235, lon: -83.0580, street: "Atwater St", spot: "Ralph C. Wilson Jr. Centennial Park" },
  { lat: 42.3297, lon: -83.0467, street: "Griswold St", spot: "Guardian Building" },
  { lat: 42.3291, lon: -83.0398, street: "Jefferson Ave", spot: "Renaissance Center" },
  { lat: 42.3330, lon: -83.0260, street: "Atwater St", spot: "Rivard Plaza" },
  { lat: 42.3410, lon: -83.0030, street: "MacArthur Bridge", spot: "Belle Isle Gateway" },
  { lat: 42.3373, lon: -82.9820, street: "Inselruhe Ave", spot: "Belle Isle Conservatory" },
  { lat: 42.3570, lon: -83.0130, street: "E Jefferson Ave & Van Dyke St", spot: "East Jefferson" },
  { lat: 42.3487, lon: -83.0400, street: "Russell St", spot: "Eastern Market" },
  { lat: 42.3550, lon: -83.0330, street: "Gratiot Ave & Mack Ave", spot: "Gratiot Corridor" },
  { lat: 42.3730, lon: -83.0200, street: "Gratiot Ave & E Grand Blvd", spot: "East Grand Boulevard" },
  { lat: 42.3710, lon: -83.0730, street: "W Grand Blvd", spot: "New Center" },
  { lat: 42.3560, lon: -83.0660, street: "Cass Ave", spot: "Wayne State" },
  { lat: 42.3385, lon: -83.0524, street: "Woodward Ave", spot: "Fox Theatre" },
  { lat: 42.3310, lon: -83.0410, street: "Cadillac Square", spot: "Cadillac Square" },
];

export const detroitLandmarks: DetroitLandmark[] = [
  { name: "Gordie Howe International Bridge", lat: 42.2881, lon: -83.0978, kind: "bridge", accent: 0x61e7ff, height: 2.9 },
  { name: "Ambassador Bridge", lat: 42.3124, lon: -83.0743, kind: "bridge", accent: 0xf5c451, height: 2.5 },
  { name: "Michigan Central", lat: 42.3289, lon: -83.0778, kind: "station", accent: 0xc78e58, height: 2.8 },
  { name: "Guardian Building", lat: 42.3297, lon: -83.0467, kind: "tower", accent: 0xe27a45, height: 4.8 },
  { name: "Renaissance Center", lat: 42.3291, lon: -83.0398, kind: "tower", accent: 0x56b9d7, height: 6.2 },
  { name: "Comerica Park", lat: 42.3390, lon: -83.0485, kind: "stadium", accent: 0x6f8cff, height: 1.1 },
  { name: "Ford Field", lat: 42.3400, lon: -83.0456, kind: "stadium", accent: 0x5ab0d9, height: 1.4 },
  { name: "Little Caesars Arena", lat: 42.3411, lon: -83.0553, kind: "stadium", accent: 0xff7655, height: 1.25 },
  { name: "Fox Theatre", lat: 42.3385, lon: -83.0524, kind: "tower", accent: 0xdab35d, height: 1.7 },
  { name: "Fisher Building", lat: 42.3695, lon: -83.0764, kind: "tower", accent: 0x6bc6a0, height: 3.7 },
  { name: "Eastern Market", lat: 42.3487, lon: -83.0400, kind: "market", accent: 0xf09d4f, height: 0.75 },
  { name: "Belle Isle Conservatory", lat: 42.3373, lon: -82.9820, kind: "island", accent: 0x70d98b, height: 1.0 },
];

export const streetPolylines: Array<{ name: string; points: GeoPoint[] }> = [
  { name: "Woodward Ave", points: [{ lat: 42.3317, lon: -83.0466 }, { lat: 42.3411, lon: -83.0553 }, { lat: 42.3594, lon: -83.0646 }, { lat: 42.3710, lon: -83.0730 }] },
  { name: "Michigan Ave", points: [{ lat: 42.3317, lon: -83.0466 }, { lat: 42.3289, lon: -83.0778 }, { lat: 42.3310, lon: -83.1080 }, { lat: 42.3310, lon: -83.1290 }] },
  { name: "Jefferson Ave", points: [{ lat: 42.2860, lon: -83.1240 }, { lat: 42.3045, lon: -83.0730 }, { lat: 42.3291, lon: -83.0398 }, { lat: 42.3570, lon: -83.0130 }] },
  { name: "Gratiot Ave", points: [{ lat: 42.3310, lon: -83.0410 }, { lat: 42.3487, lon: -83.0400 }, { lat: 42.3730, lon: -83.0200 }] },
  { name: "Grand River Ave", points: [{ lat: 42.3317, lon: -83.0466 }, { lat: 42.3628, lon: -83.1030 }, { lat: 42.3780, lon: -83.1370 }] },
  { name: "W Vernor Hwy", points: [{ lat: 42.3289, lon: -83.0778 }, { lat: 42.3180, lon: -83.0950 }, { lat: 42.3025, lon: -83.1080 }] },
  { name: "Livernois Ave", points: [{ lat: 42.3310, lon: -83.1290 }, { lat: 42.3500, lon: -83.1390 }, { lat: 42.3780, lon: -83.1370 }] },
  { name: "Cass Ave", points: [{ lat: 42.3317, lon: -83.0466 }, { lat: 42.3560, lon: -83.0660 }, { lat: 42.3710, lon: -83.0730 }] },
];

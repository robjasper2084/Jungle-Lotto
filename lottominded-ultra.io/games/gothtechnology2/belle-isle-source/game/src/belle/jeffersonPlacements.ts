/**
 * Explicit Jefferson presentation allowlist for the isolated staging candidate.
 * Coordinates are game metres: x east, y up, z south. These are original,
 * fictional skins on existing mapped buildings, not surveyed building replicas.
 * Source checks are recorded in docs/JEFFERSON_PLACEMENT_AUDIT.md.
 * Native visual review and the unchanged performance gates are still required.
 */
export const JEFFERSON_BUILDING_PLACEMENTS = [
  {
    buildingId: 'detroit-38139',
    prototype: 'JEF_detroit_38139',
    sourcePrototype: 'SunsetBlock4',
    yawOffset: 0,
    reviewedReference: 'main 893f7698 districts detroit-38139; original DIGITAL STATIC workshop; exact mapped footprint adaptation; source fit/frontage audit; visual review pending',
  },
  {
    buildingId: '886253052',
    prototype: 'JEF_886253052',
    sourcePrototype: 'SunsetBlock1',
    yawOffset: 0,
    reviewedReference: 'main 893f7698 districts 886253052; original RIVERFRONT MARKET; exact mapped footprint adaptation; source fit/frontage audit; visual review pending',
  },
] as const;

/** Provenance only: never substitute this record for live map/collision data. */
export const JEFFERSON_BUILDING_SOURCE_AUDIT = [
  {
    buildingId: 'detroit-38139',
    source: 'src/belle/detroitDistricts.json',
    fit: { x: -757.1795249304957, z: 426.11482169429087, yaw: -2.6173879483236124, w: 22.401600266114954, d: 17.75915619760116, h: 6.8 },
    originalPoints: [
      [-742.77, 428.25], [-761.45, 439.05], [-763.92, 434.82],
      [-764.99, 435.37], [-769.02, 428.47], [-767.95, 427.91],
      [-770.5, 423.35], [-751.82, 412.55], [-742.77, 428.25],
    ],
    nearestJeffersonRoad: 'city-35309',
    roadFrontPoint: [-771.7077395538006, 401.1367240598696],
    roadDistance: 28.89592326913077,
    frontDirectionDot: 0.9999966095582201,
    originalGround: 2,
  },
  {
    buildingId: '886253052',
    source: 'src/belle/detroitDistricts.json',
    fit: { x: -1955.355, z: 1052.185, yaw: 0.521608874601122, w: 20.73626373287612, d: 17.889146602356487, h: 9.899999999999999 },
    originalPoints: [
      [-1969.07, 1049.54], [-1950.73, 1039], [-1941.64, 1054.83],
      [-1959.98, 1065.37], [-1969.07, 1049.54],
    ],
    nearestJeffersonRoad: 'city-34922',
    roadFrontPoint: [-1938.8654802931492, 1080.574293258374],
    roadDistance: 32.83072085520793,
    frontDirectionDot: 0.999989419318266,
    originalGround: 2,
  },
] as const;

const WORKSHOP_ROUTE = [
  [0, 0], [-14.17, -11.62], [-152.42, 66.94], [-186.42, 76.98],
  [-210.81, 86.64], [-232.59, 96.39], [-265.97, 109.61],
  [-367.99, 166.19], [-418.33, 195.47], [-472.23, 226.81],
  [-521.04, 255.28], [-540.45, 266.55], [-576.95, 287.83],
  [-610.86, 307.52], [-641.29, 325.14], [-683.05, 349.57],
  [-823.572698, 431.303363],
] as const;

const MARKET_APPROACH = [
  [-2181.05, 1221.65], [-2185.69, 1225.27], [-2175.69, 1219.22],
  [-2158.85, 1209.12], [-2144.35, 1200.53], [-2000.7, 1116.49],
] as const;

/**
 * Route planning data for native input only. Do not assign player or camera
 * state from these coordinates. The Dequindre anchor is reached through the
 * existing visible Guide action, then the listed route is walked normally.
 * Source point sampling is not a substitute for a native route recording.
 */
export const JEFFERSON_CAMERA_TARGETS = [
  {
    id: 'jefferson-workshop-wide',
    buildingId: 'detroit-38139',
    x: -823.572698, z: 431.303363,
    view: [-823.572698, 431.303363],
    lookAt: [-757.1795249304957, 5.4, 426.11482169429087],
    signLookAt: [-766.9314639486762, 6.869166135787964, 421.3020398826117],
    center: [-757.1795249304957, 426.11482169429087],
    height: 6.8, width: 22.401600266114954, depth: 17.75915619760116,
    buildingYaw: -2.6173879483236124,
    yaw: 1.6487865338952563,
    viewHeading: 1.6487865338952563,
    routeAnchor: 'spawn',
    route: WORKSHOP_ROUTE,
    purpose: 'Workshop front and corner, roofline and DIGITAL STATIC sign; wide portrait framing candidate',
  },
  {
    id: 'jefferson-market-front',
    buildingId: '886253052',
    x: -1938.86548, z: 1080.574293,
    view: [-1938.86548, 1080.574293],
    lookAt: [-1955.355, 6.95, 1052.185],
    signLookAt: [-1952.6480470046893, 4.87523481696844, 1061.1167630426794],
    center: [-1955.355, 1052.185],
    height: 9.899999999999999, width: 20.73626373287612, depth: 17.889146602356487,
    buildingYaw: 0.521608874601122,
    yaw: -2.615383615058069,
    viewHeading: -2.615383615058069,
    routeAnchor: 'dequindre-guide',
    route: [...MARKET_APPROACH, [-1938.86548, 1080.574293]],
    purpose: 'Market storefront, RIVERFRONT MARKET lettering, window and material detail',
  },
  {
    id: 'jefferson-market-wide',
    buildingId: '886253052',
    x: -1990.74852, z: 1110.709824,
    view: [-1990.74852, 1110.709824],
    lookAt: [-1955.355, 6.95, 1052.185],
    signLookAt: [-1952.6480470046893, 4.87523481696844, 1061.1167630426794],
    center: [-1955.355, 1052.185],
    height: 9.899999999999999, width: 20.73626373287612, depth: 17.889146602356487,
    buildingYaw: 0.521608874601122,
    yaw: 2.5976799086227644,
    viewHeading: 2.5976799086227644,
    routeAnchor: 'dequindre-guide',
    route: [...MARKET_APPROACH, [-1990.74852, 1110.709824]],
    purpose: 'Market front and corner, complete height and roofline; wide portrait framing candidate',
  },
] as const;

/**
 * Metre-authored slender signs on mapped land, outside existing road/path and
 * obstacle clearance. The adapter performs these checks again at load time.
 * These placements deliberately add no collision registrations.
 */
export const JEFFERSON_PROP_PLACEMENTS = [
  {
    id: 'jefferson-workshop-wayfinding',
    prototype: 'JEF_BelleIsleWayfinding',
    x: -758.759, z: 407.487,
    yaw: -2.6147839346155446,
    reviewedReference: 'main 893f7698 source terrain2m; mapped land; obstacle radius1.26m clear; all mapped road/path margin at least3.1896m; visual review pending',
    collisionPolicy: 'visual-only',
  },
  {
    id: 'jefferson-market-street-sign',
    prototype: 'JEF_JeffersonStreetSign',
    x: -1951.81, z: 1074.216,
    yaw: 0.5262090268578408,
    reviewedReference: 'main 893f7698 source terrain2m; mapped land; obstacle radius1.26m clear; all mapped road/path margin at least3.1896m; visual review pending',
    collisionPolicy: 'visual-only',
  },
] as const;

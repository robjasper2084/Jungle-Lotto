import type {WaterfowlRoute} from './waterfowlPlan.ts';

/** Art-directed placements validated against the committed OSM water/road map.
 * Individual bird positions are not a wildlife census or Street View extraction.
 * Static plans avoid random sampling, GIS loops or fetching during first paint.
 */
const swanLocations:readonly (readonly [string,number,number,number,number])[]=[["Lake Tacoma",957.273,1400.941,3.136,1.827],["Lake Tacoma",1127.742,1393.127,2.788,3.079],["Lake Tacoma",1393.05,1232.539,1.883,1.813],["Lake Tacoma",535.692,1427.627,2.747,2.405],["Lake Muskoday",2537.274,-127.744,2.251,2.585],["Lake Muskoday",2729.708,-147.794,2.815,2.859],["Lake Muskoday",2598.296,-140.331,3.068,3.06],["Lake Muskoday",2847.015,-228.827,2.605,2.993],["Lake Okonoka",2872.987,747.967,2.148,2.532],["Lake Okonoka",3411.155,477.773,2.015,2.664],["Lake Okonoka",3403.758,389.064,2.374,2.436],["Lake Okonoka",3424.512,499.973,2.361,2.236],["Blue Heron Lagoon",3701.087,-134.762,1.962,2.055],["Blue Heron Lagoon",3444.375,115.445,1.953,2.687],["Blue Heron Lagoon",3623.971,145.99,2.946,1.844],["Blue Heron Lagoon",3391.811,18.877,2.51,2.784],["West Lagoon",117.194,1247.049,1.825,2.295],["West Lagoon",37.97,1337.591,2.393,3.053],["West Lagoon",68.685,1271.833,2.966,1.877],["West Lagoon",27.56,1386.814,2.142,2.407]];
export const LAKE_SWANS:readonly WaterfowlRoute[]=swanLocations.map(([habitat,x,z,rx,rz],index)=>({
 species:'swan',plumage:'white',habitat,x,z,rx,rz,period:58+index*3,phase:index*1.241
}));
const coast:Record<'north'|'south',readonly (readonly [number,number])[]> = {
 north:[[2563.31,-282.94],[2562.52,-276.99],[2567.15,-281.42],[2566.62,-277.46],[3082.97,-268.88],[3077.21,-270.54],[3080.9,-265.32],[3077.06,-266.42],[3245.35,-263.95],[3239.36,-264.38],[3244.06,-260.03],[3240.07,-260.32],[3748.05,-247.86],[3742.26,-249.41],[3746.05,-244.25],[3742.19,-245.28]],
 south:[[-181.18,1423.98],[-184.89,1428.69],[-178.65,1427.24],[-181.13,1430.38],[1132.16,1452.82],[1137.48,1450.04],[1131.19,1448.81],[1134.73,1446.96],[1518.19,1332.77],[1523.82,1330.69],[1517.74,1328.67],[1521.5,1327.29],[1902.33,1210.71],[1907.92,1208.53],[1901.81,1206.62],[1905.53,1205.16]]
};
const strand:readonly (readonly [number,number])[]=[[2064.22,3.68],[2057.79,10.33],[2051.36,16.97],[2045.55,22.97],[2040.36,28.34],[2035.17,33.7],[2029.98,39.06],[2024.79,44.43],[2019.6,49.79],[2014.42,55.16],[2009.09,60.68],[2003.62,66.38],[1998.15,72.07],[1992.68,77.77],[3742.08,-256.49]];
export type ShoreBird={kind:'goose'|'wader';sector:'north'|'south'|'beach';x:number;z:number;yaw:number;phase:number;habitat:string};
export const SHORE_BIRDS:readonly ShoreBird[]=[
 ...(['north','south'] as const).flatMap((sector,part)=>coast[sector].map(([x,z],index)=>({
  kind:'goose' as const,sector,x,z,
  yaw:(((index>>2)*1.35+part*.4)%6.28),phase:index*.79+part*1.3,
  habitat:sector+' shore flock '+(1+Math.floor(index/4))
 }))),
 ...strand.map(([x,z],index)=>({
  kind:'wader' as const,sector:'beach' as const,x,z,
  yaw:-.77,phase:index*.68,habitat:index===14?'Hipster Beach':'Belle Isle Beach'
 }))
];

/** Lightweight evasive rise and return: no physics/collision ownership. */
export const AVIAN_FLIGHT_SECONDS=4.5;
export function avianFlightHeight(elapsed:number,kind:'goose'|'wader'|'swan'){
 if(!Number.isFinite(elapsed)||elapsed<=0||elapsed>=AVIAN_FLIGHT_SECONDS)return 0;
 const t=elapsed/AVIAN_FLIGHT_SECONDS;
 return (kind==='wader'?2.1:kind==='swan'?3.8:5)*Math.sin(Math.PI*t);
}
/** Sub-metre deterministic idle motion; never drives a bird across roads. */
export function shoreBirdWander(phase:number,time:number){
 const t=Math.max(0,Number.isFinite(time)?time:0);
 return {along:Math.sin(t*.27+phase)*.27,across:Math.cos(t*.19+phase*.61)*.15,head:Math.sin(t*.91+phase)*.055};
}

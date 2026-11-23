export type BoatKind='offshore'|'hydroplane';
/** Research-informed game profiles, not a certified marine engineering model.
 * Reverse/brake are exploration assists. Engine output/turning/drag are modeled.
 * Physical reference sources are recorded in boat-provenance.json. */
export const BOAT_PROFILES={
 offshore:{name:'Offshore speedboat',asset:'speedboat.glb',length:8.2,beam:2.5,height:1.7,mass:2100,powerWatts:448000,maxThrust:10000,maxSpeed:44,idleRpm:600,maxRpm:6400,drag:6,turnRate:.50,planeStart:5,planeEnd:14},
 hydroplane:{name:'Unlimited hydroplane',asset:'hydroplane.glb',length:9.2,beam:4.2,height:2.4,mass:3062,powerWatts:2237100,maxThrust:31000,maxSpeed:90,idleRpm:0,maxRpm:16000,drag:4,turnRate:.34,planeStart:10,planeEnd:30}
} as const;
export const boatClamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,Number.isFinite(n)?n:0));

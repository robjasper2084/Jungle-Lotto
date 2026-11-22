/**
 * Greater Detroit physical-transition math. Real geography is used as an
 * independent shared frame; no speculative terrain meshes are generated.
 * All regions use a shared east / up / south coordinate convention (metres).
 *
 * This is a guarded adapter for future one-renderer world integration, not an
 * installed world host or proof of collision-connected playable travel.
 */
export type District='belle-isle'|'swoop-detroit'|'elmwood';
export type Point=Readonly<{x:number;z:number}>;
export type Position=Readonly<{x:number;y:number;z:number}>;
export type Geo=Readonly<{lat:number;lon:number}>;
export const BELLE_ORIGIN=Object.freeze({lat:42.34680,lon:-83.00175});
export const SWOOP_ORIGIN=Object.freeze({lat:42.3283,lon:-83.0399});
export const ELMWOOD_ANCHOR=Object.freeze({lat:42.3492177,lon:-83.0196698,x:-153.6358,north:468.1876});
export const ELMWOOD_GATE=Object.freeze({x:-14,north:-34});
export const MACARTHUR=Object.freeze({
  island:{lat:42.34535,lon:-83.00060},
  mainland:{lat:42.33985,lon:-82.99648},
  source:'Belle Isle OSM-derived prepare-map.mjs endpoint anchors; check against current map.json'
});
const R=111320,rad=Math.PI/180,c30=Math.sqrt(3)/2;
const valid=(n:number)=>{if(!Number.isFinite(n))throw new RangeError('Nonfinite world position');return n;};
const validGeo=(p:Geo)=>{valid(p.lat);valid(p.lon);if(Math.abs(p.lat)>90||Math.abs(p.lon)>180)throw new RangeError('Invalid WGS84 coordinate');};
export function toGlobalGeo(district:District,point:Point):Geo{
 valid(point.x);valid(point.z);
 if(district==='belle-isle')return {lat:BELLE_ORIGIN.lat-point.z/R,lon:BELLE_ORIGIN.lon+point.x/(R*Math.cos(BELLE_ORIGIN.lat*rad))};
 if(district==='swoop-detroit'){
  const east=-.5*point.x-c30*point.z,north=c30*point.x-.5*point.z;
  return {lat:SWOOP_ORIGIN.lat+north/R,lon:SWOOP_ORIGIN.lon+east/(R*Math.cos(SWOOP_ORIGIN.lat*rad))};
 }
 if(district==='elmwood'){
  const dx=point.x-ELMWOOD_ANCHOR.x,north=-point.z-ELMWOOD_ANCHOR.north;
  const gamma=Math.atan(Math.tan((ELMWOOD_ANCHOR.lon+81)*rad)*Math.sin(ELMWOOD_ANCHOR.lat*rad));
  const east=dx*Math.cos(gamma)+north*Math.sin(gamma);
  const n=-dx*Math.sin(gamma)+north*Math.cos(gamma);
  return {lat:ELMWOOD_ANCHOR.lat+n/R,lon:ELMWOOD_ANCHOR.lon+east/(R*Math.cos(ELMWOOD_ANCHOR.lat*rad))};
 }
 throw new RangeError('Unknown district');
}
export function fromGlobalGeo(district:District,geo:Geo):Point{
 validGeo(geo);
 if(district==='belle-isle')return {x:(geo.lon-BELLE_ORIGIN.lon)*R*Math.cos(BELLE_ORIGIN.lat*rad),z:(BELLE_ORIGIN.lat-geo.lat)*R};
 if(district==='swoop-detroit'){
  const east=(geo.lon-SWOOP_ORIGIN.lon)*R*Math.cos(SWOOP_ORIGIN.lat*rad),north=(geo.lat-SWOOP_ORIGIN.lat)*R;
  return {x:-.5*east+c30*north,z:-c30*east-.5*north};
 }
 if(district==='elmwood'){
  const east=(geo.lon-ELMWOOD_ANCHOR.lon)*R*Math.cos(ELMWOOD_ANCHOR.lat*rad);
  const north=(geo.lat-ELMWOOD_ANCHOR.lat)*R;
  const gamma=Math.atan(Math.tan((ELMWOOD_ANCHOR.lon+81)*rad)*Math.sin(ELMWOOD_ANCHOR.lat*rad));
  return {x:ELMWOOD_ANCHOR.x+east*Math.cos(gamma)-north*Math.sin(gamma),
   z:-(ELMWOOD_ANCHOR.north+east*Math.sin(gamma)+north*Math.cos(gamma))};
 }
 throw new RangeError('Unknown district');
}
export function sharedFromGeo(geo:Geo):Point{
 validGeo(geo);
 return {x:(geo.lon-BELLE_ORIGIN.lon)*R*Math.cos(BELLE_ORIGIN.lat*rad),z:(BELLE_ORIGIN.lat-geo.lat)*R};
}
export function geoFromShared(point:Point):Geo{return toGlobalGeo('belle-isle',point);}
export function toShared(district:District,point:Point):Point{return sharedFromGeo(toGlobalGeo(district,point));}
export function fromShared(district:District,point:Point):Point{return fromGlobalGeo(district,geoFromShared(point));}

/** Real bridge deck endpoint anchors in the SAME metres as the world frame. */
export function macarthurAnchorPair(){
 return {island:sharedFromGeo(MACARTHUR.island),mainland:sharedFromGeo(MACARTHUR.mainland)};
}
export function macarthurBridgePoint(t:number):Point{
 if(!Number.isFinite(t)||t<0||t>1)throw new RangeError('Bridge fraction must be within [0,1]');
 const {island,mainland}=macarthurAnchorPair();
 return {x:island.x+(mainland.x-island.x)*t,z:island.z+(mainland.z-island.z)*t};
}
export function elmwoodGateShared():Point{return toShared('elmwood',{x:ELMWOOD_GATE.x,z:-ELMWOOD_GATE.north});}
export type WorldPose=Readonly<{position:Position;headingY:number;speedMps:number;}>;
export type Seam=Readonly<{source:District;destination:District;sourceGroundY:number;destinationGroundY:number;
 geometryAligned:boolean;collisionContinuous:boolean;navLinkReady:boolean;assetPreloaded:boolean;
 verticalDatumVerified:boolean}>;
/**
 * Transform rider pose only when BOTH physical worlds and the actual collider
 * seam have been verified. A location URL link or drawn bridge is insufficient.
 * Heading and momentum are preserved through the rotated Swoop coordinate frame.
 */
export function transferAcrossVerifiedSeam(pose:WorldPose,seam:Seam):WorldPose {
 const {position,headingY,speedMps}=pose;
 if(!Number.isFinite(position.x)||!Number.isFinite(position.y)||!Number.isFinite(position.z)||!Number.isFinite(headingY)||!Number.isFinite(speedMps))throw new RangeError('Invalid physical pose');
 if(!['belle-isle','swoop-detroit','elmwood'].includes(seam.source)||!['belle-isle','swoop-detroit','elmwood'].includes(seam.destination)||seam.source===seam.destination)throw new RangeError('Invalid distinct districts');
 if(![seam.geometryAligned,seam.collisionContinuous,seam.navLinkReady,seam.assetPreloaded,seam.verticalDatumVerified].every(Boolean)||
 !Number.isFinite(seam.sourceGroundY)||!Number.isFinite(seam.destinationGroundY))
 throw new Error('Refusing unverified physical district seam');
 const here=toGlobalGeo(seam.source,{x:position.x,z:position.z});
 const next=fromGlobalGeo(seam.destination,here);
 // Convert the heading using a locally projected one-metre forward displacement.
 const advance=toGlobalGeo(seam.source,{x:position.x+Math.sin(headingY),z:position.z+Math.cos(headingY)});
 const forward=fromGlobalGeo(seam.destination,advance);
 const dx=forward.x-next.x,dz=forward.z-next.z;
 if(Math.hypot(dx,dz)<.8||Math.hypot(dx,dz)>1.2)throw new Error('World scale/basis mismatch across seam');
 return {position:{x:next.x,y:seam.destinationGroundY+position.y-seam.sourceGroundY,z:next.z},
  headingY:Math.atan2(dx,dz),speedMps};
}
export type Portal=Readonly<{id:string;from:District;to:District;connected:boolean;reason:string}>;
/** Verified state MUST come from engine collision data, never a claim in JSON. */
export function portalStates():readonly Portal[]{
 return Object.freeze([
  {id:'macarthur-to-mainland',from:'belle-isle',to:'swoop-detroit',connected:false,
   reason:'Existing Swoop detailed map does not yet reach East Grand / Jefferson landing; must author roadway, nav/collider and measured elevation seam'},
  {id:'elmwood-avenue-entrance',from:'swoop-detroit',to:'elmwood',connected:false,
   reason:'Shared Elmwood gate is georeferenced, but adjoining city street/entrance collision and route mesh are not yet stitched'},
 ]);
}

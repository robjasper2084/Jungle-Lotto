import config from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/cut-geospatial.json' with {type:'json'};
import {REAL_LOCATION_ORIGIN, REAL_LOCATION_METRES_PER_DEGREE} from '../../../lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/src/belle/realLocation.ts';

export type Vector = {x:number;y:number;z:number};

/** The existing Swoop cartography uses these exact constants in gpsAt(). */
const SOURCE_LATITUDE=42.3283, SOURCE_LONGITUDE=-83.0399, S=.8660254, C=.5;
const K=Math.cos(REAL_LOCATION_ORIGIN[1]*Math.PI/180)/Math.cos(SOURCE_LATITUDE*Math.PI/180);
export const SWOOP_MAP_ORIGIN=Object.freeze({x:config.origin.map[0],y:(config.origin.trailDatumFeet-138)*.3048,z:config.origin.map[1]});
/** Atwater's source street datum is zero; the same mainland surface in Belle is 2m. */
export const SWOOP_MAP_HEIGHT_OFFSET=2;
export const SWOOP_LOCAL_HEIGHT_OFFSET=SWOOP_MAP_ORIGIN.y+SWOOP_MAP_HEIGHT_OFFSET;
const EAST_OFFSET=REAL_LOCATION_METRES_PER_DEGREE*Math.cos(REAL_LOCATION_ORIGIN[1]*Math.PI/180)*(SOURCE_LONGITUDE-REAL_LOCATION_ORIGIN[0]);
const SOUTH_OFFSET=-REAL_LOCATION_METRES_PER_DEGREE*(SOURCE_LATITUDE-REAL_LOCATION_ORIGIN[1]);
const A=K*C, B=-K*S, D=S, E=C, DET=A*E-B*D;
const TX=EAST_OFFSET-K*C*SWOOP_MAP_ORIGIN.x-K*S*SWOOP_MAP_ORIGIN.z;
const TZ=SOUTH_OFFSET-S*SWOOP_MAP_ORIGIN.x+C*SWOOP_MAP_ORIGIN.z;
const IA=E/DET, IB=-B/DET, ID=-D/DET, IE=A/DET;

export const SWOOP_MIN_SCALE=Math.min(K,1)*Math.hypot(S,C);
export const SWOOP_MAX_SCALE=Math.max(K,1)*Math.hypot(S,C);
/** Column-major matrix for the existing right-handed Swoop render root. */
export const SWOOP_TO_BELLE_MATRIX=[A,0,D,0, 0,1,0,0, B,0,E,0, TX,SWOOP_LOCAL_HEIGHT_OFFSET,TZ,1];

/** Swoop LOCAL (GeoTerrain / renderer) coordinates to the common Belle world. */
export function fromSwoop(x:number,y:number,z:number,out:Vector={x:0,y:0,z:0}):Vector {
  out.x=A*x+B*z+TX;out.y=y+SWOOP_LOCAL_HEIGHT_OFFSET;out.z=D*x+E*z+TZ;return out;
}
export function toSwoop(x:number,y:number,z:number,out:Vector={x:0,y:0,z:0}):Vector {
  const px=x-TX,pz=z-TZ;out.x=IA*px+IB*pz;out.y=y-SWOOP_LOCAL_HEIGHT_OFFSET;out.z=ID*px+IE*pz;return out;
}
/** The source MAP frame is reflected in X relative to its render/simulation frame. */
export function fromSwoopMap(x:number,y:number,z:number,out:Vector={x:0,y:0,z:0}):Vector {
  return fromSwoop(SWOOP_MAP_ORIGIN.x-x,y-SWOOP_MAP_ORIGIN.y,z-SWOOP_MAP_ORIGIN.z,out);
}
export function toSwoopMap(x:number,y:number,z:number,out:Vector={x:0,y:0,z:0}):Vector {
  toSwoop(x,y,z,out);out.x=SWOOP_MAP_ORIGIN.x-out.x;out.y+=SWOOP_MAP_ORIGIN.y;out.z+=SWOOP_MAP_ORIGIN.z;return out;
}
export {fromSwoopMap as fromSourceMap,toSwoopMap as toSourceMap};
export function fromSwoopDirection(x:number,y:number,z:number,out:Vector={x:0,y:0,z:0}):Vector {
  out.x=A*x+B*z;out.y=y;out.z=D*x+E*z;return out;
}
export function toSwoopDirection(x:number,y:number,z:number,out:Vector={x:0,y:0,z:0}):Vector {
  out.x=IA*x+IB*z;out.y=y;out.z=ID*x+IE*z;return out;
}
export function toSwoopMapDirection(x:number,y:number,z:number,out:Vector={x:0,y:0,z:0}):Vector {
  toSwoopDirection(x,y,z,out);out.x=-out.x;return out;
}
/** Normals use inverse-transpose, not the point/vector matrix (projection is affine). */
export function fromSwoopNormal(x:number,y:number,z:number,out:Vector={x:0,y:0,z:0}):Vector {
  const nx=IA*x+ID*z,nz=IB*x+IE*z,n=Math.hypot(nx,y,nz)||1;
  out.x=nx/n;out.y=y/n;out.z=nz/n;return out;
}
export function fromSwoopHeading(heading:number):number {
  const v=fromSwoopDirection(Math.sin(heading),0,Math.cos(heading));return Math.atan2(v.x,v.z);
}
export function toSwoopHeading(heading:number):number {
  const v=toSwoopDirection(Math.sin(heading),0,Math.cos(heading));return Math.atan2(v.x,v.z);
}

export type SourceRay={origin:Vector;direction:Vector;scale:number;maxDistance:number};
/** A source ray parameter must be converted back by scale to remain a world metre. */
export function toSwoopRay(origin:Vector,direction:Vector,maxDistance:number,out?:SourceRay):SourceRay|null {
  const length=Math.hypot(direction.x,direction.y,direction.z);
  if(!Number.isFinite(length)||length<1e-12||!Number.isFinite(maxDistance)||maxDistance<0)return null;
  const result=out??{origin:{x:0,y:0,z:0},direction:{x:0,y:0,z:0},scale:1,maxDistance:0};
  toSwoop(origin.x,origin.y,origin.z,result.origin);
  toSwoopDirection(direction.x/length,direction.y/length,direction.z/length,result.direction);
  result.scale=Math.hypot(result.direction.x,result.direction.y,result.direction.z);
  result.direction.x/=result.scale;result.direction.y/=result.scale;result.direction.z/=result.scale;
  result.maxDistance=maxDistance*result.scale;return result;
}

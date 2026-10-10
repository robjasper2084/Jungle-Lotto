import type {TerrainSampler,Vec3} from '../terrain.ts';
export interface BattleTerrain extends TerrainSampler {
 readonly spawns: {position:Vec3;headingY:number}[];
 readonly zones: {x:number;z:number}[];
 readonly supplies?: Vec3[];
 readonly optics?: {p:Vec3;kind:import('./scopes.ts').Scope}[];
 readonly fieldRadii?: readonly number[];
 readonly arenaIdentity: {map:string;arena:string;rules:string;protocol:number;physics:string;collision:string};
 ground(x:number,z:number,referenceY?:number):{height:number};
 clear(x:number,z:number,radius?:number,referenceY?:number):boolean;
 sweep(origin:Vec3,delta:Vec3,radius?:number):number|null;
 line(a:Vec3,b:Vec3,radius?:number):boolean;
 route(from:Vec3,to:Vec3):Vec3[];
}

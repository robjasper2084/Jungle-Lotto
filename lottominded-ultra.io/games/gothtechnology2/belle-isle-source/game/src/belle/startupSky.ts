import type {CloudShape} from './skyModel.ts';
/** Art-directed startup lighting from the supplied Belle Isle photographs.
 * These looks never write the user's clock, weather or multiplayer sky. */
export type StartupSkyLook={hour:number;top:string;horizon:string;warm:string;cloud:string;sun:string;heading:number;elevation:number;clouds:CloudShape;ripples:number;sunset:number};
export const STARTUP_SKIES:readonly StartupSkyLook[]=[
 // Golden river light: broken cloud banks with cool blue-grey shadows.
 {hour:17.45,top:'#35495e',horizon:'#c5a078',warm:'#ffb23e',cloud:'#777b83',sun:'#ffcf7c',heading:.57,elevation:.13,clouds:{coverage:.63,density:.90,stretch:1.6,scale:1.35,overcast:.08},ripples:.12,sunset:.15},
 // Garden light: fine rippled altocumulus and a broad soft golden opening.
 {hour:16.85,top:'#777f86',horizon:'#d6b77b',warm:'#ffe0a1',cloud:'#b3afa3',sun:'#ffe6b2',heading:2.36,elevation:.14,clouds:{coverage:.70,density:.78,stretch:2.5,scale:1.05,overcast:.19},ripples:.86,sunset:.12},
 // Detroit afterglow: dark long cloud banks above a narrow red/orange horizon.
 {hour:18.12,top:'#29374f',horizon:'#d64b28',warm:'#f6aa3d',cloud:'#494458',sun:'#ffb460',heading:-1.25,elevation:-.025,clouds:{coverage:.73,density:.96,stretch:6.4,scale:1.12,overcast:.12},ripples:.08,sunset:1}
];
export function startupSkyLook(index:number){return STARTUP_SKIES[Number.isFinite(index)?((Math.floor(index)%STARTUP_SKIES.length)+STARTUP_SKIES.length)%STARTUP_SKIES.length:0];}
export function startupSun(look:StartupSkyLook):[number,number,number]{const r=Math.cos(look.elevation);return [Math.sin(look.heading)*r,Math.sin(look.elevation),Math.cos(look.heading)*r];}

declare module 'pavement-proof-authored' {
 import type * as T from 'three';
 import type {ParkMap,ParkTerrain,Point} from '../src/belle/terrain.ts';
 export function authoredGrass():T.MeshStandardMaterial;
 export function authoredPoly(points:Point[],height:number,holes?:Point[][]):T.BufferGeometry;
 export function authoredApproaches(scene:T.Scene,data:ParkMap,terrain:ParkTerrain,grass:T.Material):void;
}

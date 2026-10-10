import type {DetroitWorld,Solid} from './world.ts';
/** Scenery registers geometry when building a normal world. A network view
 * instead reads the exported collision world and never adds duplicate bodies. */
export type SceneryWorld=Pick<DetroitWorld,'chunks'|'solids'|'geoMeshes'|'buildingMeshes'|'sampleGround'> & {
 addBox(solid:Solid):void;
 addMesh(vertices:Float32Array,indices:Uint32Array,rideable?:boolean):void;
 addRideSurface(vertices:Float32Array,solidFoundation?:boolean):void;
 step():void;
};

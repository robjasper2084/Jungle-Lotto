import {DetroitWorld,SPOTS,LENGTH} from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/world.ts';
import {GEO} from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/geo-profile.ts';

// Independently construct the unmodified source's map plan. No preview terrain
// adapter, renderer, browser API, game runtime or Rapier initialization is used.
const source=new DetroitWorld();
const inventory={
  sourceRouteMetres:LENGTH,
  terrainChunks:source.chunks.length,
  terrainTriangles:source.chunks.reduce((sum,chunk)=>sum+chunk.indices.length/3,0),
  mappedBuildings:source.buildingMeshes.length,
  geospatialMeshes:source.geoMeshes.length,
  sourceSpots:SPOTS.length,
  overpasses:GEO.bridges.length,
  ramps:GEO.ramps.length,
  minimumStaticColliders:source.chunks.length+source.solids.length+source.geoMeshes.filter(mesh=>mesh.collision!==false).length+source.buildingMeshes.length,
};
console.log(JSON.stringify(inventory));
for(const mesh of [...source.geoMeshes,...source.buildingMeshes])mesh.geometry.dispose();

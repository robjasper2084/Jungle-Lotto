/** Reconstruct the original source-owned collision additions without rendering.
 * The native fixtures independently compare every observed body/corridor hit.
 * This supplements native execution; it never certifies a browser walk. */
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {ParkTerrain,segment} from '../src/belle/terrain.ts';
import {planStreetLights} from '../src/belle/streetLightPlan.ts';
import {planBoulders} from '../src/belle/geology.ts';
import {REFERENCE_STYLE,inSunsetGarden} from '../src/belle/sunsetReferencePolicy.ts';
import {keepOriginalTree} from '../src/belle/surveyVegetation.ts';
import {surveySites} from '../src/belle/surveySites.ts';
import {replacedByCherry} from '../src/belle/treeGrounding.ts';
import {addReferenceIsland} from '../src/belle/referenceIsland.ts';
export async function originalExteriorTerrain(map){
 const terrain=new ParkTerrain(map),solids=[],add=terrain.flightSolids.add.bind(terrain.flightSolids);
 terrain.flightSolids.add=solid=>{solids.push(solid);add(solid);};
 const json=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
 const manifest=await json('../public/belle/nature/manifest.json'),plan=await json('../public/belle/nature/placements.json');
 // Match the original addSurveyVegetation filtering before its tree registration.
 for(const site of surveySites)for(const [dx,dz,height,kind]of site.plants){
  const x=site.anchor[0]+dx,z=site.anchor[1]+dz,y=terrain.height(x,z),half=height*(kind==='tree'?.29:.5);
  if(!terrain.land(x,z)||terrain.obstructed(x,z,.55)||map.roads.some(road=>road.points.some((p,i)=>i>0&&segment(x,z,road.points[i-1],p).d<road.width/2+half+.5)))continue;
  if(kind==='tree')terrain.flightSolids.add({x,z,bottom:y,top:y+height,radius:.28,kind:'tree'});
 }
 // Match addNature's actual source ordering, replacement policy and trunk bounds.
 for(const entry of manifest.trees)for(const p of plan.trees.filter(p=>p.id===entry.id&&(!REFERENCE_STYLE||!inSunsetGarden(p.x,p.z))&&keepOriginalTree(p)&&!replacedByCherry(p)))
  terrain.flightSolids.add({x:p.x,z:p.z,bottom:p.y,top:p.y+Math.max(4,(entry.cardCenter?.[1]??8)*1.3*p.scale),radius:.28*p.scale,kind:'tree'});
 const boulders=planBoulders(map,terrain);terrain.registerBoulders(boulders.map(b=>({x:b.x,z:b.z,bottom:b.y,top:b.y+b.height*.98,radius:b.radius*.78})));
 for(const lamp of planStreetLights(map))terrain.flightSolids.add({x:lamp.x,z:lamp.z,bottom:lamp.y,top:lamp.y+lamp.height,radius:.15,kind:'lamp'});
 const scene=new T.Scene();if(REFERENCE_STYLE)await addReferenceIsland(scene,map,terrain);
 // This isolated scene is never rendered. Release source-builder geometry.
 const geometries=new Set(),materials=new Set();scene.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);for(const m of(Array.isArray(o.material)?o.material:[o.material]))materials.add(m);}});
 for(const g of geometries)g.dispose();for(const m of materials)m.dispose();scene.clear();
 return{terrain,solids,boulderCount:boulders.length};
}

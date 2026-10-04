import * as T from 'three';
import {GLTFLoader} from './compressedGLTFLoader.ts';
import {WATERFRONT,ARETHA} from './waterfrontSite.ts';
import {harborFixtures,HARBOR_GANGWAY,harborGangwayPoints,harborGangwayEdges,DOCK_TOP} from './harborLayout.ts';
import {clearRailSpans,MAPPED_ACCESS,gateDirection} from './waterfrontRails.ts';
import {heightAt,type DetroitWorld} from './world.ts';
import {makeRoadSign} from './roadSigns.ts';
import {roadsidePoint,streetFacingHeading} from './roadsidePlacement.ts';
import {dryStreetSite} from './dryStreetSite.ts';
/** Original Blender art follows refreshed mapped geometry. Finishes/furniture are visual estimates. */
export async function buildWaterfront(scene:T.Scene,world:DetroitWorld,groupAt:(x:number,z:number)=>T.Group){
 const names=['aretha-amphitheatre','aretha-entry','shore-railing','dock-service','harbor-cruiser'];
 const [assets,benchAsset]=await Promise.all([Promise.all(names.map(n=>new GLTFLoader().loadAsync('/exports/waterfront/'+n+'.glb'))),new GLTFLoader().loadAsync('/exports/street-furniture/bench.glb')]);
 for(const asset of assets)asset.scene.traverse(o=>{if((o as T.Mesh).isMesh){o.castShadow=o.receiveShadow=true;const m=(o as T.Mesh).material;for(const material of Array.isArray(m)?m:[m])if(material.name==='White tensile membrane')material.side=T.DoubleSide;}});
 const root=assets[0].scene;root.name=ARETHA.name;root.position.set(ARETHA.x,0,ARETHA.z);groupAt(ARETHA.x,ARETHA.z).add(root);
 root.updateMatrixWorld(true);root.traverse(o=>{if(!(o as T.Mesh).isMesh)return;const m=o as T.Mesh,materials=Array.isArray(m.material)?m.material:[m.material];if(!materials.some(a=>a.name==='Stepped concrete'))return;const geo=m.geometry.clone().applyMatrix4(m.matrixWorld),tri=geo.index?geo.toNonIndexed():geo;world.addRideSurface(tri.attributes.position.array as Float32Array);if(tri!==geo)tri.dispose();geo.dispose();});
 const clone=(index:number,x:number,y:number,z:number,angle=0,scale=1)=>{const o=assets[index].scene.clone(true);o.position.set(x,y,z);o.rotation.y=angle;o.scale.setScalar(scale);groupAt(x,z).add(o);return o;};
 clone(1,-137,0,-1770,.09);
 for(const x of [-142,-132])world.addBox({x,y:3,z:-1770,hx:.7,hy:3,hz:.7,kind:'amphitheatre entry'});
 world.addBox({x:ARETHA.x-27,y:.65,z:ARETHA.z,hx:6,hy:.65,hz:12,kind:'stage'});
 // Support columns share the tent's OSM perimeter, leaving its interior navigable.
 const plan=WATERFRONT.buildings.find(b=>b.id===ARETHA.osmId)!;
 for(let i=0;i<plan.points.length-1;i+=2){const [x,z]=plan.points[i];world.addBox({x,y:3.6,z,hx:.22,hy:3.6,hz:.22,kind:'canopy column'});}
 const metal=new T.MeshStandardMaterial({color:'#273e3d',metalness:.65,roughness:.42}),stone=new T.MeshStandardMaterial({color:'#aea99b',roughness:.92}),water=new T.MeshStandardMaterial({color:'#315e66',roughness:.28,metalness:.25}),wood=new T.MeshStandardMaterial({color:'#847660',roughness:.92});
 function box(x:number,y:number,z:number,w:number,h:number,d:number,m:T.Material,angle=0,solid=false){const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.rotation.y=angle;groupAt(x,z).add(o);if(solid)world.addBox({x,y,z,hx:w/2,hy:h/2,hz:d/2,yaw:angle,kind:'waterfront fixture'});return o;}
 function rail(a:number[],b:number[],height=1.12,railing=true,base?:number,access=true){for(const span of access?clearRailSpans(a,b,MAPPED_ACCESS):[{a,b}]){const dx=span.b[0]-span.a[0],dz=span.b[1]-span.a[1],len=Math.hypot(dx,dz),n=Math.ceil(len/3),ang=Math.atan2(-dz,dx);for(let i=0;i<n;i++){const t=(i+.5)/n,x=span.a[0]+dx*t,z=span.a[1]+dz*t,y=base??Math.max(0,heightAt(x,z));
  if(railing){const o=clone(2,x,y,z,ang);o.scale.x=len/n/3;}else{for(const h of [.14,height-.12])box(x,y+h,z,len/n,.045,.045,metal,ang);for(let k=0;k<8;k++){const u=(i+k/8)/n,px=span.a[0]+dx*u,pz=span.a[1]+dz*u;box(px,y+height/2,pz,.025,height,.025,metal);}}
  world.addBox({x,y:y+height/2,z,hx:len/n/2,hy:height/2,hz:.05,yaw:ang,kind:'mapped waterfront rail'});}}}
 for(const gate of WATERFRONT.gates){const [x,z]=gate.point;if(!world.chunks.some(c=>Math.abs(c.x-x)<50&&Math.abs(c.z-z)<50))continue;const y=Math.max(0,heightAt(x,z)),direction=gateDirection(gate.point);for(const side of [-1,1])box(x+direction[0]*side*2.05,y+.75,z+direction[1]*side*2.05,.10,1.5,.10,metal);}
 // The actual mapped openings are retained: no invented perimeter closes the Riverwalk.
 let fences=0;
 for(const barrier of WATERFRONT.barriers){if(!barrier.points.some(p=>world.chunks.some(c=>Math.abs(c.x-p[0])<50&&Math.abs(c.z-p[1])<50)))continue;
  for(let i=1;i<barrier.points.length;i++){const a=barrier.points[i-1],b=barrier.points[i];if(barrier.tags.barrier==='gate')continue;rail(a,b,barrier.tags.fence_type==='railing'?1.12:1.8,barrier.tags.fence_type==='railing');fences++;}}
 // Pond surfaces use the published polygons; their depressed ground is shared by physics.
 for(const pond of WATERFRONT.ponds){const g=new T.ShapeGeometry(new T.Shape(pond.points.map(p=>new T.Vector2(p[0],-p[1]))));g.rotateX(-Math.PI/2);g.translate(0,-.18,0);const o=new T.Mesh(g,water);o.name='OSM pond '+pond.id;scene.add(o);}
 const fittings=harborFixtures();
 for(const p of fittings.pedestals)clone(3,p.x,DOCK_TOP,p.z,p.heading);
 for(const p of fittings.pilings){box(p.x,-.4,p.z,.22,3.3,.22,wood);box(p.x,1.29,p.z,.25,.09,.25,metal);}
 for(const p of fittings.boats){const o=clone(4,p.x,-.20,p.z,p.heading);o.name='Original decorative harbor cruiser';world.addBox({x:p.x,y:.6,z:p.z,hx:1.65,hy:.85,hz:4.9,yaw:p.heading,kind:'moored boat'});}
 // Floating support underneath the two mapped principal piers.
 for(const [a,b] of [[[-185.829,-1383.747],[-107.324,-1390.462]],[[-174.769,-1339.387],[-103.78,-1345.496]]]){const l=Math.hypot(b[0]-a[0],b[1]-a[1]);box((a[0]+b[0])/2,-.18,(a[1]+b[1])/2,2.20,.34,l,metal,Math.atan2(b[0]-a[0],b[1]-a[1]));}
 const g=HARBOR_GANGWAY,route=harborGangwayPoints(),edges=harborGangwayEdges();
 for(let i=1;i<route.length;i++){
  const a=route[i-1],b=route[i],start=edges[i-1],end=edges[i];
  const verts=new Float32Array([start.left,end.left,start.right,start.right,end.left,end.right].flatMap(p=>[p.x,p.y,p.z]));
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(verts,3));geo.computeVertexNormals();const gangway=new T.Mesh(geo,stone);gangway.name='Mapped harbor access gangway';groupAt(a.x,a.z).add(gangway);world.addRideSurface(verts);
  for(const side of ['left','right']as const){const pa=start[side],pb=end[side];rail([pa.x,pa.z],[pb.x,pb.z],1.12,true,Math.min(a.y,b.y),false);}
 }
 // Dock fingers remain open for mooring. Protect the narrow shoreline spine only.
 rail([-106.88,-1400.25],[-97.15,-1287.72],1.12,true,DOCK_TOP);
 const sign=makeRoadSign('MILLIKEN HARBOR');sign.position.set(g.shore.x+2,0,g.shore.z+3);sign.rotation.y=Math.PI/2;groupAt(g.shore.x,g.shore.z).add(sign);
 // Benches, litter bins and low riverfront lamps stay clear of mapped paths/roadways.
 for(const [x,z] of [[-252,-1737],[-256,-1718],[-115,-1725],[-113,-1572],[-104,-1420]]){
  const bench=benchAsset.scene.clone(true);bench.name='Road-facing waterfront bench';bench.position.set(x,heightAt(x,z),z);bench.rotation.y=streetFacingHeading({x,z});bench.traverse(o=>{if((o as T.Mesh).isMesh)o.castShadow=o.receiveShadow=true;});groupAt(x,z).add(bench);
  const p=roadsidePoint(x+3,z,(px,pz)=>dryStreetSite(px,pz)&&world.chunks.some(c=>Math.abs(c.x-px)<=50&&Math.abs(c.z-pz)<=50));
  if(p){const y=heightAt(p.x,p.z),lamp=new T.Mesh(new T.CylinderGeometry(.055,.055,4.3,8),metal);lamp.name='Dry-ground waterfront lamp';lamp.position.set(p.x,y+2.15,p.z);groupAt(p.x,p.z).add(lamp);box(p.x,y+4.35,p.z,.4,.14,.4,stone);}
 }
 return{buildings:WATERFRONT.buildings.length,fences,boats:fittings.boats.length,ponds:WATERFRONT.ponds.length,source:WATERFRONT.source};
}

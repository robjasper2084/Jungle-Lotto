import * as T from 'three';
import {GLTFLoader} from './compressedGLTFLoader.ts';
import {VALADE,inValadeBeach} from './valadeSite.ts';
import {heightAt,type DetroitWorld} from './world.ts';
import {surfaceUV} from './environmentMaterials.ts';
import {makeRoadSign} from './roadSigns.ts';

/** Original Blender reconstruction. Mapped footprint and inlet geometry; visual
 * estimates for furniture/finishes. No photography is used as geometry texture. */
export async function buildValade(_scene:T.Scene,world:DetroitWorld,groupAt:(x:number,z:number)=>T.Group,skins:Record<string,T.MeshStandardMaterial>){
 const names=['valade-shed','valade-play-towers','valade-barge','valade-chair','valade-musical-garden','valade-picnic-table','valade-bbq'];
 const assets=await Promise.all(names.map(n=>new GLTFLoader().loadAsync('/exports/valade/'+n+'.glb')));
 assets.forEach(a=>a.scene.traverse(o=>{if((o as T.Mesh).isMesh)o.castShadow=o.receiveShadow=true;}));
 function place(index:number,x:number,z:number,y=heightAt(x,z),angle=0){const o=assets[index].scene.clone(true);o.name=names[index];o.position.set(x,y,z);o.rotation.y=angle;groupAt(x,z).add(o);return o;}
 const concrete=skins.sidewalk,metal=new T.MeshStandardMaterial({color:'#354745',metalness:.65,roughness:.42});
 function polygon(points:number[][],y:number,mat:T.Material,name:string,support=false){
  const geo=new T.ShapeGeometry(new T.Shape(points.map(p=>new T.Vector2(p[0],-p[1]))));geo.rotateX(-Math.PI/2);geo.translate(0,y,0);surfaceUV(geo,3);const mesh=new T.Mesh(geo,mat);mesh.name=name;mesh.receiveShadow=true;geo.computeBoundingSphere();const c=geo.boundingSphere!.center;groupAt(c.x,c.z).add(mesh);
  if(support){const tri=geo.toNonIndexed();world.addRideSurface(tri.attributes.position.array as Float32Array);tri.dispose();}return mesh;
 }
 function box(x:number,y:number,z:number,w:number,h:number,d:number,mat:T.Material,angle=0,solid=false){const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.rotation.y=angle;m.castShadow=m.receiveShadow=true;groupAt(x,z).add(m);if(solid)world.addBox({x,y,z,hx:w/2,hy:h/2,hz:d/2,yaw:angle,kind:'Valade fixture'});return m;}
 place(0,VALADE.shed.x,VALADE.shed.z,.12);
 // The roof footprint is a covered, accessible terrace, not a filled building.
 polygon(VALADE.buildings[1].points,.12,concrete,'Valade covered terrace',true);
 const shedLabel=makeRoadSign('ROBERT C. VALADE PARK');shedLabel.position.set(-134,0,-1808);shedLabel.rotation.y=-Math.PI/2;groupAt(-134,-1808).add(shedLabel);
 place(1,VALADE.play.x,VALADE.play.z,.08);
 for(const x of [VALADE.play.x-3.1,VALADE.play.x+3.1])world.addBox({x,y:1.45,z:VALADE.play.z,hx:1.1,hy:1.45,hz:1.1,kind:'Valade play tower'});
 // Sand beach west of the play loops, with red Adirondack chairs facing the river.
 const sand=skins.concrete.clone();sand.color.set('#decaa4');sand.normalScale.set(.16,.16);sand.roughness=.98;
 polygon(VALADE.beach,.035,sand,'Valade sand beach',true);
 let chairs=0;
 for(const [x,z] of [[-240,-1803],[-231,-1804],[-222,-1805],[-241,-1816],[-232,-1817],[-221,-1819]]){
  if(!inValadeBeach(x,z))continue;place(3,x,z,.04,-Math.PI/2);world.addBox({x,y:.48,z,hx:.36,hy:.48,hz:.44,yaw:-Math.PI/2,kind:'beach chair'});chairs++;
 }
 place(4,-178,-1808,.04);world.addBox({x:-178,y:.55,z:-1808,hx:.77,hy:.55,hz:.3,kind:'musical garden'});
 for(const [x,z] of [[-165,-1839],[-177,-1840],[-157,-1891],[-169,-1891]]){place(5,x,z,.07);world.addBox({x,y:.5,z,hx:1,hy:.43,hz:.86,kind:'picnic table'});}
 place(6,-174,-1844,.05);world.addBox({x:-174,y:.58,z:-1844,hx:.55,hy:.53,hz:.27,kind:'barbecue'});
 // Inlet water and shore wall use the recorded shoreline, including its recess.
 polygon(VALADE.inlet,-.30,new T.MeshStandardMaterial({color:'#285d68',roughness:.3,metalness:.35}),'Valade water inlet');
 for(let i=1;i<VALADE.inlet.length;i++){
  const a=VALADE.inlet[i-1],b=VALADE.inlet[i],l=Math.hypot(b[0]-a[0],b[1]-a[1]),angle=Math.atan2(b[0]-a[0],b[1]-a[1]);
  box((a[0]+b[0])/2,-.45,(a[1]+b[1])/2,.20,1.1,l,skins.concrete,angle);
 }
 const bargeX=-256.1,bargeZ=-1862.7,bargeAngle=-.064;
 place(2,bargeX,bargeZ,.12,bargeAngle);polygon(VALADE.barge,.30,skins.concrete,'Barge support deck',true).visible=false;
 // Bridge decks are dry, aligned with mapped crossing points, with side rails.
 for(const path of VALADE.paths.filter(p=>p.bridge))for(let i=1;i<path.points.length;i++){
  const a=path.points[i-1],b=path.points[i],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz),nx=-dz/l,nz=dx/l,w=path.width/2;
  const barge=path.id!=='738063780',ya=barge?(path.id==='1035874247'?.30:.06):.10,yb=barge?(path.id==='1035874247'?.06:.30):.10;
  const verts=new Float32Array([[a[0]+nx*w,ya,a[1]+nz*w],[b[0]+nx*w,yb,b[1]+nz*w],[a[0]-nx*w,ya,a[1]-nz*w],[a[0]-nx*w,ya,a[1]-nz*w],[b[0]+nx*w,yb,b[1]+nz*w],[b[0]-nx*w,yb,b[1]-nz*w]].flat());
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(verts,3));geo.computeVertexNormals();surfaceUV(geo);const deck=new T.Mesh(geo,concrete);deck.name='Valade mapped crossing '+path.id;groupAt(a[0],a[1]).add(deck);world.addRideSurface(verts);
  for(const side of [-1,1]){
   const off=side*(w+.07),angle=Math.atan2(dx,dz);
   box((a[0]+b[0])/2+nx*off,(ya+yb)/2+1.06,(a[1]+b[1])/2+nz*off,.055,.065,l,metal,angle);
   for(let d=0;d<=l;d+=1.3){const t=d/l,x=a[0]+dx*t+nx*off,z=a[1]+dz*t+nz*off,y=ya+(yb-ya)*t;box(x,y+.54,z,.055,1.08,.055,metal);}
   world.addBox({x:(a[0]+b[0])/2+nx*off,y:(ya+yb)/2+.55,z:(a[1]+b[1])/2+nz*off,hx:.07,hy:.55,hz:l/2,yaw:angle,kind:'Valade bridge rail'});
  }
 }
 return {name:'Robert C. Valade Park',models:names.length,chairs,inlet:true,mappedPaths:VALADE.paths.length,source:VALADE.source};
}

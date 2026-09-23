import {signSupports} from './signSupports.ts';
import {buildCutLights} from './cutLights.ts';
import {buildGrassField} from './grassField.ts';
import {bridgeFrame} from './bridges.ts';
import {buildRouteRails} from './routeRails.ts';
import {buildCutLandmarks,buildCutFlowers} from './cutLandmarks.ts';
import {buildRouteArt} from './routeArt.ts';
import {buildTrailPaint} from './trailPaint.ts';
import {buildCutMurals} from './cutMurals.ts';
import {polishSection} from './sectionPolish.ts';
import {buildCity} from './city-render.ts';
import {riverEdge,pointOnCut,CUT_METRES,roadAt} from './geography.ts';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {batchStaticGroup} from './static-batch.ts';
import {DetroitWorld,CUT_STATIONS,hash,heightAt,surfaceAt,cutPoint,cutCoords} from './world.ts';
import type {SurfaceId} from './terrain.ts';
import {GEO,nearestRamp,profileLevel,cutWidth} from './geo-profile.ts';
import {loadEnvironmentMaterials,surfaceUV} from './environmentMaterials.ts';
import {makeTreeBatch,wind} from './trees.ts';
import type {TreeSite} from './trees.ts';
export async function buildScenery(scene:T.Scene,world:DetroitWorld,polish=true){
  const loader=new GLTFLoader(),tl=new T.TextureLoader();
  const names=['asphalt','grass','brick','concrete','limestone','mural_heron','mural_detroit','mural_music'];
  const mats:Record<string,T.MeshStandardMaterial>={};
  await Promise.all(names.map(async n=>{
    const map=await tl.loadAsync('/textures/cut/'+n+'.jpg');
    map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;map.anisotropy=4;
    mats[n]=new T.MeshStandardMaterial({map,roughness:.94,side:n.startsWith('mural')?T.DoubleSide:T.FrontSide});
  }));
  const skins=await loadEnvironmentMaterials();
  for(const key of ['asphalt','grass','concrete']){mats[key].map?.dispose();mats[key].dispose();mats[key]=skins[key];}
  mats.grass.color.set('#78895b');
  const treeTime={value:0},foliage=[skins.elm,skins.maple];for(const material of foliage)wind(material,treeTime);
  const treeBatches:ReturnType<typeof makeTreeBatch>[]=[];
  const steel=new T.MeshStandardMaterial({color:'#263c3e',metalness:.55,roughness:.45});
  const gold=new T.MeshStandardMaterial({color:'#e8c16e',roughness:.7});
  const groups=world.chunks.map(c=>{const g=new T.Group();g.userData.center={x:c.x,z:c.z};scene.add(g);return g;});
  const groupIndex=new Map(world.chunks.map((c,i)=>[Math.floor(c.x/100)+','+Math.floor(c.z/100),groups[i]]));
  const groupAt=(x:number,z:number)=>{
    const key=Math.floor(x/100)+','+Math.floor(z/100);let g=groupIndex.get(key);
    if(!g){g=new T.Group();g.userData.center={x:Math.floor(x/100)*100+50,z:Math.floor(z/100)*100+50};groups.push(g);groupIndex.set(key,g);scene.add(g);}
    return g;
  };
  function mapPlane(w:number,h:number){
    const geometry=new T.PlaneGeometry(w,h),uv=geometry.attributes.uv;
    // Keep writing readable after the map-to-world handedness correction.
    for(let i=0;i<uv.count;i++)uv.setX(i,1-uv.getX(i));return geometry;
  }
  function box(g:T.Group,x:number,y:number,z:number,w:number,h:number,d:number,m:T.Material=mats.concrete,ry=0){
    const geo=new T.BoxGeometry(w,h,d),uv=geo.getAttribute('uv');
    if((m as T.MeshStandardMaterial).map)for(let f=0;f<6;f++)for(let j=0;j<4;j++){const i=f*4+j;uv.setXY(i,uv.getX(i)*(f<2?d:w)/4,uv.getY(i)*(f===2||f===3?d:h)/4);}
    const mesh=new T.Mesh(geo,m);mesh.position.set(x,y,z);mesh.rotation.y=ry;mesh.castShadow=mesh.receiveShadow=true;g.add(mesh);return mesh;
  }
  function label(g:T.Group,text:string,x:number,y:number,z:number,w=5,h=.65,ry=0){
    const c=document.createElement('canvas');c.width=1024;c.height=144;const ctx=c.getContext('2d')!;
    ctx.fillStyle='#12383a';ctx.fillRect(0,0,1024,144);ctx.strokeStyle='#e2e5d9';ctx.lineWidth=3;ctx.strokeRect(9,9,1006,126);
    ctx.fillStyle='#f0eee4';ctx.font='bold 54px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,512,70,970);
    for(const bx of [23,1001])for(const by of [24,120]){ctx.fillStyle='#919c99';ctx.beginPath();ctx.arc(bx,by,4,0,Math.PI*2);ctx.fill();}
    const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;
    const material=new T.MeshStandardMaterial({map,roughness:.8});
    box(g,x,y,z,w+.06,h+.06,.10,steel,ry);
    // Two outward-facing panels keep the text readable when looking back or reversing.
    for(const angle of [ry,ry+Math.PI]){
      const p=new T.Mesh(mapPlane(w,h),material);
      p.position.set(x+Math.sin(angle)*.056,y,z+Math.cos(angle)*.056);p.rotation.y=angle;g.add(p);
    }
  }
  const surfaceMats=[mats.asphalt,mats.grass,mats.brick];
  const si=(s:SurfaceId)=>s==='grass'?1:s==='brick'?2:0;
  world.chunks.forEach((c,index)=>{
    const g=groups[index],geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(c.vertices,3));
    const uv=new Float32Array(c.vertices.length/3*2);for(let i=0;i<c.vertices.length/3;i++){uv[i*2]=c.vertices[i*3]/2-Math.floor(c.x/2);uv[i*2+1]=c.vertices[i*3+2]/2-Math.floor(c.z/2);}
    geo.setAttribute('uv',new T.BufferAttribute(uv,2));const sorted:number[]=[];
    // The mapped road ribbons own the visible trail edge. Painting whole collision
    // triangles as asphalt creates a stair-step fringe outside that smooth edge.
    const visibleSurfaces=c.surfaces.map((s,t)=>{
      if(s==='grass'||s==='brick')return si(s);
      let x=0,z=0;for(let k=0;k<3;k++){const v=c.indices[t*3+k]*3;x+=c.vertices[v]/3;z+=c.vertices[v+2]/3;}
      const cut=cutCoords(x,z);
      return cut.d>300&&Math.abs(cut.u)<110?1:si(s);
    });
    for(let m=0;m<3;m++){const start=sorted.length;for(let t=0;t<c.surfaces.length;t++)if(visibleSurfaces[t]===m)sorted.push(c.indices[t*3],c.indices[t*3+1],c.indices[t*3+2]);geo.addGroup(start,sorted.length-start,m);}
    geo.setIndex(sorted);geo.computeVertexNormals();const mesh=new T.Mesh(geo,surfaceMats);mesh.receiveShadow=true;g.add(mesh);
    const trees:TreeSite[]=[];
    const corridor=cutCoords(c.x,c.z);
    for(let i=0;i<(corridor.d>300&&Math.abs(corridor.u)<55?24:3);i++){const x=c.x-46+hash(index*23+i)*92,z=c.z-46+hash(index*47+i)*92,cut=cutCoords(x,z);
      if(x<riverEdge(z)+22||roadAt(x,z)||surfaceAt(x,z)!=='grass'||Math.abs(cut.u)<12||world.solids.some(s=>Math.abs(s.x-x)<s.hx+4&&Math.abs(s.z-z)<s.hz+4))continue;
      if(Math.abs(cut.d-1600)<12&&cut.u<-8&&cut.u>-30)continue; // Keep the field artwork and its sightline clear.
      if(nearestRamp(x,z).distance<5||world.buildingMeshes.some(b=>{b.geometry.computeBoundingBox();const q=b.geometry.boundingBox!;return x>q.min.x-4&&x<q.max.x+4&&z>q.min.z-4&&z<q.max.z+4;}))continue;
      if(trees.some(t=>Math.hypot(t.x-x,t.z-z)<5))continue;
      trees.push({x,y:heightAt(x,z),z,h:6.5+hash(i+index)*5.5,seed:index*83+i});
    }
    if(trees.length){const batch=makeTreeBatch(trees,skins.bark,foliage,treeTime);batch.group.userData.center={x:c.x,z:c.z};g.add(batch.group);treeBatches.push(batch);}
  });
  // All trail geometry follows the same transformed centreline as the physics.
  for(const s of world.solids.filter(s=>s.kind==='bench'||s.kind==='rock')){
    const g=groupAt(s.x,s.z);
    if(s.kind==='bench'){
      const bench=new T.Group();bench.position.set(s.x,s.y-s.hy,s.z);bench.rotation.y=s.yaw??0;
      for(const x of [-.65,.65])box(bench,x,.27,0,.09,.54,.42,steel);
      for(const z of [-.21,0,.21])box(bench,0,.58,z,1.7,.12,.17,mats.brick);
      g.add(bench);
    }else{
      const mesh=new T.Mesh(new T.IcosahedronGeometry(1,1),mats.limestone);mesh.scale.set(s.hx,s.hy,s.hz);mesh.position.set(s.x,s.y,s.z);mesh.rotation.y=s.yaw??0;mesh.castShadow=mesh.receiveShadow=true;g.add(mesh);
    }
  }
  const container=await loader.loadAsync('/exports/cut/DS_Cut_Freight_Container_01.glb');
  for(let d=30;d<CUT_METRES;d+=8){
    const p=cutPoint(d),g=groupAt(p.x,p.z),y=heightAt(p.x,p.z);
    box(g,p.x,y+.049,p.z,.085,.006,3,gold,pointOnCut(d).heading-Math.PI);

  }
  const lighting=buildCutLights(scene,groupAt);
  // Mapped deck outlines and their colliders share the exact same geometry.
  for(const item of world.geoMeshes){
    item.geometry.computeBoundingSphere();const center=item.geometry.boundingSphere!.center;
    surfaceUV(item.geometry,3);
    const material=item.kind==='wall'?mats.limestone:item.kind==='roadway'?mats.asphalt:item.kind==='sidewalk'?skins.sidewalk:item.kind==='metal'?steel:mats.concrete;
    const mesh=new T.Mesh(item.geometry,material);mesh.name=item.name;mesh.userData.source=item.source;mesh.castShadow=mesh.receiveShadow=true;groupAt(center.x,center.z).add(mesh);
  }
  for(const [i,d]of [382,806,1262,1798,2006,2246].entries()){
    const wall=GEO.walls.reduce((best,w)=>Math.abs(w.at-d)<Math.abs(best.at-d)?w:best),p=cutPoint(wall.at+3.9,wall.offset),g=groupAt(p.x,p.z);
    if(nearestRamp(p.x,p.z).distance<5)continue;
    const ry=p.heading-Math.PI+(wall.offset>0?-Math.PI/2:Math.PI/2),art=new T.Mesh(mapPlane(7.4,wall.height-.08),mats[names[5+i%3]]);
    art.position.set(p.x+Math.sin(ry)*.19,heightAt(p.x,p.z)+wall.height/2,p.z+Math.cos(ry)*.19);art.rotation.y=ry;g.add(art);
  }
  function postSign(name:string,at:number,w=3.4){
    const p=cutPoint(at,-cutWidth(at)/2-1.5),g=groupAt(p.x,p.z),ry=p.heading-Math.PI,y=heightAt(p.x,p.z)+3.5;
    label(g,name.toUpperCase(),p.x,y,p.z,w,.58,ry);
    for(const post of signSupports(p.x,p.z,ry,w,y+.1,heightAt)){box(g,post.x,post.y,post.z,.085,post.height,.085,steel);box(g,post.x,post.base+.14,post.z,.24,.12,.24,mats.concrete);}
  }
  for(const s of CUT_STATIONS){
    const bridge=GEO.bridges.find(b=>b.name===s.name);
    if(!bridge){postSign(s.name,s.at);continue;}
    const f=bridgeFrame(bridge),crossings:number[]=[];
    for(let i=0;i<f.polygon.length;i++){const a=f.polygon[i],b=f.polygon[(i+1)%f.polygon.length];if((a[0]<=0&&b[0]>0)||(b[0]<=0&&a[0]>0))crossings.push(a[1]+(b[1]-a[1])*(-a[0])/(b[0]-a[0]));}
    // Bolt signs onto both approach faces of the deck, above the riding clearance.
    for(const [edge,side] of [[Math.min(...crossings),-1],[Math.max(...crossings),1]]){
      const p=f.point(0,edge+side*.14),g=groupAt(p.x,p.z),ry=Math.atan2(f.matrix.elements[8],f.matrix.elements[10]);
      label(g,s.name.toUpperCase(),p.x,profileLevel(s.at,'street')-.40,p.z,4.2,.58,ry);
      for(const x of [-1.5,1.5]){const mount=f.point(x,edge+side*.06);box(g,mount.x,profileLevel(s.at,'street')-.40,mount.z,.16,.70,.18,steel,ry);}
    }
  }
  for(const r of GEO.ramps)postSign(r.name,r.at);
  for(let i=0;i<9;i++){
    const d=2045+Math.floor(i/3)*9,p=cutPoint(d,-16-(i%3)*8),g=groupAt(p.x,p.z),o=container.scene.clone(true),y=heightAt(p.x,p.z);o.position.set(p.x,y,p.z);o.rotation.y=p.heading;g.add(o);
    world.addBox({x:p.x,y:y+1.3,z:p.z,hx:3,hy:1.3,hz:2,kind:'container',yaw:p.heading});
  }
  const wp=cutPoint(2052,-10),wg=groupAt(wp.x,wp.z);label(wg,'EASTERN MARKET / FREIGHT YARD',wp.x,heightAt(wp.x,wp.z)+3,wp.z,7,.8,wp.heading-Math.PI);for(const post of signSupports(wp.x,wp.z,wp.heading-Math.PI,7,heightAt(wp.x,wp.z)+3.2,heightAt))box(wg,post.x,post.y,post.z,.10,post.height,.10,steel);
  const architecture=await buildCity(scene,world,groupAt,skins);
  const rails=buildRouteRails(world,groupAt,heightAt);
  const landmarks=buildCutLandmarks(world,groupAt,label);
  const flowers=buildCutFlowers(scene,world);
  if(polish)polishSection(groupAt,mats.asphalt);
  const routeArt=polish?await buildRouteArt(world,groupAt):{billboards:0,murals:0};
  if(polish)buildTrailPaint(groupAt);
  const cutMurals=polish?await buildCutMurals(world,groupAt):{walls:0,ceilings:0};
  // Consolidate static geometry by material inside each streamable tile.
  for(const g of groups)batchStaticGroup(g);
  const grass=polish?await buildGrassField(scene,world,mats.grass):undefined;
  world.step();
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)'),mobile=matchMedia('(max-width:700px)');
  const trees=treeBatches.reduce((n,b)=>n+b.count,0);
  return {lighting,materials:mats,architecture,trees,routeArt:{...routeArt,cutMurals},rails,landmarks,flowers:flowers.count,grassClumps:grass?.count??0,skins:8,update(x:number,z:number,time=0){
    lighting.update(x,z);
    treeTime.value=time;
    flowers.update(x,z,document.documentElement.dataset.renderQuality==='compact');
    grass?.update(x,z,time,document.documentElement.dataset.reducedMotion==='true'||reducedMotion.matches,mobile.matches);
    for(const b of treeBatches){const c=b.group.userData.center;b.update(Math.hypot(c.x-x,c.z-z));}
    let visible=0;for(const g of groups){const c=g.userData.center;g.visible=Math.hypot(c.x-x,c.z-z)<(document.documentElement.dataset.renderQuality==='compact'?240:360);if(g.visible)visible++;}return visible;
  }};
}

import * as T from 'three';
import {SHELTER_PROFILES} from './shelterProfiles.ts';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {facilityPlan,type FacilitySite} from './facilityPlan.ts';
import {segment,type Point,type ParkMap} from './terrain.ts';
export function addParkFacilities(scene:T.Scene,map:ParkMap){
 const plan=facilityPlan(map),wood=new T.MeshStandardMaterial({color:0x6c5b40,roughness:.88}),stone=new T.MeshStandardMaterial({color:0xa3a297,roughness:.92}),roof=new T.MeshStandardMaterial({color:0x425047,roughness:.84,side:T.DoubleSide}),iron=new T.MeshStandardMaterial({color:0x303b39,metalness:.55,roughness:.52}),galvanized=new T.MeshStandardMaterial({color:0x929c98,metalness:.65,roughness:.48});
 const tiles=new Map<string,{x:number;z:number;groups:Map<T.Material,T.BufferGeometry[]>;lines:number[]}>(),batches:{object:T.Object3D;x:number;z:number}[]=[];let triangles=0;
 const tile=(x:number,z:number)=>{const key=Math.floor(x/96)+','+Math.floor(z/96);if(!tiles.has(key))tiles.set(key,{x:Math.floor(x/96)*96+48,z:Math.floor(z/96)*96+48,groups:new Map(),lines:[]});return tiles.get(key)!;};
 const add=(g:T.BufferGeometry,m:T.Material,x:number,z:number)=>{const t=tile(x,z);if(!t.groups.has(m))t.groups.set(m,[]);if(g.index){const n=g.toNonIndexed();g.dispose();g=n;}t.groups.get(m)!.push(g);};
 const box=(p:Point,y:number,w:number,h:number,d:number,yaw:number,m:T.Material)=>{const g=new T.BoxGeometry(w,h,d).rotateY(-yaw).translate(p[0],y,p[1]);add(g,m,...p);};
 const bar=(a:Point,b:Point,y:number,h:number,d:number,m:T.Material)=>{const p:Point=[(a[0]+b[0])/2,(a[1]+b[1])/2];box(p,y,Math.hypot(b[0]-a[0],b[1]-a[1]),h,d,Math.atan2(b[1]-a[1],b[0]-a[0]),m);};
 const palette=new Map<number,T.MeshStandardMaterial>();const colored=(color:number)=>{if(!palette.has(color))palette.set(color,new T.MeshStandardMaterial({color,roughness:.9,side:T.DoubleSide}));return palette.get(color)!;};
 const roofFor=(site:FacilitySite,eave:number)=>{
  const ring=site.points.slice(0,-1),p:number[]=[],uv:number[]=[],profile=SHELTER_PROFILES[site.id],rm=profile?colored(profile.roof):roof,tm=profile?colored(profile.trim):wood;
  const radius=Math.max(...ring.map(v=>Math.hypot(v[0]-site.center[0],v[1]-site.center[1]))),rise=profile?.rise??Math.min(2.2,radius*.20),cy=2+eave;
  const vertex=(v:number[])=>{p.push(...v);uv.push(v[0]/3,v[2]/3);};
  const scaled=(v:Point,k:number,y:number)=>[site.center[0]+(v[0]-site.center[0])*k,y,site.center[1]+(v[1]-site.center[1])*k];
  if(profile?.gable){
   const edges=ring.map((a,i)=>{const b=ring[(i+1)%ring.length];return {a,b,l:Math.hypot(b[0]-a[0],b[1]-a[1])};}),longest=edges.reduce((a,b)=>a.l>b.l?a:b),dx=(longest.b[0]-longest.a[0])/longest.l,dz=(longest.b[1]-longest.a[1])/longest.l;
   const local=ring.map(v=>{const x=v[0]-site.center[0],z=v[1]-site.center[1];return [x*dx+z*dz,-x*dz+z*dx];}),u0=Math.min(...local.map(v=>v[0])),u1=Math.max(...local.map(v=>v[0])),v0=Math.min(...local.map(v=>v[1])),v1=Math.max(...local.map(v=>v[1])),mid=(v0+v1)/2;
   const wp=(u:number,v:number,y:number)=>[site.center[0]+u*dx-v*dz,y,site.center[1]+u*dz+v*dx];
   for(const side of [v0,v1]){const a=wp(u0,side,cy),b=wp(u1,side,cy),c=wp(u0,mid,cy+rise),d=wp(u1,mid,cy+rise);for(const v of [a,b,c,b,d,c])vertex(v);}
   for(let i=0;i<ring.length;i++)bar(ring[i],ring[(i+1)%ring.length],cy-.08,.18,.18,tm);
  }else{
  const layers=profile?.flared?[[1,0],[.53,.26],[0,1]]:profile?.cupola?[[1,0],[.19,1]]:[[1,0],[0,1]];
  for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];for(let j=1;j<layers.length;j++){const [k0,h0]=layers[j-1],[k1,h1]=layers[j],a0=scaled(a,k0,cy+rise*h0),b0=scaled(b,k0,cy+rise*h0),a1=scaled(a,k1,cy+rise*h1),b1=scaled(b,k1,cy+rise*h1);for(const v of [a0,b0,a1,b0,b1,a1])vertex(v);}bar(a,b,cy-.08,.22,.22,tm);
   if(profile?.cupola){const aa=scaled(a,.19,cy+rise),bb=scaled(b,.19,cy+rise),top=cy+rise+profile.cupola;for(const y of [0,.20,.4,.6])bar([aa[0],aa[2]],[bb[0],bb[2]],cy+rise+y,.055,.08,tm);box([aa[0],aa[2]],cy+rise+profile.cupola/2,.09,profile.cupola,.09,0,tm);for(const v of [[aa[0],top,aa[2]],[bb[0],top,bb[2]],[site.center[0],top+.65,site.center[1]]])vertex(v);}
  }
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();add(g,rm,...site.center);
 };

 for(const s of plan.shelters){const shape=new T.Shape(s.site.points.map(p=>new T.Vector2(p[0],-p[1]))),g=new T.ShapeGeometry(shape).rotateX(-Math.PI/2).translate(0,2.018,0);add(g,stone,...s.site.center);roofFor(s.site,s.eave);
  for(const p of s.posts){const profile=SHELTER_PROFILES[s.site.id],pm=profile?colored(profile.posts):wood;box(p,2+s.eave/2,profile&&s.site.id==='107202876'?.7:.30,s.eave,profile&&s.site.id==='107202876'?.7:.30,0,pm);box(p,2.16,.58,.32,.58,0,profile?colored(profile.trim):stone);}
  for(const t of s.tables){box(t.p,2.77,2,.12,.75,t.yaw,wood);for(const side of [-1,1]){const p:Point=[t.p[0]-Math.sin(t.yaw)*.58*side,t.p[1]+Math.cos(t.yaw)*.58*side];box(p,2.45,2.15,.10,.27,t.yaw,wood);const leg:Point=[t.p[0]+Math.cos(t.yaw)*.7*side,t.p[1]+Math.sin(t.yaw)*.7*side];box(leg,2.39,.09,.74,1.25,t.yaw,galvanized);}}
 }
 for(const site of map.facilities?.sites||[]){if(site.kind==='shelter')continue;const building=map.buildings.find(b=>b.id===site.id)!;if(site.kind!=='restroom'||site.id!=='368854145')roofFor(site,building.height+.18);
  const edges=site.points.slice(1).map((b,i)=>{const a=site.points[i],p:Point=[(a[0]+b[0])/2,(a[1]+b[1])/2];return{a,b,p,len:Math.hypot(b[0]-a[0],b[1]-a[1]),near:Math.min(...map.roads.filter(r=>r.foot).flatMap(r=>r.points.slice(1).map((q,j)=>segment(p[0],p[1],r.points[j],q).d)))};}).filter(e=>e.len>4).sort((a,b)=>a.near-b.near);const e=edges[0];if(!e)continue;const yaw=Math.atan2(e.b[1]-e.a[1],e.b[0]-e.a[0]);let nx=-Math.sin(yaw),nz=Math.cos(yaw);if(nx*(e.p[0]-site.center[0])+nz*(e.p[1]-site.center[1])<0){nx=-nx;nz=-nz;}
  // Closed service doors, framed vents and restrained signage; these are not enterable interiors.
  const center:Point=[e.p[0]+nx*.16,e.p[1]+nz*.16];const plaque=document.createElement('canvas');plaque.width=512;plaque.height=128;const ctx=plaque.getContext('2d')!;ctx.fillStyle='#22483f';ctx.fillRect(0,0,512,128);ctx.strokeStyle='#c5c9b4';ctx.lineWidth=4;ctx.strokeRect(7,7,498,114);ctx.fillStyle='#f4f1df';ctx.font='bold 49px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(site.kind==='restroom'?'RESTROOMS':'PARK SERVICE',256,64);const tex=new T.CanvasTexture(plaque);tex.colorSpace=T.SRGBColorSpace;const material=new T.MeshStandardMaterial({map:tex,roughness:.75});const label=new T.Mesh(new T.PlaneGeometry(2.7,.68),material);label.position.set(center[0],4.85,center[1]);label.rotation.y=Math.atan2(nx,nz);label.name=site.name+' sign';scene.add(label);batches.push({object:label,x:center[0],z:center[1]});
  const vent:Point=[e.p[0]+Math.cos(yaw)*Math.min(e.len*.25,3.2)+nx*.08,e.p[1]+Math.sin(yaw)*Math.min(e.len*.25,3.2)+nz*.08];box(vent,4.7,.72,.42,.07,yaw,iron);for(let i=0;i<5;i++)box([vent[0]+nx*.045,vent[1]+nz*.045],4.55+i*.075,.65,.025,.05,yaw,galvanized);
 }
 for(const f of map.facilities?.fences||[]){const length=Math.hypot(f.b[0]-f.a[0],f.b[1]-f.a[1]),n=Math.max(1,Math.ceil(length/2.7)),lerp=(t:number):Point=>[T.MathUtils.lerp(f.a[0],f.b[0],t),T.MathUtils.lerp(f.a[1],f.b[1],t)];if(f.style==='stone'){bar(f.a,f.b,2+f.height/2,f.height,.34,stone);continue;}const m=f.style==='iron'?iron:galvanized;
  for(let j=0;j<=n;j++)box(lerp(j/n),2+f.height/2,.06,f.height+.06,.06,0,m);for(const h of [.2,f.height])bar(f.a,f.b,2+h,.035,.035,m);
  if(f.style==='iron'){const count=Math.ceil(length/.22);for(let j=1;j<count;j++)box(lerp(j/count),2+f.height/2,.022,f.height,.022,0,iron);}else{const line=tile(...lerp(.5)).lines;const count=Math.ceil(length/.35),step=length/count;for(let j=0;j<count;j++){const p=lerp(j/count),q=lerp(Math.min(1,(j+1)/count));for(let y=.18;y<f.height-.12;y+=.35){const top=Math.min(f.height,y+step);line.push(p[0],2+y,p[1],q[0],2+top,q[1],p[0],2+top,p[1],q[0],2+y,q[1]);}}}
 }
 for(const g of map.facilities?.gates||[]){const n:Point=[-Math.sin(g.yaw),Math.cos(g.yaw)],d:Point=[Math.cos(g.yaw),Math.sin(g.yaw)];for(const side of [-1,1]){const a:Point=[g.p[0]+n[0]*g.width*.5*side,g.p[1]+n[1]*g.width*.5*side],b:Point=[a[0]+d[0]*2.2,a[1]+d[1]*2.2];box(a,2.6,.14,1.2,.14,0,iron);for(const h of [.3,1.05])bar(a,b,2+h,.07,.07,iron);box(b,2.67,.055,.75,.055,0,iron);for(let j=1;j<6;j++)box([a[0]+d[0]*j*.35,a[1]+d[1]*j*.35],2.67,.03,.75,.03,0,iron);}}
 for(const t of tiles.values()){for(const [material,gs]of t.groups){const g=mergeGeometries(gs)!;gs.forEach(g=>g.dispose());triangles+=g.attributes.position.count/3;const mesh=new T.Mesh(g,material);mesh.name='Mapped park facilities';mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);batches.push({object:mesh,x:t.x,z:t.z});}if(t.lines.length){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(t.lines,3));const lines=new T.LineSegments(g,new T.LineBasicMaterial({color:0x777f77}));lines.name='Mapped chain-link fence';scene.add(lines);batches.push({object:lines,x:t.x,z:t.z});}}
 return{stats:{sites:map.facilities?.sites.length||0,shelters:plan.shelters.length,gates:map.facilities?.gates.length||0,fences:map.facilities?.fences.length||0,triangles},update(x:number,z:number){for(const b of batches)b.object.visible=Math.hypot(x-b.x,z-b.z)<520;}};
}

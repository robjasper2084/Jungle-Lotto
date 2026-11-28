import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {inside,segment,type ParkMap,type ParkTerrain,type Point,type Landmark} from './terrain.ts';
import {districts} from './detroitGround.ts';

export type JeffersonBuildingProfile={
 id:string;name:string;address:string;kind:'garden-court'|'bagley'|'wells'|'stearns'|'pasadena'|'palms';
 floors:number;wallHeight:number;roofHeight:number;rearHeight?:number;reference:string;observations:string;dimensionEvidence:string;
};
/** The address/identity and characteristic architecture are independently sourced.
 * Heights are story/photo estimates except the documented Palms overall height.
 * They do not convert SEMCOG's undocumented median_hgt unit. Original polygons and
 * existing collider records are retained; taller replicas get additive solids. */
export const JEFFERSON_BUILDINGS:readonly JeffersonBuildingProfile[]=[
 {id:'detroit-89989',name:'Frederick Stearns Building',address:'6533 East Jefferson Avenue',kind:'stearns',floors:4,wallHeight:15.6,roofHeight:3.1,rearHeight:31.2,
  reference:'https://tile.loc.gov/storage-services/master/pnp/habshaer/mi/mi0700/mi0746/data/mi0746data.pdf',
  observations:'Four-story red-brick factory frontage, grouped industrial windows, pale belt courses and gabled pavilions; distinct eight-story rear industrial volume.',
  dimensionEvidence:'NPS HAER MI-415 confirms four-story original and eight-story courtyard addition. A 21 × 24 m central tower footprint is an aerial-informed estimate wholly inside the mapped outline. 3.9 m floor spacing and 3.1 m gable rise are estimated.'},
 {id:'868842406',name:'Garden Court Apartments',address:'2900 East Jefferson Avenue',kind:'garden-court',floors:9,wallHeight:31.5,roofHeight:1.1,
  reference:'https://www.detroitphotography.com/architecture/building/garden-court-apartments',
  observations:'Nine-story H-shaped building, limestone lower two stories and top-floor surrounds, dark red brick, projecting window bays, balcony stack and roof balustrade.',
  dimensionEvidence:'Nine stories verified by City East Riverfront report and facade photo; 3.5 m floor spacing and 1.1 m parapet are model estimates.'},
 {id:'114282642',name:'John N. Bagley House',address:'2921 East Jefferson Avenue',kind:'bagley',floors:2,wallHeight:7.5,roofHeight:4.4,
  reference:'https://www.bagleymansion.com/',
  observations:'Red masonry, steep intersecting pitched roofs, street-facing gable, round corner turret and tall chimneys; copper-colored roof edging.',
  dimensionEvidence:'Two wall stories plus roof levels in OSM way 114282642; 7.5 m walls and 4.4 m roof rise are photo-informed model estimates.'},
 {id:'955779335',name:'William H. Wells House',address:'2931 East Jefferson Avenue',kind:'wells',floors:2,wallHeight:7.3,roofHeight:6.0,
  reference:'https://www.detroitphotography.com/architecture/building/william-h-wells-house',
  observations:'Rough brown stone, steep red-brown shingle roof, projecting round turrets, copper finials, stone chimneys and arched lower windows; the broad front-right wing has one story and a dark flat roof.',
  dimensionEvidence:'Two main wall stories and roof living space, plus a one-story flat-roof wing, observed in photograph. Main walls 7.3 m, wing walls 3.65 m and main roof rise 6.0 m are model estimates; height zones retain the original source outline.'},
 {id:'957898908',name:'Pasadena Apartments',address:'2170 East Jefferson Avenue',kind:'pasadena',floors:11,wallHeight:37.4,roofHeight:1.2,
  reference:'https://www.detroitphotography.com/architecture/building/pasadena-apartments',
  observations:'Tall buff-brick apartment building, two projecting bay stacks, pale stone entrance/base, flat roof, cornice and arched upper windows.',
  dimensionEvidence:'Identity/address and 11 levels independently verified in OSM way 957898908. City footprint IoU 0.641 remains below automated join threshold; original OSM outline retained. 3.4 m floor spacing is estimated.'},
 {id:'jefferson-city-8423552-0',name:'The Palms Apartments',address:'1001 East Jefferson Avenue',kind:'palms',floors:6,wallHeight:20.24,roofHeight:1.1,
  reference:'https://tile.loc.gov/storage-services/master/pnp/habshaer/mi/mi0700/mi0746/data/mi0746data.pdf',
  observations:'Six-story limestone street facades, projecting corner bays, U-shaped plan with open red-brick courtyard and a continuous stone roof balustrade.',
  dimensionEvidence:'NPS HAER MI-415 page 43 reports 70 feet (21.34 m), six stories and basement. Overall height is sourced; individual floor and parapet proportions are photo-informed estimates.'},
];
export const JEFFERSON_BUILDING_IDS=new Set(JEFFERSON_BUILDINGS.map(b=>b.id));
type SourceBuilding={id:string;height:number;points:Point[];holes?:Point[][];collisionParts?:Point[][]};
type Edge={a:Point;b:Point;length:number;nx:number;nz:number;yaw:number};
export type JeffersonBuildingPlan={profile:JeffersonBuildingProfile;source:SourceBuilding;base:number;center:Point;front:Point;right:Point;u0:number;u1:number;v0:number;v1:number;edges:Edge[]};

/** A visual height zone shares source vertices and the original local axes.
 * It never replaces the source footprint or the collision plan. */
function footprintPlan(plan:JeffersonBuildingPlan,points:Point[]):JeffersonBuildingPlan{
 const source:SourceBuilding={...plan.source,points,holes:undefined,collisionParts:undefined};
 const uv=points.map(p=>[(p[0]-plan.center[0])*plan.right[0]+(p[1]-plan.center[1])*plan.right[1],(p[0]-plan.center[0])*plan.front[0]+(p[1]-plan.center[1])*plan.front[1]]),edges:Edge[]=[];
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length<.04)continue;
  let nx=dz/length,nz=-dx/length;if(inside((a[0]+b[0])/2+nx*.05,(a[1]+b[1])/2+nz*.05,points)){nx=-nx;nz=-nz;}
  edges.push({a,b,length,nx,nz,yaw:Math.atan2(nx,nz)});
 }
 return{...plan,source,edges,u0:Math.min(...uv.map(p=>p[0])),u1:Math.max(...uv.map(p=>p[0])),v0:Math.min(...uv.map(p=>p[1])),v1:Math.max(...uv.map(p=>p[1]))};
}
type WellsHeightZones={main:JeffersonBuildingPlan;low:JeffersonBuildingPlan;lowHeight:number;join:Edge;isLowEdge:(edge:Edge)=>boolean};
function wellsHeightZones(plan:JeffersonBuildingPlan):WellsHeightZones|undefined{
 if(plan.profile.kind!=='wells')return;
 const points=plan.source.points;
 // Photo-to-outline interpretation recorded in wells-height-zones.json: the
 // broad curved wing uses edges 3..11; chord 3→12 separates its flat roof.
 if(points.length!==55||points[0][0]!==points[54][0]||points[0][1]!==points[54][1])throw Error('Wells height zones require the qualified source outline');
 const main=footprintPlan(plan,[...points.slice(0,4),...points.slice(12,54),points[0]]),low=footprintPlan(plan,[...points.slice(3,13),points[3]]);
 const starts=new Set(points.slice(3,12)),join=main.edges.find(e=>e.a===points[3]&&e.b===points[12])!;
 return{main,low,lowHeight:plan.profile.wallHeight/2,join,isLowEdge:e=>starts.has(e.a)};
}

export function planJeffersonBuildings(map:ParkMap,height:(x:number,z:number)=>number):JeffersonBuildingPlan[]{
 const output:JeffersonBuildingPlan[]=[];
 const roads=[...map.roads.filter(r=>!r.foot&&!r.bridge&&/Jefferson/i.test(r.name)),...districts.roads.filter(r=>/Jefferson/i.test(r.name))];
 for(const profile of JEFFERSON_BUILDINGS){
  const district=districts.buildings.find(b=>b.id===profile.id),source:SourceBuilding|undefined=district??map.buildings.find(b=>b.id===profile.id);
  if(!source)continue;
  const ring=source.points,unique=ring.length>1&&ring[0][0]===ring.at(-1)![0]&&ring[0][1]===ring.at(-1)![1]?ring.slice(0,-1):ring;
  if(unique.length<3||unique.some(p=>!p.every(Number.isFinite)))throw Error('Invalid Jefferson outline '+source.id);
  let signed=0,cx=0,cz=0;
  for(let i=0;i<unique.length;i++){const a=unique[i],b=unique[(i+1)%unique.length],c=a[0]*b[1]-b[0]*a[1];signed+=c;cx+=(a[0]+b[0])*c;cz+=(a[1]+b[1])*c;}
  if(Math.abs(signed)<.01)throw Error('Degenerate Jefferson outline '+source.id);
  const center:Point=[cx/(3*signed),cz/(3*signed)];let distance=Infinity,front:Point=[-.5,-.866];
  for(const road of roads)for(let i=1;i<road.points.length;i++){
   const a=road.points[i-1],b=road.points[i],hit=segment(...center,a,b);
   if(hit.d<distance&&hit.d>.1){distance=hit.d;front=[(a[0]+(b[0]-a[0])*hit.t-center[0])/hit.d,(a[1]+(b[1]-a[1])*hit.t-center[1])/hit.d];}
  }
  const right:Point=[front[1],-front[0]],uv=unique.map(p=>[(p[0]-center[0])*right[0]+(p[1]-center[1])*right[1],(p[0]-center[0])*front[0]+(p[1]-center[1])*front[1]]);
  const edges:Edge[]=[];
  for(const boundary of [unique,...(source.holes??[])])for(let i=0;i<boundary.length;i++){
   const a=boundary[i],b=boundary[(i+1)%boundary.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length<.04)continue;
   const contains=(x:number,z:number)=>inside(x,z,ring)&&!(source.holes??[]).some(h=>inside(x,z,h));
   let nx=dz/length,nz=-dx/length;if(contains((a[0]+b[0])/2+nx*.05,(a[1]+b[1])/2+nz*.05)){nx=-nx;nz=-nz;}
   edges.push({a,b,length,nx,nz,yaw:Math.atan2(nx,nz)});
  }
  output.push({profile,source,base:district?height(...source.points[0])-.1:2,center,front,right,u0:Math.min(...uv.map(p=>p[0])),u1:Math.max(...uv.map(p=>p[0])),v0:Math.min(...uv.map(p=>p[1])),v1:Math.max(...uv.map(p=>p[1])),edges});
 }
 return output;
}

const material=(name:string,color:number,roughness=.85,metalness=0)=>{const m=new T.MeshStandardMaterial({name,color,roughness,metalness,vertexColors:true});return m;};
function masonry(name:string,color:number,stone=false){
 const m=material(name,color);
 m.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec2 jefUV;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\njefUV=uv;');
  shader.fragmentShader='varying vec2 jefUV;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec2 cell=jefUV/vec2(${stone?'.62,.34':'.29,.095'});cell.x+=mod(floor(cell.y),2.)*.5;
   vec2 edge=min(fract(cell),1.-fract(cell));float aa=max(fwidth(cell.x),fwidth(cell.y));
   float mortar=1.-smoothstep(.018,.045+aa,min(edge.x,edge.y));
   float grain=fract(sin(dot(floor(cell),vec2(12.9898,78.233)))*43758.5453);
   diffuseColor.rgb*=mix(.86+grain*.22,${stone?'.78':'.70'},mortar);
  `);
 };m.customProgramCacheKey=()=>stone?'jefferson-cutstone-v1':'jefferson-brick-v1';return m;
}
type Palette=ReturnType<typeof makePalette>;
function makePalette(){return{
 brick:masonry('Jefferson red brick masonry',0x824537),buff:masonry('Jefferson buff brick masonry',0xb39b60),stone:masonry('Jefferson brown fieldstone',0x918171,true),
 limestone:material('Jefferson carved limestone trim',0xc9c6b5,.84),roof:material('Jefferson slate roof shingles',0x513c38,.91),copper:material('Jefferson aged copper',0x538b80,.63,.3),
 glass:material('Jefferson recessed glazing',0x44616b,.29,.28),iron:material('Jefferson ironwork',0x1c292a,.68,.35),
};}
class Parts{
 groups=new Map<T.Material,T.BufferGeometry[]>();
 footprintTriangles:Point[][]=[];clipMaterials:Set<T.Material>;
 constructor(source:SourceBuilding,palette:Palette){
  this.setFootprint(source);this.clipMaterials=new Set([palette.roof,palette.copper]);
 }
 setFootprint(source:SourceBuilding){
  const unclosed=(ring:Point[])=>ring.length>1&&ring[0][0]===ring.at(-1)![0]&&ring[0][1]===ring.at(-1)![1]?ring.slice(0,-1):ring;
  const exterior=unclosed(source.points),holes=(source.holes??[]).map(unclosed),points=[...exterior,...holes.flat()];
  this.footprintTriangles=T.ShapeUtils.triangulateShape(exterior.map(p=>new T.Vector2(...p)),holes.map(r=>r.map(p=>new T.Vector2(...p)))).map(t=>t.map(i=>points[i]));
 }
 clip(g:T.BufferGeometry){
  const vertices=g.getAttribute('position'),indices=g.index,output:number[]=[];
  for(let i=0;i<(indices?.count??vertices.count);i+=3){
   const triangle=Array.from({length:3},(_,k)=>{const n=indices?indices.getX(i+k):i+k;return[vertices.getX(n),vertices.getY(n),vertices.getZ(n)];});
   for(const boundary of this.footprintTriangles){
    const orientation=Math.sign((boundary[1][0]-boundary[0][0])*(boundary[2][1]-boundary[0][1])-(boundary[1][1]-boundary[0][1])*(boundary[2][0]-boundary[0][0]));
    let polygon=triangle;
    for(let edge=0;edge<3&&polygon.length;edge++){
     const a=boundary[edge],b=boundary[(edge+1)%3],side=(p:number[])=>orientation*((b[0]-a[0])*(p[2]-a[1])-(b[1]-a[1])*(p[0]-a[0]));
     const next:number[][]=[];
     for(let j=0;j<polygon.length;j++){
      const p=polygon[j],q=polygon[(j+1)%polygon.length],sp=side(p),sq=side(q),ip=sp>=-1e-7,iq=sq>=-1e-7;
      if(ip)next.push(p);if(ip!==iq){const t=sp/(sp-sq);next.push(p.map((v,k)=>v+(q[k]-v)*t));}
     }polygon=next;
    }
    for(let j=1;j+1<polygon.length;j++){
     const rounded=[polygon[0],polygon[j],polygon[j+1]].map(p=>p.map(Math.fround));
     const a=new T.Vector3(...rounded[0] as [number,number,number]),b=new T.Vector3(...rounded[1] as [number,number,number]),c=new T.Vector3(...rounded[2] as [number,number,number]);
     if(b.sub(a).cross(c.sub(a)).lengthSq()>1e-10)output.push(...rounded.flat());
    }
   }
  }
  g.dispose();const clipped=new T.BufferGeometry();clipped.setAttribute('position',new T.Float32BufferAttribute(output,3));clipped.computeVertexNormals();return clipped;
 }
 add(g:T.BufferGeometry,m:T.Material,color?:T.Color,clip=false){
  if(clip||this.clipMaterials.has(m))g=this.clip(g);
  if(g.index){const previous=g;g=g.toNonIndexed();previous.dispose();}
  const p=g.getAttribute('position');if(!g.getAttribute('normal'))g.computeVertexNormals();
  if(!g.getAttribute('uv'))g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(p.count*2),2));
  const c=new Float32Array(p.count*3),col=color??new T.Color(1,1,1);for(let i=0;i<p.count;i++)c.set([col.r,col.g,col.b],i*3);
  g.setAttribute('color',new T.BufferAttribute(c,3));
  const group=this.groups.get(m)??[];group.push(g);this.groups.set(m,group);
 }
 box(x:number,y:number,z:number,w:number,h:number,d:number,yaw:number,m:T.Material,color?:T.Color,clip=false){
  if(Math.min(w,h,d)<=0)return;const g=new T.BoxGeometry(w,h,d);g.rotateY(yaw);g.translate(x,y,z);this.add(g,m,color,clip);
 }
 plane(x:number,y:number,z:number,w:number,h:number,yaw:number,m:T.Material,color?:T.Color){
  const g=new T.PlaneGeometry(w,h);const uv=g.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*w,uv.getY(i)*h);
  g.rotateY(yaw);g.translate(x,y,z);this.add(g,m,color);
 }
 finish(root:T.Group,name:string){
  let triangles=0;
  for(const [m,parts]of this.groups){const g=mergeGeometries(parts);if(!g)throw Error('Jefferson geometry batch failed');for(const p of parts)p.dispose();g.computeBoundingBox();g.computeBoundingSphere();
   const mesh=new T.Mesh(g,m);mesh.name=name+' · '+m.name;mesh.castShadow=true;mesh.receiveShadow=true;mesh.updateMatrix();mesh.matrixAutoUpdate=false;root.add(mesh);triangles+=g.getAttribute('position').count/3;
  }return triangles;
 }
}
function point(plan:JeffersonBuildingPlan,u:number,v:number):Point{return[plan.center[0]+plan.right[0]*u+plan.front[0]*v,plan.center[1]+plan.right[1]*u+plan.front[1]*v];}
function roofTop(parts:Parts,plan:JeffersonBuildingPlan,height:number,m:T.Material,color?:T.Color){
 const shape=new T.Shape(plan.source.points.map(p=>new T.Vector2(p[0],-p[1])));for(const hole of plan.source.holes??[])shape.holes.push(new T.Path(hole.map(p=>new T.Vector2(p[0],-p[1]))));const g=new T.ShapeGeometry(shape);g.rotateX(-Math.PI/2);g.translate(0,plan.base+height,0);parts.add(g,m,color);
}
function localBox(parts:Parts,p:JeffersonBuildingPlan,u:number,y:number,v:number,w:number,h:number,d:number,m:T.Material,clip=false){const [x,z]=point(p,u,v);parts.box(x,p.base+y,z,w,h,d,Math.atan2(p.front[0],p.front[1]),m,undefined,clip);}
function ridgeRoof(parts:Parts,p:JeffersonBuildingPlan,u0:number,u1:number,v0:number,v1:number,eave:number,rise:number,roof:T.Material,gable:T.Material){
 // Ridge runs along the local depth; original mapped walls stay below it.
 const mid=(u0+u1)/2,a=point(p,u0,v0),b=point(p,u1,v0),c=point(p,mid,v0),d=point(p,u0,v1),e=point(p,u1,v1),f=point(p,mid,v1);
 const v=(q:Point,h:number)=>[q[0],p.base+h,q[1]];
 const triangles=(verts:number[][],m:T.Material)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts.flat(),3));g.computeVertexNormals();parts.add(g,m,undefined,true);};
 // Double-sided faces are duplicated with reversed winding for roof undersides.
 const face=(a:number[],b:number[],c:number[],d?:number[])=>{const t=[a,b,c,...(d?[a,c,d]:[])];return[...t,...t.slice().reverse()];};
 triangles([...face(v(a,eave),v(d,eave),v(f,eave+rise),v(c,eave+rise)),...face(v(c,eave+rise),v(f,eave+rise),v(e,eave),v(b,eave))],roof);
 triangles([...face(v(a,eave),v(c,eave+rise),v(b,eave)),...face(v(e,eave),v(f,eave+rise),v(d,eave))],gable);
 // Clipping a pitched roof creates new elevated edges on curved/concave
 // footprints. Close those cuts down to the eaves; clipping roof faces alone
 // leaves open attic wedges even when every roof vertex is inside the map.
 const local=(q:Point)=>{const dx=q[0]-p.center[0],dz=q[1]-p.center[1];return[dx*p.right[0]+dz*p.right[1],dx*p.front[0]+dz*p.front[1]];};
 for(const edge of p.edges){
  const a=local(edge.a),b=local(edge.b),du=b[0]-a[0],dv=b[1]-a[1],cuts=[0,1];
  for(const x of[u0,mid,u1])if(Math.abs(du)>1e-9){const t=(x-a[0])/du;if(t>0&&t<1)cuts.push(t);}
  for(const z of[v0,v1])if(Math.abs(dv)>1e-9){const t=(z-a[1])/dv;if(t>0&&t<1)cuts.push(t);}
  cuts.sort((a,b)=>a-b);
  for(let i=1;i<cuts.length;i++){
   const t0=cuts[i-1],t1=cuts[i],tm=(t0+t1)/2,u=a[0]+du*tm,vv=a[1]+dv*tm;
   if(t1-t0<1e-8||u<u0-1e-7||u>u1+1e-7||vv<v0-1e-7||vv>v1+1e-7)continue;
   const q=(t:number):Point=>[edge.a[0]+(edge.b[0]-edge.a[0])*t,edge.a[1]+(edge.b[1]-edge.a[1])*t];
   const height=(t:number)=>eave+rise*Math.max(0,1-Math.abs((a[0]+du*t-mid)/((u1-u0)/2)));
   const qa=q(t0),qb=q(t1),h0=height(t0),h1=height(t1);if(Math.max(h0,h1)<=eave+.0001)continue;
   const vertices=[v(qa,eave),v(qb,eave),v(qb,h1),v(qa,eave),v(qb,h1),v(qa,h0)];
   for(let j=0;j<vertices.length;j+=3){const a=new T.Vector3(...vertices[j] as [number,number,number]),b=new T.Vector3(...vertices[j+1] as [number,number,number]),c=new T.Vector3(...vertices[j+2] as [number,number,number]);
    if(b.sub(a).cross(c.sub(a)).dot(new T.Vector3(edge.nx,0,edge.nz))<0)[vertices[j+1],vertices[j+2]]=[vertices[j+2],vertices[j+1]];
   }
   const cap=new T.BufferGeometry();cap.setAttribute('position',new T.Float32BufferAttribute(vertices.flat(),3));cap.computeVertexNormals();parts.add(cap,gable);
  }
 }
}
function wellsRoof(parts:Parts,p:JeffersonBuildingPlan,pal:Palette){
 const cfg=p.profile,w=p.u1-p.u0,d=p.v1-p.v0,u=(p.u0+p.u1)/2,vertices:number[]=[];
 // The photographed main body has tiled hip slopes, including above the
 // broad curved front bay. Start the shell on the exact mapped eave ring;
 // clipping a rectangular gable and closing its cuts creates false tall walls.
 // A level, depth-running ridge and hip ends are photo-informed estimates,
 // with the existing wall/rise heights retained. Direct eave-to-ridge faces
 // give continuous hip planes; no sampled heightfield or vertical cut caps.
 const rear=p.v0+d*.24,front=p.v0+d*.69;
 // Give the small turret its own conical cap: replace its outer arc with the
 // internal chord between original source13 and25 only for this roof shell.
 const body=footprintPlan(p,[...p.source.points.slice(0,6),...p.source.points.slice(17)]);
 const localV=(q:Point)=>(q[0]-p.center[0])*p.front[0]+(q[1]-p.center[1])*p.front[1];
 const step=p.source.points[2],stepRun=Math.hypot(step[0]-p.source.points[1][0],step[1]-p.source.points[1][1]);
 const ridgeV=(q:Point)=>Math.max(rear,Math.min(front,localV(q)+(q===step?stepRun:0)));
 const vertex=(q:Point,height:number)=>[q[0],p.base+height,q[1]];
 const triangle=(a:number[],b:number[],c:number[])=>{
  const up=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);if(Math.abs(up)<1e-8)return;
  vertices.push(...a,...(up>0?b:c),...(up>0?c:b));
 };
 for(const edge of body.edges){
  const a=localV(edge.a),b=localV(edge.b),cuts=[0,1];
  if(Math.abs(b-a)>1e-8)for(const end of [rear,front]){const t=(end-a)/(b-a);if(t>0&&t<1)cuts.push(t);}
  cuts.sort((a,b)=>a-b);
  for(let i=1;i<cuts.length;i++){
   const points=cuts.slice(i-1,i+1).map(t=>t===0?edge.a:t===1?edge.b:[edge.a[0]+(edge.b[0]-edge.a[0])*t,edge.a[1]+(edge.b[1]-edge.a[1])*t] as Point);
   const ridges=points.map(q=>point(p,u,ridgeV(q)));
   const qa=vertex(points[0],cfg.wallHeight),qb=vertex(points[1],cfg.wallHeight),ra=vertex(ridges[0],cfg.wallHeight+cfg.roofHeight),rb=vertex(ridges[1],cfg.wallHeight+cfg.roofHeight);
   triangle(qa,qb,rb);triangle(qa,rb,ra);
  }
 }
 const shell=new T.BufferGeometry();shell.setAttribute('position',new T.Float32BufferAttribute(vertices,3));shell.computeVertexNormals();
 parts.setFootprint(body.source);parts.add(shell,pal.roof);parts.setFootprint(p.source);
 // Source vertices13..25 form the small forward-right round turret seen in
 // the photograph. Circle-fit center/radius are map-derived model estimates;
 // the broad source3..12 flat wing remains outside this main-roof footprint.
 const [tx,tz]=point(p,4.279536940,12.062718906),radius=1.265,capHeight=cfg.roofHeight*.7;
 const cone=new T.ConeGeometry(radius,capHeight,20);cone.translate(tx,p.base+cfg.wallHeight+capHeight/2,tz);parts.add(cone,pal.roof);
 const collar=new T.CylinderGeometry(radius,radius,.18,20);collar.translate(tx,p.base+cfg.wallHeight+.04,tz);parts.add(collar,pal.copper);
 const finial=new T.ConeGeometry(.16,1.1,8);finial.translate(tx,p.base+cfg.wallHeight+capHeight+.45,tz);parts.add(finial,pal.copper);
 // Preserve the two existing chimney shaft positions, dimensions and heights.
 for(const s of[-1,1])localBox(parts,p,u+s*w*.25,cfg.wallHeight+cfg.roofHeight*.62,p.v0+d*(s<0?.38:.72),.85,cfg.roofHeight*.92,.95,pal.stone,true);
 for(const e of p.edges)if(e.nx*p.front[0]+e.nz*p.front[1]>.15)parts.box((e.a[0]+e.b[0])/2,p.base+cfg.wallHeight+.055,(e.a[1]+e.b[1])/2,e.length,.11,.12,e.yaw,pal.copper);
}
function windowPane(parts:Parts,e:Edge,base:number,along:number,y:number,w:number,h:number,pal:Palette,seed:number,arched=false){
 const t=along/e.length,x=e.a[0]+(e.b[0]-e.a[0])*t,z=e.a[1]+(e.b[1]-e.a[1])*t;
 const shift=(n:number):Point=>[x+e.nx*n,z+e.nz*n];const [tx,tz]=shift(.055),[gx,gz]=shift(.135);
 parts.box(tx,base+y,tz,w+.16,h+.16,.12,e.yaw,pal.limestone);
 const shade=.65+((Math.abs(Math.sin(seed*97.17))*917.7)%1)*.35;
 parts.plane(gx,base+y,gz,w,h,e.yaw,pal.glass,new T.Color(shade,shade*.99,Math.min(1,shade*1.05)));
 parts.box(gx+e.nx*.015,base+y,gz+e.nz*.015,.045,h,.025,e.yaw,pal.iron);
 parts.box(gx+e.nx*.018,base+y-.05,gz+e.nz*.018,w,.04,.025,e.yaw,pal.iron);
 parts.box(gx,base+y-h/2-.13,gz,w+.3,.11,.24,e.yaw,pal.limestone);
 if(arched){
  const arc=new T.RingGeometry(w/2,w/2+.13,12,1,0,Math.PI);arc.rotateY(e.yaw);arc.translate(gx+e.nx*.01,base+y+h/2-w/2,gz+e.nz*.01);parts.add(arc,pal.limestone);
 }
}
const ENTRANCE={width:2,height:2.8,y:1.5,clearance:.08};
function entranceEdge(p:JeffersonBuildingPlan){return p.edges.filter(e=>e.nx*p.front[0]+e.nz*p.front[1]>.6&&e.length>4).sort((a,b)=>b.length-a.length)[0];}
function sameEdge(a:Edge,b:Edge|undefined){return !!b&&a.a===b.a&&a.b===b.b;}
function wallBand(parts:Parts,p:JeffersonBuildingPlan,y:number,h:number,d:number,m:T.Material,color?:T.Color,entrance?:Edge){
 for(const e of p.edges){
  const crossesEntrance=sameEdge(e,entrance)&&y+h/2>ENTRANCE.y-ENTRANCE.height/2&&y-h/2<ENTRANCE.y+ENTRANCE.height/2;
  const half=ENTRANCE.width/2+ENTRANCE.clearance;
  const spans=crossesEntrance?[[0,e.length/2-half],[e.length/2+half,e.length]]:[[0,e.length]];
  for(const [a,b] of spans){
   if(b<=a)continue;const t=(a+b)/(2*e.length);
   parts.box(e.a[0]+(e.b[0]-e.a[0])*t+e.nx*.035,p.base+y,e.a[1]+(e.b[1]-e.a[1])*t+e.nz*.035,b-a,h,d,e.yaw,m,color);
  }
 }
}

function detailedFacade(parts:Parts,p:JeffersonBuildingPlan,pal:Palette,zones?:WellsHeightZones){
 const cfg=p.profile,masonry=cfg.kind==='wells'?pal.stone:cfg.kind==='pasadena'?pal.buff:cfg.kind==='palms'?pal.limestone:pal.brick;
 const apartment=cfg.kind==='garden-court'||cfg.kind==='pasadena'||cfg.kind==='palms',step=cfg.wallHeight/cfg.floors;
 const entrance=entranceEdge(zones?.main??p);
 const curvedBayStarts=new Set(cfg.kind==='wells'?p.source.points.slice(26,34):[]),curvedBay=p.edges.filter(e=>curvedBayStarts.has(e.a));
 for(const e of p.edges){
  const x=(e.a[0]+e.b[0])/2,z=(e.a[1]+e.b[1])/2;
  const low=zones?.isLowEdge(e),wallHeight=low?zones!.lowHeight:cfg.wallHeight,floors=low?1:cfg.floors;
  const inner=cfg.kind==='palms'&&(p.source.holes??[]).some(h=>inside(x+e.nx*.15,z+e.nz*.15,h));
  if(apartment&&!inner&&cfg.kind!=='palms'){
   // Adjacent material sections share the original wall plane. Thin stone
   // overlays over a complete brick wall fought for depth in distant views.
   const top=cfg.kind==='garden-court'?wallHeight-step:wallHeight;
   parts.plane(x,p.base+step,z,e.length,step*2,e.yaw,pal.limestone);
   parts.plane(x,p.base+(step*2+top)/2,z,e.length,top-step*2,e.yaw,masonry);
   if(top<wallHeight)parts.plane(x,p.base+(top+wallHeight)/2,z,e.length,wallHeight-top,e.yaw,pal.limestone);
  }else parts.plane(x,p.base+wallHeight/2,z,e.length,wallHeight,e.yaw,inner?pal.brick:masonry);
  const bays=Math.max(1,Math.floor(e.length/(cfg.kind==='stearns'?3.4:apartment?2.85:3.2)));
  if(e.length<1.1||curvedBayStarts.has(e.a))continue;
  for(let floor=0;floor<floors;floor++)for(let b=0;b<bays;b++){
   const w=Math.min(apartment?1.52:cfg.kind==='stearns'?2.45:1.3,e.length/bays*.68),h=step*(cfg.kind==='stearns'?.58:.59);
   const along=(b+.5)*e.length/bays,y=step*(floor+.53);
   // Reserve the existing doorway before adding windows. Include the sill's
   // full width and the surround/arch height, not only the glazing rectangle.
   if(sameEdge(e,entrance)&&Math.abs(along-e.length/2)<(w+.3+ENTRANCE.width)/2+ENTRANCE.clearance&&
    y+h/2+.13>ENTRANCE.y-ENTRANCE.height/2&&y-h/2-.185<ENTRANCE.y+ENTRANCE.height/2)continue;
   windowPane(parts,e,p.base,along,y,w,h,pal,floor*101+b+e.a[0],cfg.kind==='wells'&&floor===0||cfg.kind==='pasadena'&&floor===cfg.floors-1);
  }
 }
 if(curvedBay.length){
  // The photographed broad Wells bay has windows, but its finely segmented
  // map arc is shorter per edge than a window. Space two stacks along the
  // retained arc, using each selected facet's real position and normal.
  const length=curvedBay.reduce((sum,e)=>sum+e.length,0);
  for(const fraction of [1/3,2/3]){
   let along=length*fraction,edge=curvedBay.at(-1)!;
   for(const candidate of curvedBay){if(along<=candidate.length){edge=candidate;break;}along-=candidate.length;}
   for(let floor=0;floor<cfg.floors;floor++)windowPane(parts,edge,p.base,along,step*(floor+.53),1.08,step*.59,pal,701+floor*11+fraction*30,floor===0);
  }
 }
 wallBand(parts,p,.18,.36,.2,pal.limestone,undefined,entrance);
 wallBand(parts,zones?.main??p,cfg.wallHeight-.12,.27,.35,pal.limestone);
 if(apartment){wallBand(parts,p,step*2,.22,.24,pal.limestone);wallBand(parts,p,cfg.wallHeight-step,.18,.2,pal.limestone);}
 if(cfg.kind==='stearns')for(let floor=1;floor<cfg.floors;floor++)wallBand(parts,p,step*floor,.12,.17,pal.limestone);
 roofTop(parts,zones?.main??p,cfg.wallHeight+.025,pal.roof);
 if(zones){
  const darkRoof=new T.Color(.42,.45,.47),edge=zones.join,x=(edge.a[0]+edge.b[0])/2,z=(edge.a[1]+edge.b[1])/2;
  roofTop(parts,zones.low,zones.lowHeight+.025,pal.roof,darkRoof);
  wallBand(parts,{...zones.low,edges:p.edges.filter(zones.isLowEdge)},zones.lowHeight+.04,.08,.18,pal.roof,darkRoof);
  // This is an upper exterior wall above the wing roof, not a new ground wall
  // through the retained combined footprint. Its windows face the low wing.
  parts.plane(x,p.base+(cfg.wallHeight+zones.lowHeight)/2,z,edge.length,cfg.wallHeight-zones.lowHeight,edge.yaw,pal.stone);
  const bays=Math.max(1,Math.floor(edge.length/3.2));
  for(let bay=0;bay<bays;bay++)windowPane(parts,edge,p.base,(bay+.5)*edge.length/bays,step*1.53,Math.min(1.3,edge.length/bays*.68),step*.59,pal,501+bay);
 }
 if(apartment){
  // Parapets follow EVERY original outline edge, including the H-plan courts.
  for(const e of p.edges){
   const x=(e.a[0]+e.b[0])/2,z=(e.a[1]+e.b[1])/2;
   const balustrade=(cfg.kind==='garden-court'||cfg.kind==='palms')&&e.length>5;
   if(!balustrade)parts.box(x,p.base+cfg.wallHeight+.55,z,e.length,1.05,.21,e.yaw,cfg.kind==='garden-court'?pal.brick:cfg.kind==='palms'?pal.limestone:pal.buff);
   else parts.box(x,p.base+cfg.wallHeight+.12,z,e.length,.24,.28,e.yaw,pal.limestone);
   parts.box(x,p.base+cfg.wallHeight+cfg.roofHeight-.07,z,e.length+.1,.14,.4,e.yaw,pal.limestone);
   if(balustrade){
    const n=Math.floor(e.length/.75);for(let i=0;i<n;i++){const t=(i+.5)/n;parts.box(e.a[0]+(e.b[0]-e.a[0])*t+e.nx*.13,p.base+cfg.wallHeight+.62,e.a[1]+(e.b[1]-e.a[1])*t+e.nz*.13,.12,.7,.14,e.yaw,pal.limestone);}
   }
  }
 }
}
function frontDetails(parts:Parts,p:JeffersonBuildingPlan,pal:Palette){
 const cfg=p.profile,w=p.u1-p.u0,d=p.v1-p.v0,u=(p.u0+p.u1)/2;
 const front=entranceEdge(p);
 const [mx,mz]=front?[(front.a[0]+front.b[0])/2,(front.a[1]+front.b[1])/2]:p.center;
 // Dark entrance and thin projecting canopy, modeled from the photographs.
 if(front){parts.box(mx+front.nx*.12,p.base+ENTRANCE.y,mz+front.nz*.12,ENTRANCE.width,ENTRANCE.height,.12,front.yaw,pal.iron);
 parts.plane(mx+front.nx*.2,p.base+1.5,mz+front.nz*.2,1.65,2.5,front.yaw,pal.glass);}
 if(cfg.kind==='garden-court'&&front){
  parts.box(mx+front.nx*.6,p.base+3.05,mz+front.nz*.6,3.7,.32,1.6,front.yaw,pal.iron);
  // The existing outline includes the projecting front bays. Keep those
  // projections and add the central balcony stack without another solid shell.
  for(let floor=2;floor<cfg.floors;floor++){
   const y=(cfg.wallHeight/cfg.floors)*floor+.15;
   parts.box(mx+front.nx*.65,p.base+y,mz+front.nz*.65,3.4,.17,1.4,front.yaw,pal.limestone);
   parts.box(mx+front.nx*1.32,p.base+y+.92,mz+front.nz*1.32,3.4,.06,.06,front.yaw,pal.iron);
   for(let i=0;i<13;i++){const along=-1.6+i*3.2/12;parts.box(mx+front.nx*1.32+Math.cos(front.yaw)*along,p.base+y+.49,mz+front.nz*1.32-Math.sin(front.yaw)*along,.035,.86,.035,front.yaw,pal.iron);}
  }
 }else if((cfg.kind==='pasadena'||cfg.kind==='palms')&&front){
  parts.box(mx+front.nx*.28,p.base+3.2,mz+front.nz*.28,4.3,.35,.7,front.yaw,pal.limestone);
  for(const s of[-1,1])parts.box(mx+Math.cos(front.yaw)*s*1.8+front.nx*.25,p.base+1.6,mz-Math.sin(front.yaw)*s*1.8+front.nz*.25,.32,3.2,.42,front.yaw,pal.limestone);
 }else if(cfg.kind==='stearns'){
  ridgeRoof(parts,p,p.u0+w*.38,p.u0+w*.62,p.v1-Math.min(8,d*.35),p.v1,cfg.wallHeight,cfg.roofHeight,pal.roof,pal.brick);
  for(const fraction of[.06,.72])ridgeRoof(parts,p,p.u0+w*fraction,p.u0+w*(fraction+.22),p.v1-Math.min(8,d*.35),p.v1,cfg.wallHeight,cfg.roofHeight,pal.roof,pal.brick);
  for(const s of[-1,1])localBox(parts,p,u+s*w*.32,cfg.wallHeight+.65,p.v0+d*.55,1.2,1.3,1.2,pal.brick,true);
  // Operator aerial locates the broad eight-story block in the closed middle
  // body, between the two courts. The northern notch must remain open.
  const rw=21,rd=24,ru=0,rv=0;
  const rear=cfg.rearHeight??cfg.wallHeight;
  localBox(parts,p,ru,(cfg.wallHeight+rear)/2,rv,rw,rear-cfg.wallHeight,rd,pal.limestone,true);
  const corners=[point(p,ru-rw/2,rv-rd/2),point(p,ru+rw/2,rv-rd/2),point(p,ru+rw/2,rv+rd/2),point(p,ru-rw/2,rv+rd/2)];
  for(let i=0;i<corners.length;i++){
   const a=corners[i],b=corners[(i+1)%corners.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);let nx=dz/length,nz=-dx/length;
   if(inside((a[0]+b[0])/2+nx*.05,(a[1]+b[1])/2+nz*.05,corners)){nx=-nx;nz=-nz;}
   const edge:Edge={a,b,length,nx,nz,yaw:Math.atan2(nx,nz)},bays=Math.floor(length/3.3);
   for(let floor=4;floor<8;floor++)for(let bay=0;bay<bays;bay++)windowPane(parts,edge,p.base,(bay+.5)*length/bays,3.9*(floor+.5),2.15,2.4,pal,floor*111+bay);
  }
 }else if(cfg.kind==='wells'){
  wellsRoof(parts,p,pal);
 }else if(cfg.kind==='bagley'){
  const wall=pal.brick;
  // Roof body is inset from the original polygon bounds; photo-guided gables,
  // turret caps, dormers and chimneys create a distinct silhouette.
  ridgeRoof(parts,p,p.u0+w*.08,p.u1-w*.08,p.v0+d*.05,p.v1-d*.04,cfg.wallHeight,cfg.roofHeight,pal.roof,wall);
  const turretU=p.u0+w*.8, turretV=p.v1-d*.15,desired=point(p,turretU,turretV);
  // Place the cap on a supported part of the actual curved footprint. The
  // photographed turret cannot be placed using only the outline's rectangle.
  let center=desired,r=Math.min(w*.135,d*.16),score=Infinity;
  for(let u=p.u0+.5;u<p.u1;u+=.5)for(let v=p.v0+d*.5;v<p.v1;v+=.5){
   const q=point(p,u,v);if(!inside(...q,p.source.points))continue;
   const clearance=Math.min(...p.edges.map(e=>segment(...q,e.a,e.b).d));if(clearance<1.2)continue;
   const candidate=Math.hypot(q[0]-desired[0],q[1]-desired[1])+Math.max(0,r-clearance)*2;
   if(candidate<score){score=candidate;center=q;}
  }
  r=Math.min(r,Math.min(...p.edges.map(e=>segment(...center,e.a,e.b).d))+.03);const[tx,tz]=center;
  const cone=new T.ConeGeometry(r,cfg.roofHeight*.9,20);cone.translate(tx,p.base+cfg.wallHeight+cfg.roofHeight*.45,tz);parts.add(cone,pal.roof);
  const collar=new T.CylinderGeometry(r,r,.18,20);collar.translate(tx,p.base+cfg.wallHeight+.04,tz);parts.add(collar,pal.copper);
  const finial=new T.ConeGeometry(.16,1.1,8);finial.translate(tx,p.base+cfg.wallHeight+cfg.roofHeight*.9+.45,tz);parts.add(finial,pal.copper);
  for(const s of[-1,1])localBox(parts,p,u+s*w*.25,cfg.wallHeight+cfg.roofHeight*.62,p.v0+d*(s<0?.38:.72),.85,cfg.roofHeight*.92,.95,wall,true);
  // A narrow verdigris fascia follows the visible street-facing roof eaves.
  localBox(parts,p,u,cfg.wallHeight+.07,p.v1-d*.04,w*.84,.13,.16,pal.copper);
 }
}

/** Register only additional vertical obstruction; old records and horizontal
 * footprint/collision semantics are never moved, shortened or deleted. */
export function registerJeffersonBuildingSolids(terrain:ParkTerrain,plans:readonly JeffersonBuildingPlan[]){
 let added=0;
 for(const p of plans){
  const top=p.base+Math.max(p.profile.wallHeight+p.profile.roofHeight,p.profile.rearHeight??0)+(p.profile.kind==='bagley'||p.profile.kind==='wells'?1.1:0);
  for(const ring of p.source.collisionParts??[p.source.points]){
  const original=terrain.boxes.find(b=>b.points===ring);if(!original)throw Error('Jefferson building missing original collision '+p.profile.id);
  const base=original.base??2,oldTop=base+original.height;
  if(top<=oldTop+.001)continue;
  // The supplemental conservative envelope shares the original horizontal ring.
  // It includes roof voids as a conservative solid, as other map buildings do.
  if(terrain.boxes.some(b=>b.points===ring&&b.base===oldTop&&b.height===top-oldTop))continue;
  terrain.boxes.push({minX:original.minX,maxX:original.maxX,minZ:original.minZ,maxZ:original.maxZ,base:oldTop,height:top-oldTop,points:ring});added++;
  }
 }return added;
}
export function addJeffersonBuildings(scene:T.Object3D,terrain:ParkTerrain){
 const plans=planJeffersonBuildings(terrain.map,(x,z)=>terrain.height(x,z)),pal=makePalette(),sites:{near:T.Group;far:T.Group;center:Point;range:number}[]=[];
 const stats={buildings:plans.length,triangles:0,meshes:0,distantTriangles:0,distantMeshes:0,additionalCollisionEnvelopes:registerJeffersonBuildingSolids(terrain,plans),heights:'Palms: documented overall height; other heights: photo/story model estimates',sourceIds:plans.map(p=>p.profile.id)};
 for(const p of plans){
  const root=new T.Group();root.name='Jefferson replica · '+p.profile.name;root.userData.jeffersonId=p.profile.id;root.userData.reference=p.profile.reference;
  const near=new T.Group(),far=new T.Group();near.name=p.profile.name+' · facade detail';far.name=p.profile.name+' · distant massing';near.userData.warmIslandShaders=true;far.userData.warmIslandShaders=true;root.add(near,far);
  const zones=wellsHeightZones(p),parts=new Parts(p.source,pal);detailedFacade(parts,p,pal,zones);
  if(zones)parts.setFootprint(zones.main.source);
  frontDetails(parts,zones?.main??p,pal);stats.triangles+=parts.finish(near,p.profile.name);stats.meshes+=near.children.length;
  // A persistent, cheap silhouette retains mainland architecture from the
  // island. Only facade detail is distance-limited; the buildings never vanish.
  const baseMaterial=p.profile.kind==='wells'?pal.stone:p.profile.kind==='pasadena'?pal.buff:p.profile.kind==='palms'?pal.limestone:pal.brick;
  const mass=new Parts(p.source,pal),volumes=zones?[{plan:zones.main,height:p.profile.wallHeight},{plan:zones.low,height:zones.lowHeight}]:[{plan:p,height:p.profile.wallHeight}];
  for(const volume of volumes){
   const shape=new T.Shape(volume.plan.source.points.map(([x,z])=>new T.Vector2(x,-z)));
   for(const hole of volume.plan.source.holes??[])shape.holes.push(new T.Path(hole.map(([x,z])=>new T.Vector2(x,-z))));
   const g=new T.ExtrudeGeometry(shape,{depth:volume.height,bevelEnabled:false});g.rotateX(-Math.PI/2);g.translate(0,p.base,0);mass.add(g,baseMaterial);
  }
  if(zones)roofTop(mass,zones.low,zones.lowHeight+.025,pal.roof,new T.Color(.42,.45,.47));
  stats.distantTriangles+=mass.finish(far,p.profile.name+' massing');
  // Retain only upper triangles for the distant roof silhouette, including the
  // high gables and the separate Stearns rear volume.
  for(const object of near.children){const mesh=object as T.Mesh,position=mesh.geometry.getAttribute('position'),values:number[]=[];
   for(let i=0;i<position.count;i+=3)if([0,1,2].every(j=>position.getY(i+j)>=p.base+p.profile.wallHeight-.001))for(let j=0;j<3;j++)values.push(position.getX(i+j),position.getY(i+j),position.getZ(i+j));
   if(!values.length)continue;
   const upper=new T.BufferGeometry();upper.setAttribute('position',new T.Float32BufferAttribute(values,3));upper.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(values.length/3*2),2));upper.setAttribute('color',new T.Float32BufferAttribute(new Float32Array(values.length).fill(1),3));upper.computeVertexNormals();upper.computeBoundingSphere();
   const copy=new T.Mesh(upper,mesh.material);copy.name=p.profile.name+' upper silhouette';copy.receiveShadow=true;far.add(copy);stats.distantTriangles+=values.length/9;
  }
  stats.distantMeshes+=far.children.length;far.visible=false;
  root.updateMatrixWorld(true);root.traverse(o=>{o.matrixAutoUpdate=false;});scene.add(root);sites.push({near,far,center:p.center,range:p.profile.floors>5?700:420});
 }
 return{stats,plans,update(x:number,z:number){for(const s of sites){const near=Math.hypot(x-s.center[0],z-s.center[1])<s.range;s.near.visible=near;s.far.visible=!near;}}};
}
export function jeffersonDestinations(map:ParkMap):Landmark[]{
 return planJeffersonBuildings(map,()=>2).map(p=>({id:'jefferson-'+p.profile.id,name:p.profile.name+' · East Jefferson',x:p.center[0],z:p.center[1],kind:'historic',viewDistance:p.profile.floors>5?65:35,reference:p.profile.reference,description:p.profile.address+'. '+p.profile.observations}));
}

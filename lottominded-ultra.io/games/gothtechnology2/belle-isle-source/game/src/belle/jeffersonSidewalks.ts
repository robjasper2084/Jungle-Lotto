import * as T from 'three';

type Point=readonly [number,number];
type Edge=readonly [Point,Point];
export type JeffersonSidewalkRamp={toe:Edge;crest:Edge};
export type JeffersonSidewalkPatch={
 id:string;sourceIds?:readonly (string|number)[];
 kind:'sidewalk'|'ramp'|'tactile';outer:readonly Point[];holes?:readonly (readonly Point[])[];
 ramp?:JeffersonSidewalkRamp;
};
export type JeffersonSidewalkData={
 schema:number;topOffsetM:number;roadOffsetM:number;tileSizeM:number;
 surfaces:readonly JeffersonSidewalkPatch[];
 curbs?:readonly {id:string;sourceIds?:readonly (string|number)[];points:readonly Point[]}[];
 provenance?:unknown;
};
export type JeffersonSidewalkSample={height:number;normal:{x:number;y:number;z:number}};
export type JeffersonSidewalkStats={
 surfaces:number;ramps:number;tactileSurfaces:number;curbRuns:number;
 topTriangles:number;curbTriangles:number;supportTriangles:number;
 batches:number;tiles:number;refinedTriangles:number;rejectedTriangles:number;
 rejectedDepthTriangles:number;rejectedDegenerateTriangles:number;rejectedNonFiniteTriangles:number;
 rejectedOrientationTriangles:number;collinearVerticesRemoved:number;maxPlanarQuantizationM:number;
 heightSamples:number;maxTerrainFitErrorM:number;
};
type Vertex={x:number;y:number;z:number};
type Triangle={
 ax:number;az:number;bx:number;bz:number;cx:number;cz:number;inverseArea:number;
 ay:number;by:number;cy:number;nx:number;ny:number;nz:number;
 minX:number;maxX:number;minZ:number;maxZ:number;
};
type MaterialKind='concrete'|'curb'|'tactile';
type Batch={kind:MaterialKind;tileX:number;tileZ:number;positions:number[];normals:number[];uv:number[]};
const SUPPORT_CELL_M=16,MAX_EDGE_M=12,MAX_FIT_ERROR_M=.015,MAX_DEPTH=24;
const AREA_EPSILON=1e-9,EDGE_EPSILON=1e-7;

/** A standalone, static surface: its indexed rendering triangles are also the
 * pedestrian floor. It never changes terrain elevation or registers obstacles.
 * Input polygons already exclude vehicle centerline guards, buildings, water
 * and source-qualified crossing/driveway gaps. Sourced sidewalks may replace
 * overly broad authored asphalt shoulders; this layer invents no connections. */
export function createJeffersonSidewalkSurface(data:JeffersonSidewalkData,baseHeight:(x:number,z:number)=>number){
 if(data.schema!==1||![data.topOffsetM,data.roadOffsetM,data.tileSizeM].every(Number.isFinite)||data.tileSizeM<=0||data.roadOffsetM<0||data.topOffsetM<data.roadOffsetM||data.topOffsetM>.3)throw new Error('Invalid Jefferson sidewalk surface schema');
 const stats:JeffersonSidewalkStats={surfaces:data.surfaces.length,ramps:data.surfaces.filter(s=>s.kind==='ramp').length,tactileSurfaces:data.surfaces.filter(s=>s.kind==='tactile').length,curbRuns:data.curbs?.length??0,topTriangles:0,curbTriangles:0,supportTriangles:0,batches:0,tiles:0,refinedTriangles:0,rejectedTriangles:0,rejectedDepthTriangles:0,rejectedDegenerateTriangles:0,rejectedNonFiniteTriangles:0,rejectedOrientationTriangles:0,collinearVerticesRemoved:0,maxPlanarQuantizationM:0,heightSamples:0,maxTerrainFitErrorM:0};
 const batches=new Map<string,Batch>(),triangles:Triangle[]=[];
 type Leaf={a:Vertex;b:Vertex;c:Vertex;depth:number;at:(x:number,z:number)=>Vertex;kind:MaterialKind;support:boolean};
 let leaves:Leaf[]=[];const splitEdges=new Set<string>();
 const edgeKey=(a:Vertex,b:Vertex)=>a.x<b.x||a.x===b.x&&a.z<b.z?a.x+','+a.z+':'+b.x+','+b.z:b.x+','+b.z+':'+a.x+','+a.z;
 const buildCells=new Map<number,Map<number,number[]>>(),heightCache=new Map<string,number>();
 let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
 const height=(x:number,z:number)=>{
  const key=x+','+z;let y=heightCache.get(key);
  if(y===undefined){y=baseHeight(x,z);heightCache.set(key,y);stats.heightSamples++;}
  return y;
 };
 function ring(points:readonly Point[],id:string){
  const result:T.Vector2[]=[];
  for(const point of points){
   if(point.length!==2||!point.every(Number.isFinite))throw new Error('Invalid sidewalk coordinate: '+id);
   const previous=result.at(-1);if(!previous||Math.hypot(previous.x-point[0],previous.y-point[1])>EDGE_EPSILON)result.push(new T.Vector2(point[0],point[1]));
  }
  if(result.length>1&&result[0].distanceTo(result.at(-1)!)<=EDGE_EPSILON)result.pop();
  if(result.length<3)throw new Error('Invalid sidewalk ring: '+id);
  // Serialization can leave consecutive millimetre-grid points on exactly the
  // same straight segment. Binary subtraction makes their zero area appear as
  // 1e-16 slivers to Earcut. Remove only exact decimal collinearity, with no
  // angle/distance tolerance and without moving any perimeter coordinate.
  const decimal=(value:number)=>{const [mantissa,power='0']=value.toString().split('e'),digits=mantissa.replace('.',''),places=(mantissa.split('.')[1]?.length??0)-Number(power);return {digits:BigInt(digits),places};};
  const decimalPoints=result.map(p=>[decimal(p.x),decimal(p.y)]),places=Math.max(0,...decimalPoints.flat().map(v=>v.places));
  const integers=decimalPoints.map(p=>p.map(v=>v.digits*10n**BigInt(places-v.places)));
  let changed=true;
  while(changed&&result.length>3){changed=false;
   for(let i=0;i<result.length;i++){
    const a=integers[(i+result.length-1)%result.length],b=integers[i],c=integers[(i+1)%result.length];
    const ax=b[0]-a[0],az=b[1]-a[1],bx=c[0]-b[0],bz=c[1]-b[1];
    if(ax*bz-az*bx===0n&&ax*bx+az*bz>=0n){result.splice(i,1);integers.splice(i,1);stats.collinearVerticesRemoved++;changed=true;break;}
   }
  }
  // Quantize shared source vertices before choosing diagonals, rather than
  // accepting a triangle whose winding changes after GPU conversion. The
  // vertex itself selects its tile centre, so shared borders use one policy.
  for(const p of result){const ox=(Math.floor(p.x/data.tileSizeM)+.5)*data.tileSizeM,oz=(Math.floor(p.y/data.tileSizeM)+.5)*data.tileSizeM,x=ox+Math.fround(p.x-ox),z=oz+Math.fround(p.y-oz);stats.maxPlanarQuantizationM=Math.max(stats.maxPlanarQuantizationM,Math.hypot(x-p.x,z-p.y));p.set(x,z);}
  return result;
 }
 function batch(kind:MaterialKind,tileX:number,tileZ:number){
  const key=tileX+','+tileZ+','+kind;let result=batches.get(key);
  if(!result){result={kind,tileX,tileZ,positions:[],normals:[],uv:[]};batches.set(key,result);}
  return result;
 }
 function append(a:Vertex,b:Vertex,c:Vertex,kind:MaterialKind,support:boolean){
  // Keep Float32 vertices local to a320m tile. Absolute downtown coordinates
  // otherwise collapse narrow valid source edges and overlap ramp partitions.
  // The floor index uses these same values translated by the fixed mesh origin.
  const tileX=Math.floor((a.x+b.x+c.x)/(3*data.tileSizeM)),tileZ=Math.floor((a.z+b.z+c.z)/(3*data.tileSizeM)),originX=(tileX+.5)*data.tileSizeM,originZ=(tileZ+.5)*data.tileSizeM;
  const sourceArea=(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
  if(kind!=='curb'&&Math.abs(sourceArea)<AREA_EPSILON){stats.rejectedTriangles++;stats.rejectedDegenerateTriangles++;return;}
  a={x:originX+Math.fround(a.x-originX),y:Math.fround(a.y),z:originZ+Math.fround(a.z-originZ)};
  b={x:originX+Math.fround(b.x-originX),y:Math.fround(b.y),z:originZ+Math.fround(b.z-originZ)};
  c={x:originX+Math.fround(c.x-originX),y:Math.fround(c.y),z:originZ+Math.fround(c.z-originZ)};
  let bx=b.x-a.x,by=b.y-a.y,bz=b.z-a.z,cx=c.x-a.x,cy=c.y-a.y,cz=c.z-a.z;
  if(kind!=='curb'&&sourceArea*(bx*cz-bz*cx)<0){stats.rejectedTriangles++;stats.rejectedOrientationTriangles++;return;}
  let nx=by*cz-bz*cy,ny=bz*cx-bx*cz,nz=bx*cy-by*cx;
  if(kind!=='curb'&&ny<0){const old=b;b=c;c=old;bx=b.x-a.x;by=b.y-a.y;bz=b.z-a.z;cx=c.x-a.x;cy=c.y-a.y;cz=c.z-a.z;nx=-nx;ny=-ny;nz=-nz;}
  const length=Math.hypot(nx,ny,nz);
  if(!Number.isFinite(length)){stats.rejectedTriangles++;stats.rejectedNonFiniteTriangles++;return;}
  if(length<AREA_EPSILON||kind!=='curb'&&Math.abs(bx*cz-bz*cx)<AREA_EPSILON){stats.rejectedTriangles++;stats.rejectedDegenerateTriangles++;return;}
  nx/=length;ny/=length;nz/=length;
  const target=batch(kind,tileX,tileZ);
  for(const v of [a,b,c]){target.positions.push(v.x-originX,v.y,v.z-originZ);target.normals.push(nx,ny,nz);target.uv.push(v.x/2.4,v.z/2.4);}
  if(kind==='curb')stats.curbTriangles++;else stats.topTriangles++;
  if(!support)return;
  const area=bx*cz-bz*cx;if(Math.abs(area)<AREA_EPSILON)return;
  const triangle:Triangle={ax:a.x,az:a.z,bx,bz,cx,cz,inverseArea:1/area,ay:a.y,by:b.y,cy:c.y,nx,ny,nz,minX:Math.min(a.x,b.x,c.x),maxX:Math.max(a.x,b.x,c.x),minZ:Math.min(a.z,b.z,c.z),maxZ:Math.max(a.z,b.z,c.z)};
  const index=triangles.push(triangle)-1;
  minX=Math.min(minX,triangle.minX);maxX=Math.max(maxX,triangle.maxX);minZ=Math.min(minZ,triangle.minZ);maxZ=Math.max(maxZ,triangle.maxZ);
  for(let x=Math.floor(triangle.minX/SUPPORT_CELL_M);x<=Math.floor(triangle.maxX/SUPPORT_CELL_M);x++){
   let row=buildCells.get(x);if(!row){row=new Map();buildCells.set(x,row);}
   for(let z=Math.floor(triangle.minZ/SUPPORT_CELL_M);z<=Math.floor(triangle.maxZ/SUPPORT_CELL_M);z++){
    let cell=row.get(z);if(!cell){cell=[];row.set(z,cell);}cell.push(index);
   }
  }
 }
 function refine(leaf:Leaf,forced=-1){
  const {a,b,c,at,depth,kind,support}=leaf;
  if(![a.y,b.y,c.y].every(Number.isFinite)){stats.rejectedTriangles++;stats.rejectedNonFiniteTriangles++;return;}
  const ab=at((a.x+b.x)/2,(a.z+b.z)/2),bc=at((b.x+c.x)/2,(b.z+c.z)/2),ca=at((c.x+a.x)/2,(c.z+a.z)/2);
  if(![ab.y,bc.y,ca.y].every(Number.isFinite)){stats.rejectedTriangles++;stats.rejectedNonFiniteTriangles++;return;}
  const lengths=[Math.hypot(a.x-b.x,a.z-b.z),Math.hypot(b.x-c.x,b.z-c.z),Math.hypot(c.x-a.x,c.z-a.z)];
  const errors=[Math.abs(ab.y-(a.y+b.y)/2),Math.abs(bc.y-(b.y+c.y)/2),Math.abs(ca.y-(c.y+a.y)/2)];
  let split=forced;
  if(split<0&&lengths.some((length,i)=>length>MAX_EDGE_M||errors[i]>MAX_FIT_ERROR_M)){
   // Longest-edge bisection keeps skinny road-strip triangles from converging
   // toward an unsplit opposite edge without ever becoming small enough.
   split=lengths[0]>=lengths[1]&&lengths[0]>=lengths[2]?0:lengths[1]>=lengths[2]?1:2;
  }
  if(split<0){stats.maxTerrainFitErrorM=Math.max(stats.maxTerrainFitErrorM,...errors);leaves.push(leaf);return;}
  if(depth>=MAX_DEPTH){stats.rejectedTriangles++;stats.rejectedDepthTriangles++;return;}
  stats.refinedTriangles++;
  const child=(a:Vertex,b:Vertex,c:Vertex)=>refine({a,b,c,at,depth:depth+1,kind,support});
  if(split===0){splitEdges.add(edgeKey(a,b));child(a,ab,c);child(ab,b,c);}
  else if(split===1){splitEdges.add(edgeKey(b,c));child(a,b,bc);child(a,bc,c);}
  else{splitEdges.add(edgeKey(c,a));child(a,b,ca);child(ca,b,c);}
 }
 for(const patch of data.surfaces){
  const outer=ring(patch.outer,patch.id),holes=(patch.holes??[]).map(h=>ring(h,patch.id));
  const vertices=[...outer,...holes.flat()],faces=T.ShapeUtils.triangulateShape(outer,holes);
  if(patch.kind==='ramp'&&!patch.ramp)throw new Error('Missing sidewalk ramp entries: '+patch.id);
  let toeX=0,toeZ=0,dx=0,dz=0,length2=0;
  if(patch.ramp){
   const {toe,crest}=patch.ramp;
   if([...toe,...crest].some(p=>p.length!==2||!p.every(Number.isFinite)))throw new Error('Invalid sidewalk ramp entries: '+patch.id);
   toeX=(toe[0][0]+toe[1][0])/2;toeZ=(toe[0][1]+toe[1][1])/2;
   dx=(crest[0][0]+crest[1][0])/2-toeX;dz=(crest[0][1]+crest[1][1])/2-toeZ;length2=dx*dx+dz*dz;
   if(length2<.01)throw new Error('Collapsed sidewalk ramp: '+patch.id);
  }
  const at=(x:number,z:number):Vertex=>{
   const t=length2?Math.max(0,Math.min(1,((x-toeX)*dx+(z-toeZ)*dz)/length2)):1;
   return {x,z,y:height(x,z)+data.roadOffsetM+(data.topOffsetM-data.roadOffsetM)*t+(patch.kind==='tactile'?.003:0)};
  };
  for(const face of faces){const [a,b,c]=face.map(i=>at(vertices[i].x,vertices[i].y));refine({a,b,c,at,depth:0,kind:patch.kind==='tactile'?'tactile':'concrete',support:patch.kind!=='tactile'});}
 }
 // Propagate only already-required splits across shared triangle boundaries.
 // Matching their midpoint elevations prevents cracks on the curved approach.
 let conform=true;
 while(conform){
  conform=false;const pending=leaves;leaves=[];
  for(const leaf of pending){const {a,b,c}=leaf,split=splitEdges.has(edgeKey(a,b))?0:splitEdges.has(edgeKey(b,c))?1:splitEdges.has(edgeKey(c,a))?2:-1;
   if(split<0)leaves.push(leaf);else{conform=true;refine(leaf,split);}
  }
 }
 for(const {a,b,c,kind,support}of leaves)append(a,b,c,kind,support);
 leaves.length=0;splitEdges.clear();
 // These are vertical curb fascias, not walls across complete polygon rings.
 // Runs end exactly where the prepared data leaves a crossing/driveway gap.
 for(const curb of data.curbs??[])for(let i=1;i<curb.points.length;i++){
  const a=curb.points[i-1],b=curb.points[i];
  if([...a,...b].some(v=>!Number.isFinite(v)))throw new Error('Invalid sidewalk curb: '+curb.id);
  function fascia(ax:number,az:number,bx:number,bz:number,depth:number){
   const ay=height(ax,az),by=height(bx,bz),mx=(ax+bx)/2,mz=(az+bz)/2,my=height(mx,mz);
   if(![ay,by,my].every(Number.isFinite)){stats.rejectedTriangles+=2;stats.rejectedNonFiniteTriangles+=2;return;}
   if(Math.hypot(bx-ax,bz-az)>MAX_EDGE_M||Math.abs(my-(ay+by)/2)>MAX_FIT_ERROR_M){
    if(depth>=MAX_DEPTH){stats.rejectedTriangles+=2;stats.rejectedDepthTriangles+=2;return;}fascia(ax,az,mx,mz,depth+1);fascia(mx,mz,bx,bz,depth+1);return;
   }
   if(Math.hypot(bx-ax,bz-az)<EDGE_EPSILON)return;
   const a0={x:ax,z:az,y:ay+data.roadOffsetM},a1={x:ax,z:az,y:ay+data.topOffsetM},b0={x:bx,z:bz,y:by+data.roadOffsetM},b1={x:bx,z:bz,y:by+data.topOffsetM};
   append(a0,b0,a1,'curb',false);append(b0,b1,a1,'curb',false);
  }
  fascia(a[0],a[1],b[0],b[1],0);
 }
 heightCache.clear();
 const cells=new Map<number,Map<number,Uint32Array>>();
 for(const [x,row]of buildCells){const ready=new Map<number,Uint32Array>();for(const [z,ids]of row)ready.set(z,Uint32Array.from(ids));cells.set(x,ready);}buildCells.clear();
 const materials:Record<MaterialKind,T.MeshStandardMaterial>={
  concrete:new T.MeshStandardMaterial({color:0xbebbb0,roughness:.95}),
  curb:new T.MeshStandardMaterial({color:0x9f9e95,roughness:.95,side:T.DoubleSide}),
  tactile:new T.MeshStandardMaterial({color:0x9c884d,roughness:.97})
 };
 materials.concrete.name='Jefferson sidewalk concrete';materials.curb.name='Jefferson curb concrete';materials.tactile.name='Jefferson tactile paving';
 const meshes:T.Mesh[]=[];
 for(const value of batches.values()){
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(value.positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(value.normals,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(value.uv,2));geometry.setIndex(Array.from({length:value.positions.length/3},(_,i)=>i));geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const mesh=new T.Mesh(geometry,materials[value.kind]);mesh.name='Jefferson sidewalks · '+value.kind+' · '+value.tileX+','+value.tileZ;mesh.receiveShadow=true;
  mesh.position.set((value.tileX+.5)*data.tileSizeM,0,(value.tileZ+.5)*data.tileSizeM);mesh.updateMatrix();mesh.matrixAutoUpdate=false;
  mesh.userData.jeffersonSidewalk=true;mesh.userData.tile=[value.tileX,value.tileZ];mesh.userData.surfaceKind=value.kind;meshes.push(mesh);
 }
 stats.supportTriangles=triangles.length;stats.batches=meshes.length;stats.tiles=new Set([...batches.values()].map(b=>b.tileX+','+b.tileZ)).size;batches.clear();
 const supportRise=data.topOffsetM+MAX_FIT_ERROR_M*2+.001;
 let added=false,disposed=false;
 return {
  stats,
  /** No allocations or terrain calls on the simulation hot path. A surface on
   * a different terrain level can never pull a rider onto a bridge overhead. */
  sample(x:number,z:number,baseY:number,out:JeffersonSidewalkSample){
   if(disposed||!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(baseY)||x<minX||x>maxX||z<minZ||z>maxZ)return false;
   const candidates=cells.get(Math.floor(x/SUPPORT_CELL_M))?.get(Math.floor(z/SUPPORT_CELL_M));if(!candidates)return false;
   let best=-1,bestY=Math.max(baseY,Number.isFinite(out.height)?out.height:baseY);
   for(let i=0;i<candidates.length;i++){
    const id=candidates[i],t=triangles[id];if(x<t.minX-1e-7||x>t.maxX+1e-7||z<t.minZ-1e-7||z>t.maxZ+1e-7)continue;
    const px=x-t.ax,pz=z-t.az,u=(px*t.cz-pz*t.cx)*t.inverseArea,v=(t.bx*pz-t.bz*px)*t.inverseArea;
    if(u< -1e-7||v< -1e-7||u+v>1+1e-7)continue;
    const y=t.ay*(1-u-v)+t.by*u+t.cy*v;
    if(!Number.isFinite(y)||y<bestY-1e-7||y>baseY+supportRise)continue;
    if(best<0||y>bestY){best=id;bestY=y;}
   }
   if(best<0)return false;
   const triangle=triangles[best];out.height=bestY;out.normal.x=triangle.nx;out.normal.y=triangle.ny;out.normal.z=triangle.nz;return true;
  },
  addToScene(scene:T.Scene){if(disposed||added)return;for(const mesh of meshes)scene.add(mesh);added=true;},
  dispose(){if(disposed)return;disposed=true;for(const mesh of meshes){mesh.removeFromParent();mesh.geometry.dispose();}meshes.length=0;for(const material of Object.values(materials))material.dispose();cells.clear();triangles.length=0;}
 };
}

import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {wardrobeSurface} from '../src/wardrobeSurface.ts';

type Point = readonly [number, number];
type Part = {geometry:T.BufferGeometry; finish:number};
const cache=new WeakMap<T.BufferGeometry,Map<string,{parts:Part[];bones:string[]}>>();
const palettes:Record<string,string[]>={
 DS_Ghoulies_Rider:['#283139','#599e36','#e5cd29','#90e7ed','#182127'],
 DS_Detroit_Rider:['#101e35','#204779','#e33c28','#e6ad4c','#182430'],
 DS_Neural_Rider:['#344c65','#c2d5de','#36d7e8','#82eaff','#132335'],
 DS_Vampire_Rider:['#1c2524','#596343','#da263b','#e9ddd0','#0d141c'],
};

/** Reference-inspired armor and piping, fitted and weighted to the existing
 * garment. No new simulation/animation rig or per-frame fitting is needed. */
export function referenceRiderSuit(root:T.Object3D,id:string,key?:T.BufferGeometry){
 const palette=palettes[id];if(!palette)return {dispose(){}};
 let template=key?cache.get(key)?.get(id):undefined;
 if(!template){
  const surface=wardrobeSurface(root,m=>/garments|padding|nylon|protective shell|visor/.test(m.name));
  const parts:Part[]=[];
  const inside=(x:number,y:number,polygon:Point[])=>{
   let hit=false;
   for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const [xi,yi]=polygon[i],[xj,yj]=polygon[j];
    if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)hit=!hit;
   }return hit;
  };
  function panel(polygon:Point[],finish:number,back=false,clearance=.006){
   const minX=Math.min(...polygon.map(p=>p[0])),maxX=Math.max(...polygon.map(p=>p[0]));
   const minY=Math.min(...polygon.map(p=>p[1])),maxY=Math.max(...polygon.map(p=>p[1]));
   const nx=Math.max(2,Math.ceil((maxX-minX)/.015)),ny=Math.max(2,Math.ceil((maxY-minY)/.015));
   const pos:number[]=[],indices:number[]=[],weights:number[]=[],triangles:number[]=[],valid:boolean[]=[];
   for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){
    const px=T.MathUtils.lerp(minX,maxX,x/nx),py=T.MathUtils.lerp(minY,maxY,y/ny);
    const hit=surface.sample(new T.Vector3(px,py,back?-.7:.7),new T.Vector3(px,py,0),clearance);
    valid.push(!!hit);pos.push(px,py,hit?.point.z??0);indices.push(...(hit?.indices??[0,0,0,0]));weights.push(...(hit?.weights??[1,0,0,0]));
   }
   for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
    const a=y*(nx+1)+x,b=a+1,c=a+nx+1,d=c+1;
    for(const triangle of [[a,b,d],[a,d,c]]){
     const px=triangle.reduce((n,v)=>n+pos[v*3],0)/3,py=triangle.reduce((n,v)=>n+pos[v*3+1],0)/3;
     if(triangle.every(i=>valid[i])&&inside(px,py,polygon))triangles.push(...(back?triangle.reverse():triangle));
    }
   }
   if(!triangles.length)return;
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));
   g.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));g.setIndex(triangles);g.computeVertexNormals();parts.push({geometry:g,finish});
  }
  function stripe(points:Point[],width:number,finish:number,back=false){
   for(let i=1;i<points.length;i++){
    const [x0,y0]=points[i-1],[x1,y1]=points[i],length=Math.hypot(x1-x0,y1-y0),dx=-(y1-y0)/length*width/2,dy=(x1-x0)/length*width/2;
    const count=Math.max(2,Math.ceil(length/.012)),pos:number[]=[],indices:number[]=[],weights:number[]=[],triangles:number[]=[],valid:boolean[]=[];
    for(let j=0;j<=count;j++)for(const side of [-1,1]){
     const x=T.MathUtils.lerp(x0,x1,j/count)+side*dx,y=T.MathUtils.lerp(y0,y1,j/count)+side*dy;
     const hit=surface.sample(new T.Vector3(x,y,back?-.7:.7),new T.Vector3(x,y,0),.010);
     valid.push(!!hit);pos.push(x,y,hit?.point.z??0);indices.push(...(hit?.indices??[0,0,0,0]));weights.push(...(hit?.weights??[1,0,0,0]));
    }
    for(let j=0;j<count;j++){const a=j*2;for(const tri of [[a,a+1,a+3],[a,a+3,a+2]])if(tri.every(v=>valid[v]))triangles.push(...(back?tri.reverse():tri));}
    if(triangles.length){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));g.setIndex(triangles);g.computeVertexNormals();parts.push({geometry:g,finish});}
   }
  }
  const mirror=(points:Point[],s:number):Point[]=>points.map(([x,y])=>[x*s,y]);
  // Chest and articulated abdomen: leave the central logo readable.
  for(const s of [-1,1]){
   panel(mirror([[.025,1.53],[.14,1.51],[.182,1.43],[.115,1.34],[.103,1.22],[.025,1.26]],s),0);
   panel(mirror([[.10,1.50],[.173,1.48],[.19,1.42],[.143,1.36],[.105,1.40]],s),id==='DS_Neural_Rider'?1:0);
   for(let j=0;j<3;j++)panel(mirror([[.023,1.28-j*.068],[.11,1.25-j*.068],[.097,1.205-j*.068],[.025,1.225-j*.068]],s),0);
   stripe(mirror([[.165,1.47],[.135,1.36],[.14,1.25],[.115,1.10],[.13,.98]],s),id==='DS_Neural_Rider'?.008:.012,2);
   // Arm and leg highlights follow the original skin weights, including wrists.
   stripe(mirror([[.225,1.48],[.265,1.42],[.29,1.28]],s),.012,2);
   stripe(mirror([[.304,1.19],[.332,1.08],[.34,.97]],s),.012,2);
   stripe(mirror([[.14,.94],[.17,.80],[.157,.65],[.18,.54]],s),.011,2);
   stripe(mirror([[.18,.43],[.185,.31],[.172,.19]],s),.012,2);
   panel(mirror([[.12,.56],[.17,.58],[.205,.53],[.194,.46],[.15,.44],[.112,.49]],s),id==='DS_Neural_Rider'?1:0);
   stripe(mirror([[.12,.55],[.165,.57],[.2,.53]],s),.008,2);
   // Back: converging spine rails, with the original charm and badge retained.
   panel(mirror([[.027,1.50],[.15,1.46],[.15,1.32],[.103,1.20],[.045,1.25]],s),0,true);
   stripe(mirror([[.16,1.47],[.14,1.35],[.11,1.2],[.13,1.06]],s),.013,2,true);
   stripe(mirror([[.14,.93],[.165,.77],[.17,.62]],s),.010,2,true);
   // Angular jaw and brow surround the real dark visor, not an image of a face.
   panel(mirror([[.025,1.658],[.08,1.68],[.117,1.655],[.09,1.616],[.026,1.609]],s),1);
   stripe(mirror([[.0,1.78],[.085,1.773],[.124,1.742],[.125,1.68],[.08,1.625],[.025,1.619]],s),.009,2);
   if(id==='DS_Vampire_Rider'){
    // The reference's crimson lapels and camo shoulder panels.
    panel(mirror([[.055,1.535],[.13,1.51],[.12,1.45],[.075,1.34],[.08,1.44]],s),2,false,.011);
    stripe(mirror([[.055,1.535],[.13,1.51],[.075,1.34]],s),.006,3);
   }
   if(id==='DS_Detroit_Rider')stripe(mirror([[.172,1.48],[.152,1.35],[.156,1.23],[.13,1.10]],s),.004,3);
   if(id==='DS_Ghoulies_Rider'){
    panel(mirror([[.06,1.525],[.15,1.50],[.18,1.425],[.12,1.36],[.055,1.37]],s),s>0?1:0,false,.013);
    panel(mirror([[.10,.94],[.18,.91],[.18,.77],[.14,.69],[.08,.79]],s),s>0?1:0);
    // Yellow eye flashes above the visor and mechanical muzzle teeth.
    panel(mirror([[.023,1.758],[.09,1.77],[.076,1.749],[.03,1.744]],s),2,false,.012);
    panel(mirror([[.026,1.651],[.043,1.65],[.037,1.626]],s),3,false,.014);
   }
  }
  if(id==='DS_Ghoulies_Rider'){
   for(const [radius,finish,clearance]of [[.049,2,.014],[.037,3,.017]])panel(Array.from({length:32},(_,i)=>[Math.sin(i/32*Math.PI*2)*radius,1.407+Math.cos(i/32*Math.PI*2)*radius] as Point),finish,false,clearance);
  }
  if(id==='DS_Neural_Rider'){
   stripe([[0,1.32],[0,1.13]],.009,2);
   for(const back of [false,true]){
    const circle:Point[]=Array.from({length:25},(_,i)=>[Math.sin(i/24*Math.PI*2)*.106,1.405+Math.cos(i/24*Math.PI*2)*.106]);stripe(circle,.009,2,back);
   }
  }
  const merged:Part[]=[];
  for(let finish=0;finish<palette.length;finish++){
   const selected=parts.filter(p=>p.finish===finish);if(!selected.length)continue;
   const geometry=mergeGeometries(selected.map(p=>p.geometry));
   if(geometry){geometry.computeBoundingBox();geometry.computeBoundingSphere();merged.push({geometry,finish});}
  }
  for(const part of parts)part.geometry.dispose();
  template={parts:merged,bones:surface.boneNames};surface.dispose();
  if(key){let entries=cache.get(key);if(!entries){entries=new Map();cache.set(key,entries);}entries.set(id,template);}
 }
 const meshes:T.SkinnedMesh[]=[];
 for(const {geometry,finish} of template.parts){
  const material=new T.MeshStandardMaterial({name:id+' / reference armor '+finish,color:palette[finish],roughness:finish===1?.38:.64,metalness:finish===1?.6:.18,side:T.DoubleSide});
  if(id==='DS_Neural_Rider'&&finish===2){material.emissive.set(palette[finish]);material.emissiveIntensity=.25;}
  const mesh=new T.SkinnedMesh(geometry.clone(),material);mesh.name=id+' fitted reference armor '+finish;
  root.add(mesh);root.updateWorldMatrix(true,true);mesh.bind(new T.Skeleton(template.bones.map(name=>root.getObjectByName(name) as T.Bone)));
  mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=true;meshes.push(mesh);
 }
 if(!key)for(const part of template.parts)part.geometry.dispose();
 return {dispose(){for(const mesh of meshes){mesh.removeFromParent();mesh.geometry.dispose();mesh.skeleton.dispose();(mesh.material as T.Material).dispose();}}};
}

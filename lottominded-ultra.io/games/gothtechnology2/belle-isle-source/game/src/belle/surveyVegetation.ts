import * as T from 'three';
import {inside, segment, type ParkTerrain} from './terrain.ts';
import {surveySites,shelterLawn} from './surveySites.ts';
import type {Plant} from './naturePlan.ts';

export function keepOriginalTree(p:{x:number;z:number}){
 return !inside(p.x,p.z,shelterLawn);
}

export async function addSurveyVegetation(scene:T.Scene,terrain:ParkTerrain){
 const atlas=await new T.TextureLoader().loadAsync(new URL('./districtModels/woodland.webp',import.meta.url).href);
 atlas.colorSpace=T.SRGBColorSpace;
 atlas.anisotropy=4;
 const material=new T.MeshLambertMaterial({map:atlas,side:T.DoubleSide,alphaTest:.32});
 const trees:Plant[]=[];
 for(const site of surveySites){
  const positions:number[]=[],uv:number[]=[],indices:number[]=[];
  for(const [index,[dx,dz,height,kind]] of site.plants.entries()){
   const x=site.anchor[0]+dx,z=site.anchor[1]+dz,y=terrain.height(x,z);
   const half=height*(kind==='tree'?.29:.5);
   if(!terrain.land(x,z)||terrain.obstructed(x,z,.55))continue;
   const crossesRoad=terrain.map.roads.some(road=>road.points.some((p,i)=>i>0 && segment(x,z,road.points[i-1],p).d < road.width/2+half+.5));
   if(crossesRoad)continue;
   if(kind==='tree'){
    const id=site.name==='Nashua Canal'&&index%2===0?'willow':index%3===2?'birch':'maple';
    trees.push({id,x,y,z,scale:height/16,yaw:index*2.39996,tint:.9+(index%4)*.045});
    terrain.flightSolids.add({x,z,bottom:y,top:y+height,radius:.28,kind:'tree'});
    continue;
   }
   for(let face=0;face<2;face++){
    const yaw=index*2.39996+face*Math.PI/2,wx=half*Math.cos(yaw),wz=half*Math.sin(yaw);
    const start=positions.length/3;
    positions.push(x-wx,y,z-wz,x+wx,y,z+wz,x+wx,y+height,z+wz,x-wx,y+height,z-wz);
    const left=face*.5+.001,right=(face+1)*.5-.001,bottom=.001,top=.499;
    uv.push(left,bottom,right,bottom,right,top,left,top);
    indices.push(start,start+1,start+2,start,start+2,start+3);
   }
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  // Static world-space vertices share this bound in every camera and detail tier.
  const mesh=new T.Mesh(geometry,material);
  mesh.name=site.name+' · mapped vegetation';
  mesh.receiveShadow=true;
  scene.add(mesh);
 }
 return trees;
}

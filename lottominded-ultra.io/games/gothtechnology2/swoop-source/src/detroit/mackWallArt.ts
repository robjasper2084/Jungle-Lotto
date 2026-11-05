import * as T from 'three';
import {MACK_STUDIO} from './mackStudioSite.ts';

export const STATIC_WAVE_ART=new URL('../../art/route-campaign/static-wave-mural.png',import.meta.url).href;
/** +X is the studio wall nearest the Cut. Keep the figure's proportions while
 * extending the skyline wings across the unusually long, low warehouse wall. */
export function mackMuralGeometry(){
 const height=6.07,width=MACK_STUDIO.depth+.29,centre=height*(1344/752)*.5;
 const xs=[-width/2,-centre/2,centre/2,width/2],us=[0,.25,.75,1],positions:number[]=[],uvs:number[]=[];
 for(let i=0;i<3;i++)for(const k of [0,1,2,0,2,3]){
  const right=k===1||k===2,top=k>=2;
  positions.push(xs[i+(right?1:0)],top?height:0,0);uvs.push(us[i+(right?1:0)],top?1:0);
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.computeVertexNormals();return g;
}
export async function addMackWallArt(building:T.Object3D){
 const map=await new T.TextureLoader().loadAsync(STATIC_WAVE_ART);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;
 const paint=new T.MeshStandardMaterial({map,roughness:.97,metalness:0,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 paint.userData.finish='Higgsfield aerosol paint on masonry';
 const mural=new T.Mesh(mackMuralGeometry(),paint);mural.name='Static Wave · full Cut-facing Innovation Floor mural';
 mural.position.set(MACK_STUDIO.width/2+.155,.01,0);mural.rotation.y=Math.PI/2;mural.receiveShadow=true;building.add(mural);
 return mural;
}

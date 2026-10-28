import * as T from 'three';
import type {DowntownArena} from '../../../../ride-core/src/royale/downtownArena.ts';

export const ROYALE_SUN=new T.Vector3(36,15,24).normalize();
export const ROYALE_HAZE='#9fb6c2';
const district={x:-72.5,z:-1180};
/** Royale-only dressing. All placement comes from existing, playable map geometry. */
export function polishRiverfront(root:T.Scene,arena:DowntownArena,materials:Record<string,T.MeshStandardMaterial>){
 const transform=arena.terrain.fixture.transform;
 // Keep the shared river material: a second clearcoat made the harbor appear white.
 for(const key of ['asphalt','grass','concrete']){
  const m=materials[key];if(!m)continue;
  if(key==='asphalt'){m.color.set('#626e76');m.roughness=.72;m.envMapIntensity=.5;}
  if(key==='grass')m.color.set('#85936b');
  const before=m.onBeforeCompile;
  m.onBeforeCompile=function(shader,renderer){
   before.call(this,shader,renderer);
   shader.vertexShader='varying vec2 districtPosition;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ndistrictPosition=(modelMatrix*vec4(transformed,1.0)).xz;');
   shader.fragmentShader='varying vec2 districtPosition;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
    float districtMask=1.0-smoothstep(150.0,230.0,length(districtPosition-vec2(${((district.x-transform.tx)/transform.sx).toFixed(1)},${(district.z-transform.tz).toFixed(1)})));
    float mottling=sin(districtPosition.x*.071+sin(districtPosition.y*.043))*sin(districtPosition.y*.097);
    diffuseColor.rgb*=1.0+districtMask*mottling*.14;`);
  };
  m.customProgramCacheKey=()=>`royale-riverfront-${key}-1`;m.needsUpdate=true;
 }
 // Thin paint rings make existing supply stops legible without inventing cover.
 const sites=arena.supplies.map(p=>({map:p,source:arena.sourcePosition(p)})).filter(p=>Math.hypot(p.source.x-district.x,p.source.z-district.z)<180).slice(0,24);
 const geometry=new T.RingGeometry(1.12,1.20,24,1,0,Math.PI*1.65);
 const paint=new T.MeshBasicMaterial({color:'#73c9c1',transparent:true,opacity:.48,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
 const rings=new T.InstancedMesh(geometry,paint,sites.length),dummy=new T.Object3D();rings.name='Atwater supply route paint';
 for(const [i,p] of sites.entries()){dummy.position.set(p.source.x,p.source.y+.035,p.source.z);dummy.rotation.set(-Math.PI/2,0,i*1.3);dummy.updateMatrix();rings.setMatrixAt(i,dummy.matrix);}
 if(sites.length){rings.computeBoundingSphere();root.add(rings);}
 // Reflective trim follows existing food-cart and truck collider tops; they do not change collision.
 const boxes=(arena.terrain.fixture.staticBoxes??[]).filter(b=>Math.hypot(b.x-district.x,b.z-district.z)<180&&/Food truck ·|Sea Moss cart/.test(b.kind)&&b.hy>=.3&&b.hy<=2.2).slice(0,32);
 const caps=new T.InstancedMesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial({color:'#cba96f',emissive:'#bd7838',emissiveIntensity:.22,roughness:.55}),boxes.length);caps.name='Atwater landmark roof trim';
 for(const [i,b] of boxes.entries()){dummy.position.set(b.x,b.y+b.hy+.012,b.z);dummy.rotation.set(0,b.yaw,0);dummy.scale.set(b.hx*2,.025,.08);dummy.updateMatrix();caps.setMatrixAt(i,dummy.matrix);}
 if(boxes.length){caps.computeBoundingSphere();root.add(caps);}
 root.userData.riverfront={supplies:sites.length,coverCaps:boxes.length};
 return {update(p:{x:number;z:number}){const near=Math.hypot(p.x-district.x,p.z-district.z)<320;rings.visible=near;caps.visible=near;}};
}

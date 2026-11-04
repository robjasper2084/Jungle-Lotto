import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {ParkMap,Point} from './terrain.ts';
import {OUDOLF_BEDS,oudolfLawnPanels} from './oudolf.ts';

/** Details follow mapped bed boundaries. Lawn aisles are identified from the
 * official aerial; individual plant labels are interpretive game wayfinding. */
export function addOudolfDetails(scene:T.Scene,map:ParkMap,lawn:T.MeshStandardMaterial){
 const group=new T.Group();group.name='Oudolf Garden · summer perennial beds';
 const soil:T.BufferGeometry[]=[],steel:T.BufferGeometry[]=[],aisles:T.BufferGeometry[]=[];
 const shape=(p:Point[],y:number)=>{const s=new T.Shape(p.map(v=>new T.Vector2(v[0],-v[1]))),g=new T.ShapeGeometry(s);g.rotateX(-Math.PI/2);g.translate(0,y,0);const a=g.attributes.position;const uv=[];for(let i=0;i<a.count;i++)uv.push(a.getX(i)/8,a.getZ(i)/8);g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));return g;};
 for(const bed of map.areas.filter(b=>OUDOLF_BEDS.has(b.id))){
  soil.push(shape(bed.points,2.024));
  for(let i=1;i<bed.points.length;i++){
   const a=bed.points[i-1],b=bed.points[i],l=Math.hypot(b[0]-a[0],b[1]-a[1]);
   const g=new T.BoxGeometry(.035,.055,l+.015);g.rotateY(Math.atan2(b[0]-a[0],b[1]-a[1]));g.translate((a[0]+b[0])/2,2.042,(a[1]+b[1])/2);steel.push(g);
  }
 }
 for(const panel of oudolfLawnPanels(map))aisles.push(shape(panel,2.078));
 const mulch=new T.MeshStandardMaterial({color:0x494338,roughness:1});
 mulch.onBeforeCompile=s=>{
  s.vertexShader='varying vec2 bedXZ;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nbedXZ=position.xz;');
  s.fragmentShader='varying vec2 bedXZ;\n'+s.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   float noise=fract(sin(dot(floor(bedXZ*28.),vec2(12.9898,78.233)))*43758.54);
   float grain=1.-smoothstep(.3,1.6,length(fwidth(bedXZ))*28.);
   diffuseColor.rgb*=mix(1.,.82+noise*.34,grain);
  `);
 };mulch.customProgramCacheKey=()=>'oudolf-mulch-v1';
 function add(parts:T.BufferGeometry[],material:T.Material,name:string){if(!parts.length)return;const mesh=new T.Mesh(mergeGeometries(parts,false)!,material);mesh.name=name;mesh.receiveShadow=true;group.add(mesh);for(const g of parts)g.dispose();}
 add(soil,mulch,'Oudolf soil beds');add(steel,new T.MeshStandardMaterial({color:0x363f39,roughness:.78,metalness:.4}),'Oudolf flush steel edging');
 const cutLawn=lawn.clone();cutLawn.color.setHex(0x70835a);cutLawn.onBeforeCompile=lawn.onBeforeCompile;
 add(aisles,cutLawn,'Oudolf mown lawn aisles');
 const labelCanvas=document.createElement('canvas');labelCanvas.width=512;labelCanvas.height=256;const ctx=labelCanvas.getContext('2d')!;
 ctx.fillStyle='#e4e1ce';ctx.fillRect(0,0,512,256);ctx.fillStyle='#31463a';ctx.fillRect(24,26,8,202);ctx.font='bold 32px sans-serif';ctx.fillText('OUDOLF GARDEN',52,75);ctx.fillText('DETROIT',52,113);ctx.font='21px sans-serif';ctx.fillText('Perennials · grasses · seasonal colour',52,165);ctx.fillText('Explore the garden paths',52,204);
 const texture=new T.CanvasTexture(labelCanvas);texture.colorSpace=T.SRGBColorSpace;
 // A small sloped interpretive label in the planting, clear of the path.
 const label=new T.Mesh(new T.PlaneGeometry(.9,.45),new T.MeshStandardMaterial({map:texture,roughness:.9,side:T.DoubleSide}));label.name='Oudolf garden interpretive label';label.rotation.set(-Math.PI*.27,0,0);label.position.set(1080.8,2.45,1235.9);group.add(label);
 const stake=new T.Mesh(new T.BoxGeometry(.035,.42,.035),new T.MeshStandardMaterial({color:0x38473e,roughness:.8}));stake.position.set(1080.8,2.21,1235.9);group.add(stake);
 scene.add(group);return {update(x:number,z:number){group.visible=Math.hypot(x-1077,z-1228)<340;},stats:{beds:soil.length,lawnPanels:aisles.length}};
}

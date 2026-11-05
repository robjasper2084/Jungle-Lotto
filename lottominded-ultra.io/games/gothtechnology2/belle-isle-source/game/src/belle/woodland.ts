import * as T from 'three';
import type {ParkMap} from './terrain.ts';

/** Leaf litter sits below path paving; mapped water holes remain completely open. */
export function addWoodlandFloor(scene:T.Scene,map:ParkMap){
 const material=new T.MeshStandardMaterial({color:0x69694a,roughness:1});material.name='Flatwoods forest floor';
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec2 forestXZ;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nforestXZ=position.xz;');
  shader.fragmentShader='varying vec2 forestXZ;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   vec2 q=forestXZ,cell=floor(q*9.),p=fract(q*9.)-.5;
   float seed=fract(sin(dot(cell,vec2(12.9898,78.233)))*43758.5453),angle=seed*6.283;
   p=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*p;
   float leaf=1.-smoothstep(.15,.15+length(fwidth(q))*7.,length(p*vec2(1.,2.8)));
   float detail=1.-smoothstep(.05,.25,length(fwidth(q)));
   float litterTone=.5+.23*sin(q.x*.19+sin(q.y*.13))+.24*sin(q.y*.31+q.x*.12);
   diffuseColor.rgb*=mix(vec3(.53,.51,.36),vec3(.92,.89,.64),litterTone);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.19,.15,.085)*(.75+seed*.5),leaf*detail*.48);
  `);
 };material.customProgramCacheKey=()=>'flatwoods-leaf-litter-v1';
 for(const a of map.areas.filter(a=>a.kind==='wood'||a.kind==='forest')){
  const shape=new T.Shape(a.points.map(p=>new T.Vector2(p[0],-p[1])));
  for(const hole of a.holes||[])shape.holes.push(new T.Path(hole.map(p=>new T.Vector2(p[0],-p[1]))));
  const g=new T.ShapeGeometry(shape);g.rotateX(-Math.PI/2);g.translate(0,2.006,0);
  const mesh=new T.Mesh(g,material);mesh.name='Woodland leaf litter '+a.id;mesh.receiveShadow=true;scene.add(mesh);
 }
}

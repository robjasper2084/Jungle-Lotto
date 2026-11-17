import * as T from 'three';
import {inside,type ParkMap} from './terrain.ts';
/** Low-cost reflected tree tint in sheltered mapped canals, not a full probe.
 * One bounded transparent ribbon, no external textures or physics changes. */
export const CANAL_REFLECTION_EDGE_LIMIT=900;
export function planCanalReflections(map:ParkMap){
 const focus=map.pois.filter(p=>/^(Sylvan|Nashua|Loop) Canal$/.test(p.name));
 const positions:number[]=[],uv:number[]=[],indices:number[]=[];let edges=0,lengthSoFar=0;
 if(!focus.length)return{positions,uv,indices,edges};
 for(const water of map.water){
  const wet=(x:number,z:number)=>inside(x,z,water.points)&&!water.holes.some(h=>inside(x,z,h));
  for(const ring of [water.points,...water.holes])for(let i=1;i<ring.length&&edges<CANAL_REFLECTION_EDGE_LIMIT;i++){
   const a=ring[i-1],b=ring[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
   if(len<.25||len>120)continue;
   const midX=(a[0]+b[0])/2,midZ=(a[1]+b[1])/2;
   if(!focus.some(q=>Math.hypot(q.x-midX,q.z-midZ)<210))continue;
   let nx=dz/len,nz=-dx/len;
   if(!wet(midX+nx*.55,midZ+nz*.55)){nx=-nx;nz=-nz;}
   if(!wet(midX+nx*.55,midZ+nz*.55))continue;
   const width=wet(midX+nx*2.2,midZ+nz*2.2)?2.2:.75;
   const steps=Math.min(12,Math.max(1,Math.ceil(len/5)));
   for(let j=0;j<steps&&edges<CANAL_REFLECTION_EDGE_LIMIT;j++){
    const t0=j/steps,t1=(j+1)/steps,s=positions.length/3;
    for(const [t,side] of [[t0,0],[t1,0],[t0,1],[t1,1]]){
     const off=.08+side*width;
     positions.push(a[0]+dx*t+nx*off,1.062,a[1]+dz*t+nz*off);
     uv.push(lengthSoFar+len*t,side);
    }
    indices.push(s,s+1,s+2,s+1,s+3,s+2);edges++;
   }
   lengthSoFar+=len;
  }
 }
 return{positions,uv,indices,edges};
}
export function addCanalReflections(scene:T.Scene,map:ParkMap){
 const plan=planCanalReflections(map),clock={value:0};
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute(plan.positions,3));
 geometry.setAttribute('uv',new T.Float32BufferAttribute(plan.uv,2));
 geometry.setIndex(plan.indices);
 const material=new T.ShaderMaterial({
  uniforms:{canalTime:clock},transparent:true,depthWrite:false,side:T.DoubleSide,
  vertexShader:'varying vec2 vCanal;void main(){vCanal=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'varying vec2 vCanal;uniform float canalTime;void main(){float ripple=sin(vCanal.x*.55-canalTime*.75+sin(vCanal.y*4.))*.17;float streak=.5+.5*sin(vCanal.x*.19+ripple*2.);float shore=1.-smoothstep(.07,1.,vCanal.y);float alpha=(.08+.105*streak)*shore;gl_FragColor=vec4(vec3(.095,.19,.125),alpha);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'
 });
 const mesh=new T.Mesh(geometry,material);mesh.name='Soft reflected greenery along mapped wooded canals';
 mesh.castShadow=false;mesh.receiveShadow=false;mesh.renderOrder=3;scene.add(mesh);
 let quality='automatic';const stats={edges:plan.edges,triangles:plan.edges*2,maxDraws:1};
 return{stats,setQuality(value:string){quality=value;mesh.visible=quality!=='smooth'&&plan.edges>0;},
  update(time:number){clock.value=time;}};
}

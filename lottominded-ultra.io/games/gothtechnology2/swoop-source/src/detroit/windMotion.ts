import * as T from 'three';
export const windTime={value:0};
export function breeze(t:number){return .65+.25*Math.sin(t*.43)+.1*Math.sin(t*1.13);}
/** Only rear head-weighted hair vertices move; face, clothing and scalp stay fixed. */
export class HairWind {
 private materials:T.Material[]=[];private flow={value:new T.Vector2()};private strength={value:0};
 constructor(rider:T.Object3D,enabled:boolean){if(!enabled)return;
 rider.traverse(o=>{const mesh=o as T.SkinnedMesh;if(!mesh.isSkinnedMesh)return;
 const head=mesh.skeleton.bones.findIndex(b=>b.name==='Head');if(head<0)return;
 const install=(m:T.Material)=>{const old=m.onBeforeCompile;m.onBeforeCompile=(shader,renderer)=>{old.call(m,shader,renderer);shader.uniforms.hairTime=windTime;shader.uniforms.hairStrength=this.strength;shader.uniforms.hairFlow=this.flow;shader.vertexShader='uniform float hairTime; uniform float hairStrength; uniform vec2 hairFlow;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 float hw=0.;
 for(int k=0;k<4;k++){if(abs(skinIndex[k]-${head.toFixed(1)})<.1)hw+=skinWeight[k];}
 float tip=pow(clamp((1.72-position.y)/.65,0.,1.),1.5);
 float mask=smoothstep(.4,.85,hw)*(1.-smoothstep(-.10,-.045,position.z))*tip;
 float flutter=sin(hairTime*3.2+position.x*37.+position.y*9.)*.009*hairStrength;
 transformed.x+=mask*(hairFlow.x+flutter);
 transformed.z+=mask*hairFlow.y;
 `);};m.customProgramCacheKey=()=> 'swoop-hair-wind-'+head;this.materials.push(m);return m;};
 mesh.material=Array.isArray(mesh.material)?mesh.material.map(m=>install(m.clone())):install(mesh.material.clone());
 mesh.customDepthMaterial=install(new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking}));
 });}
 update(speed:number,heading:number,reduced:boolean){const strength=reduced?0:breeze(windTime.value);this.strength.value=strength;this.flow.value.set(strength*(Math.cos(heading)*.025+Math.sin(heading)*.014),strength*(-.014-Math.min(25,Math.abs(speed))*.002));}
 dispose(){this.materials.forEach(m=>m.dispose());}
}

import * as T from 'three';

/** Continuous facade LOD. Mapped silhouettes never swap or disappear. */
export function dressDetroitSkyline(root:T.Object3D,night:{value:number}){
 const seen=new Set<T.Material>();
 root.traverse(o=>{
  if(!(o instanceof T.Mesh))return;
  for(const material of Array.isArray(o.material)?o.material:[o.material]){
   if(!(material instanceof T.MeshStandardMaterial)||seen.has(material))continue;
   seen.add(material);
    const glass=material.name==='Detroit reflective blue glass',stone=material.name==='Detroit limestone',brick=material.name==='Detroit brick';
   if(!glass&&!stone&&!brick)continue;
   material.color.set(glass?0x416879:stone?0x9b9589:0x926b55);
   material.roughness=glass?.34:.83;material.metalness=glass?.24:.03;material.envMapIntensity=.7;
   material.onBeforeCompile=shader=>{
    shader.uniforms.cityNight=night;shader.uniforms.cityGlass={value:glass?1:0};
    shader.vertexShader='varying vec3 cityWorld;varying vec3 cityNormal;\n'+shader.vertexShader.replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
cityWorld=(modelMatrix*vec4(transformed,1.)).xyz;
cityNormal=normalize(mat3(modelMatrix)*objectNormal);`);
    shader.fragmentShader='varying vec3 cityWorld;varying vec3 cityNormal;uniform float cityNight;uniform float cityGlass;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
vec3 cn=normalize(cityNormal);float wall=1.-smoothstep(.55,.9,abs(cn.y));
vec2 facade=abs(cn.x)>abs(cn.z)?cityWorld.zy:cityWorld.xy;
vec2 cell=facade/vec2(mix(2.5,2.1,cityGlass),3.6),p=fract(cell);
float footprint=max(fwidth(cell.x),fwidth(cell.y));
float nearDetail=1.-smoothstep(.40,1.55,footprint);
float lod=1.-smoothstep(3200.,10000.,length(cameraPosition-cityWorld));
float pane=smoothstep(.12,.20,p.x)*(1.-smoothstep(.73,.81,p.x))*smoothstep(.15,.23,p.y)*(1.-smoothstep(.75,.83,p.y));
float windowMask=mix(.35,pane,nearDetail)*wall;
float floorBand=(1.-smoothstep(.035,.09,min(p.y,1.-p.y)))*nearDetail*wall;
float room=fract(sin(dot(floor(cell),vec2(12.9898,78.233)))*43758.5453);
float floorOccupancy=fract(sin(dot(floor(cell/vec2(4.,3.)),vec2(39.29,17.13)))*13947.31);
float office=step(.55,floorOccupancy)*step(.56,room),variation=mix(.88,1.12,room);
vec3 windowColor=mix(vec3(.12,.20,.24),vec3(.28,.43,.49),cityGlass)*variation;
diffuseColor.rgb=mix(diffuseColor.rgb,windowColor,windowMask*mix(.78,.32,cityGlass));
diffuseColor.rgb*=1.-floorBand*mix(.18,.40,cityGlass);
diffuseColor.rgb*=1.-cityNight*.79;
// The mean facade tint remains at subpixel distances, avoiding sparkling windows.
float cityLit=mix(.20,office,nearDetail)*windowMask*lod;
`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
vec3 interior=mix(vec3(1.,.68,.32),vec3(.73,.85,1.),step(.86,room));
totalEmissiveRadiance+=interior*cityLit*cityNight*.95;
`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>','#include <lights_fragment_end>\nreflectedLight.indirectSpecular*=1.-cityNight*.8;');
   };
   material.customProgramCacheKey=()=>'detroit-facades-lod-v2-'+Number(glass);material.needsUpdate=true;
  }
 });
}

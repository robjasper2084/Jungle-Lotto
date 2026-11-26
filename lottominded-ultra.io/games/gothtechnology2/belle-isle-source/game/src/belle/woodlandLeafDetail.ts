import * as T from 'three';
import {inheritAtmosphereProgram} from './atmosphereProgramIdentity.ts';

export const WOODLAND_LEAF_DETAIL_KEY='flatwoods-zero-detail-candidate-v1';

/** Exact authored block from d4f4baa8 woodland.ts, including its whitespace. */
export const WOODLAND_LEAF_DETAIL_ORIGINAL=`   vec2 q=forestXZ,cell=floor(q*9.),p=fract(q*9.)-.5;
   float seed=fract(sin(dot(cell,vec2(12.9898,78.233)))*43758.5453),angle=seed*6.283;
   p=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*p;
   float leaf=1.-smoothstep(.15,.15+length(fwidth(q))*7.,length(p*vec2(1.,2.8)));
   float detail=1.-smoothstep(.05,.25,length(fwidth(q)));
   float litterTone=.5+.23*sin(q.x*.19+sin(q.y*.13))+.24*sin(q.y*.31+q.x*.12);
   diffuseColor.rgb*=mix(vec3(.53,.51,.36),vec3(.92,.89,.64),litterTone);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.19,.15,.085)*(.75+seed*.5),leaf*detail*.48);
`;

export const WOODLAND_LEAF_DETAIL_MASKED=`   vec2 q=forestXZ;
   vec2 leafFootprint=fwidth(q);
   float detail=1.-smoothstep(.05,.25,length(fwidth(q)));
   float seed=0.,leaf=0.;
   if(detail>0.){
    vec2 cell=floor(q*9.),p=fract(q*9.)-.5;
    seed=fract(sin(dot(cell,vec2(12.9898,78.233)))*43758.5453);
    float angle=seed*6.283;
    p=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*p;
    leaf=1.-smoothstep(.15,.15+length(leafFootprint)*7.,length(p*vec2(1.,2.8)));
   }
   float litterTone=.5+.23*sin(q.x*.19+sin(q.y*.13))+.24*sin(q.y*.31+q.x*.12);
   diffuseColor.rgb*=mix(vec3(.53,.51,.36),vec3(.92,.89,.64),litterTone);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.19,.15,.085)*(.75+seed*.5),leaf*detail*.48);
`;

type Installation={compile:T.Material['onBeforeCompile'];key:T.Material['customProgramCacheKey']};
const installed=new WeakMap<T.Material,Installation>();
function requireContract(ok:unknown,message:string):asserts ok {
 if(!ok)throw new Error('Woodland leaf-detail proof contract: '+message);
}
function occurrences(source:string,token:string){return source.split(token).length-1;}
function eligible(material:T.Material):material is T.MeshStandardMaterial {
 const m=material as T.MeshStandardMaterial;
 return Object.getPrototypeOf(material)===T.MeshStandardMaterial.prototype&&material.name==='Flatwoods forest floor'&&
  !material.transparent&&material.opacity===1&&material.alphaTest===0&&!material.alphaHash&&!m.wireframe;
}

/** Disabled final-material experiment; install after every original decorator.
 * Both fwidth evaluations stay unconditional. For the original finite surface,
 * the retained final mix has an exactly zero leaf weight when detail is zero.
 * The visible branch keeps its authored expressions and associations; only the
 * first derivative is read from a value evaluated before divergent control flow.
 *
 * Compiler scheduling/rounding can still change pixels. Source tests do not
 * establish equivalence: strict original-versus-candidate native RGBA tests and
 * a useful measured benefit are required before any production integration.
 * No geometry, texture, draw callback, shared shader chunk or pool registration
 * changes. In particular, the original unapproved woodland hook stays outside
 * the shared-geometry pool. This helper has no production callers.
 */
export function installWoodlandLeafDetail(material:T.Material,options:Readonly<{enabled?:boolean}>={}):boolean {
 if(options.enabled!==true)return false;
 const existing=installed.get(material);
 if(existing){
  requireContract(material.onBeforeCompile===existing.compile&&material.customProgramCacheKey===existing.key,'installed hooks changed');
  return true;
 }
 if(!eligible(material))return false;
 const previousCompile=material.onBeforeCompile,previousKey=material.customProgramCacheKey();
 material.onBeforeCompile=function(shader,renderer){
  requireContract(eligible(this),'approved material changed');
  previousCompile.call(this,shader,renderer);
  requireContract(eligible(this),'inherited hook changed the approved material');
  requireContract(occurrences(shader.vertexShader,'forestXZ=position.xz;')===1&&
   occurrences(shader.vertexShader,'varying vec2 forestXZ;')===1&&
   occurrences(shader.fragmentShader,'varying vec2 forestXZ;')===1,'original woodland coordinates missing or duplicated');
  requireContract(occurrences(shader.fragmentShader,WOODLAND_LEAF_DETAIL_ORIGINAL)===1,'original leaf block missing or duplicated');
  requireContract(!/\bleafFootprint\b/.test(shader.vertexShader+'\n'+shader.fragmentShader),'candidate variable already present');
  shader.fragmentShader=shader.fragmentShader.replace(WOODLAND_LEAF_DETAIL_ORIGINAL,WOODLAND_LEAF_DETAIL_MASKED);
 };
 inheritAtmosphereProgram(material,previousCompile);
 material.customProgramCacheKey=()=>previousKey+'|'+WOODLAND_LEAF_DETAIL_KEY;
 material.needsUpdate=true;
 installed.set(material,{compile:material.onBeforeCompile,key:material.customProgramCacheKey});
 return true;
}

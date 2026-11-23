import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export type CadillacWheelVariant='cadillac'|'hydraulic-cadillac';
export type CadillacRimStyle='stock'|'wire-gold'|'wire-chrome';
export type CadillacTireStyle='standard'|'whitewall'|'low-profile'|'low-profile-whitewall';
export type CadillacCenterStyle='gold'|'black'|'white';
export type CadillacWheelSelection={rim:CadillacRimStyle;tire:CadillacTireStyle;center:CadillacCenterStyle};
export const CADILLAC_WHEEL_DEFAULTS:Readonly<CadillacWheelSelection>=Object.freeze({rim:'stock',tire:'standard',center:'gold'});
const rims:readonly CadillacRimStyle[]=['stock','wire-gold','wire-chrome'];
const tires:readonly CadillacTireStyle[]=['standard','whitewall','low-profile','low-profile-whitewall'];
const centers:readonly CadillacCenterStyle[]=['gold','black','white'];
const corners=['FL','FR','RL','RR'] as const;

export function normalizeCadillacWheelSelection(input:unknown):CadillacWheelSelection{
 const item=input&&typeof input==='object'&&!Array.isArray(input)?input as Record<string,unknown>:{};
 const rim=rims.includes(item.rim as CadillacRimStyle)?item.rim as CadillacRimStyle:'stock';
 return {rim,tire:tires.includes(item.tire as CadillacTireStyle)?item.tire as CadillacTireStyle:'standard',
  center:rim!=='stock'&&centers.includes(item.center as CadillacCenterStyle)?item.center as CadillacCenterStyle:'gold'};
}

/** Local wheel coordinates: +X points out of the car, spin is about X.
 * These envelopes include the hydraulic car's fitted candy-red/gold rim. A low sidewall
 * increases the rim opening inside the original rolling diameter; it cannot
 * change the ground-contact height, gearing, steering or collision envelope. */
export const CADILLAC_WHEEL_FITS={
 cadillac:{radius:.346,halfWidth:.112,outset:.149,stockRimRadius:.204,wireRimRadius:.220,lowRimRadius:.254},
 'hydraulic-cadillac':{radius:.365164,halfWidth:.1218,outset:.129,stockRimRadius:.249,wireRimRadius:.249,lowRimRadius:.276},
} as const;
const chrome=0xe9edf2,gold=0xe5b957,rubber=0x16191c,whitewall=0xf1eee4;
type Assembly={rubber:T.BufferGeometry;metal?:T.BufferGeometry;stock?:T.Mesh[][];triangles:number};
type Wheel={spin:T.Object3D;source:T.Object3D;sourceVisible:boolean;custom:T.Group;tireMesh:T.Mesh;stockMeshes:T.Mesh[];stockTransforms:T.Matrix4[]};

function colored(geometry:T.BufferGeometry,color:number){
 const value=new T.Color(color),count=geometry.getAttribute('position').count,colors=new Float32Array(count*3);
 for(let i=0;i<count;i++){colors[i*3]=value.r;colors[i*3+1]=value.g;colors[i*3+2]=value.b;}
 geometry.setAttribute('color',new T.BufferAttribute(colors,3));return geometry;
}
function merge(parts:T.BufferGeometry[],name:string){
 const geometry=mergeGeometries(parts,false);for(const part of parts)part.dispose();
 if(!geometry)throw Error('Cadillac wheel geometry could not be combined');
 geometry.name=name;geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
function lathe(profile:number[][],color:number){
 const geometry=new T.LatheGeometry(profile.map(([radius,x])=>new T.Vector2(radius,x)),48);
 geometry.rotateZ(-Math.PI/2);return colored(geometry,color);
}
function cylinder(radius:number,length:number,x:number,color:number,segments=32){
 const geometry=new T.CylinderGeometry(radius,radius,length,segments,1);
 geometry.rotateZ(-Math.PI/2);geometry.translate(x,0,0);return colored(geometry,color);
}
function disk(radius:number,x:number,color:number){
 const geometry=new T.CircleGeometry(radius,32);geometry.rotateY(Math.PI/2);geometry.translate(x,0,0);return colored(geometry,color);
}
function spoke(from:T.Vector3,to:T.Vector3,color:number){
 const direction=to.clone().sub(from),geometry=new T.CylinderGeometry(.00145,.00145,direction.length(),3,1,true);
 geometry.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),direction.normalize()));
 geometry.translate((from.x+to.x)/2,(from.y+to.y)/2,(from.z+to.z)/2);return colored(geometry,color);
}
function spinner(x:number,angle:number,scale:number,color:number){
 const points=[[.033,-.017],[.094,0],[.033,.017]],vertices:number[]=[];
 for(const depth of [x-.011,x-.005])for(const [u,v]of points)vertices.push(depth,scale*(u*Math.cos(angle)-v*Math.sin(angle)),scale*(u*Math.sin(angle)+v*Math.cos(angle)));
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
 geometry.setIndex([0,2,1,3,4,5,0,1,4,0,4,3,1,2,5,1,5,4,2,0,3,2,3,5]);geometry.computeVertexNormals();
 geometry.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(12),2));return colored(geometry,color);
}
function tireParts(radius:number,half:number,rim:number,white:boolean){
 const profile=[
  [rim-.007,-half*.81],[rim+.008,-half],[radius*.915,-half*.98],[radius*.985,-half*.78],
  [radius,-half*.58],[radius,half*.58],[radius*.985,half*.78],[radius*.915,half],
  [rim+.008,half*.98],[rim-.007,half*.81],[rim-.007,-half*.81],
 ];
 if(!white)return[lathe(profile,rubber)];
 const outer=radius*.90,inner=Math.max(rim+.012,radius*.74),from=profile[7],to=profile[8];
 const at=(r:number)=>[r,T.MathUtils.lerp(from[1],to[1],(from[0]-r)/(from[0]-to[0]))];
 // Separate profile segments give the whitewall a crisp edge without a decal,
 // another draw, a fetched texture or coplanar surfaces that could shimmer.
 const upper=at(outer),lower=at(inner);
 return [lathe([...profile.slice(0,8),upper],rubber),lathe([upper,lower],whitewall),lathe([lower,...profile.slice(8)],rubber)];
}

/** Visual-only replacements remain children of the existing steering/spin
 * nodes. Original meshes, their materials and all suspension mounts survive.
 * Geometry is built once per chosen combination and shared by all four wheels;
 * no wheel work or scene traversal is added to the animation loop. */
export class CadillacWheels{
 readonly radius:number;
 private current:CadillacWheelSelection={...CADILLAC_WHEEL_DEFAULTS};
 private readonly wheels:Wheel[];
 private readonly cache=new Map<string,Assembly>();
 private readonly owned=new Set<T.BufferGeometry>();
 private readonly metalMaterial=new T.MeshStandardMaterial({name:'Cadillac custom polished wheel metal',vertexColors:true,metalness:1,roughness:.16});
 private readonly rubberMaterial=new T.MeshStandardMaterial({name:'Cadillac custom tire and center finish',vertexColors:true,metalness:0,roughness:.86});
 private disposed=false;
 constructor(model:T.Object3D,readonly variant:CadillacWheelVariant='cadillac'){
  const fit=CADILLAC_WHEEL_FITS[variant];this.radius=fit.radius;
  model.updateWorldMatrix(true,true);
  this.wheels=corners.map(corner=>{
   const spin=model.getObjectByName(variant==='cadillac'?'Spin'+corner:'Wheel_'+corner);
   const source=spin?.getObjectByName(variant==='cadillac'?'Tire'+corner:'WheelGeometry_'+corner);
   if(!spin||!source)throw Error('Cadillac wheel rig missing: '+corner);
   const custom=new T.Group();custom.name='Cadillac_CustomWheel_'+corner;custom.visible=false;
   if(corner.endsWith('R'))custom.rotation.y=Math.PI;
   spin.add(custom);custom.updateWorldMatrix(true,false);
   const outward=custom.matrixWorld.clone().invert(),stockMeshes:T.Mesh[]=[],stockTransforms:T.Matrix4[]=[];let tireMesh:T.Mesh|undefined;
   source.traverse(object=>{
    if(!(object instanceof T.Mesh))return;
    const materialNames=([] as T.Material[]).concat(object.material).map(material=>material.name);
    // The hydraulic loader replaces its chrome primitive with the authored
    // candy-red/gold wire assembly before this editor is created. That fitted
    // mesh is the original option, including its colors and material.
    if(materialNames.some(name=>name==='Wire wheel and crest'||name==='Cadillac_Chrome'||name==='Candy red and gold wire finish')){stockMeshes.push(object);stockTransforms.push(new T.Matrix4().multiplyMatrices(outward,object.matrixWorld));}
    if(materialNames.some(name=>name==='Whitewall and tread'||name==='Cadillac_Rubber'))tireMesh=object;
   });
   if(!stockMeshes.length||!tireMesh)throw Error('Cadillac original wheel geometry missing: '+corner);
   return{spin,source,sourceVisible:source.visible,custom,tireMesh,stockMeshes,stockTransforms};
  });
 }
 get selection():CadillacWheelSelection{return{...this.current};}
 apply(selection:CadillacWheelSelection){
  if(this.disposed||!selection||!rims.includes(selection.rim)||!tires.includes(selection.tire)||!centers.includes(selection.center))return false;
  const next=normalizeCadillacWheelSelection(selection),key=JSON.stringify(next);
  if(key===JSON.stringify(this.current))return true;
  const original=next.rim==='stock'&&next.tire==='standard';
  let assembly:Assembly|undefined;
  if(!original){assembly=this.cache.get(key);if(!assembly){assembly=this.build(next);this.cache.set(key,assembly);}}
  for(let i=0;i<this.wheels.length;i++){
   const wheel=this.wheels[i];wheel.source.visible=original?wheel.sourceVisible:false;wheel.custom.clear();wheel.custom.visible=!original;
   if(assembly){
    const tire=new T.Mesh(assembly.rubber,this.rubberMaterial);tire.name=wheel.custom.name+'_Tire';tire.castShadow=wheel.tireMesh.castShadow;tire.receiveShadow=wheel.tireMesh.receiveShadow;wheel.custom.add(tire);
    if(assembly.metal){const rim=new T.Mesh(assembly.metal,this.metalMaterial);rim.name=wheel.custom.name+'_Wire';rim.castShadow=wheel.stockMeshes[0].castShadow;rim.receiveShadow=wheel.stockMeshes[0].receiveShadow;wheel.custom.add(rim);}
    else for(const [index,rim]of assembly.stock![i].entries()){rim.castShadow=wheel.stockMeshes[index].castShadow;rim.receiveShadow=wheel.stockMeshes[index].receiveShadow;wheel.custom.add(rim);}
   }
  }
  this.current=next;return true;
 }
 private build(selection:CadillacWheelSelection):Assembly{
  const fit=CADILLAC_WHEEL_FITS[this.variant],low=selection.tire.startsWith('low-profile');
  const rim=low?fit.lowRimRadius:selection.rim==='stock'?fit.stockRimRadius:fit.wireRimRadius;
  const rubberParts=tireParts(fit.radius,fit.halfWidth,rim,selection.tire.includes('whitewall'));
  let metal:T.BufferGeometry|undefined,stock:T.Mesh[][]|undefined;
  if(selection.rim==='stock'){
   stock=this.wheels.map(wheel=>wheel.stockMeshes.map((source,index)=>{
    const geometry=source.geometry.clone();geometry.applyMatrix4(wheel.stockTransforms[index]);
    if(low)geometry.scale(1,rim/fit.stockRimRadius,rim/fit.stockRimRadius);
    geometry.computeBoundingBox();geometry.computeBoundingSphere();this.owned.add(geometry);
    const mesh=new T.Mesh(geometry,source.material);mesh.name=wheel.custom.name+'_OriginalRim';mesh.castShadow=source.castShadow;mesh.receiveShadow=source.receiveShadow;return mesh;
   }));
  }else{
   const color=selection.rim==='wire-gold'?gold:chrome,front=fit.outset*.84,cap=fit.outset*.99,back=-fit.halfWidth*.84;
   const profile=[[rim*.91,back],[rim,back],[rim,front*.82],[rim*.99,front],[rim*.94,front],[rim*.91,front*.8],[rim*.91,back]];
   const shell=lathe(profile,chrome),positions=shell.getAttribute('position'),colors=shell.getAttribute('color'),innerColor=new T.Color(color);
   if(selection.rim==='wire-gold')for(let i=0;i<positions.count;i++)if(positions.getX(i)<front*.80)colors.setXYZ(i,innerColor.r,innerColor.g,innerColor.b);
   const parts=[shell],hub=.051*(fit.radius/.346);
   for(let i=0;i<100;i++){
    const theta=i*Math.PI*2/100,inner=theta+(i%2?-.72:.72),outerRadius=rim*.915;
    parts.push(spoke(new T.Vector3(cap-.024,Math.cos(inner)*hub,Math.sin(inner)*hub),new T.Vector3(front*.55,Math.cos(theta)*outerRadius,Math.sin(theta)*outerRadius),color));
   }
   parts.push(cylinder(hub,.024,cap-.018,color));
   for(let i=0;i<3;i++)parts.push(spinner(cap,i*Math.PI*2/3,fit.radius/.346,color));
   const center=disk(hub*.80,cap,selection.center==='black'?0x101215:selection.center==='white'?whitewall:color);
   if(selection.center==='gold')parts.push(center);else rubberParts.push(center);
   metal=merge(parts,'Cadillac 100 crossed spokes · '+selection.rim);this.owned.add(metal);
  }
  const tire=merge(rubberParts,'Cadillac '+selection.tire+' tire');this.owned.add(tire);
  const triangles=(tire.index?.count??tire.getAttribute('position').count)/3+(metal?(metal.index?.count??metal.getAttribute('position').count)/3:Math.max(...stock!.map(list=>list.reduce((sum,mesh)=>sum+(mesh.geometry.index?.count??mesh.geometry.getAttribute('position').count)/3,0))));
  return{rubber:tire,metal,stock,triangles};
 }
 diagnostics(){
  const original=this.current.rim==='stock'&&this.current.tire==='standard',assembly=this.cache.get(JSON.stringify(this.current));
  return{...this.current,variant:this.variant,rollingRadius:this.radius,spokesPerWheel:this.current.rim==='stock'?null:100,
   sourceRestored:original,customMeshes:original?0:8,trianglesPerWheel:assembly?.triangles??null,
   texturesAdded:0,cachedCombinations:this.cache.size,geometryCount:this.owned.size,fit:CADILLAC_WHEEL_FITS[this.variant]};
 }
 dispose(){
  if(this.disposed)return;this.disposed=true;
  for(const wheel of this.wheels){wheel.source.visible=wheel.sourceVisible;wheel.custom.removeFromParent();wheel.custom.clear();}
  for(const geometry of this.owned)geometry.dispose();this.owned.clear();this.cache.clear();this.metalMaterial.dispose();this.rubberMaterial.dispose();
 }
}

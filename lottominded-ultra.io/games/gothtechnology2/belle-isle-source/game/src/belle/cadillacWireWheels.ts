import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Profiles are [radius, axle position, sRGB color] in the authored wheel's
// local metres. Positive X faces out on the driver's side.
type Profile=readonly (readonly [number,number,number])[];
const corners=['FL','FR','RL','RR'] as const;
const gold=0xe6ab46,brightGold=0xffcd6a;

function colorize(geometry:T.BufferGeometry,colorAt:(i:number)=>number){
  const count=geometry.getAttribute('position').count,values=new Float32Array(count*3);
  const color=new T.Color();
  for(let i=0;i<count;i++)color.setHex(colorAt(i)).toArray(values,i*3);
  geometry.setAttribute('color',new T.BufferAttribute(values,3));
  geometry.deleteAttribute('uv');
  return geometry;
}

function lathe(profile:Profile,segments=40){
  const geometry=new T.LatheGeometry(profile.map(([radius,axle])=>new T.Vector2(radius,axle)),segments);
  return colorize(geometry.rotateZ(-Math.PI/2),i=>profile[i%profile.length][2]);
}

function makeWireRim(){
  const parts=[
    lathe([
      [.237,.024,0x5f0617],[.245,.057,0x7b0a1f],[.249,.097,0x950e25],
      [.248,.116,0xd3233c],[.242,.125,0xeb3951],[.235,.125,0xab152f],
      [.227,.117,0x9b0c23],[.216,.101,0xc51532],[.209,.076,0x8b081e],[.207,.058,0x670318],
    ]),
    lathe([[.207,.059,brightGold],[.213,.048,gold],[.224,-.092,0x8c5624],[.227,-.112,gold]]),
    lathe([
      [.068,-.043,0x805225],[.071,.025,0x996928],[.067,.079,gold],[.062,.09,brightGold],
      [.045,.096,0xbe7d2d],[.043,.113,brightGold],[.032,.125,gold],[0,.129,brightGold],
    ],24),
    lathe([[.176,-.038,0x403735],[.175,-.022,0x544942],[0,-.022,0x343031]],24),
  ];
  const axis=new T.Vector3(0,1,0),start=new T.Vector3(),end=new T.Vector3(),direction=new T.Vector3();
  const rotation=new T.Quaternion(),midpoint=new T.Vector3();
  for(let i=0;i<42;i++){
    const angle=i*Math.PI*2/42;
    for(const side of [-1,1]){
      const inner=angle+side*.34,outer=angle-side*.036;
      start.set(side>0?.076:.029,.061*Math.cos(inner),.061*Math.sin(inner));
      end.set(side>0?.056:.046,.214*Math.cos(outer),.214*Math.sin(outer));
      direction.subVectors(end,start);
      const spoke=new T.CylinderGeometry(.00165,.002,direction.length(),5,1,true);
      rotation.setFromUnitVectors(axis,direction.normalize());
      midpoint.copy(start).lerp(end,.5);
      spoke.applyQuaternion(rotation).translate(midpoint.x,midpoint.y,midpoint.z);
      parts.push(colorize(spoke,()=>side>0?brightGold:gold));
    }
  }
  const geometry=mergeGeometries(parts)!;
  parts.forEach(part=>part.dispose());
  const material=new T.MeshStandardMaterial({name:'Candy red and gold wire finish',vertexColors:true,metalness:.77,roughness:.23});
  return new T.Mesh(geometry,material);
}

/** Replace only the chrome wheel primitive. The rubber and its radius stay in
 * the original wheel's local space, which the existing hydraulics rig animates. */
export function fitCadillacWireWheels(scene:T.Object3D){
  const oldRims=corners.map(corner=>{
    const wheel=scene.getObjectByName('WheelGeometry_'+corner);
    const chrome=wheel?.children.find((part):part is T.Mesh=>
      part instanceof T.Mesh&&!Array.isArray(part.material)&&part.material.name==='Cadillac_Chrome');
    if(!wheel||!chrome)throw Error('Hydraulic Cadillac wheel fit missing for '+corner);
    return {corner,wheel,chrome};
  });
  const rim=makeWireRim();
  for(const {corner,wheel,chrome} of oldRims){
    const replacement=rim.clone();
    replacement.name='Cadillac_Wire_Rim_'+corner;
    if(corner.endsWith('R'))replacement.rotation.y=Math.PI;
    replacement.castShadow=chrome.castShadow;
    replacement.receiveShadow=chrome.receiveShadow;
    wheel.remove(chrome);
    wheel.add(replacement);
  }
}

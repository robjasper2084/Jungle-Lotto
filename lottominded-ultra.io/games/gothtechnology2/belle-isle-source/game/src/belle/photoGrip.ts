import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
/** A dedicated camera grip, independent of the bike's steering/bind pose.
 * Four fingers wrap the front edge; the thumb rests beside the rear controls.
 * Metre-scale geometry is batched by material and never skinned twice. */
export function makePhotoGrip(){
 const root=new T.Group();root.name='Camera grip · relaxed fingers and supported wrists';
 const skin:T.BufferGeometry[]=[],cloth:T.BufferGeometry[]=[],trim:T.BufferGeometry[]=[];
 const ellipsoid=(out:T.BufferGeometry[],p:number[],s:number[])=>{const g=new T.SphereGeometry(1,12,8);g.scale(s[0],s[1],s[2]);g.translate(p[0],p[1],p[2]);out.push(g);};
 const bone=(out:T.BufferGeometry[],a:number[],b:number[],r:number,tip=r)=>{const av=new T.Vector3(...a),bv=new T.Vector3(...b),d=bv.clone().sub(av),g=new T.CylinderGeometry(tip,r,d.length(),12);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));g.translate(...av.add(bv).multiplyScalar(.5).toArray());out.push(g);};
 for(const side of [-1,1]){
  const x=side<0?-.019:.259;
  const wrist=[x,-.20,-.665],elbow=[x+side*.16,-.48,-.24];
  bone(cloth,elbow,wrist,.072,.038);
  bone(trim,[x,-.218,-.648],[x,-.192,-.673],.040,.037);
  bone(skin,wrist,[x,-.15,-.707],.032,.027);
  ellipsoid(skin,[x,-.113,-.724],[.026,.052,.030]);
  for(let f=0;f<4;f++){
   const y=-.073-f*.024,short=f===3?.008:0;
   const points=[[x,y,-.747],[x-side*.008,y-.002,-.780+short],[x-side*.029,y-.010,-.795+short],[x-side*.047,y-.020,-.781+short]];
   for(let j=0;j<3;j++){const r=(.0107-f*.00045)*(1-j*.1);bone(skin,points[j],points[j+1],r,r*.9);ellipsoid(skin,points[j],[r,r,r]);}
   ellipsoid(skin,points[3],[.0075,.008,.008]);
  }
  // Opposed thumb stays below the rear screen, without crossing the fingers.
  const thumb=[[x+side*.006,-.119,-.698],[x-side*.009,-.078,-.674],[x-side*.030,-.061,-.675]];
  for(let j=0;j<2;j++){bone(skin,thumb[j],thumb[j+1],.013-j*.002,.011-j*.002);ellipsoid(skin,thumb[j],[.013,.013,.013]);}
  ellipsoid(skin,thumb[2],[.009,.012,.009]);
 }
 for(const [parts,color,roughness] of [[skin,0x9b6145,.66],[cloth,0x151c1e,.82],[trim,0x252d2e,.65]] as const){
  const g=mergeGeometries([...parts]);if(!g)continue;parts.forEach(p=>p.dispose());const mesh=new T.Mesh(g,new T.MeshStandardMaterial({color,roughness,metalness:0}));mesh.frustumCulled=false;mesh.castShadow=false;root.add(mesh);
 }
 return root;
}

import * as T from 'three';
import {applyRealisticMaterials} from './realisticMaterials.ts';
import {FISH} from './fishingPlan.ts';

/** Articulated spinning reel: foot, gearbox, bail, reciprocating spool and crank. */
export function fishingReel(){
 const group=new T.Group(),rotor=new T.Group(),crank=new T.Group(),spool=new T.Group();
 const metal=new T.MeshStandardMaterial({name:'Fishing polished alloy',color:0xbac4c9,metalness:.88,roughness:.22});
 const dark=new T.MeshStandardMaterial({name:'Fishing graphite reel housing',color:0x242c31,metalness:.45,roughness:.32});
 const rubber=new T.MeshStandardMaterial({name:'Fishing reel rubber knob',color:0x1b2123,roughness:.75});
 const line=new T.MeshStandardMaterial({name:'Fishing spool wound line',color:0xc0c8a7,roughness:.67});
 const mesh=(g:T.BufferGeometry,m:T.Material,p:number[],parent:T.Group=group)=>{const o=new T.Mesh(g,m);o.position.set(...p as [number,number,number]);parent.add(o);return o;};
 mesh(new T.BoxGeometry(.025,.07,.018),metal,[0,.04,0]);mesh(new T.BoxGeometry(.03,.014,.11),dark,[0,.081,0]);
 const housing=mesh(new T.SphereGeometry(1,20,14),dark,[0,-.025,.008]);housing.scale.set(.043,.046,.055);
 group.add(rotor,crank,spool);rotor.position.z=-.065;spool.position.z=-.09;crank.position.set(.046,-.027,.016);
 const cylinder=(r:number,h:number,m:T.Material,z:number,parent:T.Group)=>{const o=mesh(new T.CylinderGeometry(r,r,h,28),m,[0,0,z],parent);o.rotation.x=Math.PI/2;return o;};
 cylinder(.027,.035,line,0,spool);cylinder(.033,.005,metal,-.02,spool);cylinder(.035,.006,metal,.02,spool);cylinder(.015,.008,dark,-.026,spool);
 for(let i=0;i<13;i++){const ring=mesh(new T.TorusGeometry(.027,.0006,3,24),metal,[0,0,-.016+i*.0027],spool);ring.material=line;}
 for(const side of [-1,1])mesh(new T.BoxGeometry(.009,.012,.05),dark,[side*.044,0,-.005],rotor);
 const arc=new T.CatmullRomCurve3(Array.from({length:20},(_,i)=>{const a=i/19*Math.PI;return new T.Vector3(Math.cos(a)*.044,Math.sin(a)*.043,-.038-Math.sin(a)*.008);}));
 rotor.add(new T.Mesh(new T.TubeGeometry(arc,24,.0018,5,false),metal));
 const arm=mesh(new T.BoxGeometry(.012,.067,.009),metal,[.01,.028,0],crank);arm.rotation.z=-.22;
 const axle=mesh(new T.CylinderGeometry(.008,.008,.027,10),metal,[.026,.057,0],crank);axle.rotation.z=Math.PI/2;
 const knob=mesh(new T.SphereGeometry(1,14,10),rubber,[.043,.057,0],crank);knob.scale.set(.018,.025,.014);
 applyRealisticMaterials(group);let turn=0;
 return {group,update(dt:number,reeling:boolean){if(reeling)turn+=dt*7;crank.rotation.x=turn;rotor.rotation.z=-turn*4.7;spool.position.z=-.09+Math.sin(turn*1.8)*.007;}};
}

/** Species-shaped fish with coloured flank markings, translucent rayed fins and scale relief. */
export function caughtFish(){
 const group=new T.Group();group.name='Freshwater catch';
 const shapes=FISH.map((species,index)=>{
  const fish=new T.Group(),verts:number[]=[],normals:number[]=[],colors:number[]=[],uv:number[]=[],indices:number[]=[];
  const bluegill=index===2,depth=bluegill?.225:index===0?.135:.165,thickness=bluegill?.08:.095;
  const profile=[[0,.055],[.08,.20],[.22,.67],[.44,1],[.64,.96],[.82,.72],[1,.22]];
  const width=(t:number)=>{let j=0;while(j<profile.length-2&&t>profile[j+1][0])j++;const a=profile[j],b=profile[j+1],u=(t-a[0])/(b[0]-a[0]);return a[1]+(b[1]-a[1])*u;};
  const dark=new T.Color(index===0?'#545c2d':index===2?'#294b4c':'#344a30'),side=new T.Color(index===0?'#c4bd65':index===2?'#738d6c':'#8b9870'),belly=new T.Color('#dddac0'),mark=new T.Color('#354333'),c=new T.Color();
  for(let i=0;i<=64;i++){const t=i/64,x=t-.5,r=width(t);for(let j=0;j<=32;j++){const a=j/32*Math.PI*2,y=Math.cos(a)*depth*r,z=Math.sin(a)*thickness*r;verts.push(x,y,z);uv.push(t,j/32);normals.push(0,Math.cos(a),Math.sin(a));const top=(Math.cos(a)+1)/2;c.copy(belly).lerp(side,Math.min(1,top*2));if(top>.5)c.lerp(dark,(top-.5)*1.6);
   const flank=Math.pow(Math.abs(Math.sin(a)),.7),bars=index===0?Math.pow(Math.max(0,Math.cos(t*42+Math.cos(a)*.7)),10)*.64:index===3?Math.exp(-Math.pow(Math.cos(a)*4,2))*(.50+.2*Math.sin(t*43)):index===1?Math.pow(Math.max(0,Math.cos(t*29+Math.sin(a)*2)),6)*.27:Math.pow(Math.max(0,Math.cos(t*35)),8)*.20;
   c.lerp(mark,bars*flank);colors.push(c.r,c.g,c.b);if(i<64&&j<32){const k=i*33+j;indices.push(k,k+1,k+33,k+1,k+34,k+33);}
  }}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(verts,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const skin=new T.MeshStandardMaterial({name:'Freshwater fish scales',color:0xffffff,vertexColors:true,roughness:.32,metalness:.16});fish.add(new T.Mesh(geometry,skin));
  const finMat=new T.MeshStandardMaterial({name:'Fish translucent fin membrane',color:index===0?0xc58338:index===2?0x70794e:0x8e9167,transparent:true,opacity:.72,roughness:.48,side:T.DoubleSide,depthWrite:false});
  const rays=new T.LineBasicMaterial({color:index===0?0x85632b:0x515d45,transparent:true,opacity:.7});
  const fin=(points:number[][],origin:number[])=>{const g=new T.BufferGeometry().setFromPoints(points.map(p=>new T.Vector3(...p as [number,number,number])));const idx=[];for(let i=1;i<points.length-1;i++)idx.push(0,i,i+1);g.setIndex(idx);g.computeVertexNormals();fish.add(new T.Mesh(g,finMat));const lines:T.Vector3[]=[];for(const p of points.slice(1))lines.push(new T.Vector3(...origin as [number,number,number]),new T.Vector3(...p as [number,number,number]));fish.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(lines),rays));};
  fin([[-.46,0,0],[-.71,.16,0],[-.67,.07,0],[-.61,0,0],[-.67,-.07,0],[-.71,-.16,0]],[-.46,0,0]);
  fin([[-.32,.075,0],[-.28,depth+.075,0],[-.20,depth+.10,0],[-.12,depth+.055,0],[-.04,depth+.09,0],[.08,depth+.05,0],[.22,depth*.8,0]],[-.06,depth*.85,0]);
  fin([[-.27,-depth*.65,0],[-.20,-depth-.07,0],[-.09,-depth-.055,0],[.05,-depth*.9,0]],[-.13,-depth*.75,0]);
  for(const sign of [-1,1]){
   fin([[.20,-.025,sign*.07],[.04,-.11,sign*.17],[-.02,-.07,sign*.12]], [.20,-.025,sign*.07]);
   const iris=new T.Mesh(new T.SphereGeometry(.024,16,10),new T.MeshStandardMaterial({color:0xc3b263,metalness:.18,roughness:.24}));iris.position.set(.36,.038,sign*.071);iris.scale.z=.42;fish.add(iris);
   const eye=new T.Mesh(new T.SphereGeometry(.013,14,10),new T.MeshPhysicalMaterial({color:0x08100d,roughness:.08,clearcoat:1}));eye.position.set(.362,.04,sign*.080);eye.scale.z=.5;fish.add(eye);
   const gill=new T.CatmullRomCurve3([[.22,.09,sign*.06],[.24,.035,sign*.085],[.23,-.045,sign*.078],[.19,-.10,sign*.048]].map(p=>new T.Vector3(...p as [number,number,number])));fish.add(new T.Mesh(new T.TubeGeometry(gill,10,.0025,4,false),new T.MeshStandardMaterial({color:0x4b5940,roughness:.5})));
   if(bluegill){const spot=new T.Mesh(new T.SphereGeometry(.032,12,8),new T.MeshStandardMaterial({color:0x152b31,roughness:.35}));spot.position.set(.18,.025,sign*.077);spot.scale.z=.12;fish.add(spot);}
  }
  const mouth=new T.Mesh(new T.TorusGeometry(.024,.004,5,16),new T.MeshStandardMaterial({color:0x9a9e79,roughness:.5}));mouth.rotation.y=Math.PI/2;mouth.position.x=.499;fish.add(mouth);
  fish.scale.setScalar(species.cm/121);fish.visible=false;group.add(fish);applyRealisticMaterials(fish);return fish;
 });let current=-1;
 return {group,show(index:number){if(index===current)return;current=index;shapes.forEach((o,i)=>o.visible=i===index);},update(time:number){group.rotation.y+=Math.sin(time*2)*.0008;}};
}

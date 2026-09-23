import * as T from 'three';

export type TreeSite={x:number;y:number;z:number;h:number;seed:number;crownScale?:number;lowCrown?:boolean};
type Limb={a:T.Vector3;b:T.Vector3;r:number;tip:number};
type Spray={p:T.Vector3;size:number;rotation:T.Euler;species:number;tint:number;detail:boolean};
const up=new T.Vector3(0,1,0);
const hash=(v:number)=>Math.abs(Math.sin(v*127.1+311.7)*43758.5453)%1;
export const TREE_WIND_MARGIN=.22;

/** Seeded, metre-scale branch hierarchy. Sites stay at the existing terrain positions. */
export function planTree(site:TreeSite){
  const limbs:Limb[]=[],sprays:Spray[]=[];
  const {x,y,z,h,seed}=site,rand=(n:number)=>hash(seed+n*11.37),base=new T.Vector3(x,y,z);
  const species=rand(1)>.46?1:0,azimuth=rand(2)*Math.PI*2;
  const lean=new T.Vector3((rand(3)-.5)*h*.09,0,(rand(4)-.5)*h*.09);
  const trunkAt=(t:number)=>base.clone().addScaledVector(lean,t*t).add(new T.Vector3(Math.sin(t*4+seed)*h*.013*t,h*t,Math.sin(t*3)*h*.01*t));
  const trunkRadius=(t:number)=>(.14+h*.013)*Math.pow(1-t,1.15)+.018;
  const branch=(points:T.Vector3[],radius:number,steps:number)=>{
    const curve=new T.CatmullRomCurve3(points);let last=points[0];
    for(let k=1;k<=steps;k++){
      const t=k/steps,end=curve.getPoint(t),r=radius*Math.pow(1-(k-1)/steps,.85)+.005,tip=radius*Math.pow(1-t,.85)+.005;
      limbs.push({a:last,b:end,r,tip});last=end;
    }
    return curve;
  };
  for(let k=0;k<9;k++)limbs.push({a:trunkAt(k*.105),b:trunkAt((k+1)*.105),r:trunkRadius(k*.105),tip:trunkRadius((k+1)*.105)});
  // Short flared buttresses seat the trunk in the bank without a floating cylinder base.
  for(let k=0;k<5;k++){
    const angle=azimuth+k*1.256,root=base.clone().add(new T.Vector3(Math.sin(angle)*.48,.025,Math.cos(angle)*.48));
    branch([trunkAt(.055),base.clone().lerp(root,.5).add(new T.Vector3(0,.17,0)),root],.045+h*.004,3);
  }
  const count=11+Math.floor(rand(5)*3),width=(species===0?1.04:.92)*(site.crownScale??1);
  const addSpray=(p:T.Vector3,size:number,angle:number,n:number)=>{
    const rotation=new T.Euler(-.55+rand(n)*1.4,angle+(rand(n+1)-.5)*1.5,(rand(n+2)-.5)*1.25);
    // The first two sprays cover every branch at all distances. The third is near detail.
    for(let k=0;k<3;k++)sprays.push({p:p.clone().add(new T.Vector3((rand(n+k+7)-.5)*size*.45,(rand(n+k+17)-.5)*size*.35,(rand(n+k+27)-.5)*size*.45)),size:size*(k===2?.8:1),rotation:new T.Euler(rotation.x+(k===1?1.15:0),rotation.y+k*1.9,rotation.z+(k===2?.6:0)),species,tint:.83+rand(n+k+47)*.17,detail:k===2});
  };
  for(let j=0;j<count;j++){
    const t=j/(count-1),angle=azimuth+j*2.399963+rand(j+70)*.4;
    const attach=(site.lowCrown?.23:.30)+t*(site.lowCrown?.49:.43),a=trunkAt(attach);
    const reach=h*(.23+.055*rand(j+80))*Math.sin(Math.PI*(.26+t*.61))*width;
    const dir=new T.Vector3(Math.sin(angle),0,Math.cos(angle));
    const end=a.clone().addScaledVector(dir,reach).add(new T.Vector3(0,h*(.18-.075*t+rand(j+90)*.06),0));
    const curve=branch([a,a.clone().lerp(end,.28).add(new T.Vector3(0,h*.07,0)),a.clone().lerp(end,.72).add(new T.Vector3(0,h*.045,0)),end],trunkRadius(attach)*(.48+rand(j+95)*.13),6);
    for(let k=0;k<5;k++){
      const u=.36+k*.15,p=curve.getPoint(u),side=k%2===0?-1:1;
      const tip=p.clone().add(new T.Vector3(Math.sin(angle+side*.78)*h*(.075+rand(j*5+k+120)*.05),h*(.035+rand(j*5+k+150)*.055),Math.cos(angle+side*.78)*h*(.075+rand(j*5+k+120)*.05)));
      const twig=branch([p,p.clone().lerp(tip,.55).add(new T.Vector3(0,.16,0)),tip],.017+h*.0013,3);
      for(let m=0;m<2;m++){
        const q=twig.getPoint(.52+m*.43),size=(.94+rand(j*10+k*2+m+240)*.38)*(h/9.5)**.4;
        addSpray(q,size,angle+side*.7,j*61+k*9+m*4+350);
      }
    }
  }
  // The leader fills the upper crown; irregular tips prevent a clipped umbrella silhouette.
  for(let j=0;j<10;j++){
    const t=.69+j*.027,angle=azimuth+j*2.4,p=trunkAt(t).add(new T.Vector3(Math.sin(angle)*h*.055,.02,Math.cos(angle)*h*.055));
    addSpray(p,1.08*(h/9.5)**.4,angle,j*11+1900);
  }
  return {limbs,sprays,species};
}

/** Taper each instance independently, so adjoining curved segments meet at equal radii. */
function taper(material:T.Material){
  material.onBeforeCompile=shader=>{
    shader.vertexShader='attribute float branchTaper;\nattribute vec2 branchUv;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.xz *= mix(1.0,branchTaper,position.y+.5);');
    shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nobjectNormal.y += 1.0-branchTaper;');
    shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>
      #ifdef USE_MAP
        vMapUv *= branchUv;
      #endif
      #ifdef USE_NORMALMAP
        vNormalMapUv *= branchUv;
      #endif
      #ifdef USE_ROUGHNESSMAP
        vRoughnessMapUv *= branchUv;
      #endif`);
  };
  material.customProgramCacheKey=()=> 'detroit-tapered-bark-2';
}

export function makeTreeBatch(sites:TreeSite[],bark:T.MeshStandardMaterial,foliage:T.MeshStandardMaterial[],time:{value:number}){
  const plans=sites.map(planTree),limbs=plans.flatMap(p=>p.limbs),sprays=plans.flatMap(p=>p.sprays);
  const stemGeometry=new T.CylinderGeometry(1,1,1,9,1,true);
  stemGeometry.setAttribute('branchTaper',new T.InstancedBufferAttribute(new Float32Array(limbs.map(l=>l.tip/l.r)),1));
  stemGeometry.setAttribute('branchUv',new T.InstancedBufferAttribute(new Float32Array(limbs.flatMap(l=>[Math.max(.14,l.r*2*Math.PI/.8),l.a.distanceTo(l.b)/1.2])),2));
  taper(bark);
  const stems=new T.InstancedMesh(stemGeometry,bark,limbs.length),dummy=new T.Object3D();
  limbs.forEach((l,i)=>{
    const delta=l.b.clone().sub(l.a);dummy.position.copy(l.a).add(l.b).multiplyScalar(.5);dummy.quaternion.setFromUnitVectors(up,delta.clone().normalize());dummy.scale.set(l.r,delta.length(),l.r);dummy.updateMatrix();stems.setMatrixAt(i,dummy.matrix);
  });
  stems.name='Curved tapered deciduous branches';stems.castShadow=stems.receiveShadow=true;
  const stemDepth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking});taper(stemDepth);stems.customDepthMaterial=stemDepth;
  stems.computeBoundingSphere();
  const group=new T.Group();group.add(stems);
  const leaves:T.InstancedMesh[]=[],detail:T.InstancedMesh[]=[];
  const leafGeometry=new T.PlaneGeometry(1,1,2,2),positions=leafGeometry.getAttribute('position');
  // Curved cards break up flat reflections and remain readable from the front/orbit camera.
  for(let i=0;i<positions.count;i++){const x=positions.getX(i),y=positions.getY(i);positions.setZ(i,.12*(1-4*x*x)+.07*Math.sin(y*Math.PI));}
  leafGeometry.computeVertexNormals();
  for(let species=0;species<foliage.length;species++)for(const near of [false,true]){
    const list=sprays.filter(p=>p.species===species&&p.detail===near);if(!list.length)continue;
    const material=foliage[species],mesh=new T.InstancedMesh(leafGeometry,material,list.length);
    list.forEach((p,i)=>{dummy.position.copy(p.p);dummy.rotation.copy(p.rotation);dummy.scale.set(p.size,p.size*(species===0?.94:.87),p.size);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,new T.Color(p.tint,p.tint,.94*p.tint));});
    mesh.name=(species===0?'Elm':'Maple')+(near?' close foliage':' canopy');mesh.castShadow=!near;mesh.receiveShadow=true;
    const depth=new T.MeshDepthMaterial({map:material.map,alphaTest:material.alphaTest,depthPacking:T.RGBADepthPacking,side:T.DoubleSide});wind(depth,time);mesh.customDepthMaterial=depth;
    mesh.computeBoundingSphere();mesh.boundingSphere!.radius+=TREE_WIND_MARGIN;
    leaves.push(mesh);if(near)detail.push(mesh);group.add(mesh);
  }
  group.userData.treeCount=sites.length;
  return {group,stems,leaves,detail,count:sites.length,update(distance:number){
    group.visible=distance<350;stems.castShadow=distance<95;
    for(const mesh of leaves)mesh.castShadow=distance<95&&!detail.includes(mesh);
    for(const mesh of detail)mesh.visible=distance<145;
  }};
}

export function wind(material:T.Material,time:{value:number}){
  material.onBeforeCompile=shader=>{
    shader.uniforms.treeTime=time;
    shader.vertexShader='uniform float treeTime;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      #ifdef USE_INSTANCING
      float phase=instanceMatrix[3].x*.23+instanceMatrix[3].z*.17;
      float tip=pow(clamp(position.y+.5,0.,1.),1.6);
      float breeze=sin(treeTime*1.15+phase)*.021 + sin(treeTime*.47+phase*.4)*.014;
      float gust=.75+.45*sin(treeTime*.43)+.15*sin(treeTime*1.13);
      transformed.x += breeze*(.25+tip)*gust;
      transformed.z += sin(treeTime*2.6+phase*1.7+position.x*3.)*.012*tip;
      #endif`);
  };
  material.customProgramCacheKey=()=> 'higgsfield-foliage-wind-2';
}

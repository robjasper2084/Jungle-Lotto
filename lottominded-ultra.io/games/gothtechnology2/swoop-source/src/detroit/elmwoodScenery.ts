import * as T from 'three';
import {ELM_PATHS,ELM_BOUNDARY,ELM_POND,ELM_CREEKS,ELM_WATER_Y,polylineDistance,elmCreekDistance,elmPoint,elmHeight,ELMWOOD_SOURCE,planPoint,type ElmwoodWorld} from './elmwood.ts';
import {ELM_BUILDINGS,buildingSite,clearElmPlot,elmLaneVertices} from './elmwoodDetails.ts';
import {hash} from './world.ts';
import {surfaceUV} from './environmentMaterials.ts';
import {loadElmwoodLibrary,elmTreeSpecies,type ElmTreeSite} from './elmwoodLibrary.ts';
import {batchStaticGroup} from './static-batch.ts';

export async function buildElmwood(scene:T.Scene,world:ElmwoodWorld,compact:()=>boolean=()=>false){
 const time={value:0},library=await loadElmwoodLibrary(time,compact()),get=(name:string)=>library.materials.get(name)!;
 const mats={lawn:get('grass').clone(),lane:get('asphalt'),limestone:get('limestone'),memorial:get('granite')};
 mats.lawn.vertexColors=true;
 const soil=get('soil');
 mats.lawn.onBeforeCompile=shader=>{
   shader.uniforms.soilMap={value:soil.map};
   shader.vertexShader='varying vec3 lawnWorld;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nlawnWorld=(modelMatrix*vec4(position,1.)).xyz;');
   shader.fragmentShader='varying vec3 lawnWorld; uniform sampler2D soilMap;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
     float lawnPatch=sin(lawnWorld.x*.037+sin(lawnWorld.z*.061)*2.)*sin(lawnWorld.z*.043);
     float bare=smoothstep(.52,.95,lawnPatch)*.47;
     vec3 soil=texture2D(soilMap,lawnWorld.xz*.4).rgb;
     diffuseColor.rgb=mix(diffuseColor.rgb,soil,bare)*( .88+.12*sin(lawnWorld.x*.013+lawnWorld.z*.019));`);
 };mats.lawn.customProgramCacheKey=()=> 'elmwood-layered-lawn-2';
 const ground=new T.Group(),details=new T.Group(),waterGroup=new T.Group();scene.add(ground,details,waterGroup);
 const stone=mats.limestone,memorial=mats.memorial,darkStone=memorial.clone();darkStone.color.set('#646b68');
 const metal=new T.MeshStandardMaterial({color:'#202c27',metalness:.65,roughness:.58});
 function addMesh(g:T.BufferGeometry,material:T.Material,x=0,y=0,z=0,parent=details){
   g.computeVertexNormals();surfaceUV(g,material===stone?2:1.8);const mesh=new T.Mesh(g,material);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
 }
 function collider(x:number,y:number,z:number,w:number,h:number,d:number,kind='monument'){
   const s={x,y:y+h/2,z,hx:w/2,hy:h/2,hz:d/2,kind};world.solids.push(s);world.addBox(s);
 }
 function box(x:number,y:number,z:number,w:number,h:number,d:number,material:T.Material,collision=false){
   const mesh=addMesh(new T.BoxGeometry(w,h,d),material,x,y+h/2,z);if(collision)collider(x,y,z,w,h,d);return mesh;
 }
 function cylinder(x:number,y:number,z:number,bottom:number,top:number,h:number,material:T.Material,sides=8){return addMesh(new T.CylinderGeometry(top,bottom,h,sides),material,x,y+h/2,z);}
 function plaque(text:string,x:number,z:number,w=2.6){
   const y=elmHeight(x,z),canvas=document.createElement('canvas');canvas.width=768;canvas.height=144;const ctx=canvas.getContext('2d')!;
   ctx.fillStyle='#243d33';ctx.fillRect(0,0,768,144);ctx.strokeStyle='#aaa589';ctx.lineWidth=4;ctx.strokeRect(9,9,750,126);ctx.fillStyle='#ede3c8';ctx.font='42px Georgia';ctx.textAlign='center';ctx.fillText(text,384,90);
   const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
   const g=new T.PlaneGeometry(w,w*.1875),uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setX(i,1-uv.getX(i));
   const sign=new T.Mesh(g,new T.MeshStandardMaterial({map:texture,side:T.DoubleSide,roughness:.85}));sign.position.set(x,y+1.1,z);details.add(sign);
   for(const side of [-1,1])box(x+side*w*.38,y,z,.055,1.3,.055,metal);
 }
 // Preserve the elevation mesh; colour varies gently across the lawn.
 for(const c of world.chunks){
   const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(c.vertices,3));g.setIndex(new T.BufferAttribute(c.indices,1));g.computeVertexNormals();surfaceUV(g,2.5);
   const colors=new Float32Array(c.vertices.length);
   for(let i=0;i<c.vertices.length;i+=3){const x=c.vertices[i],z=c.vertices[i+2],v=.90+.07*Math.sin(x*.11)*Math.cos(z*.073)+.03*Math.sin(x*.43+z*.17);colors.set([v,v,.96*v],i);}
   g.setAttribute('color',new T.BufferAttribute(colors,3));const mesh=new T.Mesh(g,mats.lawn);mesh.receiveShadow=true;ground.add(mesh);
 }
 // Pale aggregate lanes share the wheel collision datum.
 for(const path of ELM_PATHS){
   const pos=elmLaneVertices(path.samples);
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.computeVertexNormals();surfaceUV(g,3.5);const mesh=new T.Mesh(g,mats.lane);mesh.receiveShadow=true;ground.add(mesh);
 }
 // Detailed user-owned library models, fitted to the existing clear plots.
 for(const definition of ELM_BUILDINGS){
   const b=buildingSite(definition);
   const base=Math.min(b.y,...[-1,1].flatMap(sx=>[-1,1].map(sz=>elmHeight(b.x+sx*(b.w/2+.2),b.z+sz*(b.d/2+.2)))))-.2;
   box(b.x,base,b.z,b.w+.4,b.y-base+.04,b.d+.4,memorial,true);
   library.place(b.name==='Gothic chapel'?'elmwood-chapel':'elmwood-gatehouse',details,b.x,b.y,b.z,b.w,b.d);
   collider(b.x,b.y,b.z,b.w,b.eave+b.rise,b.d,'architecture');
 }
 const entrance=elmPoint(1075,485);
 for(const side of [-1,1]){const x=entrance.x+side*5,y=elmHeight(x,entrance.z);box(x,y,entrance.z,1.15,2.5,1.15,stone,true);box(x,y+2.5,entrance.z,1.4,.2,1.4,memorial);cylinder(x,y+2.7,entrance.z,.6,.08,.7,memorial,4);}
 plaque('ELMWOOD CEMETERY',entrance.x+8,entrance.z+1,4.1);
 for(const [name,px,pz]of [['LAKE VIEW',790,440],['INDIAN MOUND',740,213],['HAZEL DELL',565,290]] as const){const p=elmPoint(px,pz);plaque(name,p.x,p.z);}
 // Pond surface uses shallow-bank colour, world-anchored ripples and a local reflection probe.
 const shape=new T.Shape(ELM_POND.map(([x,z])=>{const p=elmPoint(x,z);return new T.Vector2(p.x,-p.z);})),base=new T.ShapeGeometry(shape).toNonIndexed();base.rotateX(-Math.PI/2);
 const positions:number[]=[],waterColors:number[]=[];
 const push=(p:T.Vector3)=>{positions.push(p.x,0,p.z);const plan=planPoint(p.x,p.z),depth=Math.min(1,polylineDistance(plan.x,plan.z,[...ELM_POND,ELM_POND[0]])/7);const colour=new T.Color('#78856b').lerp(new T.Color('#243f38'),depth);waterColors.push(colour.r,colour.g,colour.b);};
 const vertices=base.getAttribute('position');
 for(let i=0;i<vertices.count;i+=3){const a=new T.Vector3().fromBufferAttribute(vertices,i),b=new T.Vector3().fromBufferAttribute(vertices,i+1),c=new T.Vector3().fromBufferAttribute(vertices,i+2),centre=a.clone().add(b).add(c).multiplyScalar(1/3);for(const tri of [[a,b,centre],[b,c,centre],[c,a,centre]])tri.forEach(push);}
 const pg=new T.BufferGeometry();pg.setAttribute('position',new T.Float32BufferAttribute(positions,3));pg.setAttribute('color',new T.Float32BufferAttribute(waterColors,3));pg.computeVertexNormals();
 const waterMaterial=new T.MeshPhysicalMaterial({vertexColors:true,color:'white',roughness:.22,metalness:0,ior:1.333,clearcoat:.25,clearcoatRoughness:.20,envMapIntensity:.6});
 waterMaterial.onBeforeCompile=shader=>{
   shader.uniforms.pondTime=time;shader.vertexShader='varying vec3 pondWorld;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\npondWorld=(modelMatrix*vec4(position,1.)).xyz;');
   shader.fragmentShader='uniform float pondTime; varying vec3 pondWorld;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
     vec2 p=pondWorld.xz; vec3 wave=vec3(.028*sin(p.x*2.3+p.y*1.5+pondTime*.75)+.013*sin(p.x*5.1-p.y*3.+pondTime*1.1),0.,.022*cos(p.y*2.7-p.x*.9+pondTime*.55));
     normal=normalize(normal+mat3(viewMatrix)*wave);`);
 };waterMaterial.customProgramCacheKey=()=> 'elmwood-world-water-2';
 const water=new T.Mesh(pg,waterMaterial);water.position.y=ELM_WATER_Y;water.receiveShadow=true;waterGroup.add(water);
 const creekMaterial=waterMaterial.clone();creekMaterial.vertexColors=false;creekMaterial.color.set('#42584b');creekMaterial.roughness=.35;creekMaterial.clearcoat=.1;creekMaterial.envMapIntensity=.35;creekMaterial.onBeforeCompile=waterMaterial.onBeforeCompile;creekMaterial.customProgramCacheKey=()=> 'elmwood-creek-2';
 for(const points of ELM_CREEKS){
   const curve=new T.CatmullRomCurve3(points.map(([x,z])=>{const p=elmPoint(x,z);return new T.Vector3(p.x,0,p.z);})),samples=curve.getSpacedPoints(160),pos:number[]=[];
   for(let i=1;i<samples.length;i++){const a=samples[i-1],b=samples[i],v=b.clone().sub(a).normalize(),width=.65+.17*Math.sin(i*.37),nx=-v.z*width,nz=v.x*width,pts=[[a.x+nx,a.z+nz],[a.x-nx,a.z-nz],[b.x+nx,b.z+nz],[b.x-nx,b.z-nz]];
     // Leave all road crossings clear; the water flows through the culvert below.
     if(!clearElmPlot((a.x+b.x)/2,(a.z+b.z)/2,-1))continue;
     for(const k of [0,2,1,1,2,3]){const[x,z]=pts[k];pos.push(x,elmHeight(x,z)+.035,z);}}
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.computeVertexNormals();waterGroup.add(new T.Mesh(g,creekMaterial));
 }
 // Irregular stone edging follows the same waterline as the pond mesh.
 for(let i=0;i<ELM_POND.length;i++){
   const a=elmPoint(...ELM_POND[i] as [number,number]),b=elmPoint(...ELM_POND[(i+1)%ELM_POND.length] as [number,number]),length=Math.hypot(b.x-a.x,b.z-a.z);
   for(let d=0;d<length;d+=.8){const t=d/length,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;
     const rock=addMesh(new T.DodecahedronGeometry(.42,0),darkStone,x,ELM_WATER_Y+.03,z);rock.scale.set(1.1,.45+hash(i*90+d)*.4,.75);rock.rotation.set(hash(d),hash(i+d)*6,hash(i+d)*.3);
   }
 }
 const geese=elmPoint(850,386);library.place('flying-geese-baked',details,geese.x,ELM_WATER_Y+.16,geese.z,1.4,1.4);
 cylinder(geese.x,ELM_WATER_Y-.1,geese.z,.5,.45,.32,darkStone);
 const reeds=new T.MeshStandardMaterial({color:'#7d8650',roughness:1,side:T.DoubleSide});
 for(let i=0;i<340;i++){
   const edge=ELM_POND[i%ELM_POND.length],p=elmPoint(edge[0]+(hash(i+800)-.5)*14,edge[1]+(hash(i+1200)-.5)*14);
   if(!clearElmPlot(p.x,p.z,.15)||elmHeight(p.x,p.z)>ELM_WATER_Y+1.4)continue;
   const h=.35+hash(i+9)*.8;const blade=addMesh(new T.ConeGeometry(.035,h,3),reeds,p.x,elmHeight(p.x,p.z)+h/2,p.z);blade.rotation.z=(hash(i)-.5)*.4;
 }
 let monuments=0;
 function monument(x:number,z:number,seed:number){
   const y=elmHeight(x,z),names=['headstone-arched','headstone-weathered','headstone-cross','obelisk','ledger','urn'];
   const name=names[Math.floor(hash(seed+84)*names.length)];
   const object=library.place(name,details,x,y,z,name==='ledger'?1.65:1.15,name==='ledger'?1.7:.85);
   object.rotation.y=(hash(seed+55)-.5)*.14;
   const bounds=new T.Box3().setFromObject(object);collider(x,y,z,bounds.max.x-bounds.min.x,bounds.max.y-y,bounds.max.z-bounds.min.z);monuments++;
 }
 const sites:ElmTreeSite[]=[];
 for(let i=0;i<2350;i++){
   const p=elmPoint(55+hash(i+10)*1100,140+hash(i+250)*465);if(!clearElmPlot(p.x,p.z,1.8))continue;
   const pp=planPoint(p.x,p.z),wooded=elmCreekDistance(pp.x,pp.z)<27||pp.z>545;
   if(hash(i+1750)<(wooded?.78:.29)&&!sites.some(s=>Math.hypot(s.x-p.x,s.z-p.z)<8.5)){
     sites.push({...p,y:elmHeight(p.x,p.z),h:9+hash(i+400)*14,seed:i,species:elmTreeSpecies(i,elmCreekDistance(pp.x,pp.z)<22)});collider(p.x,elmHeight(p.x,p.z),p.z,.75,3,.75,'tree');
   }else if(!wooded&&i%3===0&&!sites.some(s=>Math.hypot(s.x-p.x,s.z-p.z)<2.5)){
     monument(p.x,p.z,i);
     if(i%9===0)for(const offset of [-2,2])if(clearElmPlot(p.x+offset,p.z,1.1))monument(p.x+offset,p.z,i+offset*53);
   }
 }
 // Boundary railing has openings at mapped exits.
 for(let i=0;i<ELM_BOUNDARY.length;i++){
   const a=elmPoint(...ELM_BOUNDARY[i] as [number,number]),b=elmPoint(...ELM_BOUNDARY[(i+1)%ELM_BOUNDARY.length] as [number,number]),length=Math.hypot(b.x-a.x,b.z-a.z),angle=Math.atan2(b.x-a.x,b.z-a.z);
   for(let d=0;d<length;d+=3){const x=a.x+(b.x-a.x)*d/length,z=a.z+(b.z-a.z)*d/length;if(!clearElmPlot(x,z,1))continue;const y=elmHeight(x,z);box(x,y,z,.09,1.45,.09,metal);
     for(const height of [.35,1.15]){const rail=box(x,y+height,z,.04,.04,3,metal);rail.rotation.y=angle;}
   }
 }
 // Five distinct botanical meshes, instanced in spatial tiles.
 const treeBatches=library.trees(sites,compact);scene.add(treeBatches.root);
 // Benches and low plot borders give the lanes a human scale.
 for(let i=0;i<ELM_PATHS.length;i+=3){const point=ELM_PATHS[i].sample(ELM_PATHS[i].length*.45),x=point.x+Math.cos(point.heading)*6,z=point.z-Math.sin(point.heading)*6;
   if(!clearElmPlot(x,z,1.4))continue;const y=elmHeight(x,z);
   for(const dx of [-.65,.65])box(x+dx,y,z,.08,.48,.55,metal);
   for(let k=0;k<4;k++)box(x,y+.48,z-.25+k*.16,1.7,.06,.12,get('wood'));
   for(let k=0;k<3;k++)box(x,y+.65+k*.13,z+.28,1.7,.09,.045,get('wood'));
   collider(x,y,z,1.8,1,.8,'bench');
 }
 // Sparse ground dressing: individual tufts and fallen leaves, away from riding lanes.
 for(let i=0;i<sites.length;i+=2){const site=sites[i];for(let j=0;j<3;j++){
   const angle=hash(i*31+j)*Math.PI*2,r=1.3+hash(i*71+j)*3.4,x=site.x+Math.cos(angle)*r,z=site.z+Math.sin(angle)*r;
   if(!clearElmPlot(x,z,.4))continue;
   const item=library.place(j===0?'fallen-leaf-patch':j===1?'grass-tuft':'low-shrub',details,x,elmHeight(x,z)+.015,z,j===2?1.1:1.7,j===2?1.1:1.7);item.rotation.y=angle;
 }}
 // Keep scenery in small spatial batches, so off-screen graves do not draw.
 const detailTiles=new Map<string,T.Group>();
 for(const object of [...details.children]){const key=Math.floor(object.position.x/50)+','+Math.floor(object.position.z/50);let tile=detailTiles.get(key);if(!tile){tile=new T.Group();details.add(tile);detailTiles.set(key,tile);}tile.add(object);}
 batchStaticGroup(ground);for(const tile of detailTiles.values())batchStaticGroup(tile);

 // Coplanar lawn and road skins receive tree shadows, but must not shadow each other.
 ground.traverse(o=>{if((o as T.Mesh).isMesh)o.castShadow=false;});world.step();
 return{materials:mats,architecture:{map:'Elmwood Cemetery',source:ELMWOOD_SOURCE,alignment:'Google photo references + USGS 3DEP; approximate plan alignment and landmark footprints',revision:'elmwood-realism-20260916',paths:ELM_PATHS.length,monuments,landmarks:ELM_BUILDINGS.map(b=>b.name)},trees:sites.length,skins:15,waterGroup,waterMaterial,pondPosition:{...geese,y:ELM_WATER_Y},
   update(x:number,z:number,t=0){time.value=t;for(const[key,tile]of detailTiles){const[tx,tz]=key.split(',').map(Number);tile.visible=Math.hypot(x-(tx*50+25),z-(tz*50+25))<(compact()?170:320);}return 2+treeBatches.update(x,z);}};
}



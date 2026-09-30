from pathlib import Path
p=Path(__file__).resolve().parents[1]/'src/detroit/elmwoodScenery.ts'
s=p.read_text()
s=s.replace('ELM_WATER_Y,elmCreekDistance','ELM_WATER_Y,polylineDistance,elmCreekDistance')
s=s.replace("import {makeTreeBatch,wind,type TreeSite} from './trees.ts';","import {loadElmwoodLibrary,elmTreeSpecies,type ElmTreeSite} from './elmwoodLibrary.ts';")
start=s.index('async function elmMaterials()');end=s.index(' const ground=new T.Group()',start)
s=s[:start]+'''export async function buildElmwood(scene:T.Scene,world:ElmwoodWorld,compact:()=>boolean=()=>false){
 const time={value:0},library=await loadElmwoodLibrary(time),get=(name:string)=>library.materials.get(name)!;
 const mats={lawn:get('grass').clone(),lane:get('asphalt'),limestone:get('limestone'),memorial:get('granite')};
 mats.lawn.vertexColors=true;
 const soil=get('soil');
 mats.lawn.onBeforeCompile=shader=>{
   shader.uniforms.soilMap={value:soil.map};
   shader.vertexShader='varying vec3 lawnWorld;\\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\\nlawnWorld=(modelMatrix*vec4(position,1.)).xyz;');
   shader.fragmentShader='varying vec3 lawnWorld; uniform sampler2D soilMap;\\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
     float patch=sin(lawnWorld.x*.037+sin(lawnWorld.z*.061)*2.)*sin(lawnWorld.z*.043);
     float bare=smoothstep(.52,.95,patch)*.47;
     vec3 soil=texture2D(soilMap,lawnWorld.xz*.4).rgb;
     diffuseColor.rgb=mix(diffuseColor.rgb,soil,bare)*( .88+.12*sin(lawnWorld.x*.013+lawnWorld.z*.019));`);
 };mats.lawn.customProgramCacheKey=()=> 'elmwood-layered-lawn-2';
''' +s[end:]
start=s.index(' // Gothic massing');end=s.index(' const entrance=',start)
s=s[:start]+''' // Detailed user-owned library models, fitted to the existing clear plots.
 for(const definition of ELM_BUILDINGS){
   const b=buildingSite(definition);
   box(b.x,b.y-.2,b.z,b.w+.4,.2,b.d+.4,memorial);
   library.place(b.name==='Gothic chapel'?'elmwood-chapel':'elmwood-gatehouse',details,b.x,b.y,b.z,b.w,b.d);
   collider(b.x,b.y,b.z,b.w,b.eave+b.rise,b.d,'architecture');
 }
''' +s[end:]
start=s.index(' // Reflective water');end=s.index(' let monuments=0;',start)
s=s[:start]+''' // Pond surface uses shallow-bank colour, world-anchored ripples and a local reflection probe.
 const shape=new T.Shape(ELM_POND.map(([x,z])=>{const p=elmPoint(x,z);return new T.Vector2(p.x,-p.z);})),base=new T.ShapeGeometry(shape).toNonIndexed();base.rotateX(-Math.PI/2);
 const positions:number[]=[],waterColors:number[]=[];
 const push=(p:T.Vector3)=>{positions.push(p.x,0,p.z);const plan=planPoint(p.x,p.z),depth=Math.min(1,polylineDistance(plan.x,plan.z,[...ELM_POND,ELM_POND[0]])/7);const colour=new T.Color('#78856b').lerp(new T.Color('#243f38'),depth);waterColors.push(colour.r,colour.g,colour.b);};
 const vertices=base.getAttribute('position');
 for(let i=0;i<vertices.count;i+=3){const a=new T.Vector3().fromBufferAttribute(vertices,i),b=new T.Vector3().fromBufferAttribute(vertices,i+1),c=new T.Vector3().fromBufferAttribute(vertices,i+2),centre=a.clone().add(b).add(c).multiplyScalar(1/3);for(const tri of [[a,b,centre],[b,c,centre],[c,a,centre]])tri.forEach(push);}
 const pg=new T.BufferGeometry();pg.setAttribute('position',new T.Float32BufferAttribute(positions,3));pg.setAttribute('color',new T.Float32BufferAttribute(waterColors,3));pg.computeVertexNormals();
 const waterMaterial=new T.MeshPhysicalMaterial({vertexColors:true,color:'white',roughness:.13,metalness:0,ior:1.333,clearcoat:1,clearcoatRoughness:.10,envMapIntensity:1.15});
 waterMaterial.onBeforeCompile=shader=>{
   shader.uniforms.pondTime=time;shader.vertexShader='varying vec3 pondWorld;\\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\\npondWorld=(modelMatrix*vec4(position,1.)).xyz;');
   shader.fragmentShader='uniform float pondTime; varying vec3 pondWorld;\\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
     vec2 p=pondWorld.xz; vec3 wave=vec3(.028*sin(p.x*2.3+p.y*1.5+pondTime*.75)+.013*sin(p.x*5.1-p.y*3.+pondTime*1.1),0.,.022*cos(p.y*2.7-p.x*.9+pondTime*.55));
     normal=normalize(normal+mat3(viewMatrix)*wave);`);
 };waterMaterial.customProgramCacheKey=()=> 'elmwood-world-water-2';
 const water=new T.Mesh(pg,waterMaterial);water.position.y=ELM_WATER_Y;water.receiveShadow=true;waterGroup.add(water);
 const creekMaterial=waterMaterial.clone();creekMaterial.vertexColors=false;creekMaterial.color.set('#42584b');creekMaterial.onBeforeCompile=waterMaterial.onBeforeCompile;creekMaterial.customProgramCacheKey=()=> 'elmwood-creek-2';
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
''' +s[end:]
start=s.index(' function monument(');end=s.index(' const sites:',start)
s=s[:start]+''' function monument(x:number,z:number,seed:number){
   const y=elmHeight(x,z),names=['headstone-arched','headstone-weathered','headstone-cross','obelisk','ledger','urn'];
   const name=names[Math.floor(hash(seed+84)*names.length)];
   const object=library.place(name,details,x,y,z,name==='ledger'?1.65:1.15,name==='ledger'?1.7:.85);
   object.rotation.y=(hash(seed+55)-.5)*.14;
   const bounds=new T.Box3().setFromObject(object);collider(x,y,z,bounds.max.x-bounds.min.x,bounds.max.y-y,bounds.max.z-bounds.min.z);monuments++;
 }
''' +s[end:]
s=s.replace('const sites:TreeSite[]=[]','const sites:ElmTreeSite[]=[]')
s=s.replace("sites.push({...p,y:elmHeight(p.x,p.z),h:12+hash(i+400)*11,seed:i,crownScale:1.38,lowCrown:true});","sites.push({...p,y:elmHeight(p.x,p.z),h:9+hash(i+400)*14,seed:i,species:elmTreeSpecies(i,elmCreekDistance(pp.x,pp.z)<22)});")
start=s.index(' // Spatial batches');end=s.index(' batchStaticGroup',start)
s=s[:start]+''' // Five distinct botanical meshes, instanced in spatial tiles.
 const treeBatches=library.trees(sites,compact);scene.add(treeBatches.root);
 // Benches and low plot borders give the lanes a human scale.
 for(let i=0;i<ELM_PATHS.length;i+=3){const point=ELM_PATHS[i].sample(ELM_PATHS[i].length*.45),x=point.x+Math.cos(point.heading)*6,z=point.z-Math.sin(point.heading)*6;
   if(!clearElmPlot(x,z,1.4))continue;const y=elmHeight(x,z);
   for(const dx of [-.65,.65])box(x+dx,y,z,.08,.48,.55,metal);
   for(let k=0;k<4;k++)box(x,y+.48,z-.25+k*.16,1.7,.06,.12,get('wood'));
   for(let k=0;k<3;k++)box(x,y+.65+k*.13,z+.28,1.7,.09,.045,get('wood'));
   collider(x,y,z,1.8,1,.8,'bench');
 }
''' +s[end:]
s=s.replace("revision:'elmwood-photo-reference-20260915'","revision:'elmwood-realism-20260916'")
s=s.replace('trees:sites.length,skins:11,','trees:sites.length,skins:15,waterGroup,waterMaterial,')
s=s.replace('let visible=2;for(const b of batches){b.batch.update(Math.max(0,Math.hypot(x-b.x,z-b.z)-45));if(b.batch.group.visible)visible++;}return visible;','return 2+treeBatches.update(x,z);')
p.write_text(s)

import os,json,hashlib,pathlib,subprocess
root=pathlib.Path(os.environ['GITHUB_WORKSPACE'])/'work'
expected='4a2b67d0b10beafb7c999f11985e45a4e45adb94'
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()==expected
assert subprocess.check_output(['git','rev-parse','HEAD^{tree}'],cwd=root,text=True).strip()=='bdd7bbb02d85bf4022d0e4be85c1b20e87fabc14'
b=root/'lottominded-ultra.io/games/gothtechnology2/belle-isle-source'
s=b/'game/src/belle'
changed={}
def edit(name,old,new):
 p=s/name;t=p.read_text();assert old in t,(name,old[:60]);changed.setdefault(str(p.relative_to(root)),hashlib.sha256(t.encode()).hexdigest());p.write_text(t.replace(old,new,1))
def write(name,text):
 p=s/name;assert not p.exists(),name;changed[str(p.relative_to(root))]=None;p.write_text(text)
write('gardenMaze.ts',r'''import {greenhouseLocal,greenhouseWorld,type ConservatoryLayout} from './conservatory.ts';
/** Original fictional game garden, not a recovered or surveyed historic maze.
 * Fixed passages are shared by rendering, ground/flight collision and tests. */
export const GARDEN_MAZE=Object.freeze({id:'belle-conservatory-garden-maze',columns:7,rows:5,cell:4,minU:-84,minV:-10,wallWidth:.8,wallHeight:2.2,entry:20,exit:28,description:'An original hedge-maze game garden beside the Conservatory. Enter from the east, explore the branching paths and leave through the west gate. This is fictional park gameplay, not a surveyed historic feature.'});
export const MAZE_PASSAGES:ReadonlyArray<readonly [number,number]>=Object.freeze([[20,19],[19,26],[26,33],[33,32],[32,25],[25,18],[18,17],[17,24],[24,23],[23,16],[16,9],[9,2],[2,1],[1,0],[0,7],[7,14],[14,21],[21,22],[22,15],[15,8],[22,29],[29,28],[29,30],[30,31],[2,3],[3,10],[10,11],[11,4],[4,5],[5,12],[12,13],[13,6],[33,34],[34,27]] as const);
export type MazeWall={u:number;v:number;width:number;depth:number;bottom:number};
export type MazeVector={x:number;y:number;z:number};
export function mazeCell(cell:number):[number,number]{if(!Number.isInteger(cell)||cell<0||cell>=35)throw new RangeError('Invalid maze cell');return [-84+(cell%7+.5)*4,-10+(Math.floor(cell/7)+.5)*4];}
export function mazeSolution():number[]{const paths=new Map<number,number[]>([[20,[20]]]);for(const [cell,path]of paths){if(cell===28)return path;for(const [a,b]of MAZE_PASSAGES){const next=a===cell?b:b===cell?a:-1;if(next>=0&&!paths.has(next))paths.set(next,[...path,next]);}}throw new Error('Maze exit disconnected');}
export function mazeArrival(c:ConservatoryLayout){const point=greenhouseWorld(c,-52,0),look=greenhouseWorld(c,...mazeCell(20));return {...point,heading:Math.atan2(look.x-point.x,look.z-point.z)};}
export function mazeLandmark(c:ConservatoryLayout){return {id:GARDEN_MAZE.id,name:'Conservatory Garden Maze',kind:'attraction',...greenhouseWorld(c,-70,0),description:GARDEN_MAZE.description};}
export function withinMazeGarden(c:ConservatoryLayout|undefined,x:number,z:number,padding=0){if(!c)return false;const {u,v}=greenhouseLocal(c,x,z),p=Math.max(0,padding);return u>=-89-p&&u<=-50+p&&v>=-10.5-p&&v<=10.5+p;}
export class GardenMazeCollision {
 readonly layout:ConservatoryLayout|undefined;readonly walls:MazeWall[]=[];
 constructor(layout:ConservatoryLayout|undefined,height:(x:number,z:number)=>number=()=>2){
  this.layout=layout;if(!layout)return;
  const passages=new Set(MAZE_PASSAGES.map(([a,b])=>[Math.min(a,b),Math.max(a,b)].join(':'))),open=(a:number,b:number)=>passages.has([Math.min(a,b),Math.max(a,b)].join(':'));
  const wall=(u:number,v:number,width:number,depth:number)=>{const p=greenhouseWorld(layout,u,v);this.walls.push({u,v,width,depth,bottom:height(p.x,p.z)});};
  for(let y=0;y<5;y++)for(let x=0;x<=7;x++){if(x===7&&y===2||x===0&&y===4)continue;if(x>0&&x<7&&open(y*7+x-1,y*7+x))continue;wall(-84+x*4,-10+(y+.5)*4,.8,4.8);}
  for(let y=0;y<=5;y++)for(let x=0;x<7;x++){if(y>0&&y<5&&open((y-1)*7+x,y*7+x))continue;wall(-84+(x+.5)*4,-10+y*4,4.8,.8);}
 }
 blocked(x:number,z:number,margin=0){if(!this.layout||!Number.isFinite(x+z+margin))return false;const {u,v}=greenhouseLocal(this.layout,x,z),m=Math.max(0,margin);if(u< -84.4-m||u> -55.6+m||v< -10.4-m||v>10.4+m)return false;return this.walls.some(w=>Math.abs(u-w.u)<w.width/2+m&&Math.abs(v-w.v)<w.depth/2+m);}
 ray(o:MazeVector,d:MazeVector,max:number,half=.4):number|null{
  if(!this.layout||!Number.isFinite(o.x+o.y+o.z+d.x+d.y+d.z+max+half)||max<0)return null;
  const a=greenhouseLocal(this.layout,o.x,o.z),cos=Math.cos(this.layout.yaw),sin=Math.sin(this.layout.yaw),du=d.x*cos-d.z*sin,dv=-d.x*sin-d.z*cos,m=Math.max(0,half);
  if(Math.max(a.u,a.u+du*max)<-84.4-m||Math.min(a.u,a.u+du*max)>-55.6+m||Math.max(a.v,a.v+dv*max)<-10.4-m||Math.min(a.v,a.v+dv*max)>10.4+m)return null;
  let hit=max+1;
  for(const wall of this.walls){let enter=0,leave=Math.min(max,hit);for(const [p,v,lo,hi]of [[a.u,du,wall.u-wall.width/2-m,wall.u+wall.width/2+m],[a.v,dv,wall.v-wall.depth/2-m,wall.v+wall.depth/2+m],[o.y,d.y,wall.bottom-m,wall.bottom+2.2+m]]){if(Math.abs(v)<1e-9){if(p<lo||p>hi){enter=max+1;break;}}else{const a=(lo-p)/v,b=(hi-p)/v;enter=Math.max(enter,Math.min(a,b));leave=Math.min(leave,Math.max(a,b));}}if(enter<=leave&&enter<hit)hit=enter;}
  return hit<=max?hit:null;
 }
}
''')
write('gardenMazeScene.ts',r'''import * as T from 'three';
import type {GardenMazeCollision} from './gardenMaze.ts';
import {greenhouseWorld} from './conservatory.ts';
/** Opaque shared geometry. Quality modes never hide gameplay walls. */
export function addGardenMaze(scene:T.Scene,collision:GardenMazeCollision){
 const root=new T.Group();root.name='Conservatory Garden Maze';const materials:T.Material[]=[],geometries:T.BufferGeometry[]=[];
 if(!collision.layout)return {root,stats:{walls:0,triangles:0,draws:0},dispose(){}};
 const c=collision.layout,dummy=new T.Object3D(),color=new T.Color();
 const material=(name:string,value:number)=>{const m=new T.MeshStandardMaterial({name,color:value,roughness:1});materials.push(m);return m;};
 const hedge=material('Garden maze living hedge',0xffffff),gravel=material('Garden maze gravel',0xb0a385),box=new T.BoxGeometry(1,1,1),cap=new T.IcosahedronGeometry(1,0);geometries.push(box,cap);
 const cores=new T.InstancedMesh(box,hedge,collision.walls.length);cores.name='Maze hedge collision-matched cores';
 const caps:{u:number;v:number;y:number}[]=[];
 collision.walls.forEach((w,i)=>{const p=greenhouseWorld(c,w.u,w.v);dummy.position.set(p.x,w.bottom+.95,p.z);dummy.rotation.set(0,c.yaw,0);dummy.scale.set(w.width,1.9,w.depth);dummy.updateMatrix();cores.setMatrixAt(i,dummy.matrix);cores.setColorAt(i,color.setHSL(.27+(i%4)*.008,.33,.22+(i%5)*.009));const alongU=w.width>w.depth,length=alongU?w.width:w.depth,count=Math.ceil((length-.8)/.55)+1;for(let n=0;n<count;n++){const t=(n/Math.max(1,count-1)-.5)*(length-.8);caps.push({u:w.u+(alongU?t:0),v:w.v+(alongU?0:t),y:w.bottom+1.9});}});
 const crowns=new T.InstancedMesh(cap,hedge,caps.length);crowns.name='Maze hedge rounded foliage';caps.forEach((p,i)=>{const q=greenhouseWorld(c,p.u,p.v);dummy.position.set(q.x,p.y,q.z);dummy.rotation.set(0,c.yaw,0);dummy.scale.set(.4,.3,.4);dummy.updateMatrix();crowns.setMatrixAt(i,dummy.matrix);crowns.setColorAt(i,color.setHSL(.275+(i%4)*.007,.36,.25+(i%5)*.008));});
 for(const mesh of [cores,crowns]){mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);}
 const floors=new T.InstancedMesh(box,gravel,3);floors.name='Maze walkable gravel and gate aprons';[[-70,0,28.8,20.8],[-48,0,16,2.4],[-88,8,8,2.4]].forEach(([u,v,w,d],i)=>{const p=greenhouseWorld(c,u,v);dummy.position.set(p.x,2.012,p.z);dummy.rotation.set(0,c.yaw,0);dummy.scale.set(w,.018,d);dummy.updateMatrix();floors.setMatrixAt(i,dummy.matrix);});floors.instanceMatrix.needsUpdate=true;floors.computeBoundingSphere();floors.receiveShadow=true;root.add(floors);scene.add(root);let disposed=false;
 return {root,stats:{walls:collision.walls.length,triangles:collision.walls.length*12+caps.length*20+36,draws:3},dispose(){if(disposed)return;disposed=true;root.removeFromParent();for(const m of [cores,crowns,floors])m.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();}};
}
''')
write('vegetationVolume.ts',r'''import type * as T from 'three';
/** Broaden only cloned leaves/cards. No new triangles, draw calls or physics. */
export const CANOPY_WIDTH=1.12;
export function fullerCanopy(geometry:T.BufferGeometry){geometry.computeBoundingBox();const box=geometry.boundingBox;if(!box||box.isEmpty())return;const cx=(box.min.x+box.max.x)/2,cz=(box.min.z+box.max.z)/2,p=geometry.getAttribute('position');for(let i=0;i<p.count;i++)p.setXYZ(i,cx+(p.getX(i)-cx)*CANOPY_WIDTH,p.getY(i),cz+(p.getZ(i)-cz)*CANOPY_WIDTH);p.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();}
export function gardenDetailFraction(distance:number){const safe=Number.isFinite(distance)?Math.max(0,distance):150,t=Math.max(0,Math.min(1,(safe-85)/65));return 1-.65*t*t*(3-2*t);}
''')
write('aerialPerspective.ts',r'''import {unit,smooth,fogColumn} from './presentationPolicy.ts';
/** Bounded daylight aerial perspective, not scene-occluded god rays. */
export function aerialStrength(day:number,overcast:number,quality:string,xr=false){return (quality==='smooth'||xr ? .012 : .022)*unit(day)*(1-.55*unit(overcast));}
export function aerialBlend(distance:number,cameraHeight:number,surfaceHeight:number,towardSun:number,strength:number){return Math.min(.022,Math.max(0,Number.isFinite(strength)?strength:0))*smooth(150,700,distance)*fogColumn(cameraHeight,surfaceHeight)*(.35+.65*unit(towardSun)**4);}
''')
edit('terrain.ts','import {makeSmallBridgePlan',"import {GardenMazeCollision} from './gardenMaze.ts';\nimport {makeSmallBridgePlan")
edit('terrain.ts',' readonly flightSolids=new FlightSolids();',' readonly gardenMaze:GardenMazeCollision;\n readonly flightSolids=new FlightSolids();')
edit('terrain.ts','obstructed(x:number,z:number,margin=0){return ','obstructed(x:number,z:number,margin=0){return this.gardenMaze.blocked(x,z,margin)||')
edit('terrain.ts','this.beaches=makeBeachProfiles(map);','this.beaches=makeBeachProfiles(map);this.gardenMaze=new GardenMazeCollision(map.conservatory,(x,z)=>this.height(x,z));')
edit('terrain.ts','let hit=Math.min(this.smallBridges.ray','let hit=Math.min(this.gardenMaze.ray(o,d,max,half)??max+1,this.smallBridges.ray')
edit('world.ts','import {batchStaticGround}',"import {addGardenMaze} from './gardenMazeScene.ts';\nimport {batchStaticGround}")
edit('world.ts','const gardens=await addGardens(scene);','const gardens=await addGardens(scene);const gardenMaze=addGardenMaze(scene,terrain.gardenMaze);')
edit('world.ts','stats:{groundBatch,','stats:{gardenMaze:gardenMaze.stats,groundBatch,')
edit('main.ts','import {Golf}',"import {GARDEN_MAZE,mazeArrival,mazeLandmark} from './gardenMaze.ts';\nimport {Golf}")
edit('main.ts','prepareCoastGuardMap(data);for(const p of activityLandmarks())','prepareCoastGuardMap(data);if(data.conservatory&&!data.landmarks.some(l=>l.id===GARDEN_MAZE.id))data.landmarks.push(mazeLandmark(data.conservatory));for(const p of activityLandmarks())')
edit('main.ts','vrPlaces.push({label:lm.name,go:()=>travel.click()});',"if(lm.id===GARDEN_MAZE.id&&data.conservatory){const note=document.createElement('p');note.textContent=GARDEN_MAZE.description;c.append(note);const walk=document.createElement('button');walk.textContent='Walk to maze entrance';walk.onclick=()=>{const p=mazeArrival(data.conservatory!);if(!terrain.land(p.x,p.z)||terrain.obstructed(p.x,p.z,.8))return;destination=lm;jump(p.x,p.z,p.heading);core.advance(1/60,{dismount:true});first=true;cameraPitch=.03;syncViewLabel();el<HTMLDialogElement>('guide').close();if(!active)start.click();canvas.focus();};c.append(walk);}vrPlaces.push({label:lm.name,go:()=>travel.click()});")
edit('nature.ts','import {canopyTint}',"import {withinMazeGarden} from './gardenMaze.ts';\nimport {fullerCanopy} from './vegetationVolume.ts';\nimport {canopyTint}")
edit('nature.ts','plants:plan.ground.filter(p=>p.id===entry.id)','plants:plan.ground.filter(p=>p.id===entry.id&&!withinMazeGarden(terrain?.map.conservatory,p.x,p.z,.5))')
edit('nature.ts','const nearGround=plan.ground.filter(p=>d(p)<','const nearGround=plan.ground.filter(p=>!withinMazeGarden(terrain?.map.conservatory,p.x,p.z,.5)&&d(p)<')
edit('nature.ts','geometry.translate(0,-rootOffset,0);',"geometry.translate(0,-rootOffset,0);if(/ leaves$/.test(name))fullerCanopy(geometry);")
edit('nature.ts','cards.translate(center[0],center[1],center[2]);','cards.translate(center[0],center[1],center[2]);fullerCanopy(cards);')
edit('gardens.ts','import * as T',"import {gardenDetailFraction} from './vegetationVolume.ts';\nimport * as T")
edit('gardens.ts','for(let i=0;i<10;i++)','for(let i=0;i<14;i++)')
edit('gardens.ts','tile.detailed&&distance>105?Math.ceil(tile.count*.35):tile.count','tile.detailed?Math.ceil(tile.count*gardenDetailFraction(distance)):tile.count')
edit('gardenBotany.ts','(grass?22:14)','(grass?26:18)')
edit('gardenBotany.ts','grass?.019:.045','grass?.022:.052')
edit('atmosphereShaders.ts','uniform float belleCloudTime,belleCloudCoverage,belleCloudStrength;','uniform float belleCloudTime,belleCloudCoverage,belleCloudStrength,belleAirStrength;')
edit('atmosphereShaders.ts','  float fogFactor=1.0-exp(-belleOptical*belleOptical);',r'''  float fogFactor=1.0-exp(-belleOptical*belleOptical);
  // Surface aerial perspective; no claim of foreground-occluded light shafts.
  vec3 belleViewRay=(belleAtmosphereWorld-cameraPosition)/max(.001,belleDistance);
  float belleTowardSun=max(0.0,dot(belleViewRay,belleSunDirection));
  float belleAir=clamp(belleAirStrength,0.0,.022)*smoothstep(150.0,700.0,belleDistance)*belleDensity*(.35+.65*pow(belleTowardSun,4.0));
  fogFactor=1.0-(1.0-fogFactor)*(1.0-belleAir);''')
edit('worldAtmosphere.ts','import * as T',"import {aerialStrength} from './aerialPerspective.ts';\nimport * as T")
edit('worldAtmosphere.ts','belleCloudStrength:T.IUniform<number>};','belleCloudStrength:T.IUniform<number>;belleAirStrength:T.IUniform<number>};')
edit('worldAtmosphere.ts','belleCloudStrength:{value:0}};','belleCloudStrength:{value:0},belleAirStrength:{value:0}};')
edit('worldAtmosphere.ts','|belle-height-fog-clouds-v1','|belle-height-fog-clouds-air-v2')
edit('worldAtmosphere.ts','this.uniforms.belleCloudCoverage.value=coverage;','this.uniforms.belleAirStrength.value=aerialStrength(day,overcast,quality,xr);this.uniforms.belleCloudCoverage.value=coverage;')
# Tests arrive as separate exact text blobs in the diagnostic payload.
payload=pathlib.Path(os.environ['GITHUB_WORKSPACE'])/'diagnostic/.diagnostics/environment-tests'
for name in ['gardenMaze.test.ts','gardenMazeDrive.test.ts','environmentPresentation.test.ts']:write(name,(payload/name).read_text())
p=b/'game/run-tests.mjs';t=p.read_text();changed[str(p.relative_to(root))]=hashlib.sha256(t.encode()).hexdigest();assert "entryPoints:[" in t and "'--test'," in t;t=t.replace('entryPoints:[',"entryPoints:['src/belle/gardenMazeDrive.test.ts',",1).replace("'--test',","'--test','src/belle/gardenMaze.test.ts','src/belle/environmentPresentation.test.ts','.test/gardenMazeDrive.test.mjs',",1);p.write_text(t)
p=b/'ENVIRONMENT_UPDATE_20261113.md';assert not p.exists();p.write_text((payload/'ENVIRONMENT_UPDATE_20261113.md').read_text());changed[str(p.relative_to(root))]=None
out=root/'environment-validation';out.mkdir(exist_ok=True)
files=[{'path':name,'beforeSha256':old,'afterSha256':hashlib.sha256((root/name).read_bytes()).hexdigest()} for name,old in sorted(changed.items())]
(out/'candidate-source.json').write_text(json.dumps({'base':expected,'baseTree':'bdd7bbb02d85bf4022d0e4be85c1b20e87fabc14','files':files},indent=2))
subprocess.run(['git','add','--',*changed.keys()],cwd=root,check=True)
tree=subprocess.check_output(['git','write-tree'],cwd=root,text=True).strip();(out/'candidate-tree.txt').write_text(tree+'\n')
(out/'candidate.patch').write_bytes(subprocess.check_output(['git','diff','--cached','--binary'],cwd=root))
print('PROPOSED TREE',tree)

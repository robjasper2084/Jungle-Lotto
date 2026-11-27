import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as T from 'three';
import {LocationPresentation} from './locationPresentation.ts';
import {roadContactPresentation} from './roadContactPresentation.ts';
import {sceneFrameCap} from './frameBudget.ts';
import {pauseSoftwareStartupScene} from './startupRenderPolicy.ts';
import {RideProfileStats} from './rideProfileStats.ts';
import {createPose,type RidePose} from '../../runtime/ride-core/src/controller.ts';
import {RideCore} from '../../runtime/ride-core/src/ridecore.ts';
import type {TerrainSampler} from '../../runtime/ride-core/src/terrain.ts';

const source=readFileSync(new URL('./main.ts',import.meta.url),'utf8');
const ast=ts.createSourceFile('main.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
function call(name:string){
 const matches:ts.CallExpression[]=[];
 const visit=(node:ts.Node)=>{if(ts.isCallExpression(node)&&node.expression.getText(ast)===name)matches.push(node);ts.forEachChild(node,visit);};
 visit(ast);assert.equal(matches.length,1,'Expected one '+name+' integration');return matches[0];
}
function property(object:ts.Expression,key:string){
 assert.ok(ts.isObjectLiteralExpression(object));
 const field=object.properties.find(p=>ts.isPropertyAssignment(p)&&p.name.getText(ast)===key);
 assert.ok(field&&ts.isPropertyAssignment(field));return field.initializer.getText(ast);
}
function declaration(name:string){
 const found=ast.statements.flatMap(function collect(n:ts.Node):ts.FunctionDeclaration[]{return ts.isFunctionDeclaration(n)&&n.name?.text===name?[n]:n.getChildren(ast).flatMap(collect);})[0];
 assert.ok(found?.body,'Missing function '+name);return found;
}
function locationTransition(){
 const changes:ts.NewExpression[]=[];
 const visit=(n:ts.Node)=>{if(ts.isNewExpression(n)&&n.expression.getText(ast)==='RealLocationPanel')changes.push(n);ts.forEachChild(n,visit);};visit(ast);
 assert.equal(changes.length,1);
 return property(changes[0].arguments![0],'onFollowChanged');
}

function frameClockFixture(){
 const frameStatements=declaration('frame').body!.statements;
 const end=frameStatements.findIndex(statement=>ts.isExpressionStatement(statement)&&
  ts.isCallExpression(statement.expression)&&statement.expression.expression.getText(ast)==='world.sky.tick');
 assert.ok(end>=0,'The actual frame prefix must include elapsed time and the sky tick');
 const prefix=frameStatements.slice(0,end+1).map(statement=>statement.getText(ast)).join('\n');
 let boundary:ts.VariableDeclaration|undefined;
 const visit=(node:ts.Node)=>{if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='breakMeasurementInterval')boundary=node;ts.forEachChild(node,visit);};
 visit(ast);assert.ok(boundary?.initializer,'Missing actual measurement boundary');
 let wallNow=132,associationsBroken=0;
 const context={locationPerformance:undefined,pauseSoftwareStartupScene,softwareStartup:false,prepared:true,
  active:true,document:{hidden:false,querySelector:()=>null},hasOpenDialog:()=>false,vr:undefined,scenePreparing:false,
  resetFrameClock:false,previous:100,lastRender:100,lastMeasurementEligible:true,
  rideProfile:{breakFrameAssociation(){associationsBroken++;}},paused:false,renderFocused:true,sceneFrameCap,cap:60,
  performance:{now:()=>wallNow},clock:0,world:{sky:{observeFrame(){},tick(){}}},coop:undefined,
  graphics:{value:'high'},frameBudget:undefined,online:undefined,reduced:true};
 const sandbox=vm.createContext(context);
 const js=ts.transpileModule(`({boundary:${boundary.initializer.getText(ast)},frame(now:number){${prefix}\nreturn {elapsed,dt,eligibleFrame};}})`,
  {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const run=vm.runInContext(js,sandbox) as {boundary:()=>void;frame:(now:number)=>{elapsed:number;dt:number;eligibleFrame:boolean}|undefined};
 return {context,run,wall(value:number){wallNow=value;},get associationsBroken(){return associationsBroken;}};
}

test('a later modal or focus boundary reanchors on RAF time for GPS and ordinary riding',()=>{
 const f=frameClockFixture(),display=new LocationPresentation();display.begin(createPose());
 const ground:TerrainSampler={sampleGround(_x,_z,out){out.height=2;out.normal={x:0,y:1,z:0};out.surface='pavement';out.offCourse=false;return out;},
  raycast(){return null;},raycastObstacle(){return null;}};
 const core=new RideCore(ground,{spawn:{position:{x:0,y:2,z:0},headingY:0}});
 const point={x:0,z:0,headingY:null,speedMps:0};
 // A follow transition already requests a reset; its first callback stays safe.
 assert.match(locationTransition(),/resetFrameClock=true/);f.context.resetFrameClock=true;
 const first=f.run.frame(130)!;assert.equal(first.dt,0);assert.equal(first.eligibleFrame,false);
 assert.ok(display.update(point,2,first.dt));assert.equal(f.context.resetFrameClock,false);
 const ordinary=f.run.frame(150)!;assert.equal(ordinary.dt,.02);assert.equal(ordinary.eligibleFrame,true);

 // A new boundary after that reset has been consumed may run after the browser
 // has already assigned the next callback's timestamp. Execute the source hook.
 f.wall(182);const previous=f.context.previous,broken=f.associationsBroken;f.run.boundary();
 assert.equal(f.context.previous,previous,'Event wall time must not replace the animation anchor');
 assert.equal(f.context.lastMeasurementEligible,false);assert.equal(f.associationsBroken,broken+1);
 const resumed=f.run.frame(180)!;assert.equal(resumed.dt,0);assert.equal(resumed.eligibleFrame,false);
 assert.ok(display.update(point,2,resumed.dt),'Fresh valid GPS coordinates remain presentable');
 assert.doesNotThrow(()=>core.advance(resumed.dt,{throttle:1}),'Ordinary riding must not throw on a resumed callback');
 const next=f.run.frame(200)!;assert.equal(next.elapsed,.02);assert.equal(next.eligibleFrame,true);
 assert.doesNotThrow(()=>core.advance(next.dt,{throttle:1}));assert.ok(core.current.speed>0,'Ordinary movement continues after the boundary');
});

test('an uninterrupted 300 ms frame stays eligible and reaches the existing stall statistics unchanged',()=>{
 const f=frameClockFixture();f.wall(402);
 const sample=f.run.frame(400)!;
 assert.equal(sample.elapsed,.3);assert.equal(sample.dt,.05);assert.equal(sample.eligibleFrame,true);
 assert.equal(call('rideProfile?.sample').arguments[0].getText(ast),'elapsed','Profiling keeps raw elapsed time, not bounded simulation dt');
 const stats=new RideProfileStats();
 stats.sample({dt:sample.elapsed,times:[0,0,0,0,0],draws:1,triangles:1,textures:1,geometries:1,
  x:0,z:0,speed:1,place:'clock regression',eligible:sample.eligibleFrame,hidden:false});
 const report=stats.report();assert.equal(report.frames,1);assert.equal(report.over250ms,1);assert.equal(report.maxFrameMs,300);
});

test('network, activity progress and saved diagnostics consume only parked simulation coordinates',()=>{
 const network=call('online.update').arguments[0];
 assert.equal(property(network,'pose'),'manualPose');
 assert.equal(property(network,'active'),'active&&!locationFollowing');
 for(const key of ['vehicle','pilot','livery'])assert.ok(property(network,key),'Existing vehicle protocol field '+key);
 assert.match(network.getText(ast),/hover\.vehicleTelemetry/,'Existing telemetry is preserved beside the private pose boundary');
 const activity=call('activities?.update').arguments[1];
 for(const name of ['x','y','z'])assert.equal(property(activity,name),'manualPose.'+name);
 assert.equal(property(activity,'speedMps'),'manualPose.speed');
 const profile=call('rideProfile?.sample').arguments;
 assert.deepEqual(profile.slice(6,9).map(a=>a.getText(ast)),['manualPose.x','manualPose.z','manualPose.speed']);
 assert.equal(profile[9].getText(ast),'profilePlace');
 assert.match(profile[10].getText(ast),/!locationFollowing/);
 assert.equal(profile[11].getText(ast),'renderProbe?.finishFrame()');
 assert.equal(profile[12].getText(ast),'submissionFrame');
 const firstRide=call('firstRide.update').arguments;
 assert.deepEqual(firstRide.slice(0,2).map(a=>a.getText(ast)),['manualPose.x','manualPose.z']);
 assert.match(firstRide[3].getText(ast),/!locationFollowing/,'GPS does not complete the saved first-ride objective');
 assert.match(source,/if\(!locationFollowing\)profilePlace=/,'GPS-derived landmark names do not persist in a later diagnostic frame');
 assert.ok(source.indexOf('const manualPose=pose')<source.indexOf('locationPresentation.update('));
 assert.ok(source.indexOf('trials?.update(')<source.indexOf('locationPresentation.update('));
 assert.ok(source.indexOf('const manualPose=pose')>source.indexOf('const p=cadillac.sim.pose'),'Manual pose includes the actual Cadillac before display override');
});

test('follow guard rejects every conflicting mode, pending room joins and non-walkable fixes',()=>{
 const body=declaration('canFollowLocation').body!.getText(ast);
 const context:Record<string,unknown>={locationMapMatches:true,active:true,paused:false,scenePreparing:false,
  online:{online:false,sessionActive:false},locationGroundAvailable:()=>true};
 const modes=['cadillac','vr','coop','race','trials','activities','fishing','golf','slide','hover','boat','photo'];
 for(const mode of modes)context[mode]={active:false,riding:false};
 const run=vm.runInNewContext('(function(fix)'+body+')',context) as (fix:{x:number;z:number})=>string|null;
 const fix={x:1200,z:400};assert.equal(run(fix),null);
 for(const mode of modes){context[mode]={active:true,riding:true};assert.equal(typeof run(fix),'string',mode);context[mode]={active:false,riding:false};}
 context.cadillac={riding:false,exiting:true};assert.equal(typeof run(fix),'string','Cadillac exit transition');context.cadillac={riding:false,exiting:false};
 context.online={online:false,sessionActive:true};assert.match(run(fix)!,/multiplayer/);context.online={sessionActive:false};
 for(const mode of ['paused','scenePreparing']){context[mode]=true;assert.equal(typeof run(fix),'string');context[mode]=false;}
 context.active=false;assert.equal(typeof run(fix),'string');context.active=true;
 context.locationGroundAvailable=()=>false;assert.match(run(fix)!,/ground/);context.locationGroundAvailable=()=>true;
 context.locationMapMatches=false;assert.match(run(fix)!,/coordinate/);
});

test('GPS follow excludes located render probes and breaks diagnostic associations on transitions',()=>{
 for(const name of ['renderProbe?.beginFrame','submissionProbe?.beginFrame'])assert.match(call(name).arguments[0].getText(ast),/!locationFollowing/);
 const transition=locationTransition();
 assert.match(transition,/rideProfile\?\.breakFrameAssociation\(\)/);
 assert.match(transition,/renderProbe\?\.cancelFrame\(\)/);
 assert.match(transition,/submissionProbe\?\.cancelFrame\(\)/);
});

test('the default circular HUD receives only the active local fix and the real GPS drawing callback',()=>{
 const overlay=call('createReferenceHud').arguments[1];
 const fixture:{realLocation:any}={realLocation:{snapshot:{status:'tracking',fix:{x:900,z:600,accuracy:5}},drawMap:(...args:unknown[])=>args}};
 const position=vm.runInNewContext('('+property(overlay,'position')+')',fixture);
 const draw=vm.runInNewContext('('+property(overlay,'draw')+')',fixture);
 assert.equal(position(),fixture.realLocation.snapshot.fix);
 const canvas={},mapX=(x:number)=>x,mapZ=(z:number)=>z;
 assert.deepEqual(Array.from(draw(canvas,mapX,mapZ)),[canvas,mapX,mapZ]);
 fixture.realLocation.snapshot.status='off';assert.equal(position(),undefined);
 fixture.realLocation=undefined;assert.equal(position(),undefined);assert.equal(draw(canvas,mapX,mapZ),undefined);
});

for(const roadRise of [0,.08])for(const firstPerson of [false,true])test('stopping GPS restores the '+(firstPerson?'first':'third')+'-person hero and camera with '+roadRise+' m road rise without another animation frame',()=>{
 const core={
  current:Object.assign(createPose(),{x:12,y:2.3,z:24,airHeight:.3,headingY:.7,footBlend:.25,parkX:8,parkY:2,parkZ:20}),
  renderPose:Object.assign(createPose(),{x:11.8,y:2.3,z:23.9,airHeight:.3,headingY:.68,footBlend:.25,parkX:8,parkY:2,parkZ:20}),
 };
 const parked=structuredClone(core);
 const expectedPose={...core.renderPose,y:core.renderPose.y+roadRise*.75,parkY:core.renderPose.parkY+roadRise};
 const root=new T.Group(),rider=new T.Group(),vehicle=new T.Group();root.add(rider,vehicle);
 root.visible=rider.visible=!firstPerson;vehicle.visible=firstPerson;
 const applied:RidePose[]=[];
 const hero={root,rider,vehicle,apply(pose:RidePose){
  applied.push(pose);root.position.set(pose.x,pose.y,pose.z);
  // Applying a pose may change visibility; the saved view must be restored last.
  root.visible=rider.visible=vehicle.visible=true;
 }};
 const camera=new T.PerspectiveCamera(63,1.7,.1,10000);
 camera.position.set(10,4,20);camera.lookAt(15,2,30);camera.updateProjectionMatrix();
 const saved={position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),projection:camera.projectionMatrix.toArray(),fov:camera.fov,
  rootVisible:root.visible,riderVisible:rider.visible,vehicleVisible:vehicle.visible};
 const presentation=new LocationPresentation();
 let following=false,restoredBeforeFollowOff=false;
 const context:Record<string,unknown>={
  first:firstPerson,cameraYaw:.6,cameraPitch:-.2,camera,hero,core,locationPresentation:presentation,locationSavedView:null,
  roadContactPresentation,terrain:{roadContact:{height:(_x:number,_z:number,groundY:number)=>groundY+roadRise}},
  rideProfile:{breakFrameAssociation(){}},renderProbe:{cancelFrame(){}},submissionProbe:{cancelFrame(){}},
  document:{body:{classList:{toggle(){}}}},clear(){},release(){},syncViewLabel(){},syncTrialControls(){},
  zone:{hidden:false},active:true,touch:{checked:true},snap:false,resetFrameClock:false,
 };
 Object.defineProperty(context,'locationFollowing',{get:()=>following,set:(value:boolean)=>{
  if(!value){
   assert.deepEqual(applied.at(-1),expectedPose,'The road-aligned parked presentation is applied before follow is exposed as off');
   if(roadRise)assert.notEqual(applied.at(-1),core.renderPose,'Road alignment uses a copy, never the simulation object');
   else assert.equal(applied.at(-1),core.renderPose,'Unchanged road contact reuses the original pose');
   assert.deepEqual(root.position.toArray(),[expectedPose.x,expectedPose.y,expectedPose.z]);
   assert.deepEqual(camera.position.toArray(),saved.position);
   assert.deepEqual(camera.quaternion.toArray(),saved.quaternion);
   assert.equal(root.visible,saved.rootVisible);assert.equal(rider.visible,saved.riderVisible);assert.equal(vehicle.visible,saved.vehicleVisible);
   restoredBeforeFollowOff=true;
  }
  following=value;
 }});
 const transition=vm.runInNewContext('('+locationTransition()+')',context) as (following:boolean)=>void;
 transition(true);assert.equal(following,true);
 const gps=presentation.update({x:1200,z:400,headingY:2.2,speedMps:1.8},3,.05)!;
 hero.apply(gps);vehicle.visible=false;
 camera.position.set(1195,5,399);camera.lookAt(1200,4,400);camera.fov=90;camera.updateProjectionMatrix();

 // Do not run a frame: pagehide or shader preparation can stop the render loop here.
 transition(false);

 assert.equal(following,false);assert.equal(restoredBeforeFollowOff,true);
 assert.deepEqual(core,parked,'Neither entering nor leaving GPS changes simulation state');
 assert.equal(context.first,firstPerson);assert.equal(context.cameraYaw,.6);assert.equal(context.cameraPitch,-.2);
 assert.equal(camera.fov,saved.fov);assert.deepEqual(camera.projectionMatrix.toArray(),saved.projection);
 const cleared=(presentation as unknown as {pose:RidePose}).pose;
 assert.equal(cleared.x,0);assert.equal(cleared.z,0);assert.equal(cleared.footTime,0);assert.equal(cleared.footCycle,0);
 assert.equal(cleared.headingY,core.current.headingY);assert.equal(cleared.parkX,core.current.x);assert.equal(cleared.parkZ,core.current.z);
 assert.equal(context.snap,true);assert.equal(context.resetFrameClock,true);
});

test('road presentation preserves GPS walking height while aligning only the parked wheel',()=>{
 const gps=Object.freeze(Object.assign(createPose(),{x:1200,y:3,z:400,footBlend:1,parkX:12,parkY:2,parkZ:24}));
 const aligned=roadContactPresentation(gps,{height:(x,_z,groundY)=>x===12?groundY+.06:groundY+100});
 assert.equal(aligned.x,gps.x);assert.equal(aligned.y,3);assert.equal(aligned.z,gps.z);assert.equal(aligned.parkY,2.06);
 assert.equal(gps.parkY,2);assert.equal(gps.y,3);assert.notEqual(aligned,gps);
 assert.match(source,/hero\.apply\(!hover\?\.riding&&!boat\?\.riding&&!slide\?\.active&&!race\?\.active\?roadContactPresentation\(pose,terrain\.roadContact\):pose\)/,
  'Ordinary rendering uses the same helper and keeps specialized vehicle modes on their own presentation');
});

test('GPS extent changes invalidate the existing minimap cache while ordinary jitter reuses it',()=>{
 let backgroundRenders=0;
 const ctx=Object.fromEntries(['clearRect','drawImage','save','translate','rotate','beginPath','moveTo','lineTo','fill','restore','fillText'].map(name=>[name,()=>{}]));
 const context:Record<string,any>={navigation:{hidden:false},minimap:{hidden:false},opacity:{value:'.8'},cityMap:false,
  mapFrame:{minX:-600,maxX:4100,minZ:-700,maxZ:2000},mapLayerOpacity:-1,mapLayer:{},ctx,data:{landmarks:[]},districtDestinations:[],destination:undefined,
  online:undefined,race:undefined,activities:undefined,realLocation:{snapshot:{status:'off'},drawMap:()=>{}}};
 context.px=(x:number)=>(x-context.mapFrame.minX)/(context.mapFrame.maxX-context.mapFrame.minX)*420;
 context.pz=(z:number)=>(z-context.mapFrame.minZ)/(context.mapFrame.maxZ-context.mapFrame.minZ)*290;
 context.drawMapLayer=(alpha:number)=>{backgroundRenders++;context.mapLayerOpacity=alpha;};
 const js=ts.transpileModule('('+declaration('drawMap').getText(ast)+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const draw=vm.runInNewContext(js,context) as (x:number,z:number,heading:number)=>void;
 draw(0,0,0);draw(0,0,0);assert.equal(backgroundRenders,1,'Ordinary map background is reused');
 context.realLocation.snapshot={status:'tracking',fix:{x:3900,z:2100,accuracy:10}};
 draw(0,0,0);assert.equal(backgroundRenders,2);assert.equal(context.mapFrame.maxZ,2200);
 context.realLocation.snapshot.fix.z=2101;draw(0,0,0);assert.equal(backgroundRenders,2,'Small GPS jitter keeps the same expanded tile');
 context.realLocation.snapshot.fix.z=2300;draw(0,0,0);assert.equal(backgroundRenders,3);assert.equal(context.mapFrame.maxZ,2400);
 context.realLocation.snapshot={status:'off'};draw(0,0,0);assert.equal(backgroundRenders,4);assert.equal(context.mapFrame.maxZ,2000,'Stopping location restores the ordinary map viewport');
});

test('online session guard includes in-flight joins and reconnecting channels',()=>{
 const online=readFileSync(new URL('./onlineRooms.ts',import.meta.url),'utf8');
 const body=online.match(/get sessionActive\(\)\{([^}]+)\}/)?.[1];assert.ok(body);
 const getter=Function(body);
 assert.equal(getter.call({connected:false,connecting:false}),false);
 assert.equal(getter.call({connected:false,connecting:true}),true);
 assert.equal(getter.call({connected:false,connecting:false,channel:{}}),true);
 assert.equal(getter.call({connected:true,connecting:false}),true);
});

test('camera capture is withheld while following and restored synchronously on stop',()=>{
 assert.match(source,/if\(locationFollowing\)return \{unavailable:/);
 const restore=source.indexOf('camera.position.copy(locationSavedView.position)');
 assert.ok(restore>0&&restore<source.indexOf('locationFollowing=following;'));
 assert.match(source,/camera\.quaternion\.copy\(locationSavedView\.quaternion\)/);
 assert.match(source,/camera\.fov=locationSavedView\.fov/);
});

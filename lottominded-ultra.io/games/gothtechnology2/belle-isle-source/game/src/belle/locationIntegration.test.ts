import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

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

test('network, activity progress and saved diagnostics consume only parked simulation coordinates',()=>{
 const network=call('online.update').arguments[0];
 assert.equal(property(network,'pose'),'manualPose');
 assert.equal(property(network,'active'),'active&&!locationFollowing');
 const activity=call('activities?.update').arguments[1];
 for(const name of ['x','y','z'])assert.equal(property(activity,name),'manualPose.'+name);
 assert.equal(property(activity,'speedMps'),'manualPose.speed');
 const profile=call('rideProfile?.sample').arguments;
 assert.deepEqual(profile.slice(6,9).map(a=>a.getText(ast)),['manualPose.x','manualPose.z','manualPose.speed']);
 assert.equal(profile[9].getText(ast),'profilePlace');
 assert.match(profile[10].getText(ast),/!locationFollowing/);
 assert.match(source,/if\(!locationFollowing\)profilePlace=/,'GPS-derived landmark names do not persist in a later diagnostic frame');
 assert.ok(source.indexOf('const manualPose=pose')<source.indexOf('locationPresentation.update('));
 assert.ok(source.indexOf('trials?.update(')<source.indexOf('locationPresentation.update('));
});

test('follow guard rejects every conflicting mode, pending room joins and non-walkable fixes',()=>{
 const declaration=ast.statements.flatMap(function collect(n:ts.Node):ts.FunctionDeclaration[]{return ts.isFunctionDeclaration(n)&&n.name?.text==='canFollowLocation'?[n]:n.getChildren(ast).flatMap(collect);})[0];
 assert.ok(declaration?.body);
 const body=declaration.body.getText(ast);
 const context:Record<string,unknown>={locationMapMatches:true,active:true,paused:false,scenePreparing:false,
  online:{online:false,sessionActive:false},locationGroundAvailable:()=>true};
 const modes=['vr','coop','race','trials','activities','fishing','golf','slide','hover','boat','photo'];
 for(const mode of modes)context[mode]={active:false,riding:false};
 const run=vm.runInNewContext('(function(fix)'+body+')',context) as (fix:{x:number;z:number})=>string|null;
 const fix={x:1200,z:400};assert.equal(run(fix),null);
 for(const mode of modes){context[mode]={active:true,riding:true};assert.equal(typeof run(fix),'string',mode);context[mode]={active:false,riding:false};}
 context.online={online:false,sessionActive:true};assert.match(run(fix)!,/multiplayer/);context.online={sessionActive:false};
 for(const mode of ['paused','scenePreparing']){context[mode]=true;assert.equal(typeof run(fix),'string');context[mode]=false;}
 context.active=false;assert.equal(typeof run(fix),'string');context.active=true;
 context.locationGroundAvailable=()=>false;assert.match(run(fix)!,/ground/);context.locationGroundAvailable=()=>true;
 context.locationMapMatches=false;assert.match(run(fix)!,/coordinate/);
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

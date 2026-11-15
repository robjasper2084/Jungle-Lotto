import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {batchRigidChildren} from '../coop/batchRigid.ts';
import {isCockpitPresentationMesh,cockpitPresentationState} from './cockpitPresentation.ts';

test('cockpit dashboard and control descendants stay attached after rigid batching',()=>{
 const root=new T.Group(),cockpit=new T.Group();
 cockpit.name='CTRL_Cockpit';root.add(cockpit);
 const material=new T.MeshStandardMaterial();
 const screen=new T.Mesh(new T.PlaneGeometry(1,1),material);
 screen.name='Dash_Dynamic_Surface';cockpit.add(screen);
 const shell=new T.Mesh(new T.BoxGeometry(),material);shell.name='Cockpit_SideWall';cockpit.add(shell);
 const controls=new T.Mesh(new T.BoxGeometry(),material);controls.name='StirrupPlate_L';cockpit.add(controls);
 const far=new T.Group();root.add(far);
 const staticMeshes=[new T.Mesh(new T.BoxGeometry(),material),new T.Mesh(new T.BoxGeometry(),material)];
 staticMeshes.forEach(m=>far.add(m));
 const result=batchRigidChildren(root,new Set(),m=>isCockpitPresentationMesh(m,root));
 assert.equal(result.before,2);
 assert.equal(result.after,1);
 assert.equal(screen.parent,cockpit);assert.equal(shell.parent,cockpit);
 assert.equal(controls.parent,cockpit);
 assert.equal(root.getObjectByName('Dash_Dynamic_Surface'),screen);
 const camera=new T.PerspectiveCamera();
 assert.deepEqual(cockpitPresentationState(root,camera),{attached:true,visible:true,compatible:true});
 result.dispose();
});

test('diagnostics distinguish hidden cockpit and wrong camera layers without altering them',()=>{
 const root=new T.Group(),cockpit=new T.Group();
 cockpit.name='CTRL_Cockpit';root.add(cockpit);
 const display=new T.Mesh(new T.PlaneGeometry(),new T.MeshBasicMaterial());
 display.name='Dash_Dynamic_Surface';cockpit.add(display);
 const camera=new T.PerspectiveCamera();
 assert.equal(cockpitPresentationState(root,camera).visible,true);
 cockpit.visible=false;
 assert.equal(cockpitPresentationState(root,camera).visible,false);
 assert.equal(cockpit.visible,false);
 cockpit.visible=true;display.layers.set(3);
 assert.equal(cockpitPresentationState(root,camera).compatible,false);
 assert.equal(display.layers.mask,8);
 display.removeFromParent();
 assert.equal(cockpitPresentationState(root,camera).attached,false);
});

test('unknown custom cockpit shader and hidden mesh cannot be batched inadvertently',()=>{
 const root=new T.Group(),cockpit=new T.Group();
 root.add(cockpit);cockpit.name='Cockpit_InstrumentPanel';
 const mat=new T.MeshBasicMaterial();
 for(let i=0;i<3;i++){const part=new T.Mesh(new T.BoxGeometry(),mat);cockpit.add(part);}
 assert.equal(batchRigidChildren(root,new Set(),mesh=>isCockpitPresentationMesh(mesh,root)).before,0);
 assert.equal(cockpit.children.length,3);
});

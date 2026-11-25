import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {ParkTerrain,type ParkMap} from './terrain.ts';
import {bridgeSolid,bridgeDeck} from './flightCollision.ts';
import {PICTURE_BRIDGE_SIDE,PICTURE_BRIDGE_DEPTH,PICTURE_BRIDGE_HEIGHT,PICTURE_BRIDGE_LEGACY,PICTURE_BRIDGE_NAME,planPictureBalustrade,pictureStoneArch,stagePictureBalustrade} from './macArthurPictureBalustrade.ts';
const map=JSON.parse(readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8')) as ParkMap;
test('every stone railing span follows the real bridge within existing collision limits',()=>{
 const panels=planPictureBalustrade(map.bridge),terrain=new ParkTerrain(map,true);
 assert(panels.length>220&&panels.length<350&&panels.length%2===0);
 assert(PICTURE_BRIDGE_SIDE-PICTURE_BRIDGE_DEPTH/2>=11.8);
 assert(PICTURE_BRIDGE_SIDE+PICTURE_BRIDGE_DEPTH/2<=13);
 assert(PICTURE_BRIDGE_HEIGHT+.02<=1.6);
 for(const p of panels){
  const deck=bridgeDeck(map,p.x,p.z);
  assert(Math.abs(Math.abs(deck.side)-PICTURE_BRIDGE_SIDE)<.00001);
  assert(terrain.bridge(p.x,p.z).active);
  assert(bridgeSolid(map,{x:p.x,y:p.y+PICTURE_BRIDGE_HEIGHT*.6,z:p.z}));
  assert(p.s>0&&p.s<map.bridge.length);
 }
});
test('stone railing has a physically open arch, not opaque painted holes',()=>{
 const step=map.bridge.length/Math.ceil(map.bridge.length/5.2),g=pictureStoneArch(step);
 const mesh=new T.Mesh(g,new T.MeshStandardMaterial({side:T.DoubleSide})),ray=new T.Raycaster();
 ray.set(new T.Vector3(0,.5,-3),new T.Vector3(0,0,1));
 assert.equal(ray.intersectObject(mesh).length,0,'actual open arch');
 ray.set(new T.Vector3(step*.48,.5,-3),new T.Vector3(0,0,1));
 assert(ray.intersectObject(mesh).length>0,'solid supporting post');
 g.dispose();(mesh.material as T.Material).dispose();
});
test('preview exclusively hides the original bridge rail and can safely rollback',()=>{
 const scene=new T.Scene(),root=new T.Group(),original=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial());
 original.name=PICTURE_BRIDGE_LEGACY;original.castShadow=true;root.add(original);scene.add(root);
 const source=JSON.stringify(map.bridge),study=stagePictureBalustrade(scene,map.bridge,root);
 assert.equal(study.group.name,PICTURE_BRIDGE_NAME);
 assert.equal(study.meshes,2);assert(!original.visible&&original.userData.staticSprayReplaced);
 assert(study.group.children.every(x=>x instanceof T.InstancedMesh&&x.castShadow));
 assert.equal(study.collisionChanged,false);assert.equal(JSON.stringify(map.bridge),source);
 study.rollback();
 assert(original.visible&&original.castShadow);assert(!original.userData.staticSprayReplaced);
 assert(!study.group.parent);original.geometry.dispose();(original.material as T.Material).dispose();
});
test('missing original mesh fails closed before generating duplicate railing visuals',()=>{
 const scene=new T.Scene(),root=new T.Group();scene.add(root);
 assert.throws(()=>stagePictureBalustrade(scene,map.bridge,root),/unavailable/);
 assert.equal(scene.children.length,1);
 assert.throws(()=>planPictureBalustrade({...map.bridge,length:44}),/geometry changed/);
});

test('real game bridge control is optional and outside the unchanged MacArthur shadow input fixture',()=>{
 const source=readFileSync(new URL('./world.ts',import.meta.url),'utf8');
 const html=readFileSync(new URL('../../index.html',import.meta.url),'utf8');
 const main=readFileSync(new URL('./main.ts',import.meta.url),'utf8');
 assert.match(html,/id="bridge-stone-style" type="checkbox"/);
 assert.match(main,/setPictureBridgeEnabled\(bridgeStyleToggle.checked\)/);
 assert.match(source,/bridgePictureStudy\?\.rollback\(\)/);
 const from=source.indexOf('scene.add(landmarks.scene);const bridgePhotoFinish=');
 const to=source.indexOf(' // Remove only the old solid Yacht Club shell',from);
 assert(from>=0&&to>from);
 assert(!source.slice(from,to).includes('import.meta'));
 assert(source.indexOf('let bridgePictureStudy')>to);
});

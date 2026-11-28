import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {WebGLLights} from 'three/src/renderers/webgl/WebGLLights.js';
import {createSourceLighting} from '../src/sourceLighting.ts';
import {SWOOP_TO_BELLE_MATRIX,SWOOP_MAP_ORIGIN,fromSourceMap} from '../src/geo.ts';

const close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const pointLights=(root:T.Object3D)=>root.children.filter((object):object is T.PointLight=>(object as T.PointLight).isPointLight===true);
const properties=(light:T.Light)=>({mask:light.layers.mask,visible:light.visible,intensity:light.intensity,color:light.color.getHex(),position:light.position.toArray(),parent:light.parent});

function fixture(){
  const scene=new T.Scene(),root=new T.Scene(),mapRoot=new T.Group(),room=new T.Group(),hidden=new T.Group();
  root.matrix.fromArray(SWOOP_TO_BELLE_MATRIX);root.matrixAutoUpdate=false;scene.add(root);
  mapRoot.scale.x=-1;mapRoot.position.set(SWOOP_MAP_ORIGIN.x,-SWOOP_MAP_ORIGIN.y,-SWOOP_MAP_ORIGIN.z);root.add(mapRoot);mapRoot.add(room,hidden);hidden.visible=false;
  const colors=[0xff0000,0x00ff00,0x0000ff,0xffff00,0xff00ff,0x00ffff];
  const emitters=colors.map((color,index)=>{const light=new T.PointLight(color,20+index,100,1.5+index/10);light.position.set(2600+index*12,3,-1500);room.add(light);return light;});
  const hiddenLight=new T.PointLight(0xf0a061,1000,100);hiddenLight.position.set(2600.1,3,-1500);hidden.add(hiddenLight);
  const otherLayer=new T.PointLight(0x113355,1000,100);otherLayer.position.copy(hiddenLight.position);otherLayer.layers.set(2);room.add(otherLayer);
  const hostPoint=new T.PointLight(0xaabbcc,13,17),hostSpot=new T.SpotLight(0xfedcba,0,30);
  hostPoint.position.set(4,5,6);hostPoint.castShadow=true;scene.add(hostPoint,hostSpot,hostSpot.target);
  const cameraAt=(x:number)=>{const camera=new T.PerspectiveCamera();const p=fromSourceMap(x,3,-1500);camera.position.set(p.x,p.y,p.z);camera.updateMatrixWorld(true);return camera;};
  return {scene,root,mapRoot,room,hidden,emitters,hiddenLight,otherLayer,hostPoint,hostSpot,cameraA:cameraAt(2600),cameraB:cameraAt(2660)};
}

/** Match Three's visible/layer traversal, then exercise its real uniform builder.
 * Zero-intensity lights still count unless excluded before this collection. */
function rendered(scene:T.Scene,camera:T.Camera){
  scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
  scene.onBeforeRender({} as T.WebGLRenderer,scene,camera,null);
  const lights:T.Light[]=[];
  scene.traverseVisible(object=>{if((object as T.Light).isLight&&object.layers.test(camera.layers))lights.push(object as T.Light);});
  const uniforms=WebGLLights({has:()=>false,get:()=>null});
  uniforms.setup(lights);uniforms.setupView(lights,camera);
  return {lights,state:uniforms.state};
}

function assertSelection(root:T.Scene,expected:T.PointLight[]){
  const pool=pointLights(root);assert.equal(pool.length,4);
  for(const [index,copy]of pool.entries()){
    const source=expected[index],actual=copy.getWorldPosition(new T.Vector3()),wanted=source.getWorldPosition(new T.Vector3());
    close(actual.x,wanted.x);close(actual.y,wanted.y);close(actual.z,wanted.z);
    assert.equal(copy.color.getHex(),source.color.getHex());assert.equal(copy.intensity,source.intensity);assert.equal(copy.distance,source.distance);assert.equal(copy.decay,source.decay);
  }
}

test('actual source budget selects four eligible lights in the transformed world and leaves host lights intact',()=>{
  const f=fixture(),hostPoint=properties(f.hostPoint),hostSpot=properties(f.hostSpot),lighting=createSourceLighting(f.scene,f.root);
  try{
    lighting.setActive(true);
    const {lights,state}=rendered(f.scene,f.cameraA);
    assertSelection(f.root,f.emitters.slice(0,4));
    assert.equal(state.point.length,5,'four source slots plus the original host point light');
    assert.equal(state.spot.length,1,'even the zero-intensity native host spot stays unchanged');
    assert.ok(lights.includes(f.hostPoint)&&lights.includes(f.hostSpot));
    assert.ok(!lights.includes(f.hiddenLight)&&!lights.includes(f.otherLayer));
    for(const emitter of f.emitters)assert.equal(emitter.layers.mask,0,'source emitters are represented by the original budget pool');
    assert.deepEqual(properties(f.hostPoint),hostPoint);assert.deepEqual(properties(f.hostSpot),hostSpot);
    f.room.visible=false;
    const localBefore=pointLights(f.root).map(light=>light.position.toArray());
    assert.equal(rendered(f.scene,f.cameraB).state.point.length,5,'empty slots keep the same source shader layout');
    rendered(f.scene,f.cameraB);
    assert.ok(pointLights(f.root).every(light=>light.intensity===0));
    assert.deepEqual(pointLights(f.root).map(light=>light.position.toArray()),localBefore,'empty pool slots must not receive the affine transform repeatedly');
  }finally{lighting.dispose();}
});

test('every actual camera and preparation refresh the source selection after dormant or detached states',()=>{
  const f=fixture();let previousCalls=0;const cameras:T.Camera[]=[];
  f.scene.onBeforeRender=(_renderer,_scene,camera)=>{previousCalls++;cameras.push(camera);};
  const lighting=createSourceLighting(f.scene,f.root);
  try{
    assert.equal(rendered(f.scene,f.cameraA).state.point.length,1,'inactive source contributes no point-light slots');
    lighting.setActive(true);rendered(f.scene,f.cameraA);assertSelection(f.root,f.emitters.slice(0,4));
    rendered(f.scene,f.cameraB);assertSelection(f.root,[f.emitters[5],f.emitters[4],f.emitters[3],f.emitters[2]]);
    assert.deepEqual(cameras,[f.cameraA,f.cameraA,f.cameraB]);assert.equal(previousCalls,3);
    lighting.setActive(false);assert.equal(rendered(f.scene,f.cameraA).state.point.length,1);
    lighting.setActive(true);lighting.prepare(f.cameraB);assertSelection(f.root,[f.emitters[5],f.emitters[4],f.emitters[3],f.emitters[2]]);
    assert.equal(previousCalls,4,'explicit destination preparation does not invoke a second host render hook');
    f.scene.remove(f.root);lighting.prepare(f.cameraA);assert.equal(lighting.diagnostics().visiblePointSlots,0);
    f.scene.add(f.root);lighting.prepare(f.cameraA);assertSelection(f.root,f.emitters.slice(0,4));
  }finally{lighting.dispose();}
});

test('six original source spot pools leave daylight shader arrays and return when their intensity becomes positive',()=>{
  const f=fixture(),spots=Array.from({length:6},()=>new T.SpotLight(0xffdfb1,0,25));
  for(const spot of spots)f.mapRoot.add(spot,spot.target);
  const lighting=createSourceLighting(f.scene,f.root);
  try{
    lighting.registerSpots(f.mapRoot);lighting.setActive(true);
    assert.equal(lighting.diagnostics().spotPools,6);
    assert.equal(rendered(f.scene,f.cameraA).state.spot.length,1,'all six zero-intensity source pools are excluded; host spot remains');
    spots[0].intensity=110;
    assert.equal(rendered(f.scene,f.cameraA).state.spot.length,2);assert.equal(spots[0].visible,true);
    for(const spot of spots)spot.intensity=110;
    assert.equal(rendered(f.scene,f.cameraA).state.spot.length,7,'positive source pools keep their authored light contribution');
    f.mapRoot.visible=false;assert.equal(rendered(f.scene,f.cameraA).state.spot.length,1,'a hidden parent remains authoritative');
    f.mapRoot.visible=true;for(const spot of spots)spot.intensity=0;
    assert.equal(rendered(f.scene,f.cameraA).state.spot.length,1);
    assert.equal(f.hostSpot.visible,true);assert.equal(f.hostSpot.intensity,0);
    assert.throws(()=>lighting.registerSpots(f.scene),/Only imported source/);
  }finally{lighting.dispose();}
  assert.ok(spots.every(spot=>spot.visible),'disposal restores authored spot visibility');
});

test('disposing restores source masks and hooks without removing a later host wrapper',()=>{
  const f=fixture(),hiddenSpot=new T.SpotLight(0xffffff,10);hiddenSpot.visible=false;f.mapRoot.add(hiddenSpot);
  const rootHook=f.root.onBeforeRender;let hostCalls=0,laterCalls=0;
  const hostHook:T.Scene['onBeforeRender']=()=>{hostCalls++;};f.scene.onBeforeRender=hostHook;
  const lighting=createSourceLighting(f.scene,f.root);lighting.registerSpots();lighting.setActive(true);
  rendered(f.scene,f.cameraA);assert.equal(hiddenSpot.visible,false);
  const sourceHook=f.scene.onBeforeRender;
  const laterHook:T.Scene['onBeforeRender']=(...args)=>{laterCalls++;sourceHook.apply(f.scene,args);};f.scene.onBeforeRender=laterHook;
  lighting.dispose();lighting.dispose();
  assert.equal(f.scene.onBeforeRender,laterHook);assert.equal(f.root.onBeforeRender,rootHook);assert.equal(pointLights(f.root).length,0);
  assert.equal(f.otherLayer.layers.mask,4);assert.ok(f.emitters.every(light=>light.layers.mask===1));assert.equal(hiddenSpot.visible,false);
  const late=new T.PointLight();f.room.add(late);assert.equal(late.layers.mask,1,'disposed source listeners cannot capture later lights');
  rendered(f.scene,f.cameraB);assert.equal(hostCalls,2);assert.equal(laterCalls,1);
  const fresh=fixture(),prior=fresh.scene.onBeforeRender,second=createSourceLighting(fresh.scene,fresh.root);second.dispose();assert.equal(fresh.scene.onBeforeRender,prior);
  assert.throws(()=>createSourceLighting(f.scene,f.scene),/isolated district root/);
});

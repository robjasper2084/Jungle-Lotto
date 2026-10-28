import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {CameraRearLcd} from './cameraRearLcd.ts';

function fixture(){
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(),view=new T.Group(),body=new T.Group(),lcd=new CameraRearLcd();
 const world=new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial());world.name='World';scene.background=new T.Color('#123456');
 scene.add(world,view,new T.HemisphereLight());view.add(body);lcd.mount(body,'static');
 const frames:Array<{objects:string[];background:unknown}>=[],copies:T.Texture[]=[];let width=800,height=600;
 const fake={xr:{isPresenting:false},autoClear:true,shadowMap:{autoUpdate:true},
  getDrawingBufferSize(v:T.Vector2){return v.set(width,height);},
  copyFramebufferToTexture(texture:T.Texture){copies.push(texture);},
  render(s:T.Scene,c:T.Camera){const objects:string[]=[];s.traverseVisible(o=>{if(o instanceof T.Mesh&&o.layers.test(c.layers))objects.push(o.name);});frames.push({objects,background:s.background});}};
 return{scene,camera,view,body,lcd,frames,copies,fake,renderer:fake as unknown as T.WebGLRenderer,resize(){width=400;height=800;}};
}
test('rear LCD captures the world before the camera is drawn, without redrawing world geometry',()=>{
 const f=fixture();f.lcd.render(f.renderer,f.scene,f.camera,f.view,0);
 assert.deepEqual(f.frames[0].objects,['World']);assert.ok(f.frames[0].background);
 assert.ok(f.frames[1].objects.includes('Camera rear LCD glass'));assert.ok(!f.frames[1].objects.includes('World'));assert.equal(f.frames[1].background,null);
 assert.equal(f.copies.length,1);assert.equal(f.camera.layers.mask,1);assert.equal(f.fake.autoClear,true);assert.equal(f.fake.shadowMap.autoUpdate,true);
 f.lcd.render(f.renderer,f.scene,f.camera,f.view,16,true);assert.equal(f.copies.length,1);
 f.lcd.render(f.renderer,f.scene,f.camera,f.view,70,true);assert.equal(f.copies.length,2);assert.equal(f.lcd.status.refreshHz,15);f.lcd.dispose();
});
test('hidden hands and VR render normally without allocating or copying an LCD image',()=>{
 const f=fixture();f.view.visible=false;f.lcd.render(f.renderer,f.scene,f.camera,f.view,0);assert.equal(f.frames.length,1);assert.equal(f.copies.length,0);assert.equal(f.lcd.status.width,0);
 f.view.visible=true;f.fake.xr.isPresenting=true;f.lcd.render(f.renderer,f.scene,f.camera,f.view,100);assert.equal(f.copies.length,0);f.lcd.dispose();
});
test('LCD releases resized image memory and follows the selected camera body',()=>{
 const f=fixture();f.lcd.render(f.renderer,f.scene,f.camera,f.view,0);let disposed=0;f.copies[0].addEventListener('dispose',()=>disposed++);
 f.resize();f.lcd.render(f.renderer,f.scene,f.camera,f.view,100);assert.equal(disposed,1);assert.equal(f.lcd.status.width,400);assert.equal(f.lcd.status.height,800);
 const replacement=new T.Group();f.lcd.mount(replacement,'bass');assert.equal(f.lcd.root.parent,replacement);assert.equal(f.body.children.length,0);
 f.copies[1].addEventListener('dispose',()=>disposed++);f.lcd.dispose();assert.equal(disposed,2);assert.equal(replacement.children.length,0);
});
test('a failed view-model submission restores camera layers, lighting and renderer state',()=>{
 const f=fixture(),background=f.scene.background,render=f.fake.render;let calls=0;
 f.fake.render=(s,c)=>{if(++calls===2)throw Error('GPU reset');render(s,c);};
 assert.throws(()=>f.lcd.render(f.renderer,f.scene,f.camera,f.view,0),/GPU reset/);
 assert.equal(f.view.visible,true);assert.equal(f.camera.layers.mask,1);assert.equal(f.scene.background,background);assert.equal(f.fake.autoClear,true);assert.equal(f.fake.shadowMap.autoUpdate,true);
 assert.equal(f.scene.children.find(o=>o instanceof T.Light)?.layers.mask,1);f.lcd.dispose();
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isSafeStartup,safeStartupUrl} from './safeStartup.ts';
import {startupAntialias,startupTextureBudget} from './graphicsQuality.ts';
import {startupAntialias as elmwoodAntialias,startupTextureBudget as elmwoodTextures} from '../../../elmwood-source/src/detroit/sharedGraphicsQuality.ts';
test('recovery links preserve the game, invitation and fragment',()=>{
 const url=safeStartupUrl('https://example.org/royale.html?invite=abc#menu');
 assert.equal(url,'https://example.org/royale.html?invite=abc&safe=1#menu');
 assert.equal(isSafeStartup(new URL(url).search),true);
 assert.equal(isSafeStartup('?safe=0'),false);
});
test('recovery bypasses saved Ultra and texture/MSAA overrides without erasing preferences',t=>{
 const saved={location:Object.getOwnPropertyDescriptor(globalThis,'location'),localStorage:Object.getOwnPropertyDescriptor(globalThis,'localStorage')};
 let writes=0;
 Object.defineProperty(globalThis,'location',{configurable:true,value:{search:'?safe=1'}});
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>key==='swoop-graphics-quality'?'ultra':'{"textureSize":4096,"aa":"on"}',setItem:()=>writes++}});
 t.after(()=>{for(const [key,descriptor] of Object.entries(saved)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}});
 assert.equal(startupAntialias(),false);
 assert.equal(startupTextureBudget().maxSize,512);
 assert.equal(elmwoodAntialias(),false);assert.equal(elmwoodTextures().maxSize,512);
 assert.equal(writes,0);
});

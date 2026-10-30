import {registerHooks} from 'node:module';
import {ridecoreAliases} from './local-ridecore-alias.mjs';
import {pathToFileURL} from 'node:url';
const dependency=new URL('../ride-core/node_modules/',import.meta.url);
// Use the same genuine package versions and source checkout as the Vite builds.
// Preserve the browser's cryptographic RNG for Rapier's broad phase.
registerHooks({
 resolve(specifier,ctx,next){
  const core=ridecoreAliases.find(a=>a.find===specifier);
  if(core)return{url:pathToFileURL(core.replacement).href,shortCircuit:true};
  if(specifier==='@dimforge/rapier3d-compat')return{url:new URL('@dimforge/rapier3d-compat/dist/rapier.mjs',dependency).href,shortCircuit:true};
  if(specifier==='three')return{url:new URL('three/build/three.module.js',dependency).href,shortCircuit:true};
  if(specifier.startsWith('three/addons/'))return{url:new URL('three/examples/jsm/'+specifier.slice(13),dependency).href,shortCircuit:true};
  return next(specifier,ctx);
 },
 load(url,ctx,next){
  if(url.endsWith('.css'))return{format:'module',source:'export default {};',shortCircuit:true};
  if(/\.(webp|png|jpe?g|hdr)(\?.*)?$/.test(url))return{format:'module',source:'export default '+JSON.stringify(url)+';',shortCircuit:true};
  return next(url,ctx);
 }
});
globalThis.window=Object.assign(new EventTarget(),{crypto:globalThis.crypto,performance:globalThis.performance});

import {registerHooks} from 'node:module';
// Headless geometry tests omit CSS only; no game code or skeleton is substituted.
registerHooks({load(url,ctx,next){return url.endsWith('.css')?{format:'module',source:'export default {};',shortCircuit:true}:next(url,ctx);}});
globalThis.window=new EventTarget();

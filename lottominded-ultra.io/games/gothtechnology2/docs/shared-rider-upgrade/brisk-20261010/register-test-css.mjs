import {registerHooks} from 'node:module';
// Rig-only Node tests do not render CSS. Leave every code/asset import intact.
registerHooks({load(url,context,next){if(url.endsWith('.css'))return{format:'module',source:'export default "";',shortCircuit:true};return next(url,context);}});

import {registerHooks} from 'node:module';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {previewRoot,gameRoot} from './paths.mjs';

// Production source remains outside this private package. Resolve its external
// packages against the preview installation, without a repository-root symlink
// or edits to any game's dependency declarations.
const packageParent=pathToFileURL(resolve(previewRoot,'package.json')).href;
const sharedCore=pathToFileURL(resolve(gameRoot,'ride-core/src/index.ts')).href;
const dependencies=/^(?:three|fflate|polygon-clipping|@dimforge\/rapier3d-compat|@supabase\/realtime-js)(?:\/|$)/;
registerHooks({
  resolve(specifier,context,nextResolve){
    if(specifier==='@digital-static/ridecore')return {url:sharedCore,shortCircuit:true};
    if(specifier==='@digital-static/ridecore/cycling-view')return {url:pathToFileURL(resolve(gameRoot,'ride-core/src/cyclingView.ts')).href,shortCircuit:true};
    if(dependencies.test(specifier))return nextResolve(specifier,{...context,parentURL:packageParent});
    return nextResolve(specifier,context);
  },
});

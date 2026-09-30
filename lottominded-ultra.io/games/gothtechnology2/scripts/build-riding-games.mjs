import {resolve} from 'node:path';
import {prepareSwoop} from './build-swoop-detroit.mjs';
import {prepareElmwood} from './build-elmwood-explorer.mjs';
import {buildRelease} from './game-package.mjs';

// Preflight BOTH sources and their asset/license dependencies before staging either build.
const swoop=await prepareSwoop(),plans=[swoop,await prepareElmwood(undefined,swoop.soundtrackRoot)];
if(process.argv.includes('--preflight'))console.log('Both game preflights passed');
else await buildRelease(resolve(import.meta.dirname,'..'),plans);

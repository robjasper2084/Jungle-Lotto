import {failBoot} from './bootUi.ts';
// Keep the HTML menu and retry panel usable when a chunk or WebGL cannot load.
try{await import('./main.ts');}catch(error){failBoot(error,/WebGL|graphics context/i.test(String(error)));}

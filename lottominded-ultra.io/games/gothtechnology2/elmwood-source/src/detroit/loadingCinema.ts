import {cinematicStartup} from '../../../cinematic-ui/src/cinematicStartup.ts';
let first=true,current:ReturnType<typeof cinematicStartup>|undefined;
export function loadingCinema(){const startup=first;first=false;return current=cinematicStartup('elmwood',startup);}
export function failLoading(error:unknown){
 (current??loadingCinema()).fail('Elmwood could not load. '+(error instanceof Error?error.message:String(error)));
 console.error('Elmwood initialization failed',error);
}

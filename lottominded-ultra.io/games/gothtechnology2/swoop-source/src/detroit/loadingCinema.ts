import {cinematicStartup} from '../../../cinematic-ui/src/cinematicStartup.ts';
let first=true;
export function loadingCinema(){const startup=first;first=false;return cinematicStartup('swoop',startup);}

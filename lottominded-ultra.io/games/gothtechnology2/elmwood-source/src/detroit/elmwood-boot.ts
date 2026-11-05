import {failLoading} from './loadingCinema.ts';
try{await import('./elmwood.ts');}catch(error){failLoading(error);}

import './startup.ts';
import {failStartup} from './startupFailure.ts';
try{await import('./main.ts');}catch(error){failStartup(error);}

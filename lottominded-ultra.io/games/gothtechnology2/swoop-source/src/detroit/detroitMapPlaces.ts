import {CITY,CUT_METRES,pointOnCut} from './geography.ts';
import {northUp} from './routeMap.ts';
import {MACK_STUDIO} from './mackStudioSite.ts';
import {pennyMap} from './pennyShopSite.ts';
import {MILLIKEN_BERM} from './millikenTerrain.ts';
import {JAZZ_CLUBS} from './jazzSites.ts';
const cut=pointOnCut(0),mack=pointOnCut(CUT_METRES),penny=pennyMap(0,0);
export const DETROIT_MAP_PLACES=[
 {point:northUp(cut.x,cut.z),text:'Cut entrance / Atwater'},
 {point:northUp(MILLIKEN_BERM.x,MILLIKEN_BERM.z),text:'Ze Mound / Milliken Park'},
 {point:northUp(mack.x,mack.z),text:'Mack Avenue'},
 {point:northUp(MACK_STUDIO.x,MACK_STUDIO.z),text:'GothTech / Serengeti Galleries'},
 {point:northUp(penny.x,penny.z),text:'Penny Exchange / LottoMind'},
 ...CITY.crossings.map(r=>{const p=pointOnCut(r.at);return{point:northUp(p.x,p.z),text:r.name};}),
 ...JAZZ_CLUBS.map(p=>({point:northUp(p.x,p.z),text:p.name})),
 {point:northUp(-95,-1385),text:'Milliken Harbor docks'},
 {point:northUp(-250,-1750),text:'The Aretha / Chene Park'},
 {point:northUp(-131,-1799.4),text:'Valade Park / The Shed'}
];

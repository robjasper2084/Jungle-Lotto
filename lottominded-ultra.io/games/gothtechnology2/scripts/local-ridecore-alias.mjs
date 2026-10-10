import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
// Exact export aliases keep both packaged games on this repository's compiled
// RideCore, even when an older node_modules junction points to another checkout.
const root=resolve(import.meta.dirname,'../ride-core');
const pkg=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'));
export const ridecoreAliases=Object.entries(pkg.exports).map(([key,value])=>({
 find:'@digital-static/ridecore'+(key==='.'?'':key.slice(1)),
 replacement:resolve(root,value.import),
})).sort((a,b)=>b.find.length-a.find.length);

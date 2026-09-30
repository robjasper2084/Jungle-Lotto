import fs from 'node:fs';
import {ElmwoodTerrain} from '../src/detroit/elmwood-terrain.ts';
const root=new URL('../',import.meta.url),read=p=>JSON.parse(fs.readFileSync(new URL(p,root),'utf8'));
const write=(p,v)=>fs.writeFileSync(new URL(p,root),JSON.stringify(v));
const asset=read('art/elmwood/hdrp-lab-car/conversion.json');
const assets=read('public/elmwood/asset-manifest.json').filter(a=>!a.id.startsWith('chrysler-')&&a.id!==asset.id);
assets.push(asset);write('public/elmwood/asset-manifest.json',assets);
const placements=read('public/elmwood/placements.json');
const terrain=new ElmwoodTerrain(read('public/elmwood/terrain.json'),read('public/elmwood/site.json').features,placements);
for(const p of placements.filter(p=>p.addition?.startsWith('user-parked-car-'))){
 const [x,n]=p.position,c=Math.cos(p.rotation),s=Math.sin(p.rotation),wb=asset.wheelbaseM/2,track=.82;
 const height=(u,v)=>terrain.surfaceGround(x+c*u+s*v,n+s*u-c*v)+(p.addition.endsWith('gatehouse')?.046:0);
 const f=(height(-track,wb)+height(track,wb))/2,b=(height(-track,-wb)+height(track,-wb))/2;
 const r=(height(track,wb)+height(track,-wb))/2,l=(height(-track,wb)+height(-track,-wb))/2;
 p.asset=asset.id;p.position[2]=(f+b)/2;p.pitch=-Math.atan2(f-b,wb*2);p.roll=Math.atan2(r-l,track*2);
 p.footprint=asset.dimensionsM;p.confidence='User-requested black HDRP Lab coupe. Preserved approved '+(p.addition.endsWith('lane')?'Davis/Schmidt lane verge':'gatehouse parking bay')+' position; four tyre heights refitted to terrain.';
}
write('public/elmwood/placements.json',placements);
console.log('Updated two parked cars',placements.filter(p=>p.asset===asset.id).map(p=>p.addition));

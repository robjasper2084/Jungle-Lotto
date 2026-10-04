import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';
import {TagTerrain} from '@digital-static/ridecore/tag';
import {LOTTO_SHOP,lottoMap} from '../../swoop-source/src/detroit/lottoShopSite.ts';
import {toLocal} from '../../swoop-source/src/detroit/geo-profile.ts';
const f=JSON.parse(await readFile(new URL('../fixtures/swoop-detroit.json',import.meta.url),'utf8')),terrain=await TagTerrain.create(f),evidence=[];
const point=(u,v)=>{const p=lottoMap(u,v);return toLocal(p.x,LOTTO_SHOP.floor+1.05,p.z);};
for(const [name,a,b,blocked]of [
 ['LottoMind side wall',point(5.5,6),point(7.8,6),true],
 ['LottoMind front central entrance',point(0,11),point(0,8),false],
 ['LottoMind street entrance',point(-4.35,-11),point(-4.35,-8),false],
]){const d={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z},hit=terrain.raycastObstacle(a,d,Math.hypot(d.x,d.y,d.z),.14);assert.equal(hit!==null,blocked,name);evidence.push({name,blocked,hit});}
terrain.dispose();await writeFile(new URL('../../docs/love-tag/evidence/store-cover-20261004.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),hash:f.hash,kind:'actual exported source geometry; no browser evidence',evidence},null,2));console.log(JSON.stringify(evidence));

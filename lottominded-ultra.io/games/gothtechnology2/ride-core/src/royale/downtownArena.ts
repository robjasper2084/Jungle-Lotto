import {AuthoredArena} from './authoredArena.ts';
import type {BattleTerrain} from './battleTerrain.ts';
import type {TagTerrain} from '../tag/fixture.ts';
import type {Vec3} from '../terrain.ts';
import {DOWNTOWN_FIELD_REVISION,downtownExtent,downtownRadii} from './downtownField.ts';
import {scopeSites} from './scopes.ts';
const distance=(a:Vec3,b:Vec3)=>Math.hypot(a.x-b.x,a.z-b.z);
/** One shared district on the original Detroit map. The entire original map
 * remains scenery/collision; the field bounds the six-minute match, not walls. */
export class DowntownArena extends AuthoredArena implements BattleTerrain {
 readonly spawns;readonly zones;readonly supplies:Vec3[]=[];readonly optics;readonly arenaIdentity;readonly fieldRadii;
 constructor(terrain:TagTerrain){
  super(terrain);
  if(terrain.fixture.product!=='swoop-detroit')throw Error('Royale requires the shared Detroit map.');
  // Original Atwater Street / Renaissance Center starting area, source metres.
  const t=terrain.fixture.transform,anchor={x:(-72.5-t.tx)/t.sx,y:-t.ty,z:-1180-t.tz};
  const center=this.layout.nodes.reduce((a,b)=>distance(b,anchor)<distance(a,anchor)?b:a);
  const sites=this.layout.nodes.filter(p=>distance(p,center)<225);
  const extent=downtownExtent(t);
  const midpoint={x:(extent[0].x+extent[3].x)/2,y:center.y,z:(extent[0].z+extent[3].z)/2};
  const fieldCenter=this.layout.nodes.reduce((a,b)=>distance(b,midpoint)<distance(a,midpoint)?b:a);
  const zones=[fieldCenter];
  for(const p of [...this.layout.nodes].sort((a,b)=>distance(a,fieldCenter)-distance(b,fieldCenter)))
   if(zones.length<5&&distance(p,fieldCenter)<50&&zones.every(z=>distance(p,z)>10))zones.push(p);
  if(zones.length!==5)throw Error('Detroit district needs five reachable field centers.');
  this.zones=zones;
  this.fieldRadii=downtownRadii(zones,extent);
  const starts=[center];
  while(starts.length<10){
   const next=sites.reduce((a,b)=>Math.min(...starts.map(s=>distance(s,b)))>Math.min(...starts.map(s=>distance(s,a)))?b:a);
   if(starts.some(s=>distance(s,next)<30))throw Error('Detroit district cannot fit ten safe starts.');
   starts.push(next);
  }
  this.spawns=starts.map(p=>({position:{...p},headingY:distance(p,center)<1?-0.075:Math.atan2(center.x-p.x,center.z-p.z)}));
  for(const start of starts){
   const near=sites.filter(p=>distance(p,start)>8&&distance(p,start)<35).sort((a,b)=>distance(a,start)-distance(b,start));
   let count=0;for(const p of near)if(this.supplies.every(q=>distance(p,q)>5)){this.supplies.push({...p});if(++count===2)break;}
   if(count!==2)throw Error('Detroit start needs two clear supply sites.');
  }
  // Spread reachable weapon and utility stops across the full connected city.
  for(const p of this.layout.nodes)if(this.supplies.length<260&&this.supplies.every(q=>distance(p,q)>50))this.supplies.push({...p});
  this.optics=scopeSites(this.layout.nodes,this.spawns,fieldCenter,Math.min(...this.zones.map(z=>this.fieldRadii[0]-distance(z,fieldCenter))));
  this.arenaIdentity={...this.handshake,arena:DOWNTOWN_FIELD_REVISION};
 }
}


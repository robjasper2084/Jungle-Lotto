/** Intersection locations are City of Detroit GIS observations. Pole positions,
 * fixture counts and the signal cycle below are modeled game details, not a
 * survey of individual traffic heads or a connection to live city signals. */
export const JEFFERSON_SIGNAL_SOURCE='https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Traffic_Signals/FeatureServer/0';
export const JEFFERSON_SIGNAL_RETRIEVED='2026-11-27';
export type SignalPoint=readonly [number,number];
export type JeffersonSignalSource=Readonly<{objectId:number;intersectionId:number;name:string;crossNames:readonly string[];longitude:number;latitude:number;electrical:'Signal'|'Signal-ITS'}>;
export const JEFFERSON_SIGNAL_INVENTORY:readonly JeffersonSignalSource[]=Object.freeze([
 {objectId:214,intersectionId:233,name:'East Grand Boulevard',crossNames:['grand'],longitude:-83.0015752696423,latitude:42.3470310199068,electrical:'Signal-ITS'},
 {objectId:220,intersectionId:240,name:'Mount Elliott',crossNames:['mount elliott','mt elliott'],longitude:-83.0100385474171,latitude:42.343649961138,electrical:'Signal-ITS'},
 {objectId:418,intersectionId:498,name:'McDougall / Walker',crossNames:['mcdougall','walker'],longitude:-83.0163418853904,latitude:42.3409393120657,electrical:'Signal-ITS'},
 {objectId:417,intersectionId:497,name:'Joseph Campau',crossNames:['joseph campau','jos campau'],longitude:-83.0197333942429,latitude:42.339480142516,electrical:'Signal-ITS'},
 {objectId:413,intersectionId:493,name:'Chene',crossNames:['chene'],longitude:-83.0226335143685,latitude:42.3382354730666,electrical:'Signal-ITS'},
 {objectId:416,intersectionId:496,name:'Dubois',crossNames:['dubois'],longitude:-83.0245736434995,latitude:42.3373960428219,electrical:'Signal-ITS'},
 {objectId:420,intersectionId:500,name:'Saint Aubin',crossNames:['saint aubin','st aubin'],longitude:-83.0277915918715,latitude:42.336010823504,electrical:'Signal-ITS'},
 {objectId:419,intersectionId:499,name:'Rivard',crossNames:['rivard'],longitude:-83.0341597308688,latitude:42.3332771735863,electrical:'Signal-ITS'},
 {objectId:414,intersectionId:494,name:'Chrysler Freeway east service drive',crossNames:['chrysler'],longitude:-83.0353836905429,latitude:42.3325566344419,electrical:'Signal-ITS'},
 {objectId:415,intersectionId:495,name:'Chrysler Freeway west service drive',crossNames:['chrysler'],longitude:-83.0361958802728,latitude:42.3323271845424,electrical:'Signal-ITS'},
 {objectId:1207,intersectionId:211101005,name:'Brush',crossNames:['brush'],longitude:-83.0408489095796,latitude:42.3300699956768,electrical:'Signal'},
 {objectId:1205,intersectionId:211101003,name:'Randolph',crossNames:['randolph'],longitude:-83.0418413885919,latitude:42.3296474555089,electrical:'Signal'},
 {objectId:1204,intersectionId:211101002,name:'Woodward',crossNames:['woodward'],longitude:-83.0444360375074,latitude:42.328507295221,electrical:'Signal'},
].map(s=>Object.freeze({...s,crossNames:Object.freeze(s.crossNames)}) as JeffersonSignalSource));

export function projectJeffersonSignal(longitude:number,latitude:number):[number,number]{
 return [+(111320*Math.cos(42.34680*Math.PI/180)*(longitude+83.00175)).toFixed(2),+(-111320*(latitude-42.34680)).toFixed(2)];
}
export type SignalAspect='red'|'amber'|'green';
export type SignalPhase=Readonly<{key:number;jefferson:SignalAspect;cross:SignalAspect}>;
const PHASES:readonly SignalPhase[]=Object.freeze([
 Object.freeze({key:0,jefferson:'green',cross:'red'}),
 Object.freeze({key:1,jefferson:'amber',cross:'red'}),
 Object.freeze({key:2,jefferson:'red',cross:'red'}),
 Object.freeze({key:3,jefferson:'red',cross:'green'}),
 Object.freeze({key:4,jefferson:'red',cross:'amber'}),
 Object.freeze({key:5,jefferson:'red',cross:'red'}),
]);
export const JEFFERSON_SIGNAL_CYCLE_SECONDS=88;
/** A deterministic game cycle: 46/4/2 seconds on Jefferson, then 30/4/2 on
 * the cross street. No flashing, interpolation, timers or real-world timing claim. */
export function jeffersonSignalPhase(elapsedSeconds:number,offsetSeconds=0):SignalPhase{
 if(!Number.isFinite(elapsedSeconds)||!Number.isFinite(offsetSeconds))return PHASES[2];
 const t=((elapsedSeconds%JEFFERSON_SIGNAL_CYCLE_SECONDS+offsetSeconds%JEFFERSON_SIGNAL_CYCLE_SECONDS)%JEFFERSON_SIGNAL_CYCLE_SECONDS+JEFFERSON_SIGNAL_CYCLE_SECONDS)%JEFFERSON_SIGNAL_CYCLE_SECONDS;
 return PHASES[t<46?0:t<50?1:t<52?2:t<82?3:t<86?4:5];
}

export type SignalRoad=Readonly<{id:string;name:string;width:number;points:readonly SignalPoint[];foot?:boolean;bridge?:boolean;oneway?:number}>;
export type SignalFixture=Readonly<{axis:'jefferson'|'cross';travel:SignalPoint;pole:SignalPoint;support?:SignalPoint;heads:readonly SignalPoint[]}>;
export type JeffersonJunction=Readonly<{id:string;source:JeffersonSignalSource;center:SignalPoint;jeffersonRoadId:string;crossRoadId?:string;offsetSeconds:number;fixtures:readonly SignalFixture[]}>;
export type JeffersonSignalPlan=Readonly<{junctions:readonly JeffersonJunction[];excluded:readonly Readonly<{source:JeffersonSignalSource;reason:'outside-mapped-roads'|'no-clear-pole-placement'}>[]}>;
/** Matches the widest ground-level foot of the modeled signal pole. */
export const JEFFERSON_SIGNAL_BASE_RADIUS=.33;
type PlanInput={roads:readonly SignalRoad[];land:(x:number,z:number)=>boolean;obstructed:(x:number,z:number,margin:number)=>boolean;sources?:readonly JeffersonSignalSource[];
 /** Return true only when the complete circular base avoids the protected
  * pedestrian corridor. Applies to poles and span anchors, not overhead heads;
  * this additional guard never replaces road, land or building clearance. */
 pedestrianClearance?:(x:number,z:number,baseRadius:number)=>boolean;
};
type RoadSegment={road:SignalRoad;a:SignalPoint;b:SignalPoint;ux:number;uz:number;length:number};
const POLE_CLEARANCE=.8;
function nearest(p:SignalPoint,s:RoadSegment){
 const t=Math.max(0,Math.min(1,((p[0]-s.a[0])*s.ux+(p[1]-s.a[1])*s.uz)/s.length));
 const x=s.a[0]+s.ux*t*s.length,z=s.a[1]+s.uz*t*s.length;
 return {x,z,d:Math.hypot(p[0]-x,p[1]-z)};
}
function sourceName(name:string){return name.toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ');}
function roadSegments(roads:readonly SignalRoad[]){
 const segments:RoadSegment[]=[];
 for(const road of roads){
  if(road.foot||road.bridge||!Number.isFinite(road.width)||road.width<=0)continue;
  for(let i=1;i<road.points.length;i++){
   const a=road.points[i-1],b=road.points[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
   if(!Number.isFinite(length)||length<.1)continue;
   segments.push({road,a,b,ux:dx/length,uz:dz/length,length});
  }
 }
 return segments;
}
/** Road-supported placement keeps poles on mapped, unobstructed ground outside
 * every existing carriageway. No geometry, road widths or collision data change.
 * Missing downtown roads remain in the source inventory instead of producing
 * floating signals. A cross-street head is only added with named road support. */
export function planJeffersonSignals(input:PlanInput):JeffersonSignalPlan{
 const segments=roadSegments(input.roads),junctions:JeffersonJunction[]=[],excluded:{source:JeffersonSignalSource;reason:'outside-mapped-roads'|'no-clear-pole-placement'}[]=[];
 // Reject the historical offshoot mislabeled Jefferson: the corridor runs
 // roughly east-northeast, not along the perpendicular neighborhood streets.
 const mains=segments.filter(s=>/jefferson/i.test(s.road.name)&&Math.abs(s.ux*.864-s.uz*.503)>.9);
 for(const source of input.sources??JEFFERSON_SIGNAL_INVENTORY){
  const center=projectJeffersonSignal(source.longitude,source.latitude);
  const main=mains.map(s=>({s,d:nearest(center,s).d})).filter(v=>v.d<=18).sort((a,b)=>a.d-b.d||b.s.length-a.s.length)[0]?.s;
  if(!main||!input.land(...center)){excluded.push({source,reason:'outside-mapped-roads'});continue;}
  const nearby=segments.filter(s=>nearest(center,s).d<100);
  const cross=nearby.filter(s=>source.crossNames.some(n=>sourceName(s.road.name).includes(n))&&Math.abs(s.ux*main.ux+s.uz*main.uz)<.65)
   .map(s=>({s,d:nearest(center,s).d})).filter(v=>v.d<=22).sort((a,b)=>a.d-b.d||b.s.length-a.s.length)[0]?.s;
  const safe=(p:SignalPoint)=>input.land(...p)&&!input.obstructed(...p,.7)&&!nearby.some(s=>nearest(p,s).d<s.road.width*.5+POLE_CLEARANCE)&&(!input.pedestrianClearance||input.pedestrianClearance(...p,JEFFERSON_SIGNAL_BASE_RADIUS));
  const fixtures:SignalFixture[]=[];
  const addAxis=(s:RoadSegment,axis:'jefferson'|'cross',otherWidth:number)=>{
   const supported=nearby.filter(q=>axis==='jefferson'?mains.includes(q):source.crossNames.some(n=>sourceName(q.road.name).includes(n)));
   for(const direction of [-1,1]){
    const ux=s.ux*direction,uz=s.uz*direction,rx=-uz,rz=ux;
    let fixture:SignalFixture|undefined;
    // A bounded roadside search accounts for divided carriageways and map/GIS
    // center offsets. It never moves a road or removes an obstructing object.
    // When the mapped corridor ends at an intersection (Woodward), a
    // near-side head can remain on its actual approach. Keep the original
    // far-side search first and retain all land/road/obstacle requirements.
    const alongOptions=[0,3,6,9,15,21,27].map(n=>otherWidth*.5+4+n);
    if(axis==='jefferson')alongOptions.push(-12,-16,-20,-24,-28,-32,-36);
    for(const along of alongOptions){
     if(fixture)break;
     const target:SignalPoint=[center[0]+ux*along,center[1]+uz*along];
     const support=supported.filter(q=>Math.abs(q.ux*ux+q.uz*uz)>.9&&(!q.road.oneway||q.road.oneway*(q.ux*ux+q.uz*uz)>0))
      .map(q=>({q,p:nearest(target,q)})).filter(({p})=>p.d<38&&Math.sign(along)*((p.x-center[0])*ux+(p.z-center[1])*uz)>=otherWidth*.5+2)
      .sort((a,b)=>a.p.d+(a.q.road.id.startsWith('city-')?6:0)-b.p.d-(b.q.road.id.startsWith('city-')?6:0))[0];
     if(!support)continue;
     const lane=support.q.road.oneway?0:support.q.road.width*.24;
     const head:[number,number]=[support.p.x+rx*lane,support.p.z+rz*lane];
     if(!input.land(...head)||input.obstructed(...head,.2))continue;
     for(const verge of [2.2,4.2,6.2,8.2]){
      const pole:[number,number]=[support.p.x+rx*(support.q.road.width*.5+verge),support.p.z+rz*(support.q.road.width*.5+verge)];
      if(!safe(pole))continue;
      const spanSupport:[number,number]=[support.p.x-rx*(support.q.road.width*.5+verge),support.p.z-rz*(support.q.road.width*.5+verge)];
      // Joseph Campau photographs show suspended yellow heads. Extra supports
      // must pass the same roadside checks; never put an anchor in a lane.
      const suspended=source.objectId!==214&&safe(spanSupport);
      if(source.objectId===417&&!suspended)continue;
      const heads:SignalPoint[]=[Object.freeze(head)];
      if(axis==='jefferson'&&support.q.road.width>=12){
       const extra:SignalPoint=[head[0]+rx*support.q.road.width*.18,head[1]+rz*support.q.road.width*.18];
       if(input.land(...extra)&&!input.obstructed(...extra,.2))heads.push(Object.freeze(extra));
      }
      fixture=Object.freeze({axis,travel:Object.freeze([ux,uz]) as SignalPoint,pole:Object.freeze(pole),support:suspended?Object.freeze(spanSupport):undefined,heads:Object.freeze(heads)});break;
     }
    }
    if(fixture)fixtures.push(fixture);
   }
  };
  addAxis(main,'jefferson',cross?.road.width??8);
  if(cross)addAxis(cross,'cross',main.road.width);
  // An incomplete primary pair can mislead a rider. Retain that junction as
  // excluded until both opposing Jefferson approaches fit the mapped scene.
  if(fixtures.filter(f=>f.axis==='jefferson').length!==2){excluded.push({source,reason:'no-clear-pole-placement'});continue;}
  // Likewise publish cross-street approaches only as an opposing pair.
  const complete=fixtures.filter(f=>f.axis==='cross').length===2?fixtures:fixtures.filter(f=>f.axis==='jefferson');
  junctions.push(Object.freeze({id:'jefferson-signal-'+source.objectId,source,center:Object.freeze(center),jeffersonRoadId:main.road.id,crossRoadId:complete.some(f=>f.axis==='cross')?cross?.road.id:undefined,offsetSeconds:(source.objectId%11)*4,fixtures:Object.freeze(complete)}));
 }
 return Object.freeze({junctions:Object.freeze(junctions),excluded:Object.freeze(excluded.map(v=>Object.freeze(v)))});
}

// Shared model/collision layout. OSM shell; interior beds are photo-informed,
// approximate placements, not a measured survey of the collection.
export function applyConservatory(map){
 const center=[1330.8,1174.7],yaw=.313,c=Math.cos(yaw),s=Math.sin(yaw);
 const toWorld=([u,v])=>[center[0]+c*u-s*v,center[1]-s*u-c*v];
 const toLocal=([x,z])=>[(x-center[0])*c-(z-center[1])*s,-(x-center[0])*s-(z-center[1])*c];
 const outline=map.buildings.find(b=>b.id==='107310050').points.map(toLocal);
 const beds=[
  [-4.6,4.8,2.1,2.9,'palm'],[4.6,4.8,2.1,2.9,'palm'],[-4.6,-4.8,2.1,2.9,'palm'],[4.6,-4.8,2.1,2.9,'palm'],
  [-3,-16,1.35,3.3,'tropical'],[3,-17,1.35,4,'tropical'],[-3,-25,1.35,3.2,'tropical'],[3,-27,1.35,3.2,'tropical'],[0,-35,2.3,2.3,'tropical'],
  [-3,16,1.35,3.2,'cactus'],[3,16,1.35,3.2,'cactus'],[0,24,2,3,'cactus'],
  [-3,31,1.35,2.7,'fern'],[3,32,1.35,2.7,'fern'],[0,38,2.3,2,'fern'],
  [17,6.8,3.4,2.2,'flower'],[17,-6.8,3.4,2.2,'flower'],[21,0,1,3.2,'flower']
 ].map(([u,v,rx,ry,type],i)=>({id:'bed-'+i,u,v,rx,ry,type}));
 const walls=[];
 for(let i=1;i<outline.length;i++){
  const a=outline[i-1],b=outline[i];
  // West entrance's straight front elevation is split around the open doors.
  if(a[0]<-15.9&&b[0]<-15.9&&Math.min(a[1],b[1])<1.7&&Math.max(a[1],b[1])>-1.7){
   const y0=Math.min(a[1],b[1]),y1=Math.max(a[1],b[1]);
   const at=y=>[a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]),y];
   if(y0<-1.7)walls.push({a:at(y0),b:at(-1.7)});
   if(y1>1.7)walls.push({a:at(1.7),b:at(y1)});
  }else walls.push({a,b});
 }
 // Open pond-side gate follows the path; no fence crosses the mapped junction.
 const gardenWalls=[{a:[20.7,19],b:[20.7,31.4]},{a:[21.3,32.6],b:[21.3,34]},{a:[24.7,32.6],b:[24.7,34]}];
 map.conservatory={id:'107310050',center,yaw,outline,walls,gardenWalls,beds,entrance:[-17,0],approach:[-24,0],rooms:[
  {name:'Palm House',point:[0,0]}, {name:'Tropical House',point:[0,-20]},
  {name:'Cactus House',point:[0,16]}, {name:'Fernery',point:[0,32]},
  {name:'Show House',point:[16,0]}
 ],reference:'https://historicdetroit.org/galleries/anna-scripps-whitcomb-conservatory-photos-post-restoration',confidence:'Mapped outer footprint; photo-informed interior arrangement and plant positions are approximate'};
 const lm=map.landmarks.find(l=>l.id==='107310050');
 Object.assign(lm,{description:'Walk through the open west entrance into the Palm House, tropical and cactus wings, fernery and show house. Formal gardens and lily pond surround the conservatory.',reference:map.conservatory.reference,viewDistance:40});
 // Keep the existing temperance fountain; it belongs in the tropical wing.
 const fountain=map.monuments?.find(l=>l.model==='temperance');
 if(fountain){const [x,z]=toWorld([-2.8,-22]);Object.assign(fountain,{x,z,latitude:map.origin[1]-z/111320,longitude:map.origin[0]+x/(111320*Math.cos(map.origin[1]*Math.PI/180)),confidence:"Inside Tropical House; precise placement is approximate",viewDistance:10,description:'Historic temperance fountain in the tropical wing; enter through the conservatory’s west doors.'});Object.assign(map.landmarks.find(l=>l.id===fountain.id),fountain);const p=map.pois.find(l=>l.id===fountain.id);if(p)Object.assign(p,fountain);}
 const garden=map.areas.find(a=>a.id==='107227702');
 if(garden){const points=garden.points.slice(0,-1),[x,z]=toWorld([-76,0]);const record={id:garden.id,name:'Conservatory Formal Gardens',kind:'landscape',x,z,description:'Perennial borders and seasonal flowers around the mapped garden paths. The lily pond lies beside the conservatory and aquarium.',reference:'https://www.michigan.org/property/anna-scripps-whitcomb-conservatory'};const i=map.pois.findIndex(p=>p.id===garden.id);if(i<0)map.pois.push(record);else Object.assign(map.pois[i],record);}
 return map.conservatory;
}

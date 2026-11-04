/** Mapped public facilities; footprints and barriers from the existing OSM extract.
 * Elevations, roof pitches and facade details are approximations, not measured surveys. */
export function applyFacilities(map,source){
 const origin=map.origin,project=([lon,lat])=>[+(111320*Math.cos(origin[1]*Math.PI/180)*(lon-origin[0])).toFixed(2),+(-111320*(lat-origin[1])).toFixed(2)];
 const inside=(p,poly)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;};
 const onLand=p=>inside(p,map.island)||(map.outerIslets||[]).some(i=>inside(p,i.points));
 const dist=(p,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dz*t);};
 const custom=new Set(map.landmarks.map(l=>l.id));const sites=[];
 for(const f of source){if(f.type!=='way'||custom.has(f.id))continue;const t=f.tags||{},kind=t.amenity==='toilets'?'restroom':t.building==='shed'?'shed':t.amenity==='shelter'||t.shelter_type==='picnic_shelter'||/Shelter/.test(t.name||'')?'shelter':null;if(!kind||f.points.length<4)continue;
  const points=f.points.map(project),center=points.slice(0,-1).reduce((s,p)=>[s[0]+p[0]/(points.length-1),s[1]+p[1]/(points.length-1)],[0,0]);if(!onLand(center))continue;
  if(!map.buildings.some(b=>b.id===f.id))map.buildings.push({id:f.id,name:t.name||kind,points,height:kind==='shed'?3:4});
  sites.push({id:f.id,name:t.name||(kind==='restroom'?'Public restrooms':kind==='shelter'?'Picnic shelter':'Park service shed'),kind,points,center,roof:t['roof:shape']||'hipped',source:'https://www.openstreetmap.org/way/'+f.id});
 }
 // Toilets mapped as nodes are associated with the existing footprint, never duplicated.
 for(const f of source.filter(f=>f.type==='node'&&f.tags?.amenity==='toilets')){const p=project(f.points[0]);if(!onLand(p))continue;const b=map.buildings.find(b=>inside(p,b.points));if(!b||custom.has(b.id)||sites.some(s=>s.id===b.id))continue;sites.push({id:b.id,name:f.tags.name||b.name||'Public restrooms',kind:'restroom',points:b.points,center:b.points.slice(0,-1).reduce((s,p)=>[s[0]+p[0]/(b.points.length-1),s[1]+p[1]/(b.points.length-1)],[0,0]),roof:'hipped',source:'https://www.openstreetmap.org/node/'+f.id});}
 const gates=source.filter(f=>f.type==='node'&&/^(gate|lift_gate|sliding_gate|swing_gate)$/.test(f.tags?.barrier||'')).map(f=>({id:f.id,p:project(f.points[0]),kind:f.tags.barrier,source:'https://www.openstreetmap.org/node/'+f.id})).filter(g=>onLand(g.p));
 const roadSegments=map.roads.flatMap(r=>r.points.slice(1).map((p,i)=>({a:r.points[i],b:p,r:r.width*.5+.45})));
 const clearance=p=>roadSegments.some(r=>p[0]>=Math.min(r.a[0],r.b[0])-r.r&&p[0]<=Math.max(r.a[0],r.b[0])+r.r&&p[1]>=Math.min(r.a[1],r.b[1])-r.r&&p[1]<=Math.max(r.a[1],r.b[1])+r.r&&dist(p,r.a,r.b)<r.r)||gates.some(g=>Math.hypot(p[0]-g.p[0],p[1]-g.p[1])<2.8);
 const fences=[];
 for(const f of source){if(f.type!=='way'||!['fence','wall'].includes(f.tags?.barrier)||f.points.length<2)continue;const pts=f.points.map(project);if(!pts.some(onLand))continue;const height=Math.min(2.4,Math.max(.9,parseFloat(f.tags.height)||1.25)),style=f.tags.barrier==='wall'?'stone':/metal|iron/.test(f.tags.fence_type||'')?'iron':'wire';
  for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.ceil(len/.6);let start=null;
   for(let j=0;j<=n;j++){const t=j/n,p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],clear=j===n||!onLand(p)||clearance(p);if(!clear&&start===null)start=p;if(clear&&start){if(Math.hypot(p[0]-start[0],p[1]-start[1])>.8)fences.push({id:f.id,a:start,b:p,height,style});start=null;}}
  }
 }
 // Orient open gate leaves along the path edges; leave the full crossing unobstructed.
 for(const g of gates){const r=roadSegments.reduce((best,r)=>dist(g.p,r.a,r.b)<dist(g.p,best.a,best.b)?r:best,roadSegments[0]);g.yaw=Math.atan2(r.b[1]-r.a[1],r.b[0]-r.a[0]);g.width=Math.max(3.8,Math.min(12,r.r*2+1.2));}
 map.facilities={version:1,sites,gates,fences,notes:'OSM positions and footprints. Approximate elevations and materials; public path crossings and gate openings kept clear.'};
 for(const s of sites){const p=map.pois.find(p=>p.id===s.id);if(p){p.kind=s.kind;p.viewDistance=18;p.name=s.name;}else map.pois.push({id:s.id,name:s.name,x:s.center[0],z:s.center[1],kind:s.kind,viewDistance:18,source:s.source});}
 return map.facilities;
}

/** Mapped footprints retained; elevations reconstructed from the user's November 2 photographs. */
export const historicHouses=[
 {id:'507125654',name:'Belle Isle White House',center:[1414.6,1060.1],angle:-.286,view:[1404,1037],look:[1414.6,1060.1],description:'White clapboard, red-trimmed gables, projecting bay windows, brick chimneys and a small front balcony. Exterior reconstructed from reference photographs; dimensions are approximate.'},
 {id:'507290052',name:'Belle Isle former stable yard',center:[1428.5,943.5],angle:-.693,view:[1407.43,927],look:[1428.5,943.5],description:'The mapped U-shaped stable yard with brick walls, cream-and-dark timber framing, tiled roofs, dormers and shingled turrets. Flower borders follow the street facade. Exterior reconstruction; ornamental details are simplified.'}
];
export function applyHistoricHouses(map){
 map.historicHouses=historicHouses;
 for(const h of historicHouses){
  if(!map.buildings.some(b=>b.id===h.id))throw Error('Missing mapped building '+h.id);
  const old=map.pois.find(p=>p.id===h.id)||{};
  const p={...old,id:h.id,name:h.name,x:h.look[0],z:h.look[1],kind:'building',description:h.description,reference:'https://www.michigan.gov/dnr/managing-resources/prd/bip-strategic-plan',source:'OpenStreetMap footprint; user-supplied exterior photographs, 2026-11-02',viewDistance:h.id==='507125654'?26:42};
  for(const list of [map.pois,map.landmarks]){const at=list.findIndex(p=>p.id===h.id);if(at<0)list.push({...p});else list[at]={...list[at],...p};}
 }
 return map;
}

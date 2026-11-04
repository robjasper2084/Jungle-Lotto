export const okonoka = {
 id:'420959', view:[3238.72,746.66], look:[3240,704],
 reference:'https://www.detroitriver.org/glri-projects/lake-okonoka',
 description:'Restored lake with wooded islands, wet meadow, shoreline habitat and fish passage toward Blue Heron Lagoon and the Detroit River. The planting and fallen timber are a visual reconstruction, not a habitat survey.'
};
export function applyOkonoka(map){
 if(!map.waterSources?.some(w=>w.id===okonoka.id))throw Error('Missing mapped Lake Okonoka water');
 map.lakeHabitat={...okonoka};
 const landmark=map.landmarks.find(l=>l.id===okonoka.id);
 if(!landmark)throw Error('Missing Lake Okonoka guide entry');
 // The mean of this long irregular shoreline's vertices falls in the woods.
 // Use an actual open-water point for navigation and the mapped southern path.
 Object.assign(landmark,{x:okonoka.look[0],z:okonoka.look[1],description:okonoka.description,reference:okonoka.reference});
 return map;
}

export type Surface='asphalt'|'grass'|'concrete'|'brick'|'bark'|'sand'|'limestone'|'wood'|'metal'|'rubber'|'leaf'|'cloth'|'fur'|'skin'|'gravel'|'roof';
export function surfaceKind(name:string,object:string,metalness=0):Surface|null{
 const n=(name+' '+object).toLowerCase();
 // Optical, luminous, graphic and moving-water surfaces keep their dedicated materials.
 if(/court.paint|court.line|clock.dial|clock.hands|floral.clock.flowers|sports.rim|meadow.grass.blades|glass|glaz|clear.panes|lens.coating|monitor|screen|lcd|record.led|running.light|brake.light|plate|michigan|sign|marking|stripe|letter|water|foam|sky|sun|beacon|light.pool|lamp|globe/.test(n))return null;
 if(/boerboel|companion|dog/.test(n))return 'fur';
 if(/hero_head|hero_arms|fpvarms|skin.hand/.test(n))return 'skin';
 if(/higgsfield.hero|hero_body|hero_upperarms|dread|cloth|suit|fabric|cushion/.test(n))return 'cloth';
 if(/asphalt/.test(n))return 'asphalt';
 if(/sand|beach/.test(n))return 'sand';
 if(/gravel|soil|earth|mulch/.test(n))return 'gravel';
 if(/bark|trunk/.test(n))return 'bark';
 if(/grass|lawn|meadow|turf/.test(n))return 'grass';
 if(/leaf|leaves|foliage|flower|periwinkle|dandelion|reed|plant|fern/.test(n))return 'leaf';
 if(/rubber|grip|tire|tyre|leather|seat/.test(n))return 'rubber';
 if(/timber|wood|oak|cedar|teak|board|bench.slat/.test(n))return 'wood';
 if(/terracotta|clay.roof|roof.tile|shingle/.test(n))return 'roof';
 if(/brick|masonry/.test(n))return 'brick';
 if(/stone|marble|granite|rock|tufa|stucco|plaster/.test(n))return 'limestone';
 if(/steel|metal|alloy|titanium|aluminum|aluminium|brass|bronze|copper|iron|graphite|chrome|higgsfield.bike|cinema|fan|fitting|rail|fence|pole|frame/.test(n)||metalness>.35)return 'metal';
 if(/actor/.test(n))return 'cloth';
 return 'concrete';
}

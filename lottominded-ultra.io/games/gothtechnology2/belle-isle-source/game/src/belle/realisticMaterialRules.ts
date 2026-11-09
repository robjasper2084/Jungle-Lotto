export type Surface='asphalt'|'grass'|'concrete'|'brick'|'bark'|'sand'|'limestone'|'wood'|'metal'|'rubber'|'leaf'|'cloth'|'fur'|'skin'|'gravel'|'roof'|'marble'|'bronze'|'copper'|'ceramic'|'paint'|'granite'|'rope'|'feather'|'leather'|'cork'|'graphite'|'scales';
export function surfaceKind(name:string,object:string,metalness=0):Surface|null{
 const n=(name+' '+object).toLowerCase();
 // These exact named optical meshes own their complete wave/pond shaders.
 // The near river lacks 'water' in its name and previously fell back to concrete.
 if(/^(Detroit River (rolling waves|distant water)|Lagoon · |Koi pond · clear surface)/i.test(object))return null;
 if(/fish.*scale/.test(n))return 'scales';
 if(/feather|pigeon|waterfowl/.test(n))return 'feather';
 // Optical, luminous, graphic and moving-water surfaces keep their dedicated materials.
 if(/mosaic.floor|aquarium.illuminated.habitat|court.paint|court.line|clock.dial|clock.hands|floral.clock.flowers|sports.rim|meadow.grass.blades|glass|glazing|clear.panes|lens.coating|monitor|screen|lcd|record.led|running.light|brake.light|plate|michigan|sign|marking|stripe|letter|water|foam|sky|sun|beacon|light.pool|lamp|globe/.test(n))return null;
 if(/glazed.*tile|ceramic/.test(n))return 'ceramic';
 if(/marble|scott.*carved/.test(n))return 'marble';
 if(/granite|terrazzo/.test(n))return 'granite';
 if(/bronze|patina.highlights/.test(n))return 'bronze';
 if(/copper/.test(n))return 'copper';
 if(/cork/.test(n))return 'cork';
 if(/fish.*scale/.test(n))return 'scales';
 if(/feather|pigeon|waterfowl/.test(n))return 'feather';
 if(/rope/.test(n))return 'rope';
 if(/leather/.test(n))return 'leather';
 if(/graphite|carbon.fiber/.test(n))return 'graphite';
 if(/paint|powder.coat|molded|fiberglass|plastic|freighter.hull/.test(n))return 'paint';
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

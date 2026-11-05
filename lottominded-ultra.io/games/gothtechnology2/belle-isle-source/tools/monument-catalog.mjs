// Source-backed monument inventory; original approximate models, not scans.
const HD='https://historicdetroit.org/buildings/', D1701='https://detroit1701.org/';
export const monuments=[
 ['9146545','James Scott Memorial Fountain','scott_fountain',26,12,HD+'james-scott-memorial-fountain','Tiered marble fountain, four reclining lions, turtles and relief drum.',0,55],
 ['14042075065','Major General Alpheus Starkey Williams','williams',3.6,10,HD+'alpheus-starkey-williams-monument','Bronze equestrian memorial: Williams reads a map above a granite plinth.',-1.29,20],
 ['3726954170','James J. Brady Memorial','brady',2.2,5.8,HD+'james-j-brady-monument','Brady shelters a child; bronze figures on a pale masonry pedestal.',.35,14],
 ['3728142602','Johann Friedrich von Schiller','schiller',2,5.6,D1701+'von%20Schiller%20Sculpture.html','Seated bronze poet with a book on a granite pedestal.',2.8,14],
 ['3728142603','Dante Alighieri','dante',1.4,4.4,'https://www.si.edu/search?edan_q=Dante%20Belle%20Isle','White marble bust with laurel and cap; pale pedestal.',-.3,12],
 ['4894343389','Civil War / Grand Army of the Republic Memorial','civil_war',1.7,5.3,'https://suvcw.org/sites/default/files/2023-07/MI_Detroit_Sculpture_Belle_Isle_Central_and_Muse_Rds_redacted.pdf','Union soldier in stone on a granite pedestal.',.3,14],
 ['4894343390','Samuel Francis Smith Memorial Flagpole','flagpole',4.3,25,D1701+'Smith%20Flagpole.htm','Art Deco memorial base with corner eagles and a tall flagpole.',0,25],
 ['6160033107','James Scott statue','scott_statue',1.8,4.8,HD+'james-scott-memorial-fountain','Separate seated bronze figure behind Scott Fountain.',-1.15,14],
 ['6164960177','Edmund Fitzgerald anchor / Lost Mariners Memorial','anchor',3,4.5,'https://www.detroit1967.org/exhibitions/outdoor-treasures','Large stockless bow anchor displayed in the museum memorial garden.',.2,16],
 ['6169445606','General O. M. Poe Memorial','poe',1.4,1.6,'https://suvcw.org/sites/default/files/2023-07/MI_Detroit_Missing_Vicksburg_Cannon_Belle_Isle_Casino_redacted_0.pdf','Bronze memorial tablet on a low stone support.',.3,10],
 ['6169445607','Spanish-American War Memorial','spanish_war',4.8,5.5,D1701+'Span-Amer.%20War.html','Bronze soldier and sailor flank a broad white granite memorial.',.3,18],
 ['6169445608','Partners: A Newsboy and His Dog','partners',1.6,3.5,HD+'newsboys-fountain','Newsboy counting coins beside his dog on the former drinking fountain.',.3,12],
 ['6169445676','Levi L. Barbour Memorial / Leaping Gazelle Fountain','barbour',4.8,6.5,HD+'levi-l-barbour-memorial-fountain','Wheeling gazelle above dark granite basins with four native animals.',-1.6,16],
 ['6169445677','Peacock Sundial','sundial',.85,1.55,'https://www.si.edu/object/peacock-sundial-sculpture%3Asiris_ari_362298','Bronze peacock gnomon on an octagonal dial and tapered granite base.',0,9],
 ['6169445729','Japanese Tohro (Stone Lantern)','lantern',1.6,3.4,'https://www.detroit.us.emb-japan.go.jp/itpr_en/Stonelantern.html','White granite lantern donated by Toyota in 1985.',0,11],
 ['6179290150','International Peace Memorial','peace',3,2,'https://www.hmdb.org/m.asp?m=212336','Stone memorial bench near the north edge of Oudolf Garden.',0,12],
 ['6179290151','Children’s Temperance Fountain','temperance',.85,2.6,'https://franceswillardhouse.omeka.net/exhibits/show/temperance-fountains--a-legacy/michigan','Girl figure and drinking basin inside the conservatory; exterior route leads to building.',0,14],
 ['7247925681','Ransom Eli Olds historical marker','olds',.8,2.4,'https://www.michigandnr.com/PUBLICATIONS/pdfs/ArcGISOnline/StoryMaps/mhc_historical_markers/pdfs/MHC821997007.pdf','Historical marker, not a figurative statue. Placement follows the mapped marker point.',1.134,10],
 ['10243027033','One World … Under Michigan Stars','one_world',3.6,7.32,'https://content.govdelivery.com/accounts/MIDNR/bulletins/30682ff','Steel ring with skyline silhouettes and blue glass at the Ralph Wilson Gateway.',.4,18],
 ['6164925213','Atom Gazelle','atom_gazelle',2.8,4.2,D1701+'Gazelle%2C%20Belle%20Isle.html','Richard Bennett’s abstract steel gazelle; distinct from the Barbour fountain.',0,14],
 ['6179290148','Untitled — Stanley Dolega','dolega',2.6,3.2,D1701+'Untitled,%20Belle%20Isle.html','Two rounded green steel forms at Sunset Point.',0,14],
 ['koi-pond-lantern','Koi Pond stone lantern','pond_lantern',1,2.1,'https://www.detroit.us.emb-japan.go.jp/itpr_en/Stonelantern.html','Smaller stone lantern in the existing mapped Koi & Lily Pond. Position within pond is approximate.',0,12]
].map(([id,name,model,radius,height,reference,description,yaw,viewDistance])=>({id,name,model,radius,height,reference,description,yaw,viewDistance}));
export function applyMonuments(map,features){
 const project=([lon,lat])=>[+(111320*Math.cos(map.origin[1]*Math.PI/180)*(lon-map.origin[0])).toFixed(2),+(-111320*(lat-map.origin[1])).toFixed(2)];
 const locations=new Map([...map.pois,...map.landmarks].map(p=>[p.id,p]));
 const records=monuments.map(item=>{
  let point=locations.get(item.id),f=features.find(f=>f.id===item.id);
  if(!point&&f?.points.length){const [x,z]=project(f.points[0]);point={x,z};}
  if(item.id==='koi-pond-lantern')point={x:1336.2,z:1143.4};
  if(!point)throw Error('Missing mapped location '+item.id);
  const latitude=map.origin[1]-point.z/111320,longitude=map.origin[0]+point.x/(111320*Math.cos(map.origin[1]*Math.PI/180));
  return{...item,x:point.x,z:point.z,latitude,longitude,kind:'monument',indoor:item.model==='temperance',source:'OpenStreetMap contributors; '+item.reference,confidence:'Mapped position; original approximate reconstruction; ornamental details are simplified'};
 });
 map.monuments=records;
 for(const item of records){const i=map.landmarks.findIndex(l=>l.id===item.id);if(i<0)map.landmarks.push(item);else map.landmarks[i]={...map.landmarks[i],...item};const p=map.pois.find(l=>l.id===item.id);if(p)Object.assign(p,item);}
 return records;
}

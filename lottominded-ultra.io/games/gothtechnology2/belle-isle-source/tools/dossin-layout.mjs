// OSM footprint, official DHS exterior and visitor guide. Exhibit spacing is
// an original approximation, not a measured interior survey.
export function applyDossin(map){
 const walls=[];
 const wall=(a,b,kind='blue',height=4.7)=>walls.push({a,b,kind,height});
 // North entry: 3.4 m clear opening with a flush threshold.
 wall([-8.3,-21.4],[-6.7,-21.4],'blue',6.2);
 wall([-3.3,-21.4],[-2.2,-21.4],'blue',6.2);
 wall([-2.2,-21.4],[-2.2,-20.3]);wall([-2.2,-20.3],[10.7,-20.3]);
 wall([10.7,-20.3],[10.7,18.1]);wall([10.7,18.1],[29.4,18.1]);
 wall([29.4,18.1],[29.4,26.7],'window');wall([29.4,26.7],[-8.3,26.7],'window');
 wall([-8.3,26.7],[-8.3,-13]);wall([-8.3,-13],[-21.4,-13],'window');
 wall([-21.4,-13],[-35.4,-13],'window',3.7);wall([-35.4,-13],[-35.4,-20.8],'window',3.7);
 wall([-35.4,-20.8],[-21.4,-20.8],'window',3.7);
 wall([-21.4,-20.8],[-21.4,-20.2]);wall([-21.4,-20.2],[-8.3,-20.2]);wall([-8.3,-20.2],[-8.3,-21.4]);
 // Gothic Room and theater leave the main longitudinal aisle open.
 wall([-1.6,-8],[10.7,-8],'inside',3.4);
 wall([-1.6,-20.3],[-1.6,-16.5],'wood',3.4);wall([-1.6,-13.2],[-1.6,-8],'wood',3.4);
 const solids=[
  {u:-13,v:-17,w:3.7,d:1.2,height:1.2,kind:'welcome'},
  {u:3.8,v:0,w:3.6,d:4.6,height:1.8,kind:'freighter'},
  {u:3.8,v:10,w:3.6,d:4.6,height:1.8,kind:'sailboat'},
  {u:19,v:22.5,w:5.8,d:2.4,height:1.8,kind:'showcase'},
  {u:-28.3,v:-16.9,w:8.1,d:3.3,height:1.4,kind:'hydroplane'},
  {u:5,v:-18,w:5.7,d:.8,height:.9,kind:'bench'},
  {u:5,v:-10,w:5.7,d:.8,height:.9,kind:'bench'},
  {u:4.3,v:31.15,w:8.5,d:8.8,height:4.3,kind:'pilothouse'}
 ];
 map.dossin={id:'107205459',ids:['107205459','658415891','658415900'],center:[1340.47,1351.255],yaw:-Math.PI+.342,
  walls,solids,entrance:[-5,-21.4],approach:[-5,-29],entry:[-5,-18],
  floors:[{u:1.2,v:-.6,w:19,d:41.7},{u:10.55,v:22.4,w:37.7,d:8.6},{u:-14.85,v:-16.6,w:13.1,d:7.2},{u:-28.4,v:-16.9,w:14,d:7.8}],
  reference:'https://www.detroithistorical.org/sites/default/files/pdfs/Dossin%20visitor%20guide%202023.pdf',
  confidence:'Mapped footprint; photo-informed facade and approximate gallery reconstruction'};
 Object.assign(map.landmarks.find(l=>l.id==='107205459'),{description:'Walk through the open blue entrance into the museum. Explore maritime model displays, the Gothic Room, Miss Pepsi pavilion and river-facing gallery. Interior details are an approximate reconstruction.',reference:map.dossin.reference});
 return map.dossin;
}

// Shared, photo-informed interior. Dimensions are approximate, not a survey.
export function applyAquarium(map){
 const id='107227742',center=[1363.78,1167.42],yaw=-Math.PI+.313;
 const walls=[{a:[-6.8,-38],b:[-1.65,-38]},{a:[1.65,-38],b:[6.8,-38]},{a:[6.8,-38],b:[6.8,38]},{a:[6.8,38],b:[-6.8,38]},{a:[-6.8,38],b:[-6.8,-38]}];
 const tanks=[];for(const side of [-1,1])for(const start of [-32,8])for(let i=0;i<8;i++)tanks.push({u:side*5.4,v:start+i*3.2,w:2.8,d:2.7,side});
 const solids=[{u:0,v:0,w:4.4,d:4.4,height:3.2},...[-1,1].flatMap(side=>[-20,20].map(v=>({u:side*5.4,v,w:2.8,d:28,height:3.15})))];
 const stairs={rise:.15,count:4,tread:.36,width:4.2,outsideStart:-41.04,landingStart:-39.6,landingEnd:-36.4,insideEnd:-34.96,centerRailStart:-41.22,centerRailEnd:-38.7};
 map.aquarium={id,center,yaw,walls,tanks,solids,stairs,entrance:[0,-38],approach:[0,-44],rooms:[{name:'Aquarium · North gallery',point:[0,-22]},{name:'Aquarium · Central dome',point:[0,0]},{name:'Aquarium · South gallery',point:[0,22]}],reference:'https://www.historicdetroit.org/galleries/belle-isle-aquarium-photos',confidence:'Mapped site and orientation; photo-informed architecture and approximate exhibit positions'};
 Object.assign(map.landmarks.find(l=>l.id===id),{description:'Walk up the stone entrance steps, through the open north doors and down the short interior steps. Explore the green-tiled vaulted galleries, illuminated wall tanks and central dome. The reconstructed exhibit arrangement is approximate.',reference:map.aquarium.reference});return map.aquarium;
}

import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {ElmwoodTerrain} from './elmwood-terrain.ts';
import {ELMWOOD_PARKING,inRing} from './elmwood-details.ts';

/** Keep the whole shrub crown and bed out of paths, parking and masonry. */
export function elmwoodShrubPositions(terrain:ElmwoodTerrain){
 const candidates:number[][]=[],h=.406;
 for(const side of [-1,1])for(let i=0;i<9;i++){const x=side*(4+i*1.2),n=-7.2;candidates.push([Math.cos(h)*x-Math.sin(h)*n,Math.sin(h)*x+Math.cos(h)*n,.65]);}
 for(const side of [-1,1])for(let i=0;i<8;i++)candidates.push([-62+side*6.3,327+i*1.4,.63]);
 // Lawn north of the circulation lane, not the old line through its asphalt.
 for(let i=0;i<10;i++)if(i!==4&&i!==5)candidates.push([-15+i*1.65,36+i*.72,.66]);
 const buildings=terrain.features.filter(f=>f.kind==='building');
 return candidates.filter(([x,n])=>{
  for(let i=0;i<13;i++){
   const angle=i*Math.PI/6,r=i===12?0:.88,px=x+Math.cos(angle)*r,pn=n+Math.sin(angle)*r;
   if(inRing(px,pn,ELMWOOD_PARKING)||terrain.nearest(px,pn).distance<2.35||buildings.some(f=>inRing(px,pn,f.points)))return false;
  }
  return !terrain.placements.some(p=>p.layer==='estimated'&&Math.hypot(p.position[0]-x,p.position[1]-n)<1.3);
 });
}

export function makeElmwoodSitePolish(world:T.Group,terrain:ElmwoodTerrain,creekShrubs:number[][]=[]){
 const root=new T.Group();root.name='Entrance forecourt and reference planting';world.add(root);
 // The forecourt now shares the foundation's connected, terrain-conforming asphalt.
 const center=ELMWOOD_PARKING.reduce((p,v)=>[p[0]+v[0]/ELMWOOD_PARKING.length,p[1]+v[1]/ELMWOOD_PARKING.length],[0,0]);
 const paint=new T.MeshStandardMaterial({name:'Worn parking paint',color:'#d3d0b8',roughness:.94}),stone=new T.MeshStandardMaterial({name:'Parking wheel stops',color:'#a39f91',roughness:.84});
 const transform=(x:number,n:number)=>new T.Vector3(x,terrain.surfaceGround(x,n)+.055,-n),pieces:T.BufferGeometry[]=[],stops:T.BufferGeometry[]=[];
 // One row beside the building leaves the north side as a circulation aisle.
 for(let i=0;i<8;i++){
  const x=-14+i*3.35,n=13+i*1.43,angle=.404;
  const v:number[]=[];
  for(let k=0;k<12;k++){
   const corners:T.Vector3[]=[];
   for(const [side,t] of [[-1,k/12],[1,k/12],[1,(k+1)/12],[-1,(k+1)/12]]){
    const along=(t-.5)*5.1,px=x+Math.sin(angle)*along+Math.cos(angle)*side*.05,pn=n-Math.cos(angle)*along+Math.sin(angle)*side*.05;
    corners.push(new T.Vector3(px,terrain.surfaceGround(px,pn)+.064,-pn));
   }
   for(const j of [0,2,1,0,3,2])v.push(...corners[j].toArray());
  }
  const strip=new T.BufferGeometry();strip.setAttribute('position',new T.Float32BufferAttribute(v,3));strip.computeVertexNormals();pieces.push(strip);
  if(i<7){const stop=new T.BoxGeometry(1.75,.14,.24);stop.rotateY(angle);const q=transform(x+2.44,n-1.08);stop.translate(q.x,q.y+.04,q.z);stops.push(stop);}
 }
 root.add(new T.Mesh(mergeGeometries(pieces),paint));const wheelStops=new T.Mesh(mergeGeometries(stops),stone);wheelStops.receiveShadow=true;wheelStops.castShadow=true;root.add(wheelStops);
 const shrubPositions=[...elmwoodShrubPositions(terrain),...creekShrubs],piecesLeaf:T.BufferGeometry[]=[];
 function foliage(g:T.BufferGeometry,color:T.Color){const count=g.attributes.position.count,a=new Float32Array(count*3);for(let j=0;j<count;j++)color.toArray(a,j*3);g.setAttribute('color',new T.BufferAttribute(a,3));piecesLeaf.push(g.index?g.toNonIndexed():g);}
 // Dense rounded crowns with small leaves, rather than oversized angular clumps.
 for(let i=0;i<9;i++){const a=i*2.399963,r=i===8?0:.27,g=new T.IcosahedronGeometry(i===8?.32:.28,2);g.scale(1,.9,1);g.translate(Math.cos(a)*r,.40+(i%3)*.12,Math.sin(a)*r);foliage(g,new T.Color().setHSL(.27,.29,.19+(i%3)*.015));}
 for(let i=0;i<180;i++){const a=i*2.399963,y=.18+(i%31)/31*.72,r=.48*Math.sqrt(Math.max(.08,1-((y-.48)/.5)**2));const g=new T.IcosahedronGeometry(.035+(i%4)*.006,0);g.scale(1.4,.40,.75);g.rotateZ(Math.sin(i*1.7)*.7);g.rotateY(a);g.translate(Math.cos(a)*r,y,Math.sin(a)*r);foliage(g,new T.Color().setHSL(.255+(i%5)*.007,.32,.22+(i%7)*.013));}
 const bushMat=new T.MeshStandardMaterial({name:'Evergreen foundation shrub',color:'#506d39',vertexColors:true,roughness:.95}),bushes=new T.InstancedMesh(mergeGeometries(piecesLeaf),bushMat,shrubPositions.length),o=new T.Object3D();root.add(bushes);bushes.name='Grounded lawn shrubs';bushes.castShadow=true;bushes.receiveShadow=true;
 const mulchVertices:number[]=[],mulch=new T.MeshStandardMaterial({name:'Shrub mulch beds',color:'#44392c',roughness:1});
 shrubPositions.forEach(([x,n,s],i)=>{o.position.set(x,terrain.ground(x,n)-.035,-n);o.rotation.set(0,i*2.4,0);o.scale.set(1.08+s*.2,.95+(i%4)*.05,1.08+s*.2);o.updateMatrix();bushes.setMatrixAt(i,o.matrix);
  for(let j=0;j<18;j++){for(const k of [-1,j,j+1]){const a=k*Math.PI/9,r=k<0?0:.76,px=x+Math.cos(a)*r,pn=n+Math.sin(a)*r;mulchVertices.push(px,terrain.ground(px,pn)+.016,-pn);}}
 });bushes.computeBoundingSphere();
 const bedGeo=new T.BufferGeometry();bedGeo.setAttribute('position',new T.Float32BufferAttribute(mulchVertices,3));bedGeo.computeVertexNormals();const beds=new T.Mesh(bedGeo,mulch);beds.receiveShadow=true;root.add(beds);
 return {root,materials:[paint,stone,bushMat,mulch],parking:center,shrubs:shrubPositions.length};
}

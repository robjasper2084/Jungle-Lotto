import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {fitStreetBuilding,streamDetroitArt} from './detroitAssets.ts';
import {districts,districtHeight} from './detroitGround.ts';
import {registerStaticWorldTransforms} from './staticWorldTransforms.ts';
import type {ParkTerrain,Point} from './terrain.ts';

type Polygon=(ring:Point[],y:number,holes?:Point[][])=>T.BufferGeometry;
type Road=(points:Point[],width:number,height:(x:number,z:number)=>number)=>T.BufferGeometry;

// Batch by neighbourhood so distant streets and buildings can be frustum culled.
function batches(scene:T.Object3D,mat:T.Material,name:string,size=320,ownedRoots?:T.Object3D[]){
  const cells=new Map<string,T.BufferGeometry[]>();
  return {
    add(p:Point,g:T.BufferGeometry){
      const key=Math.floor(p[0]/size)+','+Math.floor(p[1]/size);
      const list=cells.get(key)??[];list.push(g);cells.set(key,list);
    },
    finish(onGeometry?:(geometry:T.BufferGeometry)=>void){
      for(const [key,geometries] of cells){
        const g=mergeGeometries(geometries);
        if(!g)throw Error('Could not batch '+name);
        const m=new T.Mesh(g,mat);m.name=name;m.userData.tile=key.split(',').map(v=>(Number(v)+.5)*size);m.receiveShadow=true;scene.add(m);ownedRoots?.push(m);
        onGeometry?.(g);
        for(const part of geometries)part.dispose();
      }
    }
  };
}
export function addDetroitDistricts(scene:T.Scene,renderer:T.WebGLRenderer,terrain:ParkTerrain,poly:Polygon,road:Road,grass:T.Material,asphalt:T.Material){
  const ownedRoots:T.Object3D[]=[];
  for(const [outline,...holes] of districts.flat){
    const m=new T.Mesh(poly(outline,2,holes),grass);m.name='Detroit mainland';m.receiveShadow=true;scene.add(m);ownedRoots.push(m);
  }
  const {grid}=districts,positions:number[]=[],uv:number[]=[],indices:number[]=[];
  for(let j=0;j<grid.nz;j++)for(let i=0;i<grid.nx;i++){
    const k=j*grid.nx+i,x=grid.x0+i*grid.step,z=grid.z0+j*grid.step;
    positions.push(x,2+grid.heights[k]/100,z);uv.push(x/8,z/8);
    if(i+1<grid.nx&&j+1<grid.nz)indices.push(k,k+grid.nx+1,k+1,k,k+grid.nx,k+grid.nx+1);
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
  const ground=new T.Mesh(g,grass);ground.name='Elmwood · Wayne County terrain';ground.receiveShadow=true;scene.add(ground);ownedRoots.push(ground);
  // Rebuild the Swoop trail cross-section and its street decks in the common scene.
  const trench:number[]=[],faces:number[]=[],trailUV:number[]=[];
  for(let i=0;i<districts.greenway.length;i++){
    const [x,z,depth]=districts.greenway[i],prev=trailPoint(i-1),next=trailPoint(i+1);
    const dx=next[0]-prev[0],dz=next[1]-prev[1],len=Math.hypot(dx,dz)||1;
    for(const side of [-10,-4,4,10]){const px=x-dz/len*side,pz=z+dx/len*side;trench.push(px,Math.abs(side)===10?2:2-depth,pz);trailUV.push(px/8,pz/8);}
    if(i){for(let s=0;s<3;s++){const k=(i-1)*4+s;faces.push(k,k+1,k+4,k+1,k+5,k+4);}}
  }
  function trailPoint(i:number){return districts.greenway[Math.max(0,Math.min(districts.greenway.length-1,i))];}
  const trailMesh=new T.BufferGeometry();trailMesh.setAttribute('position',new T.Float32BufferAttribute(trench,3));trailMesh.setAttribute('uv',new T.Float32BufferAttribute(trailUV,2));trailMesh.setIndex(faces);trailMesh.computeVertexNormals();
  const banks=new T.Mesh(trailMesh,grass);banks.name='Dequindre Cut greenway banks';scene.add(banks);ownedRoots.push(banks);
  const trailPath=districts.greenway.map(([x,z])=>[x,z] as Point);
  const trail=new T.Mesh(road(trailPath,6.096,(x,z)=>terrain.height(x,z,-20)+.05),asphalt);trail.name='Dequindre Cut greenway';scene.add(trail);ownedRoots.push(trail);
  terrain.roadContact.add(trail.geometry);
  const deck=new T.MeshStandardMaterial({color:0x97958b});
  for(const b of districts.bridges){const slab=new T.Mesh(poly(b.points,2.035),deck);slab.name=b.name+' overpass';scene.add(slab);ownedRoots.push(slab);}
  const streets=batches(scene,asphalt,'Greater Detroit pavement',320,ownedRoots);
  const sidewalks=batches(scene,new T.MeshStandardMaterial({color:0xb9b7ab,roughness:.95}),'Detroit sidewalks',320,ownedRoots);
  const paint=batches(scene,new T.MeshStandardMaterial({color:0xd6af68,roughness:.98}),'Jefferson lane markings',320,ownedRoots);
  for(const r of districts.roads){
    const points:Point[]=[r.points[0]];
    for(let i=1;i<r.points.length;i++){
      const a=r.points[i-1],b=r.points[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<.01)continue;
      const steps=Math.ceil(len/(r.id.startsWith('elm-')?2:6));
      for(let j=1;j<=steps;j++)points.push([a[0]+(b[0]-a[0])*j/steps,a[1]+(b[1]-a[1])*j/steps]);
    }
    if(points.length<2)continue;
    const roadHeight=(x:number,z:number)=>terrain.height(x,z)+.07;
    if(r.id.startsWith('city-')&&r.name!=='Elmwood Cemetery entrance')sidewalks.add(points[0],road(points,r.width+3.6,(x,z)=>terrain.height(x,z)+.035));
    streets.add(points[0],road(points,r.width,roadHeight));
    if(r.name==='Jefferson')paint.add(points[0],road(points,.16,(x,z)=>roadHeight(x,z)+.025));
  }
  streets.finish(g=>terrain.roadContact.add(g));paint.finish();sidewalks.finish(g=>terrain.roadContact.add(g));
  const facade=new T.MeshStandardMaterial({color:0xb19b8a,roughness:.84});
  facade.onBeforeCompile=s=>{
    s.vertexShader='varying vec3 wallPosition;varying vec3 wallNormal;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nwallPosition=position;wallNormal=normal;');
    s.fragmentShader='varying vec3 wallPosition;varying vec3 wallNormal;\n'+s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      if(abs(wallNormal.y)<.5){float along=dot(wallPosition.xz,vec2(-wallNormal.z,wallNormal.x));
      vec2 cell=fract(vec2(along/3.3,(wallPosition.y-2.)/3.2));
      float pane=step(.21,cell.x)*step(cell.x,.8)*step(.34,cell.y)*step(cell.y,.82);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.12,.17,.185),pane);
      }else{diffuseColor.rgb*=.64;}`);
  };
  const fallback=new T.Group();scene.add(fallback);ownedRoots.push(fallback);
  const fits:NonNullable<ReturnType<typeof fitStreetBuilding>>[]=[];
  const proxies=new Map<string,T.Mesh>();
  const blocks=batches(scene,facade,'Detroit mapped buildings',320,ownedRoots);
  const simple=batches(fallback,facade,'Detroit street model proxies',240);
  for(const b of districts.buildings){
    const shape=new T.Shape(b.points.map(([x,z])=>new T.Vector2(x,-z)));
    const h=new T.ExtrudeGeometry(shape,{depth:b.height,bevelEnabled:false});
    h.rotateX(-Math.PI/2);h.translate(0,terrain.height(...b.points[0])-.1,0);
    const asset=b.id==='313128810'?'elmwood-gatehouse':b.id==='313128826'?'elmwood-chapel':undefined;
    if(asset){const proxy=new T.Mesh(h,facade);scene.add(proxy);ownedRoots.push(proxy);proxies.set(asset,proxy);continue;}
    const fit=fitStreetBuilding(b);
    if(fit){fits.push(fit);simple.add([fit.x,fit.z],h);}else blocks.add(b.points[0],h);
  }
  blocks.finish();simple.finish();
  const dummy=new T.Object3D();
  function scatter(points:number[][],geometry:T.BufferGeometry,color:number,offset:number,name:string){
    const mesh=new T.InstancedMesh(geometry,new T.MeshStandardMaterial({color,roughness:.95}),points.length);
    points.forEach(([x,z,yaw],i)=>{dummy.position.set(x,terrain.height(x,z)+offset,z);dummy.rotation.y=yaw??i;dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
    mesh.computeBoundingSphere();mesh.name=name;scene.add(mesh);ownedRoots.push(mesh);
  }
  scatter(districts.stones,new T.BoxGeometry(.68,.84,.28),0x959189,.42,'Elmwood memorial markers');
  scatter(districts.trees,new T.CylinderGeometry(.18,.32,4,6),0x615348,2,'Elmwood tree trunks');
  scatter(districts.trees,new T.IcosahedronGeometry(3,1),0x627544,5,'Elmwood tree crowns');
  for(const ring of districts.water){
    const [x,z]=ring[0],y=districtHeight(x,z)??2;
    const pond=new T.Mesh(poly(ring,y+.06),new T.MeshStandardMaterial({color:0x416c6c,roughness:.36}));
    pond.name='Elmwood Pond';scene.add(pond);ownedRoots.push(pond);
  }
  registerStaticWorldTransforms(scene,'detroit-initial',ownedRoots);
  return streamDetroitArt(scene,renderer,terrain,fits,fallback,proxies);
}

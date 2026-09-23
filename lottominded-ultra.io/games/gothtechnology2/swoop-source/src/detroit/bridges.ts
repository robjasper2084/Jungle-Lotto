import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {GEO,profileLevel,nearestRamp,cutWidth,BRIDGE_LEVELS,BRIDGE_SLAB_DEPTH,BRIDGE_BEAM_DEPTH} from './geo-profile.ts';
import {pointOnCut,nearestCut} from './geography.ts';

export type BridgeMesh={name:string;kind:'deck'|'abutment'|'beam'|'parapet'|'approach'|'roadway'|'sidewalk'|'metal';geometry:T.BufferGeometry;source:string;bridge:string;collision?:boolean};
type Bridge=typeof GEO.bridges[number];
type XY=[number,number];

/** Use the mapped perimeter and crossing bearing, not an axis-aligned box.
 * Substructure dimensions are authored estimates; footprint/datum remain mapped. */
export function bridgeFrame(b:Bridge){
  const origin=pointOnCut(b.at),nx=-Math.cos(origin.heading),nz=Math.sin(origin.heading);
  const edges=b.points.slice(1).map((p,i)=>{const a=b.points[i],dx=p[0]-a[0],dz=p[1]-a[1],length=Math.hypot(dx,dz);return{dx,dz,length,score:length*Math.abs((dx*nx+dz*nz)/length)**4};}).filter(e=>e.length>1).sort((a,b)=>b.score-a.score);
  const e=edges[0],sign=e.dx*nx+e.dz*nz<0?-1:1,ax=e.dx/e.length*sign,az=e.dz/e.length*sign;
  const project=(x:number,z:number):XY=>[(x-origin.x)*ax+(z-origin.z)*az,(x-origin.x)*-az+(z-origin.z)*ax];
  const point=(x:number,z:number)=>({x:origin.x+ax*x-az*z,z:origin.z+az*x+ax*z});
  const polygon=b.points.slice(0,-1).map(p=>project(p[0],p[1]));
  const matrix=new T.Matrix4().makeBasis(new T.Vector3(ax,0,az),new T.Vector3(0,1,0),new T.Vector3(-az,0,ax));matrix.setPosition(origin.x,0,origin.z);
  return{origin,point,project,polygon,matrix,lo:Math.min(...polygon.map(p=>p[0])),hi:Math.max(...polygon.map(p=>p[0])),near:Math.min(...polygon.map(p=>p[1])),far:Math.max(...polygon.map(p=>p[1]))};
}

function prism(polygon:XY[],bottom:number,top:number){
  const geo=new T.ExtrudeGeometry(new T.Shape(polygon.map(p=>new T.Vector2(p[0],-p[1]))),{depth:top-bottom,bevelEnabled:false,steps:1});
  geo.rotateX(-Math.PI/2);geo.translate(0,bottom,0);return geo;
}

export function completeBridges(heightAt:(x:number,z:number)=>number):BridgeMesh[]{
  const out:BridgeMesh[]=[];
  for(const b of GEO.bridges){
    const f=bridgeFrame(b),top=profileLevel(b.at,'street'),floor=profileLevel(b.at,'floor');
    const level=BRIDGE_LEVELS.find(l=>l.name===b.name)!;
    const slabDepth=BRIDGE_SLAB_DEPTH,soffit=top-slabDepth;
    const foot=b.name.toLowerCase().includes('pedestrian'),historic=['Chestnut Street','Adelaide Street','Division Street','Wilkins Street'].includes(b.name);
    const bins=new Map<BridgeMesh['kind'],T.BufferGeometry[]>();
    function add(kind:BridgeMesh['kind'],geo:T.BufferGeometry){const list=bins.get(kind)??[];list.push(geo.index?geo.toNonIndexed():geo);bins.set(kind,list);}
    function box(kind:BridgeMesh['kind'],x:number,y:number,z:number,w:number,h:number,d:number,ry=0){
      if(w<=0||h<=0||d<=0)return;
      if(kind==='parapet'||kind==='metal'){
        const p=f.point(x,z),r=nearestRamp(p.x,p.z);
        if(r.distance<r.width/2+1&&y+h/2>r.height+.1&&y-h/2<r.height+2.5)return;
      }
      const g=new T.BoxGeometry(w,h,d);g.rotateY(ry);g.translate(x,y,z);add(kind,g);
    }
    function edgeBox(kind:BridgeMesh['kind'],a:XY,c:XY,y:number,h:number,width:number){
      const dx=c[0]-a[0],dz=c[1]-a[1],length=Math.hypot(dx,dz),n=kind==='parapet'||kind==='metal'?Math.ceil(length/.7):1;
      for(let j=0;j<n;j++)box(kind,a[0]+dx*(j+.5)/n,y,a[1]+dz*(j+.5)/n,length/n+.002,h,width,-Math.atan2(dz,dx));
    }
    add('deck',prism(f.polygon,soffit,top));
    add('roadway',prism(f.polygon,top+.006,top+.025));

    // Bank approaches continue the short mapped span at the same street datum.
    // Their end elevations meet the existing terrain, closing floating road edges.
    for(const side of [-1,1]){
      const endVertices=f.polygon.filter((p,i)=>{
        const a=f.polygon[(i+f.polygon.length-1)%f.polygon.length],c=f.polygon[(i+1)%f.polygon.length];
        return (p[0]-(f.lo+f.hi)/2)*side>0&&[a,c].some(q=>Math.abs(q[1]-p[1])>Math.abs(q[0]-p[0]));
      }).map(p=>p[0]);
      // Overlap to the innermost corner of a skew end, avoiding triangular gaps.
      const x0=endVertices.length?(side<0?Math.max(...endVertices):Math.min(...endVertices)):(side<0?f.lo:f.hi);
      let x1=x0;
      for(let n=0;n<45;n++){const p=f.point(x1,(f.near+f.far)/2);if(n>=2&&Math.abs(nearestCut(p.x,p.z).u)>30&&Math.abs(heightAt(p.x,p.z)-top)<.55)break;x1+=side;}
      if(Math.abs(x1-x0)<.2)continue;
      const count=Math.ceil(Math.abs(x1-x0)/2);
      for(let j=0;j<count;j++){
        const xa=x0+(x1-x0)*j/count,xb=x0+(x1-x0)*(j+1)/count;
        const polygon:XY[]=[[Math.min(xa,xb)-.01,f.near],[Math.max(xa,xb)+.01,f.near],[Math.max(xa,xb)+.01,f.far],[Math.min(xa,xb)-.01,f.far]];
        const g=prism(polygon,top-.65,top);
        const p=g.attributes.position;
        for(let v=0;v<p.count;v++){
          const t=Math.max(0,Math.min(1,(p.getX(v)-x0)/(x1-x0))),end=f.point(x1,p.getZ(v));
          p.setY(v,p.getY(v)+(heightAt(end.x,end.z)-top)*t);
        }
        g.computeVertexNormals();add('approach',g);
        const road=g.clone();const rp=road.attributes.position;
        // Reuse only the top faces for the finish, with no new collision shell.
        const positions:number[]=[];for(let v=0;v<rp.count;v+=3){if(road.attributes.normal.getY(v)>.7)for(let k=0;k<3;k++)positions.push(rp.getX(v+k),rp.getY(v+k)+.026,rp.getZ(v+k));}
        const surface=new T.BufferGeometry();surface.setAttribute('position',new T.Float32BufferAttribute(positions,3));surface.computeVertexNormals();surface.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(positions.length/3*2),2));add('roadway',surface);road.dispose();
      }
      // Concrete wing walls seal the exposed sides of each approach to the bank.
      for(const z of [f.near,f.far])for(let j=0;j<count;j++){
        const x=x0+(x1-x0)*(j+.5)/count,p=f.point(x,z),r=nearestRamp(p.x,p.z);
        if(Math.abs(nearestCut(p.x,p.z).u)<cutWidth(b.at)/2+1.2||r.distance<r.width/2+1)continue;
        const ground=heightAt(p.x,p.z)-.25,t=(j+.5)/count,end=f.point(x1,z),roof=top+(heightAt(end.x,end.z)-top)*t;
        box('abutment',x,(ground+roof)/2,z,Math.abs(x1-x0)/count+.03,roof-ground,.65);
      }
    }

    // End and intermediate supports are sampled individually. A nearby ramp may
    // remove a short section; it must not discard an entire side of the bridge.
    for(const side of [-1,1]){
      const support=side<0?Math.min(f.lo+.7,-8.5):Math.max(f.hi-.7,8.5);
      const n=Math.ceil((f.far-f.near)/1.1);
      for(let j=0;j<n;j++){
        const z=f.near+(j+.5)*(f.far-f.near)/n,p=f.point(support,z),r=nearestRamp(p.x,p.z),c=nearestCut(p.x,p.z);
        if(Math.abs(c.u)<cutWidth(c.d)/2+1.8||r.distance<r.width/2+1.2)continue;
        const base=Math.min(heightAt(p.x,p.z)-.35,floor-.2);
        box('abutment',support,(base+soffit)/2,z,1.1,soffit-base,(f.far-f.near)/n+.015);
        box('abutment',support,soffit-.14,z,1.55,.28,(f.far-f.near)/n+.015);
      }
    }

    // Stringers use the same audited full-width clearance as the roadway datum.
    const beamDepth=Math.max(0,Math.min(BRIDGE_BEAM_DEPTH,soffit-level.highFloor-level.minClearance));
    if(beamDepth>.04){
      const rows=Math.max(2,Math.floor((f.far-f.near)/2.4));
      for(let j=0;j<=rows;j++){const z=f.near+.7+(f.far-f.near-1.4)*j/rows;
        // Slice the mapped polygon so stringers cannot protrude from skew edges.
        const xs:number[]=[];for(let i=0;i<f.polygon.length;i++){const a=f.polygon[i],c=f.polygon[(i+1)%f.polygon.length];if((a[1]<=z&&c[1]>z)||(c[1]<=z&&a[1]>z))xs.push(a[0]+(c[0]-a[0])*(z-a[1])/(c[1]-a[1]));}
        xs.sort((a,b)=>a-b);if(xs.length>=2)box('beam',(xs[0]+xs.at(-1)!)/2,soffit-beamDepth/2,z,xs.at(-1)!-xs[0],beamDepth,.34);
      }
    }
    for(let i=0;i<f.polygon.length;i++){
      const a=f.polygon[i],c=f.polygon[(i+1)%f.polygon.length],dx=c[0]-a[0],dz=c[1]-a[1],length=Math.hypot(dx,dz);
      if(length<1||Math.abs(dx)/length<.7)continue;
      const midz=(a[1]+c[1])/2,inward=midz>(f.near+f.far)/2?-1:1;
      const fasciaDepth=Math.min(.78,slabDepth);
      edgeBox('beam',a,c,top-fasciaDepth/2,fasciaDepth,.48);
      const aa:XY=[a[0],a[1]+inward*.72],cc:XY=[c[0],c[1]+inward*.72];
      edgeBox('sidewalk',aa,cc,top+.08,.16,foot?.65:1.35);
      edgeBox('parapet',a,c,top+.22,.44,.4);
      if(historic){
        // Recessed-panel concrete parapets, with heavier pier posts and coping.
        edgeBox('parapet',a,c,top+.88,.18,.46);
        const bays=Math.ceil(length/3.2);
        for(let j=0;j<bays;j++){
          const t0=j/bays,t1=(j+1)/bays,p0:XY=[a[0]+dx*t0,a[1]+dz*t0],p1:XY=[a[0]+dx*t1,a[1]+dz*t1];
          edgeBox('parapet',p0,p1,top+.59,.56,.19);
          box('parapet',p0[0],top+.57,p0[1],.4,1.14,.52);
        }
        box('parapet',c[0],top+.57,c[1],.4,1.14,.52);
      }else{
        edgeBox('metal',a,c,top+1.14,.07,.07);
        edgeBox('metal',a,c,top+.68,.045,.045);
        const posts=Math.ceil(length/.6);
        for(let j=0;j<=posts;j++)box('metal',a[0]+dx*j/posts,top+.75,a[1]+dz*j/posts,.05,.84,.05);
      }
    }
    for(const[kind,geos]of bins){
      if(!geos.length)continue;
      const geometry=mergeGeometries(geos,false)!;geometry.applyMatrix4(f.matrix);geometry.computeBoundingBox();
      const source=`${b.source}; ${level.source}; authored ${kind}`;
      out.push({name:b.name+' / '+kind,bridge:b.name,kind,geometry,source,collision:kind!=='roadway'&&kind!=='sidewalk'});
      for(const g of geos)g.dispose();
    }
  }
  return out;
}

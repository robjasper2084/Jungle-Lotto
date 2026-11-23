import * as T from 'three';

const corners=['FL','FR','RL','RR'] as const;
type Point=Readonly<{x:number;y:number;z:number}>;
/** Match the chassis' suspension rotation in the hub's horizontal position.
 * Vertical extension/contact remains owned by the suspension solver. Keeping
 * X/Z fixed instead slides a rolled fender sideways through its tire. */
export function cadillacSuspensionHubXZ(anchor:Point,pose:Readonly<{pitch:number;roll:number}>,target:{x:number;z:number}){
  const cx=Math.cos(pose.pitch),sx=Math.sin(pose.pitch),cz=Math.cos(pose.roll),sz=Math.sin(pose.roll);
  target.x=cz*anchor.x-sz*anchor.y;
  target.z=sx*sz*anchor.x+sx*cz*anchor.y+cx*anchor.z;
  return target;
}
export type CadillacWheelClearanceSample={
  /** Chassis local coordinates to the ride model's local coordinates. */
  bodyMatrix:T.Matrix4;
  /** Actual hub centers and steering yaw, in the same model coordinates. */
  wheelCenters:readonly Point[];
  steering:readonly number[];
};
type Wheel={
  center:T.Vector3;minX:number;maxX:number;radius:number;triangles:Float64Array;
  baselines:Map<number,Float64Array>;
};
export type CadillacWheelClearanceFailure={corner:typeof corners[number];sample:number;extraPenetration:number};
const tolerance=.001;
const finitePoint=(point:Point|undefined)=>!!point&&Number.isFinite(point.x)&&Number.isFinite(point.y)&&Number.isFinite(point.z);

/** A parked customization guard for the authored fender crowns, not a new
 * physics solver. Source axles/underbody already intersect the stock wheel
 * volume; only source geometry above the upper quarter of each tire is a
 * fender crown. The real GLB triangles are clipped to that region once.
 *
 * A tire's measured rotating cylinder is conservative. Any overlap already
 * present in the original model at the same steering angle is retained per
 * source triangle. A command may not increase it by more than one millimetre.
 * Cache and scratch storage are bounded; validation does no scene traversal,
 * GPU work or per-triangle allocation. Normal driving never calls this guard. */
export class CadillacWheelClearance{
  private readonly wheels:Wheel[];
  private readonly neutralBody=new T.Matrix4();
  private readonly transformed=new Float64Array(9);
  private readonly clippedA=new Float64Array(24);
  private readonly clippedB=new Float64Array(24);
  private reason:CadillacWheelClearanceFailure|null=null;
  private calls=0;
  private triangleChecks=0;

  constructor(model:T.Object3D,body:T.Object3D,hubs:readonly T.Object3D[],variant:'cadillac'|'hydraulic-cadillac'){
    if(hubs.length!==4)throw Error('Cadillac fender clearance requires four hubs.');
    model.updateWorldMatrix(true,true);
    const modelInverse=model.matrixWorld.clone().invert(),bodyInverse=body.matrixWorld.clone().invert();
    this.neutralBody.multiplyMatrices(modelInverse,body.matrixWorld);
    const point=new T.Vector3(),matrix=new T.Matrix4();
    this.wheels=hubs.map((hub,index)=>{
      const center=hub.getWorldPosition(new T.Vector3()).applyMatrix4(modelInverse);
      let minX=Infinity,maxX=-Infinity,radius=0,count=0;
      hub.traverse(object=>{
        if(!(object instanceof T.Mesh))return;
        const names=([object.material].flat() as T.Material[]).map(material=>material.name);
        if(!names.some(name=>name==='Whitewall and tread'||name==='Cadillac_Rubber'))return;
        matrix.multiplyMatrices(modelInverse,object.matrixWorld);
        const positions=object.geometry.getAttribute('position');
        for(let i=0;i<positions.count;i++){
          point.fromBufferAttribute(positions,i).applyMatrix4(matrix).sub(center);
          minX=Math.min(minX,point.x);maxX=Math.max(maxX,point.x);radius=Math.max(radius,Math.hypot(point.y,point.z));count++;
        }
      });
      if(!count||!Number.isFinite(radius)||radius<=0)throw Error('Cadillac tire clearance geometry missing: '+corners[index]);
      // The alternative sidewalls stay inside these measured rolling radii.
      // Their widest rubber ring is .112/.1218m from the axle center.
      const customHalf=variant==='cadillac'?.112:.1218;
      return{center,minX:Math.min(minX,-customHalf),maxX:Math.max(maxX,customHalf),radius,triangles:new Float64Array(),baselines:new Map()};
    });
    const captured:number[][]=this.wheels.map(()=>[]),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
    const world=[new T.Vector3(),new T.Vector3(),new T.Vector3()],neutralInverse=this.neutralBody.clone().invert();
    body.traverse(object=>{
      if(!(object instanceof T.Mesh)||object instanceof T.SkinnedMesh)return;
      matrix.multiplyMatrices(bodyInverse,object.matrixWorld);
      const positions=object.geometry.getAttribute('position'),indices=object.geometry.index;
      for(let i=0,count=indices?.count??positions.count;i<count;i+=3){
        a.fromBufferAttribute(positions,indices?indices.getX(i):i).applyMatrix4(matrix);
        b.fromBufferAttribute(positions,indices?indices.getX(i+1):i+1).applyMatrix4(matrix);
        c.fromBufferAttribute(positions,indices?indices.getX(i+2):i+2).applyMatrix4(matrix);
        // Both authored models have a unit neutral chassis transform. Express
        // the crop through its matrix so a future translated asset stays valid.
        world[0].copy(a).applyMatrix4(this.neutralBody);world[1].copy(b).applyMatrix4(this.neutralBody);world[2].copy(c).applyMatrix4(this.neutralBody);
        const minX=Math.min(world[0].x,world[1].x,world[2].x),maxX=Math.max(world[0].x,world[1].x,world[2].x);
        const minY=Math.min(world[0].y,world[1].y,world[2].y),maxY=Math.max(world[0].y,world[1].y,world[2].y);
        const minZ=Math.min(world[0].z,world[1].z,world[2].z),maxZ=Math.max(world[0].z,world[1].z,world[2].z);
        for(let wheelIndex=0;wheelIndex<4;wheelIndex++){
          const wheel=this.wheels[wheelIndex],hub=wheel.center;
          if(maxX<hub.x-.65||minX>hub.x+.65||maxZ<hub.z-.85||minZ>hub.z+.85||maxY<hub.y+wheel.radius*.75||minY>hub.y+.8)continue;
          // Clip in model coordinates, then return each resulting triangle to
          // chassis local coordinates for all subsequent parked commands.
          const polygon:T.Vector3[]=[],cut=hub.y+wheel.radius*.75;
          for(let vertex=0;vertex<3;vertex++){
            const from=world[vertex],to=world[(vertex+1)%3],fromInside=from.y>=cut,toInside=to.y>=cut;
            if(fromInside)polygon.push(from.clone());
            if(fromInside!==toInside)polygon.push(from.clone().lerp(to,(cut-from.y)/(to.y-from.y)));
          }
          for(const vertex of polygon)vertex.applyMatrix4(neutralInverse);
          for(let vertex=1;vertex+1<polygon.length;vertex++)for(const p of [polygon[0],polygon[vertex],polygon[vertex+1]])captured[wheelIndex].push(p.x,p.y,p.z);
        }
      }
    });
    for(let i=0;i<4;i++){
      this.wheels[i].triangles=Float64Array.from(captured[i]);
      if(!captured[i].length)throw Error('Cadillac fender crown geometry missing: '+corners[i]);
    }
  }

  get failure(){return this.reason?{...this.reason}:null;}

  /** Signed radial gap from a transformed triangle to the axle-aligned tire
   * cylinder. Axial slab clipping catches crossings even when every triangle
   * vertex lies outside the tire. This is why vertex-only tests are inadequate. */
  private gap(triangles:Float64Array,start:number,matrix:T.Matrix4,center:Point,angle:number,wheel:Wheel){
    const m=matrix.elements,cos=Math.cos(angle),sin=Math.sin(angle),points=this.transformed;
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,minZ=Infinity,maxZ=-Infinity;
    for(let i=0;i<3;i++){
      const j=start+i*3,x=triangles[j],y=triangles[j+1],z=triangles[j+2];
      const px=m[0]*x+m[4]*y+m[8]*z+m[12]-center.x,py=m[1]*x+m[5]*y+m[9]*z+m[13]-center.y,pz=m[2]*x+m[6]*y+m[10]*z+m[14]-center.z;
      const tx=cos*px-sin*pz,tz=sin*px+cos*pz;
      points[i*3]=tx;points[i*3+1]=py;points[i*3+2]=tz;
      minX=Math.min(minX,tx);maxX=Math.max(maxX,tx);minY=Math.min(minY,py);maxY=Math.max(maxY,py);minZ=Math.min(minZ,tz);maxZ=Math.max(maxZ,tz);
    }
    if(maxX<wheel.minX||minX>wheel.maxX||minY>wheel.radius||maxY< -wheel.radius||minZ>wheel.radius||maxZ< -wheel.radius)return Infinity;
    let input=this.clippedA,output=this.clippedB,count=3;
    input.set(points);
    for(let plane=0;plane<2;plane++){
      const boundary=plane===0?wheel.minX:wheel.maxX;let next=0;
      for(let i=0;i<count;i++){
        const ai=i*3,bi=((i+1)%count)*3,ax=input[ai],bx=input[bi];
        const insideA=plane===0?ax>=boundary:ax<=boundary,insideB=plane===0?bx>=boundary:bx<=boundary;
        if(insideA){output[next++]=ax;output[next++]=input[ai+1];output[next++]=input[ai+2];}
        if(insideA!==insideB){const t=(boundary-ax)/(bx-ax);output[next++]=boundary;output[next++]=input[ai+1]+(input[bi+1]-input[ai+1])*t;output[next++]=input[ai+2]+(input[bi+2]-input[ai+2])*t;}
      }
      count=next/3;if(count<3)return Infinity;
      const swap=input;input=output;output=swap;
    }
    let squared=Infinity,area=0,positive=false,negative=false;
    for(let i=0;i<count;i++){
      const ai=i*3,bi=((i+1)%count)*3,y=input[ai+1],z=input[ai+2],dy=input[bi+1]-y,dz=input[bi+2]-z;
      const length=dy*dy+dz*dz,t=length>1e-20?Math.max(0,Math.min(1,-(y*dy+z*dz)/length)):0;
      squared=Math.min(squared,(y+t*dy)**2+(z+t*dz)**2);
      const cross=y*input[bi+2]-z*input[bi+1];area+=cross;positive||=cross>1e-12;negative||=cross< -1e-12;
    }
    if(Math.abs(area)>1e-12&&!(positive&&negative))squared=0;
    return Math.sqrt(squared)-wheel.radius;
  }

  private baseline(wheel:Wheel,angle:number){
    let baseline=wheel.baselines.get(angle);
    if(baseline)return baseline;
    baseline=new Float64Array(wheel.triangles.length/9);
    for(let i=0;i<baseline.length;i++)baseline[i]=Math.min(0,this.gap(wheel.triangles,i*9,this.neutralBody,wheel.center,angle,wheel));
    // Steering can change while driving. Retain only the eight most recently
    // requested angles per wheel, so parked edits cannot grow memory forever.
    if(wheel.baselines.size>=8)wheel.baselines.delete(wheel.baselines.keys().next().value!);
    wheel.baselines.set(angle,baseline);return baseline;
  }

  clearPath(samples:readonly CadillacWheelClearanceSample[]){
    this.calls++;this.triangleChecks=0;this.reason=null;
    if(!samples.length||samples.length>256)return false;
    for(let sampleIndex=0;sampleIndex<samples.length;sampleIndex++){
      const sample=samples[sampleIndex];
      if(sample.wheelCenters.length!==4||sample.steering.length!==4||!sample.bodyMatrix.elements.every(Number.isFinite)||
        !sample.wheelCenters.every(finitePoint)||!sample.steering.every(Number.isFinite))return false;
      for(let wheelIndex=0;wheelIndex<4;wheelIndex++){
        const wheel=this.wheels[wheelIndex],angle=sample.steering[wheelIndex],baseline=this.baseline(wheel,angle);
        for(let i=0;i<baseline.length;i++){
          this.triangleChecks++;
          const gap=this.gap(wheel.triangles,i*9,sample.bodyMatrix,sample.wheelCenters[wheelIndex],angle,wheel);
          if(gap<baseline[i]-tolerance){this.reason={corner:corners[wheelIndex],sample:sampleIndex,extraPenetration:baseline[i]-gap};return false;}
        }
      }
    }
    return true;
  }

  diagnostics(){return{crownTriangles:this.wheels.map(wheel=>wheel.triangles.length/9),baselineAngles:this.wheels.map(wheel=>wheel.baselines.size),calls:this.calls,triangleChecks:this.triangleChecks,toleranceMetres:tolerance};}
}

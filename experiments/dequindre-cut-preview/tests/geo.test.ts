import test from 'node:test';
import assert from 'node:assert/strict';
import {fromSwoop,toSwoop,fromSourceMap,toSourceMap,fromSwoopNormal,fromSwoopDirection,toSwoopRay,SWOOP_MAP_ORIGIN,SWOOP_TO_BELLE_MATRIX,fromSwoopHeading,toSwoopHeading} from '../src/geo.ts';

const close=(a:number,b:number,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
test('map position matches independent GPS projection, including handedness and datum',()=>{
  for(const [x,z] of [[0,0],[246.530706,-1248.540394],[1657.439113,-1337.876279],[2600,-1400],[-250,-1750]]){
    const east=-.5*x-.8660254*z,north=.8660254*x-.5*z;
    const lat=42.3283+north/111320,lon=-83.0399+east/(111320*Math.cos(42.3283*Math.PI/180));
    const expectedX=111320*Math.cos(42.34680*Math.PI/180)*(lon+83.00175),expectedZ=-111320*(lat-42.34680);
    const actual=fromSourceMap(x,7,z);close(actual.x,expectedX,2e-8);close(actual.z,expectedZ,2e-8);close(actual.y,9);
  }
});
test('all three frames round-trip across the entire city extent',()=>{
  for(let x=-900;x<=4250;x+=257)for(let z=-4200;z<=1100;z+=263){
    const y=Math.sin(x+z)*12,belle=fromSourceMap(x,y,z),map=toSourceMap(belle.x,belle.y,belle.z);
    close(map.x,x);close(map.y,y);close(map.z,z);
    const local={x:SWOOP_MAP_ORIGIN.x-x,y:y-SWOOP_MAP_ORIGIN.y,z:z-SWOOP_MAP_ORIGIN.z};
    const host=fromSwoop(local.x,local.y,local.z),back=toSwoop(host.x,host.y,host.z);
    close(back.x,local.x);close(back.y,local.y);close(back.z,local.z);
  }
});
test('renderer matrix is the same frame as collision points',()=>{
  const p={x:135,y:-4,z:710},m=SWOOP_TO_BELLE_MATRIX,world=fromSwoop(p.x,p.y,p.z);
  close(m[0]*p.x+m[4]*p.y+m[8]*p.z+m[12],world.x);
  close(m[1]*p.x+m[5]*p.y+m[9]*p.z+m[13],world.y);
  close(m[2]*p.x+m[6]*p.y+m[10]*p.z+m[14],world.z);
  assert.ok(m[0]*m[10]-m[2]*m[8]>0,'local render transform must not add a second reflection');
});
test('normal is perpendicular to both transformed slope tangents',()=>{
  const slopeX=.37,slopeZ=-.21;
  const n=fromSwoopNormal(-slopeX,1,-slopeZ),a=fromSwoopDirection(1,slopeX,0),b=fromSwoopDirection(0,slopeZ,1);
  close(n.x*a.x+n.y*a.y+n.z*a.z,0,1e-12);close(n.x*b.x+n.y*b.y+n.z*b.z,0,1e-12);close(Math.hypot(n.x,n.y,n.z),1);
});
test('ray conversion preserves endpoints and world hit distances under affine scale',()=>{
  const origin={x:-2400,y:7,z:800},direction={x:.8,y:-.3,z:.5},distance=120;
  const ray=toSwoopRay(origin,direction,distance)!;
  const endpoint=fromSwoop(ray.origin.x+ray.direction.x*ray.maxDistance,ray.origin.y+ray.direction.y*ray.maxDistance,ray.origin.z+ray.direction.z*ray.maxDistance);
  const norm=Math.hypot(direction.x,direction.y,direction.z);
  close(endpoint.x,origin.x+direction.x/norm*distance);close(endpoint.y,origin.y+direction.y/norm*distance);close(endpoint.z,origin.z+direction.z/norm*distance);
  close(ray.maxDistance/ray.scale,distance);assert.equal(toSwoopRay(origin,{x:0,y:0,z:0},10),null);
});
test('heading survives geographical rotation without mirroring turns',()=>{
  for(let h=-Math.PI;h<=Math.PI;h+=.07){const delta=toSwoopHeading(fromSwoopHeading(h))-h;close(Math.atan2(Math.sin(delta),Math.cos(delta)),0);}
});

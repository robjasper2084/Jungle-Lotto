import * as T from 'three';
import type {ParkMap} from './terrain.ts';
import {makeRiverTraffic,vesselPose,vesselRay,type VesselPose} from './riverTrafficPlan.ts';
import {vesselModel} from './riverVessels.ts';
export type ShipWake={x:number;z:number;dx:number;dz:number;length:number;width:number;power:number};
/** Fixed fleet: no repeated allocations, model loads, or route searches during play. */
export function createRiverTraffic(scene:T.Scene,map:ParkMap){
 const fleet=makeRiverTraffic(map),root=new T.Group();root.name='Detroit River traffic';scene.add(root);
 const time={value:0},light={value:1};let previous:number|undefined,clock=0;
 const wakeGeometry=new T.PlaneGeometry(1,1).rotateX(-Math.PI/2).translate(0,0,-.5);
 const entries=fleet.map(v=>{
  const model=vesselModel(v.kind,v.length,v.width);model.group.name=v.id;root.add(model.group);
  const pose:VesselPose={x:0,z:0,heading:0,speed:0,visible:false,fade:0};
  const wake:ShipWake={x:0,z:0,dx:0,dz:1,length:v.kind==='fishing'?18:Math.min(240,v.length*1.5),width:v.width,power:v.anchored?0:Math.min(1,v.speed/4)};
  const alpha={value:0},breadth=v.width+Math.max(12,wake.length*.5);
  const material=new T.ShaderMaterial({uniforms:{time,light,alpha,trail:{value:wake.length},breadth:{value:breadth},hullWidth:{value:v.width}},transparent:true,depthWrite:false,side:T.DoubleSide,
   vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
   fragmentShader:`uniform float time,light,alpha,trail,breadth,hullWidth;varying vec2 vUv;
void main(){float aft=vUv.y*trail,side=abs((vUv.x-.5)*breadth);float progress=aft/trail;
float vEdge=hullWidth*.42+aft*.22;float ripple=sin(aft*.8-time*3.+side*.5)*.45;
float arms=exp(-pow((side-vEdge+ripple)/max(.3,hullWidth*.08+aft*.018),2.));
float churn=exp(-side*side/pow(hullWidth*.35+aft*.055,2.))*exp(-progress*5.);
float breakup=.4+.6*pow(.5+.5*sin(aft*1.7+side*2.3-time*2.)*sin(side*3.-aft*.7+time),2.);
float foam=(arms*.4+churn*.48)*breakup*(1.-smoothstep(.35,1.,progress))*smoothstep(0.,.04,progress)*alpha;
if(foam<.004)discard;gl_FragColor=vec4(vec3(.67,.79,.77)*light,foam);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});
  const foam=new T.Mesh(wakeGeometry,material);foam.name=v.id+' ripple wake';foam.scale.set(breadth,1,wake.length);root.add(foam);
  return{v,model,pose,wake,foam,alpha};
 });
 const selected:ShipWake[]=[];
 return {stats:{vessels:fleet.length,industrial:fleet.filter(v=>v.kind==='freighter'||v.kind==='tanker').length,excursion:1,fishing:fleet.filter(v=>v.kind==='fishing').length,anchored:fleet.filter(v=>v.anchored).length},
  raycast(o:{x:number;y:number;z:number},d:{x:number;y:number;z:number},max:number,half=1){let nearest:number|null=null;for(const e of entries){if(e.pose.fade<.01)continue;const hit=vesselRay(e.v,e.pose,o,d,max,half);if(hit!==null&&(nearest===null||hit<nearest))nearest=hit;}return nearest;},
  update(t:number,x:number,z:number,night:number,skyLight:number,running=true){if(previous!==undefined&&running)clock+=Math.max(0,Math.min(.1,t-previous));previous=t;time.value=clock;light.value=Math.max(.13,skyLight);selected.length=0;
   for(const e of entries){const {v,pose,model,wake,foam}=e;vesselPose(v,clock,x,z,pose);model.group.visible=pose.visible;model.fade.value=pose.fade;model.lamps.visible=night>.1&&pose.fade>.15;
    model.group.position.set(pose.x,Math.sin(clock*.6+v.phase*10)*(v.kind==='fishing'?.06:.035),pose.z);model.group.rotation.set(0,pose.heading,Math.sin(clock*.4+v.phase*15)*(v.kind==='fishing'?.012:.001));
    wake.dx=Math.sin(pose.heading);wake.dz=Math.cos(pose.heading);wake.x=pose.x-wake.dx*v.length*.49;wake.z=pose.z-wake.dz*v.length*.49;
    foam.visible=pose.visible&&!v.anchored;foam.position.set(wake.x,.24,wake.z);foam.rotation.y=pose.heading;e.alpha.value=pose.fade*wake.power;
    if(!v.anchored&&pose.visible&&Math.hypot(pose.x-x,pose.z-z)<650)selected.push(wake);
   }
   selected.sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z));selected.length=Math.min(4,selected.length);return selected;
  }
 };
}

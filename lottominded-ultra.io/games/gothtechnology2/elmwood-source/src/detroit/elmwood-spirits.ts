import * as T from 'three';
import {SpiritEncounters,type SpiritRider,type SpiritSpot} from './elmwood-spirit-events.ts';
import {createGroundSample} from '../simulation/world.ts';
import type {ElmwoodTerrain} from './elmwood-terrain.ts';

/** Lightweight spectral cloth silhouette; no camera kick, flashing or collisions. */
export function makeElmwoodSpirits(scene:T.Scene){
  const events=new SpiritEncounters(),root=new T.Group();root.name='Passing Elmwood spirit';root.visible=false;scene.add(root);
  const cloth=new T.MeshBasicMaterial({color:0xc0efe7,transparent:true,opacity:0,side:T.DoubleSide,depthWrite:false});
  const face=new T.MeshBasicMaterial({color:0x101c27,transparent:true,opacity:0,depthWrite:false});
  const gleam=new T.MeshBasicMaterial({color:0xe2fffa,transparent:true,opacity:0,depthWrite:false});
  const profile=[[.5,.06],[.42,.4],[.34,.9],[.43,1.38],[.3,1.58],[.24,1.85],[.11,2.03],[0,2.07]].map(([x,y])=>new T.Vector2(x,y));
  const robeGeometry=new T.LatheGeometry(profile,20),positions=robeGeometry.getAttribute('position');
  for(let i=0;i<positions.count;i++){const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i),angle=Math.atan2(z,x);const fold=1+.08*Math.cos(angle*7)*(1-y/2.1);positions.setXYZ(i,x*fold,y+(y<.1?.10*(1+Math.sin(angle*5)):0),z*fold*.65);}robeGeometry.computeVertexNormals();
  root.add(new T.Mesh(robeGeometry,cloth));
  const hood=new T.Mesh(new T.SphereGeometry(1,16,10),face);hood.scale.set(.145,.205,.08);hood.position.set(0,1.72,.175);root.add(hood);
  for(const side of [-1,1]){const eye=new T.Mesh(new T.SphereGeometry(.02,8,6),gleam);eye.position.set(side*.057,1.76,.251);root.add(eye);}
  const haze=new T.Mesh(new T.ConeGeometry(.57,1.75,16,1,true),cloth);haze.position.y=.9;haze.rotation.y=.3;root.add(haze);
  const sample=createGroundSample();let audio:AudioContext|undefined;const sounding=new Set<AudioBufferSourceNode>();
  function stopSound(){for(const source of sounding){try{source.stop();}catch{}}sounding.clear();}
  function sound(){if(audio?.state!=='running')return;const ctx=audio,buffer=ctx.createBuffer(1,ctx.sampleRate*.65,ctx.sampleRate),data=buffer.getChannelData(0);let low=0;for(let i=0;i<data.length;i++){const t=i/ctx.sampleRate;low+=(Math.random()*2-1-low)*.035;data[i]=(low*.7+Math.sin(2*Math.PI*(155*t-48*t*t))*.12)*Math.sin(Math.PI*t/.65);}const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffer;gain.gain.value=.12;source.connect(gain).connect(ctx.destination);source.onended=()=>{source.disconnect();gain.disconnect();sounding.delete(source);};sounding.add(source);source.start();}
  return {events,root,async unlockSound(){audio??=new AudioContext();await audio.resume();},reset(){events.reset();root.visible=false;stopSound();},hide(){events.clear();root.visible=false;stopSound();},
    update(dt:number,riders:SpiritRider[],terrain:ElmwoodTerrain,paused:boolean,enabled:boolean,soundEnabled:boolean,reducedMotion:boolean){
      const triggered=events.update(dt,riders,paused,enabled,(r,seat,side):SpiritSpot|undefined=>{
        const forward=r.speed<0?-1:1,sin=Math.sin(r.headingY),cos=Math.cos(r.headingY);
        const x=r.x+sin*6*forward+cos*side*3.3,z=r.z+cos*6*forward-sin*side*3.3;
        terrain.sampleGround(x,z,sample);if(sample.offCourse||Math.abs(sample.height-r.y)>1.5)return;
        const dx=x-r.x,dz=z-r.z,length=Math.hypot(dx,dz);
        if(terrain.raycastObstacle({x:r.x,y:r.y+1,z:r.z},{x:dx/length,y:0,z:dz/length},length+.3,.4)!==null)return;
        return {x,y:sample.height,z,heading:Math.atan2(r.x-x,r.z-z),seat,side};
      });
      if(paused||!soundEnabled)stopSound();if(triggered&&soundEnabled)sound();
      const spot=events.active;root.visible=!!spot&&enabled;if(!spot)return triggered;
      const age=events.age,fade=Math.min(1,age/(reducedMotion?.65:.16))*Math.min(1,(3.8-age)/1.2);
      cloth.opacity=fade*.53;face.opacity=fade*.76;gleam.opacity=fade*.85;
      const drift=reducedMotion?.05:Math.sin(age*1.5)*.14;
      root.position.set(spot.x,spot.y+.13+drift+age*.09,spot.z);root.rotation.y=spot.heading;root.scale.y=.9+.1*Math.min(1,age/(reducedMotion?.65:.16));
      return triggered;
    }
  };
}

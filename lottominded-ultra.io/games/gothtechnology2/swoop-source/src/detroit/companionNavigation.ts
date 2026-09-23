import type {NavigationObstacle} from './terrain.ts';
export type DogJump={id:string;duration:number;launchSpeed:number;vx:number;vz:number;base:number;elapsed:number};
/** Predict traffic occupancy and choose a stable passing side. Humans are never jump targets. */
export function companionRoute(x:number,y:number,z:number,vx:number,vz:number,obstacles:NavigationObstacle[],passingSide:number){
  const speed=Math.hypot(vx,vz),nx=vx/Math.max(.01,speed),nz=vz/Math.max(.01,speed),look=Math.max(2.8,speed*1.2);
  const candidates=obstacles.map(o=>{
    const time=Math.max(0,Math.min(.65,((o.x-x)*nx+(o.z-z)*nz)/Math.max(1,speed)));
    const ox=o.x+o.vx*time,oz=o.z+o.vz*time,along=(ox-x)*nx+(oz-z)*nz,side=(ox-x)*nz-(oz-z)*nx;
    return {o,ox,oz,along,side};
  }).filter(c=>c.along>-(c.o.radius+.7)&&c.along<look+c.o.radius&&Math.abs(c.side)<c.o.radius+.7&&Math.abs(c.o.y-y)<1.3).sort((a,b)=>a.along-b.along);
  const c=candidates[0];if(!c||speed<.1)return null;
  const {o,along}=c;
  if(['cone','bench','rock'].includes(o.kind)&&Math.hypot(o.vx,o.vz)<.01&&o.height<=.85&&speed>=2.5){
    const apex=o.height+.32+9.81*(o.radius+.7)**2/(2*speed*speed),duration=2*Math.sqrt(2*apex/9.81),takeoff=speed*duration/2;
    if(apex<=1.65&&along>takeoff-speed*.08&&along<=takeoff){
      const endX=x+nx*speed*duration,endZ=z+nz*speed*duration;
      if(!obstacles.some(other=>other.id!==o.id&&Math.hypot(other.x+other.vx*duration-endX,other.z+other.vz*duration-endZ)<other.radius+.85))
        return {jump:{id:o.id,duration,launchSpeed:9.81*duration/2,vx:nx*speed,vz:nz*speed,base:y,elapsed:0} satisfies DogJump};
    }
    if(along>takeoff&&apex<=1.65)return {approachJump:true};
  }
  const side=passingSide||((c.side>0)?-1:1),margin=o.radius+.9;
  return {id:o.id,side,waypoint:{x:c.ox+nz*side*margin,z:c.oz-nx*side*margin}};
}

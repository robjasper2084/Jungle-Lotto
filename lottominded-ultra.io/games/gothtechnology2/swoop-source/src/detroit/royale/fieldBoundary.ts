import * as T from 'three';
/** A fixed-width border follows the authored ground instead of scaling a torus
 * into a road-sized blue bar when the opening circle covers the whole Cut. */
export class FieldBoundary extends T.LineLoop {
 private radius=-1;private cx=NaN;private cz=NaN;
 private arcs:T.LineSegments;
 constructor(color:string,opacity:number){
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(192*3),3));
  super(geometry,new T.LineBasicMaterial({color,transparent:true,opacity,fog:false,depthWrite:false}));
  const arcGeometry=new T.BufferGeometry();arcGeometry.setAttribute('position',new T.BufferAttribute(new Float32Array(48*6),3));
  this.arcs=new T.LineSegments(arcGeometry,new T.LineBasicMaterial({color:'#adfff0',transparent:true,opacity:.65,depthWrite:false}));this.arcs.frustumCulled=false;this.arcs.visible=false;this.add(this.arcs);
 }
 energize(time:number,remaining:number,reduced:boolean,low:boolean){
  const warning=remaining<8;const material=this.material as T.LineBasicMaterial;
  material.color.set(warning?'#ffb36e':'#63efd9');material.opacity=reduced?.85:.78+Math.sin(time*(warning?4:1.5))*.12;
  this.arcs.visible=!low&&!reduced&&this.radius>0;if(!this.arcs.visible)return;
  const base=this.geometry.getAttribute('position'),out=this.arcs.geometry.getAttribute('position') as T.BufferAttribute;
  for(let i=0;i<48;i++){const at=(i*4+Math.floor(time*7))%base.count,next=(at+1)%base.count;const h=.5+(Math.sin(i*2.7+time*3)+1)*(warning?1.5:.7);
   out.setXYZ(i*2,base.getX(at),base.getY(at),base.getZ(at));out.setXYZ(i*2+1,base.getX(next),base.getY(next)+h,base.getZ(next));}
  out.needsUpdate=true;
 }
 update(x:number,z:number,radius:number,ground:(x:number,z:number)=>number){
  if(x===this.cx&&z===this.cz&&Math.abs(radius-this.radius)<.5)return;
  this.cx=x;this.cz=z;this.radius=radius;
  const vertices=this.geometry.getAttribute('position') as T.BufferAttribute;
  for(let i=0;i<vertices.count;i++){
   const a=i/vertices.count*Math.PI*2,px=x+Math.cos(a)*radius,pz=z+Math.sin(a)*radius;
   vertices.setXYZ(i,px,ground(px,pz)+.35,pz);
  }
  vertices.needsUpdate=true;this.geometry.computeBoundingSphere();
 }
}

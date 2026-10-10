import * as T from 'three';
/** A fixed-width border follows the authored ground instead of scaling a torus
 * into a road-sized blue bar when the opening circle covers the whole Cut. */
export class FieldBoundary extends T.LineLoop {
 private radius=-1;private cx=NaN;private cz=NaN;
 constructor(color:string,opacity:number){
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(192*3),3));
  super(geometry,new T.LineBasicMaterial({color,transparent:true,opacity,fog:false,depthWrite:false}));
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

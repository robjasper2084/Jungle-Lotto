import * as T from 'three';
/** Snap in light-space so the shadow projection does not crawl as the rider moves. */
export function followStableSun(sun:T.DirectionalLight,focus:{x:number;y:number;z:number},direction:T.Vector3){
 const forward=direction.clone().normalize(),right=new T.Vector3(0,1,0).cross(forward).normalize(),up=forward.clone().cross(right).normalize();
 const p=new T.Vector3(focus.x,focus.y,focus.z),c=sun.shadow.camera;
 const sx=(c.right-c.left)/Math.max(1,sun.shadow.mapSize.x),sy=(c.top-c.bottom)/Math.max(1,sun.shadow.mapSize.y);
 const x=p.dot(right),y=p.dot(up);p.addScaledVector(right,Math.round(x/sx)*sx-x).addScaledVector(up,Math.round(y/sy)*sy-y);
 sun.target.position.copy(p);sun.position.copy(p).addScaledVector(forward,48);
}

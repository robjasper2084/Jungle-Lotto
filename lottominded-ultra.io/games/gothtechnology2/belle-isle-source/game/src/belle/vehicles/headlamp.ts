import {Object3D,Scene,SpotLight} from 'three';
import {CORLEO_SCALE} from './corleoFit.ts';

/** Reserve one light during island startup. Selecting or leaving a vehicle
 * changes uniforms, never the scene's shader light count. */
export class VehicleHeadlamp{
 readonly light=new SpotLight(0xcdeaff,0,24,.45,.65,1);
 constructor(scene:Scene){this.light.name='Shared vehicle headlamp';scene.add(this.light,this.light.target);}
 update(root:Object3D,corleo:boolean,on:boolean,high:boolean,night:number){
  root.updateWorldMatrix(true,false);
  this.light.position.set(0,corleo?1.8*CORLEO_SCALE:.8,.8).applyMatrix4(root.matrixWorld);
  this.light.target.position.set(0,0,20).applyMatrix4(root.matrixWorld);
  this.light.intensity=on?(high?60:35)*(.25+.75*Math.max(0,Math.min(1,night))):0;
 }
 off(){this.light.intensity=0;}
}

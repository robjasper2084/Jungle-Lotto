import type {PerspectiveCamera,Vector3} from 'three';

/** A cockpit eye follows its physical vehicle without chase-camera spring lag.
 * Third-person cameras retain smoothing, including on mobile split views.
 * This is presentation-only: never writes vehicle or simulation coordinates.
 */
export function placeCoopCamera(
 camera:PerspectiveCamera, eye:Vector3, lookAt:Vector3,
 dt:number, firstPerson:boolean, snap:boolean, reducedMotion:boolean, mountedVehicle:boolean
):void{
 if(firstPerson||snap||reducedMotion)camera.position.copy(eye);
 else camera.position.lerp(eye,1-Math.exp(-Math.min(.1,Math.max(0,Number.isFinite(dt)?dt:0))*12));
 const fov=firstPerson&&mountedVehicle?72:62;
 if(camera.fov!==fov){camera.fov=fov;camera.updateProjectionMatrix();}
 camera.lookAt(lookAt);
}

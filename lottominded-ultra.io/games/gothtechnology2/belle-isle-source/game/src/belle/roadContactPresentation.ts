import type {RidePose} from '../../runtime/ride-core/src/controller.ts';

type RoadContactHeight={height(x:number,z:number,groundY:number):number};

/** Align visible wheels to the rendered road without changing simulation state.
 * Fully on-foot poses keep their terrain height; only their parked wheel aligns. */
export function roadContactPresentation(pose:RidePose,road:RoadContactHeight):RidePose {
 const groundY=pose.y-pose.airHeight;
 const rise=(road.height(pose.x,pose.z,groundY)-groundY)*(1-pose.footBlend);
 const parkY=pose.footBlend>0?road.height(pose.parkX,pose.parkZ,pose.parkY):pose.parkY;
 return rise||parkY!==pose.parkY?{...pose,y:pose.y+rise,parkY}:pose;
}

/** Player-accessible reference camera location from mapped MacArthur Bridge
 * endpoints; does not change physical geometry or collision.
 */
import type {ParkMap} from './terrain.ts';
export const BRIDGE_PICTURE_VIEW_ID='belle-photo-bridge-arrival';
export const BRIDGE_PICTURE_VIEW_NAME='MacArthur Bridge · cinematic arrival';
export function bridgePictureView(map:Pick<ParkMap,'bridge'>){
 const {a,b,length}=map.bridge;
 const actual=Math.hypot(b[0]-a[0],b[1]-a[1]);
 if(!Number.isFinite(length)||actual<50||Math.abs(actual-length)>2)throw Error('Invalid MacArthur Bridge source axis');
 const fromLandingM=Math.min(65,length*.12),ux=(b[0]-a[0])/actual,uz=(b[1]-a[1])/actual;
 return {x:b[0]-ux*fromLandingM,z:b[1]-uz*fromLandingM,heading:Math.atan2(ux,uz),fromLandingM};
}

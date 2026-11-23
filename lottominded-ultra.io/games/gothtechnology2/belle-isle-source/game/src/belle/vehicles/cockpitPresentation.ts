import * as T from 'three';

/** Keep independently updated Jetson cockpit parts out of rigid batching.
 * The cockpit remains attached to the aircraft root, never to a UI overlay.
 */
const PRESENTATION_NAME=/^(?:CTRL_Cockpit(?:$|[_ .])|Dash(?:_|$)|Cockpit(?:_|$)|Instrument(?:_|$)|Gauge(?:s)?(?:_|$)|Avionics(?:_|$))/i;
export function isCockpitPresentationMesh(mesh:T.Mesh,model:T.Object3D):boolean{
 for(let node:T.Object3D|null=mesh;node&&node!==model;node=node.parent){
  if(PRESENTATION_NAME.test(node.name))return true;
 }
 return false;
}

/** Diagnostic snapshot during the active seat's render pass, after first-person
 * rider visibility is applied. This does not force any model to be visible.
 */
export function cockpitPresentationState(root:T.Object3D,camera:T.Camera){
 const display=root.getObjectByName('Dash_Dynamic_Surface');
 const cockpit=root.getObjectByName('CTRL_Cockpit');
 const attached=Boolean(display?.parent&&cockpit?.parent);
 let visible=attached;
 for(let node:T.Object3D|null=display??null;node&&node!==root;node=node.parent){
  if(!node.visible){visible=false;break;}
 }
 const compatible=Boolean(display?.layers.test(camera.layers));
 return {attached,visible,compatible};
}

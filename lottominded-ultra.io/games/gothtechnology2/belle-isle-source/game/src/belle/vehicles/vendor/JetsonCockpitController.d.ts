import type * as T from 'three';
export class JetsonCockpitController {
 constructor(three:typeof T,scene:T.Object3D,options?:Record<string,unknown>);
 update(input:Record<string,number>,dt:number):unknown;
 context:CanvasRenderingContext2D|null;
 dispose():void;
}

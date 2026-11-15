import type * as T from 'three';
export class JetsonVariantSystem {
 constructor(three:typeof T,scene:T.Object3D,options:Record<string,unknown>);
 ready:Promise<unknown>;
 update(dt:number):void;
 setFirstPerson(value:boolean):void;
 dispose():void;
}

import type {BufferAttribute} from 'three';

/** These pools rewrite every visible slot on relocation. Unused capacity
 * stays allocated on the GPU and is filled when it becomes visible again. */
export function uploadInstancePrefix(attribute:BufferAttribute|null|undefined,count:number){
 if(!attribute||count===0)return;
 attribute.clearUpdateRanges();
 attribute.addUpdateRange(0,count*attribute.itemSize);
 attribute.needsUpdate=true;
}

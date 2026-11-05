import * as T from 'three';
const cache=new WeakMap<T.BufferGeometry,{geometry:T.BufferGeometry;references:number}>();
/** All NPCs sharing a skin also share its immutable clothing mask. */
export function acquireRiderTint(source:T.BufferGeometry,bones:readonly {name:string}[]){
 let entry=cache.get(source);
 if(!entry){const geometry=source.clone(),index=geometry.getAttribute('skinIndex'),weight=geometry.getAttribute('skinWeight'),mask=new Float32Array(index.count*2);
  for(let i=0;i<index.count;i++)for(let j=0;j<4;j++){const name=bones[index.getComponent(i,j)]?.name??'',w=weight.getComponent(i,j);if(/Head|Neck|Hand|Finger|Thumb/.test(name))mask[i*2]+=w;else if(/Spine|Arm|ForeArm/.test(name))mask[i*2+1]+=w;}
  geometry.setAttribute('riderTint',new T.BufferAttribute(mask,2));entry={geometry,references:0};cache.set(source,entry);
 }
 entry.references++;let released=false;const retained=entry;
 return {geometry:entry.geometry,release(){if(released)return;released=true;if(--retained.references===0){retained.geometry.dispose();cache.delete(source);}}};
}

import type {Material} from 'three';
const cache=new WeakMap<Material,Map<string,{value:Material;refs:number}>>();
/** Per-style immutable materials are shared; skeletons and transforms stay private. */
export function acquireVisualMaterial<T extends Material>(source:T,key:string,make:()=>T){
 let styles=cache.get(source);if(!styles){styles=new Map();cache.set(source,styles);}
 let item=styles.get(key);if(!item){item={value:make(),refs:0};styles.set(key,item);}
 item.refs++;let released=false;const owned=item;
 return {value:owned.value as T,release(){if(released)return;released=true;if(--owned.refs===0){styles!.delete(key);owned.value.dispose();}}};
}

import {contains,type Rect,type Handedness} from './hudLayoutModel.ts';
export type TouchRole='move'|'look'|'action'|'ignored';
export type TouchOwner={pointerId:number;player:string;role:TouchRole;generation:number;actionId?:string};
/** Start-only policy. Existing gestures never get reclassified as they cross a boundary. */
export function backgroundTouchRole(view:Rect,x:number,y:number,hand:Handedness='right',guard=.08):TouchRole{
 if(!contains(view,x,y)||!Number.isFinite(guard)||guard<0||guard>.24)return 'ignored';
 const u=(x-view.left)/view.width;
 if(guard>0&&u>=(1-guard)/2&&u<=(1+guard)/2)return 'ignored';
 const left=u<.5;
 return left===(hand==='right')?'move':'look';
}
export class TouchOwnership{
 private owners=new Map<number,TouchOwner>();private generation=0;
 begin(pointerId:number,player:string,role:TouchRole,actionId?:string):TouchOwner{
  const existing=this.owners.get(pointerId);if(existing)return {...existing};
  if(role!=='ignored'&&[...this.owners.values()].some(o=>o.player===player&&o.role===role&&(role!=='action'||o.actionId===actionId)))role='ignored';
  const owner={pointerId,player,role,actionId,generation:this.generation};this.owners.set(pointerId,owner);return {...owner};
 }
 get(pointerId:number){const value=this.owners.get(pointerId);return value?{...value}:undefined;}
 end(pointerId:number){const owner=this.get(pointerId);this.owners.delete(pointerId);return owner;}
 invalidate(player?:string){this.generation++;for(const [id,owner]of this.owners)if(!player||owner.player===player)this.owners.set(id,{...owner,role:'ignored',generation:this.generation});}
 get size(){return this.owners.size;}
 clear(){this.generation++;this.owners.clear();}
}

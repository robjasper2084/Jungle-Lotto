/** Local HUD seat zero is the guest's input seat, not necessarily their room slot. */
export function dispatchRecovery(room:{active:boolean;isHost:boolean;slot:number},requested:number|undefined,local:(slot:number)=>void,remote:()=>void){
 const slot=requested??(room.active?room.slot:0);
 if(!Number.isInteger(slot)||slot<0||room.active&&slot!==room.slot)return false;
 if(room.active&&!room.isHost)remote();else local(slot);
 return true;
}

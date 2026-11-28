import type {BelleOnlineRooms as ProductionRooms} from '../../../lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/src/belle/onlineRooms.ts';
import type {Explorer,ExplorerBuffer,ExplorerFrame} from '../../../lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/src/belle/onlineProtocol.ts';

export type OfflineRoomHooks=ConstructorParameters<typeof ProductionRooms>[0];
type RoomConsumer=Pick<ProductionRooms,'self'|'buffers'|'members'|'inputBlocked'|'isHost'|'online'|'sessionActive'|'hostId'|'sendRace'|'open'|'update'|'leave'>;

/** Preview-only replacement for the production room client. No network client,
 * microphone, invitation handling or publishing timer is created. The original
 * local co-op/race controllers can still call leave() and continue normally. */
export class BelleOnlineRooms implements RoomConsumer{
 readonly self=crypto.randomUUID();
 readonly buffers=new Map<string,ExplorerBuffer>();
 readonly members:Explorer[]=[];
 readonly dialog:HTMLDialogElement|null;

 constructor(private readonly hooks:OfflineRoomHooks){
  this.dialog=typeof document==='undefined'?null:document.createElement('dialog');
  if(!this.dialog)return;
  const dialog=this.dialog;
  dialog.id='online-room';dialog.dataset.previewOffline='true';
  dialog.setAttribute('aria-labelledby','preview-offline-room-title');
  dialog.innerHTML='<button type="button" class="close" aria-label="Close preview room notice">Close</button><small>UNPUBLISHED PREVIEW</small><h2 id="preview-offline-room-title">Online rooms are off in this preview.</h2><p>Explore solo, use local co-op, or start an offline race. This preview does not connect to the published game’s multiplayer rooms.</p>';
  dialog.querySelector<HTMLButtonElement>('button')!.onclick=()=>dialog.close();
  dialog.addEventListener('keydown',event=>event.stopPropagation());
  dialog.addEventListener('close',()=>{this.hooks.clear();document.getElementById('game')?.focus();});
  document.body.append(dialog);
  for(const id of ['friends-open','welcome-friends']){
   const button=document.getElementById(id) as HTMLButtonElement|null;
   if(!button)continue;
   button.disabled=false;button.setAttribute('aria-haspopup','dialog');
   button.onclick=()=>this.open();
  }
 }
 get inputBlocked(){return this.dialog?.open??false;}
 get isHost(){return false;}
 get online(){return false;}
 get sessionActive(){return false;}
 get hostId(){return '';}
 sendRace(_data:unknown):void{}
 open(){this.hooks.clear();if(this.dialog&&!this.dialog.open)this.dialog.showModal();}
 update(_frame:Omit<ExplorerFrame,'seq'>):void{}
 async leave(_removeInvite=true,_keepConnecting=false){
  this.buffers.clear();this.members.length=0;
  if(this.dialog?.open)this.dialog.close();
  this.hooks.clear();this.hooks.localSky();this.hooks.skyHost(true);
 }
}

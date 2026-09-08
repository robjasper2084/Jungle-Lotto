import {ArcadeStore,STORAGE_KEY} from '../core/store.js';
export class ArcadeSession{
 constructor(game,{debug=false,embedded=false}={}){this.game=game;this.embedded=embedded;this.rewards={xp:0,shards:0,keys:0,credits:0};if(!embedded){let storage;try{storage=localStorage;}catch{storage={getItem:()=>null,setItem:()=>{throw Error('Storage unavailable');}};}this.store=new ArcadeStore(storage,STORAGE_KEY+(debug?'-debug':''));}}
 connect(services){this.services=services;}
 progress(){return this.services?.progress()||{game:this.store?.state.games[this.game]||{},settings:this.store?.state.settings||{},wallet:this.store?.state.wallet||{},error:this.store?.error||''};}
 bank(snapshot,finished=false){if(this.services)return this.services.bank(snapshot,finished);if(!this.store)return this.rewards;const r=this.store.record(this.game,snapshot);if(r)for(const k of Object.keys(this.rewards))this.rewards[k]+=r[k];if(finished)this.store.finish(this.game,snapshot);return this.rewards;}
 openVault(format,id){if(this.services)return this.services.openVault(format,id);return this.store.openRunVault(format,id);}
 canOpen(id){if(this.services)return this.services.canOpen(id);const r=this.store?.state.ledger[id];return !!(r?.vaultTokens&&!r.dropClaimed&&this.store.state.wallet.keys>0);}
 tutorialComplete(){if(this.services)this.services.tutorialComplete();else this.store?.setTutorialComplete(this.game);}
 settings(values){if(this.services)this.services.settings(values);else this.store?.updateSettings(values);}
}

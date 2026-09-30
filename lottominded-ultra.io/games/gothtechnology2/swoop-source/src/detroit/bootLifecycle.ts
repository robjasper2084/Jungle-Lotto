export type BootStage='idle'|'checking'|'loading'|'preparing'|'ready'|'error';
/** One boot per document. Retry deliberately reloads to dispose every resource. */
export class BootLifecycle {
 stage:BootStage='idle';message='Getting ready';detail='';lastProgress=0;
 constructor(private now:()=>number=()=>performance.now(),readonly timeoutMs=120000){this.lastProgress=now();}
 advance(stage:Exclude<BootStage,'error'|'ready'>,message:string){if(this.stage==='error'||this.stage==='ready')return;this.stage=stage;this.message=message;this.progress();}
 progress(){if(this.stage!=='error'&&this.stage!=='ready')this.lastProgress=this.now();}
 fail(message:string,detail=''){if(this.stage==='error')return;this.stage='error';this.message=message;this.detail=detail;}
 tick(){if(this.stage!=='ready'&&this.stage!=='error'&&this.now()-this.lastProgress>this.timeoutMs)this.fail('Loading stopped making progress. Please retry.','No asset bytes or completed preparation steps received within the startup timeout.');}
 finish(rider:boolean,spawn:boolean,scene:boolean,input:boolean){if(this.stage==='error'||![rider,spawn,scene,input].every(Boolean))return false;this.stage='ready';this.message='Ready to ride';return true;}
 assertActive(){if(this.stage==='error')throw new Error(this.message);}
}

/** Snapshot watchdog also covers spectators, who never enqueue inputs. */
export class ConnectionHealth {
 private last=0;private online=false;private failure='';private reconnecting=false;
 bind(now=performance.now()){this.online=true;this.last=now;this.failure='';this.reconnecting=false;}
 snapshot(now=performance.now()){this.last=now;this.failure='';this.reconnecting=false;}
 fail(message='Disconnected. Reconnect to reclaim your seat.'){this.failure=message;this.reconnecting=false;}
 retry(){this.reconnecting=true;this.failure='';}
 reset(){this.online=false;this.failure='';this.reconnecting=false;}
 status(now=performance.now(),pending=0){
  if(this.reconnecting)return {state:'reconnecting',text:'Reconnecting to your match…'};
  if(this.failure)return {state:'disconnected',text:this.failure};
  if(!this.online)return {state:'offline',text:''};
  const age=now-this.last;
  if(age>10000)return {state:'disconnected',text:'Server not responding. Open connection options to reconnect or leave.'};
  if(age>2500||pending>=150)return {state:'waiting',text:'Connection interrupted · waiting for the server…'};
  return {state:'connected',text:''};
 }
}

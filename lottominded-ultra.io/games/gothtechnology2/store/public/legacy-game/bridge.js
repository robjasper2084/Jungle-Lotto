(() => {
  'use strict';
  const collections = { MASTER_EZRA:'night-protocol', KALYX:'black-signal', DETROIT_LENS_NOIR:'detroit-2084', AMARA_VALENTINE:'static-saints' };
  const requested = new URLSearchParams(location.search).get('character');
  let ready=false, selected='', previous='', started=0, sent=false, attempts=0;
  const send = data => { if(window.parent!==window) window.parent.postMessage(data,location.origin); };
  function state(detail={}) {
    const game=window.__gothTechnologyGame;
    if(!game||game.phase==='loading')return;
    if(!ready){
      ready=true;
      if(Object.hasOwn(collections,requested)&&typeof game.selectPlayer1==='function') game.selectPlayer1(requested);
      send({type:'GOTHTECH_GAME_READY',version:'1'});
    }
    const id=game.player1Id,phase=detail.phase||game.phase;
    if(Object.hasOwn(collections,id)&&id!==selected){selected=id;send({type:'GOTHTECH_CHARACTER_SELECTED',characterId:id});}
    if(phase==='fight' && ['versus','select','title',''].includes(previous) && !game.isReplay){started=performance.now();sent=false;}
    if(phase==='matchEnd'&&!sent&&started&&!game.isReplay&&Object.hasOwn(collections,id)){
      sent=true;send({type:'GOTHTECH_MATCH_COMPLETED',characterId:id,result:game.matchWinner?.id===game.fighters?.[0]?.id?'win':'loss',durationSeconds:Math.max(1,Math.min(7200,(performance.now()-started)/1000))});
    }
    previous=phase;
  }
  window.addEventListener('gothtechnology:state',event=>state(event.detail));
  const timer=setInterval(()=>{state();if(ready||++attempts>=240)clearInterval(timer);},250);
  window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
})();

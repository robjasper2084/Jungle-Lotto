
function swoopReceipt(){return {runId:rewardRunId,score:rewardEngaged?Math.max(0,Math.floor(score-rewardBaseline)):0,seconds:Math.floor(clock),mode:!running?'title':finished?'results':paused||!$('menu').hidden?'paused':'playing',debug:new URLSearchParams(location.search).has('debug')};}
(window as any).RahbeArcadeGame={get ready(){return ready;},getStats:swoopReceipt,
 pause(){if(running&&!paused)pause();},
 save(){return (window as any).GothGameRewardFlush?.(swoopReceipt());},
 applySettings(settings:{sound:boolean;reducedMotion:boolean}){document.documentElement.dataset.reducedMotion=String(settings.reducedMotion);muted=!settings.sound;loop.music.enabled=settings.sound;void rideAudio.enable(settings.sound).then(showAudioState);showAudioState();}
};

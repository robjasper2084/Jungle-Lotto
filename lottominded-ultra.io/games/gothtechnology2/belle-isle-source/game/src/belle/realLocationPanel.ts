import {BrowserLocationTracker, type RealLocationFix, type RealLocationSnapshot} from './realLocation.ts';
import {BrowserCompass, type CompassSnapshot} from './realCompass.ts';
import './realLocation.css';

export type LocationViewSample = {x:number;z:number;headingY:number|null;speedMps:number};
export type RealLocationPanelOptions = {
  contains:(x:number,z:number)=>boolean;
  canFollow:(fix:RealLocationFix)=>string|null;
  onFollowChanged:(following:boolean)=>void;
  onOpen:()=>void;
  reducedMotion:()=>boolean;
};

const messages:Record<RealLocationSnapshot['status'],string> = {
  off:'Location is off. Choose Use my location to ask your browser for access.',
  requesting:'Waiting for browser permission and a usable location…',
  tracking:'Location is updating. The cyan marker shows your device on the map.',
  'poor-accuracy':'The location estimate is too imprecise to follow. Wait for a clearer signal or try high accuracy.',
  stale:'The location is out of date. Follow has stopped until a fresh fix is available.',
  'outside-map':'Your device is outside the mapped area. Follow is unavailable here.',
  denied:'Location access was denied or blocked. Check this site’s location permission and your device’s Location Services.',
  unavailable:'Your browser could not obtain a location. Check Location Services and try again.',
  timeout:'The location request timed out. You can retry when a signal is available.',
  unsupported:'This browser does not provide location access. Ordinary game controls remain available.',
  insecure:'Location needs HTTPS or a trusted local preview. Open the secure game address.',
  paused:'Location paused when this tab was hidden. Choose Resume location to restart it.',
  'jump-rejected':'An unexpected location jump was ignored. Follow has stopped; wait for a consistent fix.',
};

/** Local-only UI. No settings, coordinates, tracks or heading are persisted. */
export class RealLocationPanel {
  private readonly dialog=document.createElement('dialog');
  private readonly status=document.createElement('p');
  private readonly accuracy=document.createElement('p');
  private readonly followNote=document.createElement('p');
  private readonly startButton=document.createElement('button');
  private readonly stopButton=document.createElement('button');
  private readonly followButton=document.createElement('button');
  private readonly compassButton=document.createElement('button');
  private readonly compassNote=document.createElement('p');
  private readonly highAccuracy=document.createElement('input');
  private readonly strip=document.createElement('aside');
  private readonly stripLabel=document.createElement('span');
  private readonly openers:HTMLButtonElement[]=[];
  private readonly tracker:BrowserLocationTracker;
  private readonly compass:BrowserCompass;
  private state:RealLocationSnapshot={status:'off',highAccuracy:false};
  private compassState:CompassSnapshot={status:'off',headingDegrees:null,accuracyDegrees:null};
  private isFollowing=false;
  private displayed:LocationViewSample|null=null;
  private reason='';
  private returnFocus:HTMLElement|null=null;
  private disposed=false;
  private compassPaintAt=0;

  constructor(private readonly options:RealLocationPanelOptions) {
    this.dialog.id='real-location';
    this.dialog.className='real-location-panel';
    this.dialog.setAttribute('aria-labelledby','real-location-title');
    this.dialog.setAttribute('aria-describedby','real-location-description');
    const close=document.createElement('button');close.type='button';close.className='close';close.textContent='Close';
    close.setAttribute('aria-label','Close real location settings');close.onclick=()=>this.dialog.close();
    const eyebrow=document.createElement('small');eyebrow.textContent='BELLE ISLE / REAL LOCATION';
    const title=document.createElement('h2');title.id='real-location-title';title.textContent='Explore where you are.';
    const description=document.createElement('p');description.id='real-location-description';
    description.textContent='Show your device on the island map, then choose whether your avatar view follows your real position.';
    const privacy=document.createElement('p');privacy.className='real-location-privacy';
    privacy.textContent='Location stays in this tab. No location history is saved or shared with other players. Stop clears the current position.';
    this.status.id='real-location-status';this.status.setAttribute('role','status');this.status.setAttribute('aria-live','polite');
    this.accuracy.id='real-location-accuracy';this.accuracy.className='real-location-accuracy';
    const actions=document.createElement('div');actions.className='real-location-actions';
    this.startButton.type=this.stopButton.type=this.followButton.type=this.compassButton.type='button';
    this.startButton.id='real-location-start';this.startButton.textContent='Use my location';
    this.stopButton.id='real-location-stop';this.stopButton.textContent='Stop location';
    this.followButton.id='real-location-follow';this.followButton.textContent='Follow my location';
    this.followButton.setAttribute('aria-pressed','false');
    actions.append(this.startButton,this.stopButton,this.followButton);
    const accuracyLabel=document.createElement('label');accuracyLabel.className='real-location-check';
    this.highAccuracy.type='checkbox';this.highAccuracy.id='real-location-high-accuracy';
    accuracyLabel.append(this.highAccuracy,document.createTextNode('Request high accuracy (may use more battery)'));
    this.followNote.className='real-location-note';this.followNote.id='real-location-follow-note';
    this.followButton.setAttribute('aria-describedby',this.followNote.id);
    const headingTitle=document.createElement('h3');headingTitle.textContent='Optional compass';
    this.compassButton.id='real-location-compass';this.compassButton.textContent='Use device compass';
    this.compassButton.setAttribute('aria-pressed','false');this.compassNote.id='real-location-compass-note';
    this.compassNote.className='real-location-note';this.compassButton.setAttribute('aria-describedby',this.compassNote.id);
    const limits=document.createElement('p');limits.className='real-location-note';
    limits.textContent='Map positions are approximate. Poor or old fixes stop follow. Switching tabs pauses location; resume it manually when you return.';
    this.dialog.append(close,eyebrow,title,description,privacy,this.status,this.accuracy,actions,accuracyLabel,this.followNote,headingTitle,this.compassButton,this.compassNote,limits);
    this.dialog.addEventListener('keydown',e=>e.stopPropagation());
    this.dialog.addEventListener('close',()=>{
      const target=this.returnFocus?.isConnected?this.returnFocus:document.getElementById('game');
      target?.focus({preventScroll:true});
    });
    document.body.append(this.dialog);

    for(const parent of [document.querySelector('#ride-menu nav'),document.getElementById('guide')]) {
      if(!parent)continue;
      const button=document.createElement('button');button.type='button';button.textContent='Real location';
      button.className='real-location-open';button.setAttribute('aria-haspopup','dialog');
      button.onclick=()=>this.open(button);parent.append(button);this.openers.push(button);
    }
    this.strip.id='real-location-strip';this.strip.className='real-location-strip';this.strip.hidden=true;
    this.strip.setAttribute('aria-label','Real location controls');
    const settings=document.createElement('button');settings.type='button';settings.textContent='Location';settings.onclick=()=>this.open(settings);
    const stop=document.createElement('button');stop.type='button';stop.textContent='Stop';stop.setAttribute('aria-label','Stop real location and clear position');stop.onclick=()=>this.stop();
    this.strip.append(this.stripLabel,settings,stop);document.body.append(this.strip);

    this.compass=new BrowserCompass(snapshot=>{
      const changed=snapshot.status!==this.compassState.status;this.compassState=snapshot;
      const now=performance.now();if(changed||now-this.compassPaintAt>=250){this.compassPaintAt=now;this.renderCompass();}
    });
    this.tracker=new BrowserLocationTracker({contains:options.contains,onChange:snapshot=>{
      this.state=snapshot;
      if(snapshot.status!=='tracking'||!snapshot.fix) {
        this.stopFollow();
        if(['off','paused','denied','unsupported','insecure'].includes(snapshot.status))this.compass.stop();
      }
      this.render();
    }});
    this.startButton.onclick=()=>{
      this.stopFollow();this.reason='';
      // Permission is requested only from this deliberate user action.
      this.tracker.start(this.highAccuracy.checked);
    };
    this.stopButton.onclick=()=>this.stop();
    this.highAccuracy.onchange=()=>{
      this.stopFollow();
      if(!['off','paused','denied','unsupported','insecure'].includes(this.state.status))this.tracker.start(this.highAccuracy.checked);
    };
    this.followButton.onclick=()=>{
      if(this.isFollowing){this.stopFollow();return;}
      const fix=this.state.fix;
      if(this.state.status!=='tracking'||!fix)return;
      const denied=this.options.canFollow(fix);
      if(denied){this.reason=denied;this.render();return;}
      this.isFollowing=true;this.reason='';this.displayed=null;
      document.body.classList.add('location-following');
      this.options.onFollowChanged(true);
      // Close the map or settings panel underneath as well as our own panel.
      document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(dialog=>dialog.close());
      document.getElementById('game')?.focus({preventScroll:true});
      this.render();
    };
    this.compassButton.onclick=()=>{
      if(this.compass.active)this.compass.stop();
      else void this.compass.enable(); // Keep permission inside this button gesture.
    };
    this.render();
  }

  get following(){return this.isFollowing;}
  get snapshot(){return this.state;}

  private open(from:HTMLElement) {
    this.returnFocus=from;this.options.onOpen();this.reason='';this.render();
    if(!this.dialog.open)this.dialog.showModal();
  }

  stopFollow(reason='') {
    this.reason=reason;this.displayed=null;
    if(this.isFollowing){this.isFollowing=false;document.body.classList.remove('location-following');this.options.onFollowChanged(false);}
    this.render();
  }

  stop() {this.stopFollow();this.compass.stop();this.tracker.stop();}

  update(dt:number):LocationViewSample|null {
    if(!this.isFollowing)return null;
    const fix=this.state.fix;
    if(this.state.status!=='tracking'||!fix){this.stopFollow();return null;}
    const denied=this.options.canFollow(fix);
    if(denied){this.stopFollow(denied);return null;}
    const compassHeading=this.compassState.status==='tracking'?this.compassState.headingDegrees:null;
    const bearing=compassHeading??((fix.speedMps??0)>=.6?fix.headingDegrees:null);
    const headingY=bearing===null?null:Math.PI-bearing*Math.PI/180;
    const target:LocationViewSample={x:fix.x,z:fix.z,headingY,speedMps:Math.max(0,Math.min(6,fix.speedMps??0))};
    if(!this.displayed||this.options.reducedMotion())this.displayed={...target};
    else {
      const blend=1-Math.exp(-Math.min(.1,Math.max(0,Number.isFinite(dt)?dt:0))*5);
      this.displayed.x+=(target.x-this.displayed.x)*blend;
      this.displayed.z+=(target.z-this.displayed.z)*blend;
      if(headingY!==null){
        const from=this.displayed.headingY??headingY;
        this.displayed.headingY=from+Math.atan2(Math.sin(headingY-from),Math.cos(headingY-from))*blend;
      }else this.displayed.headingY=null;
      this.displayed.speedMps=target.speedMps;
    }
    return {...this.displayed};
  }

  drawMap(ctx:CanvasRenderingContext2D,px:(x:number)=>number,pz:(z:number)=>number) {
    const fix=this.state.fix;if(this.state.status!=='tracking'||!fix)return;
    const x=px(fix.x),y=pz(fix.z);
    if(x<0||x>ctx.canvas.width||y<0||y>ctx.canvas.height)return;
    const rx=Math.max(2,Math.abs(px(fix.x+fix.accuracy)-x)),ry=Math.max(2,Math.abs(pz(fix.z+fix.accuracy)-y));
    ctx.save();ctx.setLineDash([]);ctx.fillStyle='#57d9ef33';ctx.strokeStyle='#65e8ff';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fillStyle='#65e8ff';ctx.fill();ctx.strokeStyle='#07191f';ctx.lineWidth=2;ctx.stroke();
    ctx.font='bold 11px system-ui';ctx.textAlign=x>ctx.canvas.width-85?'right':'left';
    ctx.fillStyle='#f3ffff';ctx.strokeStyle='#07191f';ctx.lineWidth=3;
    const tx=x+(ctx.textAlign==='right'?-9:9),ty=Math.max(12,y-9);
    ctx.strokeText('YOU · GPS',tx,ty);ctx.fillText('YOU · GPS',tx,ty);ctx.restore();
  }

  private render() {
    if(this.disposed)return;
    this.status.textContent=messages[this.state.status];
    this.dialog.dataset.locationStatus=this.state.status;
    this.accuracy.textContent=this.state.fix?'Estimated accuracy: ±'+Math.ceil(this.state.fix.accuracy)+' m':'';
    this.accuracy.hidden=!this.state.fix;
    this.startButton.textContent=this.state.status==='paused'?'Resume location':this.state.status==='off'?'Use my location':'Retry location';
    this.startButton.disabled=this.state.status==='requesting';
    this.stopButton.disabled=this.state.status==='off';
    this.followButton.textContent=this.isFollowing?'Stop following':'Follow my location';
    this.followButton.setAttribute('aria-pressed',String(this.isFollowing));
    const available=this.state.status==='tracking'&&!!this.state.fix;
    const why=available&&!this.isFollowing?this.options.canFollow(this.state.fix!):null;
    this.followButton.disabled=!this.isFollowing&&(!available||!!why);
    this.followNote.textContent=this.reason||why||(this.isFollowing?'Your local avatar view follows your location. Ordinary riding resumes where you left it when you stop.':'Follow is for solo exploration on mapped open ground. Ordinary ride controls pause while following.');
    this.strip.hidden=this.state.status==='off';
    this.stripLabel.textContent=this.isFollowing?'GPS follow':this.state.status==='tracking'?'GPS on':this.state.status==='paused'?'GPS paused':'GPS · '+this.state.status.replaceAll('-',' ');
    this.renderCompass();
  }

  private renderCompass() {
    if(this.disposed)return;
    const state=this.compassState;
    const enabled=this.compass.active;
    this.compassButton.textContent=enabled?'Stop compass':'Use device compass';
    this.compassButton.setAttribute('aria-pressed',String(enabled));
    this.compassButton.disabled=this.state.status!=='tracking'&&!enabled;
    this.compassNote.textContent=state.status==='tracking'&&state.headingDegrees!==null
      ?'Screen-top heading: '+Math.round(state.headingDegrees)+'°. Hold the screen fairly flat for a compass direction.'
      :state.status==='requesting'?'Waiting for compass permission and a north-referenced heading…'
      :state.status==='denied'?'Compass permission was denied. GPS location still works without it.'
      :state.status==='stale'?'Compass data is out of date. The view uses travel direction when available.'
      :state.status==='unavailable'?'A usable compass heading is unavailable. Hold the screen fairly flat or continue without compass.'
      :'Compass is off. GPS travel direction follows movement; it does not tell which way you face while standing still.';
  }

  dispose() {
    if(this.disposed)return;
    this.stop();this.disposed=true;this.tracker.dispose();this.compass.dispose();
    this.dialog.remove();this.strip.remove();this.openers.forEach(button=>button.remove());
  }
}

import type {Rect} from './touchLayout.ts';
export const overlaps=(a:Rect,b:Rect,gap=4)=>a.x<b.x+b.width+gap&&a.x+a.width+gap>b.x&&a.y<b.y+b.height+gap&&a.y+a.height+gap>b.y;
/** Fit visible controls against the actual HUD, including controls outside #touch. */
export function placeControls(width:number,height:number,items:Rect[],reserved:Rect[]){
 const occupied=reserved.slice();
 return items.map(item=>{
  const valid=(r:Rect)=>r.x>=8&&r.y>=64&&r.x+r.width<=width-8&&r.y+r.height<=height-20&&!occupied.some(o=>overlaps(r,o));
  let best=valid(item)?item:undefined,score=Infinity;
  if(!best)for(let y=64;y<=height-20-item.height;y+=6)for(let x=8;x<=width-8-item.width;x+=6){const r={...item,x,y};if(!valid(r))continue;const distance=(x-item.x)**2+(y-item.y)**2;if(distance<score){score=distance;best=r;}}
  if(best)occupied.push(best);
  return best;
 });
}

export class VisibleTouchLayout{
 private key='';
 private tray?:HTMLDivElement;
 private page=0;
 private homes=new Map<HTMLButtonElement,{style:string;anchor:Comment}>();
 private moveToTray(button:HTMLButtonElement,parent:HTMLElement){const anchor=document.createComment('combat action home');button.before(anchor);this.homes.set(button,{style:button.style.cssText,anchor});button.style.cssText='';parent.append(button);}
 private restore(){
  for(const [button,home]of this.homes){home.anchor.replaceWith(button);button.style.cssText=home.style;delete button.dataset.trayPageHidden;}
  this.homes.clear();this.tray?.remove();this.tray=undefined;
 }
 reset(){this.restore();this.key='';this.page=0;}
 fit(touch:HTMLElement){
  if(touch.hidden||touch.classList.contains('editing')||touch.querySelector('.active'))return;
  const rect=(el:Element):Rect=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};};
  const visible=(el:Element)=>el.getClientRects().length>0;
  const fixed=[...document.querySelectorAll('#hud,header,#camera-capture,.circuit-race,.on-foot-controls,.royale-map,#move-pad')].filter(visible).map(rect);
  const buttons=[...touch.querySelectorAll<HTMLButtonElement>('button:not(.tray-nav)')].filter(b=>!b.hidden&&visible(b));
  const key=JSON.stringify([innerWidth,innerHeight,buttons.map(b=>b.dataset.action||b.className).sort(),fixed,touch.dataset.expanded]);if(key===this.key)return;
  this.restore();this.key=key;
  const pinned=buttons.filter(b=>b.dataset.customPosition);fixed.push(...pinned.map(rect));
  const movable=buttons.filter(b=>!b.dataset.customPosition).sort((a,b)=>Number(b.dataset.action==='fire'||b.dataset.action==='aim')-Number(a.dataset.action==='fire'||a.dataset.action==='aim'));
  let placed=movable,placements=placeControls(innerWidth,innerHeight,movable.map(rect),fixed);
  if(placements.some(r=>!r)){
   // An expanded deck cannot always fit. Page secondary actions instead of
   // leaving unplaced controls stacked underneath one another.
   const essential=new Set(['fire','aim','lean-left','lean-right']);
   const secondary=movable.filter(b=>b.dataset.action&&!essential.has(b.dataset.action)).sort((a,b)=>Number(['crouch','hop'].includes(b.dataset.action!))-Number(['crouch','hop'].includes(a.dataset.action!)));
   const more=movable.find(b=>b.classList.contains('combat-more'));
   const traySize={x:12,y:Math.max(68,innerHeight-210),width:Math.min(480,innerWidth-24),height:60};
   const trayRect=placeControls(innerWidth,innerHeight,[traySize],fixed)[0];
   if(trayRect&&secondary.length){
    const tray=document.createElement('div');tray.className='combat-tray';tray.setAttribute('role','group');tray.setAttribute('aria-label','More combat actions');tray.style.left=trayRect.x+'px';tray.style.top=trayRect.y+'px';tray.style.width=trayRect.width+'px';
    const body=document.createElement('div');body.className='combat-tray-actions';
    const previous=document.createElement('button'),next=document.createElement('button');
    for(const [b,label,text]of [[previous,'Previous combat actions','‹'],[next,'Next combat actions','›']] as const){b.type='button';b.className='tray-nav';b.setAttribute('aria-label',label);b.textContent=text;}
    const perPage=trayRect.width>=440?4:2;body.style.gridTemplateColumns=`repeat(${perPage},1fr)`;
    const pages=Math.ceil(secondary.length/perPage);this.page=Math.min(this.page,pages-1);
    const show=()=>{secondary.forEach((b,i)=>b.dataset.trayPageHidden=String(Math.floor(i/perPage)!==this.page));next.textContent=`› ${this.page+1}/${pages}`;previous.disabled=this.page===0;next.disabled=this.page===pages-1;};
    previous.onclick=()=>{this.page=Math.max(0,this.page-1);show();};next.onclick=()=>{this.page=Math.min(pages-1,this.page+1);show();};
    for(const button of secondary)this.moveToTray(button,body);
    tray.append(previous,body,next);if(more)this.moveToTray(more,tray);
    touch.append(tray);this.tray=tray;show();
    placed=movable.filter(b=>!secondary.includes(b)&&b!==more);placements=placeControls(innerWidth,innerHeight,placed.map(rect),[...fixed,trayRect]);
   }
  }
  placements.forEach((r,i)=>{const b=placed[i];if(!r)return;for(const [prop,value]of Object.entries({left:r.x+'px',top:r.y+'px',right:'auto',bottom:'auto'}))b.style.setProperty(prop,value,'important');});
 }
}

import core from '../vendor/lottomind-core.mjs';
import registry from '../vendor/lottomind-registry.mjs';
import createSystemsUi from '../vendor/lottomind-ui.mjs';
import {LOTTO_GAMES} from './lottoGames.ts';
import {deskGame,quickTicket,parsePool,coverageWheel,validTicket,type DeskTicket} from './lottoDeskEngine.ts';
import './lottoComponents.css';

type Report={id:string;route:string;title:string;createdAt:string;formulaVersion:string;source:string;inputs:Record<string,unknown>;result:Record<string,unknown>};
type SavedTicket=DeskTicket&{id:string;createdAt:string};
type DeskState={version:1;favorites:string[];recents:string[];savedReports:Report[];inputs:Record<string,Record<string,unknown>>;tickets:SavedTicket[]};
const KEY='lottomind.swoop-desk.v1';
const empty=():DeskState=>({version:1,favorites:[],recents:[],savedReports:[],inputs:{},tickets:[]});
const escape=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const online=[['Dream Oracle','dreams'],['Ticket Scanner','ticket-scanner'],['Heatmap Radar','heatmap'],['Music Hub','music-hub'],['Studio','studio'],['Reset Vault','meditation'],['Account / wallet','credits-wallet']] as const;

/** Portable app components use the same formula engine and controls as LottoMind Refined. */
export class LottoComponents{
 readonly element=document.createElement('div');
 private content=document.createElement('div');private status=document.createElement('p');private route='desk';private gameId='powerball';private current?:DeskTicket;private wheel:DeskTicket[]=[];private state=empty();private persistent=true;
 private readonly systems;
 constructor(private openApp:(path:string)=>void){
  try{const parsed=JSON.parse(localStorage.getItem(KEY)??'null');if(parsed?.version===1)this.state={...empty(),...parsed,tickets:Array.isArray(parsed.tickets)?parsed.tickets.filter(validTicket).slice(0,40):[],savedReports:Array.isArray(parsed.savedReports)?parsed.savedReports.filter((r:Report)=>registry.byRoute[r.route]&&r.result&&r.inputs).slice(0,40):[],favorites:Array.isArray(parsed.favorites)?parsed.favorites.filter((r:string)=>registry.byRoute[r]):[],recents:Array.isArray(parsed.recents)?parsed.recents.filter((r:string)=>registry.byRoute[r]):[],inputs:parsed.inputs&&typeof parsed.inputs==='object'?parsed.inputs:{}};}catch{this.persistent=false;}
  const write=()=>{try{localStorage.setItem(KEY,JSON.stringify(this.state));}catch{this.persistent=false;}};
  const store={getState:()=>this.state,saveInputs:(route:string,inputs:Record<string,unknown>)=>{this.state.inputs[route]=inputs;write();},touchRecent:(route:string)=>{this.state.recents=[route,...this.state.recents.filter(r=>r!==route)].slice(0,12);write();},toggleFavorite:(route:string)=>{this.state.favorites=this.state.favorites.includes(route)?this.state.favorites.filter(r=>r!==route):[route,...this.state.favorites];write();},saveReport:(report:Omit<Report,'id'>)=>{this.state.savedReports=[{...report,id:crypto.randomUUID()},...this.state.savedReports].slice(0,40);write();}};
  this.systems=createSystemsUi({LottoMindSystems:core,LottoMindSystemsRegistry:registry,LottoMindSystemsStore:store,crypto,navigator});
  this.element.className='lotto-components';this.element.setAttribute('aria-label','LottoMind in-store tools');
  const nav=document.createElement('nav');nav.setAttribute('aria-label','LottoMind tool sections');
  for(const [label,route]of [['Desk','desk'],['Quick picks','quick'],['Wheel','wheel'],['Analyze','analyze'],['Systems','systemsLab'],['Saved','saved']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.deskRoute=route;nav.append(b);}
  this.status.className='lotto-desk-status';this.status.setAttribute('role','status');this.status.textContent='Local tools · no ticket purchase or real prizes.';
  this.content.className='lotto-component-content';this.element.append(nav,this.status,this.content);
  this.element.addEventListener('click',event=>{const target=(event.target as HTMLElement).closest<HTMLElement>('button,a');if(!target)return;
   if(target.dataset.deskRoute){this.route=target.dataset.deskRoute;this.render();this.focusHeading();return;}
   if(target.dataset.online){this.openApp(target.dataset.online);return;}
   if(target.dataset.route){const route=target.dataset.route;this.route=registry.byRoute[route]||route==='systemsLab'?route:route==='history'?'saved':route==='sequence'||route==='dailyTools'?'analyze':'desk';this.render();this.focusHeading();return;}
   if(target.dataset.action?.startsWith('systems-')){if(target.dataset.action==='systems-run'&&!this.validateSystem(target))return;this.systems.handleAction(target.dataset.action,target,{state:{route:this.route},toast:m=>this.say(m),render:()=>this.render()});const action=target.dataset.action;this.render();this.content.querySelector<HTMLElement>(`[data-action="${action}"]`)?.focus();return;}
   const action=target.dataset.deskAction;
   if(action)event.preventDefault();
   try{
    if(action==='generate'){this.gameId=this.value('game');this.current=quickTicket(this.gameId);this.render();this.say('Entertainment pick generated.');}
    if(action==='save'){this.saveTickets(this.current?[this.current]:[]);}
    if(action==='build'){this.gameId=this.value('game');const g=deskGame(this.gameId),result=coverageWheel(this.gameId,this.value('pool'),g.specialMax?Number(this.value('special')):undefined);this.wheel=result.tickets;const output=this.content.querySelector('[data-output]')!;output.innerHTML=`<p>${result.tickets.length} of ${result.total} combinations. ${result.tickets.length===result.total?'All combinations of this pool; this does not cover the full game matrix.':'Output is capped at 24 tickets; this does not cover every combination of the pool.'}</p>${result.tickets.map(t=>this.ticketHtml(t)).join('')}<button type="button" data-desk-action="save-wheel">Save wheel</button>`;this.say('Coverage wheel built.');}
    if(action==='save-wheel')this.saveTickets(this.wheel);
    if(action==='analyze'){this.gameId=this.value('game');const game=deskGame(this.gameId),values=parsePool(this.value('pool'),game);if(values.length!==game.mainCount||(game.mainMax!==9&&new Set(values).size!==values.length))throw Error(`Enter ${game.mainCount} ${game.mainMax===9?'digits':'distinct main numbers'}.`);const sum=values.reduce((a,b)=>a+b,0),odd=values.filter(n=>n%2).length;const out=this.content.querySelector('[data-output]')!;out.innerHTML=`<h3>Ticket structure</h3><div class="desk-metrics"><span>Sum <b>${sum}</b></span><span>Root <b>${sum===0?0:((sum-1)%9)+1}</b></span><span>Odd / even <b>${odd} / ${values.length-odd}</b></span><span>Range <b>${Math.max(...values)-Math.min(...values)}</b></span></div>${game.mainMax===9?'<pre>'+escape(JSON.stringify(core.analyzeDailyDigits(values.join('')),null,2))+'</pre>':''}<p>This describes the number pattern, not its chance of winning.</p>`;this.say('Ticket structure analyzed.');}
    if(action==='remove'){this.state.tickets=this.state.tickets.filter(t=>t.id!==target.dataset.id);write();this.render();this.say('Saved set removed from this desk.');}
    if(action==='report'){const report=this.state.savedReports.find(r=>r.id===target.dataset.id);if(report){this.content.innerHTML=`<h2 tabindex="-1">${escape(report.title)}</h2><p>Saved local formula report · ${escape(report.createdAt)}</p><pre>${escape(JSON.stringify({inputs:report.inputs,result:report.result},null,2))}</pre><button data-desk-route="saved">Back to saved reports</button>`;this.focusHeading();}}
   }catch(error){this.say(error instanceof Error?error.message:'The tool could not run.');}
  });
  this.element.addEventListener('change',event=>{const target=event.target as HTMLSelectElement;if(target.name==='game'){this.gameId=target.value;this.current=undefined;this.wheel=[];this.render();this.content.querySelector<HTMLSelectElement>('[name=game]')?.focus();}});
  this.element.addEventListener('input',event=>this.systems.handleInput(event.target as HTMLElement));
  this.element.addEventListener('submit',event=>{event.preventDefault();const form=event.target as HTMLFormElement;form.querySelector<HTMLButtonElement>('[data-action="systems-run"], [data-desk-action="build"], [data-desk-action="analyze"]')?.click();});
  this.render();
 }
 private say(message:string){this.status.textContent=message+(!this.persistent?' Saves last only for this session.':'');}
 private value(name:string){return this.content.querySelector<HTMLInputElement|HTMLSelectElement>(`[name="${name}"]`)?.value??'';}
 private focusHeading(){this.content.querySelector<HTMLElement>('h1,h2')?.focus();}
 private validateSystem(target:HTMLElement){
  const form=target.closest('form') as HTMLFormElement,route=target.dataset.systemRoute??this.route,fields=Object.fromEntries(new FormData(form).entries());
  if(!form.reportValidity())return false;
  if(['dailyRundown','top10Generator'].includes(route)&&!/^\d{3,4}$/.test(String(fields.digits??''))){this.say('Enter exactly 3 or 4 digits; leading zeroes are allowed.');return false;}
  if(route==='digitWheeler'&&(!/^\d{3,10}$/.test(String(fields.digits??''))||[fields.required,fields.excluded].some(v=>v&&!/^\d+$/.test(String(v))))){this.say('Use a digit pool of 3–10 digits and digits only in filters.');return false;}
  if(route==='vtracPredictor'&&!new RegExp('^\\d{'+fields.length+'}$').test(String(fields.digits??''))){this.say('Seed digits must match the selected Pick length.');return false;}
  if(route==='dateMath'&&!fields.date){this.say('Choose a calendar date.');return false;}
  if(route==='monthlyPlaylist'&&(!fields.month||!fields.year)){this.say('Enter a month and year.');return false;}
  if(route.startsWith('pairCluster')&&!String(fields.history??'').trim()){this.say('Enter draw history to analyze pairs. No sample draws are filled in.');return false;}
  return true;
 }
 private gameSelect(wheel=false){return `<label>Game<select name="game">${LOTTO_GAMES.filter(g=>!wheel||g.mainMax!==9).map(g=>`<option value="${g.id}" ${this.gameId===g.id?'selected':''}>${g.name}</option>`).join('')}</select></label>`;}
 private ticketHtml(ticket:DeskTicket){const g=deskGame(ticket.gameId);return `<div class="desk-ticket"><strong>${escape(g.name)}</strong><div class="desk-balls">${ticket.numbers.map(n=>'<span>'+n+'</span>').join('')}${ticket.special===undefined?'':'<span class="special">'+ticket.special+'</span>'}</div>${g.specialName?'<small>'+escape(g.specialName)+' is the gold ball.</small>':''}</div>`;}
 private saveTickets(tickets:DeskTicket[]){if(!tickets.length||tickets.some(t=>!validTicket(t)))throw Error('Generate a valid set first.');this.state.tickets=[...tickets.map(t=>({...t,id:crypto.randomUUID(),createdAt:new Date().toISOString()})),...this.state.tickets].slice(0,40);try{localStorage.setItem(KEY,JSON.stringify(this.state));}catch{this.persistent=false;}this.say(`${tickets.length} set${tickets.length===1?'':'s'} saved locally in this store desk.`);}
 render(){
  this.element.querySelectorAll<HTMLButtonElement>('nav button').forEach(b=>b.setAttribute('aria-current',String(b.dataset.deskRoute===this.route)));
  const game=deskGame(this.gameId);let html='';
  if(this.route==='desk')html=`<header><p class="eyebrow">LOTTOMIND / PLAY DESK</p><h2 tabindex="-1">Your numbers. Your tools.</h2><p>Run LottoMind’s local components inside the store. They organize number ideas and do not predict results.</p></header><div class="desk-cards">${[['Quick picks','quick'],['Coverage wheel','wheel'],['Ticket analysis','analyze'],['Eight formula systems','systemsLab'],['Saved sets + reports','saved']].map(([label,route])=>`<button data-desk-route="${route}">${label}</button>`).join('')}</div><h3>Online app rooms</h3><p>These open their real app screen here. Account, microphone and online services remain managed by the app.</p><div class="desk-cards">${online.map(([label,path])=>`<button data-online="${path}/">${label} ↗</button>`).join('')}</div>`;
  else if(this.route==='quick')html=`<h2 tabindex="-1">Quick picks</h2><p>Random entertainment sets using the same game matrix as LottoMind. Pick 3 / 4 preserve digit order and repeated digits.</p>${this.gameSelect()}<button data-desk-action="generate">Generate set</button>${this.current?this.ticketHtml(this.current)+'<button data-desk-action="save">Save set locally</button>':''}`;
  else if(this.route==='wheel'){if(game.mainMax===9)this.gameId='powerball';const g=deskGame(this.gameId);html=`<h2 tabindex="-1">Coverage wheel</h2><p>Choose ${g.mainCount}–12 distinct main numbers. Output is capped at 24 tickets. For daily digit permutations, open Digit Wheeler in Systems.</p><form>${this.gameSelect(true)}<label>Number pool<input name="pool" placeholder="7 11 23 38 42 58" required></label>${g.specialMax?`<label>${escape(g.specialName)}<input name="special" type="number" min="1" max="${g.specialMax}" value="1" required></label>`:''}<button type="submit" data-desk-action="build">Build wheel</button></form><div data-output aria-live="polite"></div>`;}
  else if(this.route==='analyze')html=`<h2 tabindex="-1">Ticket analysis</h2><form>${this.gameSelect()}<label>Main numbers / digits<input name="pool" placeholder="${game.mainMax===9?'0 1 3':'7 11 23 38 42'}" required></label><button type="submit" data-desk-action="analyze">Analyze pattern</button></form><div data-output aria-live="polite"></div>`;
  else if(this.route==='saved')html=`<h2 tabindex="-1">Saved desk</h2><p>Saved on this device for this game desk. This is separate from your LottoMind account and wallet.</p>${this.state.tickets.length?this.state.tickets.map(t=>`<article>${this.ticketHtml(t)}<small>${escape(new Date(t.createdAt).toLocaleString())}</small><button data-desk-action="remove" data-id="${escape(t.id)}">Remove set</button></article>`).join(''):'<p>No sets saved yet. Generate a set or build a wheel.</p>'}<h3>Formula reports</h3>${this.state.savedReports.length?this.state.savedReports.map(r=>`<button data-desk-action="report" data-id="${escape(r.id)}">${escape(r.title)} · ${escape(new Date(r.createdAt).toLocaleString())}</button>`).join(''):'<p>No reports yet. Run a System, then Save Report.</p>'}`;
  else if(this.route==='systemsLab')html=this.systems.renderLab();
  else if(registry.byRoute[this.route])html=this.systems.renderTool(this.route);
  this.content.innerHTML=html;
  this.content.querySelectorAll<HTMLElement>('h1,h2').forEach(h=>h.tabIndex=-1);
 }
}

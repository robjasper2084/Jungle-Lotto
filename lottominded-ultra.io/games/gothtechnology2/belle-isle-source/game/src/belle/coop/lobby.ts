import { RIDERS, VEHICLES, BINDINGS, CoopLobbyState, loadPair, savePair, setupErrors, type PreferenceStore, type Pad, type Seat, type PlayerManifest } from './coop.ts';

export type CoopLobbyOptions = {
  store?: PreferenceStore;
  pads?: () => readonly (Pad|null)[];
  /** Preview must label its action honestly; it never claims a game has launched. */
  preview?: boolean;
  onBegin: (players: readonly [PlayerManifest,PlayerManifest], signal: AbortSignal) => Promise<void>;
  onClose?: () => void;
};
const css = `
.coop-lobby{--coop-ink:#eaf3ec;--coop-muted:#b8c8c3;--coop-bg:#101c1d;--coop-line:#3e5655;--coop-accent:#a8dfc3;color:var(--coop-ink);background:var(--coop-bg);font:16px/1.5 system-ui,sans-serif;box-sizing:border-box;max-width:1000px;margin:auto;padding:clamp(18px,4vw,40px);border:1px solid var(--coop-line);border-radius:16px}
.coop-lobby *{box-sizing:border-box}.coop-lobby [hidden]{display:none!important}
.coop-lobby header{display:flex;justify-content:space-between;gap:18px;align-items:start}.coop-lobby h1{font-size:clamp(25px,4vw,38px);line-height:1.12;margin:4px 0 12px;font-weight:650;letter-spacing:-.025em}.coop-lobby .coop-kicker{color:var(--coop-accent);letter-spacing:.13em;font-size:11px;font-weight:700}.coop-lobby p{max-width:70ch;margin:8px 0 20px;color:var(--coop-muted)}
.coop-lobby .coop-panes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;margin:24px 0}
.coop-lobby fieldset{min-width:0;margin:0;border:1px solid var(--coop-line);padding:18px;border-radius:12px;background:#162728}.coop-lobby fieldset[data-seat="1"]{border-top:3px solid #dfb677}.coop-lobby fieldset[data-seat="0"]{border-top:3px solid var(--coop-accent)}.coop-lobby legend{font-size:18px;font-weight:700;padding:0 7px}.coop-lobby label{display:block;margin:12px 0 5px;font-size:13px;font-weight:600;color:var(--coop-muted)}
.coop-lobby select,.coop-lobby button{font:inherit;min-height:46px;border-radius:8px;border:1px solid #64817b}.coop-lobby select{width:100%;max-width:100%;background:#0c191b;color:var(--coop-ink);padding:9px 10px}.coop-lobby button{background:#243f3e;color:var(--coop-ink);padding:10px 16px;cursor:pointer}.coop-lobby button:disabled{opacity:.5;cursor:not-allowed}.coop-lobby :focus-visible{outline:3px solid #f3d6a4;outline-offset:3px}
.coop-lobby .coop-ready{width:100%;margin-top:20px}.coop-lobby .coop-ready[aria-pressed="true"]{background:#a8dfc3;color:#102021}.coop-lobby .coop-ready-state{display:block;font-size:13px;margin-top:8px;color:var(--coop-muted)}.coop-lobby .coop-footer{display:flex;gap:16px;align-items:center;flex-wrap:wrap}.coop-lobby .coop-begin{background:#a8dfc3;color:#102021;font-weight:700;min-width:220px}.coop-lobby .coop-status{min-height:48px;margin:14px 0;color:#dfb677;overflow-wrap:anywhere}.coop-lobby details{margin-top:20px;border-top:1px solid var(--coop-line);padding-top:12px}.coop-lobby summary{cursor:pointer;min-height:44px;padding:10px 0}.coop-lobby .coop-note{font-size:13px;margin:8px 0}.coop-lobby .coop-mode{font-size:12px;padding:5px 10px;border:1px solid var(--coop-line);border-radius:30px;white-space:nowrap}
@media(max-width:620px){.coop-lobby{padding:18px;border-radius:10px}.coop-lobby .coop-panes{grid-template-columns:1fr;gap:16px;margin:18px 0}.coop-lobby header{flex-wrap:wrap}.coop-lobby .coop-begin{width:100%;min-width:0}.coop-lobby select{font-size:15px}.coop-lobby fieldset{padding:14px}}
@media(prefers-reduced-motion:reduce){.coop-lobby *{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
`;
/** Scoped, dependency-free lobby component. The host owns world/input suspension and rendering. */
export function mountCoopLobby(host: HTMLElement, options: CoopLobbyOptions) {
  const model=new CoopLobbyState(loadPair(options.store));
  const root=document.createElement('section');root.className='coop-lobby';root.setAttribute('aria-label','Two-player exploration setup');
  const style=document.createElement('style');style.textContent=css;root.append(style);
  const header=document.createElement('header'),intro=document.createElement('div');
  const kicker=document.createElement('div');kicker.className='coop-kicker';kicker.textContent='BELLE ISLE / EXPLORE TOGETHER';
  const title=document.createElement('h1');title.textContent='Two riders. Your island.';
  const mode=document.createElement('span');mode.className='coop-mode';mode.textContent='LOCAL CO-OP SETUP';
  intro.append(kicker,title);header.append(intro,mode);root.append(header);
  const description=document.createElement('p');description.textContent='Choose each rider, wheel profile and controls independently. Both players confirm the same loadout before preparation begins.';root.append(description);
  const panes=document.createElement('div');panes.className='coop-panes';root.append(panes);
  const fields:HTMLFieldSetElement[]=[],readyButtons:HTMLButtonElement[]=[],readyText:HTMLElement[]=[];
  const controls:{rider:HTMLSelectElement;vehicle:HTMLSelectElement;input:HTMLSelectElement}[]=[];
  let busy=false,closed=false,complete=false,controller:AbortController|undefined;
  const status=document.createElement('p');status.className='coop-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const readPads=()=>options.pads?.()??[];
  const bindingLabel=(id:string)=>id==='wasd'?'Keyboard · WASD':id==='arrows'?'Keyboard · Arrow keys':'Controller '+(Number(id.slice(4))+1);
  for(const seat of [0,1] as const){
    const field=document.createElement('fieldset');field.dataset.seat=String(seat);fields.push(field);
    const legend=document.createElement('legend');legend.textContent='Player '+(seat+1);field.append(legend);
    function select(name:string,items:readonly {id:string;label:string}[]){
      const label=document.createElement('label'),el=document.createElement('select');el.id=`coop-p${seat+1}-${name}`;label.htmlFor=el.id;label.textContent=name==='input'?'Controls':name==='vehicle'?'Vehicle profile':'Swoop rider';
      el.setAttribute('aria-label',`Player ${seat+1} ${name}`);for(const item of items)el.add(new Option(item.label,item.id));field.append(label,el);return el;
    }
    const rider=select('rider',RIDERS),vehicle=select('vehicle',VEHICLES),input=select('input',BINDINGS.map(id=>({id,label:bindingLabel(id)})));
    const c=model.snapshot().players[seat];rider.value=c.riderId;vehicle.value=c.vehicleId;input.value=c.binding;controls.push({rider,vehicle,input});
    const change=()=>{complete=false;model.select(seat,{riderId:rider.value,vehicleId:vehicle.value,binding:input.value});const persisted=savePair(options.store,model.snapshot().players);refresh(persisted?'Loadout saved. Both players need to confirm again.':'Loadout updated for this visit; browser storage is unavailable.');};
    rider.onchange=vehicle.onchange=input.onchange=change;
    const ready=document.createElement('button');ready.type='button';ready.className='coop-ready';ready.setAttribute('aria-pressed','false');
    ready.onclick=()=>{complete=false;const snapshot=model.snapshot(),errors=setupErrors(snapshot.players,'local',readPads());if(errors.length){refresh(errors.join(' '));return;}model.setReady(seat,!snapshot.ready[seat],snapshot.revision);refresh();};
    const state=document.createElement('span');state.className='coop-ready-state';readyText.push(state);readyButtons.push(ready);field.append(ready,state);panes.append(field);
  }
  const footer=document.createElement('div');footer.className='coop-footer';const begin=document.createElement('button');begin.type='button';begin.className='coop-begin';begin.textContent=options.preview?'Review selected pair':'Prepare exploration';
  const close=document.createElement('button');close.type='button';close.textContent='Close setup';footer.append(begin,close);root.append(footer,status);
  const details=document.createElement('details'),summary=document.createElement('summary'),note=document.createElement('p');summary.textContent='Controls and integration status';note.className='coop-note';
  note.textContent='P1: WASD, Space hop, R recover. P2: arrows, Enter hop, / recover. Controllers: left stick, A hop, X recover, Y interact, B brake. Release controls after pause or reconnect. This review component does not start the island. Vehicle profiles are mappings, not new vehicle meshes. Co-op hoverbikes, bicycle adapters, wardrobe variants and online room synchronization still require integration and rig tests.';
  details.append(summary,note);root.append(details);host.append(root);
  function refresh(message?:string){
    const snapshot=model.snapshot(),errors=setupErrors(snapshot.players,'local',readPads());
    for(const seat of [0,1] as const){fields[seat].disabled=busy;readyButtons[seat].textContent=snapshot.ready[seat]?'Player '+(seat+1)+' ready ✓':'Confirm Player '+(seat+1);readyButtons[seat].setAttribute('aria-pressed',String(snapshot.ready[seat]));readyText[seat].textContent=snapshot.ready[seat]?'Confirmed for this loadout':'Choose your rider and controls.';}
    begin.disabled=busy||complete||errors.length>0||!snapshot.ready.every(Boolean);
    status.textContent=errors.length?errors.join(' '):(message??(snapshot.ready.every(Boolean)?'Both players confirmed. Ready to prepare their separate actors.':'Waiting for both players to confirm.'));
  }
  begin.onclick=async()=>{
    if(busy||closed||complete)return;const snapshot=model.snapshot(),errors=setupErrors(snapshot.players,'local',readPads());if(errors.length){refresh(errors.join(' '));return;}
    try{const pair=model.manifests();busy=true;controller=new AbortController();refresh('Preparing the selected pair…');await options.onBegin(pair,controller.signal);if(!closed&&!controller.signal.aborted){complete=true;refresh(options.preview?'Both manifests validated. No game world has been started in this preview.':'Both actors prepared; the host controls scene activation.');if(!options.preview)dispose();}}
    catch(error){if(!closed){model.invalidate();refresh(error instanceof Error?error.message:'Preparation failed. Try again.');}}
    finally{busy=false;if(!closed){const message=status.textContent??'';refresh(message);}}
  };
  const onPadChange=()=>{complete=false;controller?.abort(new Error('Controller disconnected during preparation.'));model.invalidate();refresh('Controller connection changed. Release controls and confirm both players again.');};
  window.addEventListener('gamepadconnected',onPadChange);window.addEventListener('gamepaddisconnected',onPadChange);
  const dispose=()=>{if(closed)return;closed=true;controller?.abort();window.removeEventListener('gamepadconnected',onPadChange);window.removeEventListener('gamepaddisconnected',onPadChange);root.remove();};
  close.onclick=()=>{dispose();options.onClose?.();};refresh();
  return {root,model,dispose};
}

import {LOTTO_APP_URL} from './lottoShopSite.ts';
import {LottoComponents} from './lottoComponents.ts';

/** Loads the real hosted app only after an explicit player action. */
export class LottoAppDesk {
 readonly launch=document.createElement('button');
 readonly toolsLaunch=document.createElement('button');
 readonly view=document.createElement('section');
 private frame:HTMLIFrameElement|undefined;
 private readonly closeButton=document.createElement('button');
 private readonly expandButton=document.createElement('button');
 private readonly loading=document.createElement('p');
 private tools?:LottoComponents;
 private toolsOpen=false;
 private external=document.createElement('a');
 constructor(private readonly panel:HTMLDetailsElement,private readonly onOpen:()=>void,private readonly onClose:()=>void){
  this.launch.type='button';this.launch.className='lotto-app-launch';this.launch.textContent='Open LottoMind app here';this.launch.onclick=()=>this.open();
  this.toolsLaunch.type='button';this.toolsLaunch.className='lotto-app-launch';this.toolsLaunch.textContent='Use LottoMind store tools';this.toolsLaunch.onclick=()=>this.openTools();
  this.view.className='lotto-app-view';this.view.hidden=true;this.view.setAttribute('aria-label','Live LottoMind app');
  const toolbar=document.createElement('div');toolbar.className='lotto-app-toolbar';
  const toolsButton=document.createElement('button');toolsButton.type='button';toolsButton.textContent='Store tools';toolsButton.onclick=()=>this.openTools();
  this.closeButton.type='button';this.closeButton.textContent='← Back to ride';this.closeButton.onclick=()=>this.close(false);
  this.expandButton.type='button';this.expandButton.textContent='Expand app';this.expandButton.setAttribute('aria-pressed','false');this.expandButton.onclick=()=>{const expanded=panel.classList.toggle('app-expanded');this.expandButton.setAttribute('aria-pressed',String(expanded));this.expandButton.textContent=expanded?'Smaller view':'Expand app';};
  const external=this.external;external.href=LOTTO_APP_URL;external.target='_blank';external.rel='noopener noreferrer';external.textContent='Open in new tab ↗';
  toolbar.append(this.closeButton,toolsButton,this.expandButton,external);
  this.loading.textContent='Loading LottoMind…';this.loading.setAttribute('role','status');this.view.append(toolbar,this.loading);
  panel.addEventListener('toggle',()=>{if(!panel.open)this.close(false);});
  panel.addEventListener('keydown',event=>{if(this.active&&event.key==='Escape'){event.preventDefault();this.close();}});
 }
 get active(){return !!this.frame||this.toolsOpen;}
 private begin(){
  this.panel.open=true;
  if(!this.active)this.onOpen();this.panel.classList.add('app-open');this.view.hidden=false;
 }
 openTools(){
  this.begin();this.unloadFrame();this.toolsOpen=true;this.loading.hidden=true;
  this.tools??=new LottoComponents(path=>this.open(path));if(!this.tools.element.isConnected)this.view.append(this.tools.element);this.tools.element.hidden=false;this.closeButton.focus();
  this.expandButton.textContent=this.panel.classList.contains('app-expanded')?'Smaller view':'Expand desk';
  this.external.href=LOTTO_APP_URL;
 }
 open(path=''){
  const url=new URL(path,LOTTO_APP_URL);if(url.origin!==new URL(LOTTO_APP_URL).origin||!url.pathname.startsWith(new URL(LOTTO_APP_URL).pathname))throw Error('Unsupported LottoMind app route.');
  this.begin();this.unloadFrame();this.toolsOpen=false;if(this.tools)this.tools.element.hidden=true;this.loading.hidden=false;this.external.href=url.href;
  const frame=document.createElement('iframe');this.frame=frame;frame.title='LottoMind live web app';frame.className='lotto-app-frame';frame.setAttribute('aria-busy','true');frame.referrerPolicy='strict-origin-when-cross-origin';frame.allow='fullscreen';
  frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads');
  frame.onload=()=>{if(this.frame!==frame)return;this.loading.hidden=true;frame.setAttribute('aria-busy','false');};
  frame.onerror=()=>{if(this.frame!==frame)return;this.loading.hidden=false;this.loading.textContent='Could not load the app. Use Open in new tab.';frame.setAttribute('aria-busy','false');};
  this.loading.textContent='Loading LottoMind…';frame.src=url.href;this.view.append(frame);this.closeButton.focus();
 }
 private unloadFrame(){
  if(!this.frame)return;
  this.frame.onload=null;this.frame.onerror=null;this.frame.src='about:blank';this.frame.remove();this.frame=undefined;
 }
 close(restoreFocus=true){
  if(!this.active)return;this.unloadFrame();this.toolsOpen=false;if(this.tools)this.tools.element.hidden=true;
  this.view.hidden=true;this.panel.classList.remove('app-open','app-expanded');this.panel.open=false;this.expandButton.textContent='Expand app';this.expandButton.setAttribute('aria-pressed','false');this.onClose();
  if(restoreFocus&&!this.panel.hidden)this.panel.querySelector('summary')?.focus();
 }
}

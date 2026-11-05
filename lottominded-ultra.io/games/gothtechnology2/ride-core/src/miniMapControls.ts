/** Map visibility affects only presentation; navigation and race gates still tick. */
export class MiniMapControls {
 readonly toggle=document.createElement('button');
 private collapsed=false;private opacity=.68;
 constructor(widget:HTMLElement,title:string,footer:HTMLElement){
  const key='mini-map-view-'+title;
  try{const saved=JSON.parse(localStorage.getItem(key)??'null');this.collapsed=saved?.hidden===true;this.opacity=Math.max(.35,Math.min(1,Number(saved?.opacity)||.68));}catch{}
  this.toggle.type='button';this.toggle.className='mini-map-hide';widget.prepend(this.toggle);
  const label=document.createElement('label'),range=document.createElement('input');label.textContent='Map opacity ';range.type='range';range.min='35';range.max='100';range.value=String(Math.round(this.opacity*100));range.setAttribute('aria-label','Mini-map opacity');label.append(range);footer.append(label);
  const apply=()=>{widget.classList.toggle('mini-map-collapsed',this.collapsed);widget.style.setProperty('--mini-map-opacity',String(this.opacity));this.toggle.textContent=this.collapsed?'Show map':'Hide map';this.toggle.setAttribute('aria-expanded',String(!this.collapsed));};
  const save=()=>{try{localStorage.setItem(key,JSON.stringify({hidden:this.collapsed,opacity:this.opacity}));}catch{}};
  this.toggle.onclick=e=>{e.stopPropagation();this.collapsed=!this.collapsed;apply();save();};
  range.oninput=()=>{this.opacity=Number(range.value)/100;apply();save();};apply();
  if(!document.getElementById('mini-map-visibility-style')){const style=document.createElement('style');style.id='mini-map-visibility-style';style.textContent='.tactical-minimap:not(.mini-map-collapsed){opacity:var(--mini-map-opacity,.68)}.mini-map-hide{width:100%;min-height:44px;font:600 12px system-ui;touch-action:manipulation}.tactical-minimap.mini-map-collapsed{width:96px!important;height:auto!important;min-height:44px;background:#173b3290}.mini-map-collapsed>*:not(.mini-map-hide){display:none!important}.map-actions label{display:flex;align-items:center;gap:8px}.map-actions input[type=range]{min-height:44px;width:130px}';document.head.append(style);}
 }
 get hidden(){return this.collapsed;}
}

/** Serialized by Playwright as a read-only page function. Optional arguments
 * let the same DOM visibility policy be tested without launching a renderer. */
export function readPreviewReadinessState({stop=null,captureRenderer=false}={},doc=globalThis.document,styleOf=globalThis.getComputedStyle,previewApi=globalThis.__dequindrePreview){
 const start=doc.querySelector('#start'),welcome=doc.querySelector('#welcome'),banner=doc.querySelector('#dequindre-preview-banner[data-dequindre-preview]'),native=stop?doc.querySelector('[data-cut-travel="preview-cut-'+stop+'"]'):null;
 const shown=element=>{if(!element||element.hidden)return false;const style=styleOf(element);return style.display!=='none'&&style.visibility!=='hidden'&&style.visibility!=='collapse';};
 const visible=element=>{if(!shown(element))return false;const bounds=element.getBoundingClientRect();return bounds.width>0&&bounds.height>0;};
 const hud=doc.querySelector('#ridehud'),speed=doc.querySelector('#ridehud #speed');
 const controls=['recover','mount','brake','hop'].map(id=>({id,visible:visible(doc.querySelector('#ridehud #'+id))}));
 // The original mobile footer has zero own height: its speed readout and
 // action controls are absolutely positioned. Observe those real children.
 const rideHud={hidden:hud?.hidden??true,containerShown:shown(hud),containerBounds:hud?{width:hud.getBoundingClientRect().width,height:hud.getBoundingClientRect().height}:null,speedVisible:visible(speed),controls};
 const destinations=[...doc.querySelectorAll('[data-preview-stop]')],preview=previewApi?.snapshot?.()??null;
 const state={preview,bannerAttached:!!banner,startEnabled:!!start&&!start.disabled,startLabel:doc.querySelector('#start-label')?.textContent?.trim()??'',loading:doc.querySelector('#loading')?.textContent??'',welcomeHidden:welcome?.hidden??false,welcomeState:welcome?.dataset.state??null,bodyAtStart:doc.body.classList.contains('at-start'),selectedVehicle:welcome?.dataset.vehicle??null,checkedVehicle:doc.querySelector('input[name="startup-vehicle"]:checked')?.value??null,camera:welcome?.dataset.camera??null,rideHud,rideHudVisible:rideHud.containerShown&&rideHud.speedVisible&&controls.every(control=>control.visible),bannerVisible:visible(banner),previewUsable:banner?.dataset.ready==='true'&&destinations.length===4&&destinations.every(button=>!button.disabled),activeFrames:Number(doc.querySelector('#profile')?.dataset.activeFrames??0),travelState:native?.dataset.previewTravelState??null,travelMessage:native?.parentElement?.querySelector('[data-preview-travel-status]')?.textContent??''};
 // The host GPU diagnostics exist only after its WebGLRenderer exists. Never
 // call getContext before that point, create a canvas, or intercept a context.
 if(captureRenderer&&preview?.diagnostics?.gpu){
  const canvas=doc.querySelector('#game'),gl=canvas?.getContext('webgl2');
  if(gl){const debug=gl.getExtension('WEBGL_debug_renderer_info');state.browser={capturedAtMs:performance.now(),userAgent:navigator.userAgent,viewport:{width:innerWidth,height:innerHeight},renderer:gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL??gl.RENDERER),vendor:gl.getParameter(debug?.UNMASKED_VENDOR_WEBGL??gl.VENDOR),version:gl.getParameter(gl.VERSION),shadingLanguage:gl.getParameter(gl.SHADING_LANGUAGE_VERSION),contextAttributes:gl.getContextAttributes(),parallelShaderCompileSupported:gl.getSupportedExtensions()?.includes('KHR_parallel_shader_compile')??false,canvasAttributes:{...canvas.dataset}};}
 }
 return state;
}

/** Pure driver preflight. A fallback permission is not a selected GL backend.
 * Keep the observed permission separate from the selected SystemInfo backend;
 * the driver still verifies the actual main canvas before and after capture. */
export function inspectNativeMetalLaunch(commandLine,gpu) {
  const errors=[];
  const unambiguous=typeof commandLine==='string'&&commandLine.length>0&&commandLine.length<=1048576&&
    !/[\x00-\x1f\x7f"'\\]/.test(commandLine);
  if(!unambiguous)errors.push('Native command-line evidence is missing, oversized or ambiguous');
  const switches=unambiguous?(commandLine.match(/(?:^|\s)--[^\s]+/g)?.map(value=>value.trim())??[]):[];
  const required=['--enable-gpu','--use-gl=angle','--use-angle=metal'],nativeSwitches={};
  for(const expected of required){
    const name=expected.split('=')[0],observed=switches.filter(value=>value===name||value.startsWith(name+'='));
    nativeSwitches[name]={expected,observed};
    if(observed.length!==1||observed[0]!==expected)errors.push('Observed native switch mismatch: '+name);
  }
  const permission=switches.filter(value=>/^--enable-unsafe-swiftshader(?:=|$)/.test(value));
  if(permission.some(value=>value!=='--enable-unsafe-swiftshader'))errors.push('Unsupported SwiftShader fallback-permission value');
  const forbidden=switches.filter(value=>/^--(?:disable-gpu|disable-gpu-compositing|disable-gpu-rasterization|disable-webgl|disable-webgl2|override-use-software-gl-for-tests|use-vulkan)(?:=|$)/.test(value));
  if(forbidden.length)errors.push('Forbidden forced or conflicting rendering switches: '+forbidden.join(', '));
  const aux=gpu?.auxAttributes,systemBackend={
    displayType:typeof aux?.displayType==='string'?aux.displayType:null,
    glImplementationParts:typeof aux?.glImplementationParts==='string'?aux.glImplementationParts:null,
    renderer:typeof aux?.glRenderer==='string'?aux.glRenderer:null,
    vendor:typeof aux?.glVendor==='string'?aux.glVendor:null,
    version:typeof aux?.glVersion==='string'?aux.glVersion:null,
  };
  if(systemBackend.displayType!=='ANGLE_METAL'||systemBackend.glImplementationParts!=='(gl=egl-angle,angle=metal)'||
    !/ANGLE.*Metal Renderer:/i.test(systemBackend.renderer??'')||/SwiftShader|llvmpipe|softpipe|software/i.test(systemBackend.renderer??''))
    errors.push('SystemInfo must independently identify the selected native ANGLE Metal backend');
  return {version:1,valid:errors.length===0,errors,nativeSwitches,forbidden,
    swiftShaderFallbackCapability:{present:permission.length>0,count:permission.length,switches:permission,
      note:'This switch permits a fallback; it does not select SwiftShader. Required native switches and the observed backend are checked independently.'},
    systemBackend,note:'SystemInfo preflight only. Actual main-canvas native Metal, default framebuffer and 4x MSAA proofs remain required before and after capture.'};
}

/** Browser-init observation only. The function is deliberately self-contained so
 * Playwright can serialize it without importing anything into the game bundle. */
export function installRenderProgramInventory(options={}) {
  const root=globalThis;
  if(root.__belleProgramInventory)throw Error('Program inventory already installed');
  const defaults={contexts:8,programs:1024,shaders:2048,vertexArrays:16384,buffers:16384,framebuffers:4096,
    attributes:64,linkEpochs:16,layouts:8192,combinations:16384,events:20000,subdraws:8192,
    shaderCharacters:1048576,sourceCharacters:67108864,errors:128};
  const limits={...defaults};
  for(const [key,value] of Object.entries(options.limits??{})){
    if(!Object.hasOwn(defaults,key)||!Number.isSafeInteger(value)||value<1||value>defaults[key])throw Error('Invalid inventory limit: '+key);
    limits[key]=value;
  }
  const GL={ARRAY_BUFFER:34962,ELEMENT_ARRAY_BUFFER:34963,FRAMEBUFFER:36160,DRAW_FRAMEBUFFER:36009,
    READ_FRAMEBUFFER:36008,FLOAT:5126,INT:5124,UNSIGNED_INT:5125,VERTEX_SHADER:35633,FRAGMENT_SHADER:35632,
    LINK_STATUS:35714,ACTIVE_ATTRIBUTES:35721,SHADER_TYPE:35663,BLEND:3042,SAMPLE_ALPHA_TO_COVERAGE:32926,
    RASTERIZER_DISCARD:35977,CULL_FACE:2884,DEPTH_TEST:2929,FUNC_ADD:32774,ONE:1,ZERO:0,BACK:1029,CCW:2305,LESS:513};
  const contexts=[],contextMap=new WeakMap(),hooks=[],errors=[],drops={},sourceStrings=new Set(),delegations=[];
  let sourceCharacters=0,status='idle',captureStarted=null,captureEnded=null,disposed=false,exported=null;
  let trustedDowns=0,trustedUps=0,repeats=0,ignoredUntrusted=0,blurs=0,hidden=0,observerErrors=0;
  const object=value=>value!==null&&(typeof value==='object'||typeof value==='function');
  const int=value=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
  const now=()=>root.performance.now();
  const active=()=>status==='capturing';
  const drop=name=>{drops[name]=(drops[name]??0)+1;};
  const message=value=>{try{return String(value?.message??value).slice(0,512);}catch{return 'Unprintable observer error';}};
  const error=(where,value)=>{observerErrors++;if(errors.length<limits.errors)errors.push({where,message:message(value)});else drop('errors');};
  const attempt=(where,fn)=>{try{return fn();}catch(value){error(where,value);return undefined;}};
  const retainSource=value=>{
    if(typeof value!=='string'){drop('nonStringShaderSource');return null;}
    if(value.length>limits.shaderCharacters){drop('shaderCharacters');return null;}
    if(!sourceStrings.has(value)){
      if(sourceCharacters+value.length>limits.sourceCharacters){drop('sourceCharacters');return null;}
      sourceStrings.add(value);sourceCharacters+=value.length;
    }
    return value;
  };
  function wrap(target,name,before,after,label,required=true){
    if(!object(target)){if(required)error(label,'Missing hook target');return null;}
    let own,original,wrapper;
    try{
      own=Object.getOwnPropertyDescriptor(target,name);let descriptor=own,owner=target,depth=0;
      while(!descriptor&&(owner=Object.getPrototypeOf(owner))){if(++depth>64)throw Error('Prototype depth');descriptor=Object.getOwnPropertyDescriptor(owner,name);}
      if(!descriptor||!('value'in descriptor)||typeof descriptor.value!=='function'||descriptor.writable===false)throw Error('Missing, accessor or nonwritable method');
      original=descriptor.value;
      wrapper=function(...args){
        if(disposed)return Reflect.apply(original,this,args);
        const token=before?attempt(label+':before',()=>before(this,args)):undefined;
        let returned=false,result;
        const depth=delegations.length;
        if(depth<64)delegations.push({target,name,receiver:this});else error(label,'Native delegation depth exceeded');
        try{result=Reflect.apply(original,this,args);returned=true;return result;}
        finally{if(depth<64)delegations.length=depth;if(after)attempt(label+':after',()=>after(this,args,result,returned,token));}
      };
      Object.defineProperty(target,name,own?{...own,value:wrapper}:{value:wrapper,writable:true,configurable:true,enumerable:false});
      if(Object.getOwnPropertyDescriptor(target,name)?.value!==wrapper)throw Error('Wrapper not retained');
      const entry={target,name,own,wrapper,label,required,installed:true};hooks.push(entry);return original;
    }catch(value){
      if(wrapper&&Object.getOwnPropertyDescriptor(target,name)?.value===wrapper){if(own)Object.defineProperty(target,name,own);else Reflect.deleteProperty(target,name);}
      hooks.push({label,required,installed:false});if(required)error(label,value);return null;
    }
  }
  function hookCoverage(){return hooks.map(h=>({name:h.label,required:h.required,
    installed:!!h.installed,bindingIntact:!!h.installed&&Object.getOwnPropertyDescriptor(h.target,h.name)?.value===h.wrapper}));}
  const byteSize=type=>typeof type==='number'?({5120:1,5121:1,5122:2,5123:2,5124:4,5125:4,5126:4,5131:2,33640:4,36255:4}[type]??null):null;
  function register(gl,canvas,api){
    if(!object(gl)||contextMap.has(gl))return;
    if(contexts.length>=limits.contexts){drop('contexts');return;}
    const state={id:contexts.length+1,gl,canvas,api,programs:[],programMap:new WeakMap(),shaders:[],shaderMap:new WeakMap(),
      vaos:[],vaoMap:new WeakMap(),buffers:0,bufferMap:new WeakMap(),deletedBuffers:new Set(),framebuffers:0,framebufferMap:new WeakMap(),deletedFramebuffers:new Set(),
      currentProgram:null,currentVao:null,arrayBuffer:0,drawFramebuffer:0,genericTypes:new Map(),genericVersion:0,
      layouts:[],layoutMap:new Map(),combinations:[],combinationMap:new Map(),events:[],
      extensionObjects:new WeakSet(),extensions:[],native:{},lost:0,restored:0,lifecycle:[],unobservedCalls:0,foreignReceiverLifetime:0,
      counts:{drawCalls:0,nonemptyDrawCalls:0,subdraws:0,noOpDrawCalls:0,drawThrows:0,unsampledDrawEvents:0,unknownProgramDraws:0,
        unknownLayoutDraws:0,foreignReceiverCalls:0,programRequests:0,programRequestThrows:0,linkCalls:0,shaderMutations:0},
      raster:{blend:false,alphaToCoverage:false,rasterizerDiscard:false,cull:false,depthTest:false,
        blendEquationRGB:GL.FUNC_ADD,blendEquationAlpha:GL.FUNC_ADD,blendSrcRGB:GL.ONE,blendDstRGB:GL.ZERO,
        blendSrcAlpha:GL.ONE,blendDstAlpha:GL.ZERO,colorMask:[true,true,true,true],cullFace:GL.BACK,frontFace:GL.CCW,depthMask:true,depthFunc:GL.LESS}};
    const newVao=id=>({id,version:0,attributes:new Map(),elementBuffer:0,known:true,deleted:false,cache:null});
    state.defaultVao=newVao(0);state.currentVao=state.defaultVao;contexts.push(state);contextMap.set(gl,state);
    if(api!=='webgl2')error('context-'+state.id,'Only WebGL2 layout coverage is implemented');
    for(const name of ['getError','isContextLost','isProgram','getProgramParameter','getAttachedShaders','getShaderParameter','getShaderSource','getActiveAttrib','getAttribLocation']){
      const value=gl[name];if(typeof value==='function')state.native[name]=value;else error('context-'+state.id,'Missing export method '+name);
    }
    const lifecycle=event=>{if(state.lifecycle.length<limits.errors)state.lifecycle.push({event,phase:status,atMs:now()});else drop('context-lifecycle-events');};
    // Preview disposal can deliver its loss event asynchronously, after Start.
    // Relevance is determined from actual capture draws at export, not from the
    // notification time. A draw-used or #game context may never waive loss.
    const onLost=()=>{state.lost++;state.currentProgram=undefined;state.currentVao=null;lifecycle('lost');};
    const onRestored=()=>{state.restored++;state.currentProgram=undefined;state.currentVao=null;lifecycle('restored');};
    if(typeof canvas?.addEventListener==='function'){canvas.addEventListener('webglcontextlost',onLost);canvas.addEventListener('webglcontextrestored',onRestored);state.listeners={onLost,onRestored};}
    const owner=(receiver,name,returned)=>{
      if(receiver!==gl){state.foreignReceiverLifetime++;if(active())state.counts.foreignReceiverCalls++;
        error(name,'Borrowed context receiver leaves seeded mutation state unobserved');return false;}
      if(!returned){state.unobservedCalls++;if(active())error(name,'Original GL call threw; its state is unknown');return false;}
      return true;
    };
    const observe=(name,fn,required=true)=>wrap(gl,name,null,(receiver,args,result,returned)=>{if(owner(receiver,name,returned))fn(args,result);},'context-'+state.id+'.'+name,required);
    const lookup=(map,value,kind)=>{if(value===null)return null;const result=object(value)?map.get(value):undefined;if(!result)drop('unknown-'+kind);return result;};
    const bump=vao=>{if(vao){vao.version++;vao.cache=null;}else drop('unknown-vao-state');};
    const attribute=index=>{
      const vao=state.currentVao;if(!vao||!int(index)||index>=limits.attributes){drop('attribute-index');if(vao)vao.known=false;return null;}
      let value=vao.attributes.get(index);
      if(!value){value={location:index,enabled:false,size:4,type:GL.FLOAT,normalized:false,stride:0,offset:0,integer:false,divisor:0,buffer:0,pointerObserved:false};vao.attributes.set(index,value);}
      bump(vao);return value;
    };
    observe('createProgram',(_args,value)=>{
      if(value===null)return;
      if(!object(value)||state.programs.length>=limits.programs){drop('programs');return;}
      const program={id:state.programs.length+1,ref:value,attached:new Set(),attachmentVersion:0,epoch:0,epochs:[],deleted:false,uses:0,draws:0};
      state.programMap.set(value,program);state.programs.push(program);
    });
    observe('createShader',(args,value)=>{
      if(value===null)return;
      if(args[0]!==GL.VERTEX_SHADER&&args[0]!==GL.FRAGMENT_SHADER){drop('non-primitive-shader-type');return;}
      if(!object(value)||state.shaders.length>=limits.shaders){drop('shaders');return;}
      const shader={id:state.shaders.length+1,ref:value,type:args[0],source:null,sourceVersion:0,compileVersion:0,compiledSource:null,compiledSourceVersion:null,deleted:false};
      state.shaderMap.set(value,shader);state.shaders.push(shader);
    });
    observe('shaderSource',args=>{const shader=lookup(state.shaderMap,args[0],'shader');if(shader){shader.source=retainSource(args[1]);shader.sourceVersion++;if(active())state.counts.shaderMutations++;}});
    observe('compileShader',args=>{const shader=lookup(state.shaderMap,args[0],'shader');if(shader){shader.compileVersion++;shader.compiledSource=shader.source;shader.compiledSourceVersion=shader.sourceVersion;}});
    for(const [name,adding] of [['attachShader',true],['detachShader',false]])observe(name,args=>{
      const program=lookup(state.programMap,args[0],'program'),shader=lookup(state.shaderMap,args[1],'shader');
      if(program&&shader){if(adding)program.attached.add(shader);else program.attached.delete(shader);program.attachmentVersion++;}
    });
    observe('linkProgram',args=>{
      const program=lookup(state.programMap,args[0],'program');if(!program)return;
      program.epoch++;if(active())state.counts.linkCalls++;
      if(program.epochs.length>=limits.linkEpochs){drop('linkEpochs');return;}
      program.epochs.push({epoch:program.epoch,attachmentVersion:program.attachmentVersion,drawCalls:0,subdraws:0,firstDrawMs:null,lastDrawMs:null,
        shaders:[...program.attached].map(shader=>({shader,source:shader.compiledSource,type:shader.type,sourceVersion:shader.compiledSourceVersion,compileVersion:shader.compileVersion}))});
    });
    observe('deleteShader',args=>{const shader=lookup(state.shaderMap,args[0],'shader');if(shader)shader.deleted=true;});
    observe('deleteProgram',args=>{const program=lookup(state.programMap,args[0],'program');if(program)program.deleted=true;});
    wrap(gl,'useProgram',null,(receiver,args,_result,returned)=>{
      if(receiver!==gl){state.foreignReceiverLifetime++;if(active())state.counts.foreignReceiverCalls++;
        error('useProgram','Borrowed context receiver leaves seeded program state unobserved');return;}
      if(active()){state.counts.programRequests++;if(!returned)state.counts.programRequestThrows++;}
      if(!returned){state.currentProgram=undefined;return;}
      state.currentProgram=lookup(state.programMap,args[0],'program');if(state.currentProgram&&active())state.currentProgram.uses++;
    },'context-'+state.id+'.useProgram');
    observe('createBuffer',(_args,value)=>{if(value===null)return;if(!object(value)||state.buffers>=limits.buffers){drop('buffers');return;}state.bufferMap.set(value,++state.buffers);});
    observe('bindBuffer',args=>{
      if(!int(args[0])){drop('non-primitive-buffer-target');return;}
      const id=args[1]===null?0:object(args[1])?state.bufferMap.get(args[1]):undefined;
      if(id===undefined||state.deletedBuffers.has(id)){drop('unknown-or-deleted-buffer');state.arrayBuffer=undefined;return;}
      if(args[0]===GL.ARRAY_BUFFER)state.arrayBuffer=id;
      else if(args[0]===GL.ELEMENT_ARRAY_BUFFER){if(state.currentVao)state.currentVao.elementBuffer=id;else drop('unknown-element-buffer');}
    });
    observe('deleteBuffer',args=>{
      if(args[0]===null)return;const id=object(args[0])?state.bufferMap.get(args[0]):undefined;
      if(id===undefined){drop('unknown-buffer-deletion');return;}state.deletedBuffers.add(id);
      if(state.arrayBuffer===id)state.arrayBuffer=0;
      for(const vao of [state.defaultVao,...state.vaos]){
        if(vao.elementBuffer===id)vao.elementBuffer=0;
        // Lifetime rules for attachments in noncurrent VAOs can retain native
        // references. Do not guess: any later draw through a referencing VAO
        // needs new observed pointer state or is explicitly incomplete.
        if([...vao.attributes.values()].some(attribute=>attribute.buffer===id)){vao.known=false;bump(vao);}
      }
    });
    observe('createVertexArray',(_args,value)=>{
      if(value===null)return;if(!object(value)||state.vaos.length>=limits.vertexArrays){drop('vertexArrays');return;}
      const vao=newVao(state.vaos.length+1);state.vaos.push(vao);state.vaoMap.set(value,vao);
    });
    observe('bindVertexArray',args=>{state.currentVao=args[0]===null?state.defaultVao:lookup(state.vaoMap,args[0],'vao');if(state.currentVao?.deleted){state.currentVao=null;drop('deleted-vao-binding');}});
    observe('deleteVertexArray',args=>{const vao=lookup(state.vaoMap,args[0],'vao');if(vao){vao.deleted=true;if(state.currentVao===vao)state.currentVao=state.defaultVao;}});
    for(const [name,enabled] of [['enableVertexAttribArray',true],['disableVertexAttribArray',false]])observe(name,args=>{const value=attribute(args[0]);if(value)value.enabled=enabled;});
    observe('vertexAttribDivisor',args=>{const value=attribute(args[0]);if(value&&int(args[1]))value.divisor=args[1];else{drop('invalid-divisor');if(state.currentVao)state.currentVao.known=false;}});
    for(const [name,integer] of [['vertexAttribPointer',false],['vertexAttribIPointer',true]])observe(name,args=>{
      const [index,size,type]=args,normalized=integer?false:args[3],stride=args[integer?3:4],offset=args[integer?4:5];
      const value=attribute(index);
      if(!value||!int(size)||size<1||size>4||!byteSize(type)||typeof normalized!=='boolean'||!int(stride)||!int(offset)||!state.arrayBuffer){
        drop('invalid-attribute-pointer');if(state.currentVao)state.currentVao.known=false;return;
      }
      Object.assign(value,{size,type,normalized,stride,offset,integer,buffer:state.arrayBuffer,pointerObserved:true});
    });
    for(const name of ['vertexAttrib1f','vertexAttrib2f','vertexAttrib3f','vertexAttrib4f','vertexAttrib1fv','vertexAttrib2fv','vertexAttrib3fv','vertexAttrib4fv','vertexAttribI4i','vertexAttribI4iv','vertexAttribI4ui','vertexAttribI4uiv'])observe(name,args=>{
      if(!int(args[0])||args[0]>=limits.attributes){drop('generic-attribute-index');return;}
      state.genericTypes.set(args[0],name.startsWith('vertexAttribI4u')?'uint':name.startsWith('vertexAttribI4')?'int':'float');state.genericVersion++;
    });
    observe('createFramebuffer',(_args,value)=>{if(value===null)return;if(!object(value)||state.framebuffers>=limits.framebuffers){drop('framebuffers');return;}state.framebufferMap.set(value,++state.framebuffers);});
    observe('bindFramebuffer',args=>{
      if(!int(args[0])){drop('non-primitive-framebuffer-target');return;}
      if(args[0]!==GL.FRAMEBUFFER&&args[0]!==GL.DRAW_FRAMEBUFFER)return;
      state.drawFramebuffer=args[1]===null?0:object(args[1])?state.framebufferMap.get(args[1]):undefined;
      if(state.drawFramebuffer===undefined||state.deletedFramebuffers.has(state.drawFramebuffer)){state.drawFramebuffer=undefined;drop('unknown-or-deleted-framebuffer');}
    });
    observe('deleteFramebuffer',args=>{
      if(args[0]===null)return;const id=object(args[0])?state.framebufferMap.get(args[0]):undefined;
      if(id===undefined){drop('unknown-framebuffer-deletion');return;}state.deletedFramebuffers.add(id);
      if(state.drawFramebuffer===id)state.drawFramebuffer=0;
    });
    for(const [name,enabled] of [['enable',true],['disable',false]])observe(name,args=>{
      if(!int(args[0])){drop('non-primitive-enable-capability');return;}
      const key=({[GL.BLEND]:'blend',[GL.SAMPLE_ALPHA_TO_COVERAGE]:'alphaToCoverage',[GL.RASTERIZER_DISCARD]:'rasterizerDiscard',[GL.CULL_FACE]:'cull',[GL.DEPTH_TEST]:'depthTest'})[args[0]];
      if(key)state.raster[key]=enabled;
    });
    for(const [name,keys] of [
      ['blendEquation',['blendEquationRGB','blendEquationAlpha']],['blendEquationSeparate',['blendEquationRGB','blendEquationAlpha']],
      ['blendFunc',['blendSrcRGB','blendDstRGB','blendSrcAlpha','blendDstAlpha']],['blendFuncSeparate',['blendSrcRGB','blendDstRGB','blendSrcAlpha','blendDstAlpha']],
      ['cullFace',['cullFace']],['frontFace',['frontFace']],['depthMask',['depthMask']],['depthFunc',['depthFunc']],
    ])observe(name,args=>{for(let i=0;i<keys.length;i++){
      const value=args[name==='blendEquation'?0:name==='blendFunc'?i%2:i];
      if(name==='depthMask'?typeof value!=='boolean':!int(value)){drop('invalid-raster-argument');return;}
      state.raster[keys[i]]=value;
    }});
    observe('colorMask',args=>{if(args.length<4||args.slice(0,4).some(value=>typeof value!=='boolean')){drop('invalid-color-mask');return;}state.raster.colorMask=args.slice(0,4);});
    function layout(){
      const vao=state.currentVao;if(!vao||!vao.known)return null;
      if(vao.cache?.version===vao.version&&vao.cache.genericVersion===state.genericVersion)return vao.cache.id;
      const attributes=[];
      for(let location=0;location<limits.attributes;location++){
        const value=vao.attributes.get(location);
        if(value?.enabled){
          if(!value.pointerObserved||!value.buffer)return null;
          attributes.push({location,enabled:true,size:value.size,type:value.type,normalized:value.normalized,
            stride:value.stride,effectiveStride:value.stride||((value.type===33640||value.type===36255)?4:value.size*byteSize(value.type)),integer:value.integer,divisor:value.divisor});
        }else attributes.push({location,enabled:false,genericType:state.genericTypes.get(location)??'float'});
      }
      const key=JSON.stringify(attributes);let id=state.layoutMap.get(key);
      if(id===undefined){
        if(state.layouts.length>=limits.layouts){drop('layouts');return null;}
        id=state.layouts.length+1;state.layoutMap.set(key,id);state.layouts.push({id,attributes});
      }
      vao.cache={version:vao.version,genericVersion:state.genericVersion,id};return id;
    }
    function drawCounts(name,args){
      if(name.startsWith('multiDraw')){
        if(name.includes('BaseInstance')){drop('unsupported-base-instance-multidraw');return null;}
        const elements=name.includes('Elements'),instanced=name.includes('Instanced');
        const counts=args[elements?1:3],offset=args[elements?2:4];
        const instances=instanced?args[elements?6:5]:null,instanceOffset=instanced?args[elements?7:6]:0;
        const drawcount=args[elements?(instanced?8:6):(instanced?7:5)];
        if(!int(drawcount)||drawcount>limits.subdraws||!int(offset)||!ArrayBuffer.isView(counts)||counts instanceof DataView||offset+drawcount>counts.length||
          (instanced&&(!int(instanceOffset)||!ArrayBuffer.isView(instances)||instances instanceof DataView||instanceOffset+drawcount>instances.length))){drop('multi-draw-counts');return null;}
        let count=0;for(let i=0;i<drawcount;i++){
          if(!int(counts[offset+i])||(instanced&&!int(instances[instanceOffset+i]))){drop('invalid-multi-draw-count');return null;}
          if(counts[offset+i]>0&&(!instanced||instances[instanceOffset+i]>0))count++;
        }
        return {nonempty:count,requested:drawcount};
      }
      const ranged=name==='drawRangeElements',elements=name.includes('Elements'),instanced=name.includes('Instanced');
      const count=args[ranged?3:elements?1:2],instances=instanced?args[elements?4:3]:1;
      if(!int(count)||!int(instances)){drop('invalid-draw-count');return null;}
      return {nonempty:count>0&&instances>0?1:0,requested:1};
    }
    function drawBefore(receiver,args,name,expected){
      if(!active())return null;
      if(receiver!==expected){state.counts.foreignReceiverCalls++;return {foreign:true};}
      let counts=drawCounts(name,args);const program=state.currentProgram,epoch=program?.epochs.find(value=>value.epoch===program.epoch);
      const mode=args[0],elementType=name.includes('Elements')?args[name==='drawRangeElements'?4:name.startsWith('multiDraw')?3:2]:null;
      if(!int(mode)||mode>6||(elementType!==null&&![5121,5123,5125].includes(elementType))){drop('invalid-draw-enum');counts=null;}
      return {counts,program,epoch,layout:counts?.nonempty?layout():null,mode:args[0],
        elementType,
        vao:state.currentVao?.id??null,framebuffer:state.drawFramebuffer,raster:{...state.raster,colorMask:[...state.raster.colorMask]},at:now()-captureStarted};
    }
    function drawAfter(_receiver,_args,_result,returned,token,name){
      if(!token||token.foreign)return;
      state.counts.drawCalls++;if(!returned){state.counts.drawThrows++;error(name,'Draw threw during capture');return;}
      if(!token.counts){error(name,'Draw count is unknown');return;}
      if(!token.counts.nonempty){state.counts.noOpDrawCalls++;return;}
      state.counts.nonemptyDrawCalls++;state.counts.subdraws+=token.counts.nonempty;
      const {program,epoch}=token;
      if(!program||!epoch){state.counts.unknownProgramDraws++;error(name,'No observed linked program epoch for nonempty draw');return;}
      if(token.layout===null){state.counts.unknownLayoutDraws++;error(name,'Unknown vertex layout for nonempty draw');}
      program.draws++;epoch.drawCalls++;epoch.subdraws+=token.counts.nonempty;epoch.firstDrawMs??=token.at;epoch.lastDrawMs=token.at;
      const key=JSON.stringify([program.id,epoch.epoch,token.layout,token.mode,token.elementType,token.framebuffer===0?'default':'offscreen',token.raster]);
      let combination=state.combinationMap.get(key);
      if(!combination){
        if(state.combinations.length>=limits.combinations){drop('combinations');return;}
        combination={id:state.combinations.length+1,programId:program.id,linkEpoch:epoch.epoch,layoutId:token.layout,
          mode:token.mode,elementType:token.elementType,target:token.framebuffer===0?'default':'offscreen',raster:token.raster,
          calls:0,subdraws:0,firstMs:token.at,lastMs:token.at,methods:{},framebuffers:new Set(),vaos:new Set()};
        state.combinations.push(combination);state.combinationMap.set(key,combination);
      }
      combination.calls++;combination.subdraws+=token.counts.nonempty;combination.lastMs=token.at;
      combination.methods[name]=(combination.methods[name]??0)+1;combination.framebuffers.add(token.framebuffer);combination.vaos.add(token.vao);
      // All program/layout/combination totals are complete. Chronological detail
      // uses a declared fixed stride, rather than silently truncating a prefix.
      if((state.counts.nonemptyDrawCalls-1)%256===0){
        if(state.events.length<limits.events)state.events.push({drawOrdinal:state.counts.nonemptyDrawCalls,atMs:token.at,combinationId:combination.id,subdraws:token.counts.nonempty});else drop('events');
      }else state.counts.unsampledDrawEvents++;
    }
    for(const name of ['drawArrays','drawElements','drawRangeElements','drawArraysInstanced','drawElementsInstanced'])
      wrap(gl,name,(receiver,args)=>drawBefore(receiver,args,name,gl),(receiver,args,result,returned,token)=>drawAfter(receiver,args,result,returned,token,name),'context-'+state.id+'.'+name);
    observe('getExtension',(args,value)=>{
      if(!object(value)||state.extensionObjects.has(value))return;
      state.extensionObjects.add(value);if(typeof args[0]!=='string'){drop('non-string-extension-name');return;}
      const name=args[0];state.extensions.push(name);
      const standard=name==='WEBGL_multi_draw';
      const methods=standard?['multiDrawArraysWEBGL','multiDrawElementsWEBGL','multiDrawArraysInstancedWEBGL','multiDrawElementsInstancedWEBGL']:
        name==='WEBGL_draw_instanced_base_vertex_base_instance'?['drawArraysInstancedBaseInstanceWEBGL','drawElementsInstancedBaseVertexBaseInstanceWEBGL']:
        name==='WEBGL_multi_draw_instanced_base_vertex_base_instance'?['multiDrawArraysInstancedBaseInstanceWEBGL','multiDrawElementsInstancedBaseVertexBaseInstanceWEBGL']:[];
      for(const method of methods)wrap(value,method,(receiver,values)=>drawBefore(receiver,values,method,value),
        (receiver,values,result,returned,token)=>drawAfter(receiver,values,result,returned,token,method),'context-'+state.id+'.'+name+'.'+method);
    });
  }
  // Calls explicitly borrowed from the public WebGL prototype would bypass an
  // instance hook. Guard those entry points before application code can cache
  // them. Normal calls delegate from their instance hook and pass unchanged;
  // direct prototype calls are preserved but make coverage incomplete.
  const guardedNames=['createProgram','createShader','shaderSource','compileShader','attachShader','detachShader','linkProgram','deleteShader','deleteProgram','useProgram',
    'createBuffer','bindBuffer','deleteBuffer','createVertexArray','bindVertexArray','deleteVertexArray','enableVertexAttribArray','disableVertexAttribArray','vertexAttribDivisor',
    'vertexAttribPointer','vertexAttribIPointer','vertexAttrib1f','vertexAttrib2f','vertexAttrib3f','vertexAttrib4f','vertexAttrib1fv','vertexAttrib2fv','vertexAttrib3fv','vertexAttrib4fv',
    'vertexAttribI4i','vertexAttribI4iv','vertexAttribI4ui','vertexAttribI4uiv','createFramebuffer','bindFramebuffer','deleteFramebuffer','enable','disable',
    'blendEquation','blendEquationSeparate','blendFunc','blendFuncSeparate','cullFace','frontFace','depthMask','depthFunc','colorMask',
    'drawArrays','drawElements','drawRangeElements','drawArraysInstanced','drawElementsInstanced','getExtension'];
  const guardedOwners=new WeakMap();
  for(const prototype of [root.WebGL2RenderingContext?.prototype,root.WebGLRenderingContext?.prototype]){
    if(!prototype)continue;
    for(const name of guardedNames){
      let owner=prototype,descriptor;
      while(owner&&!(descriptor=Object.getOwnPropertyDescriptor(owner,name)))owner=Object.getPrototypeOf(owner);
      if(!owner||!descriptor||typeof descriptor.value!=='function')continue;
      let names=guardedOwners.get(owner);if(!names)guardedOwners.set(owner,names=new Set());if(names.has(name))continue;names.add(name);
      wrap(owner,name,receiver=>{
        const delegated=delegations.at(-1);
        if(delegated?.target===receiver&&delegated.receiver===receiver&&delegated.name===name)return;
        error('prototype.'+name,'Direct or borrowed WebGL prototype call bypassed the state observer');
      },null,'WebGLPrototype.'+name);
    }
  }
  for(const [name,prototype] of [['HTMLCanvasElement',root.HTMLCanvasElement?.prototype],['OffscreenCanvas',root.OffscreenCanvas?.prototype]]){
    if(!prototype){if(name==='HTMLCanvasElement')error(name,'Canvas API unavailable');continue;}
    wrap(prototype,'getContext',null,(_receiver,args,result,returned)=>{if(returned&&['webgl2','webgl','experimental-webgl'].includes(args[0]))register(result,_receiver,args[0]);},name+'.getContext');
  }
  function keydown(event){
    if(event.code!=='KeyW')return;if(!event.isTrusted){ignoredUntrusted++;return;}
    if(status==='armed'){if(event.repeat){error('input','First armed W event was a repeat');return;}status='capturing';captureStarted=now();}
    if(active()){trustedDowns++;if(event.repeat)repeats++;}
  }
  function keyup(event){
    if(event.code!=='KeyW')return;if(!event.isTrusted){ignoredUntrusted++;return;}
    if(active()){trustedUps++;captureEnded=now();status='stopped';}
  }
  function blur(){if(active())blurs++;}
  function visibility(){if(active()&&root.document?.hidden)hidden++;}
  root.addEventListener('keydown',keydown,true);root.addEventListener('keyup',keyup,true);root.addEventListener('blur',blur,true);
  root.document?.addEventListener('visibilitychange',visibility,true);
  function summary(){return {version:1,status,limits:{...limits},capture:{startedMs:captureStarted,endedMs:captureEnded,
    durationMs:captureStarted!==null&&captureEnded!==null?captureEnded-captureStarted:null,trustedDowns,trustedUps,repeats,ignoredUntrusted,blurs,hidden},
    contexts:contexts.map(state=>({id:state.id,api:state.api,canvasId:typeof state.canvas?.id==='string'?state.canvas.id:null,
      canvasKind:state.canvas?.constructor?.name??'unknown',programsCreated:state.programs.length,shadersCreated:state.shaders.length,
      vertexArraysCreated:state.vaos.length,buffersCreated:state.buffers,framebuffersCreated:state.framebuffers,
      usedPrograms:state.programs.filter(program=>program.draws>0).length,counts:{...state.counts},lost:state.lost,restored:state.restored,lifecycle:state.lifecycle.map(value=>({...value})),foreignReceiverLifetime:state.foreignReceiverLifetime,
      observedLayouts:state.layouts.length,observedCombinations:state.combinations.length,extensions:[...state.extensions]})),
    sourceCharacters,eventSampling:{stride:256,firstOrdinal:1,countsCoverEveryDraw:true},drops:{...drops},observerErrors,errors:errors.map(value=>({...value})),hooks:hookCoverage(),
    note:'Pass-through API observations, not independently accepted GL bindings, GPU timings or native Metal pipeline identities. No extra render, RAF, timer, GL query, fence or readback is issued during the trusted held-W capture. Inactive startup hooks seed program and VAO state.'};}
  function exportEvidence(){
    if(active()||status==='armed')throw Error('Native introspection is forbidden before trusted release or abort');
    if(exported)return exported;
    const result={...summary(),nativeExportStartedMs:now(),contexts:[],sourceValidationErrors:[]};
    const fail=(where,message)=>result.sourceValidationErrors.push({where,message:String(message).slice(0,512)});
    for(const state of contexts){
      const call=(name,...args)=>Reflect.apply(state.native[name],state.gl,args);
      const item={...summary().contexts.find(value=>value.id===state.id),programs:[],layouts:state.layouts.map(value=>({id:value.id,attributes:value.attributes.map(a=>({...a}))})),
        combinations:state.combinations.map(({framebuffers,vaos,...value})=>({...value,framebuffers:[...framebuffers],vaos:[...vaos]})),events:state.events.map(value=>({...value}))};
      result.contexts.push(item);
      item.requiredForCapture=item.canvasId==='game'||state.counts.nonemptyDrawCalls>0;
      item.scopeReason=item.canvasId==='game'?'required-main-game-context':state.counts.nonemptyDrawCalls>0?'nonempty-draws-during-capture':'excluded-no-nonempty-capture-draws';
      if(!item.requiredForCapture){item.contextLostAtExport=null;item.nativeExportStatus='not-queried-unused-context';continue;}
      item.nativeExportStatus='queried-after-capture';
      item.nativeErrorChecks={};
      const errorCheck=stage=>{
        const check={flags:[],calls:0,reachedNoError:false,limit:8,error:null};item.nativeErrorChecks[stage]=check;
        try{
          for(let index=0;index<check.limit;index++){
            const flag=call('getError');check.calls++;
            if(!int(flag)||flag>65535)throw Error('Invalid native GL error flag');
            if(flag===0){check.reachedNoError=true;break;}check.flags.push(flag);
          }
          if(check.flags.length)fail('context-'+state.id+'/'+stage+'-errors','Native GL flags: '+check.flags.join(','));
          if(!check.reachedNoError)fail('context-'+state.id+'/'+stage+'-errors','Native GL error drain reached its hard bound');
        }catch(value){check.error=message(value);fail('context-'+state.id+'/'+stage+'-errors',check.error);}
      };
      errorCheck('beforeMetadata');
      let lost=true;try{lost=call('isContextLost');}catch(value){fail('context-'+state.id,value);}
      item.contextLostAtExport=lost;if(lost)fail('context-'+state.id,'Context unavailable/lost at export');
      for(const program of state.programs.filter(value=>value.draws>0)){
        const record={id:program.id,uses:program.uses,drawCalls:program.draws,currentLinkEpoch:program.epoch,deleteRequested:program.deleted,
          nativeLinked:false,actualAttachedShaderIds:[],nativeShaders:[],activeAttributes:[],epochs:program.epochs.filter(epoch=>epoch.drawCalls>0).map(epoch=>({
            epoch:epoch.epoch,drawCalls:epoch.drawCalls,subdraws:epoch.subdraws,firstDrawMs:epoch.firstDrawMs,lastDrawMs:epoch.lastDrawMs,
            shaders:epoch.shaders.map(value=>({shaderId:value.shader.id,type:value.type,sourceVersion:value.sourceVersion,compileVersion:value.compileVersion,source:value.source}))})),valid:false,errors:[]};
        item.programs.push(record);
        const problem=message=>{record.errors.push(String(message));fail('context-'+state.id+'/program-'+program.id,message);};
        try{
          if(lost||program.deleted||!call('isProgram',program.ref))throw Error('Draw-used program is deleted or unavailable at export');
          record.nativeLinked=call('getProgramParameter',program.ref,GL.LINK_STATUS)===true;
          if(!record.nativeLinked)throw Error('Draw-used program is not linked at export');
          const used=program.epochs.filter(epoch=>epoch.drawCalls>0);
          if(used.length!==1||used[0].epoch!==program.epoch)throw Error('Program relinked across/after observed draw epochs');
          const epoch=used[0];if(epoch.attachmentVersion!==program.attachmentVersion)throw Error('Shader attachments changed after observed link');
          const attached=call('getAttachedShaders',program.ref);
          if(!Array.isArray(attached)||attached.length!==2)throw Error('Expected actual linked vertex and fragment attachments');
          for(const ref of attached){
            const shader=state.shaderMap.get(ref),type=call('getShaderParameter',ref,GL.SHADER_TYPE),source=call('getShaderSource',ref);
            if(!shader)throw Error('Actual attached shader identity was not observed');
            record.actualAttachedShaderIds.push(shader.id);
            const expected=epoch.shaders.find(value=>value.shader===shader);
            const bounded=retainSource(source);record.nativeShaders.push({shaderId:shader.id,type,source:bounded});
            if(!expected||bounded===null||typeof expected.source!=='string'||expected.type!==type||expected.source!==bounded||
              expected.sourceVersion!==shader.sourceVersion||expected.compileVersion!==shader.compileVersion)throw Error('Attached shader source/compile epoch changed or could not be verified');
          }
          if(record.nativeShaders.filter(shader=>shader.type===GL.VERTEX_SHADER).length!==1||record.nativeShaders.filter(shader=>shader.type===GL.FRAGMENT_SHADER).length!==1)throw Error('Actual vertex/fragment stage pair unavailable');
          const count=call('getProgramParameter',program.ref,GL.ACTIVE_ATTRIBUTES);
          if(!int(count)||count>limits.attributes)throw Error('Active attribute count exceeds bounded coverage');
          for(let index=0;index<count;index++){
            const attribute=call('getActiveAttrib',program.ref,index);
            if(!attribute||typeof attribute.name!=='string'||attribute.name.length>512||!int(attribute.size)||attribute.size<1||!int(attribute.type))throw Error('Invalid active attribute metadata');
            const location=call('getAttribLocation',program.ref,attribute.name);
            const columns=({35674:2,35675:3,35676:4,35685:2,35686:2,35687:3,35688:3,35689:4,35690:4})[attribute.type]??1;
            const locationSpan=columns*attribute.size;
            if(!int(location)||location+locationSpan>limits.attributes)throw Error('Active attribute location span is outside coverage');
            record.activeAttributes.push({name:attribute.name,size:attribute.size,type:attribute.type,location,columns,arraySize:attribute.size,locationSpan,
              occupiedLocations:Array.from({length:locationSpan},(_,offset)=>location+offset)});
          }
          record.valid=true;
        }catch(value){problem(value?.message??value);}
      }
      errorCheck('afterMetadata');
    }
    // Export can itself expose an incomplete source bound. Keep those limits
    // and errors, rather than preserving only the earlier pre-query snapshot.
    Object.assign(result,{drops:{...drops},observerErrors,errors:errors.map(value=>({...value})),sourceCharacters,nativeExportEndedMs:now()});
    const main=result.contexts.filter(state=>state.canvasId==='game');
    result.complete=status==='stopped'&&trustedDowns>0&&trustedUps===1&&blurs===0&&hidden===0&&
      !observerErrors&&!Object.values(drops).some(Boolean)&&result.hooks.every(h=>!h.required||(h.installed&&h.bindingIntact))&&
      !result.sourceValidationErrors.length&&main.length===1&&main[0].api==='webgl2'&&main[0].programs.length>0&&
      result.contexts.every(state=>!state.requiredForCapture||(!state.lost&&!state.restored&&!state.counts.unknownProgramDraws&&!state.counts.unknownLayoutDraws&&!state.counts.foreignReceiverCalls&&!state.counts.drawThrows&&state.programs.every(program=>program.valid)));
    result.releaseAccepted=false;result.performanceVerified=false;
    result.nativeErrorNote='Relevant contexts are checked only after trusted release/abort, before and after metadata queries. Every nonzero flag and a bounded-drain failure invalidate collection. A zero flag does not prove all historical calls were accepted: application code could have consumed errors earlier. Excluded unused contexts are not queried.';
    result.vertexLayoutNote='Layouts retain observed GL API formats and enabled/divisor state, including startup VAOs. Buffer identity and byte offset are intentionally excluded from format identity. All slots are retained; filter by each active attribute occupiedLocations, including all matrix columns and array elements, for a program-specific proxy. FBO attachment formats, native specialization and Metal function identities are not reconstructed. Combination counts are not native pipeline counts.';
    exported=result;return result;
  }
  const api={
    arm(){if(status!=='idle'||disposed)throw Error('Inventory can be armed once');if(!contexts.some(state=>state.canvas?.id==='game'))throw Error('Main game context has not been observed');status='armed';return summary();},
    abort(reason='driver cleanup'){if(status==='capturing'||status==='armed'||status==='idle'){if(active())captureEnded=now();status='aborted';error('capture-aborted',reason);}return summary();},
    summary,exportEvidence,
    dispose(){
      if(disposed)return {disposed:true};if(active()||status==='armed')api.abort('Disposed before trusted release');
      const failures=[];
      for(const hook of hooks.slice().reverse()){
        if(!hook.installed)continue;
        try{if(Object.getOwnPropertyDescriptor(hook.target,hook.name)?.value!==hook.wrapper){failures.push(hook.label+': binding changed');continue;}
          if(hook.own)Object.defineProperty(hook.target,hook.name,hook.own);else if(!Reflect.deleteProperty(hook.target,hook.name))throw Error('Removal failed');
        }catch(value){failures.push(hook.label+': '+String(value));}
      }
      for(const state of contexts)if(state.listeners){state.canvas.removeEventListener('webglcontextlost',state.listeners.onLost);state.canvas.removeEventListener('webglcontextrestored',state.listeners.onRestored);}
      root.removeEventListener('keydown',keydown,true);root.removeEventListener('keyup',keyup,true);root.removeEventListener('blur',blur,true);root.document?.removeEventListener('visibilitychange',visibility,true);
      disposed=true;return {disposed:true,failures};
    },
  };
  Object.defineProperty(root,'__belleProgramInventory',{value:api,configurable:true});
}

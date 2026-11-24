/** Serialize this function directly with Playwright page.addInitScript().
 * It has no imports or external closure state and never issues a GL query.
 * All GL records describe existing, normally returning API requests, not
 * verified driver state, GPU execution, Metal PSOs, or cache misses. */
export function installPipelineCensus(options = {}) {
  const root = globalThis;
  if (Object.hasOwn(root, '__bellePipelineCensus')) return;
  const bounded = (value, fallback, max) => Number.isSafeInteger(value) && value > 0 && value <= max ? value : fallback;
  const limits = {
    sampleEvery: bounded(options.sampleEvery, 15, 120),
    maxFrames: bounded(options.maxFrames, 192, 256),
    maxDrawsPerFrame: bounded(options.maxDrawsPerFrame, 4096, 8192),
    maxTotalDraws: bounded(options.maxTotalDraws, 200000, 300000),
    maxSubdraws: bounded(options.maxSubdraws, 8192, 16384),
    maxDictionaryEntries: bounded(options.maxDictionaryEntries, 16384, 32768),
    maxObjects: bounded(options.maxObjects, 65536, 131072),
    maxProgramInputs: 256, maxUniforms: 2048, maxSourceRecords: 8192,
    maxSourceChars: bounded(options.maxSourceChars, 262144, 1048576),
    maxTotalSourceChars: bounded(options.maxTotalSourceChars, 33554432, 67108864),
    maxIssues: 64,
  };
  const canvasId = typeof options.canvasId === 'string' ? options.canvasId : 'game';
  const G = {
    ARRAY_BUFFER: 34962, ELEMENT_ARRAY_BUFFER: 34963, COPY_READ_BUFFER: 36662, COPY_WRITE_BUFFER: 36663,
    FLOAT: 5126, BYTE: 5120, UNSIGNED_BYTE: 5121, SHORT: 5122, UNSIGNED_SHORT: 5123, INT: 5124, UNSIGNED_INT: 5125,
    HALF_FLOAT: 5131, INT_2_10_10_10_REV: 36255, UNSIGNED_INT_2_10_10_10_REV: 33640,
    FRAMEBUFFER: 36160, DRAW_FRAMEBUFFER: 36009, READ_FRAMEBUFFER: 36008, RENDERBUFFER: 36161,
    COLOR_ATTACHMENT0: 36064, DEPTH_ATTACHMENT: 36096, STENCIL_ATTACHMENT: 36128, DEPTH_STENCIL_ATTACHMENT: 33306,
    BACK: 1029, NONE: 0, TEXTURE0: 33984, TEXTURE_2D: 3553, TEXTURE_CUBE_MAP: 34067,
    TEXTURE_CUBE_MAP_POSITIVE_X: 34069, TEXTURE_CUBE_MAP_NEGATIVE_Z: 34074,
    BLEND: 3042, DEPTH_TEST: 2929, STENCIL_TEST: 2960, CULL_FACE: 2884, POLYGON_OFFSET_FILL: 32823,
    SAMPLE_ALPHA_TO_COVERAGE: 32926, SAMPLE_COVERAGE: 32928, RASTERIZER_DISCARD: 35977,
    FUNC_ADD: 32774, ONE: 1, ZERO: 0, LESS: 513, CCW: 2305, FRONT: 1028, FRONT_AND_BACK: 1032,
    ACTIVE_ATTRIBUTES: 35721, LINK_STATUS: 35714, ACTIVE_UNIFORMS: 35718,
    SAMPLES: 32937, SAMPLE_BUFFERS: 32936, MAX_VERTEX_ATTRIBS: 34921,
  };
  const hooks = [], coverage = [], issues = [];
  const stats = { setterCalls: 0, queryObservations: 0, foreignReceiverCalls: 0, nativeThrows: 0,
    observerErrors: 0, objectLimitHits: 0, sourceTruncations: 0, contextLosses: 0, contextRestores: 0 };
  let disposed = false, context = null, scope = null, capture = null, sourceChars = 0;
  const notes = [
    'Only existing calls are observed. No getParameter, getVertexAttrib, reflection, getError, fence, flush, timer query, or draw is added.',
    'State describes normally returning requests. WebGL can report errors without throwing; no GL-success claim is made.',
    'Frames are draw-bearing requestAnimationFrame callbacks, not compositor presentations or renderer render() calls. Multiple passes remain in the same callback.',
    'Descriptor-like groups are observed GL axes, not Metal PSO identities or eviction counts. Native shader specialization, format conversion, device features, and default framebuffer formats remain unobserved.',
    'Pinned ANGLE 1f6526a566c27c7c33aa73a78517450a4a2a1714 VertexArrayMtl::setupDraw gives enabled inputs offset 0 and slot kVboBindingIndexStart + location; buffer handles/pointer offsets are encoder bindings. Disabled inputs use the default slot and location * kDefaultAttributeSize.',
    'Raw bindings retain offsets, buffer identities, and allocation sizes separately. The descriptor-like grouping excludes these identities and offsets, while retaining possible conversion/short-buffer uncertainty.',
    'Depth/stencil functions, culling, polygon offset, index buffers, draw offsets, uniforms, and generic attribute values are not counted as render-pipeline descriptor axes.',
    'All core and acquired WEBGL_multi_draw draw entry points are counted. Extension calls retain requested subdraw slices; missing hooks, truncation, or outside-RAF work are explicit.',
  ];
  const clone = value => JSON.parse(JSON.stringify(value));
  function issue(kind, detail) {
    if (issues.length < limits.maxIssues) issues.push({ kind, detail: String(detail).slice(0, 400) });
    else if (capture) capture.droppedIssues++;
  }
  function safe(fn) { try { return fn(); } catch (error) { stats.observerErrors++; issue('observer-error', error); } }
  function install(target, name, after, before, label = name) {
    const own = target && Object.getOwnPropertyDescriptor(target, name);
    let original;
    try { original = target?.[name]; } catch { /* Missing capability remains explicit. */ }
    const row = { name: label, status: 'missing' }; coverage.push(row);
    if (typeof original !== 'function') return;
    function wrapper(...args) {
      const matching = this === target;
      if (!matching) stats.foreignReceiverCalls++;
      const token = matching && !disposed ? safe(() => before?.(args)) : undefined;
      let result;
      try { result = Reflect.apply(original, this, args); }
      catch (error) {
        if (matching && !disposed) { stats.nativeThrows++; safe(() => token?.finish?.(false)); }
        throw error;
      }
      if (matching && !disposed) {
        safe(() => after?.(args, result));
        safe(() => token?.finish?.(true));
      }
      return result;
    }
    try {
      Object.defineProperty(target, name, { value: wrapper, writable: true, configurable: true, enumerable: own?.enumerable ?? false });
      hooks.push({ target, name, own, wrapper }); row.status = 'installed';
    } catch (error) { row.status = 'failed'; row.reason = String(error).slice(0, 200); }
  }
  function installPrototype(target, name, make, label) {
    const own = target && Object.getOwnPropertyDescriptor(target, name);
    const original = own?.value;
    const row = { name: label, status: 'missing' }; coverage.push(row);
    if (typeof original !== 'function') return;
    const wrapper = make(original);
    try { Object.defineProperty(target, name, { ...own, value: wrapper }); hooks.push({ target, name, own, wrapper }); row.status = 'installed'; }
    catch (error) { row.status = 'failed'; row.reason = String(error).slice(0, 200); }
  }
  function dictionary() { return { keys: new Map(), values: [] }; }
  function intern(table, value) {
    const key = JSON.stringify(value), known = table.keys.get(key);
    if (known !== undefined) return known;
    if (table.values.length >= limits.maxDictionaryEntries) { capture.dictionaryLimitHits++; return null; }
    const id = table.values.length; table.keys.set(key, id); table.values.push(value); return id;
  }
  function newCapture() {
    return { active: true, startedAt: Date.now(), stoppedAt: null, scopeSequence: 0, drawBearingCallbacks: 0, outsideRafRequests: 0,
      requests: 0, returnedRequests: 0, thrownRequests: 0, extensionRequests: 0, requestedSubdraws: 0,
      retainedDraws: 0, droppedFrames: 0, droppedDraws: 0, droppedSubdraws: 0, dictionaryLimitHits: 0, droppedIssues: 0,
      methods: {}, frames: [], layouts: dictionary(), bindings: dictionary(), states: dictionary(), groups: dictionary(),
      statsAtStart: clone(stats), issuesAtStart: issues.length };
  }
  function openFrame(boundary, timestamp) {
    const number = ++capture.scopeSequence;
    const callbackNumber = boundary === 'requestAnimationFrame' ? ++capture.drawBearingCallbacks : null;
    const selected = callbackNumber === null || (callbackNumber - 1) % limits.sampleEvery === 0;
    const sampled = selected && capture.frames.length < limits.maxFrames;
    if (selected && !sampled) capture.droppedFrames++;
    const frame = { number, callbackNumber, boundary, timestamp: Number.isFinite(timestamp) ? timestamp : null,
      sampled, requests: 0, returnedRequests: 0, thrownRequests: 0, droppedDraws: 0, complete: true, draws: [] };
    if (sampled) capture.frames.push(frame);
    return frame;
  }
  const objectKind = value => value !== null && (typeof value === 'object' || typeof value === 'function');
  function attach(gl, canvas, requested) {
    if (context) { if (context.gl !== gl) issue('additional-game-context', 'Only the first game context is observed'); return; }
    const tables = Object.fromEntries(['buffer', 'vao', 'program', 'shader', 'texture', 'framebuffer', 'renderbuffer'].map(k => [k, { weak: new WeakMap(), rows: [], next: 1 }]));
    function item(kind, object) {
      if (!objectKind(object)) return null;
      const table = tables[kind], found = table.weak.get(object); if (found) return found;
      if (table.rows.length >= limits.maxObjects) { stats.objectLimitHits++; return null; }
      const value = { id: table.next++, deleted: false };
      if (kind === 'vao') Object.assign(value, { attributes: new Map(), elementBuffer: null });
      if (kind === 'buffer') value.bytes = null;
      if (kind === 'program') Object.assign(value, { generation: 0, attached: new Set(), activeAttributes: new Map(), locations: new Map(), uniformNames: new Set(), activeCount: null, linked: null, stages: [], history: [] });
      if (kind === 'shader') Object.assign(value, { type: null, generation: 0, sourceId: null });
      if (kind === 'texture') Object.assign(value, { levels: new Map(), storage: null });
      if (kind === 'framebuffer') Object.assign(value, { attachments: new Map(), drawBuffers: [G.COLOR_ATTACHMENT0], observedSamples: null });
      if (kind === 'renderbuffer') Object.assign(value, { format: null, samples: null, width: null, height: null });
      table.weak.set(object, value); table.rows.push(value); return value;
    }
    const defaultVao = { id: 0, attributes: new Map(), elementBuffer: null };
    const defaultFramebuffer = { id: 0, attachments: new Map(), drawBuffers: [G.BACK], observedSamples: null };
    let vao = defaultVao, program = null, arrayBuffer = null, drawFramebuffer = defaultFramebuffer, readFramebuffer = defaultFramebuffer, renderbuffer = null, textureUnit = 0;
    const bufferBindings = new Map(), textureBindings = new Map(), genericAttributes = new Map(), shaders = [];
    const enabled = new Set([3024]), blend = { enabled: false, equation: [G.FUNC_ADD, G.FUNC_ADD], factors: [G.ONE, G.ZERO, G.ONE, G.ZERO], mask: [true, true, true, true] }, indexedBlend = new Map();
    const stencilDefault = () => ({ func: 519, reference: 0, valueMask: 4294967295, writeMask: 4294967295, operations: [7680, 7680, 7680] });
    const fixed = { depthFunc: G.LESS, depthMask: true, cullFace: G.BACK, frontFace: G.CCW, polygonOffset: [0, 0], blendColor: [0, 0, 0, 0], sampleCoverage: [1, false], stencil: { front: stencilDefault(), back: stencilDefault() } };
    const extensionObjects = new WeakSet();
    context = { gl, canvas, tables, shaders, requested: {}, attributes: null, maxVertexAttribs: null, samples: null,
      status: 'tracking', observedAtGetContextReturn: true, extensions: {}, methods: {}, metadataDropped: 0 };
    for (const name of ['alpha', 'antialias', 'depth', 'stencil', 'premultipliedAlpha', 'preserveDrawingBuffer', 'powerPreference', 'desynchronized']) {
      const d = requested && Object.getOwnPropertyDescriptor(requested, name);
      if (d && 'value' in d && ['boolean', 'string'].includes(typeof d.value)) context.requested[name] = d.value;
    }
    function count(name, query = false) { context.methods[name] = (context.methods[name] ?? 0) + 1; stats[query ? 'queryObservations' : 'setterCalls']++; }
    const set = (name, fn) => install(gl, name, (args, result) => { count(name); if (context.status === 'tracking') fn(args, result); }, undefined, 'gl.' + name);
    const observe = (name, fn) => install(gl, name, (args, result) => { count(name, true); if (context.status === 'tracking') fn(args, result); }, undefined, 'gl.' + name);
    function attribute(index) {
      if (!Number.isInteger(index) || index < 0 || index >= 64) { issue('attribute-index', index); return null; }
      let value = vao.attributes.get(index);
      if (!value) { value = { enabled: false, size: 4, type: G.FLOAT, normalized: false, integer: false, stride: 0, offset: 0, divisor: 0, buffer: null }; vao.attributes.set(index, value); }
      return value;
    }
    function bufferFor(target) { return target === G.ARRAY_BUFFER ? arrayBuffer : target === G.ELEMENT_ARRAY_BUFFER ? vao.elementBuffer : bufferBindings.get(target) ?? null; }
    function fbFor(target) { return target === G.READ_FRAMEBUFFER ? readFramebuffer : drawFramebuffer; }
    function textureTarget(target) { return target >= G.TEXTURE_CUBE_MAP_POSITIVE_X && target <= G.TEXTURE_CUBE_MAP_NEGATIVE_Z ? G.TEXTURE_CUBE_MAP : target; }
    function textureFor(target) { return textureBindings.get(textureUnit + ':' + textureTarget(target)) ?? null; }
    function invalidateSamples(object) { for (const f of tables.framebuffer.rows) if ([...f.attachments.values()].some(a => a.object === object)) f.observedSamples = null; }
    function attachImage(target, attachment, value) { const f = fbFor(target); f.attachments.set(attachment, value); f.observedSamples = null; }
    function perBlend(index) { let b = indexedBlend.get(index); if (!b) { b = clone(blend); indexedBlend.set(index, b); } return b; }
    function allBlend(change) { change(blend); for (const b of indexedBlend.values()) change(b); }
    function programRecord(p) {
      return { id: p.id, generation: p.generation, linked: p.linked, activeCount: p.activeCount,
        activeAttributes: [...p.activeAttributes].map(([index, value]) => ({ index, ...value, location: p.locations.get(value.name) ?? null })),
        uniformNames: [...p.uniformNames].sort(), stages: p.stages.map(v => ({ ...v })), deleted: p.deleted };
    }
    context.programRecords = () => tables.program.rows.flatMap(p => [...p.history, programRecord(p)]);
    for (const [name, kind] of [['createBuffer', 'buffer'], ['createVertexArray', 'vao'], ['createProgram', 'program'], ['createShader', 'shader'], ['createTexture', 'texture'], ['createFramebuffer', 'framebuffer'], ['createRenderbuffer', 'renderbuffer']])
      set(name, (args, result) => { const value = item(kind, result); if (value && kind === 'shader') value.type = args[0]; });
    for (const [name, kind] of [['deleteBuffer', 'buffer'], ['deleteVertexArray', 'vao'], ['deleteProgram', 'program'], ['deleteShader', 'shader'], ['deleteTexture', 'texture'], ['deleteFramebuffer', 'framebuffer'], ['deleteRenderbuffer', 'renderbuffer']])
      set(name, args => {
        const value = item(kind, args[0]); if (!value) return; value.deleted = true;
        if (kind === 'vao' && value === vao) vao = defaultVao;
        if (kind === 'framebuffer') { if (value === drawFramebuffer) drawFramebuffer = defaultFramebuffer; if (value === readFramebuffer) readFramebuffer = defaultFramebuffer; }
        if (kind === 'renderbuffer' && value === renderbuffer) renderbuffer = null;
        if (kind === 'buffer') {
          if (value === arrayBuffer) arrayBuffer = null;
          for (const [target, bound] of bufferBindings) if (bound === value) bufferBindings.set(target, null);
          // Deletion of buffers still referenced by other VAOs is not inferred.
          // Any retained deleted reference makes that layout uncertain.
          if (vao.elementBuffer === value) vao.elementBuffer = null;
          for (const a of vao.attributes.values()) if (a.buffer === value) a.buffer = null;
        }
        if (kind === 'texture') for (const [target, bound] of textureBindings) if (bound === value) textureBindings.set(target, null);
      });
    set('bindVertexArray', args => { vao = args[0] === null ? defaultVao : item('vao', args[0]) ?? defaultVao; });
    set('bindBuffer', ([target, value]) => { const b = item('buffer', value); if (target === G.ARRAY_BUFFER) arrayBuffer = b; else if (target === G.ELEMENT_ARRAY_BUFFER) vao.elementBuffer = b; else bufferBindings.set(target, b); });
    set('bufferData', args => {
      const b = bufferFor(args[0]), value = args[1]; if (!b) return;
      if (typeof value === 'number') b.bytes = value;
      else if (value && Number.isSafeInteger(value.byteLength)) {
        const unit = value.BYTES_PER_ELEMENT ?? 1, start = (args[3] ?? 0) * unit;
        b.bytes = args[4] ? args[4] * unit : value.byteLength - start;
      } else b.bytes = null;
    });
    for (const name of ['enableVertexAttribArray', 'disableVertexAttribArray']) set(name, args => { const a = attribute(args[0]); if (a) a.enabled = name === 'enableVertexAttribArray'; });
    set('vertexAttribPointer', ([index, size, type, normalized, stride, offset]) => { const a = attribute(index); if (a) Object.assign(a, { size, type, normalized, stride, offset, integer: false, buffer: arrayBuffer }); });
    set('vertexAttribIPointer', ([index, size, type, stride, offset]) => { const a = attribute(index); if (a) Object.assign(a, { size, type, normalized: false, stride, offset, integer: true, buffer: arrayBuffer }); });
    set('vertexAttribDivisor', ([index, divisor]) => { const a = attribute(index); if (a) a.divisor = divisor; });
    for (const name of ['vertexAttrib1f', 'vertexAttrib2f', 'vertexAttrib3f', 'vertexAttrib4f', 'vertexAttrib1fv', 'vertexAttrib2fv', 'vertexAttrib3fv', 'vertexAttrib4fv', 'vertexAttribI4i', 'vertexAttribI4ui', 'vertexAttribI4iv', 'vertexAttribI4uiv'])
      set(name, args => { const vector = name.endsWith('v') ? args[1] : args.slice(1), value = [0, 0, 0, 1]; for (let i = 0; i < Math.min(4, vector.length); i++) value[i] = vector[i]; genericAttributes.set(args[0], { method: name, value }); });
    set('useProgram', args => { program = item('program', args[0]); });
    set('attachShader', ([p, s]) => { const pr = item('program', p), sh = item('shader', s); if (pr && sh) pr.attached.add(sh); });
    set('detachShader', ([p, s]) => item('program', p)?.attached.delete(item('shader', s)));
    set('shaderSource', ([object, text]) => {
      const shader = item('shader', object); if (!shader || typeof text !== 'string') return;
      if (shaders.length >= limits.maxSourceRecords) { shader.generation++; shader.sourceId = null; stats.sourceTruncations++; return; }
      const keep = Math.max(0, Math.min(text.length, limits.maxSourceChars, limits.maxTotalSourceChars - sourceChars));
      shader.generation++; shader.sourceId = shaders.length; sourceChars += keep;
      shaders.push({ id: shader.sourceId, shaderId: shader.id, generation: shader.generation, type: shader.type, length: text.length, source: text.slice(0, keep), truncated: keep !== text.length });
      if (keep !== text.length) stats.sourceTruncations++;
    });
    set('linkProgram', ([object]) => {
      const p = item('program', object); if (!p) return;
      if (p.generation) { if (p.history.length < 8) p.history.push(programRecord(p)); else context.metadataDropped++; }
      p.generation++; p.activeAttributes.clear(); p.locations.clear(); p.uniformNames.clear(); p.activeCount = null; p.linked = null;
      p.stages = [...p.attached].map(s => ({ shaderId: s.id, generation: s.generation, type: s.type, sourceId: s.sourceId }));
    });
    observe('getProgramParameter', ([object, name], result) => { const p = item('program', object); if (!p) return; if (name === G.ACTIVE_ATTRIBUTES && Number.isInteger(result)) p.activeCount = result; if (name === G.LINK_STATUS) p.linked = result; });
    observe('getActiveAttrib', ([object, index], result) => { const p = item('program', object); if (p && result) { if (p.activeAttributes.size < limits.maxProgramInputs && typeof result.name === 'string' && result.name.length <= 512) p.activeAttributes.set(index, { name: result.name, size: result.size, type: result.type }); else context.metadataDropped++; } });
    observe('getAttribLocation', ([object, name], result) => { const p = item('program', object); if (p && typeof name === 'string' && Number.isInteger(result)) { if (p.locations.size < limits.maxProgramInputs && name.length <= 512) p.locations.set(name, result); else context.metadataDropped++; } });
    const uniformName = (p, name) => { if (!p || typeof name !== 'string') return; if (name.length <= 512 && (p.uniformNames.has(name) || p.uniformNames.size < limits.maxUniforms)) p.uniformNames.add(name); else context.metadataDropped++; };
    observe('getActiveUniform', ([object], result) => uniformName(item('program', object), result?.name));
    observe('getUniformLocation', ([object, name]) => uniformName(item('program', object), name));
    observe('getContextAttributes', (_args, result) => { if (result) context.attributes = { ...result }; });
    observe('getParameter', ([name], result) => {
      if (name === G.MAX_VERTEX_ATTRIBS) context.maxVertexAttribs = result;
      if (name === G.SAMPLES) { drawFramebuffer.observedSamples = result; if (drawFramebuffer.id === 0) context.samples = result; }
    });
    for (const name of ['enable', 'disable']) set(name, ([cap]) => { const on = name === 'enable'; if (on) enabled.add(cap); else enabled.delete(cap); if (cap === G.BLEND) allBlend(b => { b.enabled = on; }); });
    set('blendEquation', ([mode]) => allBlend(b => { b.equation = [mode, mode]; }));
    set('blendEquationSeparate', args => allBlend(b => { b.equation = args.slice(0, 2); }));
    set('blendFunc', ([src, dst]) => allBlend(b => { b.factors = [src, dst, src, dst]; }));
    set('blendFuncSeparate', args => allBlend(b => { b.factors = args.slice(0, 4); }));
    set('colorMask', args => allBlend(b => { b.mask = args.slice(0, 4); }));
    for (const [name, field, length] of [['blendColor', 'blendColor', 4], ['polygonOffset', 'polygonOffset', 2], ['sampleCoverage', 'sampleCoverage', 2]]) set(name, args => { fixed[field] = args.slice(0, length); });
    for (const name of ['depthFunc', 'depthMask', 'cullFace', 'frontFace']) set(name, args => { fixed[name] = args[0]; });
    for (const name of ['stencilFunc', 'stencilFuncSeparate', 'stencilOp', 'stencilOpSeparate', 'stencilMask', 'stencilMaskSeparate']) set(name, args => {
      const separate = name.endsWith('Separate'), face = separate ? args[0] : G.FRONT_AND_BACK, values = separate ? args.slice(1) : args;
      const faces = face === G.FRONT ? [fixed.stencil.front] : face === G.BACK ? [fixed.stencil.back] : [fixed.stencil.front, fixed.stencil.back];
      for (const s of faces) {
        if (name.startsWith('stencilFunc')) Object.assign(s, { func: values[0], reference: values[1], valueMask: values[2] });
        if (name.startsWith('stencilOp')) s.operations = values.slice(0, 3);
        if (name.startsWith('stencilMask')) s.writeMask = values[0];
      }
    });
    set('bindFramebuffer', ([target, object]) => { const f = object === null ? defaultFramebuffer : item('framebuffer', object); if (!f) return; if (target !== G.READ_FRAMEBUFFER) drawFramebuffer = f; if (target !== G.DRAW_FRAMEBUFFER) readFramebuffer = f; });
    set('drawBuffers', ([buffers]) => { if (buffers.length > 16) { context.metadataDropped++; return; } drawFramebuffer.drawBuffers = Array.from(buffers); });
    set('bindRenderbuffer', (_args) => { renderbuffer = item('renderbuffer', _args[1]); });
    set('renderbufferStorage', ([, format, width, height]) => { if (renderbuffer) { Object.assign(renderbuffer, { format, samples: 0, width, height }); invalidateSamples(renderbuffer); } });
    set('renderbufferStorageMultisample', ([, samples, format, width, height]) => { if (renderbuffer) { Object.assign(renderbuffer, { format, samples, width, height }); invalidateSamples(renderbuffer); } });
    set('framebufferRenderbuffer', ([target, attachment, , object]) => attachImage(target, attachment, { kind: 'renderbuffer', object: item('renderbuffer', object) }));
    set('framebufferTexture2D', ([target, attachment, textureTarget, object, level]) => attachImage(target, attachment, { kind: 'texture', object: item('texture', object), textureTarget, level, layer: null }));
    set('framebufferTextureLayer', ([target, attachment, object, level, layer]) => attachImage(target, attachment, { kind: 'texture', object: item('texture', object), textureTarget: null, level, layer }));
    set('activeTexture', ([unit]) => { textureUnit = unit - G.TEXTURE0; });
    set('bindTexture', ([target, object]) => { const t = item('texture', object); if (t) t.target = textureTarget(target); textureBindings.set(textureUnit + ':' + textureTarget(target), t); });
    for (const name of ['texStorage2D', 'texStorage3D']) set(name, ([target, levels, format, width, height, depth]) => { const t = textureFor(target); if (t) { t.storage = { levels, format, width, height, depth: depth ?? 1, samples: 0 }; invalidateSamples(t); } });
    for (const name of ['texImage2D', 'texImage3D', 'compressedTexImage2D', 'compressedTexImage3D']) set(name, args => {
      const t = textureFor(args[0]); if (t) { t.levels.set(args[0] + ':' + args[1], { format: args[2], samples: 0,
        width: typeof args[3] === 'number' ? args[3] : null, height: typeof args[4] === 'number' ? args[4] : null }); invalidateSamples(t); }
    });
    function columns(type) { return ({ 35674: 2, 35675: 3, 35676: 4, 35685: 2, 35686: 2, 35687: 3, 35688: 3, 35689: 4, 35690: 4 })[type] ?? 1; }
    function bytes(type) { return ({ 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5124: 4, 5125: 4, 5126: 4, 5131: 2, 36255: 4, 33640: 4 })[type] ?? null; }
    function layouts() {
      const raw = [], axes = [], missing = [];
      const complete = !!program && program.activeCount !== null && program.activeAttributes.size === program.activeCount;
      if (!complete) missing.push('active-attribute-inventory-incomplete');
      for (const input of program?.activeAttributes.values() ?? []) {
        const location = program.locations.get(input.name);
        if (!Number.isInteger(location) || location < 0) { missing.push('location:' + input.name); continue; }
        for (let column = 0; column < columns(input.type) * input.size; column++) {
          const slot = location + column, a = vao.attributes.get(slot) ?? { enabled: false, size: 4, type: G.FLOAT, normalized: false, integer: false, stride: 0, offset: 0, divisor: 0, buffer: null };
          const unit = bytes(a.type), packed = a.type === G.INT_2_10_10_10_REV || a.type === G.UNSIGNED_INT_2_10_10_10_REV;
          const stride = a.stride || (unit === null ? null : packed ? unit : unit * a.size);
          const remaining = a.buffer?.bytes === null || !a.buffer ? null : a.buffer.bytes - a.offset;
          const uncertain = a.enabled && (a.type !== G.FLOAT || a.integer || a.normalized || a.offset % 4 !== 0 || stride === null || stride % 4 !== 0 || !a.buffer || a.buffer.deleted || remaining !== null && remaining < stride);
          if (uncertain) missing.push('native-conversion-or-short-buffer:' + slot);
          raw.push({ location: slot, name: input.name, column, inputType: input.type, enabled: a.enabled,
            pointer: { size: a.size, type: a.type, normalized: a.normalized, integer: a.integer, stride: a.stride, offset: a.offset, divisor: a.divisor, bufferId: a.buffer?.id ?? null, bufferBytes: a.buffer?.bytes ?? null },
            generic: a.enabled ? null : genericAttributes.get(slot) ?? { method: 'initial-float-default', value: [0, 0, 0, 1] } });
          axes.push(a.enabled ? { location: slot, inputType: input.type, enabled: true, glFormat: [a.size, a.type, a.normalized, a.integer],
            descriptorOffset: 0, descriptorSlot: 'kVboBindingIndexStart+' + slot, glStride: stride, step: a.divisor ? 'instance' : 'vertex', stepRate: a.divisor || 1, nativeConversionUnknown: !!uncertain }
            : { location: slot, inputType: input.type, enabled: false, descriptorOffset: slot + '*kDefaultAttributeSize', descriptorSlot: 'kDefaultAttribsBindingIndex' });
        }
      }
      raw.sort((a, b) => a.location - b.location); axes.sort((a, b) => a.location - b.location);
      return { raw, axes, missing };
    }
    function attachment(value) {
      if (!value?.object) return { format: null, samples: null, absent: true };
      const object = value.object;
      if (value.kind === 'renderbuffer') return { format: object.format, samples: object.samples, deleted: object.deleted };
      const image = object.levels.get((value.textureTarget ?? object.target) + ':' + value.level) ??
        (object.storage && value.level < object.storage.levels ? object.storage : undefined);
      return { format: image?.format ?? null, samples: value.renderToTextureSamples ?? image?.samples ?? null, deleted: object.deleted };
    }
    function state(mode) {
      const color = drawFramebuffer.drawBuffers.map((buffer, index) => ({ drawBuffer: buffer,
        attachment: drawFramebuffer.id === 0 ? { format: 'implementation-defined-default-color', samples: context.samples } : attachment(drawFramebuffer.attachments.get(buffer)),
        blend: clone(indexedBlend.get(index) ?? blend) }));
      const depth = drawFramebuffer.id === 0 ? { format: 'implementation-defined-default-depth', enabled: context.attributes?.depth ?? context.requested.depth ?? null } : attachment(drawFramebuffer.attachments.get(G.DEPTH_ATTACHMENT) ?? drawFramebuffer.attachments.get(G.DEPTH_STENCIL_ATTACHMENT));
      const stencil = drawFramebuffer.id === 0 ? { format: 'implementation-defined-default-stencil', enabled: context.attributes?.stencil ?? context.requested.stencil ?? null } : attachment(drawFramebuffer.attachments.get(G.STENCIL_ATTACHMENT) ?? drawFramebuffer.attachments.get(G.DEPTH_STENCIL_ATTACHMENT));
      const topology = mode === 0 ? 'points' : [1, 2, 3].includes(mode) ? 'lines' : [4, 5, 6].includes(mode) ? 'triangles' : 'unknown';
      return { axes: { output: { defaultFramebuffer: drawFramebuffer.id === 0, observedGlSamples: drawFramebuffer.observedSamples, color, depth, stencil },
        inputPrimitiveTopology: 'Unspecified in pinned ContextMtl setupDraw', alphaToCoverageRequested: enabled.has(G.SAMPLE_ALPHA_TO_COVERAGE), rasterizerDiscardRequested: enabled.has(G.RASTERIZER_DISCARD) },
        other: { primitiveClass: topology, framebufferId: drawFramebuffer.id, readFramebufferId: readFramebuffer.id, enabled: [...enabled].sort((a, b) => a - b), ...clone(fixed) } };
    }
    function slice(array, offset, length) {
      if (!Number.isSafeInteger(length) || length < 0 || !Number.isSafeInteger(offset) || offset < 0 || !array || typeof array.length !== 'number' || offset + length > array.length) return { values: [], complete: false };
      const n = Math.min(length, limits.maxSubdraws), values = [];
      for (let i = 0; i < n; i++) values.push(array[offset + i]);
      if (n !== length) capture.droppedSubdraws += length - n;
      return { values, complete: n === length };
    }
    function drawArgs(name, args) {
      const mode = args[0];
      if (name === 'drawArrays') return { mode, first: args[1], count: args[2], instances: 1, subdrawCount: 1, complete: true };
      if (name === 'drawElements') return { mode, count: args[1], indexType: args[2], offset: args[3], instances: 1, subdrawCount: 1, complete: true };
      if (name === 'drawRangeElements') return { mode, start: args[1], end: args[2], count: args[3], indexType: args[4], offset: args[5], instances: 1, subdrawCount: 1, complete: true };
      if (name === 'drawArraysInstanced') return { mode, first: args[1], count: args[2], instances: args[3], subdrawCount: 1, complete: true };
      if (name === 'drawElementsInstanced') return { mode, count: args[1], indexType: args[2], offset: args[3], instances: args[4], subdrawCount: 1, complete: true };
      const indexed = name.includes('Elements'), instanced = name.includes('Instanced'), n = args.at(-1);
      const counts = slice(args[indexed ? 1 : 3], args[indexed ? 2 : 4], n);
      const offsets = slice(args[indexed ? 4 : 1], args[indexed ? 5 : 2], n);
      const instances = instanced ? slice(args[indexed ? 6 : 5], args[indexed ? 7 : 6], n) : null;
      return { mode, subdrawCount: n, indexType: indexed ? args[3] : null, counts: counts.values,
        [indexed ? 'offsets' : 'firsts']: offsets.values, instances: instances ? instances.values : 1,
        complete: counts.complete && offsets.complete && (!instances || instances.complete) };
    }
    function beforeDraw(name, args, extension) {
      if (!capture?.active || context.status !== 'tracking') return;
      const current = capture;
      const frame = scope ? (scope.frame ??= openFrame('requestAnimationFrame', scope.timestamp)) : openFrame('outside-requestAnimationFrame', null);
      if (!scope) current.outsideRafRequests++;
      frame.requests++; current.requests++; current.methods[name] = (current.methods[name] ?? 0) + 1;
      if (extension) current.extensionRequests++;
      const n = extension ? args.at(-1) : 1;
      if (Number.isSafeInteger(n) && n >= 0) current.requestedSubdraws += n;
      let row;
      if (frame.sampled) {
        if (frame.draws.length >= limits.maxDrawsPerFrame || current.retainedDraws >= limits.maxTotalDraws) {
          frame.droppedDraws++; frame.complete = false; current.droppedDraws++;
        } else {
          const layout = layouts(), fixedState = state(args[0]), draw = drawArgs(name, args);
          const layoutId = intern(current.layouts, { attributes: layout.axes, uncertainty: layout.missing });
          const bindingId = intern(current.bindings, { vaoId: vao.id, attributes: layout.raw, elementBufferId: vao.elementBuffer?.id ?? null });
          const stateId = intern(current.states, fixedState);
          const groupId = intern(current.groups, { programId: program?.id ?? null, generation: program?.generation ?? null, layoutId, axes: fixedState.axes });
          row = { index: frame.requests, method: name, extension, programId: program?.id ?? null, generation: program?.generation ?? null,
            vaoId: vao.id, layoutId, bindingId, stateId, groupId, draw, returned: null };
          if (!draw.complete || [layoutId, bindingId, stateId, groupId].includes(null)) frame.complete = false;
          frame.draws.push(row); current.retainedDraws++;
        }
      }
      return { finish(returned) { if (returned) { current.returnedRequests++; frame.returnedRequests++; } else { current.thrownRequests++; frame.thrownRequests++; frame.complete = false; } if (row) row.returned = returned; } };
    }
    for (const name of ['drawArrays', 'drawElements', 'drawRangeElements', 'drawArraysInstanced', 'drawElementsInstanced']) install(gl, name, undefined, args => beforeDraw(name, args, false), 'gl.' + name);
    observe('getExtension', ([name], result) => {
      if (typeof name !== 'string') return;
      context.extensions[name] = !!result;
      if (!objectKind(result) || extensionObjects.has(result)) return;
      extensionObjects.add(result);
      if (name === 'WEBGL_multi_draw') {
        for (const method of ['multiDrawArraysWEBGL', 'multiDrawElementsWEBGL', 'multiDrawArraysInstancedWEBGL', 'multiDrawElementsInstancedWEBGL'])
          install(result, method, undefined, args => beforeDraw(method, args, true), name + '.' + method);
      } else if (name === 'WEBGL_multisampled_render_to_texture') {
        install(result, 'framebufferTexture2DMultisampleEXT', ([target, attachment, textureTarget, object, level, samples]) => {
          count(name + '.framebufferTexture2DMultisampleEXT');
          attachImage(target, attachment, { kind: 'texture', object: item('texture', object), textureTarget, level, layer: null, renderToTextureSamples: samples });
        }, undefined, name + '.framebufferTexture2DMultisampleEXT');
        install(result, 'renderbufferStorageMultisampleEXT', ([, samples, format, width, height]) => {
          count(name + '.renderbufferStorageMultisampleEXT');
          if (renderbuffer) { Object.assign(renderbuffer, { format, samples, width, height }); invalidateSamples(renderbuffer); }
        }, undefined, name + '.renderbufferStorageMultisampleEXT');
      } else if (name === 'OES_draw_buffers_indexed') {
        for (const method of ['enableiOES', 'disableiOES', 'blendEquationiOES', 'blendEquationSeparateiOES', 'blendFunciOES', 'blendFuncSeparateiOES', 'colorMaskiOES'])
          install(result, method, args => {
            count(name + '.' + method); let b;
            if (method === 'enableiOES' || method === 'disableiOES') { if (args[0] === G.BLEND) perBlend(args[1]).enabled = method === 'enableiOES'; }
            else { b = perBlend(args[0]); if (method === 'blendEquationiOES') b.equation = [args[1], args[1]];
              if (method === 'blendEquationSeparateiOES') b.equation = args.slice(1, 3);
              if (method === 'blendFunciOES') b.factors = [args[1], args[2], args[1], args[2]];
              if (method === 'blendFuncSeparateiOES') b.factors = args.slice(1, 5);
              if (method === 'colorMaskiOES') b.mask = args.slice(1, 5); }
          }, undefined, name + '.' + method);
      } else if (/instanced|multi.?draw|multisampled|vertex.?array|draw.?buffers/i.test(name)) issue('uncovered-state-or-draw-extension', name);
    });
    canvas.addEventListener?.('webglcontextlost', () => { stats.contextLosses++; context.status = 'lost'; if (capture) capture.active = false; issue('context-lost', 'Capture stopped; no state recovery is inferred'); });
    canvas.addEventListener?.('webglcontextrestored', () => { stats.contextRestores++; context.status = 'restored-untracked'; issue('context-restored', 'Reload is required for a new complete capture'); });
  }
  installPrototype(root.HTMLCanvasElement?.prototype, 'getContext', original => function(...args) {
    const value = Reflect.apply(original, this, args);
    if (!disposed && args[0] === 'webgl2' && this.id === canvasId && value) safe(() => attach(value, this, args[1]));
    return value;
  }, 'HTMLCanvasElement.getContext');
  const rafOwn = Object.getOwnPropertyDescriptor(root, 'requestAnimationFrame');
  const rafOriginal = root.requestAnimationFrame;
  const rafCoverage = { name: 'window.requestAnimationFrame', status: 'missing' }; coverage.push(rafCoverage);
  if (typeof rafOriginal === 'function') {
    function rafWrapper(callback, ...rest) {
      if (typeof callback !== 'function' || disposed) return Reflect.apply(rafOriginal, this, [callback, ...rest]);
      return Reflect.apply(rafOriginal, this, [function(...args) {
        const previous = scope; scope = { timestamp: args[0], frame: null };
        try { return Reflect.apply(callback, this, args); } finally { scope = previous; }
      }, ...rest]);
    }
    try { Object.defineProperty(root, 'requestAnimationFrame', { value: rafWrapper, writable: true, configurable: true, enumerable: rafOwn?.enumerable ?? false }); hooks.push({ target: root, name: 'requestAnimationFrame', own: rafOwn, wrapper: rafWrapper }); rafCoverage.status = 'installed'; }
    catch (error) { rafCoverage.status = 'failed'; rafCoverage.reason = String(error).slice(0, 200); }
  }
  function snapshot() {
    const totals = capture ? Object.fromEntries(Object.entries(capture).filter(([key]) => !['frames', 'layouts', 'bindings', 'states', 'groups', 'statsAtStart'].includes(key))) : null;
    return clone({ version: 1, installed: true, disposed, active: !!capture?.active, canvasId, limits,
      context: context ? { status: context.status, observedAtGetContextReturn: context.observedAtGetContextReturn, requested: context.requested, attributes: context.attributes, maxVertexAttribs: context.maxVertexAttribs, samples: context.samples, extensions: context.extensions, methods: context.methods, metadataDropped: context.metadataDropped } : null,
      coverage, stats, statsAtStart: capture?.statsAtStart ?? null, totals,
      frames: capture?.frames ?? [], layouts: capture?.layouts.values ?? [], bindings: capture?.bindings.values ?? [], states: capture?.states.values ?? [], groups: capture?.groups.values ?? [],
      programs: context?.programRecords() ?? [], shaderSources: context?.shaders ?? [], sourceChars, issues, notes });
  }
  Object.defineProperty(root, '__bellePipelineCensus', { configurable: false, value: {
    start() { if (disposed || !context || context.status !== 'tracking') throw Error('Pipeline census requires a live context observed from creation'); if (capture?.active) throw Error('Pipeline census already active'); capture = newCapture(); if (scope) scope.frame = null; return { version: 1, active: true, startedAt: capture.startedAt, canvasId, sampleEvery: limits.sampleEvery, maxFrames: limits.maxFrames }; },
    stop() { if (capture) { capture.active = false; capture.stoppedAt = Date.now(); } return snapshot(); },
    snapshot,
    dispose() { if (capture) capture.active = false; disposed = true; for (const hook of [...hooks].reverse()) { const current = Object.getOwnPropertyDescriptor(hook.target, hook.name); if (current?.value !== hook.wrapper) continue; if (hook.own) Object.defineProperty(hook.target, hook.name, hook.own); else Reflect.deleteProperty(hook.target, hook.name); } return snapshot(); },
  } });
}

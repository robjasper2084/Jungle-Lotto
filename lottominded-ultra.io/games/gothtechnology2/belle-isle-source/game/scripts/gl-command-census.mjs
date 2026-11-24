/** Diagnostic-only browser observer. Serializable for page.addInitScript.
 * Original calls always execute once, with their original receiver/arguments.
 * No GL query, draw, fence, flush, timer, or animation callback is added.
 */
export function installGlCommandCensus(options = {}) {
  const limits = {calls: 20000000, windows: 4096, programs: 1024, shaders: 2048,
    uniforms: 65536, buffers: 4096, vaos: 4096, sources: 8192,
    uniformScalarsPerCall: 256, uniformScalarsPerWindow: 32768, cachedUniformScalars: 131072,
    uploadBytesPerCall: 1024, uploadBytesPerWindow: 65536, cachedUploadBytes: 262144,
    examples: 32, ...options.limits};
  for (const [key, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value < 1) throw Error('Invalid census limit: ' + key);
  }
  if (Object.hasOwn(window, '__belleCommandCensus')) throw Error('Command census already installed');
  const clock = () => performance.now();
  const errors = [], limitHits = {}, hooks = [], methods = {}, examples = [];
  const programs = new Map(), shaders = new Map(), uniforms = new Map(), buffers = new Map();
  const ids = Object.fromEntries(['programs', 'shaders', 'uniforms', 'buffers', 'vaos', 'sources'].map(name => [name, new WeakMap()]));
  const nextIds = Object.fromEntries(Object.keys(ids).map(name => [name, 0]));
  const genericBuffers = new Map(), elementBuffers = new Map(), uniformCache = new Map(), uploadCache = new Map();
  const bufferTargets = new Set([0x8892, 0x8893, 0x8f36, 0x8f37, 0x8c8e, 0x8a11, 0x88eb, 0x88ec]);
  const windows = [], transitions = new Map();
  let gl, canvas, currentProgram = 0, currentVao = 0, transformFeedback = false;
  let phase = 'waiting-for-input', firstWDownMs = null, lastWUpMs = null, active = false, disposed = false;
  let totalCalls = 0, thrownCalls = 0, uniformScalars = 0, uploadBytes = 0, cachedUniformScalars = 0, cachedUploadBytes = 0;
  let windowStart = null, windowCounts = {}, windowDraws = 0, windowCalls = 0;
  const totals = {uniformCalls: 0, comparedUniformCalls: 0, sameUniformValues: 0, unexaminedUniformCalls: 0,
    uploadCalls: 0, uploadedSourceBytes: 0, allocationBytes: 0, comparedUploadCalls: 0, sameUploadBytes: 0,
    unexaminedUploadCalls: 0, drawCalls: 0};
  const restored = [], extensionObjects = new WeakSet();
  const typedPrototype = Object.getPrototypeOf(Uint8Array.prototype);
  const typedGetters = Object.fromEntries(['length', 'byteLength', 'byteOffset', 'buffer'].map(name => [name, Object.getOwnPropertyDescriptor(typedPrototype, name).get]));
  const arrayBufferLength = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength').get;
  const failure = message => {if (errors.length < 32) errors.push(String(message).slice(0, 300));};
  const limited = name => {limitHits[name] = (limitHits[name] || 0) + 1;};
  const object = value => value !== null && (typeof value === 'object' || typeof value === 'function');
  function id(kind, value) {
    if (!object(value)) return 0;
    const found = ids[kind].get(value); if (found) return found;
    if (nextIds[kind] >= limits[kind]) {limited(kind); return 0;}
    const valueId = ++nextIds[kind]; ids[kind].set(value, valueId); return valueId;
  }
  function program(value) {
    const valueId = id('programs', value);
    if (valueId && !programs.has(valueId)) programs.set(valueId, {id: valueId, shaders: [], calls: 0, draws: 0, uniformCalls: 0, uses: 0});
    return valueId;
  }
  function buffer(value) {
    const valueId = id('buffers', value);
    if (valueId && !buffers.has(valueId)) buffers.set(valueId, {id: valueId, calls: 0, bytes: 0, allocations: 0, sameBytes: 0, compared: 0, ranges: []});
    return valueId;
  }
  const boundBuffer = target => target === 0x8893 ? (elementBuffers.get(currentVao) || 0) : (genericBuffers.get(target) || 0);
  function forgetUniform(valueId) {
    const cached = uniformCache.get(valueId);
    if (cached) {cachedUniformScalars -= cached.values.length; uniformCache.delete(valueId);}
  }
  function forgetUpload(valueId) {
    const cached = uploadCache.get(valueId);
    if (cached) {cachedUploadBytes -= cached.values.length; uploadCache.delete(valueId);}
  }
  function clearUniforms() {uniformCache.clear(); cachedUniformScalars = 0;}
  function clearUploads() {uploadCache.clear(); cachedUploadBytes = 0;}
  function example(value) {if (examples.length < limits.examples) examples.push(value);}
  function closeWindow(reason) {
    if (windowStart === null) return;
    const end = clock();
    if (windows.length < limits.windows) windows.push({id: windows.length + 1, startPageMs: windowStart, endPageMs: end,
      closedBy: reason, calls: windowCalls, draws: windowDraws, methods: windowCounts});
    else limited('windows');
    windowStart = end; windowCounts = {}; windowDraws = windowCalls = 0; uniformScalars = uploadBytes = 0;
  }
  function start(event) {
    if (!event.isTrusted || event.code !== 'KeyW' || phase !== 'waiting-for-input') return;
    firstWDownMs = clock(); windowStart = firstWDownMs;
    if (!gl) failure('Game WebGL2 context was not observed before trusted W-down');
    phase = 'recording'; active = true;
  }
  function stop(event) {
    if (!event.isTrusted || event.code !== 'KeyW' || firstWDownMs === null || lastWUpMs !== null) return;
    lastWUpMs = clock(); active = false;
    if (windowCalls) closeWindow('trusted-W-keyup');
    phase = 'stopped'; windowStart = null;
  }
  function typedSlice(data, offset = 0, length = 0) {
    let size, bytes, byteOffset, backing;
    try {
      size = Reflect.apply(typedGetters.length, data, []); bytes = Reflect.apply(typedGetters.byteLength, data, []);
      byteOffset = Reflect.apply(typedGetters.byteOffset, data, []); backing = Reflect.apply(typedGetters.buffer, data, []);
      // This intrinsic rejects SharedArrayBuffer without reading a user property.
      Reflect.apply(arrayBufferLength, backing, []);
    } catch {return null;}
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > size || !Number.isSafeInteger(length) || length < 0) return null;
    const count = length === 0 ? size - offset : length, elementBytes = size ? bytes / size : 1;
    if (offset + count > size) return null;
    return {data, offset, length: count, buffer: backing, byteOffset: byteOffset + offset * elementBytes, byteLength: count * elementBytes};
  }
  function observeUniform(name, args) {
    totals.uniformCalls++;
    const p = programs.get(currentProgram); if (p) p.uniformCalls++;
    const locationId = id('uniforms', args[0]);
    if (!locationId) {totals.unexaminedUniformCalls++; return;}
    let row = uniforms.get(locationId);
    if (!row) {row = {id: locationId, programId: currentProgram, name: null, calls: 0, compared: 0, sameValues: 0, methods: {}}; uniforms.set(locationId, row);}
    row.calls++; row.methods[name] = (row.methods[name] || 0) + 1;
    const matrix = name.startsWith('uniformMatrix'), array = /v$/.test(name);
    let values = null, count = 0, slice = null;
    if (array) {
      const at = matrix ? 2 : 1;
      slice = typedSlice(args[at], args[at + 1] ?? 0, args[at + 2] ?? 0);
      if (slice) count = slice.length + (matrix ? 1 : 0);
    } else {
      const size = Number(name.match(/^uniform([1-4])/)?.[1]);
      if (Number.isInteger(size) && args.length >= size + 1 && args.slice(1, size + 1).every(value => typeof value === 'number')) count = size;
    }
    if (!count || count > limits.uniformScalarsPerCall || uniformScalars + count > limits.uniformScalarsPerWindow) {
      totals.unexaminedUniformCalls++; forgetUniform(locationId); return;
    }
    if (slice) {
      values = matrix ? [args[1]] : [];
      if (matrix && typeof args[1] !== 'boolean') {totals.unexaminedUniformCalls++; forgetUniform(locationId); return;}
      for (let i = 0; i < slice.length; i++) values.push(slice.data[slice.offset + i]);
    } else values = args.slice(1, count + 1);
    uniformScalars += count; totals.comparedUniformCalls++; row.compared++;
    const previous = uniformCache.get(locationId);
    const same = previous && previous.method === name && previous.programId === currentProgram &&
      previous.values.length === values.length && values.every((value, index) => Object.is(value, previous.values[index]));
    if (same) {
      totals.sameUniformValues++; row.sameValues++;
      example({kind: 'same-uniform-inputs', method: name, programId: currentProgram, uniformId: locationId, uniformName: row.name,
        scalarCount: values.length, window: windows.length + 1});
    }
    forgetUniform(locationId);
    if (cachedUniformScalars + values.length <= limits.cachedUniformScalars) {
      uniformCache.set(locationId, {method: name, programId: currentProgram, values}); cachedUniformScalars += values.length;
    } else limited('cachedUniformScalars');
  }
  function observeUpload(name, args) {
    totals.uploadCalls++;
    const bufferId = boundBuffer(args[0]), row = buffers.get(bufferId);
    if (row) row.calls++;
    const allocation = name === 'bufferData', data = args[allocation ? 1 : 2];
    const destination = allocation ? 0 : args[1];
    if (allocation && typeof data === 'number' && Number.isSafeInteger(data) && data >= 0) {
      totals.allocationBytes += data; if (row) row.allocations += data; forgetUpload(bufferId); return;
    }
    const at = 3;
    let slice = typedSlice(data, args[at] ?? 0, args[at + 1] ?? 0);
    if (!slice && args[at] === undefined) {
      try {slice = {buffer: data, byteOffset: 0, byteLength: Reflect.apply(arrayBufferLength, data, [])};} catch {/* Unexamined input. */}
    }
    if (!slice || !Number.isSafeInteger(destination) || destination < 0 || !bufferId) {
      totals.unexaminedUploadCalls++; forgetUpload(bufferId); return;
    }
    totals.uploadedSourceBytes += slice.byteLength;
    if (row) {
      row.bytes += slice.byteLength;
      if (row.ranges.length < 4) row.ranges.push({method: name, destinationByteOffset: destination, byteLength: slice.byteLength,
        sourceId: id('sources', slice.buffer), sourceByteOffset: slice.byteOffset, window: windows.length + 1});
    }
    if (slice.byteLength > limits.uploadBytesPerCall || uploadBytes + slice.byteLength > limits.uploadBytesPerWindow) {
      totals.unexaminedUploadCalls++; forgetUpload(bufferId); return;
    }
    const values = new Uint8Array(slice.buffer, slice.byteOffset, slice.byteLength);
    uploadBytes += values.length; totals.comparedUploadCalls++; if (row) row.compared++;
    const previous = uploadCache.get(bufferId);
    const same = previous && previous.method === name && previous.destination === destination && previous.values.length === values.length &&
      values.every((value, index) => value === previous.values[index]);
    if (same) {
      totals.sameUploadBytes++; if (row) row.sameBytes++;
      example({kind: 'same-upload-input-bytes', method: name, bufferId, destinationByteOffset: destination,
        byteLength: values.length, window: windows.length + 1});
    }
    forgetUpload(bufferId);
    if (cachedUploadBytes + values.length <= limits.cachedUploadBytes) {
      uploadCache.set(bufferId, {method: name, destination, values: values.slice()}); cachedUploadBytes += values.length;
    } else limited('cachedUploadBytes');
  }
  function observeState(name, args, result) {
    if (name === 'getExtension' && object(result) && typeof args[0] === 'string' && !extensionObjects.has(result)) {
      extensionObjects.add(result); installMethods(result, 'ext:' + args[0].slice(0, 96) + '.');
    } else if (name === 'useProgram') {
      const before = currentProgram; currentProgram = program(args[0]);
      if (active) {
        const row = programs.get(currentProgram); if (row) row.uses++;
        const key = before + '>' + currentProgram;
        if (transitions.has(key) || transitions.size < 4096) transitions.set(key, (transitions.get(key) || 0) + 1);
        else limited('programTransitions');
      }
    } else if (name === 'getUniformLocation' && object(result)) {
      const locationId = id('uniforms', result), programId = program(args[0]);
      if (locationId && !uniforms.has(locationId)) uniforms.set(locationId, {id: locationId, programId,
        name: typeof args[1] === 'string' ? args[1].slice(0, 128) : null, calls: 0, compared: 0, sameValues: 0, methods: {}});
    } else if (name === 'linkProgram' || name === 'deleteProgram') clearUniforms();
    else if (name === 'shaderSource' && typeof args[1] === 'string') {
      const shaderId = id('shaders', args[0]);
      if (shaderId) {
        let hash = 2166136261; for (let i = 0; i < args[1].length; i++) hash = Math.imul(hash ^ args[1].charCodeAt(i), 16777619);
        shaders.set(shaderId, {id: shaderId, sourceLength: args[1].length, sourceFingerprint: (hash >>> 0).toString(16)});
      }
    } else if (name === 'attachShader') {
      const row = programs.get(program(args[0])), shaderId = id('shaders', args[1]);
      if (row && shaderId && !row.shaders.includes(shaderId) && row.shaders.length < 8) row.shaders.push(shaderId);
    } else if (name === 'bindVertexArray') currentVao = args[0] == null ? 0 : (id('vaos', args[0]) || -1);
    else if (name === 'deleteVertexArray') {const valueId = ids.vaos.get(args[0]); elementBuffers.delete(valueId); if (currentVao === valueId) currentVao = 0;}
    else if (['bindBuffer', 'bindBufferBase', 'bindBufferRange'].includes(name)) {
      const target = args[0];
      if (!bufferTargets.has(target)) {limited('untrackedBufferTarget'); genericBuffers.clear(); elementBuffers.clear(); clearUploads(); return;}
      const valueId = buffer(args[name === 'bindBuffer' ? 1 : 2]);
      if (target === 0x8893) {if (currentVao >= 0) elementBuffers.set(currentVao, valueId); else clearUploads();}
      else genericBuffers.set(target, valueId);
    } else if (name === 'deleteBuffer') {
      const valueId = ids.buffers.get(args[0]); forgetUpload(valueId);
      for (const [key, value] of genericBuffers) if (value === valueId) genericBuffers.set(key, 0);
      for (const [key, value] of elementBuffers) if (value === valueId) elementBuffers.set(key, 0);
    } else if (name === 'beginTransformFeedback' || name === 'resumeTransformFeedback') transformFeedback = true;
    else if (name === 'endTransformFeedback' || name === 'pauseTransformFeedback') transformFeedback = false;
    else if (name === 'copyBufferSubData' || name === 'readPixels') clearUploads();
  }
  function observed(name, args, result, thrown) {
    if (phase === 'stopped' || disposed) return;
    if (!thrown) observeState(name, args, result);
    if (!active) return;
    if (totalCalls >= limits.calls) {limited('calls'); active = false; return;}
    totalCalls++; windowCalls++;
    const row = methods[name] || (methods[name] = {calls: 0, thrown: 0}); row.calls++;
    windowCounts[name] = (windowCounts[name] || 0) + 1;
    const p = programs.get(currentProgram); if (p) p.calls++;
    if (thrown) {row.thrown++; thrownCalls++; return;}
    if (/^uniform(?:[1-4](?:f|i|ui)v?|Matrix[234](?:x[234])?fv)$/.test(name)) observeUniform(name, args);
    else if (name === 'bufferData' || name === 'bufferSubData') observeUpload(name, args);
    else if (/^(?:draw(?:Arrays|Elements|RangeElements)|ext:[^.]+\.(?:multiDraw(?:Arrays|Elements)|draw(?:Arrays|Elements)))/.test(name)) {
      totals.drawCalls++; windowDraws++; if (p) p.draws++;
      if (transformFeedback) clearUploads();
    } else if (name === 'flush') closeWindow('observed-original-flush');
  }
  function installMethods(context, prefix = '') {
    const seen = new Set();
    for (let prototype = context; prototype && prototype !== Object.prototype; prototype = Object.getPrototypeOf(prototype)) {
      for (const name of Object.getOwnPropertyNames(prototype)) {
        if (seen.has(name) || name === 'constructor') continue; seen.add(name);
        const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
        if (typeof descriptor?.value !== 'function') continue;
        const original = descriptor.value, own = Object.getOwnPropertyDescriptor(context, name);
        const observedName = prefix + name;
        const hook = {name: prefix ? observedName : 'gl.' + name, status: 'failed'}; hooks.push(hook);
        const wrapper = function (...args) {
          if (this !== context || disposed) return Reflect.apply(original, this, args);
          let result;
          try {result = Reflect.apply(original, this, args);}
          catch (error) {try {observed(observedName, args, undefined, true);} catch (failureValue) {failure(failureValue);} throw error;}
          try {observed(observedName, args, result, false);} catch (error) {failure(error);}
          return result;
        };
        try {
          Object.defineProperty(context, name, {configurable: true, writable: true, enumerable: own?.enumerable ?? false, value: wrapper});
          hook.status = 'installed'; restored.push(() => {if (Object.getOwnPropertyDescriptor(context, name)?.value === wrapper) {if (own) Object.defineProperty(context, name, own); else delete context[name];}});
        } catch (error) {hook.reason = String(error).slice(0, 200);}
      }
    }
  }
  function installContext(context, targetCanvas) {
    if (gl === context) return;
    if (gl) {failure('Game context identity changed'); return;}
    gl = context; canvas = targetCanvas;
    installMethods(context);
    const lost = () => {if (phase === 'stopped' || disposed) return; failure('WebGL context lost during census lifetime'); clearUniforms(); clearUploads();};
    canvas.addEventListener('webglcontextlost', lost);
    restored.push(() => canvas.removeEventListener('webglcontextlost', lost));
  }
  const contextPrototype = HTMLCanvasElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(contextPrototype, 'getContext');
  if (typeof descriptor?.value !== 'function') throw Error('Canvas context factory unavailable');
  const originalGetContext = descriptor.value;
  const getContext = function (...args) {
    const result = Reflect.apply(originalGetContext, this, args);
    if (!disposed && phase !== 'stopped' && args[0] === 'webgl2' && this.id === 'game' && object(result)) {
      try {installContext(result, this);} catch (error) {failure(error);}
    }
    return result;
  };
  Object.defineProperty(contextPrototype, 'getContext', {...descriptor, value: getContext});
  restored.push(() => {if (Object.getOwnPropertyDescriptor(contextPrototype, 'getContext')?.value === getContext) Object.defineProperty(contextPrototype, 'getContext', descriptor);});
  window.addEventListener('keydown', start, true); window.addEventListener('keyup', stop, true);
  const top = (map, key, count = 128) => [...map.values()].filter(row => row[key] > 0).sort((a, b) => b[key] - a[key]).slice(0, count);
  function snapshot() {
    return JSON.parse(JSON.stringify({version: 1, phase, firstWDownMs, lastWUpMs, limits, limitHits, errors, hooks,
      contextObserved: !!gl, totalCalls, thrownCalls, methods, totals, windows, examples,
      programs: top(programs, 'calls'), shaders: [...shaders.values()],
      uniformLocationsByCalls: top(uniforms, 'calls'), uniformLocationsBySameValues: top(uniforms, 'sameValues'),
      buffersByBytes: top(buffers, 'bytes'), buffersBySameBytes: top(buffers, 'sameBytes'),
      programTransitions: [...transitions].sort((a, b) => b[1] - a[1]).slice(0, 128).map(([transition, calls]) => ({transition, calls})),
      identities: nextIds, retainedBindings: {generic: genericBuffers.size, elementArray: elementBuffers.size},
      notes: ['Diagnostic-only counts and supplied-input comparisons. No per-command wall/GPU duration is measured.',
        'Original methods keep their receiver, arguments, return value and thrown exception. The observer issues no native GL call and does not wrap animation scheduling.',
        'Windows close on existing successful native flush returns; they are submission windows, not inferred animation frames. First W-down and W-up are genuine trusted receipts.',
        'Same-value receipts compare supplied inputs, not driver-accepted state. GL errors are never queried or cleared. Removing calls requires separate semantic validation.',
        'Uniform arrays compare bounded typed-array elements only. Large, shared or unexamined writes invalidate the previous comparison cache; ordinary arrays are not read again.',
        'Buffer byte receipts compare only the previous fully examined upload to that observed buffer. Copies, readbacks and active transform-feedback draws invalidate upload caches.',
        'Native method identities and names are observed without GL introspection. Shader fingerprints are non-cryptographic identifiers of supplied source, not integrity hashes.',
        'Observer overhead is included. Top identity lists are bounded summaries; total method counts remain separate. Limit hits and errors prevent a complete-evidence claim.']}));
  }
  Object.defineProperty(window, '__belleCommandCensus', {configurable: true, value: snapshot});
  return {snapshot, dispose() {
    if (disposed) return; active = false; disposed = true;
    window.removeEventListener('keydown', start, true); window.removeEventListener('keyup', stop, true);
    for (const restore of restored.reverse()) {try {restore();} catch (error) {failure(error);}}
    if (Object.getOwnPropertyDescriptor(window, '__belleCommandCensus')?.value === snapshot) delete window.__belleCommandCensus;
  }};
}

const vertexShaderSource = `
  attribute vec2 aPosition;

  void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

const fragmentShaderSource = `
  precision highp float;

  uniform vec2 uResolution;
  uniform vec2 uLight;
  uniform vec2 uBall;
  uniform float uTime;
  uniform float uMotion;

  #define MAX_STEPS 34

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  mat2 rotate2d(float a) {
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c);
  }

  float sdCircle(vec2 p, float radius) {
    return length(p) - radius;
  }

  float sdRoundedBox(vec2 p, vec2 halfSize, float radius) {
    vec2 q = abs(p) - halfSize + radius;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - radius;
  }

  float sdCapsule(vec2 p, vec2 a, vec2 b, float radius) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - radius;
  }

  float sceneSdf(vec2 p) {
    float d = 10.0;

    d = min(d, sdCircle(p - uBall, 0.115));
    d = min(d, sdCircle(p - vec2(-0.56, 0.20), 0.195));

    vec2 boxPoint = rotate2d(-0.34) * (p - vec2(0.53, -0.17));
    d = min(d, sdRoundedBox(boxPoint, vec2(0.16, 0.30), 0.065));

    d = min(d, sdCapsule(p, vec2(-0.28, -0.47), vec2(0.28, -0.40), 0.060));

    vec2 topBar = rotate2d(0.08) * (p - vec2(0.02, 0.53));
    d = min(d, sdRoundedBox(topBar, vec2(0.33, 0.050), 0.035));

    vec2 guidePlate = rotate2d(0.22) * (p - vec2(-0.08, -0.02));
    d = min(d, sdRoundedBox(guidePlate, vec2(0.48, 0.028), 0.028));

    return d;
  }

  vec2 sceneNormal(vec2 p) {
    float e = 0.0016;
    vec2 h = vec2(e, 0.0);
    vec2 gradient = vec2(
      sceneSdf(p + h.xy) - sceneSdf(p - h.xy),
      sceneSdf(p + h.yx) - sceneSdf(p - h.yx)
    );
    return gradient / max(length(gradient), 0.00001);
  }

  float softVisibility(vec2 rayOrigin, vec2 rayDirection, float maxDistance) {
    float visibility = 1.0;
    float travel = 0.014;

    for (int i = 0; i < MAX_STEPS; i++) {
      if (travel >= maxDistance) break;

      float distanceToScene = sceneSdf(rayOrigin + rayDirection * travel);
      if (distanceToScene < 0.0014) return 0.0;

      visibility = min(visibility, 13.0 * distanceToScene / travel);
      travel += clamp(distanceToScene * 0.82, 0.007, 0.15);
    }

    return clamp(visibility, 0.0, 1.0);
  }

  vec3 lightPalette(float angle) {
    float violetBlend = 0.5 + 0.5 * sin(angle * 1.35 + uTime * 0.16 * uMotion);
    vec3 cyan = vec3(0.16, 0.95, 1.00);
    vec3 gold = vec3(1.00, 0.76, 0.22);
    vec3 violet = vec3(0.46, 0.24, 1.00);
    return mix(mix(cyan, gold, 0.34), violet, violetBlend * 0.62);
  }

  void main() {
    vec2 frag = gl_FragCoord.xy;
    vec2 uv = frag / uResolution;
    vec2 p = (2.0 * frag - uResolution) / uResolution.y;

    float signedDistance = sceneSdf(p);
    vec2 toLight = uLight - p;
    float lightDistance = max(length(toLight), 0.0001);
    vec2 lightDirection = toLight / lightDistance;
    float angle = atan(toLight.y, toLight.x);

    vec3 backgroundLow = vec3(0.006, 0.012, 0.020);
    vec3 backgroundHigh = vec3(0.018, 0.036, 0.052);
    vec3 color = mix(backgroundLow, backgroundHigh, smoothstep(0.0, 1.0, uv.y));

    float visibility = 0.0;
    if (signedDistance > 0.0 && lightDistance > 0.035) {
      visibility = softVisibility(
        p + lightDirection * 0.006,
        lightDirection,
        max(lightDistance - 0.030, 0.0)
      );
    }

    vec3 lightColor = lightPalette(angle);
    float attenuation = 1.0 / (0.13 + 2.6 * lightDistance * lightDistance);
    float halo = exp(-3.0 * lightDistance);
    float core = exp(-72.0 * lightDistance * lightDistance);

    float fineRays = 0.94 + 0.06 * sin(
      angle * 52.0 + lightDistance * 8.0 - uTime * 0.42 * uMotion
    );
    float broadRays = 0.91 + 0.09 * sin(
      angle * 11.0 - uTime * 0.24 * uMotion
    );

    color += lightColor * visibility * attenuation * fineRays * broadRays * 0.23;
    color += lightColor * halo * 0.08;
    color += lightColor * core * 1.45;

    float pixelSize = 1.5 / uResolution.y;
    float bodyMask = 1.0 - smoothstep(-pixelSize, pixelSize, signedDistance);
    float edgeMask = 1.0 - smoothstep(0.0, 0.018, abs(signedDistance));

    if (signedDistance < 0.025) {
      vec2 normal = sceneNormal(p);
      float facing = max(dot(normal, lightDirection), 0.0);
      vec3 objectColor = vec3(0.010, 0.014, 0.026);
      objectColor += lightColor * facing * attenuation * 0.14;
      color = mix(color, objectColor, bodyMask);
      color += lightColor * edgeMask * (0.14 + 0.18 * facing);
    }

    float ballDistance = abs(sdCircle(p - uBall, 0.115));
    float ballRim = 1.0 - smoothstep(0.0, 0.016, ballDistance);
    color += vec3(0.38, 0.92, 1.00) * ballRim * 0.38;

    vec2 vignettePoint = (uv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
    float vignette = smoothstep(1.15, 0.20, length(vignettePoint));
    color *= 0.72 + 0.28 * vignette;

    float grain = hash12(frag + floor(uTime * 30.0 * uMotion)) - 0.5;
    color += grain * 0.012;
    color = 1.0 - exp(-color * 1.12);

    gl_FragColor = vec4(color, 1.0);
  }
`;

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || "Shader compile failed.";
    gl.deleteShader(shader);
    throw new Error(message);
  }

  return shader;
}

function createProgram(gl) {
  const program = gl.createProgram();
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || "Program link failed.";
    gl.deleteProgram(program);
    throw new Error(message);
  }

  return program;
}

function lerp(value, target, amount) {
  return value + (target - value) * amount;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function eventToScenePoint(event, host, target) {
  const rect = host.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  const aspect = rect.width / rect.height;
  const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
  const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);

  target.x = (x * 2 - 1) * aspect;
  target.y = 1 - y * 2;
}

function isInteractiveTarget(target) {
  return target instanceof Element
    && Boolean(target.closest("a, button, input, select, textarea, [role='button']"));
}

function createNoopController() {
  return {
    destroy() {},
    setPaused() {},
    togglePaused() {
      return true;
    }
  };
}

export function createGuideRayBackground(host, options = {}) {
  if (!(host instanceof HTMLElement)) return createNoopController();

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.className = "guide-ray-canvas";
  host.append(canvas);

  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "high-performance",
    premultipliedAlpha: false
  });

  if (!gl) {
    host.dataset.rayBackground = "fallback";
    return createNoopController();
  }

  let program;
  try {
    program = createProgram(gl);
  } catch (error) {
    console.warn("Guide ray background disabled.", error);
    host.dataset.rayBackground = "fallback";
    return createNoopController();
  }

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW
  );

  const attributes = {
    position: gl.getAttribLocation(program, "aPosition")
  };

  const uniforms = {
    resolution: gl.getUniformLocation(program, "uResolution"),
    light: gl.getUniformLocation(program, "uLight"),
    ball: gl.getUniformLocation(program, "uBall"),
    time: gl.getUniformLocation(program, "uTime"),
    motion: gl.getUniformLocation(program, "uMotion")
  };

  const maxDevicePixelRatio = options.maxDevicePixelRatio || 1.35;
  const renderScale = options.renderScale || 0.84;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const light = { x: 0.30, y: 0.16 };
  const pointer = { x: 0.35, y: 0.12 };
  const ball = { x: -0.15, y: -0.08 };
  const ballTarget = { x: -0.15, y: -0.08 };
  const velocity = { x: 0, y: 0 };
  let width = 1;
  let height = 1;
  let visible = true;
  let paused = false;
  let destroyed = false;
  let previousTime = performance.now();
  let elapsed = 0;
  let lastInteraction = performance.now();

  function resize() {
    const rect = host.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));

    const deviceScale = Math.min(window.devicePixelRatio || 1, maxDevicePixelRatio) * renderScale;
    canvas.width = Math.max(1, Math.round(width * deviceScale));
    canvas.height = Math.max(1, Math.round(height * deviceScale));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function onPointerMove(event) {
    if (reduceMotion.matches || paused) return;
    eventToScenePoint(event, host, pointer);
    lastInteraction = performance.now();
  }

  function onPointerDown(event) {
    if (reduceMotion.matches || paused || isInteractiveTarget(event.target)) return;
    eventToScenePoint(event, host, pointer);
    ballTarget.x = pointer.x;
    ballTarget.y = pointer.y;
    velocity.x += (ballTarget.x - ball.x) * 3.8;
    velocity.y += (ballTarget.y - ball.y) * 3.8;
    lastInteraction = performance.now();
  }

  function update(delta, now) {
    const aspect = width / height;

    if (now - lastInteraction > 3600) {
      const targetX = Math.sin(elapsed * 0.24) * Math.min(aspect * 0.52, 0.82);
      const targetY = Math.cos(elapsed * 0.31) * 0.32;
      const autoAmount = 1 - Math.exp(-1.5 * delta);
      pointer.x = lerp(pointer.x, targetX, autoAmount);
      pointer.y = lerp(pointer.y, targetY, autoAmount);

      if (now - lastInteraction > 7000) {
        ballTarget.x = Math.sin(elapsed * 0.18 + 1.8) * Math.min(aspect * 0.42, 0.68);
        ballTarget.y = Math.sin(elapsed * 0.23 - 0.6) * 0.32;
      }
    }

    const lightAmount = 1 - Math.exp(-11.0 * delta);
    light.x = lerp(light.x, pointer.x, lightAmount);
    light.y = lerp(light.y, pointer.y, lightAmount);

    velocity.x += (ballTarget.x - ball.x) * 24.0 * delta;
    velocity.y += (ballTarget.y - ball.y) * 24.0 * delta;
    const damping = Math.exp(-6.7 * delta);
    velocity.x *= damping;
    velocity.y *= damping;
    ball.x += velocity.x * delta;
    ball.y += velocity.y * delta;
    ball.x = clamp(ball.x, -Math.max(0.12, aspect - 0.13), Math.max(0.12, aspect - 0.13));
    ball.y = clamp(ball.y, -0.86, 0.86);
  }

  function render(now) {
    if (destroyed) return;
    if (!paused && visible && !document.hidden) {
      const delta = Math.min(now - previousTime, 50) / 1000;
      previousTime = now;

      if (!reduceMotion.matches) {
        elapsed += delta;
        update(delta, now);
      }

      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.enableVertexAttribArray(attributes.position);
      gl.vertexAttribPointer(attributes.position, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      gl.uniform2f(uniforms.light, light.x, light.y);
      gl.uniform2f(uniforms.ball, ball.x, ball.y);
      gl.uniform1f(uniforms.time, elapsed);
      gl.uniform1f(uniforms.motion, reduceMotion.matches ? 0 : 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      host.dataset.rayBackground = "ready";
    }

    window.requestAnimationFrame(render);
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);

  const intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? true;
    previousTime = performance.now();
  });
  intersectionObserver.observe(host);

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerdown", onPointerDown, { passive: true });
  document.addEventListener("visibilitychange", () => {
    previousTime = performance.now();
  });

  resize();
  window.requestAnimationFrame(render);

  function setPaused(value) {
    paused = Boolean(value);
    previousTime = performance.now();
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerdown", onPointerDown);
    gl.deleteBuffer(positionBuffer);
    gl.deleteProgram(program);
    canvas.remove();
    host.removeAttribute("data-ray-background");
  }

  return {
    destroy,
    setPaused,
    togglePaused() {
      setPaused(!paused);
      return paused;
    }
  };
}

const host = document.querySelector("[data-guide-ray-background]");
if (host) {
  createGuideRayBackground(host, {
    maxDevicePixelRatio: 1.25,
    renderScale: 0.78
  });
}

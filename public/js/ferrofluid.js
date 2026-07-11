const vertexSrc = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const fragmentSrc = `#version 300 es
precision highp float;

uniform vec3 iResolution;
uniform vec2 iMouse;
uniform float iTime;
uniform float uSpeed;
uniform float uScale;
uniform float uTurbulence;
uniform float uFluidity;
uniform float uRimWidth;
uniform float uSharpness;
uniform float uShimmer;
uniform float uGlow;
uniform float uOpacity;
uniform float uMouseStrength;
uniform float uMouseRadius;

in vec2 vUv;
out vec4 fragColor;

#define PI 3.14159265

float hash(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float smin(float a, float b, float k) {
  float r = exp2(-a / k) + exp2(-b / k);
  return -k * log2(r);
}

float sinlerp(float a, float b, float w) {
  return mix(a, b, (sin(w * PI - PI / 2.0) + 1.0) / 2.0);
}

float vn(vec2 p, float s, float seed) {
  vec2 cellp = floor(p / s);
  vec2 relp = mod(p, s);
  float g1 = hash(vec3(cellp, seed));
  float g2 = hash(vec3(cellp.x + 1.0, cellp.y, seed));
  float g3 = hash(vec3(cellp.x + 1.0, cellp.y + 1.0, seed));
  float g4 = hash(vec3(cellp.x, cellp.y + 1.0, seed));
  float bx = sinlerp(g1, g2, relp.x / s);
  float tx = sinlerp(g4, g3, relp.x / s);
  return sinlerp(bx, tx, relp.y / s);
}

float dbn(vec2 p, float s, float seed) {
  float o = s / 2.0;
  float n0 = vn(p, s, seed);
  float n1 = vn(p + vec2(o, o), s, seed + 0.1);
  float n2 = vn(p + vec2(-o, o), s, seed + 0.2);
  float n3 = vn(p + vec2(o, -o), s, seed + 0.3);
  float n4 = vn(p + vec2(-o, -o), s, seed + 0.4);
  return (2.0 * n0 + 1.5 * n1 + 1.25 * n2 + 1.125 * n3 + n4) / 7.0;
}

vec3 palette(float h) {
  vec3 c1 = vec3(0.31, 0.27, 1.0);
  vec3 c2 = vec3(0.02, 0.58, 0.83);
  vec3 c3 = vec3(0.39, 0.22, 0.95);
  vec3 c4 = vec3(0.83, 0.27, 0.95);
  float t = fract(h);
  if (t < 0.33) return mix(c1, c2, t / 0.33);
  if (t < 0.66) return mix(c2, c3, (t - 0.33) / 0.33);
  return mix(c3, c4, (t - 0.66) / 0.34);
}

void main() {
  vec2 p = vUv;
  float t = iTime;
  float spd = 200.0 * uSpeed;
  float ref = 700.0 / max(uScale, 0.05);
  vec2 fp = p * iResolution.y / iResolution.y * ref;

  vec2 dir = vec2(0.0, -1.0);
  vec2 perp = vec2(-dir.y, dir.x);

  float distort1 = vn(fp + perp * (t * spd), 60.0, 10.0) * 50.0 * uTurbulence;
  float distort2 = vn(fp - perp * (t * spd), 120.0, 15.0) * 100.0 * uTurbulence;

  float peaks = dbn(fp + distort1 + dir * (t * spd * 0.5), 40.0, 1.0);
  float peaks2 = dbn(fp + distort2 - dir * (t * spd * 0.5), 40.0, 0.0);

  float mapeaks = smin(peaks, peaks2, max(uFluidity, 0.001));

  float mGlow = 0.0;
  if (uMouseStrength > 0.0) {
    vec2 mp = iMouse / iResolution.y * ref;
    float md = length(fp - mp) / ref;
    float rr = max(uMouseRadius, 0.02);
    mGlow = exp(-md * md / (rr * rr)) * uMouseStrength;
  }

  float band = (uRimWidth - abs((mapeaks - 0.4) * 2.0)) * 5.0;
  float ltn = clamp(band - vn(fp + dir * (t * spd * 0.5), 60.0, 12.0) * uShimmer, 0.0, 1.0);
  ltn = pow(ltn, uSharpness) * uGlow;
  ltn *= clamp(1.0 - mGlow, 0.0, 1.0);

  float h = clamp(0.5 + (peaks - peaks2) * 0.8, 0.0, 1.0);
  vec3 col = palette(h);

  vec3 outc = col * ltn;
  float a = clamp(max(outc.r, max(outc.g, outc.b)), 0.0, 1.0);
  fragColor = vec4(outc, a * uOpacity);
}`;

export function createFerrofluid(container, opts = {}) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;display:block;pointer-events:none;z-index:0';
  container.insertBefore(canvas, container.firstChild);

  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false });
  if (!gl) {
    container.removeChild(canvas);
    throw new Error('WebGL2 not supported');
  }

  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, vertexSrc);
  gl.compileShader(vs);

  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, fragmentSrc);
  gl.compileShader(fs);

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const verts = new Float32Array([-1, -1, 3, -1, -1, 3]);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

  const posLoc = gl.getAttribLocation(prog, 'position');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const locs = {
    iResolution: gl.getUniformLocation(prog, 'iResolution'),
    iMouse: gl.getUniformLocation(prog, 'iMouse'),
    iTime: gl.getUniformLocation(prog, 'iTime'),
    uSpeed: gl.getUniformLocation(prog, 'uSpeed'),
    uScale: gl.getUniformLocation(prog, 'uScale'),
    uTurbulence: gl.getUniformLocation(prog, 'uTurbulence'),
    uFluidity: gl.getUniformLocation(prog, 'uFluidity'),
    uRimWidth: gl.getUniformLocation(prog, 'uRimWidth'),
    uSharpness: gl.getUniformLocation(prog, 'uSharpness'),
    uShimmer: gl.getUniformLocation(prog, 'uShimmer'),
    uGlow: gl.getUniformLocation(prog, 'uGlow'),
    uOpacity: gl.getUniformLocation(prog, 'uOpacity'),
    uMouseStrength: gl.getUniformLocation(prog, 'uMouseStrength'),
    uMouseRadius: gl.getUniformLocation(prog, 'uMouseRadius'),
  };

  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  let w = container.clientWidth;
  let h = container.clientHeight;

  const resize = () => {
    w = container.clientWidth;
    h = container.clientHeight;
    canvas.width = w * DPR;
    canvas.height = h * DPR;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform3f(locs.iResolution, canvas.width, canvas.height, 1);
  };
  resize();
  window.addEventListener('resize', resize);

  const mouse = { x: 0, y: 0 };
  canvas.addEventListener('pointermove', (e) => {
    mouse.x = (e.clientX / w) * canvas.width;
    mouse.y = (1 - e.clientY / h) * canvas.height;
  });

  gl.uniform1f(locs.uSpeed, opts.speed ?? 0.5);
  gl.uniform1f(locs.uScale, opts.scale ?? 1.6);
  gl.uniform1f(locs.uTurbulence, opts.turbulence ?? 1.2);
  gl.uniform1f(locs.uFluidity, opts.fluidity ?? 0.15);
  gl.uniform1f(locs.uRimWidth, opts.rimWidth ?? 0.25);
  gl.uniform1f(locs.uSharpness, opts.sharpness ?? 2.5);
  gl.uniform1f(locs.uShimmer, opts.shimmer ?? 1.5);
  gl.uniform1f(locs.uGlow, opts.glow ?? 2.5);
  gl.uniform1f(locs.uOpacity, opts.opacity ?? 0.9);
  gl.uniform1f(locs.uMouseStrength, opts.mouseStrength ?? 1.0);
  gl.uniform1f(locs.uMouseRadius, opts.mouseRadius ?? 0.35);

  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.enable(gl.BLEND);

  let running = true;

  function loop(t) {
    if (!running) return;
    requestAnimationFrame(loop);
    gl.uniform1f(locs.iTime, t * 0.001);
    gl.uniform2f(locs.iMouse, mouse.x, mouse.y);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  requestAnimationFrame(loop);

  return () => {
    running = false;
    window.removeEventListener('resize', resize);
    if (canvas.parentElement === container) container.removeChild(canvas);
    gl.deleteProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    gl.deleteBuffer(buf);
  };
}

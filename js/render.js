'use strict';
// Renderizador WebGL2: una rejilla de miles de caracteres de colores (instanced) + bloom.

// Caracteres extra (español) tras los ASCII imprimibles
const EXTRA_GLYPHS = 'áéíóúÁÉÍÓÚñÑ¿¡üÜ·';
const GLYPH_SLOT = new Map([...EXTRA_GLYPHS].map((ch, k) => [ch.charCodeAt(0), 95 + k]));

const FONT_FAMILY = 'Consolas, "Cascadia Mono", "DejaVu Sans Mono", "Courier New", monospace';

const VS_GRID = `#version 300 es
layout(location=0) in float aGlyph;
layout(location=1) in vec3 aColor;
uniform int uCols;
uniform vec2 uGrid;
out vec2 vUV;
out vec3 vColor;
void main() {
  vec2 corner = vec2(gl_VertexID & 1, gl_VertexID >> 1);
  int id = gl_InstanceID;
  vec2 cell = vec2(id % uCols, id / uCols);
  vec2 p = (cell + corner) / uGrid;
  gl_Position = vec4(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0, 0.0, 1.0);
  vec2 g = vec2(mod(aGlyph, 16.0), floor(aGlyph / 16.0));
  vUV = (g + corner) / vec2(16.0, 8.0);
  vColor = aColor;
}`;

const VS_FINE = `#version 300 es
layout(location=0) in float aGlyph;
layout(location=1) in vec3 aColor;
uniform int uCols;
uniform vec2 uGrid;
out vec2 vUV;
out vec3 vColor;
void main() {
  if (aGlyph < 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vUV = vec2(0.0); vColor = vec3(0.0); return; }
  vec2 corner = vec2(gl_VertexID & 1, gl_VertexID >> 1);
  int id = gl_InstanceID;
  vec2 cell = vec2(id % uCols, id / uCols);
  vec2 p = (cell + corner) / uGrid;
  gl_Position = vec4(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0, 0.0, 1.0);
  float gi = aGlyph - 1.0;
  vec2 g = vec2(mod(gi, 16.0), floor(gi / 16.0));
  vUV = (g + corner) / vec2(16.0, 8.0);
  vColor = aColor;
}`;

const FS_GRID = `#version 300 es
precision mediump float;
in vec2 vUV;
in vec3 vColor;
uniform sampler2D uAtlas;
out vec4 o;
void main() {
  float a = texture(uAtlas, vUV).a;
  o = vec4(vColor * a, 1.0);
}`;

const VS_QUAD = `#version 300 es
out vec2 vUV;
void main() {
  vec2 p = vec2(gl_VertexID & 1, gl_VertexID >> 1);
  vUV = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FS_BRIGHT = `#version 300 es
precision mediump float;
in vec2 vUV;
uniform sampler2D uTex;
uniform vec2 uTexel;
out vec4 o;
void main() {
  vec3 c = texture(uTex, vUV + uTexel * vec2(-1.0, -1.0)).rgb
         + texture(uTex, vUV + uTexel * vec2( 1.0, -1.0)).rgb
         + texture(uTex, vUV + uTexel * vec2(-1.0,  1.0)).rgb
         + texture(uTex, vUV + uTexel * vec2( 1.0,  1.0)).rgb;
  c *= 0.25;
  float l = max(c.r, max(c.g, c.b));
  o = vec4(c * smoothstep(0.4, 0.9, l) * 1.4, 1.0);
}`;

const FS_BLUR = `#version 300 es
precision mediump float;
in vec2 vUV;
uniform sampler2D uTex;
uniform vec2 uDir;
out vec4 o;
void main() {
  vec3 c = texture(uTex, vUV).rgb * 0.227;
  c += (texture(uTex, vUV + uDir * 1.385).rgb + texture(uTex, vUV - uDir * 1.385).rgb) * 0.316;
  c += (texture(uTex, vUV + uDir * 3.231).rgb + texture(uTex, vUV - uDir * 3.231).rgb) * 0.070;
  o = vec4(c, 1.0);
}`;

const FS_COMP = `#version 300 es
precision mediump float;
in vec2 vUV;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uBloomK;
uniform vec3 uFlash;
out vec4 o;
void main() {
  vec3 c = texture(uScene, vUV).rgb + texture(uBloom, vUV).rgb * uBloomK + uFlash;
  vec2 d = vUV - 0.5;
  c *= 1.0 - dot(d, d) * 0.9;
  o = vec4(c, 1.0);
}`;

class AsciiGL {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
    if (!gl) throw new Error('Tu navegador no soporta WebGL2.');
    this.gl = gl;
    this.pGrid = this.program(VS_GRID, FS_GRID);
    this.pFine = this.program(VS_FINE, FS_GRID);
    this.pBright = this.program(VS_QUAD, FS_BRIGHT);
    this.pBlur = this.program(VS_QUAD, FS_BLUR);
    this.pComp = this.program(VS_QUAD, FS_COMP);

    this.vao = gl.createVertexArray();
    this.buf = gl.createBuffer();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 1, gl.UNSIGNED_BYTE, false, 4, 0);
    gl.vertexAttribDivisor(0, 1);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.UNSIGNED_BYTE, true, 4, 1);
    gl.vertexAttribDivisor(1, 1);
    gl.bindVertexArray(null);
    this.quadVao = gl.createVertexArray();

    // Capa fina: rejilla al doble de resolución para los personajes
    this.fvao = gl.createVertexArray();
    this.fbuf = gl.createBuffer();
    gl.bindVertexArray(this.fvao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.fbuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 1, gl.UNSIGNED_BYTE, false, 4, 0);
    gl.vertexAttribDivisor(0, 1);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.UNSIGNED_BYTE, true, 4, 1);
    gl.vertexAttribDivisor(1, 1);
    gl.bindVertexArray(null);
    this.fatlas = gl.createTexture();
    this.fineUsed = false;

    this.atlas = gl.createTexture();
    this.bloomK = 0.75;
    this.flash = [0, 0, 0];
    this.cols = 0; this.rows = 0;
  }

  program(vs, fs) {
    const gl = this.gl;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    p.u = name => gl.getUniformLocation(p, name);
    return p;
  }

  setFont(px) {
    const gl = this.gl;
    const dpr = Math.min(2, window.devicePixelRatio || 1);      // en móviles de alta densidad, 2 basta y va más fluido
    this.dpr = dpr;
    const c = document.createElement('canvas');
    const x = c.getContext('2d');
    const font = `${Math.round(px * dpr)}px ${FONT_FAMILY}`;
    x.font = font;
    let gw = Math.max(4, Math.round(x.measureText('M').width));
    let gh = Math.max(6, Math.round(px * 1.08 * dpr));
    gw += gw % 2; gh += gh % 2;
    c.width = gw * 16; c.height = gh * 8;
    x.font = font;
    x.textBaseline = 'middle';
    x.textAlign = 'center';
    x.fillStyle = '#fff';
    for (let code = 33; code < 127; code++) {
      const i = code - 32;
      x.fillText(String.fromCharCode(code), (i % 16) * gw + gw / 2, Math.floor(i / 16) * gh + gh / 2 + 1);
    }
    [...EXTRA_GLYPHS].forEach((ch, k) => {
      const i = 95 + k;
      x.fillText(ch, (i % 16) * gw + gw / 2, Math.floor(i / 16) * gh + gh / 2 + 1);
    });
    gl.bindTexture(gl.TEXTURE_2D, this.atlas);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.gw = gw; this.gh = gh;
    this.fontPx = px;
    // Atlas de la capa fina (letra a la mitad de tamaño)
    {
      const fc = document.createElement('canvas'), fx = fc.getContext('2d');
      const fgw = gw / 2, fgh = gh / 2;
      fc.width = fgw * 16; fc.height = fgh * 8;
      fx.font = `bold ${Math.max(3, Math.round(px * dpr / 2))}px ${FONT_FAMILY}`;
      fx.textBaseline = 'middle'; fx.textAlign = 'center'; fx.fillStyle = '#fff';
      for (let code = 33; code < 127; code++) {
        const i = code - 32;
        fx.fillText(String.fromCharCode(code), (i % 16) * fgw + fgw / 2, Math.floor(i / 16) * fgh + fgh / 2 + 0.5);
      }
      gl.bindTexture(gl.TEXTURE_2D, this.fatlas);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fc);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    this.resize();
  }

  resize() {
    const gl = this.gl;
    const wrap = this.canvas.parentElement;
    const W = wrap.clientWidth * this.dpr, H = wrap.clientHeight * this.dpr;
    this.cols = Math.max(20, Math.floor(W / this.gw));
    this.rows = Math.max(10, Math.floor(H / this.gh));
    this.canvas.width = this.cols * this.gw;
    this.canvas.height = this.rows * this.gh;
    this.canvas.style.width = this.canvas.width / this.dpr + 'px';
    this.canvas.style.height = this.canvas.height / this.dpr + 'px';
    this.data = new Uint8Array(this.cols * this.rows * 4);
    this.fcols = this.cols * 2; this.frows = this.rows * 2;
    this.fdata = new Uint8Array(this.fcols * this.frows * 4);
    this.aspect = this.gh / this.gw;

    const mk = (w, h) => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      return { tex, fb, w, h };
    };
    for (const t of [this.scene, this.bA, this.bB]) if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); }
    const cw = this.canvas.width, ch = this.canvas.height;
    this.scene = mk(cw, ch);
    const bw = Math.max(1, Math.floor(cw / 4)), bh = Math.max(1, Math.floor(ch / 4));
    this.bA = mk(bw, bh);
    this.bB = mk(bw, bh);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  clear() { this.data.fill(0); if (this.fineUsed) { this.fdata.fill(0); this.fineUsed = false; } }

  // Capa fina: celda (fc, fr) a doble resolución. El espacio (32) es una celda negra opaca.
  fput(fc, fr, code, R, G, B) {
    if (fc < 0 || fr < 0 || fc >= this.fcols || fr >= this.frows) return -1;
    const i = (fr * this.fcols + fc) * 4;
    const d = this.fdata;
    d[i] = (code < 127 ? code - 32 : 31) + 1;
    d[i + 1] = R > 255 ? 255 : R < 0 ? 0 : R;
    d[i + 2] = G > 255 ? 255 : G < 0 ? 0 : G;
    d[i + 3] = B > 255 ? 255 : B < 0 ? 0 : B;
    this.fineUsed = true;
    return i;
  }

  // Borra la capa fina bajo un rectángulo de celdas normales (para que la interfaz quede encima)
  fclearRect(c, r, w, h) {
    if (!this.fineUsed) return;
    for (let y = Math.max(0, r * 2); y < Math.min(this.frows, (r + h) * 2); y++)
      this.fdata.fill(0, (y * this.fcols + Math.max(0, c * 2)) * 4, (y * this.fcols + Math.min(this.fcols, (c + w) * 2)) * 4);
  }

  put(c, r, code, R, G, B) {
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return;
    const i = (r * this.cols + c) * 4;
    const d = this.data;
    d[i] = code < 127 ? code - 32 : (GLYPH_SLOT.get(code) ?? 31);
    d[i + 1] = R > 255 ? 255 : R < 0 ? 0 : R;
    d[i + 2] = G > 255 ? 255 : G < 0 ? 0 : G;
    d[i + 3] = B > 255 ? 255 : B < 0 ? 0 : B;
  }

  dim(c, r, k) {
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return;
    const i = (r * this.cols + c) * 4;
    this.data[i + 1] *= k; this.data[i + 2] *= k; this.data[i + 3] *= k;
  }

  dimRect(c, r, w, h, k) {
    for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) this.dim(x, y, k);
  }

  text(c, r, str, R, G, B) {
    for (let k = 0; k < str.length; k++) {
      const code = str.charCodeAt(k);
      if (code !== 32) this.put(c + k, r, code, R, G, B);
      else this.put(c + k, r, 32, 0, 0, 0);
    }
  }

  draw() {
    const gl = this.gl;
    // 1) Rejilla de caracteres a textura
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.scene.fb);
    gl.viewport(0, 0, this.scene.w, this.scene.h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.pGrid);
    gl.uniform1i(this.pGrid.u('uCols'), this.cols);
    gl.uniform2f(this.pGrid.u('uGrid'), this.cols, this.rows);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.atlas);
    gl.uniform1i(this.pGrid.u('uAtlas'), 0);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, this.data, gl.DYNAMIC_DRAW);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.cols * this.rows);
    if (this.fineUsed) {
      gl.useProgram(this.pFine);
      gl.uniform1i(this.pFine.u('uCols'), this.fcols);
      gl.uniform2f(this.pFine.u('uGrid'), this.fcols, this.frows);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.fatlas);
      gl.uniform1i(this.pFine.u('uAtlas'), 0);
      gl.bindVertexArray(this.fvao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.fbuf);
      gl.bufferData(gl.ARRAY_BUFFER, this.fdata, gl.DYNAMIC_DRAW);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.fcols * this.frows);
    }

    // 2) Bloom: extraer brillos, desenfocar
    gl.bindVertexArray(this.quadVao);
    const pass = (prog, target, src, setup) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
      gl.viewport(0, 0, target ? target.w : this.canvas.width, target ? target.h : this.canvas.height);
      gl.useProgram(prog);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.uniform1i(prog.u('uTex'), 0);
      setup && setup();
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    pass(this.pBright, this.bA, this.scene, () =>
      gl.uniform2f(this.pBright.u('uTexel'), 1 / this.scene.w, 1 / this.scene.h));
    for (let k = 0; k < 2; k++) {
      pass(this.pBlur, this.bB, this.bA, () => gl.uniform2f(this.pBlur.u('uDir'), 1 / this.bA.w, 0));
      pass(this.pBlur, this.bA, this.bB, () => gl.uniform2f(this.pBlur.u('uDir'), 0, 1 / this.bA.h));
    }

    // 3) Composición final
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.pComp);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.scene.tex);
    gl.uniform1i(this.pComp.u('uScene'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.bA.tex);
    gl.uniform1i(this.pComp.u('uBloom'), 1);
    gl.uniform1f(this.pComp.u('uBloomK'), this.bloomK);
    gl.uniform3f(this.pComp.u('uFlash'), this.flash[0], this.flash[1], this.flash[2]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }
}

// ------------------------------------------------------------------ Capa de interfaz
// Textos y paneles en un lienzo aparte, encima del juego, con letra de tamaño fijo: así
// el panel, los mensajes, los nombres y el mapa se leen igual con cualquier zoom del mundo.
// Misma forma de uso que la rejilla (put/text/dim/dimRect, cols/rows en celdas de interfaz),
// más worldText() para textos anclados a una posición del mundo.
class TextLayer {
  constructor(under, px = 13) {
    this.under = under; this.px = px;
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'ui';
    Object.assign(this.canvas.style, { position: 'fixed', left: '0', top: '0', pointerEvents: 'none' });
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.cols = 0; this.rows = 0; this.key = '';
  }
  resize() {
    const U = this.under, rect = U.canvas.getBoundingClientRect(), dpr = U.dpr || 1;
    this.key = `${U.canvas.width}x${U.canvas.height}@${rect.left},${rect.top}`;
    this.canvas.width = U.canvas.width; this.canvas.height = U.canvas.height;
    Object.assign(this.canvas.style, { left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px' });
    const x = this.ctx;
    this.fpx = Math.round(this.px * dpr);
    this.font = `${this.fpx}px ${FONT_FAMILY}`;
    x.font = this.font;
    this.cw = x.measureText('M').width;
    this.ch = Math.round(this.px * 1.3 * dpr);
    this.cols = Math.max(20, Math.floor(this.canvas.width / this.cw));
    this.rows = Math.max(10, Math.floor(this.canvas.height / this.ch));
  }
  clear() {
    const U = this.under, rect = U.canvas.getBoundingClientRect();
    if (this.key !== `${U.canvas.width}x${U.canvas.height}@${rect.left},${rect.top}`) this.resize();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.font = this.font; this.ctx.textBaseline = 'middle';
  }
  rgb(R, G, B) { const f = v => (v > 255 ? 255 : v < 0 ? 0 : v | 0); return `rgb(${f(R)},${f(G)},${f(B)})`; }
  dimRect(c, r, w, h, k) { this.ctx.fillStyle = `rgba(0,0,0,${Math.min(0.92, 1 - k)})`; this.ctx.fillRect(c * this.cw, r * this.ch, w * this.cw, h * this.ch); }
  dim(c, r, k) { this.dimRect(c, r, 1, 1, k); }
  fclearRect() {}
  put(c, r, code, R, G, B) {
    const x = this.ctx;
    if (code === 32) { x.fillStyle = 'rgba(0,0,0,0.85)'; x.fillRect(c * this.cw, r * this.ch, this.cw + 0.5, this.ch + 0.5); return; }
    x.fillStyle = this.rgb(R, G, B);
    x.fillText(String.fromCharCode(code), c * this.cw, (r + 0.5) * this.ch);
  }
  text(c, r, str, R, G, B) {
    const x = this.ctx;
    x.fillStyle = 'rgba(0,0,0,0.6)';
    x.fillRect(c * this.cw, r * this.ch, str.length * this.cw, this.ch);
    x.fillStyle = this.rgb(R, G, B);
    x.fillText(str, c * this.cw, (r + 0.5) * this.ch);
  }
  // Texto centrado sobre una celda del mundo (wc, wr), con fondo opcional y desplazado en líneas
  worldText(wc, wr, str, R, G, B, back = 0.5, lineOff = 0) {
    const U = this.under, x = this.ctx;
    const w = x.measureText(str).width;
    const cx = (wc + 0.5) * U.gw, cy = (wr + 0.5) * U.gh + lineOff * this.ch;
    if (cy < -this.ch || cy > this.canvas.height + this.ch) return;
    if (back > 0) { x.fillStyle = `rgba(0,0,0,${back})`; x.fillRect(cx - w / 2 - this.cw * 0.4, cy - this.ch / 2, w + this.cw * 0.8, this.ch); }
    else { x.lineWidth = Math.max(2, this.fpx * 0.22); x.strokeStyle = 'rgba(0,0,0,0.85)'; x.strokeText(str, cx - w / 2, cy); }
    x.fillStyle = this.rgb(R, G, B);
    x.fillText(str, cx - w / 2, cy);
  }
}

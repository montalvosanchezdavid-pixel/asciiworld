'use strict';
// Personajes "esculpidos": se construyen con primitivas con volumen (elipses, cápsulas,
// triángulos, líneas) que se rasterizan a la rejilla y se sombrean con luz y brillo
// especular, como una imagen 3D convertida a ASCII. Todo mira a la derecha; x crece hacia
// la derecha e y hacia abajo, en "unidades visuales" (1 = ancho de un carácter). Pies en (0,0).

const RMAT = {
  metal:    { ramp: ':=#@',  spec: 1.0,  amb: 0.25 },
  cloth:    { ramp: ':;x#',  spec: 0.05, amb: 0.3 },
  skin:     { ramp: ':=oO',  spec: 0.25, amb: 0.35 },
  fur:      { ramp: '\'";w', spec: 0.05, amb: 0.3 },
  leather:  { ramp: ':;=#',  spec: 0.3,  amb: 0.3 },
  bone:     { ramp: ':=+#',  spec: 0.35, amb: 0.35 },
  ribs:     { ramp: '-=-=',  spec: 0.3,  amb: 0.35 },
  scale:    { ramp: ':vVW',  spec: 0.7,  amb: 0.28 },
  belly:    { ramp: '-==#',  spec: 0.3,  amb: 0.4 },
  membrane: { ramp: '.:;=',  spec: 0.1,  amb: 0.35 },
  wood:     { ramp: ':|#',   spec: 0.1,  amb: 0.3 },
  hair:     { ramp: '\'"~#', spec: 0.15, amb: 0.3 },
  coat:     { ramp: ':;=#',  spec: 0.3,  amb: 0.32 },
  stone:    { ramp: '.:%#@', spec: 0.15, amb: 0.32 },
};
const norm3 = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const LDIR = norm3([-0.5, -0.75, 0.65]);
const HDIR = norm3([LDIR[0], LDIR[1], LDIR[2] + 1]);

// Primitivas
const E = (x, y, rx, ry, c, m, z) => ({ t: 0, x, y, rx, ry, c, m, z });
const Cp = (x1, y1, x2, y2, r, c, m, z) => ({ t: 1, x1, y1, x2, y2, r, c, m, z });
const Ln = (x1, y1, x2, y2, c, m, z, ch) => ({ t: 2, x1, y1, x2, y2, c, m, z, ch });
const Tr = (ax, ay, bx, by, cx, cy, c, m, z, n) => ({ t: 3, ax, ay, bx, by, cx, cy, c, m, z, n: norm3(n || [0, 0, 1]) });
const Pt = (x, y, ch, c, z, emit = true) => ({ t: 4, x, y, ch, c, z, emit });

const shadeC = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const ease = t => 1 - (1 - t) * (1 - t);
const lerp = (a, b, t) => a + (b - a) * t;
function lineChar(dx, dy) {
  const a = Math.atan2(dy, dx);
  const t = ((a % Math.PI) + Math.PI) % Math.PI;
  return t < Math.PI / 8 || t > 7 * Math.PI / 8 ? '-' : t < 3 * Math.PI / 8 ? '\\' : t < 5 * Math.PI / 8 ? '|' : '/';
}

// ------------------------------------------------------------------ Rasterizado + sombreado

function rasterRig(parts, A, fx, fy, flip) {
  if (flip) for (const p of parts) {
    if (p.t === 0 || p.t === 4) p.x = -p.x;
    else if (p.t === 3) { p.ax = -p.ax; p.bx = -p.bx; p.cx = -p.cx; p.n = [-p.n[0], p.n[1], p.n[2]]; }
    else { p.x1 = -p.x1; p.x2 = -p.x2; }
  }
  const oy = fy * A;
  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
  const ext = (x, y, rx = 0, ry = rx) => {
    if (x - rx < minx) minx = x - rx; if (x + rx > maxx) maxx = x + rx;
    if (y - ry < miny) miny = y - ry; if (y + ry > maxy) maxy = y + ry;
  };
  for (const p of parts) {
    if (p.t === 0) ext(p.x, p.y, p.rx, p.ry);
    else if (p.t === 1) { ext(p.x1, p.y1, p.r); ext(p.x2, p.y2, p.r); }
    else if (p.t === 2) { ext(p.x1, p.y1); ext(p.x2, p.y2); }
    else if (p.t === 3) { ext(p.ax, p.ay); ext(p.bx, p.by); ext(p.cx, p.cy); }
    else ext(p.x, p.y);
  }
  const c0 = Math.round(minx + fx) - 1, c1 = Math.round(maxx + fx) + 1;
  const r0 = Math.ceil((miny + oy) / A) - 1, r1 = Math.ceil((maxy + oy) / A) + 1;
  const W = c1 - c0 + 1, H = r1 - r0 + 1, N = W * H;
  const zb = new Float32Array(N).fill(-1e9);
  const pid = new Int16Array(N).fill(-1);
  const nx = new Float32Array(N), ny = new Float32Array(N), nz = new Float32Array(N);
  const lch = new Array(N);

  const setCell = (c, r, k, z, a, b, d, ch) => {
    const x = c - c0, y = r - r0;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    if (z < zb[i]) return;
    zb[i] = z; pid[i] = k; nx[i] = a; ny[i] = b; nz[i] = d; lch[i] = ch;
  };

  parts.forEach((p, k) => {
    if (p.t === 4) { setCell(Math.round(p.x + fx), Math.ceil((p.y + oy) / A), k, p.z, 0, 0, 1, p.ch); return; }
    if (p.t === 2) {
      const dx = p.x2 - p.x1, dy = p.y2 - p.y1;
      const steps = Math.ceil(Math.hypot(dx, dy) * 2.5) + 1;
      const ch = p.ch || lineChar(dx, dy);
      for (let s = 0; s <= steps; s++) {
        const x = p.x1 + dx * s / steps, y = p.y1 + dy * s / steps;
        setCell(Math.round(x + fx), Math.ceil((y + oy) / A), k, p.z, 0, 0, 1, ch);
      }
      return;
    }
    let bx0, bx1, by0, by1;
    if (p.t === 0) { bx0 = p.x - p.rx; bx1 = p.x + p.rx; by0 = p.y - p.ry; by1 = p.y + p.ry; }
    else if (p.t === 1) { bx0 = Math.min(p.x1, p.x2) - p.r; bx1 = Math.max(p.x1, p.x2) + p.r; by0 = Math.min(p.y1, p.y2) - p.r; by1 = Math.max(p.y1, p.y2) + p.r; }
    else { bx0 = Math.min(p.ax, p.bx, p.cx); bx1 = Math.max(p.ax, p.bx, p.cx); by0 = Math.min(p.ay, p.by, p.cy); by1 = Math.max(p.ay, p.by, p.cy); }
    const cc0 = Math.round(bx0 + fx) - 1, cc1 = Math.round(bx1 + fx) + 1;
    const rr0 = Math.ceil((by0 + oy) / A) - 1, rr1 = Math.ceil((by1 + oy) / A) + 1;
    for (let r = rr0; r <= rr1; r++) {
      const sy = (r - 0.5) * A - oy;
      for (let c = cc0; c <= cc1; c++) {
        const sx = c - fx;
        if (p.t === 0) {
          const dx = (sx - p.x) / p.rx, dy = (sy - p.y) / p.ry;
          const d2 = dx * dx + dy * dy;
          if (d2 >= 1) continue;
          const z = Math.sqrt(1 - d2);
          setCell(c, r, k, p.z + z * 0.05, dx, dy, z);
        } else if (p.t === 1) {
          const ex = p.x2 - p.x1, ey = p.y2 - p.y1;
          const l2 = ex * ex + ey * ey || 1;
          const t = Math.max(0, Math.min(1, ((sx - p.x1) * ex + (sy - p.y1) * ey) / l2));
          const ox = sx - (p.x1 + ex * t), oy2 = sy - (p.y1 + ey * t);
          const d = Math.hypot(ox, oy2);
          if (d >= p.r) continue;
          const z = Math.sqrt(1 - (d / p.r) ** 2);
          setCell(c, r, k, p.z + z * 0.05, ox / p.r, oy2 / p.r, z);
        } else {
          const s1 = (p.bx - p.ax) * (sy - p.ay) - (p.by - p.ay) * (sx - p.ax);
          const s2 = (p.cx - p.bx) * (sy - p.by) - (p.cy - p.by) * (sx - p.bx);
          const s3 = (p.ax - p.cx) * (sy - p.cy) - (p.ay - p.cy) * (sx - p.cx);
          if ((s1 < 0 || s2 < 0 || s3 < 0) && (s1 > 0 || s2 > 0 || s3 > 0)) continue;
          setCell(c, r, k, p.z, p.n[0], p.n[1], p.n[2]);
        }
      }
    }
  });

  const cells = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const k = pid[i];
    if (k < 0) continue;
    const p = parts[k];
    if (p.t === 4) { cells.push({ x: x + c0, y: y + r0, code: p.ch.charCodeAt(0), c: p.c, emit: p.emit }); continue; }
    const m = RMAT[p.m] || RMAT.cloth;
    const n = norm3([nx[i], ny[i], nz[i]]);
    const dif = Math.max(0, n[0] * LDIR[0] + n[1] * LDIR[1] + n[2] * LDIR[2]);
    const spec = m.spec * Math.pow(Math.max(0, n[0] * HDIR[0] + n[1] * HDIR[1] + n[2] * HDIR[2]), 14);
    const amb = m.amb + 0.15;
    const lit = amb + (1 - amb) * dif;
    const rim = Math.pow(1 - Math.max(0, n[2]), 3) * 0.5 * (n[0] > 0.2 || n[1] > 0.3 ? 1 : 0.3);
    const col = [p.c[0] * lit + 255 * spec * 0.55 + 90 * rim, p.c[1] * lit + 255 * spec * 0.55 + 110 * rim, p.c[2] * lit + 255 * spec * 0.6 + 150 * rim];
    let ch;
    if (p.t === 2) ch = lch[i];
    else {
      const edge = p.t !== 3 && n[2] < 0.55 && (
        x === 0 || x === W - 1 || y === 0 || y === H - 1 ||
        pid[i - 1] < 0 || pid[i + 1] < 0 || pid[i - W] < 0 || pid[i + W] < 0);
      const ax = Math.abs(n[0]), ay = Math.abs(n[1]);
      if (edge && ax < ay * 2.5 && ay < ax * 2.5) {
        ch = n[0] * n[1] < 0 ? '\\' : '/';
      } else {
        const b = Math.max(0, Math.min(0.999, lit * 0.95 + spec * 0.5));
        ch = m.ramp[Math.floor(b * m.ramp.length)];
      }
      if (edge) { col[0] *= 0.7; col[1] *= 0.7; col[2] *= 0.7; }
    }
    cells.push({ x: x + c0, y: y + r0, code: ch.charCodeAt(0), c: col, emit: false });
  }
  return { cells, c0, r0, c1, r1 };
}

// ------------------------------------------------------------------ Humanoides

const GOLD = [240, 190, 60], STEEL = [115, 120, 140], METAL = [180, 186, 205], LEATHER = [110, 72, 40], WOOD = [130, 90, 50];

function rigHuman(s, o) {
  if (s.view === 'front' || s.view === 'back') return rigHumanFB(s, o, s.view === 'back');
  const P = [];
  const k = o.size || 1;
  const w = s.moving ? Math.sin(s.phase) : 0;
  const bob = s.moving ? -Math.abs(Math.cos(s.phase)) * 0.5 * k : 0;
  const atk = s.atk >= 0 ? ease(s.atk) : -1;
  const lunge = s.atk >= 0 ? Math.sin(s.atk * Math.PI) * 1.4 * k : 0;
  const U = x => x * k + lunge;
  const L = x => x * k;
  const Y = y => y * k + bob;
  const hip = Y(-7.8);
  const armC = o.arms || o.body, armM = o.armsM || o.bodyM || 'cloth';

  // Piernas / túnica
  if (o.robe) {
    P.push(E(U(0.2), Y(-5.2), 3.0 * k, 5.4 * k, o.robe, 'cloth', 2));
    P.push(E(L(1.4 + w), -0.5 * k, 1.3 * k, 0.7 * k, LEATHER, 'leather', 2.5));
  } else if (o.bone) {
    P.push(Ln(L(-0.9), hip, L(-0.9 - w * 2), -0.3, shadeC(o.legs, 0.75), 'bone', 1));
    P.push(Ln(L(0.9), hip, L(0.9 + w * 2), -0.3, o.legs, 'bone', 3));
  } else {
    const boot = o.boots || LEATHER;
    const lb = L(-1.35 - w * 2.1 - (s.moving ? 0 : 0.3)), lf = L(1.35 + w * 2.1 + (s.moving ? 0 : 0.3));
    P.push(Cp(L(-1.15), hip, lb, -1.3 * k, 0.85 * k, shadeC(o.legs, 0.7), o.legsM || 'cloth', 1));
    P.push(E(lb + 0.5 * k, -0.6 * k, 1.2 * k, 0.7 * k, shadeC(boot, 0.7), 'leather', 1.2));
    P.push(Cp(L(1.15), hip, lf, -1.3 * k, 0.9 * k, o.legs, o.legsM || 'cloth', 3));
    P.push(E(lf + 0.5 * k, -0.6 * k, 1.2 * k, 0.7 * k, boot, 'leather', 3.2));
  }
  if (o.cape) P.push(E(U(-1.5), Y(-10.6), 2.9 * k, 6.8 * k, o.cape, 'cloth', 0.5));
  if (o.mantle) {   // capa larga que ondea al andar y con el viento
    const fl = (s.moving ? 1.6 + Math.sin(s.phase * 2) * 0.5 : 0.5 + Math.sin(s.t * 1.7) * 0.25) * k;
    const sl = Y(-14.6), bot = -2.6 * k;
    P.push(Tr(U(-1.9), sl, U(1.2), sl, U(-3.4) - fl, bot, o.mantle, 'cloth', 0.4, [-0.4, -0.2, 1]));
    P.push(Tr(U(1.2), sl, U(-3.4) - fl, bot, U(0.2) - fl * 0.6, bot + 0.6 * k, shadeC(o.mantle, 0.75), 'cloth', 0.45, [0.3, 0.1, 1]));
    P.push(Ln(U(-3.4) - fl, bot, U(0.2) - fl * 0.6, bot + 0.6 * k, shadeC(o.mantle, 0.55), 'cloth', 0.5, '_'));
  }
  if (o.shieldBack) {
    P.push(E(U(-3.0), Y(-12), 2.0 * k, 3.3 * k, o.shieldBack, 'metal', 0.6));
    P.push(Pt(U(-3.5), Y(-12), 'o', GOLD, 0.7, false));
  }

  // Brazo trasero
  if (o.torch) {   // brazo trasero en alto sujetando una antorcha
    const fl = Math.sin(s.t * 23) > 0;
    P.push(Cp(U(-1.7), Y(-13.8), U(-3.2), Y(-16.8), 0.7 * k, shadeC(armC, 0.7), armM, 0.8));
    P.push(Ln(U(-3.2), Y(-16), U(-3.5), Y(-20.6), WOOD, 'wood', 9.4));
    P.push(Pt(U(-3.6), Y(-21.6), fl ? '*' : '#', [255, 210, 90], 9.6, true));
    P.push(Pt(U(-3.7), Y(-23), fl ? '^' : "'", [255, 120, 30], 9.6, true));
  } else if (o.bone) P.push(Ln(U(-1.6), Y(-13.8), U(-2.2 + w * 1.2), Y(-8.6), shadeC(armC, 0.75), 'bone', 0.8));
  else P.push(Cp(U(-1.7), Y(-13.8), U(-2.3 + w * 1.2), Y(-8.8), 0.7 * k, shadeC(armC, 0.7), armM, 0.8));

  // Torso
  if (o.bone) {
    P.push(E(U(0), Y(-11.6), 2.2 * k, 3.1 * k, o.body, 'ribs', 4));
    P.push(E(U(0), Y(-8.2), 1.6 * k, 0.9 * k, o.body, 'bone', 4));
  } else {
    P.push(E(U(0), Y(-11.2), (o.bodyRx || 2.7) * 0.85 * k, 3.7 * k, o.body, o.bodyM || 'cloth', 4));
    if (o.pauldrons) {
      P.push(E(U(-1.7), Y(-14.2), 1.35 * k, 1.1 * k, shadeC(o.pauldrons, 0.75), 'metal', 3.9));
      P.push(E(U(1.6), Y(-14.2), 1.4 * k, 1.15 * k, o.pauldrons, 'metal', 7.4));
    }
    if (o.tabard) P.push(E(U(0.5), Y(-10.4), 1.9 * k, 3.8 * k, o.tabard, 'cloth', 5));
    if (o.emblem) { P.push(Pt(U(0.8), Y(-11.6), '+', GOLD, 5.6, false)); P.push(Pt(U(0.8), Y(-10.6), 'V', GOLD, 5.6, false)); }
    if (o.apron) P.push(E(U(0.8), Y(-9.4), 1.9 * k, 4.4 * k, o.apron, 'leather', 5));
    if (o.belt) P.push(Cp(U(-2.2), Y(-8.4), U(2.3), Y(-8.4), 0.45 * k, o.belt, 'leather', 5.5));
  }

  // Cabeza
  const hs = (o.headScale || 1) * 0.82;
  const hx = U(0.3), hy = Y(-16.9 - (hs - 0.82) * 1.8);
  if (o.ears) {
    P.push(Cp(hx - 1.2 * k, hy - 0.8 * k, hx - 4.2 * k, hy - 2.8 * k, 0.6 * k, shadeC(o.skin, 0.8), 'skin', 5.9));
    P.push(Cp(hx + 0.6 * k, hy - 1.2 * k, hx + 3.2 * k, hy - 3.6 * k, 0.55 * k, o.skin, 'skin', 6.6));
  }
  P.push(E(hx, hy, 2.1 * k * hs, 2.3 * k * hs, o.skin, o.bone ? 'bone' : 'skin', 6));
  const hk = k * hs;
  switch (o.head) {
    case 'greathelm':
      P.push(E(hx, hy - 0.3 * hk, 2.4 * hk, 2.8 * hk, o.helm || METAL, 'metal', 6.5));
      P.push(Cp(hx - 2.0 * hk, hy + 1.6 * hk, hx + 2.2 * hk, hy + 1.6 * hk, 0.5 * hk, shadeC(METAL, 0.7), 'metal', 6.6));   // gola
      P.push(Ln(hx + 0.2 * hk, hy - 0.4 * hk, hx + 2.6 * hk, hy - 0.4 * hk, [15, 15, 25], 'cloth', 7, '='));          // ranura
      P.push(Ln(hx + 1.5 * hk, hy - 0.2 * hk, hx + 1.5 * hk, hy + 1.2 * hk, [15, 15, 25], 'cloth', 7, '|'));          // nasal
      P.push(Pt(hx - 0.6 * hk, hy - 2.4 * hk, '^', [235, 235, 245], 7, false));                                         // cresta
      break;
    case 'helmet':
      P.push(E(hx, hy - 0.4 * hk, 2.3 * hk, 2.5 * hk, o.helm || METAL, 'metal', 6.5));
      P.push(Cp(hx + 0.9 * hk, hy, hx + 2.6 * hk, hy, 0.35 * hk, [20, 20, 30], 'cloth', 7));
      break;
    case 'hood':
      P.push(E(hx - 0.4 * hk, hy - 0.3 * hk, 2.8 * hk, 3 * hk, o.hood, 'cloth', 6.2));
      P.push(E(hx + 1.1 * hk, hy + 0.3 * hk, 1.3 * hk, 1.7 * hk, shadeC(o.skin, 0.55), 'skin', 6.4));
      break;
    case 'hair':
      P.push(E(hx - 0.6 * hk, hy - 1.3 * hk, 2.4 * hk, 1.6 * hk, o.hair, 'hair', 6.5));
      break;
    case 'crown':
      P.push(E(hx - 0.6 * hk, hy - 1.2 * hk, 2.4 * hk, 1.6 * hk, o.hair, 'hair', 6.5));
      P.push(E(hx, hy - 2.4 * hk, 2 * hk, 0.7 * hk, GOLD, 'metal', 7));
      for (const dx of [-1.3, 0, 1.3]) P.push(Pt(hx + dx * hk, hy - 3.9 * hk, '^', GOLD, 7.1, false));
      break;
    case 'hat':
      P.push(E(hx, hy - 1.9 * hk, 3.7 * hk, 0.8 * hk, o.hat, 'hair', 7));
      P.push(E(hx, hy - 2.8 * hk, 1.9 * hk, 1.2 * hk, o.hat, 'hair', 7.1));
      break;
  }
  if (o.plume) {
    P.push(Cp(hx - 0.3 * hk, hy - 2.8 * hk, hx - 2.9 * hk, hy - 2.2 * hk, 0.9 * hk, o.plume, 'cloth', 5.8));
    P.push(Cp(hx - 2.9 * hk, hy - 2.2 * hk, hx - 4.1 * hk, hy - 0.2 * hk, 0.7 * hk, o.plume, 'cloth', 5.8));
  }
  if (o.beard) P.push(E(hx + 0.8 * hk, hy + 1.8 * hk, 1.5 * hk, 1.7 * hk, o.beard, 'hair', 6.8));
  if (o.tusk) P.push(Pt(hx + 1.7 * hk, hy + 1.3 * hk, "'", [245, 240, 225], 8, false));
  if (o.eyes) P.push(Pt(hx + 1.3 * hk, hy - 0.2 * hk, o.eyeCh || '*', o.eyes, 8, true));
  else if (o.head !== 'helmet' && o.head !== 'hood') P.push(Pt(hx + 1.4 * hk, hy - 0.2 * hk, '.', [25, 20, 20], 6.9, false));

  // Brazo delantero + arma
  const Sx = U(1.5), Sy = Y(-13.9);
  let armA = 1.15, bladeA = -1.35;
  if (atk >= 0) { armA = lerp(-1.7, 0.7, atk); bladeA = lerp(-2.5, 0.9, atk); }
  if (o.weapon === 'spear') { armA = atk >= 0 ? lerp(0.9, 0.1, atk) : 0.9; }
  const hxp = Sx + Math.cos(armA) * 4.4 * k, hyp = Sy + Math.sin(armA) * 4.4 * k;
  if (o.bone) P.push(Ln(Sx, Sy, hxp, hyp, armC, 'bone', 7.5));
  else P.push(Cp(Sx, Sy, hxp, hyp, 0.7 * k, armC, armM, 7.5));
  const dir = (a, l) => [Math.cos(a) * l, Math.sin(a) * l];
  switch (o.weapon) {
    case 'sword': case 'dagger': {
      const len = (o.weapon === 'dagger' ? 4.2 : 7.5) * k;
      const [gx, gy] = dir(bladeA + Math.PI / 2, 1.0 * k);
      P.push(Ln(hxp - gx, hyp - gy, hxp + gx, hyp + gy, GOLD, 'metal', 9));
      const [bx, by] = dir(bladeA, len);
      P.push(Ln(hxp, hyp, hxp + bx, hyp + by, o.blade || [230, 238, 255], 'metal', 9.1));
      break;
    }
    case 'axe': {
      const a = atk >= 0 ? bladeA : -1.0;
      const [bx, by] = dir(a, 6.5 * k);
      P.push(Ln(hxp - bx * 0.15, hyp - by * 0.15, hxp + bx, hyp + by, WOOD, 'wood', 9));
      P.push(E(hxp + bx * 0.92 + Math.cos(a + Math.PI / 2) * 0.9 * k, hyp + by * 0.92 + Math.sin(a + Math.PI / 2) * 0.9 * k, 1.5 * k, 1.8 * k, [170, 170, 180], 'metal', 9.2));
      break;
    }
    case 'spear': {
      const a = atk >= 0 ? lerp(-1.57, -0.15, atk) : -1.57;
      const [bx, by] = dir(a, 13 * k);
      P.push(Ln(hxp - bx * 0.25, hyp - by * 0.25, hxp + bx, hyp + by, WOOD, 'wood', 9));
      P.push(Pt(hxp + bx * 1.06, hyp + by * 1.06, atk >= 0 ? '>' : '^', [220, 225, 240], 9.2, false));
      break;
    }
    case 'hammer': {
      const a = atk >= 0 ? bladeA : -1.1;
      const [bx, by] = dir(a, 5 * k);
      P.push(Ln(hxp, hyp, hxp + bx, hyp + by, WOOD, 'wood', 9));
      P.push(E(hxp + bx, hyp + by, 1.3 * k, 1.0 * k, STEEL, 'metal', 9.2));
      break;
    }
    case 'staff':
      P.push(Ln(hxp, hyp + 3 * k, hxp, hyp - 9.5 * k, WOOD, 'wood', 9));
      P.push(Pt(hxp, hyp - 10.3 * k, '*', o.staffGlow || GOLD, 9.2, true));
      break;
    case 'hoe': {
      P.push(Ln(hxp, hyp + 2.5 * k, hxp + 0.6 * k, hyp - 8 * k, WOOD, 'wood', 9));
      P.push(Ln(hxp + 0.6 * k, hyp - 8 * k, hxp + 2.6 * k, hyp - 7.2 * k, [170, 170, 180], 'metal', 9.1));
      break;
    }
    case 'mug':
      P.push(E(hxp + 0.4 * k, hyp - 0.4 * k, 0.9 * k, 1.1 * k, [150, 100, 50], 'wood', 9));
      P.push(Pt(hxp + 0.4 * k, hyp - 1.8 * k, '~', [240, 235, 220], 9.1, false));
      break;
    case 'shield':
      P.push(E(hxp + 0.6 * k, hyp - 1 * k, 1.7 * k, 2.9 * k, o.shieldC || [160, 160, 180], 'metal', 9));
      P.push(Pt(hxp + 0.9 * k, hyp - 1 * k, 'o', GOLD, 9.1, false));
      break;
  }
  return P;
}

// ------------------------------------------------------------------ Cuadrúpedos

function rigQuad(s, o) {
  const P = [];
  const k = o.size || 1;
  const w = s.moving ? Math.sin(s.phase * 1.3) : 0;
  const lunge = s.atk >= 0 ? Math.sin(s.atk * Math.PI) * 2 * k : 0;
  const X = x => x * k + lunge, Y = y => y * k;
  const fur = o.fur, dark = o.legC || shadeC(fur, 0.65), headC = o.headC || fur;
  const ry = o.bodyRy || 3.2, rx = o.bodyRx || 4.6;
  const bodyY = -(4.2 + ry * 0.75) - (o.tall || 0);
  const legTop = bodyY + ry * 0.45, lw = o.legW || 1;
  // patas lejanas (oscuras), cola, cuerpo, pecho y patas cercanas
  P.push(Cp(X(-rx * 0.55), Y(legTop), X(-rx * 0.55 + w * 1.6), -0.4, 0.85 * k * lw, dark, 'fur', 1));
  P.push(Cp(X(rx * 0.6), Y(legTop), X(rx * 0.6 - w * 1.6), -0.4, 0.8 * k * lw, dark, 'fur', 1));
  if (o.tail) P.push(Cp(X(-rx + 0.3), Y(bodyY - 0.6), X(-rx - 3.6), Y(bodyY - 3.2 + Math.sin(s.t * 6) * 0.7), 0.95 * k, fur, 'fur', 2));
  P.push(E(X(0), Y(bodyY), rx * k, ry * k, fur, 'fur', 3));
  P.push(E(X(rx * 0.6), Y(bodyY - 0.3), rx * 0.55 * k, ry * 1.05 * k, o.chest || fur, 'fur', 3.2));
  P.push(Cp(X(-rx * 0.7), Y(legTop), X(-rx * 0.7 - w * 1.6), -0.4, 0.9 * k * lw, o.legC || fur, 'fur', 4));
  P.push(Cp(X(rx * 0.72), Y(legTop), X(rx * 0.72 + w * 1.6), -0.4, 0.85 * k * lw, o.legC || fur, 'fur', 4));
  for (const fx2 of [-rx * 0.7 - w * 1.6, rx * 0.72 + w * 1.6]) P.push(E(X(fx2 + 0.4), -0.5, 1.1 * k * lw, 0.6 * k, dark, 'fur', 4.1));
  // cabeza
  let hx = X(rx + 1.6), hy = Y(bodyY - ry * 0.75);
  if (o.neck) {                      // cuello largo (caballo) con crin
    const nx0 = X(rx * 0.7), ny0 = Y(bodyY - ry * 0.4);
    hx = X(rx + 2.2); hy = Y(bodyY - ry * 0.75 - o.neck);
    P.push(Cp(nx0, ny0, hx - 0.6 * k, hy + 0.8 * k, 1.5 * k, fur, 'fur', 4.6));
    P.push(Cp(nx0 - 0.6 * k, ny0 - 1.0 * k, hx - 1.4 * k, hy - 0.6 * k, 0.6 * k, o.mane || dark, 'fur', 4.8));
  }
  P.push(E(hx, hy, 2.4 * k, 2.3 * k, headC, 'fur', 5));
  const jaw = s.atk >= 0 ? Math.sin(s.atk * Math.PI) * 1.2 * k : 0;
  P.push(Cp(hx + 1, hy + 0.5 * k, hx + (o.snout || 3.3) * k, hy + 1.1 * k, 0.9 * k, headC, 'fur', 5.5));
  if (jaw > 0.2) P.push(Ln(hx + 1, hy + 1.6 * k, hx + 3 * k, hy + 1.6 * k + jaw, [230, 225, 210], 'bone', 5.6));
  P.push(Pt(hx + ((o.snout || 3.3) + 0.4) * k, hy + 1.0 * k, '.', [20, 20, 20], 5.7, false));
  if (o.roundEars) {
    P.push(E(hx - 0.9 * k, hy - 1.9 * k, 0.8 * k, 0.8 * k, dark, 'fur', 4.9));
  } else {
    P.push(Cp(hx - 0.5 * k, hy - 1.4 * k, hx - 1.0 * k, hy - 3.4 * k, 0.5 * k, dark, 'fur', 4.9));
    P.push(Cp(hx + 0.4 * k, hy - 1.4 * k, hx + 0.5 * k, hy - 3.2 * k, 0.5 * k, fur, 'fur', 5.8));
  }
  P.push(Pt(hx + 1.0 * k, hy - 0.4 * k, o.eyeCh || '*', o.eyes, 8, true));
  return P;
}

// ------------------------------------------------------------------ Caballo
// Anatomía propia: barriga, pecho y grupa; cuello arqueado; cabeza larga con morro, ollares,
// ojo y orejas; crin y cola con mechones; patas con rodilla y casco; galope con bote.
const HORSE_K = 1.25, HORSE_SADDLE = -12.4;
function rigHorse(s, o) {
  if (s.view === 'front' || s.view === 'back') return rigHorseFB(s, o, s.view === 'back');
  const P = [], k = o.size || HORSE_K;
  const coat = o.coat, dark = shadeC(coat, 0.62), belly = shadeC(coat, 0.8), mane = o.mane;
  const hoofC = [60, 50, 45], sock = o.socks ? [225, 220, 210] : null;
  const ph = s.phase * 0.9, run = s.moving ? 1 : 0;
  const bob = run ? -Math.abs(Math.sin(ph)) * 0.7 : Math.sin(s.t * 1.3) * 0.08;          // bote al galopar / respirar
  const X = x => x * k, Y = y => (y + bob) * k, Yg = y => y * k;                       // Yg: sin bote (patas al suelo)
  const head = run ? Math.sin(ph * 2) * 0.5 : Math.sin(s.t * 0.7) * 0.3;               // cabeceo
  const wind = Math.sin(s.t * 3) * 0.3 + (run ? 0.6 : 0);

  // patas: hombro/cadera -> rodilla/corvejón -> casco
  const leg = (x, far, off, hind) => {
    const sw = run ? Math.sin(ph + off) * 0.55 : (hind ? 0.06 : -0.04);
    const bend = run ? Math.max(0, Math.sin(ph + off + 1.4)) * (hind ? 0.9 : 1.1) : 0;
    const L1 = 3.6, L2 = 3.9;
    const top = [x, -8.0 + bob];
    const kx = top[0] + Math.sin(sw) * L1, ky = top[1] + Math.cos(sw) * L1;
    const a2 = sw + (hind ? bend * 0.7 : -bend);
    let hx = kx + Math.sin(a2) * L2, hy = ky + Math.cos(a2) * L2;
    if (hy > 0) hy = 0;
    const c = far ? shadeC(coat, 0.6) : coat, z = far ? 1 : 4.2, w = far ? 0.72 : 0.8;
    P.push(Cp(X(top[0]), Yg(top[1]), X(kx), Yg(ky), (hind ? 1.15 : 0.95) * k * w / 0.8, c, 'coat', z));          // antebrazo / muslo
    P.push(Cp(X(kx), Yg(ky), X(hx), Yg(hy - 0.35), 0.5 * k, sock && !far ? sock : shadeC(c, 0.85), 'coat', z + 0.1)); // caña
    P.push(E(X(hx + 0.3), Yg(hy - 0.3), 0.75 * k, 0.42 * k, hoofC, 'leather', z + 0.2));                      // casco
  };
  leg(-4.2, true, 0.0, true); leg(4.0, true, 1.7, false);

  // cola: nace en la grupa y cae en mechones que ondean
  const tl = run ? 1.2 : 0;
  P.push(Cp(X(-6.6), Y(-11.2), X(-8.0 - tl), Y(-9.4 + tl * 0.4), 0.8 * k, mane, 'hair', 2));
  for (let i = 0; i < 4; i++) {
    const sx = -8.0 - tl + i * 0.15, sy = -9.4 + tl * 0.4;
    P.push(Cp(X(sx), Y(sy), X(sx - 0.6 - tl * 1.6 + Math.sin(s.t * 2.2 + i) * 0.4 - i * 0.2), Y(-4.6 + i * 0.4 - tl * 1.5), 0.42 * k, shadeC(mane, 0.85 + i * 0.07), 'hair', 2.1));
  }

  // cuerpo: grupa, barriga, pecho
  P.push(E(X(-4.3), Y(-10.4), 2.9 * k, 2.8 * k, coat, 'coat', 3.1));
  P.push(E(X(0), Y(-9.9), 5.6 * k, 2.6 * k, coat, 'coat', 3));
  P.push(E(X(0.3), Y(-8.1), 4.6 * k, 0.9 * k, belly, 'coat', 3.05));
  P.push(E(X(4.4), Y(-10.0), 2.4 * k, 2.8 * k, coat, 'coat', 3.2));

  // cuello arqueado y cabeza
  const px = 7.6, py = -17.6 + head;                          // nuca
  P.push(Cp(X(4.6), Y(-11.2), X(6.9), Y(-15.6 + head), 1.75 * k, coat, 'coat', 3.6));
  P.push(Cp(X(5.4), Y(-12.6), X(px), Y(py + 0.6), 1.2 * k, coat, 'coat', 3.7));
  P.push(E(X(px + 0.4), Y(py + 0.9), 1.35 * k, 1.15 * k, coat, 'coat', 5));                 // frente
  P.push(Cp(X(px + 0.6), Y(py + 1.2), X(px + 3.3), Y(py + 3.5), 1.0 * k, coat, 'coat', 5.1)); // cara larga
  P.push(E(X(px + 3.4), Y(py + 3.6), 1.0 * k, 0.85 * k, shadeC(coat, 0.85), 'coat', 5.2));  // morro
  if (o.blaze) P.push(Cp(X(px + 0.9), Y(py + 0.9), X(px + 3.0), Y(py + 3.1), 0.32 * k, [235, 230, 222], 'coat', 5.3));
  P.push(Pt(X(px + 4.1), Y(py + 3.5), '.', [25, 20, 18], 5.5, false));                   // ollar
  P.push(Pt(X(px + 0.9), Y(py + 0.6), 'o', [30, 25, 22], 5.6, false));                   // ojo
  P.push(Cp(X(px - 0.2), Y(py - 0.4), X(px - 0.5), Y(py - 2.0), 0.38 * k, dark, 'coat', 4.9));   // orejas
  P.push(Cp(X(px + 0.3), Y(py - 0.3), X(px + 0.4), Y(py - 1.9), 0.38 * k, coat, 'coat', 5.4));

  // crin: mechones a lo largo del cuello, del cogote a la cruz, y tupé en la frente
  for (let i = 0; i <= 6; i++) {
    const u = i / 6;
    const cx = px - 0.3 - u * 3.6, cy = py + 0.2 + u * 5.2;
    P.push(Cp(X(cx), Y(cy), X(cx - 1.0 - wind * 0.6), Y(cy + 1.3 + Math.sin(s.t * 2.5 + i) * 0.25), 0.5 * k, shadeC(mane, 0.9 + (i % 2) * 0.15), 'hair', 3.65));
  }
  P.push(Cp(X(px + 0.1), Y(py), X(px + 1.1), Y(py + 1.2), 0.35 * k, mane, 'hair', 5.45));

  // montura: manta, silla, cincha, estribo, cabezada y riendas
  if (o.tack) {
    P.push(E(X(-0.4), Y(-11.6), 3.1 * k, 1.25 * k, [150, 35, 40], 'cloth', 5.6));
    P.push(Ln(X(-3.4), Y(-11.0), X(2.6), Y(-11.0), [215, 175, 70], 'metal', 5.65));
    P.push(E(X(-0.4), Y(-12.4), 2.3 * k, 0.85 * k, [105, 62, 32], 'leather', 5.7));
    P.push(Cp(X(-2.2), Y(-12.9), X(-1.6), Y(-12.2), 0.45 * k, [95, 55, 28], 'leather', 5.75));    // borrén
    P.push(Cp(X(1.4), Y(-12.9), X(1.6), Y(-12.1), 0.4 * k, [95, 55, 28], 'leather', 5.75));
    P.push(Ln(X(0.6), Y(-11.3), X(0.6), Y(-8.0), [80, 50, 28], 'leather', 5.6));                  // cincha
    if (!o.ridden) P.push(Ln(X(-0.4), Y(-11.6), X(-0.2), Y(-8.6), [170, 170, 180], 'metal', 5.65), Pt(X(-0.2), Y(-8.4), 'U', [190, 190, 200], 5.66, false));
    P.push(Ln(X(px + 0.2), Y(py + 0.3), X(px + 3.6), Y(py + 3.0), [80, 48, 26], 'leather', 5.5)); // cabezada
    P.push(Ln(X(px + 3.6), Y(py + 3.3), X(2.4), Y(-12.4), [95, 58, 30], 'leather', 5.8));      // riendas
  }

  leg(-3.6, false, 0.45, true); leg(4.6, false, 2.1, false);
  return P;
}

// ------------------------------------------------------------------ Arañas

function rigSpider(s, o) {
  const P = [], k = o.size || 1;
  const lunge = s.atk >= 0 ? Math.sin(s.atk * Math.PI) * 1.4 * k : 0;
  const body = o.body, dark = shadeC(body, 0.55);
  for (let i = 0; i < 4; i++) for (const side of [-1, 1]) {
    const ph = s.phase * 1.8 + i * 1.6 + (side > 0 ? Math.PI : 0);
    const step = s.moving ? Math.sin(ph) * 0.9 * k : 0;
    const ax = (-0.6 + i * 0.7) * k + lunge, ay = -2.6 * k;
    const kx = ax + (i - 1.5) * 1.5 * k + side * 0.4 * k, ky = -4.8 * k - Math.max(0, step);
    const fx = ax + (i - 1.5) * 3.3 * k + side * 0.8 * k + step, fy = -0.2;
    const c = side < 0 ? dark : body, z = side < 0 ? 1 : 7;
    P.push(Ln(ax, ay, kx, ky, c, 'fur', z));
    P.push(Ln(kx, ky, fx, fy, c, 'fur', z));
  }
  P.push(E(-2.4 * k + lunge * 0.5, -3.2 * k, 2.8 * k, 2.3 * k, body, 'fur', 4));                  // abdomen
  P.push(E(1.3 * k + lunge, -2.9 * k, 1.6 * k, 1.4 * k, shadeC(body, 1.2), 'fur', 5));              // cefalotórax
  if (o.mark) P.push(Pt(-2.4 * k, -3.7 * k, 'X', [220, 30, 30], 6, true));                         // reloj de arena
  P.push(Pt(2.4 * k + lunge, -3.2 * k, '*', [255, 50, 40], 8, true));
  P.push(Pt(2.0 * k + lunge, -3.6 * k, '.', [255, 80, 60], 8, true));
  P.push(Ln(2.6 * k + lunge, -2.4 * k, 2.9 * k + lunge, -1.4 * k, [230, 225, 210], 'bone', 6));     // colmillos
  return P;
}

// ------------------------------------------------------------------ Dragón

function rigDragon(s, e) {
  const P = [];
  const red = [185, 34, 24], back = [120, 20, 14], dark = [80, 14, 10], horn = [228, 214, 186], claw = [235, 228, 210];
  const charge = e && e.fireCd !== undefined ? Math.max(0, 1 - e.fireCd / 0.7) : 0;
  const belly = lerp3([232, 150, 58], [255, 215, 90], charge);                 // la garganta y el pecho se encienden antes del fuego
  const flap = Math.sin(s.t * 2.4);
  const breath = Math.sin(s.t * 1.6) * 0.35;
  const lunge = s.atk >= 0 ? Math.sin(s.atk * Math.PI) * 3 : 0;
  const walk = s.moving ? s.phase * 0.8 : 0, sw = s.moving ? 0.35 : 0;
  const spike = (x, y, h, z, c = dark, lean = -0.6) => P.push(Tr(x - 0.9, y, x + 0.9, y, x + lean, y - h, c, 'scale', z, [0, -0.5, 1]));

  // ala lejana (oscura, detrás de todo)
  dragonWing(P, 3, -19.5 + breath, flap, shadeC([140, 26, 22], 0.55), 0.8, -1);

  // cola: larga, ondulante, con púas y punta de lanza
  let tx = -9, ty = -13.5;
  for (let i = 0; i < 12; i++) {
    const x = -9.5 - i * 2.5, y = -13 + i * 0.85 + Math.sin(s.t * 1.5 + i * 0.55) * (0.2 + i * 0.16);
    const r = 3.3 - i * 0.22;
    P.push(E(x, y, r, r * 0.82, i % 2 ? red : shadeC(red, 0.9), 'scale', 2 - i * 0.01));
    P.push(E(x + 0.2, y + r * 0.45, r * 0.8, r * 0.35, shadeC(belly, 0.85), 'belly', 2.005 - i * 0.01));
    if (i % 2 === 0 && i < 11) spike(x, y - r * 0.75, 1.2 - i * 0.05, 1.99 - i * 0.01, dark, -0.5);
    tx = x; ty = y;
  }
  P.push(Tr(tx - 0.5, ty - 2.2, tx - 5.5, ty, tx - 0.5, ty + 2.2, dark, 'scale', 1.8, [0, -0.2, 1]));

  // patas lejanas
  dragonLeg(P, -6.2, -11, true, Math.sin(walk + Math.PI) * sw, shadeC(red, 0.55), 2.5, claw);
  dragonArm(P, 5.4, -12.5, Math.sin(walk) * sw, shadeC(red, 0.55), 2.6, claw, lunge);

  // cuerpo: grupa, torso, pecho; vientre con placas; cresta del lomo
  P.push(E(-6.3, -14.2 + breath, 4.8, 5.0, red, 'scale', 3.9));
  P.push(E(0, -14.6 + breath, 8.6, 5.6, red, 'scale', 4));
  P.push(E(5.8, -14.8 + breath, 4.4, 5.2, red, 'scale', 4.05));
  P.push(E(-0.5, -18.4 + breath, 8.2, 1.8, back, 'scale', 4.02));                 // lomo más oscuro
  P.push(E(1.2, -11.1 + breath, 7.6, 2.5, belly, 'belly', 4.5));
  for (let x = -5; x <= 7; x += 1.8) P.push(Ln(x, -13.2 + breath, x - 0.3, -9.0 + breath, shadeC(belly, 0.7), 'belly', 4.55));
  for (let x = -9; x <= 6; x += 2.2) spike(x, -19.6 + breath + Math.abs(x) * 0.05, 1.8 + (x > -4 && x < 3 ? 0.5 : 0), 4.03);

  // patas cercanas
  dragonLeg(P, -6.6, -10.5, false, Math.sin(walk) * sw, shadeC(red, 0.9), 5, claw);
  dragonArm(P, 6.0, -12.0, Math.sin(walk + Math.PI) * sw, red, 5.1, claw, lunge);

  // cuello en S
  const B = (t, a, b, c, d) => { const u = 1 - t; return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d; };
  const sway = Math.sin(s.t * 1.1) * 0.6;
  const p0 = [7.5, -16.5 + breath], p1 = [13 + lunge * 0.5, -19], p2 = [9.5 + lunge, -26 + sway], p3 = [14.5 + lunge * 1.4, -28.5 + sway + breath];
  const neck = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    neck.push([B(t, p0[0], p1[0], p2[0], p3[0]), B(t, p0[1], p1[1], p2[1], p3[1])]);
  }
  neck.forEach(([x, y], i) => {
    const r = 3.0 - i * 0.11;
    P.push(E(x, y, r, r * 0.9, i % 2 ? red : shadeC(red, 0.92), 'scale', 6 + i * 0.01));
    P.push(E(x + r * 0.5, y + r * 0.35, r * 0.55, r * 0.55, belly, 'belly', 6.005 + i * 0.01));   // garganta
    if (i % 2 === 0 && i < 10) spike(x - r * 0.7, y - r * 0.6, 1.3, 5.99 + i * 0.01, dark, -0.8);
  });

  // cabeza
  const [hx, hy] = neck[10];
  const open = Math.max(charge * 0.8, s.atk >= 0 ? Math.sin(s.atk * Math.PI) : 0);
  P.push(Tr(hx - 1.2, hy + 1.5, hx - 3.4, hy - 0.6, hx - 0.6, hy - 1.2, dark, 'scale', 7, [0, 0, 1]));      // aleta de la mejilla
  P.push(E(hx + 1.6, hy, 3.1, 2.3, red, 'scale', 7.1));                                                  // cráneo
  P.push(Cp(hx + 2.8, hy + 0.1, hx + 8.2, hy + 0.7, 1.35, red, 'scale', 7.2));                          // hocico
  P.push(Cp(hx + 0.8, hy - 1.7, hx + 4.8, hy - 1.2, 0.6, back, 'scale', 7.3));                           // ceja
  P.push(Cp(hx + 2.4, hy + 1.7, hx + 7.6, hy + 1.9 + open * 2.6, 0.8, shadeC(red, 0.8), 'scale', 7.15)); // mandíbula
  for (let i = 0; i < 4; i++) P.push(Pt(hx + 4.3 + i * 1.1, hy + 1.6, 'v', claw, 7.4, false));           // dientes
  if (open > 0.25) {
    for (let i = 0; i < 3; i++) P.push(Pt(hx + 4.6 + i * 1.1, hy + 1.6 + open * 2.1, '^', claw, 7.4, false));
    P.push(E(hx + 6, hy + 1.8 + open * 1.1, 1.8, 0.4 + open * 0.8, [255, 120, 30], 'belly', 7.12));
    P.push(Pt(hx + 6, hy + 1.8 + open, '*', [255, 220, 90], 7.5, true));
  }
  P.push(Pt(hx + 8.6, hy + 0.2, '"', charge > 0 ? [255, 170, 50] : [60, 18, 10], 7.6, charge > 0));      // ollares
  P.push(Pt(hx + 2.9, hy - 0.9, '@', [255, 225, 60], 8, true));                                           // ojo
  // cuernos curvados hacia atrás
  P.push(Cp(hx + 0.6, hy - 1.6, hx - 2.2, hy - 3.6, 0.55, horn, 'bone', 7.6));
  P.push(Cp(hx - 2.2, hy - 3.6, hx - 4.6, hy - 3.0, 0.4, horn, 'bone', 7.6));
  P.push(Cp(hx + 1.8, hy - 2.0, hx - 0.4, hy - 4.6, 0.45, shadeC(horn, 0.85), 'bone', 7.55));
  P.push(Cp(hx - 0.4, hy - 4.6, hx - 2.4, hy - 4.9, 0.32, shadeC(horn, 0.85), 'bone', 7.55));

  // ala cercana
  dragonWing(P, -1.5, -19 + breath, flap, [165, 32, 26], 5.5, 1);
  return P;
}

// Pata trasera: muslo potente, corvejón, pie con garras
function dragonLeg(P, x, y, far, a, col, z, claw) {
  const kx = x - 1.2 + Math.sin(a) * 3, ky = -6.2;
  const fx = kx - 0.6 + Math.sin(a) * 2.2, fy = -1.2;
  P.push(E(x, y, 3.3, 4.0, col, 'scale', z));
  P.push(Cp(x - 0.4, y + 2.2, kx, ky, 1.7, shadeC(col, 0.95), 'scale', z + 0.05));
  P.push(Cp(kx, ky, fx, fy, 1.2, shadeC(col, 0.9), 'scale', z + 0.1));
  P.push(Cp(fx, fy, fx + 2.8, -0.6, 0.9, shadeC(col, 0.85), 'scale', z + 0.15));
  if (!far) for (let i = 0; i < 3; i++) P.push(Pt(fx + 2.6 + i * 0.9, -0.1, 'v', claw, z + 0.2, false));
}

// Pata delantera: hombro, antebrazo y mano con garras
function dragonArm(P, x, y, a, col, z, claw, lunge) {
  const ex = x + 1.2 + lunge * 0.3 + Math.sin(a) * 2, ey = -6.8;
  const hx = ex + 0.4 + lunge * 0.3 + Math.sin(a) * 1.6, hy = -1.0;
  P.push(Cp(x, y, ex, ey, 1.6, col, 'scale', z));
  P.push(Cp(ex, ey, hx, hy, 1.2, shadeC(col, 0.92), 'scale', z + 0.05));
  P.push(E(hx + 1.0, -0.7, 1.9, 0.8, shadeC(col, 0.85), 'scale', z + 0.1));
  for (let i = 0; i < 3; i++) P.push(Pt(hx + 1.4 + i * 0.9, -0.1, 'v', claw, z + 0.2, false));
}

// Ala de murciélago: brazo, muñeca con garra, cuatro dedos y membrana a paneles
function dragonWing(P, sx, sy, flap, col, z, side) {
  const bone = shadeC(col, 0.55);
  const k = 0.72 + 0.38 * flap;                          // abierta arriba / plegada abajo
  const at = (dx, dy) => [sx + dx * (0.9 + 0.1 * flap), sy + dy * k];
  const elbow = at(-2.5, -7.5), wrist = at(3.5, -14.5);
  const fingers = [at(11.5, -12.5), at(6, -21.5), at(-4, -20), at(-11, -12)];
  const root = [sx - 9, sy + 1.5];
  const panels = [[wrist, fingers[0], fingers[1]], [wrist, fingers[1], fingers[2]], [wrist, fingers[2], fingers[3]], [wrist, fingers[3], root], [[sx, sy], elbow, wrist], [[sx, sy], wrist, root]];
  panels.forEach(([a, b, c], i) => {
    const sh = 0.78 + (i % 2) * 0.16;
    P.push(Tr(a[0], a[1], b[0], b[1], c[0], c[1], shadeC(col, sh), 'membrane', z, [0.15 * side - 0.1 * i, -0.35 * flap - 0.15, 1]));
  });
  // borde festoneado entre dedos
  for (let i = 0; i < 3; i++) {
    const a = fingers[i], b = fingers[i + 1];
    const m = [(a[0] + b[0]) / 2 + (wrist[0] - (a[0] + b[0]) / 2) * 0.22, (a[1] + b[1]) / 2 + (wrist[1] - (a[1] + b[1]) / 2) * 0.22];
    P.push(Ln(a[0], a[1], m[0], m[1], shadeC(col, 0.5), 'scale', z + 0.05));
    P.push(Ln(m[0], m[1], b[0], b[1], shadeC(col, 0.5), 'scale', z + 0.05));
  }
  P.push(Cp(sx, sy, elbow[0], elbow[1], 0.85, bone, 'scale', z + 0.1));
  P.push(Cp(elbow[0], elbow[1], wrist[0], wrist[1], 0.7, bone, 'scale', z + 0.1));
  for (const f of fingers) P.push(Ln(wrist[0], wrist[1], f[0], f[1], bone, 'scale', z + 0.12));
  P.push(Pt(wrist[0] + 0.6, wrist[1] - 0.8, '^', [235, 225, 205], z + 0.2, false));            // garra del ala
  for (const f of fingers) P.push(Pt(f[0], f[1], side > 0 ? "'" : '.', [220, 200, 180], z + 0.2, false));
}

// ------------------------------------------------------------------ Vistas de frente y de espaldas
// Al andar hacia abajo se ve la cara; hacia arriba, la espalda (con la capa). Mismas opciones que
// rigHuman, así que sirve para todos los personajes humanoides.
function rigHumanFB(s, o, back) {
  const P = [], k = o.size || 1;
  const bob = s.moving ? -Math.abs(Math.cos(s.phase)) * 0.5 * k : 0;
  const atk = s.atk >= 0 ? ease(s.atk) : -1;
  const X = x => x * k, Y = y => y * k + bob;
  const hip = Y(-7.8), armC = o.arms || o.body, armM = o.armsM || o.bodyM || 'cloth';
  const side = back ? 1 : -1;                       // lado de la mano del arma vista desde la cámara
  const bodyRx = (o.bodyRx || 2.7) * 1.05;

  // capa: de espaldas la cubre entera; de frente asoma por los lados
  const capeC = o.mantle || o.cape;
  if (capeC) {
    const fl = s.moving ? Math.sin(s.phase * 2) * 0.45 : Math.sin(s.t * 1.7) * 0.2;
    if (back) {
      P.push(Tr(X(-2.7), Y(-14.6), X(2.7), Y(-14.6), X(-3.7) - fl, -1.6 * k, capeC, 'cloth', 7.5, [0, -0.2, 1]));
      P.push(Tr(X(2.7), Y(-14.6), X(3.7) + fl, -1.6 * k, X(-3.7) - fl, -1.6 * k, shadeC(capeC, 0.85), 'cloth', 7.5, [0, -0.1, 1]));
      P.push(Ln(X(-3.7) - fl, -1.6 * k, X(3.7) + fl, -1.6 * k, shadeC(capeC, 0.6), 'cloth', 7.6, '_'));
      for (const fx of [-1.6, 0, 1.6]) P.push(Ln(X(fx * 0.7), Y(-13.4), X(fx * 1.25) + fl * 0.5, -2.3 * k, shadeC(capeC, 0.7), 'cloth', 7.55, '|'));
    } else {
      P.push(Tr(X(-2.9), Y(-14.2), X(-3.9) - fl, -1.8 * k, X(-2.2), -1.8 * k, shadeC(capeC, 0.7), 'cloth', 0.4));
      P.push(Tr(X(2.9), Y(-14.2), X(3.9) + fl, -1.8 * k, X(2.2), -1.8 * k, shadeC(capeC, 0.7), 'cloth', 0.4));
    }
  }
  // piernas: al andar se levantan por turnos
  if (o.robe) P.push(E(0, Y(-5.2), 3.2 * k, 5.4 * k, o.robe, 'cloth', 2));
  else for (const sx of [-1, 1]) {
    const lift = s.moving ? Math.max(0, Math.sin(s.phase + (sx > 0 ? 0 : Math.PI))) * 1.3 * k : 0;
    const fx = X(sx * 1.15), fy = -1.0 * k - lift;
    if (o.bone) P.push(Ln(X(sx * 0.9), hip, fx, fy, o.legs, 'bone', 2));
    else {
      P.push(Cp(X(sx * 1.0), hip, fx, fy, 0.9 * k, sx === side ? o.legs : shadeC(o.legs, 0.85), o.legsM || 'cloth', 2));
      P.push(E(fx, fy + 0.4 * k, 1.0 * k, 0.7 * k, o.boots || LEATHER, 'leather', 2.2));
    }
  }
  // brazo libre (con antorcha de noche)
  const armSwing = s.moving ? Math.sin(s.phase) * 0.6 * k : 0;
  const shY = Y(-13.9), off = -side;
  if (o.torch) {
    const fl = Math.sin(s.t * 23) > 0;
    P.push(Cp(X(off * 2.6), shY, X(off * 3.6), Y(-17), 0.7 * k, armC, armM, 4.5));
    P.push(Ln(X(off * 3.6), Y(-16.4), X(off * 3.8), Y(-20.6), WOOD, 'wood', 9));
    P.push(Pt(X(off * 3.9), Y(-21.6), fl ? '*' : '#', [255, 210, 90], 9.6, true));
    P.push(Pt(X(off * 4.0), Y(-23), fl ? '^' : "'", [255, 120, 30], 9.6, true));
  } else if (o.bone) P.push(Ln(X(off * 2.4), shY, X(off * 2.9), Y(-8.8) + armSwing, armC, 'bone', 4.5));
  else P.push(Cp(X(off * 2.5), shY, X(off * 3.0), Y(-8.8) + armSwing, 0.75 * k, armC, armM, 4.5));
  // torso
  if (o.bone) { P.push(E(0, Y(-11.6), 2.4 * k, 3.1 * k, o.body, 'ribs', 4)); P.push(E(0, Y(-8.2), 1.8 * k, 0.9 * k, o.body, 'bone', 4)); }
  else {
    P.push(E(0, Y(-11.2), bodyRx * k, 3.7 * k, o.body, o.bodyM || 'cloth', 4));
    if (o.tabard) P.push(E(0, Y(-10.2), 1.7 * k, 3.9 * k, o.tabard, 'cloth', 5));
    if (o.emblem && !back) { P.push(Pt(0, Y(-11.8), '+', GOLD, 5.6, false)); P.push(Pt(0, Y(-10.6), 'V', GOLD, 5.6, false)); }
    if (o.apron && !back) P.push(E(0, Y(-9.4), 2.0 * k, 4.4 * k, o.apron, 'leather', 5));
    if (o.belt) P.push(Cp(X(-2.6), Y(-8.4), X(2.6), Y(-8.4), 0.45 * k, o.belt, 'leather', 5.5));
    if (o.pauldrons) for (const sx of [-1, 1]) P.push(E(X(sx * 2.4), Y(-14.1), 1.4 * k, 1.15 * k, o.pauldrons, 'metal', 6.8));
  }
  if (o.shieldBack && back) { P.push(E(0, Y(-11.5), 2.4 * k, 3.4 * k, o.shieldBack, 'metal', 7.6)); P.push(Pt(0, Y(-11.5), 'o', GOLD, 7.7, false)); }
  // cabeza: de frente con cara o visera; de espaldas, pelo, capucha o la nuca del yelmo
  const hs = (o.headScale || 1) * 0.82, hk = k * hs;
  const hx = 0, hy = Y(-16.9 - (hs - 0.82) * 1.8), face = !back;
  if (o.ears) for (const sx of [-1, 1]) P.push(Cp(hx + sx * 1.6 * hk, hy - 0.6 * hk, hx + sx * 4.2 * hk, hy - 2.4 * hk, 0.6 * k, o.skin, 'skin', 5.9));
  P.push(E(hx, hy, 2.1 * hk, 2.3 * hk, o.skin, o.bone ? 'bone' : 'skin', 6));
  const hairFull = () => P.push(E(hx, hy - 0.4 * hk, 2.3 * hk, 2.4 * hk, o.hair || [90, 60, 35], 'hair', 6.5));
  const hairTop = () => P.push(E(hx, hy - 1.5 * hk, 2.3 * hk, 1.2 * hk, o.hair || [90, 60, 35], 'hair', 6.5));
  switch (o.head) {
    case 'greathelm':
      P.push(E(hx, hy - 0.3 * hk, 2.5 * hk, 2.8 * hk, o.helm || METAL, 'metal', 6.5));
      P.push(Cp(hx - 2.2 * hk, hy + 1.7 * hk, hx + 2.2 * hk, hy + 1.7 * hk, 0.5 * hk, shadeC(METAL, 0.7), 'metal', 6.6));
      if (face) {
        P.push(Ln(hx - 1.7 * hk, hy - 0.4 * hk, hx + 1.7 * hk, hy - 0.4 * hk, [15, 15, 25], 'cloth', 7, '='));        // ranura
        P.push(Ln(hx, hy - 0.2 * hk, hx, hy + 1.2 * hk, [15, 15, 25], 'cloth', 7, '|'));                            // nasal
        for (const sx of [-1, 1]) P.push(Pt(hx + sx * 1.0 * hk, hy + 0.8 * hk, '.', [15, 15, 25], 7, false));       // respiraderos
      } else P.push(Ln(hx, hy - 2.4 * hk, hx, hy + 1.2 * hk, shadeC(o.helm || METAL, 0.7), 'metal', 6.7, '|'));
      break;
    case 'helmet':
      P.push(E(hx, hy - 0.5 * hk, 2.4 * hk, 2.4 * hk, o.helm || METAL, 'metal', 6.5));
      if (face) P.push(Ln(hx - 1.3 * hk, hy, hx + 1.3 * hk, hy, [20, 20, 30], 'cloth', 7, '-'));
      break;
    case 'hood':
      P.push(E(hx, hy - 0.3 * hk, 2.8 * hk, 3 * hk, o.hood, 'cloth', 6.2));
      if (face) P.push(E(hx, hy + 0.4 * hk, 1.4 * hk, 1.6 * hk, shadeC(o.skin, 0.55), 'skin', 6.4));
      break;
    case 'hair': back ? hairFull() : hairTop(); break;
    case 'crown':
      back ? hairFull() : hairTop();
      P.push(E(hx, hy - 2.4 * hk, 2.1 * hk, 0.7 * hk, GOLD, 'metal', 7));
      for (const dx of [-1.3, 0, 1.3]) P.push(Pt(hx + dx * hk, hy - 3.9 * hk, '^', GOLD, 7.1, false));
      break;
    case 'hat':
      if (back) hairFull();
      P.push(E(hx, hy - 1.9 * hk, 3.8 * hk, 0.8 * hk, o.hat, 'hair', 7));
      P.push(E(hx, hy - 2.8 * hk, 1.9 * hk, 1.2 * hk, o.hat, 'hair', 7.1));
      break;
  }
  if (o.plume) {
    if (back) P.push(Cp(hx, hy - 2.8 * hk, hx + Math.sin(s.t * 2) * 0.4, hy + 1.5 * hk, 0.9 * hk, o.plume, 'cloth', 7.2));
    else P.push(Cp(hx, hy - 2.8 * hk, hx, hy - 4.6 * hk, 0.8 * hk, o.plume, 'cloth', 5.8));
  }
  if (face) {
    if (o.beard) P.push(E(hx, hy + 1.8 * hk, 1.6 * hk, 1.6 * hk, o.beard, 'hair', 6.8));
    if (o.eyes) for (const sx of [-1, 1]) P.push(Pt(hx + sx * 0.8 * hk, hy - 0.2 * hk, o.eyeCh || '*', o.eyes, 8, true));
    else if (o.head !== 'helmet' && o.head !== 'hood' && o.head !== 'greathelm') for (const sx of [-1, 1]) P.push(Pt(hx + sx * 0.8 * hk, hy - 0.2 * hk, '.', [25, 20, 20], 6.9, false));
    if (o.tusk) for (const sx of [-1, 1]) P.push(Pt(hx + sx * 0.9 * hk, hy + 1.3 * hk, "'", [245, 240, 225], 8, false));
  }
  // brazo del arma: de frente, el arma por delante; de espaldas, el arma queda delante del pecho (tapada)
  const ax = X(side * 2.5), ay = shY;
  let hxp = X(side * 3.1), hyp = Y(-8.8) - armSwing;
  if (atk >= 0) { const a = lerp(-2.4, 0.5, atk); hxp = ax + side * Math.cos(a) * 2.6 * k; hyp = ay + Math.sin(a) * 4.2 * k; }
  if (o.bone) P.push(Ln(ax, ay, hxp, hyp, armC, 'bone', back ? 4.5 : 7.5));
  else P.push(Cp(ax, ay, hxp, hyp, 0.75 * k, armC, armM, back ? 4.5 : 7.5));
  const wz = back ? 3.4 : 9;
  switch (o.weapon) {
    case 'sword': case 'dagger': {
      const len = (o.weapon === 'dagger' ? 4.2 : 7.5) * k;
      const a = atk >= 0 ? lerp(-2.6, 0.9, atk) : -1.45;
      P.push(Ln(hxp - 1.0 * k, hyp, hxp + 1.0 * k, hyp, GOLD, 'metal', wz));
      P.push(Ln(hxp, hyp, hxp + side * Math.cos(a) * len * 0.55, hyp + Math.sin(a) * len, o.blade || [230, 238, 255], 'metal', wz + 0.1));
      break;
    }
    case 'axe': case 'hammer':
      P.push(Ln(hxp, hyp + 1 * k, hxp, hyp - 5.5 * k, WOOD, 'wood', wz));
      P.push(E(hxp + side * 0.8 * k, hyp - 5.5 * k, 1.4 * k, 1.3 * k, o.weapon === 'axe' ? [170, 170, 180] : STEEL, 'metal', wz + 0.1));
      break;
    case 'spear': P.push(Ln(hxp, hyp + 3 * k, hxp, hyp - 12 * k, WOOD, 'wood', wz)); P.push(Pt(hxp, hyp - 12.8 * k, '^', [220, 225, 240], wz + 0.1, false)); break;
    case 'staff': P.push(Ln(hxp, hyp + 3 * k, hxp, hyp - 9.5 * k, WOOD, 'wood', wz)); P.push(Pt(hxp, hyp - 10.3 * k, '*', o.staffGlow || GOLD, wz + 0.2, true)); break;
    case 'hoe': P.push(Ln(hxp, hyp + 2.5 * k, hxp, hyp - 8 * k, WOOD, 'wood', wz)); P.push(Ln(hxp, hyp - 8 * k, hxp + side * 1.8 * k, hyp - 7.4 * k, [170, 170, 180], 'metal', wz + 0.1)); break;
    case 'mug': P.push(E(hxp, hyp - 0.4 * k, 0.9 * k, 1.1 * k, [150, 100, 50], 'wood', wz)); break;
    case 'shield':
      P.push(E(hxp, hyp - 1 * k, 2.0 * k, 2.9 * k, o.shieldC || [160, 160, 180], 'metal', back ? 3.3 : 9));
      if (!back) P.push(Pt(hxp, hyp - 1 * k, 'o', GOLD, 9.1, false));
      break;
  }
  return P;
}

// Caballo de frente (pecho, patas delanteras y cabeza mirándote) y de espaldas (grupa, cola, cabeza al fondo)
function rigHorseFB(s, o, back) {
  const P = [], k = o.size || HORSE_K;
  const coat = o.coat, dark = shadeC(coat, 0.62), mane = o.mane;
  const ph = s.phase * 0.9, run = s.moving ? 1 : 0;
  const bob = run ? -Math.abs(Math.sin(ph)) * 0.7 : Math.sin(s.t * 1.3) * 0.08;
  const hb = run ? Math.sin(ph * 2) * 0.4 : Math.sin(s.t * 0.7) * 0.2;
  const X = x => x * k, Y = y => (y + bob) * k, Yg = y => y * k;
  const leg = (x, z, off, col) => {
    const lift = run ? Math.max(0, Math.sin(ph + off)) * 1.8 : 0;
    P.push(Cp(X(x), Yg(-8 + bob), X(x * 1.05), Yg(-3.2 - lift), 0.85 * k, col, 'coat', z));
    P.push(Cp(X(x * 1.05), Yg(-3.2 - lift), X(x * 1.05), Yg(-0.6 - lift), 0.5 * k, o.socks && z > 3 ? [225, 220, 210] : shadeC(col, 0.85), 'coat', z + 0.05));
    P.push(E(X(x * 1.05), Yg(-0.4 - lift), 0.7 * k, 0.4 * k, [60, 50, 45], 'leather', z + 0.1));
  };
  const part = o.part || 'all';
  if (!back) {
    leg(-1.9, 1, 0, shadeC(coat, 0.55)); leg(1.9, 1, Math.PI, shadeC(coat, 0.55));
    P.push(E(0, Y(-10.6), 3.4 * k, 3.0 * k, shadeC(coat, 0.8), 'coat', 2));
    if (o.tack) { P.push(E(0, Y(-12.6), 2.6 * k, 0.9 * k, [150, 35, 40], 'cloth', 2.2)); P.push(E(0, Y(-13.1), 2.0 * k, 0.7 * k, [105, 62, 32], 'leather', 2.3)); }
    P.push(E(0, Y(-10.4), 2.9 * k, 3.0 * k, coat, 'coat', 3));
    leg(-1.3, 4, 1.6, coat); leg(1.3, 4, 1.6 + Math.PI, coat);
    P.push(Cp(0, Y(-12.5), 0, Y(-15.5 + hb), 1.6 * k, coat, 'coat', 4));
    P.push(E(0, Y(-16.4 + hb), 1.5 * k, 1.4 * k, coat, 'coat', 5));
    P.push(Cp(0, Y(-16 + hb), 0, Y(-12.6 + hb), 1.1 * k, coat, 'coat', 5.1));
    P.push(E(0, Y(-12.4 + hb), 1.15 * k, 0.9 * k, shadeC(coat, 0.85), 'coat', 5.2));
    if (o.blaze) P.push(Cp(0, Y(-16.6 + hb), 0, Y(-12.8 + hb), 0.32 * k, [235, 230, 222], 'coat', 5.3));
    for (const sx of [-1, 1]) {
      P.push(Pt(X(sx * 1.25), Y(-16.2 + hb), 'o', [30, 25, 22], 5.6, false));
      P.push(Pt(X(sx * 0.45), Y(-12.2 + hb), '.', [25, 20, 18], 5.5, false));
      P.push(Cp(X(sx * 0.8), Y(-17.4 + hb), X(sx * 1.2), Y(-19 + hb), 0.38 * k, dark, 'coat', 5.4));
      if (o.tack) P.push(Ln(X(sx * 1.1), Y(-16.6 + hb), X(sx * 0.9), Y(-12.6 + hb), [80, 48, 26], 'leather', 5.5));
    }
    P.push(Cp(0, Y(-17.6 + hb), X(0.3), Y(-16.2 + hb), 0.4 * k, mane, 'hair', 5.45));
  } else {
    if (part !== 'body') {                       // cabeza y orejas asomando por encima de la grupa
      P.push(Cp(0, Y(-12), 0, Y(-15.8 + hb), 1.5 * k, shadeC(coat, 0.75), 'coat', 1));
      P.push(E(0, Y(-16.6 + hb), 1.3 * k, 1.2 * k, shadeC(coat, 0.75), 'coat', 1.1));
      for (const sx of [-1, 1]) P.push(Cp(X(sx * 0.7), Y(-17.4 + hb), X(sx * 1.1), Y(-19 + hb), 0.38 * k, dark, 'coat', 1.2));
      P.push(Cp(0, Y(-17.2 + hb), 0, Y(-12.6), 0.6 * k, mane, 'hair', 1.15));
    }
    if (part !== 'head') {
      leg(-1.3, 1.5, 1.6, shadeC(coat, 0.6)); leg(1.3, 1.5, 1.6 + Math.PI, shadeC(coat, 0.6));
      P.push(E(0, Y(-10.6), 3.3 * k, 3.1 * k, coat, 'coat', 3));
      P.push(Ln(0, Y(-13.2), 0, Y(-8.4), shadeC(coat, 0.75), 'coat', 3.1, '|'));
      if (o.tack) { P.push(E(0, Y(-13.0), 2.7 * k, 0.9 * k, [150, 35, 40], 'cloth', 3.3)); P.push(E(0, Y(-13.5), 2.0 * k, 0.7 * k, [105, 62, 32], 'leather', 3.4)); }
      leg(-1.7, 4, 0, coat); leg(1.7, 4, Math.PI, coat);
      const sw = Math.sin(s.t * 2.2) * 0.5 + (run ? Math.sin(ph) * 0.6 : 0);
      P.push(Cp(0, Y(-12.4), X(sw * 0.5), Y(-9), 0.8 * k, mane, 'hair', 5));
      for (let i = 0; i < 3; i++) P.push(Cp(X(sw * 0.5), Y(-9), X(sw + (i - 1) * 0.5), Y(-4.6 - (run ? 1.5 : 0) + i * 0.3), 0.42 * k, shadeC(mane, 0.85 + i * 0.07), 'hair', 5.1));
    }
  }
  return P;
}

// ------------------------------------------------------------------ Gólem del Roble
// Mole de piedra con musgo y enredaderas; núcleo y ojos verdes que brillan. Dormido, agazapado.
function rigGolem(s, e) {
  const P = [], stone = [128, 124, 112], dark = [82, 80, 72], moss = [70, 135, 55];
  const asleep = e && e.sleep, glow = asleep ? [70, 120, 80] : [150, 255, 160];
  const w = s.moving ? Math.sin(s.phase * 0.8) : 0, bob = s.moving ? -Math.abs(Math.cos(s.phase * 0.8)) * 0.6 : 0;
  const crouch = asleep ? 3 + Math.sin(s.t * 0.8) * 0.2 : 0;
  const Y = y => y + bob + crouch;
  P.push(Cp(-2.2, Y(-6), -2.4 - w * 1.5, -1.5, 1.7, dark, 'stone', 1));
  P.push(E(-2.4 - w * 1.5, -0.9, 2.2, 1.0, dark, 'stone', 1.1));
  P.push(Cp(-4.2, Y(-15), -5.8, Y(-8.5) + w, 1.5, dark, 'stone', 0.8));
  P.push(E(-6.0, Y(-7.6) + w, 2.0, 1.8, dark, 'stone', 0.9));
  P.push(E(0, Y(-12.5), 5.2, 5.6, stone, 'stone', 4));                         // torso de roca
  P.push(E(2.6, Y(-9.2), 1.6, 1.4, dark, 'stone', 4.4));
  P.push(E(-1.5, Y(-16.8), 3.2, 1.5, moss, 'fur', 4.5));                       // musgo en los hombros
  P.push(E(3.2, Y(-15.5), 1.4, 0.9, moss, 'fur', 4.5));
  P.push(Cp(-3, Y(-17), -3.6, Y(-9.5), 0.3, moss, 'fur', 4.6));                // enredaderas
  P.push(Cp(1.5, Y(-17), 2.0, Y(-11), 0.25, moss, 'fur', 4.6));
  for (const [x, y, ch] of [[0.8, -14, '|'], [0.8, -12.5, '*'], [0.8, -11, '|'], [-0.6, -12.5, '-'], [2.2, -12.5, '-']]) P.push(Pt(x, Y(y), ch, glow, 5, !asleep));
  P.push(E(1.5, Y(-19.4), 2.4, 2.0, stone, 'stone', 5));                       // cabeza
  P.push(E(0.6, Y(-20.6), 1.6, 0.7, moss, 'fur', 5.2));
  P.push(Pt(2.7, Y(-19.4), asleep ? '-' : '=', glow, 6, !asleep));             // ojos
  P.push(Pt(1.4, Y(-19.4), asleep ? '-' : '=', glow, 6, !asleep));
  const ang = s.atk >= 0 ? lerp(-2.4, 1.2, s.atk) : asleep ? 1.45 : 1.2;       // puñetazo contra el suelo
  const sx = 4.2, sy = Y(-15), hx = sx + Math.cos(ang) * 6.5, hy = sy + Math.sin(ang) * 6.5;
  P.push(Cp(sx, sy, hx, hy, 1.7, stone, 'stone', 6));
  P.push(E(hx, hy, 2.5, 2.2, stone, 'stone', 6.2));
  P.push(E(hx - 0.6, hy - 1.2, 1.2, 0.6, moss, 'fur', 6.3));
  return P;
}

// ------------------------------------------------------------------ Catálogo

const RIGS = {
  knight: s => rigHuman(s, { torch: s.torch, blade: player && player.dragonbane ? [150, 255, 160] : undefined,
    legs: [165, 170, 190], legsM: 'metal', body: [200, 205, 220], bodyM: 'metal', tabard: [40, 75, 210], arms: [200, 205, 220], armsM: 'metal',
    skin: [220, 175, 140], head: 'greathelm', helm: [215, 220, 235], plume: [225, 40, 35], weapon: 'sword', belt: LEATHER,
    pauldrons: [225, 230, 245], mantle: [175, 28, 36], emblem: true, boots: [70, 50, 35],
  }),
  king: s => rigHuman(s, {
    robe: [170, 25, 40], body: [170, 25, 40], cape: [100, 35, 140], arms: [170, 25, 40], skin: [225, 180, 145],
    head: 'crown', hair: [235, 235, 235], beard: [240, 240, 240], weapon: 'staff', staffGlow: [255, 215, 90], belt: GOLD,
  }),
  guard: s => rigHuman(s, {
    legs: STEEL, legsM: 'metal', body: METAL, bodyM: 'metal', tabard: [55, 85, 205], arms: METAL, armsM: 'metal',
    skin: [215, 170, 135], head: 'helmet', weapon: 'spear', pauldrons: METAL,
  }),
  smith: s => rigHuman(s, {
    legs: [70, 55, 45], body: [140, 60, 40], apron: [95, 62, 35], arms: [215, 160, 120], armsM: 'skin',
    skin: [215, 160, 120], head: 'hair', hair: [50, 35, 25], beard: [60, 40, 25], weapon: 'hammer', bodyRx: 3.4,
  }),
  armorer: s => rigHuman(s, {
    legs: STEEL, legsM: 'metal', body: METAL, bodyM: 'metal', arms: METAL, armsM: 'metal',
    skin: [220, 175, 140], head: 'hair', hair: [160, 160, 165], beard: [170, 170, 175], weapon: 'shield', shieldC: [120, 60, 160],
  }),
  healer: s => rigHuman(s, {
    robe: [40, 150, 150], body: [40, 150, 150], arms: [40, 150, 150], skin: [225, 185, 150],
    head: 'hood', hood: [30, 115, 120], weapon: 'staff', staffGlow: [90, 255, 230],
  }),
  peasant: (s, e) => rigHuman(s, {
    legs: [100, 80, 55], body: e.tint || [120, 90, 50], arms: e.tint || [120, 90, 50], skin: [220, 175, 140],
    head: e.hat ? 'hat' : 'hair', hat: [205, 175, 95], hair: e.hairC || [90, 60, 35], belt: LEATHER, weapon: e.mug ? 'mug' : undefined,
  }),
  farmer: s => rigHuman(s, {
    legs: [85, 70, 50], body: [80, 120, 60], arms: [215, 165, 125], armsM: 'skin', skin: [215, 165, 125],
    head: 'hat', hat: [215, 185, 100], apron: [110, 80, 45], weapon: 'hoe', belt: LEATHER,
  }),
  innkeeper: s => rigHuman(s, {
    legs: [60, 50, 45], body: [175, 160, 140], arms: [175, 160, 140], skin: [225, 175, 140], bodyRx: 3.2,
    head: 'hair', hair: [60, 40, 30], beard: [70, 45, 30], apron: [215, 210, 195], weapon: 'mug',
  }),
  goblin: s => rigHuman(s, { torch: s.torch,
    size: 0.75, headScale: 1.35, skin: [200, 195, 80], body: [165, 45, 30], bodyM: 'cloth', legs: [90, 55, 30],
    arms: [200, 195, 80], armsM: 'skin', ears: true, eyes: [255, 50, 30], weapon: 'dagger', blade: [210, 205, 200], belt: [60, 40, 25],
  }),
  bandit: s => rigHuman(s, { torch: s.torch,
    skin: [200, 150, 120], body: [115, 30, 30], legs: [55, 45, 40], arms: [90, 25, 25], head: 'hood', hood: [70, 45, 35],
    weapon: 'sword', blade: [200, 205, 215], belt: LEATHER, cape: [60, 40, 30],
  }),
  skeleton: s => rigHuman(s, {
    bone: true, skin: [225, 220, 200], body: [225, 220, 200], legs: [225, 220, 200], arms: [225, 220, 200],
    eyes: [255, 60, 30], weapon: 'sword', blade: [150, 120, 90],
  }),
  orc: s => rigHuman(s, { torch: s.torch,
    size: 1.25, bodyRx: 3.8, pauldrons: [110, 80, 50], skin: [75, 125, 55], body: [95, 68, 42], bodyM: 'leather', legs: [60, 45, 30],
    arms: [75, 125, 55], armsM: 'skin', head: 'hair', hair: [35, 30, 25], eyes: [255, 70, 40], tusk: true, weapon: 'axe',
  }),
  wolf: s => rigQuad(s, { fur: [150, 152, 165], chest: [185, 185, 195], eyes: [255, 220, 60], tail: true }),
  bear: s => rigQuad(s, { size: 1.3, fur: [125, 82, 45], eyes: [255, 140, 40], eyeCh: '.', roundEars: true, snout: 2.6, bodyRx: 5, bodyRy: 4.4, tall: 0.6, legW: 1.6 }),
  dragon: (s, e) => rigDragon(s, e),
  horse: (s, e) => rigHorse(s, { coat: e.coat, mane: e.mane || shadeC(e.coat, 0.35), tack: !e.wild, ridden: !!(player && e === player.mount), socks: e.socks, blaze: e.blaze, part: e._part }),
  sheep: s => rigQuad(s, { size: 0.72, fur: [232, 230, 220], chest: [245, 243, 235], headC: [60, 52, 48], legC: [55, 48, 44],
                          eyes: [20, 20, 20], eyeCh: '.', snout: 2.4, bodyRx: 5, bodyRy: 3.8 }),
  rat: s => rigQuad(s, { size: 0.45, fur: [105, 95, 90], eyes: [255, 60, 40], tail: true, snout: 3.8 }),
  spider: s => rigSpider(s, { size: 1, body: [80, 66, 58] }),
  spiderqueen: s => rigSpider(s, { size: 2.6, body: [48, 40, 45], mark: true }),
};

// Escala de detalle de cada figura (más escala = más caracteres = más detalle)
RIGS.warlord = (s, e) => RIGS.orc(s, e);
RIGS.golem = (s, e) => rigGolem(s, e);
RIGS.witch = s => rigHuman(s, {
  size: 0.9, robe: [55, 35, 70], body: [55, 35, 70], arms: [55, 35, 70], skin: [150, 175, 120],
  head: 'hat', hat: [30, 25, 40], hair: [200, 200, 205], weapon: 'staff', staffGlow: [120, 255, 120], belt: [90, 60, 40],
});
const RIG_SCALE = { golem: 1.35, warlord: 1.3, dragon: 1.15, wolf: 0.95, bear: 0.95, default: 1.0 };

function scaleParts(parts, k) {
  if (k === 1) return parts;
  for (const p of parts) for (const key of ['x', 'y', 'x1', 'y1', 'x2', 'y2', 'ax', 'ay', 'bx', 'by', 'cx', 'cy', 'rx', 'ry', 'r']) if (p[key] !== undefined) p[key] *= k;
  return parts;
}

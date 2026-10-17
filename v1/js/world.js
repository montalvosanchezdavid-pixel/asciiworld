'use strict';
// Definición de casillas y generación procedural del reino.

const T = {};
const TILE_DEFS = [];
function defTile(key, ch, fg, bg, pass, name, opts = {}) {
  T[key] = TILE_DEFS.length;
  TILE_DEFS.push({ key, ch, fg: hexRgb(fg), bg: hexRgb(bg), pass, name, ...opts });
}

defTile('DEEP',     '~', '#2f5fbf', '#071430', false, 'aguas profundas', { anim: true, water: true });
defTile('WATER',    '~', '#5a8fe6', '#0c2250', false, 'agua', { anim: true, water: true });
defTile('SAND',     '.', '#d9c47e', '#2b2412', true,  'arena');
defTile('GRASS',    '.', '#5fae46', '#0d1d0a', true,  'pradera', { vary: true });
defTile('MEADOW',   '"', '#86c95c', '#0f220b', true,  'hierba alta', { vary: true });
defTile('FLOWERS',  '*', '#e8d860', '#0f220b', true,  'campo de flores');
defTile('FOREST',   'T', '#2e9a40', '#071507', true,  'bosque', { vary: true });
defTile('PINE',     'Y', '#4c9a6a', '#061309', true,  'pinar', { vary: true });
defTile('HILL',     'n', '#a8925e', '#1d170c', true,  'colinas', { vary: true });
defTile('MOUNTAIN', '^', '#9c948c', '#17140f', false, 'montañas', { vary: true });
defTile('SNOW',     '^', '#f0f4ff', '#25262c', false, 'cumbres nevadas');
defTile('ROAD',     ':', '#b58f62', '#21180d', true,  'camino');
defTile('BRIDGE',   '=', '#c08848', '#0c2250', true,  'puente');
defTile('CWALL',    '#', '#c4c4cf', '#2a2a33', false, 'muralla');
defTile('CFLOOR',   '.', '#7d7a74', '#18171a', true,  'patio del castillo');
defTile('GATE',     '+', '#e0a050', '#2a1b0c', true,  'portón');
defTile('CARPET',   '.', '#e04858', '#3a0c12', true,  'alfombra real');
defTile('HWALL',    '#', '#b8834a', '#2a1a0c', false, 'casa');
defTile('HFLOOR',   '.', '#8a6a48', '#1c130a', true,  'suelo de madera');
defTile('DOOR',     '+', '#e0a050', '#2a1b0c', true,  'puerta');
defTile('WELL',     'O', '#7fb0ff', '#1a1a22', false, 'pozo');
defTile('PLAZA',    ',', '#a89070', '#1e1912', true,  'plaza');
defTile('CAVE',     '.', '#7b6a60', '#120d0b', true,  'guarida');
defTile('BONES',    '%', '#ddd6c0', '#120d0b', true,  'huesos');

const VILLAGE_NAMES = ['Robledo', 'Valdeoro', 'Piedrahita', 'Fuentecilla', 'Montebajo', 'Villaverde'];

const PEASANT_LINES = [
  'Dicen que el dragón quemó tres granjas el último invierno.',
  'Cuidado con los lobos cuando cae la noche.',
  'Los bandidos acechan en los caminos alejados del castillo.',
  'El herrero del castillo forja las mejores espadas del reino.',
  '¡Buen día, caballero!',
  'Mi cosecha se pudre... ojalá alguien acabe con esos goblins.',
  'En las colinas viven orcos. Yo no iría solo.',
  'La curandera puede sanar vuestras heridas por unas monedas.',
  'De noche los monstruos son más osados. Llevad antorcha.',
  'He visto humo saliendo de las montañas... es el dragón, seguro.',
];
const GUARD_LINES = [
  '¡Larga vida al rey!',
  'Su Majestad os espera en el salón del trono.',
  'Las puertas del castillo siempre están abiertas para vos.',
  'Dentro de las murallas no os atacará ningún monstruo.',
];

function makeNpc(role, x, y, extra = {}) {
  const defs = {
    king:    { ch: 'K', color: '#ffd040', name: 'el rey Alfonso', r: 0 },
    guard:   { ch: 'G', color: '#8fa8e0', name: 'un guardia', r: 2, lines: GUARD_LINES },
    smith:   { ch: 'H', color: '#ff9040', name: 'el herrero', r: 1 },
    armorer: { ch: 'A', color: '#c8c8e0', name: 'el armero', r: 1 },
    healer:  { ch: 'C', color: '#60e8d8', name: 'la curandera', r: 1 },
    peasant: { ch: 'p', color: '#d8b890', name: 'un aldeano', r: 7, lines: PEASANT_LINES },
  };
  const d = defs[role];
  return { kind: 'npc', role, ch: d.ch, color: hexRgb(d.color), name: d.name, lines: d.lines,
           x, y, home: { x, y, r: d.r }, ...extra };
}

function generateWorld(seed) {
  const W = 256, H = 160;
  const rng = new RNG(seed);
  const tiles = new Uint8Array(W * H);
  const safe = new Uint8Array(W * H);
  const idx = (x, y) => y * W + x;
  const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const get = (x, y) => (inb(x, y) ? tiles[idx(x, y)] : T.DEEP);
  const set = (x, y, t) => { if (inb(x, y)) tiles[idx(x, y)] = t; };

  // --- Terreno base: elevación + humedad ---
  const nE = makeNoise(rng), nM = makeNoise(rng);
  const elev = new Float32Array(W * H), moist = new Float32Array(W * H);
  let eMin = 1e9, eMax = -1e9, mMin = 1e9, mMax = -1e9;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const nx = x / (W - 1) * 2 - 1, ny = y / (H - 1) * 2 - 1;
    const edge = Math.max(Math.abs(nx), Math.abs(ny));
    const e = fbm(nE, x / 44, y / 44, 6) - Math.pow(edge, 4) * 0.35;
    const m = fbm(nM, x / 30, y / 30, 5);
    elev[idx(x, y)] = e; moist[idx(x, y)] = m;
    eMin = Math.min(eMin, e); eMax = Math.max(eMax, e);
    mMin = Math.min(mMin, m); mMax = Math.max(mMax, m);
  }
  for (let i = 0; i < W * H; i++) {
    const e = (elev[i] - eMin) / (eMax - eMin);
    const m = (moist[i] - mMin) / (mMax - mMin);
    elev[i] = e;
    let t;
    if (e < 0.30) t = T.DEEP;
    else if (e < 0.35) t = T.WATER;
    else if (e < 0.38) t = T.SAND;
    else if (e > 0.90) t = T.SNOW;
    else if (e > 0.78) t = T.MOUNTAIN;
    else if (e > 0.69) t = m > 0.55 ? T.PINE : T.HILL;
    else if (m > 0.62) t = T.FOREST;
    else if (m > 0.50) t = rng.chance(0.03) ? T.FLOWERS : T.MEADOW;
    else t = rng.chance(0.008) ? T.FLOWERS : T.GRASS;
    tiles[i] = t;
  }

  // --- Ríos: bajan desde las montañas siguiendo la pendiente ---
  for (let r = 0; r < 6; r++) {
    let x, y, tries = 0;
    do { x = rng.int(10, W - 11); y = rng.int(10, H - 11); tries++; }
    while (tries < 500 && !(elev[idx(x, y)] > 0.68 && elev[idx(x, y)] < 0.80));
    if (tries >= 500) continue;
    for (let step = 0; step < 500; step++) {
      const cur = get(x, y);
      if (cur === T.DEEP || (cur === T.WATER && step > 0)) break;
      set(x, y, T.WATER);
      let best = null, bestE = elev[idx(x, y)] + 0.004;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!inb(nx, ny)) continue;
        const e = elev[idx(nx, ny)] + rng.next() * 0.01;
        if (e < bestE) { bestE = e; best = [nx, ny]; }
      }
      if (!best) { // fosa: forma un pequeño lago
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++)
          if (dx * dx + dy * dy <= 5) set(x + dx, y + dy, T.WATER);
        break;
      }
      [x, y] = best;
    }
  }

  const isOpenLand = t => t === T.GRASS || t === T.MEADOW || t === T.FLOWERS;
  const isBlocking = t => !TILE_DEFS[t].pass;
  const regions = [];
  const npcs = [];
  const markSafe = (x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inb(x, y)) safe[idx(x, y)] = 1;
  };

  // --- Castillo ---
  const CW = 27, CH = 15;
  let best = null, bestScore = 1e9;
  for (let i = 0; i < 400; i++) {
    const ox = rng.int(Math.floor(W * 0.3), Math.floor(W * 0.7) - CW);
    const oy = rng.int(Math.floor(H * 0.3), Math.floor(H * 0.7) - CH);
    let score = 0;
    for (let y = oy - 4; y < oy + CH + 4; y++) for (let x = ox - 4; x < ox + CW + 4; x++) {
      const t = get(x, y);
      if (t === T.DEEP || t === T.WATER) score += 3;
      else if (isBlocking(t)) score += 2;
      else if (!isOpenLand(t)) score += 0.3;
    }
    if (score < bestScore) { bestScore = score; best = [ox, oy]; }
  }
  const [ox, oy] = best;
  for (let y = oy - 3; y < oy + CH + 3; y++) for (let x = ox - 3; x < ox + CW + 3; x++) {
    const inside = x >= ox && y >= oy && x < ox + CW && y < oy + CH;
    if (inside) {
      const border = x === ox || y === oy || x === ox + CW - 1 || y === oy + CH - 1;
      set(x, y, border ? T.CWALL : T.CFLOOR);
    } else if (!isOpenLand(get(x, y))) set(x, y, T.GRASS);
  }
  for (const [tx, ty] of [[ox, oy], [ox + CW - 1, oy], [ox, oy + CH - 1], [ox + CW - 1, oy + CH - 1]])
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) set(tx + dx, ty + dy, T.CWALL);
  const gx = ox + Math.floor(CW / 2), gy = oy + CH - 1;
  set(gx, gy, T.GATE);
  // Torre del homenaje con el salón del trono
  const KW = 11, KH = 6, kx = ox + Math.floor((CW - KW) / 2), ky = oy + 2;
  for (let y = ky; y < ky + KH; y++) for (let x = kx; x < kx + KW; x++) {
    const border = x === kx || y === ky || x === kx + KW - 1 || y === ky + KH - 1;
    set(x, y, border ? T.CWALL : T.CFLOOR);
  }
  set(gx, ky + KH - 1, T.GATE);
  for (let y = ky + 2; y < gy; y++) if (get(gx, y) === T.CFLOOR) set(gx, y, T.CARPET);
  markSafe(ox - 1, oy - 1, ox + CW, oy + CH);
  const castle = { x: ox, y: oy, w: CW, h: CH, cx: gx, cy: oy + Math.floor(CH / 2), gate: { x: gx, y: gy } };
  regions.push({ x0: ox - 1, y0: oy - 1, x1: ox + CW, y1: oy + CH, name: 'Castillo de Valcorona' });

  npcs.push(makeNpc('king', gx, ky + 1));
  npcs.push(makeNpc('guard', gx - 2, ky + KH));
  npcs.push(makeNpc('guard', gx + 2, ky + KH));
  npcs.push(makeNpc('guard', gx - 1, gy - 1));
  npcs.push(makeNpc('guard', gx + 1, gy - 1));
  npcs.push(makeNpc('smith', ox + 3, oy + CH - 4));
  npcs.push(makeNpc('armorer', ox + CW - 4, oy + CH - 4));
  const start = { x: gx, y: ky + KH + 2 };

  // --- Aldeas ---
  const villages = [];
  const names = VILLAGE_NAMES.slice();
  for (let tries = 0; tries < 4000 && villages.length < 5; tries++) {
    const cx = rng.int(14, W - 15), cy = rng.int(10, H - 11);
    if (!isOpenLand(get(cx, cy))) continue;
    if (Math.hypot(cx - castle.cx, cy - castle.cy) < 38) continue;
    if (villages.some(v => Math.hypot(cx - v.x, cy - v.y) < 36)) continue;
    let bad = 0;
    for (let y = cy - 7; y <= cy + 7; y++) for (let x = cx - 10; x <= cx + 10; x++)
      if (isBlocking(get(x, y))) bad++;
    if (bad > 12) continue;

    const name = names.splice(rng.int(0, names.length - 1), 1)[0];
    const x0 = cx - 9, x1 = cx + 9, y0 = cy - 6, y1 = cy + 6;
    for (let y = y0 - 1; y <= y1 + 1; y++) for (let x = x0 - 1; x <= x1 + 1; x++)
      if (!isOpenLand(get(x, y)) && get(x, y) !== T.SAND) set(x, y, T.GRASS);
    for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 2; x <= cx + 2; x++) set(x, y, T.PLAZA);
    set(cx, cy, T.WELL);

    const houses = [];
    for (let h = 0; h < 60 && houses.length < 5; h++) {
      const hw = rng.int(5, 7), hh = rng.int(4, 5);
      const hx = rng.int(x0, x1 - hw + 1), hy = rng.int(y0, y1 - hh + 1);
      const overlaps = (ax0, ay0, ax1, ay1) => !(hx + hw + 1 <= ax0 || hx - 1 > ax1 || hy + hh + 1 <= ay0 || hy - 1 > ay1);
      if (overlaps(cx - 3, cy - 2, cx + 3, cy + 2)) continue;
      if (houses.some(o => overlaps(o.x, o.y, o.x + o.w - 1, o.y + o.h - 1))) continue;
      for (let y = hy; y < hy + hh; y++) for (let x = hx; x < hx + hw; x++) {
        const border = x === hx || y === hy || x === hx + hw - 1 || y === hy + hh - 1;
        set(x, y, border ? T.HWALL : T.HFLOOR);
      }
      const dx = hx + Math.floor(hw / 2);
      const dy = hy + hh / 2 < cy ? hy + hh - 1 : hy;
      set(dx, dy, T.DOOR);
      houses.push({ x: hx, y: hy, w: hw, h: hh });
    }
    if (houses.length) {
      const h0 = houses[0];
      npcs.push(makeNpc('healer', h0.x + Math.floor(h0.w / 2), h0.y + Math.floor(h0.h / 2)));
    }
    const nPeasants = rng.int(3, 5);
    for (let p = 0, t2 = 0; p < nPeasants && t2 < 200; t2++) {
      const x = rng.int(x0, x1), y = rng.int(y0, y1);
      const t = get(x, y);
      if (!(isOpenLand(t) || t === T.PLAZA) || npcs.some(n => n.x === x && n.y === y)) continue;
      const n = makeNpc('peasant', x, y, { village: name });
      n.home = { x: cx, y: cy, r: 8 };
      if (rng.chance(0.5)) n.name = 'una aldeana';
      npcs.push(n); p++;
    }
    markSafe(x0 - 1, y0 - 1, x1 + 1, y1 + 1);
    regions.push({ x0: x0 - 1, y0: y0 - 1, x1: x1 + 1, y1: y1 + 1, name: 'Aldea de ' + name });
    villages.push({ x: cx, y: cy, name });
  }

  // --- Guarida del dragón: en las montañas más lejanas ---
  let lair = null, lairD = 0;
  for (let i = 0; i < 6000; i++) {
    const x = rng.int(8, W - 9), y = rng.int(8, H - 9);
    const t = get(x, y);
    if (t !== T.MOUNTAIN && t !== T.SNOW) continue;
    const d = Math.hypot(x - castle.cx, y - castle.cy);
    if (d > lairD) { lairD = d; lair = { x, y }; }
  }
  if (!lair) lair = { x: castle.cx < W / 2 ? W - 20 : 20, y: castle.cy < H / 2 ? H - 15 : 15 };
  for (let dy = -5; dy <= 5; dy++) for (let dx = -6; dx <= 6; dx++) {
    const r = (dx * dx) / 36 + (dy * dy) / 25;
    if (r <= 1) set(lair.x + dx, lair.y + dy, rng.chance(0.08) ? T.BONES : T.CAVE);
    else if (r <= 1.6 && !isBlocking(get(lair.x + dx, lair.y + dy))) set(lair.x + dx, lair.y + dy, T.MOUNTAIN);
  }
  lair.guards = [[-3, -2], [3, -2], [-4, 2], [4, 2]].map(([dx, dy]) => ({ x: lair.x + dx, y: lair.y + dy }));
  regions.push({ x0: lair.x - 6, y0: lair.y - 5, x1: lair.x + 6, y1: lair.y + 5, name: 'Guarida del dragón' });

  // --- Caminos (Dijkstra con costes por terreno) ---
  const cost = t => {
    switch (t) {
      case T.ROAD: case T.BRIDGE: return 0.35;
      case T.DEEP: return 22; case T.WATER: return 6;
      case T.MOUNTAIN: return 7; case T.SNOW: return 12;
      case T.FOREST: case T.PINE: return 2.2; case T.HILL: return 1.6;
      case T.CWALL: case T.HWALL: case T.WELL: return Infinity;
      case T.HFLOOR: case T.CFLOOR: case T.CARPET: return 40;
      default: return 1;
    }
  };
  function road(sx, sy, tx, ty) {
    const dist = new Float64Array(W * H).fill(Infinity);
    const prev = new Int32Array(W * H).fill(-1);
    const heap = new MinHeap();
    dist[idx(sx, sy)] = 0; heap.push(0, idx(sx, sy));
    const target = idx(tx, ty);
    while (heap.size) {
      const [d, i] = heap.pop();
      if (d > dist[i]) continue;
      if (i === target) break;
      const x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!inb(nx, ny)) continue;
        const ni = idx(nx, ny);
        const nd = d + cost(tiles[ni]) + rng.next() * 0.05;
        if (nd < dist[ni]) { dist[ni] = nd; prev[ni] = i; heap.push(nd, ni); }
      }
    }
    for (let i = target; i !== -1; i = prev[i]) {
      const t = tiles[i];
      if (t === T.DEEP || t === T.WATER) tiles[i] = T.BRIDGE;
      else if ([T.GRASS, T.MEADOW, T.FLOWERS, T.FOREST, T.PINE, T.HILL, T.MOUNTAIN, T.SNOW, T.SAND].includes(t)) tiles[i] = T.ROAD;
    }
  }
  for (const v of villages) road(gx, gy + 1, v.x, v.y + 2);
  // Del lugar más cercano (aldea o castillo) hasta la guarida
  let from = { x: gx, y: gy + 1 }, fromD = Math.hypot(lair.x - gx, lair.y - gy);
  for (const v of villages) {
    const d = Math.hypot(lair.x - v.x, lair.y - v.y);
    if (d < fromD) { fromD = d; from = { x: v.x, y: v.y + 2 }; }
  }
  road(from.x, from.y, lair.x, lair.y + 4);

  // --- Objetos repartidos por el mundo ---
  const items = [];
  const freeCell = () => {
    for (let k = 0; k < 500; k++) {
      const x = rng.int(1, W - 2), y = rng.int(1, H - 2);
      if (TILE_DEFS[get(x, y)].pass && !safe[idx(x, y)] && !items.some(it => it.x === x && it.y === y)) return { x, y };
    }
    return null;
  };
  for (let i = 0; i < 45; i++) { const c = freeCell(); if (c) items.push({ ...c, kind: 'gold', amount: rng.int(3, 15) }); }
  for (let i = 0; i < 22; i++) { const c = freeCell(); if (c) items.push({ ...c, kind: 'potion' }); }
  items.push({ x: lair.x, y: lair.y - 3, kind: 'chest', amount: 250 });

  return {
    W, H, tiles, safe, castle, villages, lair, regions, npcs, items, start, seed,
    get, inb,
    passable(x, y) { return inb(x, y) && TILE_DEFS[tiles[idx(x, y)]].pass; },
    isSafe(x, y) { return inb(x, y) && safe[idx(x, y)] === 1; },
    regionAt(x, y) { return regions.find(r => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1); },
  };
}

class MinHeap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v;
    let i = k.length; k.push(key); v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      k[i] = k[p]; v[i] = v[p]; i = p;
    }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v;
    const top = [k[0], v[0]];
    const lk = k.pop(), lv = v.pop();
    if (k.length) {
      let i = 0;
      const n = k.length;
      while (true) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && k[c + 1] < k[c]) c++;
        if (k[c] >= lk) break;
        k[i] = k[c]; v[i] = v[c]; i = c;
      }
      k[i] = lk; v[i] = lv;
    }
    return top;
  }
}

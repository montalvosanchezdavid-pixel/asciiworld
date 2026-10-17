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
defTile('CFLOOR',   '.', '#7d7a74', '#18171a', true,  'salón de piedra');
defTile('GATE',     '+', '#e0a050', '#2a1b0c', true,  'portón');
defTile('CARPET',   '.', '#e04858', '#3a0c12', true,  'alfombra real');
defTile('HWALL',    '#', '#b8834a', '#2a1a0c', false, 'casa');
defTile('HFLOOR',   '.', '#8a6a48', '#1c130a', true,  'suelo de madera');
defTile('DOOR',     '+', '#e0a050', '#2a1b0c', true,  'puerta');
defTile('WELL',     'O', '#7fb0ff', '#1a1a22', false, 'pozo');
defTile('PLAZA',    ',', '#a89070', '#1e1912', true,  'calle empedrada');
defTile('CAVE',     '.', '#7b6a60', '#120d0b', true,  'guarida');
defTile('BONES',    '%', '#ddd6c0', '#120d0b', true,  'huesos');
// Huertos e interiores
defTile('FIELD',    '=', '#8a6038', '#1a120a', true,  'huerto');
defTile('FENCE',    '+', '#a07040', '#0d1d0a', false, 'valla');
defTile('BED',      'B', '#c04040', '#1c130a', false, 'cama', { furniture: true });
defTile('TABLE',    'T', '#a07040', '#1c130a', false, 'mesa', { furniture: true });
defTile('BARREL',   'o', '#906030', '#1c130a', false, 'barril', { furniture: true });
defTile('HEARTH',   '&', '#ff8030', '#1c130a', false, 'chimenea', { furniture: true });
defTile('SHELF',    '#', '#806040', '#1c130a', false, 'estantería', { furniture: true });
defTile('STAIRS_UP',   '>', '#c0a080', '#1c130a', true, 'escaleras (subir)');
defTile('STAIRS_DOWN', '<', '#c0a080', '#1c130a', true, 'escaleras (bajar)');
defTile('RUG',      '%', '#a03040', '#1c130a', true,  'alfombra');
defTile('WINDOW',   '#', '#90c0ff', '#2a1a0c', false, 'ventana');
defTile('TOWER',    '#', '#c4c4cf', '#2a2a33', false, 'torre');
defTile('LADDER',   'H', '#b08050', '#1a1208', true,  'escalera de mano');
defTile('CRYPT_DOWN', '>', '#c0b090', '#0a0806', true, 'entrada a las catacumbas');
defTile('CRYPT_UP',   '<', '#c0b090', '#0a0806', true, 'salida de las catacumbas');
defTile('CRYPTWALL',  '#', '#6a645c', '#141210', false, 'muro de las catacumbas');
defTile('CRYPTFLOOR', '.', '#5c544a', '#0c0a08', true,  'catacumbas');
defTile('SARCO',      '=', '#a09888', '#0c0a08', false, 'sarcófago', { furniture: true });
defTile('WEB',        '%', '#d8d8e0', '#0c0a08', true,  'telarañas');
defTile('ROCK',     'o', '#9a9890', '#1a1a18', false, 'roca');
defTile('GRAVE',    'n', '#a0a0a8', '#0d140c', false, 'tumba', { furniture: true });
defTile('CEMWALL',  '#', '#9a968c', '#0d140c', false, 'muro del cementerio');
defTile('HEDGE',    '%', '#3e8a3a', '#0d1d0a', false, 'seto');
defTile('FLOWERBED','*', '#e05070', '#1a120a', true,  'macizo de flores');
defTile('BASIN',    'o', '#b8b4aa', '#0d1d0a', false, 'fuente');
defTile('CAMPFIRE', '&', '#ff8030', '#0d1d0a', false, 'hoguera', { furniture: true });
defTile('LOG',      '=', '#906030', '#0d1d0a', false, 'tronco', { furniture: true });
defTile('LAKE',     '~', '#5a8fe6', '#0c2250', true,  'lago', { anim: true, water: true });
defTile('CAULDRON', 'U', '#506040', '#0d1d0a', false, 'caldero', { furniture: true });
defTile('ROOTS',    '~', '#6a4a2a', '#0d1d0a', false, 'raíces');
defTile('RAIL',     '=', '#909098', '#0c0a08', true,  'vía del tren');
defTile('WALLSTAIRS', '=', '#b0b0b8', '#2a2a33', true, 'escalinata de la muralla');
defTile('STALL',    'M', '#d06040', '#1e1912', false, 'puesto del mercado');

const VILLAGE_NAMES = ['Robledo', 'Valdeoro', 'Piedrahita', 'Fuentecilla', 'Montebajo', 'Villaverde', 'Peñaroja', 'Aguasclaras', 'Torremolino', 'Castrillo', 'Hontanar', 'Fresneda', 'Navalosa', 'Ribalta', 'Cerezal'];

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
  'Las patatas de los huertos quitan el hambre. Coged las que estén maduras.',
  'En la posada sirven un estofado que resucita a un muerto.',
  'Si os quedáis sin comida, la vida se os irá escapando poco a poco.',
];
const GUARD_LINES = [
  '¡Larga vida al rey!',
  'Su Majestad os espera en el salón del trono.',
  'Las puertas del castillo siempre están abiertas para vos.',
  'Dentro de las murallas no os atacará ningún monstruo.',
];

function makeNpc(role, x, y, extra = {}) {
  const defs = {
    king:       { name: 'el rey Alfonso', r: 0 },
    guard:      { name: 'un guardia', r: 2, lines: GUARD_LINES },
    smith:      { name: 'el herrero', r: 1 },
    armorer:    { name: 'el armero', r: 1 },
    healer:     { name: 'la curandera', r: 1 },
    farmer:     { name: 'el granjero', r: 5 },
    innkeeper:  { name: 'el posadero', r: 2 },
    peasant:    { name: 'un aldeano', r: 7, lines: PEASANT_LINES },
    witch:      { name: 'la bruja Morgana', r: 1 },
  };
  const d = defs[role];
  return { kind: 'npc', role, name: d.name, lines: d.lines, x, y, home: { x, y, r: d.r }, floor: 0, ...extra };
}

function generateWorld(seed) {
  const W = 600, H = 380;
  const rng = new RNG(seed);
  const tiles = new Uint8Array(W * H);
  const safe = new Uint8Array(W * H);
  const bldGrid = new Int16Array(W * H).fill(-1);
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
    const e = fbm(nE, x / 80, y / 80, 6) - Math.pow(edge, 4) * 0.35;
    const m = fbm(nM, x / 45, y / 45, 5);
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

  // --- Ríos: bajan desde las montañas con meandros, anchura variable, recovecos y rocas ---
  const nMe = makeNoise(rng), nRoad = makeNoise(rng);
  const rocks = [], riverTiles = new Set();
  for (let r = 0; r < 22; r++) {
    let x, y, tries = 0;
    do { x = rng.int(10, W - 11); y = rng.int(10, H - 11); tries++; }
    while (tries < 500 && !(elev[idx(x, y)] > 0.68 && elev[idx(x, y)] < 0.80));
    if (tries >= 500) continue;
    const mine = new Set();
    const paint = (cx, cy, rad) => {
      for (let dy = -Math.ceil(rad); dy <= Math.ceil(rad); dy++) for (let dx = -Math.ceil(rad); dx <= Math.ceil(rad); dx++) {
        if (dx * dx + dy * dy > rad * rad + 0.25 || !inb(cx + dx, cy + dy)) continue;
        if (get(cx + dx, cy + dy) !== T.DEEP) { set(cx + dx, cy + dy, T.WATER); mine.add(idx(cx + dx, cy + dy)); }
      }
    };
    for (let step = 0; step < 1500; step++) {
      const cur = get(x, y);
      if (cur === T.DEEP || (cur === T.WATER && step > 0 && !mine.has(idx(x, y)))) break;
      const width = 0.2 + nMe(x * 0.05 + 50, y * 0.05) * 1.7;      // de 1 a 3 casillas de ancho
      paint(x, y, width);
      if (rng.chance(0.035)) {                                     // recoveco o poza a un lado
        const side = rng.chance(0.5) ? 1 : -1, len = rng.int(2, 3);
        paint(x + side * len * (rng.chance(0.5) ? 1 : 0), y + side * len, 1.1 + rng.next());
      }
      if (rng.chance(0.13)) rocks.push({ x: x + rng.next(), y: y + rng.next(), inWater: true });
      let best = null, bestE = elev[idx(x, y)] + 0.006;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!inb(nx, ny) || (mine.has(idx(nx, ny)) && get(nx, ny) === T.WATER && step > 2 && rng.chance(0.7))) continue;
        const e = elev[idx(nx, ny)] + nMe(nx * 0.12, ny * 0.12) * 0.03 + rng.next() * 0.006;   // meandros
        if (e < bestE) { bestE = e; best = [nx, ny]; }
      }
      if (!best) { paint(x, y, 2.3); break; }
      [x, y] = best;
    }
    for (const i of mine) riverTiles.add(i);
  }
  // Rocas sueltas por bosques y colinas
  for (let ty = 2; ty < H - 2; ty++) for (let tx = 2; tx < W - 2; tx++) {
    const t = get(tx, ty);
    const p = t === T.FOREST || t === T.PINE ? 0.035 : t === T.HILL ? 0.05 : (t === T.GRASS || t === T.MEADOW) ? 0.004 : 0;
    if (p && rng.chance(p)) rocks.push({ x: tx + rng.next(), y: ty + rng.next(), inWater: false });
  }

  const isOpenLand = t => t === T.GRASS || t === T.MEADOW || t === T.FLOWERS;
  const isBlocking = t => !TILE_DEFS[t].pass;
  const regions = [];
  const npcs = [];
  const items = [];
  const buildings = [];
  const crops = [];
  const lamps = [];
  const markSafe = (x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inb(x, y)) safe[idx(x, y)] = 1;
  };
  const disk = (cx, cy, r, t) => {
    for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++)
      if (dx * dx + dy * dy <= r * r) set(cx + dx, cy + dy, t);
  };
  const fillRect = (x0, y0, w, h, t) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, t); };

  // ------------------------------------------------------------ Edificios con interior y pisos
  // Planta baja en el mapa; plantas superiores en su propio plano (b.upper).
  function makeBuilding(x0, y0, w, h, doorSide, o = {}) {
    const wall = o.wall ?? T.HWALL, floorT = o.floorT ?? T.HFLOOR;
    const id = buildings.length;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const border = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1;
      const corner = (x === x0 || x === x0 + w - 1) && (y === y0 || y === y0 + h - 1);
      const front = y === y0 + h - 1;
      set(x, y, border ? (!corner && !front && wall === T.HWALL && rng.chance(0.22) ? T.WINDOW : wall) : floorT);
      bldGrid[idx(x, y)] = id;
    }
    const dx = o.doorX ?? x0 + Math.floor(w / 2);
    const dy = doorSide === 'down' ? y0 + h - 1 : y0;
    set(dx, dy, o.doorT ?? T.DOOR);
    const inside = { x: dx, y: doorSide === 'down' ? dy - 1 : dy + 1 };
    const outside = { x: dx, y: doorSide === 'down' ? dy + 1 : dy - 1 };
    const b = { id, x: x0, y: y0, w, h, door: { x: dx, y: dy }, outside, floors: o.floors || 1,
                roof: o.roof || 'red', name: o.name || 'Casa', upper: null, stairs: null, hearth: null, chimney: null,
                style: o.style || (o.roof === 'slate' ? 'stone' : o.roof === 'thatch' ? 'thatch' : 'plaster') };
    const keepFree = new Set([idx(inside.x, inside.y), idx(dx, dy)]);
    const applyPartitions = (s2, free) => {
      for (const pt of o.partitions || []) {
        for (let y = pt.y0; y <= pt.y1; y++) for (let x = pt.x0; x <= pt.x1; x++) {
          if (pt.gaps.some(([gx2, gy2]) => gx2 === x && gy2 === y)) {
            for (const [ax, ay] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) free.add(idx(x + ax, y + ay));
            continue;
          }
          s2(x, y, wall);
        }
      }
    };
    applyPartitions(set, keepFree);
    // Escaleras
    if (b.floors > 1) {
      const sx = o.stairs ? o.stairs.x : (dx > x0 + w / 2 ? x0 + 1 : x0 + w - 2);
      const sy = o.stairs ? o.stairs.y : (doorSide === 'down' ? y0 + 1 : y0 + h - 2);
      set(sx, sy, T.STAIRS_UP);
      b.stairs = { x: sx, y: sy };
      keepFree.add(idx(sx, sy));
      for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) keepFree.add(idx(sx + ax, sy + ay));
    }
    if (!o.custom) {
      // Chimenea en la pared opuesta a la puerta
      const hy = doorSide === 'down' ? y0 + 1 : y0 + h - 2;
      const hx = rng.chance(0.5) ? x0 + 1 + rng.int(0, 1) : x0 + w - 2 - rng.int(0, 1);
      if (!keepFree.has(idx(hx, hy))) { set(hx, hy, T.HEARTH); b.hearth = { x: hx, y: hy }; b.chimney = { x: hx, y: doorSide === 'down' ? y0 : y0 + h - 1 }; }
      furnish(b, keepFree, [T.TABLE, T.BARREL, T.BED, T.SHELF, T.BARREL], Math.ceil((w - 2) * (h - 2) / 7), get, set);
      if ((w - 2) * (h - 2) > 16 && rng.chance(0.6)) {
        const rx = x0 + Math.floor(w / 2), ry = y0 + Math.floor(h / 2);
        if (get(rx, ry) === floorT && !keepFree.has(idx(rx, ry))) set(rx, ry, T.RUG);
      }
    }
    // Planta superior
    if (b.floors > 1) {
      const up = new Uint8Array(w * h);
      const ug = (x, y) => (x < x0 || y < y0 || x >= x0 + w || y >= y0 + h) ? T.HWALL : up[(y - y0) * w + (x - x0)];
      const us = (x, y, t) => { if (x >= x0 && y >= y0 && x < x0 + w && y < y0 + h) up[(y - y0) * w + (x - x0)] = t; };
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
        const border = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1;
        const corner = (x === x0 || x === x0 + w - 1) && (y === y0 || y === y0 + h - 1);
        us(x, y, border ? (!corner && rng.chance(0.18) ? T.WINDOW : wall) : (o.upperFloor ?? T.HFLOOR));
      }
      us(b.stairs.x, b.stairs.y, T.STAIRS_DOWN);
      const free2 = new Set([b.stairs.x + b.stairs.y * W]);
      applyPartitions(us, free2);
      for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) free2.add(idx(b.stairs.x + ax, b.stairs.y + ay));
      furnish(b, free2, o.upperFurniture || [T.BED, T.BED, T.SHELF, T.TABLE, T.BARREL], Math.ceil((w - 2) * (h - 2) / 6), ug, us);
      b.upper = up;
      // Cofres con botín arriba
      const nChests = o.chests ?? rng.int(1, 2);
      for (let k = 0; k < nChests; k++) {
        for (let t = 0; t < 40; t++) {
          const x = rng.int(x0 + 1, x0 + w - 2), y = rng.int(y0 + 1, y0 + h - 2);
          if (ug(x, y) !== (o.upperFloor ?? T.HFLOOR) || free2.has(idx(x, y)) || items.some(it => it.x === x && it.y === y)) continue;
          const r = rng.next();
          items.push(r < 0.5 ? { x, y, kind: 'chest', amount: o.loot || rng.int(15, 60), floor: 1, bld: id }
            : r < 0.75 ? { x, y, kind: 'potion', floor: 1, bld: id } : { x, y, kind: 'seeds', amount: rng.int(2, 4), floor: 1, bld: id });
          break;
        }
      }
    }
    buildings.push(b);
    return b;
  }

  // Coloca muebles pegados a las paredes sin bloquear el paso (comprueba conectividad)
  function furnish(b, keepFree, types, n, g, s) {
    const { x: x0, y: y0, w, h } = b;
    const floorT = g(x0 + Math.floor(w / 2), y0 + Math.floor(h / 2));
    const walkable = t => TILE_DEFS[t].pass;
    const connected = () => {
      let start = null, total = 0;
      for (let y = y0 + 1; y < y0 + h - 1; y++) for (let x = x0 + 1; x < x0 + w - 1; x++)
        if (walkable(g(x, y))) { total++; if (!start) start = [x, y]; }
      if (!start) return false;
      const seen = new Set([start[0] + ',' + start[1]]), q = [start];
      while (q.length) {
        const [x, y] = q.pop();
        for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + ax, ny = y + ay, k = nx + ',' + ny;
          if (nx <= x0 || ny <= y0 || nx >= x0 + w - 1 || ny >= y0 + h - 1 || seen.has(k) || !walkable(g(nx, ny))) continue;
          seen.add(k); q.push([nx, ny]);
        }
      }
      return seen.size === total;
    };
    n = Math.min(n, 22);
    const isWallT = t => t === T.HWALL || t === T.CWALL || t === T.WINDOW || t === T.TOWER;
    for (let k = 0, tries = 0; k < n && tries < n * 12; tries++) {
      const x = rng.int(x0 + 1, x0 + w - 2), y = rng.int(y0 + 1, y0 + h - 2);
      const nearWall = isWallT(g(x + 1, y)) || isWallT(g(x - 1, y)) || isWallT(g(x, y + 1)) || isWallT(g(x, y - 1));
      if (!nearWall || keepFree.has(idx(x, y)) || g(x, y) !== floorT) continue;
      const prev = g(x, y);
      s(x, y, types[k % types.length]);
      if (!connected()) { s(x, y, prev); continue; }
      k++;
    }
  }

  // Huerto vallado con patatas
  function makeFarm(x0, y0, w, h) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const border = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1;
      if (border) set(x, y, T.FENCE);
      else {
        set(x, y, T.FIELD);
        const r = rng.next();
        crops.push({ x, y, stage: r < 0.45 ? 3 : r < 0.65 ? 2 : r < 0.8 ? 1 : -1 });
      }
    }
    const gxp = x0 + Math.floor(w / 2);
    set(gxp, y0 + h - 1, T.GRASS); set(gxp, y0, T.GRASS);
    return { x: gxp, y: y0 + h };
  }

  // Casas repartidas por una zona sin pisar calles ni otras construcciones
  function placeHouses(zone, n, avoid, opts) {
    const houses = [];
    for (let t = 0; t < (opts.tries || 400) && houses.length < n; t++) {
      const hw = rng.int(opts.minW, opts.maxW), hh = rng.int(opts.minH, opts.maxH);
      const hx = rng.int(zone.x0, zone.x1 - hw), hy = rng.int(zone.y0, zone.y1 - hh);
      const hit = r => !(hx + hw + 1 <= r.x0 || hx - 1 > r.x1 || hy + hh + 1 <= r.y0 || hy - 1 > r.y1);
      if (avoid.some(hit)) continue;
      let bad = false;
      const m1 = opts.tight ? 0 : 1;
      for (let y = hy - m1; y < hy + hh + m1 && !bad; y++) for (let x = hx - m1; x < hx + hw + m1 && !bad; x++) {
        const tt = get(x, y);
        if (tt === T.PLAZA || tt === T.WELL || tt === T.FENCE || tt === T.FIELD || isBlocking(tt) || bldGrid[idx(x, y)] >= 0) bad = true;
      }
      if (bad) continue;
      const door = 'down';
      const b = makeBuilding(hx, hy, hw, hh, door, { floors: rng.chance(opts.twoFloors) ? 2 : 1, roof: opts.roof, style: opts.style });
      houses.push(b);
      avoid.push({ x0: hx, y0: hy, x1: hx + hw - 1, y1: hy + hh - 1 });
      set(b.outside.x, b.outside.y, T.PLAZA);
    }
    return houses;
  }

  // Habitante dentro de un edificio (en una casilla libre del interior)
  function npcInside(role, b, extra = {}) {
    for (let t = 0; t < 80; t++) {
      const x = rng.int(b.x + 1, b.x + b.w - 2), y = rng.int(b.y + 1, b.y + b.h - 2);
      if (!TILE_DEFS[get(x, y)].pass || (b.stairs && x === b.stairs.x && y === b.stairs.y)) continue;
      if (x === b.door.x) continue;
      const n = makeNpc(role, x, y, extra);
      n.home.r = Math.min(n.home.r, 1);
      npcs.push(n);
      return n;
    }
    return null;
  }

  // ------------------------------------------------------------ Castillo + Villa Real
  const CW = 88, CH = 58, MOAT = 4, TOWN_W = 76, TOWN_H = 42, TOWN_GAP = 12;
  const totalH = CH + TOWN_GAP + TOWN_H;
  let best = null, bestScore = 1e9;
  for (let i = 0; i < 500; i++) {
    const ox = rng.int(Math.floor(W * 0.15), Math.floor(W * 0.85) - CW);
    const oy = rng.int(Math.floor(H * 0.1), Math.floor(H * 0.92) - totalH);
    let score = 0;
    for (let y = oy - 8; y < oy + totalH + 4; y += 2) for (let x = ox - 8; x < ox + CW + 8; x += 2) {
      const t = get(x, y);
      if (t === T.DEEP || t === T.WATER) score += 3;
      else if (isBlocking(t)) score += 2;
      else if (!isOpenLand(t)) score += 0.3;
    }
    if (score < bestScore) { bestScore = score; best = [ox, oy]; }
  }
  const [ox, oy] = best;
  const gx = ox + Math.floor(CW / 2), gy = oy + CH - 1;
  const rectWall = (x0, y0, w, h, wall, thick) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++)
      if (x < x0 + thick || y < y0 + thick || x >= x0 + w - thick || y >= y0 + h - thick) set(x, y, wall);
  };
  // Alrededores: pradera y foso
  for (let y = oy - MOAT - 6; y < oy + CH + MOAT + 3; y++) for (let x = ox - MOAT - 6; x < ox + CW + MOAT + 6; x++) {
    const d = Math.max(ox - x, x - (ox + CW - 1), oy - y, y - (oy + CH - 1));
    if (d >= 4 && d <= 4 + MOAT - 2) set(x, y, T.WATER);
    else if (d > 0 && !isOpenLand(get(x, y))) set(x, y, T.GRASS);
  }
  for (let y = oy; y < oy + CH; y++) for (let x = ox; x < ox + CW; x++) set(x, y, rng.chance(0.04) ? T.FLOWERS : T.GRASS);
  rectWall(ox, oy, CW, CH, T.CWALL, 3);
  // contrafuertes que rompen la línea recta de la muralla
  for (let x = ox + 7; x < ox + CW - 7; x += 9) {
    if (Math.abs(x - gx) < 9) continue;
    for (const dx of [0, 1]) { set(x + dx, oy - 1, T.CWALL); set(x + dx, oy + CH, T.CWALL); }
  }
  for (let y = oy + 6; y < oy + CH - 6; y += 8) { set(ox - 1, y, T.CWALL); set(ox + CW, y, T.CWALL); }
  for (const [tx, ty] of [[ox + 1, oy + 1], [ox + CW - 2, oy + 1], [ox + 1, oy + CH - 2], [ox + CW - 2, oy + CH - 2],
                          [ox + 1, oy + Math.floor(CH / 3)], [ox + CW - 2, oy + Math.floor(CH / 3)],
                          [ox + 1, oy + Math.floor(CH * 2 / 3)], [ox + CW - 2, oy + Math.floor(CH * 2 / 3)],
                          [ox + Math.floor(CW / 4), oy + 1], [ox + CW - 1 - Math.floor(CW / 4), oy + 1],
                          [ox + Math.floor(CW / 4), oy + CH - 2], [ox + CW - 1 - Math.floor(CW / 4), oy + CH - 2]])
    disk(tx, ty, 3.6, T.TOWER);
  disk(gx - 4, gy, 3, T.TOWER); disk(gx + 4, gy, 3, T.TOWER);
  for (let y = gy - 2; y <= gy + 1; y++) for (let x = gx - 1; x <= gx + 1; x++) set(x, y, T.GATE);
  for (let y = gy + 2; y <= gy + 9; y++) for (let x = gx - 1; x <= gx + 1; x++) set(x, y, get(x, y) === T.WATER ? T.BRIDGE : T.PLAZA);
  // Avenidas
  for (let y = oy + 3; y < gy - 2; y++) for (let x = gx - 1; x <= gx + 1; x++) set(x, y, T.PLAZA);
  const midY = oy + 35;
  for (let x = ox + 3; x < ox + CW - 3; x++) for (let y = midY - 1; y <= midY + 1; y++) if (get(x, y) !== T.CWALL && get(x, y) !== T.TOWER) set(x, y, T.PLAZA);

  // Palacio real: dos plantas con alas, salón del trono, comedor, cocina, biblioteca y sala de guardia
  const KW = 45, KH = 23, kx = gx - Math.floor(KW / 2), ky = oy + 5;
  const wX = kx + 13, eX = kx + KW - 14, hY = ky + 11;
  const partitions = [
    { x0: wX, y0: ky + 1, x1: wX, y1: ky + KH - 2, gaps: [[wX, ky + 6], [wX, ky + 16]] },
    { x0: eX, y0: ky + 1, x1: eX, y1: ky + KH - 2, gaps: [[eX, ky + 6], [eX, ky + 16]] },
    { x0: kx + 1, y0: hY, x1: wX - 1, y1: hY, gaps: [[kx + 6, hY]] },
    { x0: eX + 1, y0: hY, x1: kx + KW - 2, y1: hY, gaps: [[kx + KW - 7, hY]] },
  ];
  const keep = makeBuilding(kx, ky, KW, KH, 'down', {
    wall: T.CWALL, floorT: T.CFLOOR, doorT: T.GATE, roof: 'slate', floors: 2, custom: true, name: 'Palacio real',
    stairs: { x: kx + 2, y: ky + 2 }, partitions, upperFurniture: [T.BED, T.SHELF, T.TABLE, T.RUG, T.SHELF, T.BARREL],
    chests: 5, loot: 150,
  });
  for (let x = gx - 1; x <= gx + 1; x++) set(x, ky + KH - 1, T.GATE);
  // Salón del trono: alfombra y columnas
  for (let y = ky + 2; y < ky + KH - 1; y++) for (let x = gx - 1; x <= gx + 1; x++) set(x, y, T.CARPET);
  for (let y = ky + 3; y < ky + KH - 2; y += 3) { set(gx - 6, y, T.CWALL); set(gx + 6, y, T.CWALL); }
  // Comedor (noroeste): mesa larga y chimenea
  for (let x = kx + 4; x <= kx + 9; x++) set(x, ky + 5, T.TABLE);
  set(kx + 8, ky + 1, T.HEARTH);
  keep.hearth = { x: kx + 8, y: ky + 1 }; keep.chimney = { x: kx + 8, y: ky };
  // Cocina (suroeste): fogón y barriles
  set(kx + 5, ky + KH - 2, T.HEARTH);
  for (const y of [ky + 13, ky + 14]) set(kx + 1, y, T.BARREL);
  set(kx + 10, ky + 13, T.BARREL); set(kx + 7, ky + 17, T.TABLE);
  // Biblioteca (noreste): estanterías y mesa de lectura
  for (let x = eX + 2; x <= kx + KW - 3; x += 2) set(x, ky + 1, T.SHELF);
  set(eX + 6, ky + 5, T.TABLE); set(eX + 6, ky + 7, T.RUG);
  // Sala de guardia (sureste): camas
  for (const y of [ky + 13, ky + 15, ky + 17, ky + 19]) set(kx + KW - 2, y, T.BED);
  set(eX + 4, ky + 18, T.TABLE);
  for (const [tx, ty] of [[kx, ky], [kx + KW - 1, ky], [kx, ky + KH - 1], [kx + KW - 1, ky + KH - 1]]) disk(tx, ty, 2.0, T.TOWER);
  for (let y = ky; y < ky + KH; y++) for (let x = kx; x < kx + KW; x++) bldGrid[idx(x, y)] = keep.id;

  // Edificios del patio
  const smithy = makeBuilding(ox + 6, midY + 4, 14, 9, 'down', { roof: 'slate', name: 'Herrería' });
  const armory = makeBuilding(ox + CW - 20, midY + 4, 14, 9, 'down', { roof: 'slate', name: 'Armería' });
  makeBuilding(ox + 5, oy + 7, 13, 11, 'down', { roof: 'slate', floors: 2, name: 'Cuartel' });
  makeBuilding(ox + CW - 18, oy + 7, 13, 11, 'down', { roof: 'slate', name: 'Capilla' });
  // Huerto del castillo, jardines y pozo
  makeFarm(gx + 7, oy + CH - 9, 14, 5);
  for (const [jx, jy] of [[ox + 10, midY - 5], [ox + CW - 11, midY - 5], [gx - 14, gy - 7], [ox + 30, midY + 10], [ox + CW - 31, midY + 10]]) disk(jx, jy, 2.2, T.FOREST);
  set(gx - 8, midY, T.WELL);
  markSafe(ox - MOAT - 3, oy - MOAT - 3, ox + CW + MOAT + 2, oy + CH + MOAT + 2);
  regions.push({ x0: ox - 6, y0: oy - 6, x1: ox + CW + 5, y1: oy + CH + 5, name: 'Castillo de Valcorona' });
  lamps.push(...[[gx - 2, gy + 2], [gx + 2, gy + 2], [gx - 2, gy - 3], [gx + 2, gy - 3],
    [gx - 3, ky + KH], [gx + 3, ky + KH], [gx - 3, ky + 2], [gx + 3, ky + 2], [gx - 4, ky + 10], [gx + 4, ky + 10],
    [kx + 6, ky + 8], [kx + KW - 7, ky + 8], [kx + 6, ky + 18], [kx + KW - 7, ky + 18],
    [smithy.outside.x + 2, smithy.outside.y], [armory.outside.x - 2, armory.outside.y],
    ...[ox + 8, ox + 22, ox + CW - 23, ox + CW - 9].map(x => [x, midY - 2]),
    ...[oy + 30, oy + 40, oy + 47, oy + 53].flatMap(y => [[gx - 2, y], [gx + 2, y]])]);
  const castle = { x: ox, y: oy, w: CW, h: CH, cx: gx, cy: oy + Math.floor(CH / 2), gate: { x: gx, y: gy + 9 } };

  npcs.push(makeNpc('king', gx, ky + 2));
  for (const [x, y] of [[gx - 3, ky + KH], [gx + 3, ky + KH], [gx - 3, gy - 3], [gx + 3, gy - 3], [gx - 3, midY - 2], [gx + 3, midY + 2],
                        [gx - 4, ky + 4], [gx + 4, ky + 4], [gx - 4, ky + 14], [gx + 4, ky + 14]])
    npcs.push(makeNpc('guard', x, y));
  npcs.push(makeNpc('smith', smithy.outside.x + 2, smithy.outside.y));
  npcs.push(makeNpc('armorer', armory.outside.x - 2, armory.outside.y));
  for (let i = 0; i < 5; i++) {
    const n = makeNpc('peasant', gx + rng.int(-20, 20), midY, { village: 'Valcorona' });
    n.home = { x: gx, y: midY, r: 18 };
    if (rng.chance(0.5)) n.name = 'una aldeana';
    npcs.push(n);
  }
  const wallStairs = [];
  for (const sx of [kx - 3, kx + KW + 1]) {
    for (let y = oy + 3; y <= oy + 4; y++) set(sx, y, T.WALLSTAIRS);
    wallStairs.push({ x: sx, top: oy + 3, bottom: oy + 4, wallY: oy + 2 });
    items.push({ x: sx + 1, y: oy + 1, kind: 'bow', onWall: true });
    lamps.push([sx + 1, oy + 4]);
  }
  for (const ax of [ox + 14, ox + 40, ox + CW - 41, ox + CW - 15]) {
    const n = makeNpc('guard', ax, oy + 1, { onWall: true });
    n.name = 'un arquero'; n.home.r = 0; n.lines = ['Desde aquí arriba se ve venir a los goblins.', 'Coged un arco del soporte y probad las flechas de fuego.', 'Apuntad con el ratón y haced clic para disparar.'];
    npcs.push(n);
  }
  const start = { x: gx, y: ky + KH + 3 };

  // Villa Real: la ciudad al pie del castillo
  const tx0 = gx - Math.floor(TOWN_W / 2), ty0 = gy + TOWN_GAP;
  for (let y = ty0 - 2; y < ty0 + TOWN_H + 2; y++) for (let x = tx0 - 2; x < tx0 + TOWN_W + 2; x++)
    if (!isOpenLand(get(x, y))) set(x, y, T.GRASS);
  for (let y = gy + 10; y < ty0 + TOWN_H + 2; y++) for (let x = gx - 1; x <= gx + 1; x++) set(x, y, T.PLAZA);
  const streetY = ty0 + 20;
  for (let x = tx0; x < tx0 + TOWN_W; x++) for (let y = streetY - 1; y <= streetY + 1; y++) set(x, y, T.PLAZA);
  const plaza = { x0: gx - 10, y0: streetY - 5, x1: gx + 10, y1: streetY + 5 };
  fillRect(plaza.x0, plaza.y0, plaza.x1 - plaza.x0 + 1, plaza.y1 - plaza.y0 + 1, T.PLAZA);
  set(gx - 5, streetY, T.WELL);
  for (const [x, y] of [[gx - 8, streetY - 4], [gx - 4, streetY - 4], [gx + 4, streetY - 4], [gx + 8, streetY - 4],
                        [gx - 8, streetY + 4], [gx + 8, streetY + 4]]) set(x, y, T.STALL);
  const inn = makeBuilding(gx + 3, ty0 + 3, 17, 10, 'down', { floors: 2, roof: 'red', name: 'Posada del Dragón Dormido', chests: 2 });
  set(inn.outside.x, inn.outside.y, T.PLAZA);
  const farms = [makeFarm(tx0 + 1, ty0 + 31, 16, 8), makeFarm(tx0 + TOWN_W - 17, ty0 + 31, 16, 8),
                 makeFarm(tx0 + 1, ty0 + 2, 13, 7)];
  const avoid = [plaza, { x0: gx - 2, y0: ty0, x1: gx + 2, y1: ty0 + TOWN_H },
                 { x0: inn.x, y0: inn.y, x1: inn.x + inn.w, y1: inn.y + inn.h + 1 },
                 { x0: tx0, y0: streetY - 2, x1: tx0 + TOWN_W, y1: streetY + 2 },
                 { x0: gx + 3, y0: ty0 + 29, x1: gx + 20, y1: ty0 + TOWN_H }];   // sitio de la caballeriza
  const townHouses = placeHouses({ x0: tx0 + 1, y0: ty0 + 1, x1: tx0 + TOWN_W - 1, y1: ty0 + TOWN_H - 1 }, 16, avoid,
    { minW: 9, maxW: 13, minH: 7, maxH: 9, streetY, twoFloors: 0.4, roof: 'red' });
  for (const hb of townHouses) if (hb.floors > 1 && rng.chance(0.5)) { hb.style = 'fachwerk'; hb.roof = 'brown'; }
  npcs.push(makeNpc('farmer', farms[0].x + 1, farms[0].y));
  npcInside('innkeeper', inn);
  const traveler = makeNpc('peasant', inn.x + inn.w - 3, inn.y + inn.h - 3, { village: 'la posada', floor: 1, bld: inn.id });
  traveler.name = 'un viajero'; traveler.home.r = 0;
  npcs.push(traveler);
  if (townHouses.length) npcInside('healer', townHouses[0]);
  for (let i = 0; i < 10; i++) {
    const n = makeNpc('peasant', gx + rng.int(-8, 8), streetY + rng.int(-3, 3), { village: 'Villa Real' });
    n.home = { x: gx, y: streetY, r: 26 };
    if (rng.chance(0.5)) n.name = 'una aldeana';
    npcs.push(n);
  }
  for (let x = tx0 + 4; x < tx0 + TOWN_W; x += 10) lamps.push([x, streetY - 2], [x, streetY + 2]);
  for (let y = ty0 + 2; y < ty0 + TOWN_H; y += 7) lamps.push([gx - 2, y], [gx + 2, y]);
  markSafe(tx0 - 2, ty0 - 2, tx0 + TOWN_W + 1, ty0 + TOWN_H + 1);
  markSafe(Math.min(ox - MOAT - 3, tx0 - 2) - 6, oy - MOAT - 9, Math.max(ox + CW + MOAT + 2, tx0 + TOWN_W + 1) + 6, ty0 + TOWN_H + 8);
  regions.push({ x0: tx0 - 2, y0: ty0 - 2, x1: tx0 + TOWN_W + 1, y1: ty0 + TOWN_H + 1, name: 'Villa Real' });
  const townGate = { x: gx, y: ty0 + TOWN_H + 2 };

  // ------------------------------------------------------------ Torres de arqueros, molinos y catacumbas
  const watchtowers = [], cryptEntrances = [];
  function makeWatchtower(tx, ty) {
    for (let y = ty; y < ty + 3; y++) for (let x = tx; x < tx + 3; x++) if (!TILE_DEFS[get(x, y)].pass || bldGrid[idx(x, y)] >= 0) set(x, y, T.GRASS);
    set(tx + 1, ty + 3, T.LADDER);
    watchtowers.push({ x: tx, y: ty, w: 3, h: 3, ph: 14, ladder: { x: tx + 1, y: ty + 3 } });
    lamps.push([tx + 1, ty + 4]);
    return { x0: tx - 1, y0: ty - 1, x1: tx + 3, y1: ty + 4 };
  }
  function makeWindmill(tx, ty) {
    const b = makeBuilding(tx, ty, 5, 5, 'down', { style: 'windmill', roof: 'thatch', name: 'Molino', custom: true });
    set(tx + 1, ty + 1, T.BARREL); set(tx + 3, ty + 1, T.BARREL);
    return { x0: tx - 1, y0: ty - 1, x1: tx + 5, y1: ty + 6, b };
  }
  function cryptEntrance(x, y, name) {
    set(x, y, T.CRYPT_DOWN);
    cryptEntrances.push({ x, y, name });
    lamps.push([x - 1, y], [x + 1, y]);
  }
  const cemeteries = [];
  {
    const cw = 17, chh = 12, cy0 = streetY - 6;
    const sides = [[tx0 - cw - 4, 1], [tx0 + TOWN_W + 3, -1]];
    let bestS = sides[0], bestBad = 1e9;
    for (const sd of sides) {
      let bad = 0;
      for (let y = cy0; y < cy0 + chh; y++) for (let x = sd[0]; x < sd[0] + cw; x++) {
        const t = get(x, y);
        if (x < 2 || x > W - 3 || t === T.DEEP || t === T.WATER || bldGrid[idx(x, y)] >= 0 || t === T.CWALL || t === T.TOWER) bad += 3;
        else if (isBlocking(t)) bad++;
      }
      if (bad < bestBad) { bestBad = bad; bestS = sd; }
    }
    const [x0, dir] = bestS, y0 = cy0;
    for (let y = y0 - 1; y <= y0 + chh; y++) for (let x = x0 - 1; x <= x0 + cw; x++) {
      const border = x === x0 || y === y0 || x === x0 + cw - 1 || y === y0 + chh - 1;
      if (x < x0 || y < y0 || x >= x0 + cw || y >= y0 + chh) { if (!isOpenLand(get(x, y))) set(x, y, T.GRASS); continue; }
      set(x, y, border ? T.CEMWALL : T.GRASS);
    }
    const gateX = dir > 0 ? x0 + cw - 1 : x0;          // la puerta mira a la ciudad
    for (let k = -1; k <= 1; k++) set(gateX, streetY + k, T.PLAZA);
    for (let x = Math.min(gateX, dir > 0 ? tx0 : tx0 + TOWN_W - 1); x <= Math.max(gateX, dir > 0 ? tx0 : tx0 + TOWN_W - 1); x++) set(x, streetY, T.PLAZA);
    const ex = x0 + (cw >> 1), ey = streetY;
    for (let x = x0 + 1; x < x0 + cw - 1; x++) set(x, ey, T.ROAD);
    for (let y = y0 + 2; y < y0 + chh - 1; y += 2) for (let x = x0 + 2; x < x0 + cw - 2; x += 2)
      if (Math.abs(y - ey) > 1 && Math.abs(x - ex) > 1 && rng.chance(0.9)) set(x, y, T.GRAVE);
    for (const [fx, fy] of [[x0 + 1, y0 + 1], [x0 + cw - 2, y0 + 1], [x0 + 1, y0 + chh - 2], [x0 + cw - 2, y0 + chh - 2]]) set(fx, fy, T.FOREST);
    for (let y = ey - 1; y <= ey + 1; y++) for (let x = ex - 2; x <= ex + 2; x++) set(x, y, T.PLAZA);
    cryptEntrance(ex, ey, 'Villa Real');
    lamps.push([ex - 2, ey - 2], [ex + 2, ey + 2]);
    markSafe(x0 - 5, y0 - 4, x0 + cw + 4, y0 + chh + 3);
    regions.push({ x0, y0, x1: x0 + cw - 1, y1: y0 + chh - 1, name: 'Cementerio de Villa Real' });
    cemeteries.push({ x0, y0, x1: x0 + cw - 1, y1: y0 + chh - 1, x: ex, y: ey, small: true });
  }

  // ------------------------------------------------------------ Altamira: la gran ciudad amurallada
  const AW = 92, AH = 62;
  let cbest = null, cScore = 1e9;
  for (let i = 0, minD = 300; i < 2400 && !(i >= 600 && cbest); i++) {
    if (i % 600 === 599) minD -= 50;
    const ax = rng.int(10, W - AW - 10), ay = rng.int(8, H - AH - 8);
    if (Math.hypot(ax + AW / 2 - gx, ay + AH / 2 - (oy + totalH / 2)) < minD) continue;
    let score = 0;
    for (let y = ay - 6; y < ay + AH + 6; y += 2) for (let x = ax - 6; x < ax + AW + 6; x += 2) {
      const t = get(x, y);
      if (t === T.DEEP || t === T.WATER) score += 3;
      else if (isBlocking(t)) score += 2;
      else if (!isOpenLand(t)) score += 0.3;
      if (safe[idx(x, y)]) score += 50;
    }
    if (score < cScore) { cScore = score; cbest = [ax, ay]; }
  }
  const [ax, ay] = cbest;
  const mx = ax + Math.floor(AW / 2), my = ay + Math.floor(AH / 2);
  for (let y = ay - 8; y < ay + AH + 8; y++) for (let x = ax - 8; x < ax + AW + 8; x++)
    if (!isOpenLand(get(x, y))) set(x, y, rng.chance(0.03) ? T.FLOWERS : T.GRASS);
  rectWall(ax, ay, AW, AH, T.CWALL, 2);
  for (let x = ax; x < ax + AW; x += 15) { disk(x, ay, 2.8, T.TOWER); disk(x, ay + AH - 1, 2.8, T.TOWER); }
  for (let y = ay; y < ay + AH; y += 15) { disk(ax, y, 2.8, T.TOWER); disk(ax + AW - 1, y, 2.8, T.TOWER); }
  for (const [tx, ty] of [[ax, ay], [ax + AW - 1, ay], [ax, ay + AH - 1], [ax + AW - 1, ay + AH - 1]]) disk(tx, ty, 3.4, T.TOWER);
  // Avenidas, calles y puertas
  for (let y = ay + 2; y < ay + AH - 2; y++) for (let x = mx - 1; x <= mx + 1; x++) set(x, y, T.PLAZA);
  for (let x = ax + 2; x < ax + AW - 2; x++) for (let y = my - 1; y <= my + 1; y++) set(x, y, T.PLAZA);
  for (let x = ax + 16; x < ax + AW - 4; x += 18) if (Math.abs(x - mx) > 6) for (let y = ay + 2; y < ay + AH - 2; y++) for (let k = 0; k < 2; k++) set(x + k, y, T.PLAZA);
  for (let y = ay + 15; y < ay + AH - 4; y += 15) if (Math.abs(y - my) > 4) for (let x = ax + 2; x < ax + AW - 2; x++) for (let k = 0; k < 2; k++) set(x, y + k, T.PLAZA);
  const cityGates = [];
  for (const [gx2, gy2, dx, dy] of [[mx, ay, 0, -1], [mx, ay + AH - 1, 0, 1], [ax, my, -1, 0], [ax + AW - 1, my, 1, 0]]) {
    for (let k = -1; k <= 1; k++) for (let j = -1; j <= 1; j++) set(gx2 + (dx ? j : k), gy2 + (dy ? j : k), T.GATE);
    for (let s = 2; s <= 7; s++) for (let k = -1; k <= 1; k++) set(gx2 + dx * s + (dx ? 0 : k), gy2 + dy * s + (dy ? 0 : k), T.PLAZA);
    disk(gx2 + (dx ? 0 : -3), gy2 + (dy ? 0 : -3), 2, T.TOWER); disk(gx2 + (dx ? 0 : 3), gy2 + (dy ? 0 : 3), 2, T.TOWER);
    for (let k = -1; k <= 1; k++) set(gx2 + (dx ? 0 : k), gy2 + (dy ? 0 : k), T.GATE);
    cityGates.push({ x: gx2 + dx * 8, y: gy2 + dy * 8 });
  }
  // Plaza mayor con fuentes y mercado
  const cplaza = { x0: mx - 13, y0: my - 7, x1: mx + 13, y1: my + 7 };
  fillRect(cplaza.x0, cplaza.y0, 27, 15, T.PLAZA);
  set(mx - 7, my - 3, T.WELL); set(mx + 7, my - 3, T.WELL);
  for (const [x, y] of [[mx - 11, my + 4], [mx - 8, my + 4], [mx + 8, my + 4], [mx + 11, my + 4], [mx - 11, my - 5], [mx + 11, my - 5]]) set(x, y, T.STALL);
  cryptEntrance(mx + 4, my + 4, 'Altamira');
  makeWatchtower(townGate.x + 4, townGate.y);
  // Catedral al norte de la plaza (con campanario)
  const cathedral = makeBuilding(mx - 12, my - 22, 24, 14, 'down', { style: 'church', roof: 'slate', name: 'Catedral de Altamira', custom: true, wall: T.CWALL, floorT: T.CFLOOR });
  for (let y = my - 19; y <= my - 11; y += 2) for (const x of [mx - 9, mx - 7, mx - 5, mx - 3, mx + 3, mx + 5, mx + 7, mx + 9]) set(x, y, T.TABLE);
  for (let y = my - 20; y < my - 9; y++) set(mx, y, T.RUG);
  set(mx, my - 21, T.SHELF); set(mx - 2, my - 21, T.HEARTH); set(mx + 2, my - 21, T.HEARTH);
  cathedral.hearth = { x: mx - 2, y: my - 21 };
  set(cathedral.outside.x, cathedral.outside.y, T.PLAZA);
  // Ayuntamiento y posada
  const hall = makeBuilding(mx - 28, my - 14, 15, 11, 'down', { style: 'fachwerk', roof: 'brown', floors: 2, name: 'Ayuntamiento de Altamira', chests: 2, loot: 80 });
  const inn2 = makeBuilding(mx + 27, my - 14, 15, 11, 'down', { style: 'fachwerk', roof: 'brown', floors: 2, name: 'Posada del Grifo', chests: 1 });
  // Torres de arqueros junto a la muralla
  set(hall.outside.x, hall.outside.y, T.PLAZA); set(inn2.outside.x, inn2.outside.y, T.PLAZA);
  const cityAvoid = [cplaza, { x0: cathedral.x - 1, y0: cathedral.y - 1, x1: cathedral.x + cathedral.w, y1: cathedral.y + cathedral.h + 1 },
                     { x0: hall.x - 1, y0: hall.y - 1, x1: hall.x + hall.w, y1: hall.y + hall.h + 1 },
                     { x0: inn2.x - 1, y0: inn2.y - 1, x1: inn2.x + inn2.w, y1: inn2.y + inn2.h + 1 }];
  for (const [tx, ty] of [[ax + 4, ay + 4], [ax + AW - 7, ay + 4], [ax + 4, ay + AH - 9], [ax + AW - 7, ay + AH - 9]])
    cityAvoid.push(makeWatchtower(tx, ty));
  // Torres de piedra
  for (let k = 0, t = 0; k < 4 && t < 200; t++) {
    const tx = rng.int(ax + 4, ax + AW - 10), ty = rng.int(ay + 4, ay + AH - 10);
    const r = { x0: tx - 1, y0: ty - 1, x1: tx + 5, y1: ty + 6 };
    if (cityAvoid.some(o => !(r.x1 < o.x0 || r.x0 > o.x1 || r.y1 < o.y0 || r.y0 > o.y1))) continue;
    let bad = false;
    for (let y = r.y0; y <= r.y1 && !bad; y++) for (let x = r.x0; x <= r.x1; x++) { const tt = get(x, y); if (tt === T.PLAZA || isBlocking(tt) || bldGrid[idx(x, y)] >= 0) { bad = true; break; } }
    if (bad) continue;
    const tb = makeBuilding(tx, ty, 5, 5, 'down', { style: 'tower', roof: 'slate', floors: 2, name: 'Torre de Altamira', chests: 1, loot: 60 });
    set(tb.outside.x, tb.outside.y, T.PLAZA);
    cityAvoid.push(r); k++;
  }
  // Barrios de casas de entramado alemanas
  const cityHouses = placeHouses({ x0: ax + 3, y0: ay + 3, x1: ax + AW - 3, y1: ay + AH - 3 }, 40, cityAvoid,
    { minW: 7, maxW: 10, minH: 6, maxH: 8, streetY: my, twoFloors: 0.75, roof: 'brown', style: 'fachwerk', tries: 6000, tight: true });
  npcInside('innkeeper', inn2);
  if (cityHouses.length) npcInside('healer', cityHouses[0]);
  for (let i = 0; i < 24; i++) {
    const n = makeNpc('peasant', mx + rng.int(-12, 12), my + rng.int(-6, 6), { village: 'Altamira' });
    n.home = { x: mx, y: my, r: 40 };
    if (rng.chance(0.5)) n.name = 'una aldeana';
    npcs.push(n);
  }
  for (const g2 of cityGates) { npcs.push(makeNpc('guard', g2.x + (g2.x === mx ? -3 : 0), g2.y + (g2.y === my ? -2 : 0))); }
  for (let y = ay + 4; y < ay + AH - 2; y += 8) lamps.push([mx - 2, y], [mx + 2, y]);
  for (let x = ax + 4; x < ax + AW - 2; x += 9) lamps.push([x, my - 2], [x, my + 2]);
  markSafe(ax - 14, ay - 14, ax + AW + 13, ay + AH + 13);
  regions.push({ x0: ax - 2, y0: ay - 2, x1: ax + AW + 1, y1: ay + AH + 1, name: 'Altamira' });
  // Molinos y huertos fuera de las murallas
  const mills = [];
  for (let t = 0; t < 300 && mills.length < 4; t++) {
    const side = rng.int(0, 3);
    const tx = side < 2 ? rng.int(ax - 2, ax + AW - 4) : side === 2 ? ax - 18 : ax + AW + 10;
    const ty = side === 0 ? ay - 20 : side === 1 ? ay + AH + 12 : rng.int(ay, ay + AH - 6);
    let ok = true;
    for (let y = ty - 2; y < ty + 13 && ok; y++) for (let x = tx - 2; x < tx + 16; x++) { const tt = get(x, y); if (!isOpenLand(tt) && tt !== T.HILL && tt !== T.FOREST) { ok = false; break; } }
    if (!ok || mills.some(m => Math.hypot(m.x - tx, m.y - ty) < 20)) continue;
    for (let y = ty - 1; y < ty + 12; y++) for (let x = tx - 1; x < tx + 15; x++) set(x, y, T.GRASS);
    makeWindmill(tx, ty);
    makeFarm(tx + 6, ty, 9, 6);
    mills.push({ x: tx, y: ty });
    markSafe(tx - 6, ty - 6, tx + 21, ty + 17);
  }
  if (mills.length) npcs.push(makeNpc('farmer', mills[0].x + 2, mills[0].y + 6));
  const city = { x: mx, y: my, name: 'Altamira', gates: cityGates };

  // --- Guarida del dragón: en las montañas más lejanas ---
  let lair = null, lairD = 0;
  for (let i = 0; i < 20000; i++) {
    const x = rng.int(8, W - 9), y = rng.int(8, H - 9);
    const t = get(x, y);
    if (t !== T.MOUNTAIN && t !== T.SNOW) continue;
    const d = Math.min(Math.hypot(x - castle.cx, y - castle.cy), Math.hypot(x - mx, y - my));
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

  // ------------------------------------------------------------ Aldeas
  const villages = [{ x: gx, y: streetY, name: 'Villa Real', main: true }];
  const names = VILLAGE_NAMES.slice();
  for (let tries = 0; tries < 12000 && villages.length < 13; tries++) {
    const cx = rng.int(18, W - 19), cy = rng.int(14, H - 15);
    if (!isOpenLand(get(cx, cy))) continue;
    if (Math.hypot(cx - gx, cy - (oy + totalH / 2)) < 70 || Math.hypot(cx - mx, cy - my) < 75) continue;
    if (villages.some(v => Math.hypot(cx - v.x, cy - v.y) < 50)) continue;
    let bad = 0;
    for (let y = cy - 10; y <= cy + 10; y++) for (let x = cx - 15; x <= cx + 15; x++) if (isBlocking(get(x, y))) bad++;
    if (bad > 20) continue;

    const name = names.splice(rng.int(0, names.length - 1), 1)[0];
    const x0 = cx - 15, x1 = cx + 15, y0 = cy - 10, y1 = cy + 10;
    for (let y = y0 - 1; y <= y1 + 1; y++) for (let x = x0 - 1; x <= x1 + 1; x++)
      if (!isOpenLand(get(x, y)) && get(x, y) !== T.SAND) set(x, y, T.GRASS);
    for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 3; x <= cx + 3; x++) set(x, y, T.PLAZA);
    set(cx, cy, T.WELL);
    const farm = makeFarm(cx + 3, cy + 3, 9, 5);
    const vAvoid = [{ x0: cx - 4, y0: cy - 2, x1: cx + 4, y1: cy + 2 }, { x0: cx + 2, y0: cy + 2, x1: cx + 12, y1: cy + 9 }];
    if (rng.chance(0.45)) vAvoid.push(makeWindmill(cx - 14, cy + 3));
    if (rng.chance(0.35)) vAvoid.push(makeWatchtower(cx + 11, cy - 9));
    if (cryptEntrances.length < 5 && Math.hypot(cx - lair.x, cy - lair.y) > 120) cryptEntrance(cx - 2, cy + 1, name);
    const houses = placeHouses({ x0, y0, x1, y1 }, 5, vAvoid,
      { minW: 8, maxW: 10, minH: 6, maxH: 8, streetY: cy, twoFloors: 0.25, roof: 'thatch' });
    if (houses.length) npcInside('healer', houses[0]);
    for (let p = 0, t2 = 0; p < rng.int(3, 5) && t2 < 200; t2++) {
      const x = rng.int(x0, x1), y = rng.int(y0, y1);
      const t = get(x, y);
      if (!(isOpenLand(t) || t === T.PLAZA) || bldGrid[idx(x, y)] >= 0) continue;
      const n = makeNpc('peasant', x, y, { village: name });
      n.home = { x: cx, y: cy, r: 9 };
      if (rng.chance(0.5)) n.name = 'una aldeana';
      npcs.push(n); p++;
    }
    lamps.push([cx - 3, cy], [cx + 3, cy]);
    markSafe(x0 - 7, y0 - 6, x1 + 7, y1 + 6);
    regions.push({ x0: x0 - 1, y0: y0 - 1, x1: x1 + 1, y1: y1 + 1, name: 'Aldea de ' + name });
    villages.push({ x: cx, y: cy, name });
  }


  // ------------------------------------------------------------ Corrales con ovejas
  const pens = [];
  const areaOpen = (x0, y0, w, h) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const t = get(x, y);
      if (!(isOpenLand(t) || t === T.HILL) || bldGrid[idx(x, y)] >= 0) return false;
    }
    return true;
  };
  const stables = [], gardens = [];
  function makePen(tx, ty, kind = 'sheep') {
    const w = 15, h = 10;
    for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) {
      const border = x === tx || y === ty || x === tx + w - 1 || y === ty + h - 1;
      set(x, y, border ? T.FENCE : (rng.chance(0.5) ? T.MEADOW : T.GRASS));
    }
    set(tx + 10, ty + h - 1, T.GRASS); set(tx + 11, ty + h - 1, T.GRASS);   // puerta del corral
    const barn = makeBuilding(tx + 1, ty + 1, 7, 5, 'down', { style: 'barn', roof: 'brown', name: kind === 'horse' ? 'Caballeriza' : 'Establo', custom: true });
    set(tx + 2, ty + 2, T.BARREL); set(tx + 6, ty + 2, T.BARREL);
    if (kind === 'horse') stables.push({ x0: tx + 1, y0: ty + 1, x1: tx + w - 2, y1: ty + h - 2, n: 3 });
    else pens.push({ x0: tx + 1, y0: ty + 1, x1: tx + w - 2, y1: ty + h - 2, n: 5 });
    markSafe(tx - 5, ty - 4, tx + w + 4, ty + h + 3);
    lamps.push([tx + 10, ty + h]);
    return { x0: tx - 1, y0: ty - 1, x1: tx + w, y1: ty + h, barn };
  }
  function penNear(cx, cy, rMin, rMax, kind) {
    for (let t = 0; t < 400; t++) {
      const a = rng.next() * Math.PI * 2, r = rMin + rng.next() * (rMax - rMin);
      const tx = Math.round(cx + Math.cos(a) * r), ty = Math.round(cy + Math.sin(a) * r * 0.7);
      if (tx < 3 || ty < 3 || tx > W - 20 || ty > H - 14 || !areaOpen(tx - 1, ty - 1, 17, 12)) continue;
      return makePen(tx, ty, kind);
    }
    return null;
  }
  // Jardín: setos, caminos de grava en cruz, macizos de flores y una fuente en el centro
  function makeGarden(tx, ty, w = 17, h = 11) {
    const cx = tx + (w >> 1), cy = ty + (h >> 1);
    for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) {
      const border = x === tx || y === ty || x === tx + w - 1 || y === ty + h - 1;
      if (border) set(x, y, Math.abs(x - cx) <= 1 || Math.abs(y - cy) <= 0 ? T.PLAZA : T.HEDGE);
      else if (Math.abs(x - cx) <= 1 || y === cy) set(x, y, T.PLAZA);
      else if (x === tx + 1 || x === tx + w - 2 || y === ty + 1 || y === ty + h - 2) set(x, y, T.PLAZA);
      else set(x, y, T.FLOWERBED);
    }
    for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) set(x, y, x === cx && y === cy ? T.WATER : T.BASIN);
    for (const [fx, fy] of [[tx + 2, ty + 2], [tx + w - 3, ty + 2], [tx + 2, ty + h - 3], [tx + w - 3, ty + h - 3]]) set(fx, fy, T.FOREST);
    gardens.push({ x0: tx, y0: ty, x1: tx + w - 1, y1: ty + h - 1, fx: cx, fy: cy });
    markSafe(tx - 5, ty - 4, tx + w + 4, ty + h + 3);
    lamps.push([cx - 2, cy - 2], [cx + 2, cy + 2]);
  }
  function gardenNear(cx, cy, rMin, rMax) {
    for (let t = 0; t < 400; t++) {
      const a = rng.next() * Math.PI * 2, r = rMin + rng.next() * (rMax - rMin);
      const tx = Math.round(cx + Math.cos(a) * r), ty = Math.round(cy + Math.sin(a) * r * 0.7);
      if (tx < 3 || ty < 3 || tx > W - 21 || ty > H - 15 || !areaOpen(tx - 1, ty - 1, 19, 13)) continue;
      return makeGarden(tx, ty);
    }
    return null;
  }
  penNear(tx0 + TOWN_W / 2, ty0 + TOWN_H / 2, TOWN_W / 2 + 10, TOWN_W / 2 + 30);       // junto a Villa Real
  penNear(mx, my, AW / 2 + 14, AW / 2 + 40);                             // junto a Altamira
  for (const v of villages.slice(1)) if (rng.chance(0.4)) penNear(v.x, v.y, 20, 32);

  // ------------------------------------------------------------ Cementerio en el bosque, cerca de Altamira
  let cemetery = null;
  for (let t = 0; t < 3000 && !cemetery; t++) {
    const a = rng.next() * Math.PI * 2, r = 58 + rng.next() * 40;
    const cx0 = Math.round(mx + Math.cos(a) * r), cy0 = Math.round(my + Math.sin(a) * r * 0.7);
    const x0 = cx0 - 13, y0 = cy0 - 9, cw = 26, chh = 18;
    if (x0 < 4 || y0 < 4 || x0 + cw > W - 4 || y0 + chh > H - 4) continue;
    let forest = 0, bad = 0;
    for (let y = y0 - 3; y < y0 + chh + 3; y++) for (let x = x0 - 3; x < x0 + cw + 3; x++) {
      const tt = get(x, y);
      if (tt === T.FOREST || tt === T.PINE) forest++;
      if (!TILE_DEFS[tt].pass || tt === T.ROAD || safe[idx(x, y)] || bldGrid[idx(x, y)] >= 0) bad++;
    }
    if (bad > 8 || forest < 120) continue;
    for (let y = y0; y < y0 + chh; y++) for (let x = x0; x < x0 + cw; x++) {
      const border = x === x0 || y === y0 || x === x0 + cw - 1 || y === y0 + chh - 1;
      set(x, y, border ? T.CEMWALL : T.GRASS);
    }
    for (let k = -1; k <= 1; k++) set(cx0 + k, y0 + chh - 1, T.ROAD);
    for (let y = y0 + 8; y < y0 + chh - 1; y++) set(cx0, y, T.ROAD);
    for (let y = y0 + 9; y < y0 + chh - 2; y += 2) for (let x = x0 + 2; x < x0 + cw - 2; x += 2)
      if (Math.abs(x - cx0) > 1 && rng.chance(0.85)) set(x, y, T.GRAVE);
    for (const [fx, fy] of [[x0 + 2, y0 + 2], [x0 + cw - 3, y0 + 2], [x0 + 3, y0 + 6], [x0 + cw - 4, y0 + 6]]) set(fx, fy, T.FOREST);
    const maus = makeBuilding(cx0 - 4, y0 + 1, 9, 7, 'down', { style: 'mausoleum', roof: 'slate', name: 'Mausoleo', custom: true, floorT: T.CFLOOR, wall: T.CWALL });
    set(maus.outside.x, maus.outside.y, T.ROAD);
    for (const [bx, by] of [[cx0 - 2, y0 + 3], [cx0 + 2, y0 + 3]]) set(bx, by, T.SARCO);
    cryptEntrance(cx0, y0 + 4, 'el cementerio');
    lamps.push([cx0 - 2, y0 + chh], [cx0 + 2, y0 + chh], [cx0 - 1, y0 + 11], [cx0 + 1, y0 + 15]);
    cemetery = { x0, y0, x1: x0 + cw - 1, y1: y0 + chh - 1, x: cx0, y: cy0 };
    markSafe(x0 - 5, y0 - 4, x0 + cw + 4, y0 + chh + 3);
    cemeteries.push(cemetery);
    regions.push({ x0, y0, x1: x0 + cw - 1, y1: y0 + chh - 1, name: 'Cementerio de Altamira', cemetery: true });
  }
  // caballeriza de Villa Real: dentro del pueblo, junto a la calle que baja a la salida sur
  for (let y = ty0 + 30; y < ty0 + 40; y++) for (let x = gx + 4; x < gx + 19; x++) if (!isOpenLand(get(x, y))) set(x, y, T.GRASS);
  makePen(gx + 4, ty0 + 30, 'horse');
  penNear(mx, my, AW / 2 + 12, AW / 2 + 40, 'horse');                                    // caballeriza de Altamira
  // jardines del palacio: a ambos lados, dentro de la muralla del castillo
  makeGarden(castle.x + 5, castle.y + 19, 15, 9);
  makeGarden(castle.x + castle.w - 20, castle.y + 19, 15, 9);
  gardenNear(mx, my, AW / 2 + 10, AW / 2 + 36);
  gardenNear(mx, my, AW / 2 + 10, AW / 2 + 36);
  for (const v of villages.slice(1)) if (rng.chance(0.35)) gardenNear(v.x, v.y, 20, 34);
  // campamentos con hoguera: de noche los aldeanos se juntan a charlar, comer y soltar farolillos
  const camps = [];
  function makeCamp(tx, ty, village) {
    for (let y = ty - 2; y <= ty + 2; y++) for (let x = tx - 4; x <= tx + 4; x++) set(x, y, rng.chance(0.3) ? T.MEADOW : T.GRASS);
    set(tx, ty, T.CAMPFIRE);
    set(tx - 3, ty, T.LOG); set(tx + 3, ty, T.LOG);
    const camp = { x: tx, y: ty, village };
    camps.push(camp);
    markSafe(tx - 9, ty - 7, tx + 9, ty + 7);
    const n = rng.int(3, 4);
    for (let k = 0; k < n; k++) {
      const a = Math.PI * (1 + k / (n - 1)) + (rng.next() - 0.5) * 0.25;   // a los lados y detrás del fuego
      const npc = makeNpc('peasant', tx, ty, { village, camper: true, camp: camps.length - 1, seat: a, mug: rng.chance(0.6) });
      npc.home.r = 0;
      if (rng.chance(0.5)) npc.name = 'una aldeana';
      npcs.push(npc);
    }
  }
  function campNear(cx, cy, rMin, rMax, village) {
    for (let t = 0; t < 500; t++) {
      const a = rng.next() * Math.PI * 2, r = rMin + rng.next() * (rMax - rMin);
      const tx = Math.round(cx + Math.cos(a) * r), ty = Math.round(cy + Math.sin(a) * r * 0.7);
      if (tx < 8 || ty < 6 || tx > W - 9 || ty > H - 7 || !areaOpen(tx - 5, ty - 3, 11, 7)) continue;
      return makeCamp(tx, ty, village);
    }
    return null;
  }
  campNear(tx0 + TOWN_W / 2, ty0 + TOWN_H / 2, TOWN_W / 2 + 3, TOWN_W / 2 + 22, 'Villa Real');
  campNear(mx, my, AW / 2 + 6, AW / 2 + 26, 'Altamira');
  for (const v of villages.slice(1)) campNear(v.x, v.y, 8, 26, v.name);

  // dos caballos salvajes, en praderas lejos de todo
  const wildHorses = [];
  for (let t = 0; t < 20000 && wildHorses.length < 2; t++) {
    const x = rng.int(10, W - 11), y = rng.int(10, H - 11);
    const tt = get(x, y);
    if (!(tt === T.GRASS || tt === T.MEADOW || tt === T.FLOWERS) || safe[idx(x, y)]) continue;
    if (Math.hypot(x - castle.cx, y - castle.cy) < 70 || wildHorses.some(h => Math.hypot(h.x - x, h.y - y) < 120)) continue;
    let open = 0;
    for (let dy = -6; dy <= 6; dy++) for (let dx = -10; dx <= 10; dx++) if (isOpenLand(get(x + dx, y + dy))) open++;
    if (open < 200) continue;
    wildHorses.push({ x, y });
  }


  // --- Caminos (Dijkstra con costes por terreno) ---
  const cost = t => {
    switch (t) {
      case T.ROAD: case T.BRIDGE: case T.PLAZA: return 0.35;
      case T.DEEP: return 22; case T.WATER: return 6;
      case T.MOUNTAIN: return 7; case T.SNOW: return 12;
      case T.FOREST: case T.PINE: return 2.2; case T.HILL: return 1.6;
      case T.FIELD: return 8;
      default: return TILE_DEFS[t].pass && t !== T.HFLOOR && t !== T.CFLOOR && t !== T.CARPET && t !== T.DOOR && t !== T.GATE ? 1 : Infinity;
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
        const nd = d + (ni === target ? 1 : cost(tiles[ni]) + nRoad(nx * 0.07, ny * 0.07) * 2.6) + rng.next() * 0.05;
        if (nd < dist[ni]) { dist[ni] = nd; prev[ni] = i; heap.push(nd, ni); }
      }
    }
    for (let i = target; i !== -1; i = prev[i]) {
      const t = tiles[i];
      if (t === T.DEEP || t === T.WATER) tiles[i] = T.BRIDGE;
      else if ([T.GRASS, T.MEADOW, T.FLOWERS, T.FOREST, T.PINE, T.HILL, T.MOUNTAIN, T.SNOW, T.SAND].includes(t)) tiles[i] = T.ROAD;
    }
  }
  const nearestGate = (x, y) => cityGates.reduce((a, g) => Math.hypot(g.x - x, g.y - y) < Math.hypot(a.x - x, a.y - y) ? g : a);
  { const g0 = nearestGate(townGate.x, townGate.y); road(townGate.x, townGate.y, g0.x, g0.y); }
  for (const v of villages.slice(1)) {
    const g0 = nearestGate(v.x, v.y);
    if (Math.hypot(g0.x - v.x, g0.y - v.y) < Math.hypot(townGate.x - v.x, townGate.y - v.y)) road(g0.x, g0.y, v.x, v.y + 2);
    else road(townGate.x, townGate.y, v.x, v.y + 2);
  }
  let from = townGate, fromD = Math.hypot(lair.x - townGate.x, lair.y - townGate.y);
  for (const v of villages.slice(1)) {
    const d = Math.hypot(lair.x - v.x, lair.y - v.y);
    if (d < fromD) { fromD = d; from = { x: v.x, y: v.y + 2 }; }
  }
  road(from.x, from.y, lair.x, lair.y + 4);

  // --- Objetos repartidos por el mundo ---
  const freeCell = () => {
    for (let k = 0; k < 500; k++) {
      const x = rng.int(1, W - 2), y = rng.int(1, H - 2);
      if (TILE_DEFS[get(x, y)].pass && !safe[idx(x, y)] && !items.some(it => it.x === x && it.y === y)) return { x, y };
    }
    return null;
  };
  for (let i = 0; i < 220; i++) { const c = freeCell(); if (c) items.push({ ...c, kind: 'gold', amount: rng.int(3, 15) }); }
  for (let i = 0; i < 90; i++) { const c = freeCell(); if (c) items.push({ ...c, kind: 'potion' }); }
  items.push({ x: lair.x, y: lair.y - 3, kind: 'chest', amount: 250 });

  // --- La cabaña abandonada de la bruja y el árbol centenario del gólem, en lo hondo del bosque ---
  const forestSpot = (w, h, far) => {
    let best = null, bestScore = -1;
    for (let t = 0; t < 6000; t++) {
      const x = rng.int(w + 4, W - w - 5), y = rng.int(h + 4, H - h - 5);
      if (far.some(([fx, fy, d]) => Math.hypot(x - fx, y - fy) < d)) continue;
      let forest = 0, bad = 0;
      for (let dy = -h; dy <= h; dy++) for (let dx = -w; dx <= w; dx++) {
        const tt = get(x + dx, y + dy);
        if (tt === T.FOREST || tt === T.PINE) forest++;
        if (!TILE_DEFS[tt].pass || tt === T.ROAD || tt === T.BRIDGE || safe[idx(x + dx, y + dy)] || bldGrid[idx(x + dx, y + dy)] >= 0) bad++;
      }
      const score = forest - bad * 6;
      if (bad <= 3 && score > bestScore) { bestScore = score; best = { x, y }; }
    }
    return best;
  };
  let witch = null, ancient = null;
  {
    const sp = forestSpot(10, 7, [[castle.cx, castle.cy, 95], [mx, my, 85], [lair.x, lair.y, 45]]);
    if (sp) {
      for (let dy = -5; dy <= 5; dy++) for (let dx = -8; dx <= 8; dx++) {
        const e = (dx / 8.5) ** 2 + (dy / 5.5) ** 2 + (hash2(dx + sp.x, dy) - 0.5) * 0.25;
        if (e < 1) set(sp.x + dx, sp.y + dy, e < 0.35 ? T.GRASS : rng.chance(0.4) ? T.MEADOW : T.GRASS);
      }
      const b = makeBuilding(sp.x - 4, sp.y - 4, 8, 5, 'down', { style: 'witch', roof: 'thatch', name: 'Cabaña de la bruja', custom: true });
      set(sp.x - 3, sp.y - 3, T.SHELF); set(sp.x + 2, sp.y - 3, T.SHELF); set(sp.x - 3, sp.y - 2, T.BED);
      set(sp.x + 3, sp.y + 2, T.CAULDRON);
      for (const [fx, fy] of [[-7, -3], [7, -3], [-6, 3], [6, 4], [-2, 4]]) set(sp.x + fx, sp.y + fy, T.FOREST);
      npcs.push(makeNpc('witch', sp.x + 1, sp.y + 2));
      witch = { x: sp.x + 3, y: sp.y + 2, x0: sp.x - 9, y0: sp.y - 6, x1: sp.x + 9, y1: sp.y + 6 };
      markSafe(sp.x - 9, sp.y - 6, sp.x + 9, sp.y + 6);
      regions.push({ x0: sp.x - 9, y0: sp.y - 6, x1: sp.x + 9, y1: sp.y + 6, name: 'Cabaña de la bruja' });
      lamps.push([sp.x + 3, sp.y + 3]);
    }
    const ap = forestSpot(14, 9, [[castle.cx, castle.cy, 85], [mx, my, 75], [lair.x, lair.y, 40], ...(witch ? [[witch.x, witch.y, 70]] : [])]);
    if (ap) {
      for (let dy = -9; dy <= 9; dy++) for (let dx = -14; dx <= 14; dx++) {
        const e = (dx / 14) ** 2 + (dy / 9) ** 2 + (hash2(dx, dy + ap.y) - 0.5) * 0.2;
        if (e < 1) set(ap.x + dx, ap.y + dy, rng.chance(0.12) ? T.FLOWERS : rng.chance(0.5) ? T.MEADOW : T.GRASS);
      }
      for (let dx = -1; dx <= 1; dx++) set(ap.x + dx, ap.y, T.ROOTS);
      ancient = { x: ap.x, y: ap.y };
      regions.push({ x0: ap.x - 14, y0: ap.y - 9, x1: ap.x + 14, y1: ap.y + 9, name: 'Árbol centenario' });
    }
  }

  // --- Lagos: masas de agua del interior (ni océano ni río) se pueden vadear ---
  {
    const seen = new Uint8Array(W * H);
    const isW = t => t === T.WATER || t === T.DEEP;
    for (let s0 = 0; s0 < W * H; s0++) {
      if (seen[s0] || !isW(tiles[s0])) continue;
      const comp = [s0]; seen[s0] = 1;
      let edge = false, river = 0;
      for (let h = 0; h < comp.length; h++) {
        const i = comp[h], x = i % W, y = (i / W) | 0;
        if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) edge = true;
        if (x >= castle.x - 8 && x <= castle.x + castle.w + 8 && y >= castle.y - 8 && y <= castle.y + castle.h + 8) edge = true;   // el foso no
        if (riverTiles.has(i)) river++;
        for (const j of [i - 1, i + 1, i - W, i + W]) if (j >= 0 && j < W * H && !seen[j] && isW(tiles[j])) { seen[j] = 1; comp.push(j); }
      }
      if (edge || comp.length < 25 || river > comp.length * 0.5) continue;      // océano, charquito o río
      for (const i of comp) if (!riverTiles.has(i)) tiles[i] = T.LAKE;
    }
  }

  return {
    W, H, tiles, safe, castle, villages, lair, regions, npcs, items, start, seed, buildings, bldGrid, crops, lamps, wallStairs,
    watchtowers, cryptEntrances, city, pens, cemetery, cemeteries, stables, gardens, wildHorses, camps, witch, ancient,
    rocks: rocks.filter(rk => {
      const t = get(Math.floor(rk.x), Math.floor(rk.y));
      return !safe[idx(Math.floor(rk.x), Math.floor(rk.y))] && (rk.inWater ? t === T.WATER || t === T.LAKE : (t === T.FOREST || t === T.PINE || t === T.HILL || t === T.GRASS || t === T.MEADOW));
    }),
    get, inb,
    passable(x, y) { return inb(x, y) && TILE_DEFS[tiles[idx(x, y)]].pass; },
    isSafe(x, y) { return inb(x, y) && safe[idx(x, y)] === 1; },
    regionAt(x, y) { return regions.find(r => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1); },
    bldAt(x, y) { return inb(x, y) && bldGrid[idx(x, y)] >= 0 ? buildings[bldGrid[idx(x, y)]] : null; },
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

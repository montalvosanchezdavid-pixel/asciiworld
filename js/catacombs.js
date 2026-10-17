'use strict';
// Catacumbas: un nivel subterráneo del mismo tamaño que el reino. Túneles sinuosos unen las
// entradas de las ciudades principales, con criptas, sarcófagos, ramales sin salida con tesoros
// y la guarida de la araña gigante.

function generateUnder(sw) {
  const W = sw.W, H = sw.H;
  const rng = new RNG(sw.seed + 101);
  const tiles = new Uint8Array(W * H).fill(T.CRYPTWALL);
  const idx = (x, y) => y * W + x;
  const inb = (x, y) => x >= 1 && y >= 1 && x < W - 1 && y < H - 1;
  const get = (x, y) => (inb(x, y) ? tiles[idx(x, y)] : T.CRYPTWALL);
  const set = (x, y, t) => { if (inb(x, y)) tiles[idx(x, y)] = t; };
  const nC = makeNoise(rng);
  const items = [], lamps = [], regions = [];
  const ents = sw.cryptEntrances;

  const carve = (x, y, r) => {
    for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++)
      if (dx * dx + dy * dy <= r * r + 0.3 && get(x + dx, y + dy) === T.CRYPTWALL) set(x + dx, y + dy, T.CRYPTFLOOR);
  };
  const room = (x0, y0, w, h) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (get(x, y) === T.CRYPTWALL) set(x, y, T.CRYPTFLOOR); };

  // Túnel sinuoso entre dos puntos (Dijkstra sobre roca con coste ruidoso)
  function tunnel(sx, sy, tx, ty) {
    const dist = new Float64Array(W * H).fill(Infinity);
    const prev = new Int32Array(W * H).fill(-1);
    const heap = new MinHeap();
    dist[idx(sx, sy)] = 0; heap.push(0, idx(sx, sy));
    const target = idx(tx, ty);
    while (heap.size) {
      const [d, i] = heap.pop();
      if (d > dist[i] + 1e-6) continue;
      if (i === target) break;
      const x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!inb(nx, ny)) continue;
        const ni = idx(nx, ny);
        const nd = d + (tiles[ni] === T.CRYPTFLOOR ? 0.6 : 1 + nC(nx * 0.05, ny * 0.05) * 7);
        if (nd < dist[ni]) { dist[ni] = nd; prev[ni] = i; heap.push(nd, ni); }
      }
    }
    const path = [];
    for (let i = target; i !== -1; i = prev[i]) path.push([i % W, (i / W) | 0]);
    path.reverse();
    path.forEach(([x, y], k) => {
      carve(x, y, 1 + (nC(x * 0.1 + 30, y * 0.1) > 0.7 ? 1 : 0));
      if (k % 18 === 9) lamps.push([x, y]);
    });
    return path;
  }

  // Cámara bajo cada entrada, con su escalera de subida
  // Sala de la escalera: una escalinata ancha de piedra que sube hasta la superficie
  for (const e of ents) {
    room(e.x - 6, e.y - 3, 13, 9);
    for (let x = e.x - 2; x <= e.x + 2; x++) set(x, e.y - 3, T.CRYPTWALL);
    for (let y = e.y - 2; y <= e.y; y++) for (let x = e.x - 1; x <= e.x + 1; x++) set(x, y, T.CRYPT_UP);
    lamps.push([e.x - 3, e.y - 1], [e.x + 3, e.y - 1], [e.x - 3, e.y + 2], [e.x + 3, e.y + 2]);
    regions.push({ x0: e.x - 5, y0: e.y - 4, x1: e.x + 5, y1: e.y + 4, name: 'Catacumbas bajo ' + e.name });
  }
  // Conectar todas las entradas (árbol de distancias mínimas)
  const paths = [], links = [];
  const done = [ents[0], ents[1]], left = ents.slice(2);
  paths.push(tunnel(ents[0].x, ents[0].y + 2, ents[1].x, ents[1].y + 2));     // gran línea entre las dos ciudades
  links.push([ents[0], ents[1]]);
  while (left.length) {
    let bi = 0, bj = 0, bd = Infinity;
    left.forEach((a, i) => done.forEach((b, j) => { const d = Math.hypot(a.x - b.x, a.y - b.y); if (d < bd) { bd = d; bi = i; bj = j; } }));
    const a = left.splice(bi, 1)[0], b = done[bj];
    paths.push(tunnel(b.x, b.y + 2, a.x, a.y + 2));
    links.push([b, a]);
    done.push(a);
  }

  // Criptas a lo largo de los túneles
  const crypts = [];
  for (const path of paths) for (let k = 30; k < path.length - 30; k += rng.int(35, 55)) {
    const [px, py] = path[k];
    if (ents.some(e => Math.hypot(e.x - px, e.y - py) < 14) || crypts.some(c => Math.hypot(c.cx - px, c.cy - py) < 20)) continue;
    const w = rng.int(9, 14), h = rng.int(7, 10);
    const x0 = px - Math.floor(w / 2) + rng.int(-3, 3), y0 = py - Math.floor(h / 2) + rng.int(-2, 2);
    room(x0, y0, w, h);
    crypts.push({ x0, y0, w, h, cx: x0 + w / 2, cy: y0 + h / 2 });
  }
  // La cripta más grande, a mitad del túnel más largo: guarida de la araña gigante
  const longest = paths.reduce((a, p) => (p.length > a.length ? p : a), paths[0] || []);
  let spiderLair = null;
  if (longest.length) {
    const [lx, ly] = longest[Math.floor(longest.length / 2)];
    room(lx - 11, ly - 7, 23, 15);
    for (let y = ly - 7; y < ly + 8; y++) for (let x = lx - 11; x < lx + 12; x++)
      if (get(x, y) === T.CRYPTFLOOR && rng.chance(0.18) && Math.hypot(x - lx, (y - ly) * 1.5) > 3) set(x, y, T.WEB);
    spiderLair = { x: lx, y: ly };
    lamps.push([lx - 9, ly - 5], [lx + 9, ly - 5], [lx - 9, ly + 5], [lx + 9, ly + 5]);
    items.push({ x: lx, y: ly - 5, kind: 'chest', amount: 300 });
    regions.push({ x0: lx - 11, y0: ly - 7, x1: lx + 11, y1: ly + 7, name: 'Nido de la araña gigante' });
  }
  // Mobiliario de las criptas: sarcófagos en filas, huesos, velas y cofres
  for (const c of crypts) {
    for (let y = c.y0 + 2; y < c.y0 + c.h - 2; y += 2) for (let x = c.x0 + 2; x < c.x0 + c.w - 2; x += 3)
      if (rng.chance(0.55) && get(x, y) === T.CRYPTFLOOR) set(x, y, T.SARCO);
    lamps.push([c.x0 + 1, c.y0 + 1], [c.x0 + c.w - 2, c.y0 + c.h - 2]);
    if (rng.chance(0.6)) items.push(rng.chance(0.6) ? { x: c.x0 + 1, y: c.y0 + c.h - 2, kind: 'chest', amount: rng.int(30, 90) } : { x: c.x0 + 1, y: c.y0 + c.h - 2, kind: 'potion' });
  }
  // Ramales sin salida con algún tesoro
  for (const path of paths) for (let k = 20; k < path.length - 20; k += rng.int(60, 110)) {
    let [x, y] = path[k];
    let dir = rng.pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
    const len = rng.int(15, 35);
    for (let s = 0; s < len; s++) {
      if (rng.chance(0.2)) dir = rng.pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
      x += dir[0]; y += dir[1];
      if (!inb(x, y)) break;
      carve(x, y, 0.8);
    }
    if (inb(x, y)) items.push(rng.chance(0.5) ? { x, y, kind: 'chest', amount: rng.int(20, 60) } : { x, y, kind: 'gold', amount: rng.int(8, 25) });
  }
  // Vías del tren de las catacumbas: una línea por túnel, con un vagón en cada estación
  const lines = [], slots = new Map();
  const slotX = [0, -3, 3, -6, 6];
  paths.forEach((path, li) => {
    for (const [x, y] of path) if (get(x, y) !== T.CRYPT_UP) set(x, y, T.RAIL);
    const [b, a] = links[li];
    const line = { path, from: b.name, to: a.name, carts: [] };
    [[b, 0], [a, 1]].forEach(([e, end]) => {
      const n = slots.get(e) || 0; slots.set(e, n + 1);
      const cx = e.x + slotX[n % slotX.length], cy = e.y + 4;
      for (let x = Math.min(cx, e.x); x <= Math.max(cx, e.x); x++) set(x, cy, T.RAIL);
      set(e.x, e.y + 2, T.RAIL); set(e.x, e.y + 3, T.RAIL);
      line.carts.push({ end, x: cx, y: cy, station: e.name, dest: end === 0 ? a.name : b.name });
    });
    lines.push(line);
  });
  regions.push({ x0: 0, y0: 0, x1: W, y1: H, name: 'Catacumbas' });

  return {
    W, H, tiles, safe: new Uint8Array(W * H), castle: sw.castle, villages: sw.villages, lair: sw.lair, regions, npcs: [], items,
    start: { x: ents[0].x, y: ents[0].y + 2 }, seed: sw.seed + 101, buildings: [], bldGrid: new Int16Array(W * H).fill(-1),
    crops: [], lamps, wallStairs: [], rocks: [], watchtowers: [], cryptEntrances: ents, city: sw.city, under: true, spiderLair, lines,
    get, inb: (x, y) => x >= 0 && y >= 0 && x < W && y < H,
    passable(x, y) { return inb(x, y) && TILE_DEFS[tiles[idx(x, y)]].pass; },
    isSafe() { return false; },
    regionAt(x, y) { return regions.find(r => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1); },
    bldAt() { return null; },
  };
}

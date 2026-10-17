'use strict';
// Tren de las catacumbas: vagones que recorren las vías entre las ciudades. Montado en el
// vagón no puedes andar, pero puedes lanzar lanzas de fuego (clic o ESPACIO) a los monstruos
// que salen al paso. Si alguno se queda en la vía, el vagón lo arrolla.

const TRAIN_SPEED = 11;      // casillas por segundo
let trainSpawnT = 0;

function cartNear() {
  if (!world.under || !world.lines || player.riding) return null;
  let best = null, bd = 9;
  for (const line of world.lines) for (const c of line.carts) {
    const p = cellOfTile(c.x, c.y);
    const d = dist(p, player);
    if (d < bd) { bd = d; best = { line, cart: c }; }
  }
  return best;
}

function trainPrompt() {
  const n = cartNear();
  return n ? `[E] Vagón hacia ${n.cart.dest}` : null;
}

function trainAction() {
  const n = cartNear();
  if (!n) return false;
  const p = player, path = n.line.path;
  const fwd = n.cart.end === 0;
  p.riding = { line: n.line, k: fwd ? 0 : path.length - 1, dir: fwd ? 1 : -1, spd: 0, dest: n.cart.dest };
  p.bld = null; p.floor = 0; p.onWall = false;
  trainSpawnT = 2;
  placeRider();
  msg(`Subes al vagón rumbo a ${n.cart.dest}. Clic o ESPACIO: lanza de fuego.`, [255, 200, 110]);
  return true;
}

// Posición suavizada sobre la vía (media de varios puntos para redondear las esquinas)
function railPos(path, k) {
  let sx = 0, sy = 0, n = 0;
  for (let o = -2; o <= 2; o++) {
    const kk = Math.max(0, Math.min(path.length - 1, k + o));
    const i = Math.floor(kk), f = kk - i;
    const a = path[i], b = path[Math.min(path.length - 1, i + 1)];
    sx += a[0] + (b[0] - a[0]) * f; sy += a[1] + (b[1] - a[1]) * f; n++;
  }
  return { x: (sx / n) * TW + TW / 2, y: (sy / n) * TH + TH / 2 };
}

function placeRider() {
  const p = player, r = p.riding;
  const q = railPos(r.line.path, r.k);
  const vx = q.x - p.x;
  if (Math.abs(vx) > 0.05) p.facing = vx > 0 ? 1 : -1;
  if (Math.hypot(q.x - p.x, q.y - p.y) > 0.01) p.dir = { x: q.x - p.x, y: (q.y - p.y) * A() };
  const l = Math.hypot(p.dir.x, p.dir.y) || 1; p.dir = { x: p.dir.x / l, y: p.dir.y / l };
  p.x = q.x; p.y = q.y;
}

function updateRiding(dt) {
  const p = player, r = p.riding;
  const path = r.line.path;
  const left = r.dir > 0 ? path.length - 1 - r.k : r.k;
  const top = Math.max(TRAIN_SPEED, path.length / 22);           // las líneas largas van más deprisa
  const target = left < 10 ? Math.max(2.5, left * 1.1) : top;
  r.spd += Math.sign(target - r.spd) * Math.min(Math.abs(target - r.spd), dt * 6);
  r.k += r.dir * r.spd * dt;
  p.anim += dt * 2;
  if (r.k <= 0 || r.k >= path.length - 1) {
    r.k = Math.max(0, Math.min(path.length - 1, r.k));
    placeRider();
    p.riding = null;
    p.y -= TH;                          // se baja junto a la vía
    if (!passable(p.x, p.y)) p.y += TH;
    msg(`Llegas a la estación bajo ${r.dest}.`, [240, 210, 140]);
    return;
  }
  placeRider();
  // traqueteo y chispas de las ruedas
  if (Math.random() < dt * r.spd * 1.5) particles.push({ x: p.x + (Math.random() - 0.5) * 6, y: p.y + 0.5, vx: -p.dir.x * 10 + (Math.random() - 0.5) * 6, vy: -2 - Math.random() * 3,
    life: 0.3, max: 0.3, ch: "*.'"[(Math.random() * 3) | 0], c: [255, 200, 90] });
  // el vagón arrolla a los monstruos que se quedan en la vía
  for (const e of enemies) {
    if (e.dead || e.boss || e.mini || (e.runT || 0) > 0 || r.spd < 5) continue;
    if (dist(e, p) < 6) {
      e.runT = 0.8;
      const dmg = rint(10, 16) + p.lvl * 2;
      e.hp -= dmg; e.flash = 0.15; e.engaged = true;
      e.kx = -p.dir.y * 60 * (Math.random() < 0.5 ? 1 : -1); e.ky = p.dir.x * 30;
      floater(e.x, e.y - 8, `${dmg}`, [255, 220, 140]);
      burst(e.x, e.y - 3, 10, '*.,', [255, 255, 255], [200, 60, 40], 30, 0.5);
      shake = Math.max(shake, 0.1);
      if (e.hp <= 0) killEnemy(e);
    }
  }
  for (const e of enemies) if (e.runT > 0) e.runT -= dt;
  // monstruos que salen al paso por delante
  trainSpawnT -= dt;
  if (trainSpawnT <= 0) {
    trainSpawnT = 1.6 + Math.random() * 1.8;
    const near = enemies.filter(e => !e.mini && dist(e, p) < 160).length;
    const k2 = Math.round(r.k + r.dir * rint(28, 45));
    if (near < 8 && k2 > 0 && k2 < path.length - 1) {
      for (let t = 0; t < 6; t++) {
        const [tx, ty] = path[k2];
        const x = (tx + rint(-2, 2)) * TW + TW / 2, y = (ty + rint(-1, 1)) * TH + TH / 2;
        if (!passable(x, y)) continue;
        const q = Math.random();
        const e = makeEnemy(q < 0.35 ? 'rat' : q < 0.7 ? 'skeleton' : 'spider', x, y);
        e.engaged = true;
        enemies.push(e);
        break;
      }
    }
  }
}

// Lanza al enemigo más cercano por delante (para jugar sin ratón)
function lanceAtNearest() {
  const p = player;
  let best = null, bd = LANCE_RANGE;
  for (const e of enemies) {
    if (e.dead || e.passive) continue;
    const d = dist(e, p);
    if (d < bd) { bd = d; best = e; }
  }
  if (best) shootLance(best.x, best.y);
  else shootLance(p.x + p.dir.x * 50, p.y + p.dir.y * 50 / A());
}

// ------------------------------------------------------------------ Dibujo del vagón (capa fina)
const CART_W = 11, CART_TOP = -17;   // en celdas finas; el caballero va metido hasta la cintura
function cartCells(part) {
  const cells = [];
  const wood = [125, 82, 45], dark = [70, 45, 25], iron = [150, 150, 160];
  if (part !== 'front') {
    for (let x = -CART_W + 2; x <= CART_W - 2; x++) cells.push([x, CART_TOP - 3, '_', dark]);
    for (let y = CART_TOP - 2; y < CART_TOP; y++) cells.push([-CART_W + 1, y, '/', iron], [CART_W - 1, y, '\\', iron]);
  }
  if (part !== 'back') {
    for (let x = -CART_W; x <= CART_W; x++) cells.push([x, CART_TOP, x === -CART_W || x === CART_W ? '+' : '=', iron]);
    for (let y = CART_TOP + 1; y <= -4; y++) for (let x = -CART_W; x <= CART_W; x++) {
      const band = x === -CART_W || x === CART_W || x === 0 || y === Math.round(CART_TOP / 2);
      const plank = (x + 30) % 4 === 0;
      cells.push([x, y, band ? (y === Math.round(CART_TOP / 2) ? '=' : '|') : plank ? '|' : '#', band ? iron : plank ? dark : wood]);
    }
    for (let x = -CART_W; x <= CART_W; x++) cells.push([x, -3, x === -CART_W || x === CART_W ? '+' : '=', iron]);
    for (const wx of [-7, 7]) cells.push([wx - 1, -2, '(', [100, 100, 110]], [wx, -2, 'O', [125, 125, 135]], [wx + 1, -2, ')', [100, 100, 110]],
                                          [wx - 1, -1, '\\', [80, 80, 90]], [wx, -1, '_', [80, 80, 90]], [wx + 1, -1, '/', [80, 80, 90]]);
    for (let x = -5; x <= 5; x++) cells.push([x, -2, '-', [60, 60, 70]]);
  }
  return cells;
}

function drawCart(x, y, c0, r0, part = 'all') {
  if (x < c0 - 20 || x > c0 + R.cols + 20 || y < r0 - 10 || y > r0 + R.rows + 10) return;
  const L = lightAt(x, y - 3);
  const lr = Math.max(0.4, L[0]), lg = Math.max(0.4, L[1]), lb = Math.max(0.4, L[2]);
  const fsc = Math.round(x * FINE) - c0 * FINE, fsr = Math.round(y * FINE) - r0 * FINE;
  if (part !== 'front') for (let k = -5; k <= 5; k++) R.dim(Math.round(x) - c0 + k, Math.round(y) - r0, 0.5);
  const mains = new Map(), fd = R.fdata;
  for (const [cx, cy, ch, c] of cartCells(part)) {
    const fx = fsc + Math.round(cx), fy = fsr + cy;
    const fi = R.fput(fx, fy, ch.charCodeAt(0), c[0] * lr, c[1] * lg, c[2] * lb);
    const mx = Math.floor(fx / FINE), my = Math.floor(fy / FINE);
    if (fi < 0 || mx < 0 || my < 0 || mx >= R.cols || my >= R.rows) continue;
    const mo = (my * R.cols + mx) * 4;
    if (!mains.has(mo)) mains.set(mo, []);
    mains.get(mo).push({ fi, b0: fd[fi], b1: fd[fi + 1] });
  }
  const d = R.data;
  for (const [mo, fine] of mains) fineOcc.push({ mo, s0: d[mo], s1: d[mo + 1], s2: d[mo + 2], s3: d[mo + 3], fine, hero: false });
}

// Vagones aparcados en las estaciones
function cartDrawables(drawables, c0, r0) {
  if (!world.under || !world.lines) return;
  for (const line of world.lines) for (const c of line.carts) {
    const p = cellOfTile(c.x, c.y);
    if (player.riding && player.riding.line === line && Math.abs(p.x - player.x) < 1 && Math.abs(p.y - player.y) < 2) continue;
    const y = c.y * TH + TH / 2;
    drawables.push({ y, draw: () => drawCart(p.x, y, c0, r0) });
  }
}

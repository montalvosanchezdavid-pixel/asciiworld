'use strict';
// Asedios: cada pocos minutos suena la campana y una horda (goblins, orcos y bandidos con un
// caudillo orco) marcha antorcha en mano contra una población. Durante el asedio cruzan las
// zonas seguras (solo lo que está intramuros, el castillo y Altamira, les es impenetrable)
// siguiendo un mapa de rutas hasta las puertas, y van de casa en casa prendiendo fuego. Las
// casas arden poco a poco (llamas en el tejado y en las ventanas, humo, pavesas) y se
// ennegrecen. Si cae más de la mitad, el pueblo cae: sus gentes no te atienden y tardan tres
// días en reconstruirlo, con andamios a la vista. Si acabas con la horda, se apagan los fuegos.

const RAID_FIRST = 200, RAID_EVERY = [300, 460];
const REBUILD_DAYS = 3, FALL_SHARE = 0.55;
const FIRE_DELAY = 150;        // segundos desde la campana hasta que empiezan a prender fuego
const SPAWN_GAP = 3.5;         // los saqueadores salen del bosque uno tras otro
let raid = null, raidT = RAID_FIRST;

function surfWorld() { return world.under && surfLevel ? surfLevel.world : world; }

// Intramuros de las dos grandes ciudades: el castillo con Villa Real y la Altamira amurallada
function inWalls(tx, ty) {
  const w = surfWorld(), c = w.castle, a = w.city;
  if (tx >= c.x && tx < c.x + c.w && ty >= c.y && ty < c.y + c.h) return true;
  w._vr ||= w.regions.find(r => r.name === 'Villa Real');
  const v = w._vr;
  if (v && tx >= v.x0 && tx <= v.x1 && ty >= v.y0 && ty <= v.y1) return true;
  return !!a && tx >= a.x - 46 && tx < a.x + 46 && ty >= a.y - 31 && ty < a.y + 31;
}

function settlements() {
  const w = surfWorld();                                  // los pueblos son siempre los de la superficie
  if (!w.settlements) {
    w.settlements = w.villages.map(v => ({ x: v.x, y: v.y, name: v.name, main: !!v.main, burnedAt: -1 }));
    if (w.city) w.settlements.push({ x: w.city.x, y: w.city.y, name: 'Altamira', big: true, burnedAt: -1 });
    for (const s of w.settlements) s.houses = w.buildings.filter(b => Math.hypot(b.x + b.w / 2 - s.x, b.y + b.h / 2 - s.y) < settlementR(s)
      && !inWalls(b.x + (b.w >> 1), b.y + (b.h >> 1)) && b.outside);
  }
  return w.settlements;
}
const settlementCell = s => cellOfTile(s.x, s.y);
const settlementR = s => (s.big ? 75 : s.main ? 60 : 20);       // radio en casillas (ciudades: sus arrabales)
const isBurned = s => s.burnedAt >= 0;

function dirFromPlayer(s) {
  const a = Math.atan2((s.y + 0.5) * TH - player.y, ((s.x + 0.5) * TW - player.x) / 2);
  return ['este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste', 'norte', 'noreste'][((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
}

// ¿El PNJ es de un pueblo caído? (intramuros no se ve afectado)
function burnedHere(x, y) {
  if (world.under || inWalls(x / TW, y / TH)) return null;
  return settlements().find(s => isBurned(s) && Math.hypot(x / TW - s.x, y / TH - s.y) < settlementR(s));
}

// ---------------------------------------------------------------- mapa de rutas hacia las casas
// Búsqueda en anchura desde las puertas de las casas que aún no arden; cada saqueador baja
// por el gradiente hasta la puerta más cercana. Intramuros queda fuera del mapa.
function buildFlow(r) {
  const w = surfWorld(), s = r.s, R0 = settlementR(s) + 50;
  const x0 = Math.max(0, s.x - R0), y0 = Math.max(0, s.y - R0), x1 = Math.min(w.W - 1, s.x + R0), y1 = Math.min(w.H - 1, s.y + R0);
  const FW = x1 - x0 + 1, FH = y1 - y0 + 1;
  const d = new Float32Array(FW * FH).fill(1e9);
  const q = [];
  for (const b of s.houses) if (!(b.fire > 0) && !(b.char >= 0.95)) {
    const o = b.outside; if (o.x < x0 || o.y < y0 || o.x > x1 || o.y > y1) continue;
    d[(o.y - y0) * FW + (o.x - x0)] = 0; q.push(o.x - x0, o.y - y0);
  }
  for (let h = 0; h < q.length; h += 2) {
    const x = q[h], y = q[h + 1], dv = d[y * FW + x];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= FW || ny >= FH) continue;
      const i = ny * FW + nx;
      if (d[i] <= dv + 1) continue;
      const t = w.get(nx + x0, ny + y0);
      if (!TILE_DEFS[t].pass || t === T.DOOR || inWalls(nx + x0, ny + y0)) continue;
      d[i] = dv + 1; q.push(nx, ny);
    }
  }
  r.flow = { d, x0, y0, FW, FH }; r.flowT = 0;
}
function flowAt(r, tx, ty) {
  const f = r.flow; if (!f) return 1e9;
  const x = tx - f.x0, y = ty - f.y0;
  return x < 0 || y < 0 || x >= f.FW || y >= f.FH ? 1e9 : f.d[y * f.FW + x];
}

// ---------------------------------------------------------------- empieza el asedio
function startRaid() {
  const list = settlements().filter(s => !isBurned(s) && s.houses.some(b => !(b.char > 0.3)));
  if (!list.length) return;
  const px = player.x / TW, py = player.y / TH;
  const near = list.filter(s => Math.hypot(s.x - px, s.y - py) < 170);
  const cands = near.length ? near : list.sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py)).slice(0, 2);
  const s = cands[(Math.random() * cands.length) | 0];
  const c = settlementCell(s);
  // salen del bosque más cercano al pueblo desde el que haya camino (si no hay bosque, de las afueras)
  const probe = { s };
  buildFlow(probe);
  let gx = c.x, gy = c.y, best = 1e9;
  for (let t = 0; t < 900; t++) {
    const a = Math.random() * Math.PI * 2, rr = (settlementR(s) + 14 + Math.random() * 30) * TW;
    const x = c.x + Math.cos(a) * rr, y = c.y + Math.sin(a) * rr / A() * 0.9;
    if (!passable(x, y) || isSafe(x, y) || inWalls(x / TW, y / TH) || flowAt(probe, Math.floor(x / TW), Math.floor(y / TH)) >= 1e9) continue;
    const tt = tileOf(x, y), forest = tt === T.FOREST || tt === T.PINE;
    const score = rr + (forest ? 0 : 400);
    if (score < best) { best = score; gx = x; gy = y; }
  }
  const n = Math.min(14, 6 + Math.floor(player.lvl * 1.5));
  const types = ['warlord'];
  for (let k = 0; k < n; k++) { const q = Math.random(); types.push(q < 0.4 ? 'goblin' : q < 0.75 ? 'orc' : 'bandit'); }
  types.reverse();                                   // el caudillo sale el último
  raid = { s, raiders: [], queue: types.map((type, k) => ({ type, at: 2 + k * SPAWN_GAP })), gx, gy, t: 0, hp: 100, fireWarned: false, flow: probe.flow, flowT: 0 };
  msg(`¡Suena la campana! Una horda asedia ${s.big || s.main ? 'los arrabales de ' : 'la aldea de '}${s.name} (al ${dirFromPlayer(s)}). ¡Corre a defenderla!`, [255, 120, 80]);
  Sfx.bell();
  shake = Math.max(shake, 0.2);
}

// Un saqueador que no está peleando contigo: sigue las rutas hasta una casa y le prende fuego
function raiderMarch(e, dt) {
  const r = e.raider;
  if (!r) return false;
  if (dist(e, player) < e.sight * 0.7 && !player.onWall) return false;          // te ha visto: pelea normal
  const tx = Math.floor(e.x / TW), ty = Math.floor(e.y / TH);
  const here = flowAt(r, tx, ty);
  if (e.torchT > 0) { e.torchT -= dt; return true; }
  if (here <= 1 && r.t < FIRE_DELAY) {                                         // rodean las casas y amenazan
    if (Math.random() < dt * 0.6) { e.atkAnim = 0.3; e.facing = -e.facing; }
    e.anim += dt * 2;
    return true;
  }
  if (here <= 1) {                                                              // en la puerta: ¡fuego!
    const b = r.s.houses.find(b => Math.abs(b.outside.x - tx) <= 1 && Math.abs(b.outside.y - ty) <= 1 && !(b.fire > 0) && !(b.char >= 0.95));
    if (b) { b.fire = 0.08; r.flowDirty = true; }
    e.torchT = 1.4; e.atkAnim = 0.3;
    for (let k = 0; k < 12; k++) particles.push({ x: e.x + e.facing * 3, y: e.y - 6, vx: e.facing * 8 + (Math.random() - 0.5) * 6, vy: -4 - Math.random() * 6,
      life: 0.6, max: 0.6, float: true, ch: "*'^"[(Math.random() * 3) | 0], c: [255, 180, 60] });
    return true;
  }
  // baja por el gradiente del mapa de rutas (8 vecinos, sin cortar esquinas)
  let best = here, bx = 0, by = 0;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const v = flowAt(r, tx + dx, ty + dy);
    if (v < best && (dx === 0 || dy === 0 || (flowAt(r, tx + dx, ty) < 1e9 && flowAt(r, tx, ty + dy) < 1e9))) { best = v; bx = dx; by = dy; }
  }
  let mx, my;
  if (best < here) { mx = (tx + bx + 0.5) * TW - e.x; my = ((ty + by + 0.5) * TH - e.y) * A(); }
  else { const c = settlementCell(r.s); mx = c.x - e.x; my = (c.y - e.y) * A(); }
  const l = Math.hypot(mx, my) || 1, sp = e.spd * 0.7;
  const ox = e.x, oy = e.y;
  moveBody(e, mx / l * sp * dt, my / l * sp / A() * dt, false);
  // atascado contra una roca o un borde: rodea por un lado y, si no, salta a la casilla siguiente
  if (Math.hypot(e.x - ox, e.y - oy) < sp * dt * 0.25) {
    e.stuckT = (e.stuckT || 0) + dt;
    const side = (e.stuckT * 2 | 0) % 2 ? 1 : -1;
    moveBody(e, -my / l * sp * dt * side, mx / l * sp / A() * dt * side, false);
    if (e.stuckT > 1.2 && best < here) {
      const nx = (tx + bx + 0.5) * TW, ny = (ty + by + 0.5) * TH;
      if (passable(nx, ny)) { e.x = nx; e.y = ny; }
      e.stuckT = 0;
    }
  } else e.stuckT = 0;
  e.facing = mx > 0 ? 1 : -1; e.anim += dt * 7;
  return true;
}

// ---------------------------------------------------------------- incendio y reconstrucción
function burnState(s) {
  const n = s.houses.length || 1;
  return { burnt: s.houses.filter(b => (b.char || 0) >= 0.6).length / n, burning: s.houses.filter(b => b.fire > 0).length };
}

function updateRaids(dt) {
  if (state !== 'play') return;
  const sw = settlements();
  for (const s of sw) for (const b of s.houses) {
    if (b.fire > 0) {
      if (b.extinguish) b.fire = Math.max(0, b.fire - dt * 0.25);
      else if (b.char < 1) b.fire = Math.min(1, b.fire + dt * 0.07);              // el fuego prende y crece
      else b.fire = Math.max(0, b.fire - dt * 0.03);                              // casa consumida: se va apagando
      b.char = Math.min(1, (b.char || 0) + dt * 0.016 * b.fire);
      if (!b.crashed && b.char > 0.6) {
        b.crashed = true;
        if (Math.hypot((b.x + b.w / 2) * TW - player.x, (b.y + b.h / 2) * TH - player.y) < 260) { Sfx.crash(); shake = Math.max(shake, 0.15); }
      }
      if (b.fire <= 0) b.extinguish = false;
    } else if (b.char > 0 && !(raid && raid.s === s)) {
      b.char = Math.max(0, b.char - dt / (REBUILD_DAYS * DAY_SECONDS));         // reconstrucción: 3 días
      if (b.char < 0.5) b.crashed = false;
    }
  }
  for (const s of sw) if (isBurned(s) && s.houses.every(b => !(b.char > 0.02) && !(b.fire > 0))) {
    s.burnedAt = -1;
    msg(`${s.name} ha sido reconstruida. Sus gentes vuelven al trabajo.`, [200, 220, 160]);
  }
  if (!raid) {
    raidT -= dt;
    if (raidT <= 0 && !world.under && !dialog) startRaid();
    if (raidT <= 0) raidT = RAID_EVERY[0] + Math.random() * (RAID_EVERY[1] - RAID_EVERY[0]);
    return;
  }
  raid.t += dt;
  while (raid.queue.length && raid.queue[0].at <= raid.t) {
    const q = raid.queue.shift();
    let x = raid.gx, y = raid.gy;
    for (let t = 0; t < 20; t++) { const xx = raid.gx + (Math.random() - 0.5) * 24, yy = raid.gy + (Math.random() - 0.5) * 8; if (passable(xx, yy)) { x = xx; y = yy; break; } }
    const e = makeEnemy(q.type, x, y);
    e.raider = raid; raid.raiders.push(e); enemies.push(e);
    burst(x, y - 4, 10, "',%", [90, 140, 60], [50, 90, 40], 14, 0.7);                // salen entre la maleza
  }
  if (!raid.fireWarned && raid.t >= FIRE_DELAY) {
    raid.fireWarned = true;
    msg(`¡Los saqueadores prenden fuego a ${raid.s.name}!`, [255, 110, 60]);
  }
  raid.flowT = (raid.flowT || 0) + dt;
  if (raid.flowDirty && raid.flowT > 1.5) { raid.flowDirty = false; buildFlow(raid); }
  const s = raid.s, alive = raid.raiders.filter(e => !e.dead), pending = raid.queue.length;
  const st = burnState(s);
  raid.hp = Math.max(0, Math.round(100 * (1 - st.burnt / FALL_SHARE)));
  if (st.burning && Math.random() < dt * 1.5) {
    const ns = npcs.filter(n => !n.camper && Math.hypot(n.x / TW - s.x, n.y / TH - s.y) < settlementR(s) && dist(n, player) < 220);
    if (ns.length) { const n = ns[(Math.random() * ns.length) | 0]; floater(n.x, n.y - 14, ['¡Fuego!', '¡Socorro!', '¡Agua, traed agua!', '¡Nos atacan!', '¡Corred!'][(Math.random() * 5) | 0], [255, 200, 150]); }
  }
  if (!alive.length && !pending) {
    const gold = 50 + player.lvl * 20;
    player.gold += gold;
    gainXp(60 + player.lvl * 10);
    msg(`¡Has salvado ${s.name}! Los aldeanos apagan los fuegos y te vitorean. (+${gold} oro)`, [255, 215, 60]);
    floater(player.x, player.y - 14, '¡VICTORIA!', [255, 215, 60]);
    Sfx.levelUp();
    for (const b of s.houses) if (b.fire > 0) b.extinguish = true;
    if (isNight()) { const c = settlementCell(s); releaseLanterns(c.x, c.y, 20); msg('Los aldeanos sueltan farolillos en tu honor.', [255, 200, 120]); }
    for (const n of npcs) if (Math.hypot(n.x / TW - s.x, n.y / TH - s.y) < settlementR(s) && dist(n, player) < 200 && Math.random() < 0.6)
      floater(n.x, n.y - 14, ['¡Hurra!', '¡Viva el caballero!', '¡Gracias!', '¡Salvados!'][(Math.random() * 4) | 0], [240, 230, 180]);
    raid = null; raidT = RAID_EVERY[0] + Math.random() * (RAID_EVERY[1] - RAID_EVERY[0]);
    return;
  }
  if (st.burnt >= FALL_SHARE) {
    s.burnedAt = dayTime;
    msg(`${s.name} ha caído y arde. Tardarán ${REBUILD_DAYS} días en reconstruirla; hasta entonces sus gentes no podrán atenderte.`, [255, 90, 60]);
    for (const e of alive) { e.raider = null; e.leash = 60; e.home = { x: e.x, y: e.y }; }
    raid = null; raidT = RAID_EVERY[0] + Math.random() * (RAID_EVERY[1] - RAID_EVERY[0]);
  }
}

// ---------------------------------------------------------------- efectos visuales
function roofRidge(b) { return { y: (b.y + b.h / 2) * TH - bldWallH(b) - roofPitch(b) }; }
function visibleHouses(pad = 300) {
  if (world.under) return [];
  const out = [];
  for (const s of settlements()) {
    const c = settlementCell(s);
    if (Math.abs(c.x - player.x) > pad + 460 || Math.abs(c.y - player.y) > pad + 120) continue;
    for (const b of s.houses) if (b.fire > 0 || b.char > 0) out.push(b);
  }
  return out;
}

let raidFireT = 0;
function updateRaidFires(dt) {
  if (world.under) return;
  raidFireT -= dt;
  if (raidFireT > 0) return;
  raidFireT = 0.035;
  for (const b of visibleHouses()) {
    const f = b.fire || 0;
    if (Math.abs((b.x + b.w / 2) * TW - player.x) > 300) continue;
    if (f > 0) {
      const ry = roofRidge(b).y;
      for (let k = 0; k < 1 + f * 4; k++)                       // pavesas que suben alto
        particles.push({ x: (b.x + Math.random() * b.w) * TW, y: ry - Math.random() * 4 * f, vx: (Math.random() - 0.5) * 5 + windS * 3, vy: -8 - Math.random() * 14 * f,
                         life: 0.6 + f, max: 0.6 + f, float: true, ch: "*'.^"[(Math.random() * 4) | 0], c: lerp3([255, 230, 120], [255, 70, 10], Math.random()) });
      if (Math.random() < 0.3 + f * 0.6) particles.push({ x: (b.x + Math.random() * b.w) * TW, y: ry - 6 - Math.random() * 4, vx: windS * 5 + (Math.random() - 0.5) * 2,
        vy: -3 - Math.random() * 3, life: 4 + f * 3, max: 4 + f * 3, float: true, ch: '~o.'[(Math.random() * 3) | 0], c: [70 + 30 * Math.random(), 66, 64] });   // humo negro
    } else if (b.char > 0.05 && Math.random() < 0.2) {          // ruinas humeantes / obras con serrín
      particles.push({ x: (b.x + Math.random() * b.w) * TW, y: (b.y + b.h) * TH - 3, vx: (Math.random() - 0.5) * 3, vy: -3, life: 1.2, max: 1.2, float: true,
                       ch: b.char > 0.5 ? '~' : "'", c: b.char > 0.5 ? [110, 108, 104] : [230, 200, 120] });
      if (b.char < 0.97 && Math.random() < 0.1) Sfx.hammer((b.x + b.w / 2) * TW, (b.y + b.h) * TH);
    }
  }
}

function raidLights(addL) {
  for (const b of visibleHouses()) if (b.fire > 0)
    addL({ x: (b.x + b.w / 2) * TW, y: (b.y + b.h) * TH, r: 40 + 35 * b.fire, color: [1, 0.42, 0.1], k: 0.6 + 2.2 * b.fire, flicker: b.id }, 1);
  for (const e of enemies) if (e.raider && !e.dead) addL({ x: e.x + e.facing * 3, y: e.y - 2, r: 16, color: [1, 0.6, 0.25], k: 0.8, flicker: e.x }, 1);
}

// Tras el barrido del mundo: casas ennegrecidas, llamas en tejado y ventanas, andamios
function drawRaidFlames(c0, r0) {
  const d = R.data, cols = R.cols, rows = R.rows;
  for (const b of visibleHouses()) {
    if (b === player.bld) continue;
    const X0 = b.x * TW, X1 = (b.x + b.w) * TW - 1, Yb = (b.y + b.h) * TH - 1, hw = bldWallH(b), top = Math.round(roofRidge(b).y) - 2;
    const ch = b.char || 0, f = b.fire || 0;
    // 1) carbonizado: los colores del edificio se apagan hacia el negro
    if (ch > 0.02) {
      for (let wy = top - 2; wy <= Yb; wy++) {
        const sr = wy - r0; if (sr < 0 || sr >= rows) continue;
        const o = lean(X0, Math.min(Math.max(0, Yb - wy), hw));
        for (let wx = X0 - 1; wx <= X1 + 1; wx++) {
          const sc = wx + o - c0; if (sc < 0 || sc >= cols) continue;
          const i = (sr * cols + sc) * 4;
          const n = hash2(wx, wy) * 0.3;
          d[i + 1] *= 1 - ch * (0.6 + n); d[i + 2] *= 1 - ch * (0.72 + n); d[i + 3] *= 1 - ch * (0.75 + n);
          if (ch > 0.6 && hash2(wx * 3, wy) > 0.86) d[i] = 14;            // huecos y ceniza
        }
      }
    }
    if (f > 0) {
      // 2) llamas sobre la cumbrera, más altas y extensas cuanto más arde
      const ry = Math.round(roofRidge(b).y) - r0;
      for (let wx = X0 + 1; wx < X1; wx++) {
        if (hash2(wx, b.id) > 0.2 + f * 0.9) continue;
        const sx = wx + lean(wx, hw + 4) - c0; if (sx < 0 || sx >= cols) continue;
        const hgt = 1 + f * (3 + Math.max(0, Math.sin(wx * 0.7 + time * 6) * 2 + Math.sin(wx * 0.23 - time * 4.3) * 2.5));
        for (let h = 0; h < hgt; h++) {
          const sy = ry - h; if (sy < 0 || sy >= rows) continue;
          const kk = 1 - h / (hgt + 1);
          const g = h === 0 ? (Math.sin(time * 15 + wx) > 0 ? 64 : 35) : "^)(*'"[(wx + h + ((time * 12) | 0)) % 5].charCodeAt(0);
          R.put(sx, sy, g, 255, 80 + 160 * kk, 15 + 100 * kk * kk);
        }
      }
      // 3) llamas que salen por puertas y ventanas de la fachada
      if (f > 0.3) for (let wx = X0 + 2; wx < X1 - 1; wx += 3) {
        if (hash2(wx, b.id + 7) > f) continue;
        const z = 2 + ((hash2(wx, b.id) * Math.max(1, hw - 4)) | 0);
        const sx = wx + lean(wx, z) - c0, sy = Yb - z - r0 - (((time * 8 + wx) | 0) % 2);
        if (sx >= 0 && sx < cols && sy >= 0 && sy < rows) R.put(sx, sy, Math.sin(time * 11 + wx) > 0 ? 94 : 41, 255, 150 + 80 * Math.random(), 40);
      }
    }
    // 4) reconstrucción: andamios de madera en la fachada
    if (f <= 0 && ch > 0.04 && ch < 0.97) {
      for (let wx = X0; wx <= X1; wx++) for (let z = 0; z <= hw; z++) {
        const pole = (wx - X0) % 6 === 0, plank = z % 4 === 3;
        if (!pole && !plank) continue;
        const sx = wx + lean(wx, z) - c0, sy = Yb - z - r0;
        if (sx < 0 || sx >= cols || sy < 0 || sy >= rows) continue;
        R.put(sx, sy, pole ? 124 : 61, 165, 118, 70);
      }
    }
  }
}

// Aviso en pantalla mientras dura el asedio
function drawRaidHud() {
  if (!raid) return;
  const alive = raid.raiders.filter(e => !e.dead).length + raid.queue.length;
  const left = Math.max(0, Math.ceil(FIRE_DELAY - raid.t));
  const fire = left > 0 ? `arderá en ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : `pueblo ${raid.hp}%`;
  const t = `¡ASEDIO A ${raid.s.name.toUpperCase()}! (al ${dirFromPlayer(raid.s)})  ·  quedan ${alive}  ·  ${fire}`;
  const blink = Math.floor(time * 2) % 2 ? 1 : 0.75;
  UI.text(Math.max(1, (UI.cols - t.length) >> 1), 10, t, 255 * blink, 110 * blink, 70 * blink);
}

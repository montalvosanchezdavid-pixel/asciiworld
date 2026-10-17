'use strict';
// Vida y luz de la noche: murciélagos que revolotean (también en las catacumbas) y rondan tu
// antorcha, fuegos fatuos en cementerios y bosques, corros de setas luminiscentes, destellos
// de luna sobre el agua y ventanas encendidas que derraman luz cálida en las calles.

let bats = [], wisps = [], batT = 0, wispT = 0;
const nightK = () => (world.under ? 1 : Math.max(0, Math.min(1, (0.62 - daylight()) / 0.35)));
const dayFrac = () => ((dayTime % 1) + 1) % 1;

// ---------------------------------------------------------------- murciélagos
function spawnBatFlock() {
  for (let k = 0; k < 15; k++) {
    const x = camX + (Math.random() - 0.5) * R.cols * 1.2, y = camY + (Math.random() - 0.5) * R.rows * 1.2;
    if (!passable(x, y) && !world.under) continue;
    if (world.under && !passable(x, y)) continue;
    const n = 3 + ((Math.random() * 6) | 0);
    const flock = { x, y, t: 0 };
    for (let i = 0; i < n; i++) bats.push({ x: x + (Math.random() - 0.5) * 12, y: y + (Math.random() - 0.5) * 5, z: (world.under ? 4 : 7) + Math.random() * 7,
      vx: 0, vy: 0, ph: Math.random() * 10, flock, tx: x, ty: y, tt: 0, sp: 34 + Math.random() * 16, life: 0 });
    return;
  }
}

function updateBats(dt) {
  const nk = nightK();
  const want = world.under ? 16 : nk > 0.5 ? 22 : 0;
  batT -= dt;
  if (bats.length < want && batT <= 0) { batT = 0.6; spawnBatFlock(); }
  const a = A(), torch = isDarkHere();
  for (const b of bats) {
    b.ph += dt; b.tt -= dt; b.life = Math.min(1, b.life + dt);
    if (b.tt <= 0) {                                   // nuevo rumbo: alrededor de la bandada o de tu antorcha
      b.tt = 0.4 + Math.random() * 0.9;
      const lure = torch && Math.hypot(player.x - b.x, (player.y - b.y) * a) < 70 && Math.random() < 0.45;
      const cx = lure ? player.x : b.flock.x, cy = lure ? player.y - 4 : b.flock.y;
      const ang = Math.random() * Math.PI * 2, r = lure ? 8 + Math.random() * 14 : 6 + Math.random() * 22;
      b.tx = cx + Math.cos(ang) * r; b.ty = cy + Math.sin(ang) * r / a;
    }
    const dx = b.tx - b.x, dy = (b.ty - b.y) * a, d = Math.hypot(dx, dy) || 1;
    b.vx += (dx / d * b.sp - b.vx) * Math.min(1, dt * 5) + (Math.random() - 0.5) * 90 * dt;
    b.vy += (dy / d * b.sp / a - b.vy) * Math.min(1, dt * 5) + (Math.random() - 0.5) * 45 * dt;
    // si corres hacia ellos, se espantan
    const pd = Math.hypot(b.x - player.x, (b.y - player.y) * a);
    if (pd < 12 && player.moving && player.dashT > 0) { b.vx += (b.x - player.x) / pd * 300 * dt; b.vy += (b.y - player.y) / pd * 150 * dt; }
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.z += Math.sin(b.ph * 7) * dt * 6;
    b.z = Math.max(3, Math.min(world.under ? 6 : 16, b.z));
    if (pd < 40 && Math.random() < dt * 0.25) Sfx.squeak();
  }
  // la bandada deriva despacio
  for (const b of bats) if (!b.flock.moved) { b.flock.moved = true; b.flock.x += (Math.random() - 0.5) * 30 * dt; b.flock.y += (Math.random() - 0.5) * 12 * dt; }
  for (const b of bats) b.flock.moved = false;
  bats = bats.filter(b => want > 0 && Math.abs(b.x - camX) < R.cols * 0.9 && Math.abs(b.y - camY) < R.rows * 1.1);
}

function drawBats(c0, r0) {
  for (const b of bats) {
    const sx = Math.round(b.x + lean(b.x, b.z)) - c0, sy = Math.round(b.y - b.z) - r0;
    const L = lightInto(b.x, b.y);
    const k = Math.max(0.45, Math.min(1.3, (L[0] + L[1] + L[2]) / 3)) * b.life;
    const up = Math.sin(b.ph * 26) > 0;
    const col = [95 * k, 85 * k, 115 * k];
    R.put(sx - 1, sy, up ? 92 : 47, ...col);           // \ o /
    R.put(sx, sy, 118, 70 * k, 60 * k, 85 * k);        // v
    R.put(sx + 1, sy, up ? 47 : 92, ...col);
    if (L[0] > 0.6) R.put(sx, sy - 1, 46, 200 * k, 40, 40);   // ojillos rojos a la luz
    R.dim(Math.round(b.x) - c0, Math.round(b.y) - r0, 0.75); // sombra
  }
}

// ---------------------------------------------------------------- fuegos fatuos
function wispSpot() {
  const cems = (world.cemeteries || []).filter(c => Math.abs((c.x0 + c.x1) / 2 * TW - camX) < R.cols && Math.abs((c.y0 + c.y1) / 2 * TH - camY) < R.rows * 1.2);
  if (cems.length && Math.random() < 0.7) {
    const c = cems[(Math.random() * cems.length) | 0];
    return { x: (c.x0 + 1 + Math.random() * (c.x1 - c.x0 - 1)) * TW, y: (c.y0 + 1 + Math.random() * (c.y1 - c.y0 - 1)) * TH };
  }
  for (let k = 0; k < 15; k++) {
    const x = camX + (Math.random() - 0.5) * R.cols * 1.1, y = camY + (Math.random() - 0.5) * R.rows * 1.1;
    const t = tileOf(x, y);
    if ((t === T.FOREST || t === T.PINE) && !isSafe(x, y)) return { x, y };
  }
  return null;
}
function updateWisps(dt) {
  const nk = world.under ? 0 : nightK();
  wispT -= dt;
  if (nk > 0.6 && wisps.length < 7 && wispT <= 0) {
    wispT = 1.5;
    const s = wispSpot();
    if (s) wisps.push({ ...s, hx: s.x, hy: s.y, z: 3 + Math.random() * 3, ph: Math.random() * 10, life: 0, vx: 0, vy: 0, col: Math.random() < 0.7 ? [110, 255, 230] : [150, 180, 255] });
  }
  const a = A();
  for (const w of wisps) {
    w.ph += dt; w.life = Math.min(1, w.life + dt * 0.5);
    const dx = w.x - player.x, dy = (w.y - player.y) * a, d = Math.hypot(dx, dy) || 1;
    if (d < 34) { w.vx += dx / d * 60 * dt; w.vy += dy / d * 30 * dt; }           // se aleja si te acercas
    w.vx += ((w.hx - w.x) * 0.15 + Math.sin(w.ph * 0.7) * 4 - w.vx) * dt;
    w.vy += ((w.hy - w.y) * 0.3 + Math.cos(w.ph * 0.5) * 2 - w.vy) * dt;
    w.x += w.vx * dt; w.y += w.vy * dt;
    w.z = 3.5 + Math.sin(w.ph * 1.3) * 1.5;
  }
  wisps = wisps.filter(w => nk > 0.4 && Math.abs(w.x - camX) < R.cols * 1.2 && Math.abs(w.y - camY) < R.rows * 1.4);
}
function drawWisps(c0, r0) {
  for (const w of wisps) {
    const p = (0.65 + 0.35 * Math.sin(w.ph * 3.1)) * w.life;
    const sx = Math.round(w.x + lean(w.x, w.z)) - c0, sy = Math.round(w.y - w.z) - r0;
    const c = w.col;
    R.put(sx, sy, p > 0.8 ? 64 : 79, Math.min(255, c[0] * p + 60), Math.min(255, c[1] * p + 40), Math.min(255, c[2] * p + 40));
    for (const [ox, oy, ch] of [[-1, 0, 40], [1, 0, 41], [0, -1, 39], [0, 1, 46]]) R.put(sx + ox, sy + oy, ch, c[0] * p * 0.6, c[1] * p * 0.6, c[2] * p * 0.6);
    if (Math.random() < 0.15) particles.push({ x: w.x + (Math.random() - 0.5) * 2, y: w.y - w.z, vx: (Math.random() - 0.5) * 2, vy: 1.5, life: 0.8, max: 0.8, float: true, ch: '.', c: c });
  }
}

// ---------------------------------------------------------------- setas luminiscentes
function shroomsInView(c0, r0) {
  if (!terr.shrooms || world.under) return [];
  return terr.shrooms.filter(s => s.x > c0 - 4 && s.x < c0 + R.cols + 4 && s.y > r0 - 4 && s.y < r0 + R.rows + 4);
}
function shroomDrawables(drawables, c0, r0) {
  const nk = nightK();
  if (nk < 0.3) return;
  for (const s of shroomsInView(c0, r0)) drawables.push({ y: s.y, draw: () => {
    const p = (0.6 + 0.4 * Math.sin(time * 1.7 + s.ph)) * nk;
    for (const [ox, oy, ch] of s.cells) R.put(Math.round(s.x + ox) - c0, Math.round(s.y + oy) - r0, ch, s.c[0] * p, s.c[1] * p, s.c[2] * p);
  } });
}

// ---------------------------------------------------------------- luces de la noche
// ventanas: casi todas encendidas al anochecer; de madrugada algunas se apagan
function windowLit(b) {
  if (b.char > 0.3 || b.fire > 0.2) return false;
  if (!(b.hearth || hash2(b.id, 9) > 0.3)) return false;
  const f = dayFrac();
  if ((f > 0.97 || f < 0.2) && hash2(b.id, Math.floor(dayTime)) > 0.45) return false;
  return true;
}
function nightLights(addL, c0, r0) {
  const nk = nightK();
  if (!world.under && nk > 0.2) {
    // las ventanas más cercanas al caballero (hasta 14)
    const cx = c0 + R.cols / 2, cy = r0 + R.rows / 2;
    const lit = [];
    for (const b of world.buildings) {
      if (b === player.bld) continue;
      const x = (b.x + b.w / 2) * TW, y = (b.y + b.h) * TH + 1;
      if (x < c0 - 30 || x > c0 + R.cols + 30 || y < r0 - 10 || y > r0 + R.rows + 25 || !windowLit(b)) continue;
      lit.push({ b, x, y, d: Math.abs(x - cx) + Math.abs(y - cy) * 2 });
    }
    lit.sort((p, q) => p.d - q.d);
    for (const { b, x, y } of lit.slice(0, 14)) addL({ x, y, r: 14 + b.w, color: [1, 0.7, 0.35], k: 0.75 * nk, flicker: b.id * 1.7 }, 1);
    let m = 0;
    for (const s of shroomsInView(c0, r0)) { if (m++ > 6) break; addL({ x: s.x, y: s.y, r: 12, color: s.c.map(v => v / 255), k: 0.55 * nk, flicker: s.ph }, 1); }
  }
  for (const w of wisps) addL({ x: w.x, y: w.y, r: 22, color: w.col.map(v => v / 255), k: (0.7 + 0.3 * Math.sin(w.ph * 3.1)) * w.life, flicker: w.ph }, 1);
}

// destellos de luna sobre el agua
function drawMoonGlints(c0, r0) {
  const nk = nightK();
  if (world.under || nk < 0.4 || weather.rain > 0.5) return;
  const { water, CW, CH } = terr, tk = Math.floor(time * 3);
  for (let r = 0; r < R.rows; r++) {
    const wy = r + r0; if (wy < 0 || wy >= CH) continue;
    for (let c = 0; c < R.cols; c++) {
      const wx = c + c0; if (wx < 0 || wx >= CW || water[wy * CW + wx] !== 1) continue;
      const h = hash2(wx + tk * 31, wy * 3 + (tk >> 1));
      if (h < 0.982) continue;
      const k = (h - 0.982) / 0.018 * nk;
      R.put(c, r, h > 0.995 ? 42 : 43, 170 + 85 * k, 190 + 65 * k, 230 + 25 * k);
    }
  }
}

function updateNightlife(dt) {
  updateBats(dt);
  updateWisps(dt);
}
function drawNightlife(c0, r0) {
  drawMoonGlints(c0, r0);
  drawWisps(c0, r0);
  drawBats(c0, r0);
}

'use strict';
// Lo que pasa a ras de suelo: charcos que salpican al pisarlos (gotas que rebotan y ondas que
// se abren) y que reflejan al caballero, y bichos del bosque que corretean entre la hojarasca
// y se dispersan en todas direcciones cuando te acercas.

let ripples = [], bugs = [], splashT = 0;

// ---------------------------------------------------------------- charcos
function onPuddle(x, y) {
  const cx = Math.floor(x), cy = Math.floor(y);
  if (!terr.puddle || world.under || cx < 0 || cy < 0 || cx >= terr.CW || cy >= terr.CH) return false;
  return terr.puddle[cy * terr.CW + cx] === 1 || terr.mat[cy * terr.CW + cx] === T.LAKE;
}

function splash(x, y, big) {
  const n = big ? 16 : 9;
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2, s = (big ? 14 : 9) * (0.4 + Math.random());
    particles.push({ x: x + Math.cos(a) * 1.2, y: y - 0.5, vx: Math.cos(a) * s, vy: -6 - Math.random() * (big ? 10 : 7), g: 38,
                     life: 0.45 + Math.random() * 0.25, max: 0.7, float: true, ch: "'.,`"[(Math.random() * 4) | 0], c: [175, 205, 245] });
  }
  ripples.push({ x, y: y + 0.3, t: 0 });
  if (big) ripples.push({ x: x + 2, y: y + 0.6, t: -0.15 });
  Sfx.splash(big);
}

// el reflejo del caballero (y su caballo) en charcos y orillas: la figura invertida, ondulante y azulada
function reflectRig(ras, fsc, groundF, fsr, c0, r0) {
  if (world.under) return;
  const { CW, CH, puddle, water } = terr;
  for (const c of ras.cells) {
    const h = groundF - (fsr + c.y);                 // altura sobre el suelo, en celdas finas
    if (h < 0 || h > 40) continue;
    const fy = groundF + h + 1;
    const fx = fsc + c.x + Math.round(Math.sin(time * 4 + fy * 0.8) * 0.6);
    const wx = Math.floor(fx / FINE) + c0, wy = Math.floor(fy / FINE) + r0;
    if (wx < 0 || wy < 0 || wx >= CW || wy >= CH) continue;
    const i = wy * CW + wx;
    if (puddle[i] !== 1 && water[i] !== 1 && water[i] !== 2) continue;
    const k = 0.6 * (1 - h / 70);
    R.fput(fx, fy, c.code, c.c[0] * k + 20, c.c[1] * k + 35, c.c[2] * k + 70);
  }
}

// ---------------------------------------------------------------- bichos del bosque
function bugNests() {
  if (world.bugNests) return world.bugNests;
  const nests = [];
  for (let ty = 2; ty < world.H - 2; ty++) for (let tx = 2; tx < world.W - 2; tx++) {
    const t = world.get(tx, ty);
    if ((t !== T.FOREST && t !== T.PINE) || hash2(tx * 17 + 5, ty * 23) < 0.994) continue;
    nests.push({ x: tx * TW + TW / 2, y: ty * TH + TH / 2, active: false, cool: 0 });
  }
  return (world.bugNests = nests);
}
const BUG_KINDS = [
  { c: [45, 38, 32], ch: [44, 59] },      // escarabajo negro
  { c: [120, 78, 40], ch: [44, 46] },     // cucaracha parda
  { c: [70, 165, 95], ch: [59, 44] },     // escarabajo verde irisado
  { c: [150, 45, 30], ch: [46, 44] },     // hormigas rojas
  { c: [175, 160, 120], ch: [126, 45] },  // cienpiés
];
function spawnBugs(n) {
  const kind = BUG_KINDS[(Math.random() * BUG_KINDS.length) | 0];
  const cnt = 10 + ((Math.random() * 10) | 0);
  for (let k = 0; k < cnt; k++) {
    const x = n.x + (Math.random() - 0.5) * 20, y = n.y + (Math.random() - 0.5) * 7;
    if (!passable(x, y)) continue;
    bugs.push({ x, y, vx: 0, vy: 0, nest: n, flee: 0, t: Math.random() * 3, kind, ph: Math.random() * 10, life: 0 });
  }
  n.active = true;
}

function updateBugs(dt) {
  if (world.under) { bugs = []; return; }
  const a = A();
  for (const n of bugNests()) {
    const near = Math.abs(n.x - camX) < R.cols * 0.6 && Math.abs(n.y - camY) < R.rows * 0.7;
    if (near && !n.active && time > n.cool) spawnBugs(n);
    if (!near && n.active) { n.active = false; for (const b of bugs) if (b.nest === n) b.dead = true; }
  }
  for (const b of bugs) {
    b.ph += dt; b.life = Math.min(1, b.life + dt * 2);
    const dx = b.x - player.x, dy = (b.y - player.y) * a, d = Math.hypot(dx, dy) || 1;
    if (!b.flee && d < (player.mount ? 22 : 15)) {                       // ¡que viene! se dispersan en abanico
      b.flee = 1.2 + Math.random() * 0.8;
      const ang = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.6, sp = 30 + Math.random() * 25;
      b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp / a;
      b.nest.cool = time + 40;
    }
    if (b.flee) {
      b.flee -= dt;
      b.vx += (Math.random() - 0.5) * 120 * dt; b.vy += (Math.random() - 0.5) * 50 * dt;     // zigzag
      if (b.flee <= 0) { b.dead = true; if (Math.random() < 0.5) particles.push({ x: b.x, y: b.y, vx: 0, vy: -2, life: 0.4, max: 0.4, float: true, ch: "'", c: [90, 120, 60] }); }
    } else {                                                                  // corretean despacio
      b.t -= dt;
      if (b.t <= 0) { b.t = 0.3 + Math.random() * 1.5; const ang = Math.random() * Math.PI * 2, sp = Math.random() < 0.3 ? 0 : 3 + Math.random() * 5; b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp / a; }
      b.vx += (b.nest.x - b.x) * 0.3 * dt; b.vy += (b.nest.y - b.y) * 0.6 * dt;
    }
    const nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;
    if (passable(nx, ny)) { b.x = nx; b.y = ny; } else { b.vx *= -0.5; b.vy *= -0.5; }
  }
  bugs = bugs.filter(b => !b.dead);
  if (bugs.length > 160) bugs.splice(0, bugs.length - 160);
}

function bugDrawables(drawables, c0, r0) {
  for (const b of bugs) {
    if (b.x < c0 - 2 || b.x > c0 + R.cols + 2 || b.y < r0 - 2 || b.y > r0 + R.rows + 2) continue;
    drawables.push({ y: b.y, draw: () => {
      const L = lightInto(b.x, b.y);
      const k = b.life * 0.9;
      const lr = Math.max(0.45, L[0]) * k, lg = Math.max(0.45, L[1]) * k, lb = Math.max(0.45, L[2]) * k;
      const moving = b.flee > 0 || Math.hypot(b.vx, b.vy) > 1;
      const ch = b.kind.ch[moving && Math.sin(b.ph * 30) > 0 ? 1 : 0];
      const c = b.kind.c, shine = b.kind === BUG_KINDS[2] ? 0.3 + 0.7 * Math.abs(Math.sin(b.ph * 4)) : 1;   // brillo irisado
      R.put(Math.round(b.x) - c0, Math.round(b.y) - r0, ch, c[0] * lr * (1.3 - 0.3 * shine), c[1] * lg * (0.7 + 0.5 * shine), c[2] * lb * (0.8 + 0.6 * shine));
    } });
  }
}

// ---------------------------------------------------------------- actualización
function updateGround(dt) {
  for (const r of ripples) r.t += dt;
  ripples = ripples.filter(r => r.t < 1);
  const p = player;
  splashT -= dt;
  if (p.moving && !p.onWall && !p.riding && p.floor === 0 && splashT <= 0 && onPuddle(p.x, p.y + 0.4)) {
    splashT = p.mount ? 0.2 : p.dashT > 0 ? 0.12 : 0.3;
    splash(p.x, p.y, !!p.mount || p.dashT > 0);
  }
  updateBugs(dt);
}

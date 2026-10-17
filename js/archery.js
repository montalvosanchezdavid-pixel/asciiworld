'use strict';
// Muralla y tiro con arco: subir/bajar por las escalinatas, coger un arco y disparar
// flechas de fuego con el ratón. Vuelan en parábola, hacen mucho daño y queman.

const ARROW_SPEED = 95, ARROW_RANGE = 200;
let arrows = [];
let viewC0 = 0, viewR0 = 0;   // esquina de la vista, para apuntar con el ratón

const isWallTop = (x, y) => {
  const tx = Math.floor(x / TW), ty = Math.floor(y / TH);
  const t = world.get(tx, ty);
  return (t === T.CWALL || t === T.TOWER) && world.bldGrid[ty * world.W + tx] < 0;
};

// ¿Puede pisar aquí quien está arriba? (adarve de la muralla o plataforma de una torre)
function perchWalk(e, x, y) {
  const t = e.perch;
  if (!t) return isWallTop(x, y);
  return x >= t.x * TW + 1 && x <= (t.x + t.w) * TW - 2 && y >= t.y * TH && y <= (t.y + t.h) * TH - 1;
}

function stairsNearWallTop() {
  const tx = Math.floor(player.x / TW), ty = Math.floor(player.y / TH);
  return world.wallStairs.find(s => Math.abs(tx - s.x) <= 1 && ty >= s.wallY - 1 && ty <= s.wallY);
}

function wallStairsAction() {
  const p = player;
  // torres de madera: subir por la escalera de mano / bajar desde la plataforma
  if (!p.onWall && tileOf(p.x, p.y) === T.LADDER) {
    const tx = Math.floor(p.x / TW), ty = Math.floor(p.y / TH);
    const t = (world.watchtowers || []).find(w => w.ladder.x === tx && w.ladder.y === ty);
    if (t) {
      p.onWall = true; p.perch = t; p.bld = null; p.floor = 0;
      p.x = (t.x + t.w / 2) * TW; p.y = (t.y + t.h / 2) * TH;
      msg('Subes a la torreta. Haz clic (o ESPACIO) para lanzar lanzas de fuego.', [255, 200, 110]);
      return true;
    }
  }
  if (p.onWall && p.perch) {
    const t = p.perch, c = cellOfTile(t.ladder.x, t.ladder.y);
    p.onWall = false; p.perch = null; p.x = c.x; p.y = c.y;
    msg('Bajas de la torre.', [210, 200, 170]);
    return true;
  }
  if (!p.onWall) {
    if (tileOf(p.x, p.y) !== T.WALLSTAIRS) return false;
    const st = world.wallStairs.find(s => s.x === Math.floor(p.x / TW));
    if (!st) return false;
    p.onWall = true; p.bld = null; p.floor = 0;
    p.x = st.x * TW + TW / 2; p.y = st.wallY * TH + 1;
    msg('Subes a la muralla.' + (p.hasBow ? ' Haz clic para disparar flechas de fuego.' : ' Coge un arco del soporte.'), [210, 200, 170]);
    return true;
  }
  const st = stairsNearWallTop();
  if (!st) return false;
  p.onWall = false;
  p.x = st.x * TW + TW / 2; p.y = st.bottom * TH + TH - 1;
  msg('Bajas de la muralla.', [210, 200, 170]);
  return true;
}

function wallPrompt() {
  const p = player;
  if (!p.onWall && tileOf(p.x, p.y) === T.LADDER) return '[E] Subir a la torre';
  if (p.onWall && p.perch) return '[E] Bajar de la torre';
  if (!p.onWall) return tileOf(p.x, p.y) === T.WALLSTAIRS ? '[E] Subir a la muralla' : null;
  if (stairsNearWallTop()) return '[E] Bajar de la muralla';
  return null;
}

function mouseToWorld(ev) {
  const rect = R.canvas.getBoundingClientRect();
  const col = Math.floor((ev.clientX - rect.left) / rect.width * R.cols);
  const row = Math.floor((ev.clientY - rect.top) / rect.height * R.rows);
  return { x: viewC0 + col + 0.5, y: viewR0 + row + 0.5 };
}

function shootArrow(tx, ty) {
  const p = player;
  if ((p.bowCd || 0) > 0) return;
  p.bowCd = 0.5;
  Sfx.throw(false);
  let dx = tx - p.x, dy = (ty - p.y) * A();
  let d = Math.hypot(dx, dy);
  if (d < 3) return;
  if (d > ARROW_RANGE) { dx *= ARROW_RANGE / d; dy *= ARROW_RANGE / d; d = ARROW_RANGE; }
  const z0 = liftOf(p) + 5;
  arrows.push({
    sx: p.x, sy: p.y, tx: p.x + dx, ty: p.y + dy / A(), z0, dur: d / ARROW_SPEED, t: 0, arc: 3 + d * 0.07,
    x: p.x, y: p.y, z: z0, px: p.x, py: p.y, pz: z0,
    dmg: rint(16, 26) + p.sword * 4 + (p.lvl - 1) * 3,
  });
  p.facing = dx >= 0 ? 1 : -1;
  p.dir = { x: dx / d, y: dy / d };
  tempLights.push({ x: p.x, y: p.y, r: 14, c: [1, 0.6, 0.2], k: 0.8, life: 0.15, max: 0.15 });
}

// Lanza de fuego desde el vagón: vuela rasa, más rápida, atraviesa enemigos y hace más daño
const LANCE_SPEED = 140, LANCE_RANGE = 230;
function shootLance(tx, ty) {
  const p = player;
  if ((p.bowCd || 0) > 0) return;
  p.bowCd = 0.4;
  Sfx.throw(true);
  let dx = tx - p.x, dy = (ty - p.y) * A();
  let d = Math.hypot(dx, dy);
  if (d < 3) return;
  dx *= LANCE_RANGE / d; dy *= LANCE_RANGE / d; d = LANCE_RANGE;   // siempre vuela todo su alcance
  const z0 = liftOf(p) + 6;
  arrows.push({
    lance: true, hit: new Set(),
    sx: p.x, sy: p.y, tx: p.x + dx, ty: p.y + dy / A(), z0, dur: d / LANCE_SPEED, t: 0, arc: 2,
    x: p.x, y: p.y, z: z0, px: p.x, py: p.y, pz: z0,
    dmg: Math.round((rint(16, 26) + p.sword * 4 + (p.lvl - 1) * 3) * 1.4),
  });
  p.facing = dx >= 0 ? 1 : -1;
  p.dir = { x: dx / d, y: dy / d };
  p.throwT = 0.25;
  tempLights.push({ x: p.x, y: p.y, r: 18, c: [1, 0.55, 0.15], k: 1, life: 0.2, max: 0.2 });
}

function burnFx(x, y, n) {
  for (let i = 0; i < n; i++) particles.push({
    x: x + (Math.random() - 0.5) * 3, y, vx: (Math.random() - 0.5) * 4, vy: -4 - Math.random() * 5,
    life: 0.45, max: 0.45, ch: '*^\'.'[(Math.random() * 4) | 0], c: lerp3([255, 230, 120], [255, 70, 15], Math.random()),
  });
}

function arrowHit(a, e, k = 1) {
  let dmg = Math.round(a.dmg * k);
  if (e.boss) dmg = dragonDamage(dmg);
  e.hp -= dmg; e.flash = 0.15; e.engaged = true; e.burn = 3; e.burnT = 0;
  Sfx.burn();
  floater(e.x, e.y - (e.boss ? 16 : 8), `${dmg}`, [255, 170, 60]);
  burst(e.x, e.y - 3, 14, '*+^', [255, 230, 120], [255, 70, 15], 30, 0.6);
  if (e.hp <= 0 && !e.dead) killEnemy(e);
}

function updateArrows(dt) {
  player.bowCd = (player.bowCd || 0) - dt;
  for (const a of arrows) {
    a.px = a.x; a.py = a.y; a.pz = a.z;
    a.t += dt;
    const u = Math.min(1, a.t / a.dur);
    a.x = a.sx + (a.tx - a.sx) * u; a.y = a.sy + (a.ty - a.sy) * u;
    a.z = a.z0 * (1 - u) + a.arc * 4 * u * (1 - u);
    burnFx(a.x, a.y - a.z, a.lance ? 2 : 1);
    if (a.lance) {
      for (const e of enemies) {
        if (e.dead || a.hit.has(e)) continue;
        if (Math.hypot(e.x - a.x, (e.y - a.y) * A()) < (e.boss || e.mini ? 15 : 7)) { a.hit.add(e); arrowHit(a, e); }
      }
      if (TILE_DEFS[matAt(a.x, a.y)].pass === false && tileOf(a.x, a.y) === T.CRYPTWALL && u > 0.05) a.t = a.dur;
      if (a.t >= a.dur) {
        a.done = true;
        burst(a.x, a.y - a.z, 20, '*^+.', [255, 230, 120], [255, 60, 10], 28, 0.6);
        tempLights.push({ x: a.x, y: a.y, r: 22, c: [1, 0.55, 0.15], k: 1.2, life: 0.35, max: 0.35 });
      }
      continue;
    }
    for (const e of enemies) {
      if (e.dead || a.z > (e.boss ? 24 : 12)) continue;
      if (Math.hypot(e.x - a.x, (e.y - a.y) * A()) < (e.boss ? 14 : 5)) { arrowHit(a, e); a.done = true; break; }
    }
    if (!a.done && u >= 1) {
      a.done = true;
      burst(a.x, a.y, 24, '*^+.', [255, 230, 120], [255, 60, 10], 28, 0.7);
      tempLights.push({ x: a.x, y: a.y, r: 24, c: [1, 0.55, 0.15], k: 1.4, life: 0.4, max: 0.4 });
      for (const e of enemies) if (!e.dead && Math.hypot(e.x - a.x, (e.y - a.y) * A()) < 10) arrowHit(a, e, 0.5);
    }
  }
  arrows = arrows.filter(a => !a.done);
}

// Enemigos en llamas: pierden vida unos segundos
function updateBurn(e, dt) {
  if (!(e.burn > 0)) return;
  e.burn -= dt; e.burnT += dt;
  if (Math.random() < dt * 14) burnFx(e.x, e.y - 3 - Math.random() * 5, 1);
  if (e.burnT >= 0.5) {
    e.burnT = 0; e.hp -= 4;
    floater(e.x, e.y - 8, '4', [255, 140, 40]);
    if (e.hp <= 0 && !e.dead) killEnemy(e);
  }
}

function drawArrows(c0, r0) {
  for (const a of arrows) {
    const hx = a.x + lean(a.x, a.z), hy = a.y - a.z;
    const bx = a.px + lean(a.px, a.pz), by = a.py - a.pz;
    let dx = hx - bx, dy = (hy - by) * A();
    const l = Math.hypot(dx, dy) || 1;
    dx /= l; dy /= l;
    const ang = Math.atan2(dy, dx);
    const t = ((ang % Math.PI) + Math.PI) % Math.PI;
    const shaft = t < Math.PI / 8 || t > 7 * Math.PI / 8 ? '-' : t < 3 * Math.PI / 8 ? '\\' : t < 5 * Math.PI / 8 ? '|' : '/';
    const len = a.lance ? 7 : 3;
    for (let k = len; k >= 1; k--) R.put(Math.round(hx - dx * k) - c0, Math.round(hy - dy * k / A()) - r0, shaft.charCodeAt(0), a.lance ? 200 : 170, a.lance ? 140 : 120, a.lance ? 80 : 70);
    if (a.lance) {
      const head = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? '>' : '<') : (dy > 0 ? 'v' : '^');
      R.put(Math.round(hx) - c0, Math.round(hy) - r0, head.charCodeAt(0), 255, 240, 170);
      R.put(Math.round(hx + dx) - c0, Math.round(hy + dy / A()) - r0, 42, 255, 160, 50);
    } else R.put(Math.round(hx) - c0, Math.round(hy) - r0, 42, 255, 235, 140);
  }
}

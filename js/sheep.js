'use strict';
// Ovejas en los corrales: pastan dentro del vallado, huyen si te acercas y, si las matas,
// dejan carne (R para comer). Con el tiempo nacen ovejas nuevas en el establo.

let sheepT = 0;

function penRect(pen) {
  return { x0: pen.x0 * TW + 1, y0: pen.y0 * TH + 1, x1: (pen.x1 + 1) * TW - 1, y1: (pen.y1 + 1) * TH - 1 };
}
const inPen = (pen, x, y) => { const r = penRect(pen); return x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1; };

function spawnSheep(pen) {
  const r = penRect(pen);
  for (let t = 0; t < 40; t++) {
    const x = r.x0 + Math.random() * (r.x1 - r.x0), y = r.y0 + Math.random() * (r.y1 - r.y0);
    if (!passable(x, y) || world.bldAt(Math.floor(x / TW), Math.floor(y / TH))) continue;
    const e = makeEnemy('sheep', x, y);
    e.pen = pen; e.facing = Math.random() < 0.5 ? 1 : -1; e.wt = Math.random() * 3;
    return e;
  }
  return null;
}

function initSheep() {
  if (world.under || !world.pens) return;
  for (const pen of world.pens) for (let k = 0; k < pen.n; k++) { const e = spawnSheep(pen); if (e) enemies.push(e); }
}

function updateSheep(e, dt) {
  const ok = (x, y) => inPen(e.pen, x, y) && passable(x, y) && !world.bldAt(Math.floor(x / TW), Math.floor(y / TH));
  const step = (sx, sy) => { if (sx && ok(e.x + sx, e.y)) e.x += sx; if (sy && ok(e.x, e.y + sy)) e.y += sy; };
  if (e.kx || e.ky) {
    step(e.kx * dt, e.ky * dt);
    const decay = Math.exp(-10 * dt);
    e.kx *= decay; e.ky *= decay;
    if (Math.abs(e.kx) < 0.5) e.kx = 0;
    if (Math.abs(e.ky) < 0.5) e.ky = 0;
  }
  const d = dist(e, player);
  if (d < 26 && !player.onWall) {          // huye del caballero
    const dx = e.x - player.x, dy = (e.y - player.y) * A();
    const l = Math.hypot(dx, dy) || 1;
    step(dx / l * e.spd * 1.6 * dt, dy / l * e.spd * 1.6 / A() * dt);
    e.facing = dx > 0 ? 1 : -1;
    e.anim += dt * 10;
    if (Math.random() < dt * 0.8) floater(e.x, e.y - 7, 'beee', [230, 230, 230]);
    return;
  }
  e.wt -= dt;
  if (e.wt <= 0) {
    e.wt = 1.5 + Math.random() * 4;
    e.wander = Math.random() < 0.55 ? null : { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 };
    if (Math.random() < 0.08 && d < 90) floater(e.x, e.y - 7, 'beee', [220, 220, 220]);
  }
  if (e.wander) {
    step(e.wander.x * e.spd * 0.35 * dt, e.wander.y * e.spd * 0.35 / A() * dt);
    if (e.wander.x) e.facing = e.wander.x > 0 ? 1 : -1;
    e.anim += dt * 5;
  }
}

// Nacen ovejas nuevas en los corrales que se han quedado con pocas (cuando no miras)
function updatePens(dt) {
  if (world.under || !world.pens) return;
  sheepT -= dt;
  if (sheepT > 0) return;
  sheepT = 45;
  for (const pen of world.pens) {
    const n = enemies.filter(e => e.pen === pen && !e.dead).length;
    const c = cellOfTile((pen.x0 + pen.x1) / 2, (pen.y0 + pen.y1) / 2);
    if (n < pen.n && dist(c, player) > 70) { const e = spawnSheep(pen); if (e) enemies.push(e); }
  }
}

function eatMeat() {
  const p = player;
  p.meat--;
  Sfx.eat();
  p.food = Math.min(100, p.food + 45);
  const heal = 12 + p.lvl * 2;
  p.hp = Math.min(p.maxHp, p.hp + heal);
  p.hungerWarn = 0;
  floater(p.x, p.y - 7, `+${heal}`, [110, 255, 120]);
  burst(p.x, p.y - 5, 5, ".'", [230, 120, 100], [160, 70, 50], 6, 0.4);
  msg('Te comes un buen trozo de carne de oveja. ¡Sabroso!', [235, 160, 130]);
}

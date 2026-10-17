'use strict';
// Caballos: unos cuantos en las caballerizas de Villa Real y Altamira y dos salvajes sueltos
// por el reino. Acércate y pulsa E para montar; a caballo vas mucho más rápido. E para bajar.

let horses = [];
const HORSE_SPEED = 55;
const COATS = [[165, 104, 58], [118, 80, 52], [228, 218, 198], [190, 140, 82], [135, 96, 66], [200, 180, 145]];

function makeHorse(x, y, o = {}) {
  return { x, y, facing: Math.random() < 0.5 ? 1 : -1, anim: 0, wt: Math.random() * 3, wander: null,
           pen: o.pen || null, wild: !!o.wild, home: { x, y }, homeR: o.wild ? 140 : 14,
           coat: o.wild ? [190, 140, 84] : COATS[(Math.random() * COATS.length) | 0], mane: o.wild ? [235, 225, 200] : null,
           socks: Math.random() < 0.35, blaze: Math.random() < 0.4,
           name: o.wild ? 'Caballo salvaje' : 'Caballo', friendly: true, hp: 1, maxHp: 1 };
}

function initHorses() {
  horses = [];
  for (const st of world.stables || []) for (let k = 0; k < st.n; k++) {
    for (let t = 0; t < 40; t++) {
      const x = (st.x0 + 0.5 + Math.random() * (st.x1 - st.x0)) * TW, y = (st.y0 + 0.5 + Math.random() * (st.y1 - st.y0)) * TH;
      if (!passable(x, y) || world.bldAt(Math.floor(x / TW), Math.floor(y / TH))) continue;
      horses.push(makeHorse(x, y, { pen: st }));
      break;
    }
  }
  for (const w of world.wildHorses || []) { const c = cellOfTile(w.x, w.y); horses.push(makeHorse(c.x, c.y, { wild: true })); }
}

function horseNear() {
  const p = player;
  if (world.under || p.mount || p.riding || p.onWall || p.floor > 0) return null;
  let best = null, bd = 10;
  for (const h of horses) { const d = dist(h, p); if (d < bd) { bd = d; best = h; } }
  return best;
}

function horsePrompt() {
  const h = horseNear();
  return h ? (h.wild ? '[E] Montar el caballo salvaje' : '[E] Montar a caballo') : null;
}

function mountHorse() {
  const h = horseNear();
  if (!h) return false;
  const p = player;
  p.mount = h; h.pen = null; h.x = p.x; h.y = p.y; h.facing = p.facing;
  msg(h.wild ? '¡Domas al caballo salvaje y montas de un salto!' : 'Montas a caballo. ¡A galopar! (E para bajar)', [235, 205, 140]);
  if (h.wild) { h.wild = false; h.name = 'Caballo'; }
  return true;
}

function dismount(quiet) {
  const p = player, h = p.mount;
  if (!h) return false;
  p.mount = null;
  h.x = p.x; h.y = p.y; h.home = { x: h.x, y: h.y }; h.homeR = 14; h.wt = 2;
  for (const dx of [5, -5, 0]) if (passable(p.x + dx, p.y + 1)) { p.x += dx; p.y += 1; break; }
  if (!quiet) msg('Bajas del caballo.', [210, 200, 170]);
  return true;
}

function updateHorses(dt) {
  const p = player;
  if (p.mount) {
    if (p.bld || world.under || p.onWall || p.riding) dismount(true);
    else { const h = p.mount; h.x = p.x; h.y = p.y; h.facing = p.facing; if (p.moving) h.anim += dt * 17; }
  }
  if (world.under) return;
  for (const h of horses) {
    if (h === p.mount) continue;
    const ok = (x, y) => passable(x, y) && !world.bldAt(Math.floor(x / TW), Math.floor(y / TH)) &&
      (h.pen ? x >= h.pen.x0 * TW + 1 && x <= (h.pen.x1 + 1) * TW - 1 && y >= h.pen.y0 * TH + 1 && y <= (h.pen.y1 + 1) * TH - 1
             : Math.hypot(x - h.home.x, (y - h.home.y) * A()) < h.homeR);
    h.wt -= dt;
    if (h.wt <= 0) {
      h.wt = 2 + Math.random() * 5;
      h.wander = Math.random() < 0.5 ? null : { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 };
    }
    if (h.wander) {
      const sx = h.wander.x * 7 * dt, sy = h.wander.y * 7 / A() * dt;
      if (ok(h.x + sx, h.y)) h.x += sx; else h.wander.x *= -1;
      if (ok(h.x, h.y + sy)) h.y += sy; else h.wander.y *= -1;
      if (h.wander.x) h.facing = h.wander.x > 0 ? 1 : -1;
      h.anim += dt * 6;
    }
  }
}

function horseDrawables(drawables, place, c0, r0) {
  if (world.under) return;
  for (const h of horses) if (h !== player.mount) place(h, () => drawRig('horse', h, c0, r0, 0));
}

// El jinete: primero el caballero (más alto) y luego el caballo, que le tapa las piernas
function drawRider(c0, r0, drawHero) {
  const h = player.mount, nm = h.name;
  h.name = null;
  if (player.view === 'back') {
    h._part = 'head'; drawRig('horse', h, c0, r0, 0);
    drawHero();
    h._part = 'body'; drawRig('horse', h, c0, r0, 0);
    h._part = undefined;
  } else { drawHero(); drawRig('horse', h, c0, r0, 0); }
  h.name = nm;
}

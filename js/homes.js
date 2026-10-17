'use strict';
// Casas con interior y varios pisos (tejados que desaparecen al entrar),
// huertos de patatas y hambre.

// ------------------------------------------------------------------ Huertos

const CROP_TIME = 40;            // segundos por fase (la lluvia los duplica)
let crops = [];                  // { x, y (casilla), stage: -1 vacío, 0 semilla ... 3 madura, timer }
let cropAt = new Map();

function initFarming() {
  crops = world.crops.map(c => ({ ...c, timer: Math.random() * CROP_TIME }));
  cropAt = new Map(crops.map(c => [c.y * world.W + c.x, c]));
}

function updateCrops(dt) {
  const k = weather.rain > 0.3 ? 2 : 1;
  for (const c of crops) {
    if (c.stage < 0 || c.stage >= 3) continue;
    c.timer += dt * k;
    if (c.timer >= CROP_TIME) { c.timer = 0; c.stage++; }
  }
}

// Planta que pisa el jugador o la que tiene delante
function cropNearPlayer() {
  const p = player;
  if (p.floor > 0) return null;
  const cand = [[p.x, p.y], [p.x + p.dir.x * 4, p.y + p.dir.y * 2], [p.x + p.dir.x * TW, p.y + p.dir.y * TH]];
  for (const [x, y] of cand) {
    const c = cropAt.get(Math.floor(y / TH) * world.W + Math.floor(x / TW));
    if (c) return c;
  }
  return null;
}

function farmAction(c) {
  const p = player;
  const cx = c.x * TW + TW / 2, cy = c.y * TH + 1;
  if (c.stage === 3) {
    const n = Math.random() < 0.5 ? 3 : 2;
    const seed = Math.random() < 0.5;
    p.potatoes += n; if (seed) p.seeds++;
    c.stage = -1; c.timer = 0;
    floater(cx, cy - 4, `+${n} patatas${seed ? ' +1 semilla' : ''}`, [235, 205, 120]);
    burst(cx, cy, 8, ".,'", [150, 105, 60], [90, 60, 35], 10, 0.5);
  } else if (c.stage === -1) {
    if (p.seeds <= 0) { msg('No tienes semillas. El granjero de Villa Real te puede dar.', [170, 170, 170]); return; }
    p.seeds--; c.stage = 0; c.timer = 0;
    floater(cx, cy - 4, 'Plantado', [140, 225, 110]);
  } else {
    const left = Math.ceil((3 - c.stage) * CROP_TIME - c.timer);
    msg(`Esta patata aún no está madura (unos ${left} s; con lluvia crece el doble de rápido).`, [175, 205, 145]);
  }
}

// Carácter de la planta en una celda del huerto (null si no hay planta en esa celda)
const _CG = [0, 0, 0, 0];
function cropGlyph(wx, wy) {
  const c = cropAt.get(((wy / TH) | 0) * world.W + ((wx / TW) | 0));
  if (!c || c.stage < 0) return null;
  const lx = wx % TW, ly = wy % TH;
  const dx = lx - (lx < 3 ? 1 : 4);
  let ch = 0, col = null;
  if (c.stage === 0) { if (dx === 0 && ly === 1) { ch = '.'; col = [170, 125, 75]; } }
  else if (c.stage === 1) { if (dx === 0 && ly === 1) { ch = ','; col = [110, 195, 80]; } }
  else if (c.stage === 2) {
    if (dx === 0 && ly === 1) { ch = 'v'; col = [95, 185, 70]; }
    else if (dx === 0 && ly === 0) { ch = "'"; col = [80, 160, 60]; }
  } else {
    if (ly === 0) { ch = dx < 0 ? '\\' : dx > 0 ? '/' : '%'; col = dx === 0 ? [105, 205, 75] : [80, 170, 60]; }
    else if (ly === 1 && dx === 0) { ch = 'Y'; col = [120, 225, 90]; }
    else if (ly === 2 && dx >= 0) { ch = 'o'; col = dx === 0 ? [225, 185, 115] : [205, 165, 100]; }
  }
  if (!ch) return null;
  _CG[0] = ch.charCodeAt(0); _CG[1] = col[0]; _CG[2] = col[1]; _CG[3] = col[2];
  return _CG;
}

// ------------------------------------------------------------------ Hambre

function eatPotato() {
  const p = player;
  if (p.potatoes <= 0) { msg('No tienes patatas. Cosecha las maduras en los huertos (E).', [170, 170, 170]); return; }
  p.potatoes--;
  Sfx.eat();
  p.food = Math.min(100, p.food + 30);
  const heal = 8 + p.lvl * 2;
  p.hp = Math.min(p.maxHp, p.hp + heal);
  p.hungerWarn = 0;
  floater(p.x, p.y - 7, `+${heal}`, [110, 255, 120]);
  burst(p.x, p.y - 5, 5, ".'", [230, 200, 140], [160, 120, 70], 6, 0.4);
  msg('Te comes una patata. ¡Qué rica!', [225, 205, 145]);
}

// La comida baja con el tiempo; con hambre la vida se va escapando poco a poco
function updateHunger(dt) {
  const p = player;
  p.food = Math.max(0, p.food - dt * 100 / 330);
  p.hungerT = (p.hungerT || 0) + dt;
  if (p.food <= 0) { if (p.hungerT >= 1.2) { p.hungerT = 0; starve(); } }
  else if (p.food < 25) { if (p.hungerT >= 3) { p.hungerT = 0; starve(); } }
  else if (p.food > 60 && p.hp < p.maxHp) { if (p.hungerT >= 2) { p.hungerT = 0; p.hp++; } }
  else if (p.hungerT > 3) p.hungerT = 0;
  const lvl = p.food <= 0 ? 2 : p.food < 25 ? 1 : 0;
  if (lvl > (p.hungerWarn || 0))
    msg(lvl === 2 ? '¡Te mueres de hambre! Come algo cuanto antes (R).' : 'Tienes hambre: la vida se te empieza a escapar. (R: comer patata)', [255, 170, 90]);
  p.hungerWarn = lvl;
}

function starve() {
  const p = player;
  p.hp -= 1;
  if (p.hp <= 0) { p.hp = 0; state = 'dead'; deathCause = 'el hambre'; }
}

// ------------------------------------------------------------------ Edificios y pisos

// Material en una posición teniendo en cuenta el piso en el que está la entidad
function matAtF(x, y, floor, bld) {
  if (floor > 0 && bld && bld.floorBake) {
    const fb = bld.floorBake;
    const cx = Math.floor(x) - fb.X0, cy = Math.floor(y) - fb.Y0;
    if (cx >= 0 && cy >= 0 && cx < fb.w && cy < fb.h) return fb.m[cy * fb.w + cx];
  }
  return matAt(x, y);
}

function updateBuildingState() {
  const p = player;
  if (p.floor > 0 || p.onWall) return;
  const b = world.bldAt(Math.floor(p.x / TW), Math.floor(p.y / TH));
  if (b !== p.bld) {
    p.bld = b;
    if (b && b.name !== 'Casa') msg(`Entras en: ${b.name}.`, [215, 195, 150]);
  }
}

function stairsUnderPlayer() {
  const t = matAtF(player.x, player.y, player.floor, player.bld);
  return t === T.STAIRS_UP || t === T.STAIRS_DOWN ? t : null;
}

function stairsAction() {
  const s = stairsUnderPlayer();
  if (!s || !player.bld) return false;
  if (s === T.STAIRS_UP && player.floor === 0 && player.bld.upper) { player.floor = 1; msg('Subes al piso de arriba.', [200, 190, 160]); }
  else if (s === T.STAIRS_DOWN && player.floor === 1) { player.floor = 0; msg('Bajas a la planta baja.', [200, 190, 160]); }
  else return false;
  burst(player.x, player.y - 2, 6, '.', [200, 190, 160], [120, 110, 90], 8, 0.4);
  return true;
}

// ¿Se ve esta entidad? Las que están dentro de otra casa las tapa el tejado;
// dentro de la casa del jugador solo se ven las de su mismo piso.
function entityVisible(e) {
  const b = world.bldAt(Math.floor(e.x / TW), Math.floor(e.y / TH));
  const fl = e.floor || 0;
  if (b) return b === player.bld && fl === player.floor;
  return fl === 0;
}

function contextPrompt() {
  if (player.riding || player.mount) return null;
  const cp = cryptPrompt();
  if (cp) return cp;
  const tp = trainPrompt();
  if (tp) return tp;
  const wp = wallPrompt();
  if (wp) return wp;
  if (player.onWall) return null;
  const hp = horsePrompt();
  if (hp) return hp;
  const sp = shroomPrompt();
  if (sp) return sp;
  const s = stairsUnderPlayer();
  if (s === T.STAIRS_UP && player.floor === 0) return '[E] Subir';
  if (s === T.STAIRS_DOWN && player.floor === 1) return '[E] Bajar';
  const c = cropNearPlayer();
  if (c && !nearestNpc()) return c.stage === 3 ? '[E] Cosechar' : c.stage === -1 ? (player.seeds > 0 ? '[E] Plantar' : 'Sin semillas') : 'Creciendo...';
  return null;
}

// Luz en un punto (ambiente + luces cercanas), sin crear objetos nuevos
const _L = [1, 1, 1];
function lightInto(x, y) {
  let lr = amb[0], lg = amb[1], lb = amb[2];
  const a = A();
  for (let k = 0; k < VL.length; k++) {
    const L = VL[k];
    const dx = x - L.x, dy = (y - L.y) * a;
    const d2 = dx * dx + dy * dy;
    if (d2 >= L.r2) continue;
    let f = 1 - Math.sqrt(d2) / L.r; f *= f * L.k;
    lr += L.c[0] * f; lg += L.c[1] * f; lb += L.c[2] * f;
  }
  _L[0] = lr; _L[1] = lg; _L[2] = lb;
  return _L;
}

const ROOF = {
  red:    { light: [200, 92, 64], dark: [125, 50, 35], ridge: [90, 35, 25] },
  thatch: { light: [210, 175, 95], dark: [140, 108, 52], ridge: [105, 78, 38] },
  slate:  { light: [130, 140, 168], dark: [74, 80, 102], ridge: [55, 58, 74] },
  brown:  { light: [150, 70, 50], dark: [90, 42, 30], ridge: [60, 30, 22] },
};

// Humo de las chimeneas (fuera de la casa donde está el jugador)
function updateSmoke(dt) {
  for (const b of world.buildings) {
    if (!b.chimney || b === player.bld) continue;
    const { x, y } = chimneyTop(b);
    if (Math.abs(x - camX) > R.cols * 0.7 || Math.abs(y - camY) > R.rows * 0.8) continue;
    if (Math.random() < dt * 2.5) {
      particles.push({ x, y, vx: 1.5 + Math.random() * 2, vy: -3 - Math.random() * 2, life: 2.6, max: 2.6, float: true,
                       ch: 'o.~*'[(Math.random() * 4) | 0], c: [150, 150, 158] });
    }
  }
}

// Al estar dentro de una casa, el exterior se ve apagado y desaturado
function dimOutside(c0, r0) {
  const b = player.bld;
  if (!b) return;
  const X0 = b.x * TW - c0 - 3, Y0 = b.y * TH - r0 - bldWallH(b) - 3, X1 = X0 + b.w * TW + 6, Y1 = b.y * TH - r0 + b.h * TH;
  const d = R.data, cols = R.cols;
  for (let r = 0; r < R.rows; r++) for (let c = 0; c < cols; c++) {
    if (c >= X0 && c < X1 && r >= Y0 && r < Y1) continue;
    const o = (r * cols + c) * 4;
    const g = (d[o + 1] + d[o + 2] + d[o + 3]) / 3;
    d[o + 1] = (d[o + 1] * 0.45 + g * 0.55) * 0.3;
    d[o + 2] = (d[o + 2] * 0.45 + g * 0.55) * 0.3;
    d[o + 3] = (d[o + 3] * 0.45 + g * 0.55) * 0.34;
  }
  if (R.fineUsed) {
    const fd = R.fdata, fc = R.fcols;
    for (let fr = 0; fr < R.frows; fr++) for (let fcc = 0; fcc < fc; fcc++) {
      const c = fcc >> 1, r = fr >> 1;
      if (c >= X0 && c < X1 && r >= Y0 && r < Y1) continue;
      const o = (fr * fc + fcc) * 4;
      if (!fd[o]) continue;
      fd[o + 1] *= 0.3; fd[o + 2] *= 0.3; fd[o + 3] *= 0.32;
    }
  }
}

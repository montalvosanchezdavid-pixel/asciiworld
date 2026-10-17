'use strict';
// Bucle de juego por turnos, combate, interacción y renderizado ASCII en canvas.

const FONT = '"Cascadia Mono", Consolas, "DejaVu Sans Mono", "Courier New", monospace';
const DAY_LEN = 360;           // turnos por día completo
const MAX_MONSTERS = 150;

const MONSTERS = {
  goblin:   { ch: 'g', color: '#7ddc4a', name: 'goblin',    hp: 7,   atk: [1, 3],  def: 0, xp: 6,   gold: [1, 5],     sight: 7 },
  wolf:     { ch: 'w', color: '#b8b8c8', name: 'lobo',      hp: 9,   atk: [2, 4],  def: 0, xp: 8,   gold: [0, 0],     sight: 10 },
  bandit:   { ch: 'b', color: '#e8604e', name: 'bandido',   hp: 14,  atk: [2, 5],  def: 1, xp: 14,  gold: [5, 15],    sight: 8 },
  bear:     { ch: 'B', color: '#b07a40', name: 'oso',       hp: 24,  atk: [3, 8],  def: 1, xp: 26,  gold: [0, 0],     sight: 5 },
  orc:      { ch: 'o', color: '#a8c840', name: 'orco',      hp: 22,  atk: [3, 7],  def: 2, xp: 28,  gold: [4, 12],    sight: 7 },
  skeleton: { ch: 's', color: '#ece8d4', name: 'esqueleto', hp: 20,  atk: [4, 8],  def: 2, xp: 35,  gold: [3, 10],    sight: 8, leash: 7 },
  dragon:   { ch: 'D', color: '#ff4a20', name: 'DRAGÓN',    hp: 160, atk: [7, 15], def: 3, xp: 600, gold: [300, 300], sight: 6, leash: 5, boss: true },
};

const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

let world, player, entities, items, rng, turn, state = 'title', messages, explored, quest, dragonSlain;
let showMap = false, animFrame = 0;

const $ = id => document.getElementById(id);
const canvas = $('view'), ctx = canvas.getContext('2d');
const mapCanvas = $('minimap'), mctx = mapCanvas.getContext('2d');
let cw = 10, chh = 20, cols = 61, rows = 31, fontSize = 18;

const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const xpNext = () => player.lvl * 25;

// ---------------------------------------------------------------- Partida

function newGame(seed) {
  seed = seed ?? ((Math.random() * 2 ** 31) | 0);
  rng = new RNG(seed ^ 0x5bd1e995);
  world = generateWorld(seed);
  entities = world.npcs.map(n => ({ ...n }));
  items = world.items.map(i => ({ ...i }));
  player = { x: world.start.x, y: world.start.y, hp: 30, maxHp: 30, lvl: 1, xp: 0,
             gold: 15, potions: 1, sword: 0, armor: 0, kills: 0 };
  turn = Math.floor(DAY_LEN * 0.30); // amanece
  quest = 0; dragonSlain = false; messages = [];
  explored = new Uint8Array(world.W * world.H);

  for (let i = 0; i < MAX_MONSTERS - 20; i++) spawnMonster(false);
  entities.push(makeMonster('dragon', world.lair.x, world.lair.y));
  for (const g of world.lair.guards) if (world.passable(g.x, g.y)) entities.push(makeMonster('skeleton', g.x, g.y));

  state = 'play';
  showMap = false;
  $('overlay').classList.add('hidden');
  reveal();
  msg('Despiertas en el patio del castillo de Valcorona.', 'gold');
  msg('El rey te espera en el salón del trono, al norte. Camina hacia él para hablar.', 'info');
  updateHud(); render();
}

function makeMonster(type, x, y) {
  const m = MONSTERS[type];
  return { kind: 'enemy', type, ch: m.ch, color: hexRgb(m.color), name: m.name, hp: m.hp, maxHp: m.hp,
           atk: m.atk, def: m.def, xp: m.xp, gold: m.gold, sight: m.sight, leash: m.leash, boss: !!m.boss,
           x, y, home: { x, y } };
}

function pickMonsterType(x, y) {
  const t = world.get(x, y);
  const d = Math.hypot(x - world.castle.cx, y - world.castle.cy);
  if (d < 18) return null;
  const pool = [];
  if (t === T.FOREST || t === T.PINE) { pool.push('goblin', 'goblin', 'wolf'); if (d > 40) pool.push('bear'); }
  else if (t === T.HILL) { pool.push('wolf'); if (d > 30) pool.push('orc', 'orc'); }
  else if (t === T.ROAD) { pool.push('wolf'); if (d > 22) pool.push('bandit', 'bandit'); }
  else if (t === T.GRASS || t === T.MEADOW || t === T.FLOWERS || t === T.SAND) {
    pool.push('wolf', 'goblin'); if (d > 35) pool.push('bandit');
  } else return null;
  if (d > 70) pool.push('orc');
  return rng.pick(pool);
}

function spawnMonster(offscreen) {
  for (let k = 0; k < 60; k++) {
    const x = rng.int(1, world.W - 2), y = rng.int(1, world.H - 2);
    if (!world.passable(x, y) || world.isSafe(x, y) || entityAt(x, y)) continue;
    if (world.regionAt(x, y)) continue;
    if (Math.abs(x - player.x) < 14 && Math.abs(y - player.y) < 10) continue;
    if (offscreen && Math.abs(x - player.x) <= cols / 2 + 2 && Math.abs(y - player.y) <= rows / 2 + 2) continue;
    const type = pickMonsterType(x, y);
    if (!type) continue;
    entities.push(makeMonster(type, x, y));
    return;
  }
}

// ---------------------------------------------------------------- Turnos

function entityAt(x, y) { return entities.find(e => e.x === x && e.y === y); }

function playerAct(dx, dy) {
  if (state !== 'play') return;
  if (dx === 0 && dy === 0) { endTurn(); return; }
  const nx = player.x + dx, ny = player.y + dy;
  const e = entityAt(nx, ny);
  if (e) {
    if (e.kind === 'enemy') attack(e); else interact(e);
    endTurn(); return;
  }
  if (!world.passable(nx, ny)) {
    const def = TILE_DEFS[world.get(nx, ny)];
    msg(def.water ? 'El agua es demasiado profunda para cruzarla con armadura.'
      : `No puedes atravesar: ${def.name}.`, 'dim');
    render(); return;
  }
  player.x = nx; player.y = ny;
  pickup();
  endTurn();
}

function endTurn() {
  turn++;
  if (turn % 7 === 0 && player.hp < player.maxHp) player.hp++;
  for (const e of entities.slice()) {
    if (state !== 'play') break;
    if (e.dead) continue;
    if (e.kind === 'npc') { if (rng.chance(0.3)) wander(e); continue; }
    actEnemy(e);
  }
  entities = entities.filter(e => !e.dead);
  if (turn % 12 === 0 && entities.filter(e => e.kind === 'enemy').length < MAX_MONSTERS) spawnMonster(true);
  reveal();
  updateHud(); render();
}

function canStep(e, x, y) {
  if (!world.passable(x, y) || entityAt(x, y) || (x === player.x && y === player.y)) return false;
  if (e.kind === 'enemy') {
    if (world.isSafe(x, y)) return false;
    if (e.leash && Math.max(Math.abs(x - e.home.x), Math.abs(y - e.home.y)) > e.leash) return false;
  } else {
    const t = world.get(x, y);
    if (t === T.GATE || t === T.DOOR) return false; // que no bloqueen las puertas
    if (Math.max(Math.abs(x - e.home.x), Math.abs(y - e.home.y)) > e.home.r) return false;
  }
  return true;
}

function wander(e) {
  const [dx, dy] = rng.pick(DIRS8);
  if (canStep(e, e.x + dx, e.y + dy)) { e.x += dx; e.y += dy; }
}

function actEnemy(e) {
  const d = cheb(e, player);
  const sight = e.sight + (isNight() ? 3 : 0);
  if (world.isSafe(player.x, player.y)) { if (rng.chance(0.25)) wander(e); return; }
  if (d <= 1) { enemyAttack(e); return; }
  if (d <= sight) {
    let best = null, bestD = Math.hypot(e.x - player.x, e.y - player.y);
    for (const [dx, dy] of DIRS8) {
      const nx = e.x + dx, ny = e.y + dy;
      if (!canStep(e, nx, ny)) continue;
      const nd = Math.hypot(nx - player.x, ny - player.y);
      if (nd < bestD) { bestD = nd; best = [nx, ny]; }
    }
    if (best) { [e.x, e.y] = best; return; }
  }
  if (rng.chance(0.25)) wander(e);
}

// ---------------------------------------------------------------- Combate

function attack(e) {
  let dmg = rng.int(2, 5) + player.sword * 2 + (player.lvl - 1);
  const crit = rng.chance(0.1);
  if (crit) dmg *= 2;
  dmg = Math.max(1, dmg - e.def);
  e.hp -= dmg;
  if (e.hp <= 0) { kill(e); return; }
  msg(`${crit ? '¡Golpe crítico! ' : ''}Golpeas al ${e.name} (${dmg}). [${e.hp}/${e.maxHp}]`, crit ? 'gold' : 'hit');
}

function kill(e) {
  e.dead = true;
  player.kills++;
  const gold = rng.int(e.gold[0], e.gold[1]);
  player.gold += gold;
  msg(`Has derrotado al ${e.name}. +${e.xp} XP${gold ? `, +${gold} oro` : ''}.`, 'good');
  if (rng.chance(0.08)) { items.push({ x: e.x, y: e.y, kind: 'potion' }); msg('Ha dejado caer una poción.', 'good'); }
  if (e.boss) {
    dragonSlain = true;
    msg('¡¡EL DRAGÓN HA CAÍDO!! Vuelve al castillo y dale la noticia al rey.', 'gold');
  }
  gainXp(e.xp);
}

function gainXp(n) {
  player.xp += n;
  while (player.xp >= xpNext()) {
    player.xp -= xpNext();
    player.lvl++;
    player.maxHp += 8;
    player.hp = player.maxHp;
    msg(`¡Subes al nivel ${player.lvl}! Vida máxima ${player.maxHp}, más fuerza.`, 'gold');
  }
}

function enemyAttack(e) {
  if (rng.chance(0.12)) { msg(`El ${e.name} falla su ataque.`, 'dim'); return; }
  const dmg = Math.max(1, rng.int(e.atk[0], e.atk[1]) - player.armor - Math.floor(player.lvl / 3));
  player.hp -= dmg;
  msg(`${e.boss ? 'El DRAGÓN te abrasa' : `El ${e.name} te golpea`} (-${dmg}).`, 'bad');
  if (player.hp <= 0) {
    player.hp = 0;
    state = 'dead';
    msg(`Has muerto a manos de un ${e.name}...`, 'bad');
    showOverlay('HAS CAÍDO', `Te mató un ${e.name} en el día ${dayNumber()}.\nNivel ${player.lvl} · ${player.kills} enemigos derrotados.`,
      'Pulsa ENTER para empezar una nueva aventura');
  }
}

function drinkPotion() {
  if (state !== 'play') return;
  if (player.potions <= 0) { msg('No te quedan pociones.', 'dim'); render(); return; }
  if (player.hp >= player.maxHp) { msg('Ya tienes la vida al máximo.', 'dim'); render(); return; }
  player.potions--;
  const heal = 15 + player.lvl * 3;
  player.hp = Math.min(player.maxHp, player.hp + heal);
  msg(`Bebes una poción y recuperas ${heal} de vida.`, 'good');
  endTurn();
}

function pickup() {
  const i = items.findIndex(it => it.x === player.x && it.y === player.y);
  if (i < 0) return;
  const it = items[i];
  items.splice(i, 1);
  if (it.kind === 'gold') { player.gold += it.amount; msg(`Recoges ${it.amount} monedas de oro.`, 'gold'); }
  else if (it.kind === 'potion') { player.potions++; msg('Recoges una poción curativa.', 'good'); }
  else if (it.kind === 'chest') { player.gold += it.amount; msg(`¡El tesoro del dragón! +${it.amount} oro.`, 'gold'); }
}

// ---------------------------------------------------------------- Diálogos

function compassTo(x, y) {
  const a = Math.atan2(y - world.castle.cy, x - world.castle.cx);
  const names = ['este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste', 'norte', 'noreste'];
  return names[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
}

function interact(n) {
  const say = (text, cls = 'talk') => msg(`${capitalize(n.name)}: «${text}»`, cls);
  switch (n.role) {
    case 'king': {
      const dir = compassTo(world.lair.x, world.lair.y);
      if (quest === 0) {
        say('¡Al fin llegáis, caballero! Un dragón asola mi reino desde su guarida en las montañas.');
        say(`Viajad al ${dir}. Seguid los caminos y cruzad las aldeas. Tomad este oro y estas pociones.`);
        player.gold += 25; player.potions += 2; quest = 1;
        msg('Misión aceptada: mata al dragón. (+25 oro, +2 pociones)', 'gold');
        msg('Consejo: el herrero (H) y el armero (A) del patio mejoran tu equipo.', 'info');
      } else if (quest === 1 && !dragonSlain) {
        say(`El dragón sigue vivo. Su guarida está al ${dir}. No vayáis sin estar preparado.`);
      } else if (quest === 1 && dragonSlain) {
        quest = 2;
        say('¡Habéis salvado Valcorona! Vuestro nombre será cantado por los juglares.');
        state = 'win';
        showOverlay('¡VICTORIA!', `Has salvado el reino en el día ${dayNumber()}.\nNivel ${player.lvl} · ${player.kills} enemigos derrotados · ${player.gold} oro.`,
          'Pulsa ENTER para empezar una nueva aventura');
      } else say('Gracias de nuevo, héroe del reino.');
      break;
    }
    case 'smith': {
      if (player.sword >= 5) { say('Esa espada ya es una obra maestra. No puedo mejorarla.'); break; }
      const cost = 30 + player.sword * 35;
      if (player.gold >= cost) {
        player.gold -= cost; player.sword++;
        say(`Aquí tenéis: espada +${player.sword}. Corta como el viento.`, 'good');
      } else say(`Puedo forjaros una espada +${player.sword + 1} por ${cost} monedas.`);
      break;
    }
    case 'armorer': {
      if (player.armor >= 5) { say('No existe armadura mejor que la vuestra.'); break; }
      const cost = 25 + player.armor * 30;
      if (player.gold >= cost) {
        player.gold -= cost; player.armor++;
        say(`Armadura +${player.armor}. Ni una flecha la atravesará.`, 'good');
      } else say(`Os vendo una armadura +${player.armor + 1} por ${cost} monedas.`);
      break;
    }
    case 'healer': {
      if (player.hp < player.maxHp) {
        if (player.gold >= 5) { player.gold -= 5; player.hp = player.maxHp; say('Ya está. Vuestras heridas han sanado. (5 oro)', 'good'); }
        else say('Necesito 5 monedas para las hierbas, caballero.');
      } else if (player.gold >= 15) { player.gold -= 15; player.potions++; say('Llevaos esta poción, por si acaso. (15 oro)', 'good'); }
      else say('Estáis sano. Volved si necesitáis curación (5 oro) o pociones (15 oro).');
      break;
    }
    default: {
      const lines = n.village ? [...n.lines, `Bienvenido a ${n.village}, forastero.`] : n.lines;
      say(rng.pick(lines));
    }
  }
}

const capitalize = s => s[0].toUpperCase() + s.slice(1);

// ---------------------------------------------------------------- Tiempo y exploración

const dayPhase = () => (turn % DAY_LEN) / DAY_LEN;      // 0 = medianoche, 0.5 = mediodía
const dayNumber = () => Math.floor(turn / DAY_LEN) + 1;
function daylight() {
  const s = 0.5 - 0.5 * Math.cos(dayPhase() * Math.PI * 2);
  const k = Math.min(1, Math.max(0, (s - 0.2) / 0.45));
  return 0.22 + 0.78 * k * k * (3 - 2 * k);
}
const isNight = () => daylight() < 0.5;
function clockText() {
  const mins = Math.floor(dayPhase() * 24 * 60);
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(Math.floor(mins / 15) * 15 % 60).padStart(2, '0')}`;
}

function reveal() {
  const r = isNight() ? 7 : 12;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (dx * dx + dy * dy > r * r) continue;
    const x = player.x + dx, y = player.y + dy;
    if (world.inb(x, y)) explored[y * world.W + x] = 1;
  }
}

function placeName() {
  const r = world.regionAt(player.x, player.y);
  return r ? r.name : capitalize(TILE_DEFS[world.get(player.x, player.y)].name);
}

// ---------------------------------------------------------------- Mensajes y HUD

function msg(text, cls = '') {
  messages.push({ text, cls, turn });
  if (messages.length > 60) messages.shift();
  const log = $('log');
  log.innerHTML = messages.slice(-7).map(m => `<div class="${m.cls}">${escapeHtml(m.text)}</div>`).join('');
}
const escapeHtml = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

function bar(v, max, len, color) {
  const n = Math.round((v / max) * len);
  return `<span style="color:${color}">${'#'.repeat(n)}</span><span class="dim">${'-'.repeat(len - n)}</span>`;
}

function updateHud() {
  const hpColor = player.hp / player.maxHp > 0.5 ? '#6fdc5a' : player.hp / player.maxHp > 0.25 ? '#ffc940' : '#ff5a4a';
  const questText = quest === 0 ? 'Habla con el rey en el salón del trono.'
    : quest === 1 && !dragonSlain ? `Mata al dragón de las montañas del ${compassTo(world.lair.x, world.lair.y)}.`
    : quest === 1 ? 'Vuelve al castillo y anúnciaselo al rey.'
    : '¡El reino está a salvo!';
  $('hud').innerHTML = `
<div class="title">@ Sir Caballero</div>
<div>Nivel <b>${player.lvl}</b></div>
<div>XP   [${bar(player.xp, xpNext(), 12, '#7fb0ff')}]</div>
<div>Vida [${bar(player.hp, player.maxHp, 12, hpColor)}] ${player.hp}/${player.maxHp}</div>
<div class="sep"></div>
<div><span class="gold">$</span> Oro      <b>${player.gold}</b></div>
<div><span class="potion">!</span> Pociones <b>${player.potions}</b></div>
<div>/ Espada   <b>+${player.sword}</b></div>
<div>[ Armadura <b>+${player.armor}</b></div>
<div class="sep"></div>
<div>Día ${dayNumber()} · ${clockText()} ${isNight() ? '<span class="night">(noche)</span>' : '<span class="gold">(día)</span>'}</div>
<div class="place">${escapeHtml(placeName())}</div>
<div class="sep"></div>
<div class="title">Misión</div>
<div class="quest">${questText}</div>`;
}

function showOverlay(title, body, hint) {
  const o = $('overlay');
  o.innerHTML = `<pre class="big">${title}</pre><p>${escapeHtml(body).replace(/\n/g, '<br>')}</p><p class="blink">${hint}</p>`;
  o.classList.remove('hidden');
}

// ---------------------------------------------------------------- Render

function resize() {
  const wrap = $('viewwrap');
  const w = wrap.clientWidth, h = wrap.clientHeight;
  fontSize = w < 700 ? 14 : 18;
  ctx.font = `${fontSize}px ${FONT}`;
  cw = Math.ceil(ctx.measureText('M').width);
  chh = Math.ceil(fontSize * 1.2);
  cols = Math.max(15, Math.floor(w / cw)) | 1;
  rows = Math.max(9, Math.floor(h / chh)) | 1;
  if (cols * cw > w) cols -= 2;
  if (rows * chh > h) rows -= 2;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = cols * cw * dpr; canvas.height = rows * chh * dpr;
  canvas.style.width = cols * cw + 'px'; canvas.style.height = rows * chh + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (state !== 'title') render();
}

const shade = (c, l) => `rgb(${(c[0] * l) | 0},${(c[1] * l) | 0},${(c[2] * l) | 0})`;
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

function render() {
  if (!world) return;
  const W = world.W, H = world.H;
  const camX = Math.max(0, Math.min(W - cols, player.x - (cols >> 1)));
  const camY = Math.max(0, Math.min(H - rows, player.y - (rows >> 1)));
  const day = daylight();
  const torchR = 7;
  ctx.font = `${fontSize}px ${FONT}`;
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, cols * cw, rows * chh);

  const lightAt = (x, y) => {
    const d = Math.hypot(x - player.x, y - player.y);
    const torch = Math.max(0, 1 - d / torchR);
    return Math.max(day, Math.min(1, torch * 1.1));
  };

  for (let sy = 0; sy < rows; sy++) for (let sx = 0; sx < cols; sx++) {
    const wx = camX + sx, wy = camY + sy;
    if (wx >= W || wy >= H) continue;
    const def = TILE_DEFS[world.tiles[wy * W + wx]];
    let ch = def.ch, l = lightAt(wx, wy);
    let fl = l;
    if (def.vary) fl *= 0.85 + hash(wx, wy) * 0.3;
    if (def.anim) {
      const wave = (wx * 3 + wy * 5 + animFrame) % 9;
      if (wave === 0) ch = '-'; else if (wave === 4) ch = ' ';
      fl *= 0.85 + ((wx + wy + animFrame) % 3) * 0.08;
    }
    const px = sx * cw, py = sy * chh;
    ctx.fillStyle = shade(def.bg, l);
    ctx.fillRect(px, py, cw, chh);
    if (ch !== ' ') {
      ctx.fillStyle = shade(def.fg, fl);
      ctx.fillText(ch, px, py + 1);
    }
  }

  const drawGlyph = (x, y, ch, color, bold) => {
    const sx = x - camX, sy = y - camY;
    if (sx < 0 || sy < 0 || sx >= cols || sy >= rows) return;
    const px = sx * cw, py = sy * chh;
    const def = TILE_DEFS[world.tiles[y * W + x]];
    const l = lightAt(x, y);
    ctx.fillStyle = shade(def.bg, l);
    ctx.fillRect(px, py, cw, chh);
    ctx.font = `${bold ? 'bold ' : ''}${fontSize}px ${FONT}`;
    ctx.fillStyle = shade(color, Math.max(0.35, l));
    ctx.fillText(ch, px, py + 1);
    ctx.font = `${fontSize}px ${FONT}`;
  };

  const ITEM_GLYPHS = { gold: ['$', [255, 210, 60]], potion: ['!', [255, 90, 200]], chest: ['&', [255, 200, 40]] };
  for (const it of items) {
    if (day < 0.5 && cheb(it, player) > torchR) continue;
    const [ch, c] = ITEM_GLYPHS[it.kind];
    drawGlyph(it.x, it.y, ch, c, true);
  }
  for (const e of entities) {
    if (e.kind === 'enemy' && day < 0.5 && cheb(e, player) > torchR) continue; // la oscuridad oculta a los monstruos
    drawGlyph(e.x, e.y, e.ch, e.color, true);
  }
  drawGlyph(player.x, player.y, '@', [255, 236, 120], true);

  if (showMap) drawMinimap();
}

function drawMinimap() {
  const W = world.W, H = world.H, S = 3;
  mapCanvas.width = W * S; mapCanvas.height = H * S;
  mctx.fillStyle = '#05050a';
  mctx.fillRect(0, 0, W * S, H * S);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!explored[y * W + x]) continue;
    const def = TILE_DEFS[world.tiles[y * W + x]];
    mctx.fillStyle = shade(def.fg, def.water ? 0.6 : 0.8);
    mctx.fillRect(x * S, y * S, S, S);
  }
  mctx.font = `bold 13px ${FONT}`;
  mctx.textAlign = 'center';
  const label = (x, y, text, color) => {
    mctx.fillStyle = 'rgba(0,0,0,0.7)';
    const w = mctx.measureText(text).width;
    mctx.fillRect(x * S - w / 2 - 3, y * S - 22, w + 6, 16);
    mctx.fillStyle = color;
    mctx.fillText(text, x * S, y * S - 19);
  };
  const c = world.castle;
  label(c.cx, c.y, 'Valcorona', '#ffd040');
  for (const v of world.villages) if (explored[v.y * W + v.x]) label(v.x, v.y - 6, v.name, '#e0c090');
  if (explored[world.lair.y * W + world.lair.x]) label(world.lair.x, world.lair.y - 5, 'Guarida', '#ff6040');
  mctx.fillStyle = (animFrame % 2) ? '#ffffff' : '#ffe060';
  mctx.fillRect(player.x * S - 3, player.y * S - 3, 9, 9);
  mctx.textAlign = 'start';
}

// ---------------------------------------------------------------- Controles

const KEYMAP = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
  q: [-1, -1], e: [1, -1], z: [-1, 1], c: [1, 1],
  Numpad8: [0, -1], Numpad2: [0, 1], Numpad4: [-1, 0], Numpad6: [1, 0],
  Numpad7: [-1, -1], Numpad9: [1, -1], Numpad1: [-1, 1], Numpad3: [1, 1], Numpad5: [0, 0],
  ' ': [0, 0], '.': [0, 0],
};

document.addEventListener('keydown', ev => {
  const key = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
  if (state === 'title' || state === 'dead' || state === 'win') {
    if (key === 'Enter' || key === ' ') { ev.preventDefault(); newGame(); }
    return;
  }
  if (key === 'm') { showMap = !showMap; mapCanvas.classList.toggle('hidden', !showMap); render(); return; }
  if (key === 'Escape' && showMap) { showMap = false; mapCanvas.classList.add('hidden'); return; }
  if (key === 'p') { drinkPotion(); return; }
  const dir = KEYMAP[ev.code.startsWith('Numpad') ? ev.code : key];
  if (dir) { ev.preventDefault(); playerAct(dir[0], dir[1]); }
});

window.addEventListener('resize', resize);
setInterval(() => { animFrame++; if (state === 'play') render(); }, 500);
resize();

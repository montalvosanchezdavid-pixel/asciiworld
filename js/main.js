'use strict';
// ASCII World: juego en tiempo real. Mundo, entidades, combate, luces, clima e interfaz.

const R = new AsciiGL(document.getElementById('screen'));
const IS_TOUCH = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || /[?&]tactil/.test(location.search);
const UI = new TextLayer(R, IS_TOUCH ? 11 : 13);    // interfaz con letra de tamaño fijo, encima del mundo
let fontPx = window.innerWidth < 900 ? 8 : 9;
try { fontPx = parseInt(localStorage.getItem('aw-font2')) || fontPx; } catch (e) { /* sin almacenamiento */ }
R.setFont(fontPx);

const DAY_SECONDS = 300;
const PLAYER_NAME = 'Sir Caballero';
// Semilla del reino: siempre el mismo mapa. Con ?semilla=N en la dirección se prueba otro.
const WORLD_SEED = +(new URLSearchParams(location.search).get('semilla') || 20261012);

const MON = {
  goblin:   { name: 'Goblin',    spr: 'goblin',   hp: 16,  dmg: [2, 5],   spd: 15, xp: 6,   gold: [1, 6],     sight: 55,  range: 7,  cd: 1.1 },
  wolf:     { name: 'Lobo',      spr: 'wolf',     hp: 18,  dmg: [3, 6],   spd: 24, xp: 8,   gold: [0, 0],     sight: 70,  range: 8,  cd: 0.9 },
  bandit:   { name: 'Bandido',   spr: 'bandit',   hp: 30,  dmg: [4, 8],   spd: 16, xp: 15,  gold: [6, 20],    sight: 60,  range: 8,  cd: 1.1 },
  bear:     { name: 'Oso',       spr: 'bear',     hp: 55,  dmg: [6, 12],  spd: 13, xp: 30,  gold: [0, 0],     sight: 45,  range: 10, cd: 1.4 },
  orc:      { name: 'Orco',      spr: 'orc',      hp: 50,  dmg: [6, 11],  spd: 13, xp: 32,  gold: [5, 15],    sight: 55,  range: 9,  cd: 1.3 },
  rat:      { name: 'Rata',      spr: 'rat',      hp: 10,  dmg: [2, 4],   spd: 24, xp: 5,   gold: [0, 2],     sight: 50,  range: 6,  cd: 0.8 },
  spider:   { name: 'Araña',     spr: 'spider',   hp: 26,  dmg: [4, 8],   spd: 20, xp: 18,  gold: [0, 5],     sight: 55,  range: 7,  cd: 1.0 },
  spiderqueen: { name: 'Araña gigante', spr: 'spiderqueen', hp: 320, dmg: [10, 18], spd: 13, xp: 450, gold: [250, 250], sight: 85, range: 15, cd: 1.2, leash: 55, mini: true },
  skeleton: { name: 'Esqueleto', spr: 'skeleton', hp: 45,  dmg: [6, 11],  spd: 14, xp: 38,  gold: [4, 12],    sight: 60,  range: 8,  cd: 1.2, leash: 45 },
  sheep:    { name: 'Oveja',     spr: 'sheep',    hp: 12,  dmg: [0, 0],   spd: 14, xp: 2,   gold: [0, 0],     sight: 0,   range: 0,  cd: 1,   passive: true },
  golem:    { name: 'Gólem del Roble', spr: 'golem', hp: 420, dmg: [14, 22], spd: 9, xp: 500, gold: [120, 120], sight: 60, range: 13, cd: 1.8, leash: 40, mini: true },
  warlord:  { name: 'Caudillo orco', spr: 'orc', hp: 170, dmg: [8, 14], spd: 13, xp: 120, gold: [40, 60], sight: 70, range: 10, cd: 1.2, mini: true },
  dragon:   { name: 'DRAGÓN',    spr: 'dragon',   hp: 500, dmg: [14, 22], spd: 9,  xp: 900, gold: [400, 400], sight: 130, range: 20, cd: 1.6, leash: 30, boss: true },
};

let world, terr, player, enemies, npcs, items, projectiles, particles, floaters, tempLights, messages, corpses = [];
const SWING = 0.22;
let state = 'loading', time = 0, dayTime = 0.3, quest = 0, dragonSlain = false, deathCause = '';
let weather, explored, dialog = null, showMap = false, camX = 0, camY = 0, shake = 0, spawnT = 0, exploreT = 0;
let pendingWin = false;
let rng = new RNG(Date.now() & 0x7fffffff);
const keys = {};

const A = () => R.aspect;
const dist = (a, b) => Math.hypot(a.x - b.x, (a.y - b.y) * A());
const rint = (a, b) => rng.int(a, b);
const matAt = (x, y) => {
  const cx = Math.floor(x), cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= terr.CW || cy >= terr.CH) return T.DEEP;
  return terr.mat[cy * terr.CW + cx];
};
const passable = (x, y) => TILE_DEFS[matAt(x, y)].pass;
const tileOf = (x, y) => world.get(Math.floor(x / TW), Math.floor(y / TH));
const isSafe = (x, y) => world.isSafe(Math.floor(x / TW), Math.floor(y / TH));
const cellOfTile = (tx, ty) => ({ x: tx * TW + TW / 2, y: ty * TH + TH - 1 });
// Altura a la que está alguien: planta de arriba, muralla o torre de vigilancia
const liftOf = e => e.riding ? 2 : e.mount ? Math.round((-HORSE_SADDLE * HORSE_K - 6.6) / A()) : e.floor > 0 && state === 'play' ? FLOOR_H : e.onWall ? (e.perch ? e.perch.ph : CASTLE_WALL_H) : 0;
// ¿Hace falta antorcha? (de noche o bajo tierra)
const isDarkHere = () => (world && world.under) || 1 - daylight() > 0.35;
let saveT = 120;

// ------------------------------------------------------------------ Creación del mundo

function newWorld(seedArg, then) {
  state = 'loading';
  resetLevels();
  R.clear(); UI.clear();
  const msgText = 'Forjando el reino... (unos segundos)';
  UI.text((UI.cols - msgText.length) >> 1, UI.rows >> 1, msgText, 240, 200, 90);
  R.draw();
  setTimeout(() => {
    const seed = seedArg ?? WORLD_SEED;
    world = generateWorld(seed);
    terr = bakeTerrain(world);
    const c = cellOfTile(world.castle.cx, world.castle.y + world.castle.h);
    camX = c.x; camY = c.y;
    dayTime = 0.82;
    weather = { rain: 0, target: 0, timer: 90 + Math.random() * 90, drops: [], splashes: [], lightning: 0 };
    resetEntities();
    state = 'title';
    if (then) then();
  }, 30);
}

function resetEntities() {
  const st = cellOfTile(world.start.x, world.start.y);
  player = {
    x: st.x, y: st.y, facing: 1, dir: { x: 1, y: 0 }, anim: 0, moving: false,
    atkCd: 0, swing: 0, dashT: 0, dashCd: 0, dashDir: { x: 1, y: 0 }, iframes: 0,
    hp: 50, maxHp: 50, lvl: 1, xp: 0, gold: 15, potions: 2, sword: 0, armor: 0, kills: 0,
    food: 100, potatoes: 2, seeds: 0, meat: 0, riding: null, floor: 0, bld: null, onWall: false, hasBow: false, bowCd: 0,
  };
  npcs = world.npcs.map(n => {
    const p = cellOfTile(n.x, n.y);
    const home = n.role === 'peasant' ? cellOfTile(n.home.x, n.home.y) : { ...p };
    const tints = [[120, 90, 50], [70, 110, 60], [140, 70, 50], [90, 80, 130], [150, 130, 80]];
    const hairs = [[90, 60, 35], [40, 30, 25], [180, 140, 70], [120, 60, 30]];
    if (n.camper) {
      const cp = world.camps[n.camp], fc = cellOfTile(cp.x, cp.y);
      p.x = fc.x + Math.cos(n.seat) * 13; p.y = fc.y - 1 + Math.sin(n.seat) * 5;
    }
    return { role: n.role, name: n.name, lines: n.camper ? CAMP_LINES : n.lines, village: n.village, x: p.x, y: p.y,
             camper: !!n.camper, camp: n.camp, mug: n.mug,
             tint: tints[(Math.random() * tints.length) | 0], hairC: hairs[(Math.random() * hairs.length) | 0], hat: Math.random() < 0.5,
             home, homeR: (n.home.r || 0) * TW, target: null, wait: Math.random() * 3, anim: 0, facing: 1,
             floor: n.floor || 0, bld: n.bld !== undefined ? world.buildings[n.bld] : null, onWall: !!n.onWall };
  });
  items = world.items.map((it, i) => ({ ...it, id: i, ...cellOfTile(it.x, it.y) }));
  enemies = [];
  const lair = cellOfTile(world.lair.x, world.lair.y);
  enemies.push(makeEnemy('dragon', lair.x, lair.y));
  if (world.ancient) { const p = cellOfTile(world.ancient.x, world.ancient.y + 5); const g = makeEnemy('golem', p.x, p.y); g.sleep = true; enemies.push(g); }
  for (const g of world.lair.guards) {
    const p = cellOfTile(g.x, g.y);
    if (passable(p.x, p.y)) enemies.push(makeEnemy('skeleton', p.x, p.y));
  }
  projectiles = []; particles = []; floaters = []; tempLights = []; messages = []; corpses = []; arrows = [];
  initNature();
  initSheep();
  initHorses();
  explored = new Uint8Array(world.W * world.H);
  initFarming();
  quest = 0; dragonSlain = false; dialog = null; showMap = false; pendingWin = false;
}

function makeEnemy(type, x, y) {
  const m = MON[type];
  return { type, ...m, maxHp: m.hp, x, y, home: { x, y }, facing: -1, anim: 0, atkCd: 1, flash: 0,
           kx: 0, ky: 0, wander: null, wt: 0, fireCd: 2.5, engaged: false };
}

function respawn() {
  leaveUnderForRespawn();
  const st = cellOfTile(world.start.x, world.start.y);
  player.x = st.x; player.y = st.y; player.hp = player.maxHp; player.iframes = 2;
  player.floor = 0; player.bld = null; player.onWall = false; player.riding = null; if (player.mount) dismount(true); player.food = Math.max(player.food, 60); player.hungerWarn = 0;
  const lost = Math.floor(player.gold / 2);
  player.gold -= lost;
  enemies = enemies.filter(e => e.boss || e.leash);
  for (const e of enemies) if (e.boss) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.4);
  projectiles = [];
  camX = player.x; camY = player.y;
  state = 'play';
  msg(`Despiertas en el castillo, malherido. Pierdes ${lost} de oro.`, [255, 140, 120]);
}

function startGame(silent) {
  resetEntities();
  dayTime = 0.30;
  const c = player;
  camX = c.x; camY = c.y;
  state = 'play';
  saveT = 120;
  if (silent) return;
  msg('Despiertas en el patio del castillo de Valcorona.', [240, 200, 90]);
  msg('El rey te espera en el salón del trono, al norte. Acércate y pulsa E.', [140, 190, 255]);
  msg('Vigila tu comida: cosecha patatas en los huertos (E) y cómetelas (R).', [220, 200, 140]);
}

// ------------------------------------------------------------------ Mensajes y efectos

function msg(text, c = [210, 210, 210]) {
  messages.push({ text, c, t: time });
  if (messages.length > 30) messages.shift();
}
function floater(x, y, text, c) { floaters.push({ x, y, text, c, life: 1.1 }); }
function burst(x, y, n, chars, c1, c2, speed = 30, life = 0.6) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s / A(), life: life * (0.5 + Math.random() * 0.5),
                     max: life, ch: chars[(Math.random() * chars.length) | 0], c: lerp3(c1, c2, Math.random()) });
  }
}

// ------------------------------------------------------------------ Tiempo

function daylight() {
  const s = 0.5 - 0.5 * Math.cos(dayTime * Math.PI * 2);
  const k = clamp01((s - 0.2) / 0.45);
  return 0.08 + 0.92 * k * k * (3 - 2 * k);
}
const isNight = () => daylight() < 0.45;
const dayNumber = () => Math.floor(dayTime) + 1;
function clockText() {
  const mins = Math.floor((dayTime % 1) * 24 * 60);
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(Math.floor(mins % 60 / 10) * 10).padStart(2, '0')}`;
}

// ------------------------------------------------------------------ Bucle principal

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state !== 'loading') {
    update(dt);
    render();
  }
}

function update(dt) {
  time += dt;
  Sfx.update(dt);
  if (state === 'title') {
    const c = cellOfTile(world.castle.cx, world.castle.y + world.castle.h);
    camX = c.x + Math.sin(time * 0.08) * 60;
    camY = c.y - 10 + Math.cos(time * 0.06) * 12;
    updateWeather(dt);
    updateWind(dt);
    updateCritters(dt);
    updateParticles(dt);
    return;
  }
  if (state === 'intro') { updateIntro(dt); return; }
  if (state !== 'play' || dialog || showMap) { updateParticles(dt * (state === 'play' ? 0 : 1)); return; }

  dayTime += dt / DAY_SECONDS;
  updateWeather(dt);
  updatePlayer(dt);
  updatePens(dt);
  updateHorses(dt);
  updateVillageLife(dt);
  updateNightlife(dt);
  updateGround(dt);
  updateWitchStuff(dt);
  updateRaids(dt);
  updateRaidFires(dt);
  updateWebs();
  updateMist(dt);
  updateBuildingState();
  updateHunger(dt);
  saveT -= dt;
  if (saveT <= 0) { saveT = 120; saveGame(true); }
  updateWind(dt);
  updateCritters(dt);
  updateCrops(dt);
  updateSmoke(dt);
  for (const n of npcs) updateNpc(n, dt);
  for (const e of enemies) updateEnemy(e, dt);
  enemies = enemies.filter(e => !e.dead);
  updateProjectiles(dt);
  updateArrows(dt);
  updateParticles(dt);

  spawnT -= dt;
  if (spawnT <= 0) { spawnT = 6; spawnEnemies(); }
  exploreT -= dt;
  if (exploreT <= 0) { exploreT = 0.25; reveal(); }

  camX += (player.x - camX) * Math.min(1, dt * 7);
  camY += (player.y - 2 - liftOf(player) - camY) * Math.min(1, dt * 7);
  shake = Math.max(0, shake - dt);
  R.flash = R.flash.map(v => Math.max(0, v - dt * 1.5));
}

// ------------------------------------------------------------------ Jugador

function updatePlayer(dt) {
  const p = player;
  p.atkCd -= dt; p.swing -= dt; p.dashCd -= dt; p.iframes -= dt; p.throwT = (p.throwT || 0) - dt;
  if (p.riding) { updateRiding(dt); return; }
  let mx = 0, my = 0;
  if (keys.KeyA || keys.ArrowLeft) mx -= 1;
  if (keys.KeyD || keys.ArrowRight) mx += 1;
  if (keys.KeyW || keys.ArrowUp) my -= 1;
  if (keys.KeyS || keys.ArrowDown) my += 1;
  const len = Math.hypot(mx, my);
  if (len) {
    mx /= len; my /= len; p.dir = { x: mx, y: my }; if (mx) p.facing = mx > 0 ? 1 : -1;
    p.view = Math.abs(my) > Math.abs(mx) * 1.1 ? (my < 0 ? 'back' : 'front') : 'side';     // de espaldas, de frente o de perfil
  }
  let spd = p.mount ? HORSE_SPEED : 24;
  if (matAt(p.x, p.y) === T.LAKE) spd *= 0.55;                                 // vadeando
  if (p.dashT > 0) { p.dashT -= dt; spd = 75; mx = p.dashDir.x; my = p.dashDir.y; if (Math.random() < 0.6) burst(p.x, p.y, 1, '.,\'', [160, 150, 130], [90, 80, 70], 8, 0.4); }
  p.moving = mx !== 0 || my !== 0;
  if (p.moving) {
    moveBody(p, mx * spd * dt, my * spd / A() * dt, false);
    p.anim += dt * 9;
    if (p.mount && Math.random() < dt * 12) burst(p.x - mx * 4, p.y + 0.3, 1, '.,\'', [150, 130, 100], [90, 80, 60], 10, 0.5);
    if (Math.random() < dt * 4) burst(p.x, p.y + 0.3, 1, '.,', [120, 110, 90], [80, 70, 60], 4, 0.35);
  }
  // chispas de la antorcha por la noche
  if (isDarkHere() && Math.random() < dt * 14) {
    const lift = liftOf(p);
    particles.push({ x: p.x - p.facing * 3.6, y: p.y - 21.5 / A() - lift, vx: (Math.random() - 0.5) * 3, vy: -3 - Math.random() * 4,
                     life: 0.5, max: 0.5, float: true, ch: "*'.^"[(Math.random() * 4) | 0], c: lerp3([255, 220, 110], [255, 80, 20], Math.random()) });
  }
  // recoger objetos
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (dist(it, p) > 4 || !entityVisible(it) || !!it.onWall !== !!p.onWall) continue;
    if (it.kind === 'bow') {
      if (!p.hasBow) { p.hasBow = true; floater(p.x, p.y - 8, '¡Arco!', [255, 200, 90]); msg('Coges un arco. Haz clic con el ratón para disparar flechas de fuego.', [255, 200, 90]); }
      continue;
    }
    items.splice(i, 1);
    if (it.kind === 'gold' || it.kind === 'chest' || it.kind === 'potion') Sfx.coin();
    if (it.kind === 'gold') { p.gold += it.amount; floater(p.x, p.y - 6, `+${it.amount}$`, [255, 215, 60]); }
    else if (it.kind === 'potion') { p.potions++; floater(p.x, p.y - 6, '+1 poción', [255, 100, 210]); msg('Recoges una poción curativa.', [255, 120, 210]); }
    else if (it.kind === 'chest') { p.gold += it.amount; floater(p.x, p.y - 6, `+${it.amount}$`, [255, 215, 60]); msg(it.bld !== undefined ? `Abres un cofre: +${it.amount} de oro.` : `¡El tesoro del dragón! +${it.amount} de oro.`, [255, 215, 60]); burst(it.x, it.y, 30, '$*+', [255, 220, 80], [255, 160, 40], 35, 0.9); }
    else if (it.kind === 'seeds') { p.seeds += it.amount; floater(p.x, p.y - 6, `+${it.amount} semillas`, [190, 220, 120]); msg(`Encuentras ${it.amount} semillas de patata.`, [190, 220, 120]); }
    else if (it.kind === 'potato') { p.potatoes += 1; floater(p.x, p.y - 6, '+1 patata', [230, 200, 130]); }
    else if (it.kind === 'meat') { p.meat += 1; floater(p.x, p.y - 6, '+1 carne', [235, 140, 120]); msg('Recoges carne de oveja. Pulsa R para comer.', [235, 160, 130]); }
  }
}

function moveBody(e, dx, dy, enemy) {
  const ok = e.onWall ? (x, y) => perchWalk(e, x, y)
    : (x, y) => TILE_DEFS[matAtF(x, y, e.floor || 0, e.bld)].pass && !(enemy && isSafe(x, y)) && !(e.raider && inWalls(x / TW, y / TH));
  if (dx && ok(e.x + dx, e.y)) e.x += dx;
  if (dy && ok(e.x, e.y + dy)) e.y += dy;
}

function attack() {
  const p = player;
  if (p.riding || (p.onWall && p.perch)) { lanceAtNearest(); return; }
  if (p.atkCd > 0) return;
  p.atkCd = 0.36; p.swing = SWING;
  Sfx.swing();
  let hitAny = false, critAny = false;
  const dl = Math.hypot(p.dir.x, p.dir.y * 1) || 1;
  const fx = p.dir.x / dl, fy = p.dir.y / dl;
  tempLights.push({ x: p.x + fx * 6, y: p.y - 2 + fy * 3, r: 14, c: [0.7, 0.85, 1.0], k: 0.7, life: 0.12, max: 0.12 });
  for (const e of enemies) {
    const reach = e.boss ? 22 : 11;
    const d = dist(e, p);
    if (d > reach) continue;
    const vx = (e.x - p.x) / (d || 1), vy = ((e.y - p.y) * A()) / (d || 1);
    if (d > 4 && vx * fx + vy * fy < -0.15) continue;
    let dmg = rint(6, 10) + p.sword * 5 + (p.lvl - 1) * 2;
    const crit = Math.random() < 0.12;
    if (crit) dmg *= 2;
    if (e.boss) dmg = dragonDamage(dmg);
    hitAny = true; critAny ||= crit;
    e.hp -= dmg; e.flash = 0.12; e.engaged = true;
    if (!e.boss) { e.kx = vx * 40; e.ky = vy * 40 / A(); }
    floater(e.x, e.y - (e.boss ? 14 : 6), crit ? `${dmg}!` : `${dmg}`, crit ? [255, 220, 60] : [255, 255, 255]);
    burst(e.x, e.y - 2, crit ? 10 : 5, '*+.', [255, 255, 255], [255, 160, 60], 25, 0.35);
    if (e.hp <= 0) killEnemy(e);
  }
  if (hitAny) Sfx.hit(critAny);
}

// Las escamas del dragón: sin la Espada Matadragones apenas se le hace daño
let scaleMsgT = -99;
function dragonDamage(dmg) {
  if (player.dragonbane) return Math.round(dmg * 1.5);
  if (time - scaleMsgT > 8) { scaleMsgT = time; msg('¡Tus golpes rebotan en las escamas del dragón! Necesitas la Espada Matadragones.', [255, 140, 90]); }
  return Math.max(1, Math.round(dmg * 0.15));
}

function killEnemy(e) {
  e.dead = true;
  corpses.push({ e, life: 0.7 });
  if (e.passive) {
    const n = rint(1, 2);
    for (let k = 0; k < n; k++) items.push({ x: e.x + (k - 0.5) * 3, y: e.y, kind: 'meat' });
    burst(e.x, e.y - 2, 12, '*.,\'', [230, 230, 230], [190, 40, 30], 25, 0.6);
    msg(`Sacrificas una oveja: ${n} ${n > 1 ? 'trozos' : 'trozo'} de carne.`, [235, 160, 130]);
    gainXp(e.xp);
    return;
  }
  player.kills++;
  spawnT = Math.max(spawnT, 30);
  if (e.type === 'golem') {
    player.golemHeart = true;
    msg('¡Has vencido al Gólem del Roble! Recoges su corazón, que aún late con savia verde. La bruja sabrá usarlo.', [140, 255, 140]);
    floater(e.x, e.y - 20, '¡Corazón de gólem!', [160, 255, 140]);
  }
  if (e.type === 'spiderqueen') {
    player.fang = true;
    if (quest <= 1) quest = quest === 0 ? 0 : 2;
    msg('¡La Araña Gigante ha muerto! Arrancas su colmillo venenoso. Llévaselo al herrero del castillo.', [140, 255, 140]);
    floater(e.x, e.y - 18, '¡Colmillo venenoso!', [160, 255, 140]);
  }          // tras una muerte, un rato sin enemigos nuevos
  const gold = rint(e.gold[0], e.gold[1]);
  player.gold += gold;
  msg(`Derrotas a ${e.boss ? 'el DRAGÓN' : `un ${e.name.toLowerCase()}`}. +${e.xp} XP${gold ? `, +${gold} oro` : ''}.`, [130, 230, 110]);
  burst(e.x, e.y - 2, e.boss ? 80 : 18, e.type === 'skeleton' ? 'x%.' : '*.,\'', e.boss ? [255, 200, 60] : [200, 60, 40], e.boss ? [255, 60, 20] : [120, 30, 20], e.boss ? 60 : 30, e.boss ? 1.6 : 0.7);
  if (Math.random() < 0.1) items.push({ x: e.x, y: e.y, kind: 'potion' });
  if (e.boss) {
    dragonSlain = true;
    shake = 1.2; R.flash = [0.5, 0.3, 0.1];
    msg('¡¡EL DRAGÓN HA CAÍDO!! Vuelve al castillo y díselo al rey.', [255, 215, 60]);
  }
  gainXp(e.xp);
}

function gainXp(n) {
  const p = player;
  p.xp += n;
  while (p.xp >= p.lvl * 30) {
    p.xp -= p.lvl * 30;
    p.lvl++;
    Sfx.levelUp();
    p.maxHp += 12; p.hp = p.maxHp;
    floater(p.x, p.y - 9, `¡NIVEL ${p.lvl}!`, [255, 220, 60]);
    burst(p.x, p.y - 2, 30, '*+', [255, 240, 150], [255, 180, 40], 30, 1.0);
    msg(`¡Subes al nivel ${p.lvl}! Más vida y más fuerza.`, [255, 215, 60]);
  }
}

function hurtPlayer(dmg, src) {
  const p = player;
  if (p.iframes > 0 || state !== 'play') return;
  dmg = Math.max(1, dmg - p.armor * 2 - Math.floor(p.lvl / 2));
  p.hp -= dmg; p.iframes = 0.5;
  Sfx.hurt();
  floater(p.x, p.y - 7, `-${dmg}`, [255, 80, 60]);
  burst(p.x, p.y - 2, 6, '*.', [255, 80, 60], [150, 20, 20], 20, 0.4);
  shake = 0.18; R.flash = [0.18, 0.0, 0.0];
  if (p.hp <= 0) {
    p.hp = 0;
    state = 'dead';
    deathCause = src;
    burst(p.x, p.y - 2, 40, '*%.', [220, 40, 30], [90, 10, 10], 35, 1.2);
  }
}

function drinkPotion() {
  const p = player;
  if (p.potions <= 0) { msg('No te quedan pociones.', [140, 140, 140]); return; }
  if (p.hp >= p.maxHp) { msg('Ya tienes la vida al máximo.', [140, 140, 140]); return; }
  p.potions--;
  Sfx.gulp();
  const heal = 25 + p.lvl * 5;
  p.hp = Math.min(p.maxHp, p.hp + heal);
  floater(p.x, p.y - 7, `+${heal}`, [110, 255, 120]);
  burst(p.x, p.y - 2, 14, '+*', [120, 255, 140], [255, 120, 220], 18, 0.8);
}

function dash() {
  const p = player;
  if (p.dashCd > 0) return;
  p.dashCd = 0.8; p.dashT = 0.16; p.iframes = Math.max(p.iframes, 0.25);
  p.dashDir = { ...p.dir };
}

// ------------------------------------------------------------------ PNJ

function updateNpc(n, dt) {
  if (n.camper) { updateCamper(n, dt); return; }
  if (n.homeR <= 0) return;
  if (!n.target) {
    n.wait -= dt;
    if (n.wait > 0) return;
    const a = Math.random() * Math.PI * 2, r = Math.random() * n.homeR;
    const tx = n.home.x + Math.cos(a) * r, ty = n.home.y + Math.sin(a) * r / A();
    if (passable(tx, ty) && tileOf(tx, ty) !== T.GATE && tileOf(tx, ty) !== T.DOOR) n.target = { x: tx, y: ty };
    n.wait = 1 + Math.random() * 4;
    return;
  }
  const dx = n.target.x - n.x, dy = (n.target.y - n.y) * A();
  const d = Math.hypot(dx, dy);
  if (d < 1) { n.target = null; return; }
  const sx = dx / d * 6 * dt, sy = dy / d * 6 / A() * dt;
  const nx = n.x + sx, ny = n.y + sy;
  if (!passable(nx, ny) || tileOf(nx, ny) === T.GATE || tileOf(nx, ny) === T.DOOR) { n.target = null; return; }
  n.x = nx; n.y = ny; n.anim += dt * 6;
  if (Math.abs(dx) > 0.5) n.facing = dx > 0 ? 1 : -1;
}

function nearestNpc() {
  let best = null, bd = 12;
  for (const n of npcs) { if ((n.camper && !campTime()) || !entityVisible(n) || n.onWall !== !!player.onWall) continue; const d = dist(n, player); if (d < bd) { bd = d; best = n; } }
  return best;
}

function compassTo(x, y) {
  const a = Math.atan2(y - world.castle.cy, x - world.castle.cx);
  const names = ['este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste', 'norte', 'noreste'];
  return names[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
}

function interact(n) {
  const p = player;
  const lines = [];
  const burnt = n.role !== 'king' && n.role !== 'guard' && burnedHere(n.x, n.y);
  if (burnt) {
    dialog = { name: n.name.replace(/^(el|la|un|una) /, ''), i: 0, lines: [pick2(['¡Nuestro pueblo arde! No puedo atenderos hasta que lo reconstruyamos...',
      'Los saqueadores lo quemaron todo. Volved dentro de un par de días, caballero.', 'Lo hemos perdido todo... Si hubierais llegado antes...'])] };
    return;
  }
  const dir = compassTo(world.lair.x, world.lair.y);
  switch (n.role) {
    case 'king':
      // Misión: araña gigante -> colmillo -> espada matadragones -> dragón -> volver al rey
      if (dragonSlain && quest < 5) {
        quest = 5; pendingWin = true;
        lines.push('¡Habéis salvado Valcorona! Vuestro nombre será cantado por los juglares durante siglos.');
      } else if (quest === 0) {
        lines.push('¡Al fin llegáis, caballero! Un dragón asola mi reino desde su guarida en las montañas.',
          'Pero sus escamas son duras como la roca: ninguna espada forjada por hombres puede atravesarlas.',
          'Mi herrero conoce una vieja leyenda: solo una hoja templada con el veneno de la Araña Gigante puede herir al dragón.',
          'La araña anida en las catacumbas, en mitad de la vía más larga del tren. Bajad por la cripta del cementerio, matadla y traed su colmillo.',
          'Tomad este oro y estas pociones. El herrero y el armero del patio pueden mejorar vuestro equipo.');
        p.gold += 30; p.potions += 2;
        quest = p.fang ? 2 : 1;
        msg('Misión: mata a la araña gigante de las catacumbas y consigue su colmillo. (+30 oro, +2 pociones)', [255, 215, 60]);
      } else if (quest === 1) {
        lines.push('La Araña Gigante sigue viva. Su nido está en las catacumbas, en mitad de la vía más larga del tren.',
          'Llevad antorchas... y muchas pociones. Sus colmillos son veneno puro.');
      } else if (quest === 2) {
        lines.push('¡El colmillo de la araña! Corred a la herrería del patio: el herrero sabrá qué hacer con él.');
      } else if (quest === 3) {
        lines.push(`Con la Espada Matadragones ya podéis enfrentaros a la bestia. Su guarida está al ${dir}.`, 'Que la fortuna os acompañe.');
      } else lines.push('Gracias de nuevo, héroe del reino.');
      break;
    case 'witch': witchTalk(p, lines); break;
    case 'smith': {
      if (p.fang && !p.dragonbane) {
        p.dragonbane = true; p.fang = false; quest = Math.max(quest, 3);
        lines.push('¿Eso es...? ¡Un colmillo de la Araña Gigante! Dejadme trabajar.',
          'Fundo el acero, lo templo en su veneno y... ¡ya está! La Espada Matadragones.',
          'Brilla con un fulgor verdoso. Con ella las escamas del dragón se abrirán como mantequilla.');
        msg('¡Obtienes la Espada Matadragones! Ahora puedes herir de verdad al dragón.', [140, 255, 140]);
        burst(p.x, p.y - 6, 30, '*+', [180, 255, 160], [60, 200, 80], 30, 1.0);
        Sfx.levelUp();
        break;
      }
      if (p.sword >= 5) { lines.push('Esa espada ya es una obra maestra. No puedo mejorarla.'); break; }
      const cost = 30 + p.sword * 40;
      if (p.gold >= cost) { p.gold -= cost; p.sword++; lines.push(`Aquí tenéis: espada +${p.sword}. Corta como el viento. (-${cost} oro)`); }
      else lines.push(`Puedo forjaros una espada +${p.sword + 1} por ${cost} monedas de oro.`);
      break;
    }
    case 'armorer': {
      if (p.armor >= 5) { lines.push('No existe armadura mejor que la vuestra.'); break; }
      const cost = 25 + p.armor * 35;
      if (p.gold >= cost) { p.gold -= cost; p.armor++; lines.push(`Armadura +${p.armor}. Ni una flecha la atravesará. (-${cost} oro)`); }
      else lines.push(`Os vendo una armadura +${p.armor + 1} por ${cost} monedas de oro.`);
      break;
    }
    case 'farmer':
      if (!p.gotSeeds) {
        p.gotSeeds = true; p.seeds += 5;
        lines.push('¡Hola, caballero! ¿Sabéis cultivar? Tomad estas 5 semillas de patata.',
          'Plantadlas con E en la tierra vacía de los huertos. Crecen solas, y con lluvia el doble de rápido.',
          'Cuando veáis las patatas asomar, cosechadlas con E. Con R os coméis una: quita el hambre y cura.');
      } else if (p.gold >= 5) { p.gold -= 5; p.seeds += 3; lines.push('Aquí tenéis 3 semillas más. (-5 oro)'); }
      else lines.push('Un puñado de semillas cuesta 5 monedas. Volved cuando tengáis.');
      break;
    case 'innkeeper':
      if (p.gold >= 10) { p.gold -= 10; p.food = 100; p.hp = Math.min(p.maxHp, p.hp + 40); p.hungerWarn = 0; lines.push('¡Un buen estofado de la casa! Os dejará como nuevo. (-10 oro)'); }
      else lines.push('El estofado cuesta 10 monedas. Si andáis cortos, en los huertos hay patatas.');
      break;
    case 'healer':
      if (p.hp < p.maxHp) {
        if (p.gold >= 5) { p.gold -= 5; p.hp = p.maxHp; lines.push('Ya está. Vuestras heridas han sanado. (-5 oro)'); }
        else lines.push('Necesito 5 monedas para las hierbas, caballero.');
      } else if (p.gold >= 15) { p.gold -= 15; p.potions++; lines.push('Llevaos esta poción, por si acaso. (-15 oro)'); }
      else lines.push('Estáis sano. Volved si necesitáis curación (5 oro) o pociones (15 oro).');
      break;
    default: {
      const pool = n.village ? [...n.lines, `Bienvenido a ${n.village}, forastero.`] : n.lines;
      lines.push(pool[(Math.random() * pool.length) | 0]);
    }
  }
  dialog = { name: n.name.replace(/^(el|la|un|una) /, ''), lines, i: 0 };
}

const pick2 = a => a[(Math.random() * a.length) | 0];

function advanceDialog() {
  dialog.i++;
  if (dialog.i >= dialog.lines.length) {
    dialog = null;
    if (pendingWin) { pendingWin = false; state = 'win'; }
  }
}

// ------------------------------------------------------------------ Enemigos

function updateEnemy(e, dt) {
  e.atkCd -= dt; e.flash -= dt; e.atkAnim = (e.atkAnim || 0) - dt;
  updateBurn(e, dt);
  if (e.dead) return;
  if (e.passive) { updateSheep(e, dt); return; }
  if (e.raider && !(e.kx || e.ky) && raiderMarch(e, dt)) return;
  if (e.type === 'golem' && (golemWake(e, dist(e, player)) || golemReturn(e, dt))) return;
  if (e.kx || e.ky) {
    moveBody(e, e.kx * dt, e.ky * dt, !e.raider);
    const decay = Math.exp(-10 * dt);
    e.kx *= decay; e.ky *= decay;
    if (Math.abs(e.kx) < 0.5) e.kx = 0;
    if (Math.abs(e.ky) < 0.5) e.ky = 0;
    if (e.leash) {
      const hd = Math.hypot(e.x - e.home.x, (e.y - e.home.y) * A());
      if (hd > e.leash) { e.x = e.home.x + (e.x - e.home.x) * e.leash / hd; e.y = e.home.y + (e.y - e.home.y) * e.leash / hd; }
    }
  }
  const d = dist(e, player);
  const sight = e.sight + (isNight() ? 20 : 0);
  const pSafe = isSafe(player.x, player.y);
  const leashOk = (x, y) => !e.leash || Math.hypot(x - e.home.x, (y - e.home.y) * A()) <= e.leash;

  if (e.boss) { updateDragon(e, dt, d, pSafe); return; }

  if ((!pSafe || e.raider) && (d < sight || e.engaged) && d < sight * 1.6) {
    if (e.mini) e.engaged = true;
    const dx = player.x - e.x, dy = (player.y - e.y) * A();
    e.facing = dx > 0 ? 1 : -1;
    if (d > e.range * 0.75) {
      const sx = dx / d * e.spd * dt, sy = dy / d * e.spd / A() * dt;
      if (leashOk(e.x + sx, e.y + sy)) moveBody(e, sx, sy, !e.raider);
      e.anim += dt * 8;
    }
    if (d <= e.range && e.atkCd <= 0 && !player.onWall) {
      e.atkCd = e.cd; e.atkAnim = 0.3;
      if (e.type === 'golem') golemSlam(e);
      hurtPlayer(rint(e.dmg[0], e.dmg[1]), e.name.toLowerCase());
    }
  } else {
    e.engaged = false;
    e.wt -= dt;
    if (e.wt <= 0) {
      e.wt = 1 + Math.random() * 3;
      e.wander = Math.random() < 0.5 ? null : { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 };
    }
    if (e.wander) {
      const sx = e.wander.x * e.spd * 0.3 * dt, sy = e.wander.y * e.spd * 0.3 / A() * dt;
      if (leashOk(e.x + sx, e.y + sy)) moveBody(e, sx, sy, true);
      if (e.wander.x) e.facing = e.wander.x > 0 ? 1 : -1;
      e.anim += dt * 5;
    }
  }
  // separación entre enemigos
  for (const o of enemies) {
    if (o === e || o.boss) continue;
    const dd = dist(o, e);
    if (dd < 4 && dd > 0) moveBody(e, (e.x - o.x) / dd * 8 * dt, (e.y - o.y) / dd * 8 * dt, true);
  }
}

function updateDragon(e, dt, d, pSafe) {
  e.anim += dt * 2.5;
  if (pSafe || d > e.sight) { e.engaged = false; return; }
  e.engaged = true;
  const dx = player.x - e.x, dy = (player.y - e.y) * A();
  e.facing = dx > 0 ? 1 : -1;
  // mantiene la distancia y dispara bolas de fuego
  let mv = 0;
  if (d > 50) mv = 1; else if (d < 22) mv = -0.6;
  if (mv) {
    const sx = dx / d * e.spd * mv * dt, sy = dy / d * e.spd * mv / A() * dt;
    const nx = e.x + sx, ny = e.y + sy;
    if (Math.hypot(nx - e.home.x, (ny - e.home.y) * A()) <= e.leash) { e.x = nx; e.y = ny; }
  }
  e.fireCd -= dt;
  if (e.fireCd <= 0) {
    const enraged = e.hp < e.maxHp / 2;
    e.fireCd = enraged ? 1.3 : 2.1;
    const base = Math.atan2(dy, dx);
    const spread = enraged ? [-0.28, 0, 0.28] : [0];
    for (const s of spread) {
      const a = base + s;
      projectiles.push({ x: e.x + e.facing * 4, y: e.y - 8, vx: Math.cos(a) * 42, vy: Math.sin(a) * 42 / A(), life: 3, dmg: rint(10, 18) });
    }
    tempLights.push({ x: e.x, y: e.y - 8, r: 30, c: [1, 0.5, 0.1], k: 1.2, life: 0.3, max: 0.3 });
  }
  if (d <= e.range && e.atkCd <= 0) {
    e.atkCd = e.cd; e.atkAnim = 0.3;
    hurtPlayer(rint(e.dmg[0], e.dmg[1]), 'el dragón');
  }
}

function updateProjectiles(dt) {
  for (const f of projectiles) {
    f.x += f.vx * dt; f.y += f.vy * dt; f.life -= dt;
    if (Math.random() < 0.9) particles.push({ x: f.x, y: f.y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 3, life: 0.45, max: 0.45,
      ch: '*+.'[(Math.random() * 3) | 0], c: lerp3([255, 220, 90], [255, 70, 20], Math.random()) });
    const hit = dist(f, player) < 4;
    const wall = TILE_DEFS[matAt(f.x, f.y)].pass === false && !TILE_DEFS[matAt(f.x, f.y)].water;
    if (hit || wall || f.life <= 0) {
      f.dead = true;
      if (hit) hurtPlayer(Math.max(1, Math.round(f.dmg * fireFactor())), 'el fuego del dragón');
      burst(f.x, f.y, 22, '*+#.', [255, 230, 120], [255, 60, 10], 40, 0.6);
      tempLights.push({ x: f.x, y: f.y, r: 26, c: [1, 0.55, 0.15], k: 1.6, life: 0.35, max: 0.35 });
      if (dist(f, player) < 30) shake = Math.max(shake, 0.12);
    }
  }
  projectiles = projectiles.filter(f => !f.dead);
}

function updateParticles(dt) {
  for (const p of particles) { if (p.g) p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (!p.float) { p.vx *= 0.94; p.vy *= 0.94; } p.life -= dt; }
  particles = particles.filter(p => p.life > 0);
  for (const f of floaters) { f.y -= dt * 5; f.life -= dt; }
  floaters = floaters.filter(f => f.life > 0);
  for (const c of corpses) c.life -= dt;
  corpses = corpses.filter(c => c.life > 0);
  for (const l of tempLights) l.life -= dt;
  tempLights = tempLights.filter(l => l.life > 0);
}

function pickMonsterType(x, y) {
  const tx = Math.floor(x / TW), ty = Math.floor(y / TH);
  const t = world.get(tx, ty);
  const d = Math.hypot(tx - world.castle.cx, ty - world.castle.cy);
  const reg = world.regionAt(tx, ty);
  if (d < 30 || reg) return null;
  const pool = [];
  if (t === T.FOREST || t === T.PINE) { pool.push('goblin', 'goblin', 'wolf'); if (d > 60) pool.push('bear'); }
  else if (t === T.HILL) { pool.push('wolf'); if (d > 45) pool.push('orc', 'orc'); }
  else if (t === T.ROAD) { pool.push('wolf'); if (d > 35) pool.push('bandit', 'bandit'); }
  else if (t === T.GRASS || t === T.MEADOW || t === T.FLOWERS || t === T.SAND) { pool.push('wolf', 'goblin'); if (d > 50) pool.push('bandit'); }
  else return null;
  if (d > 110) pool.push('orc');
  return pool[(Math.random() * pool.length) | 0];
}

function spawnEnemies() {
  if (world.under) {
    enemies = enemies.filter(e => e.mini || dist(e, player) < 260);
    if (player.riding) return;
    if (enemies.filter(e => !e.mini && dist(e, player) < 200).length >= 6) return;
    for (let k = 0; k < 15; k++) {
      const a = Math.random() * Math.PI * 2, r = 60 + Math.random() * 70;
      const x = player.x + Math.cos(a) * r, y = player.y + Math.sin(a) * r / A();
      if (!passable(x, y)) continue;
      const q = Math.random();
      enemies.push(makeEnemy(q < 0.4 ? 'rat' : q < 0.75 ? 'skeleton' : 'spider', x, y));
      return;
    }
    return;
  }
  enemies = enemies.filter(e => e.boss || e.leash || e.passive || e.raider || dist(e, player) < 260);
  const near = enemies.filter(e => !e.boss && !e.passive && !e.raider && dist(e, player) < 200).length;
  const cap = isNight() ? 10 : 7;
  if (near >= cap) return;
  for (let k = 0; k < 12; k++) {
    const a = Math.random() * Math.PI * 2, r = 110 + Math.random() * 50;
    const x = player.x + Math.cos(a) * r, y = player.y + Math.sin(a) * r / A();
    if (!passable(x, y) || isSafe(x, y)) continue;
    const type = pickMonsterType(x, y);
    if (!type) continue;
    enemies.push(makeEnemy(type, x, y));
    return;
  }
}

function reveal() {
  const tx = Math.floor(player.x / TW), ty = Math.floor(player.y / TH);
  const r = isNight() ? 9 : 16;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (dx * dx + dy * dy > r * r) continue;
    const x = tx + dx, y = ty + dy;
    if (world.inb(x, y)) explored[y * world.W + x] = 1;
  }
}

// ------------------------------------------------------------------ Clima

function updateWeather(dt) {
  const w = weather;
  w.timer -= dt;
  if (w.timer <= 0) {
    w.target = w.target > 0 ? 0 : (Math.random() < 0.55 ? 0.5 + Math.random() * 0.5 : 0);
    w.timer = w.target > 0 ? 50 + Math.random() * 70 : 80 + Math.random() * 120;
    if (w.target > 0 && state === 'play') msg('Empieza a llover...', [140, 160, 210]);
  }
  w.rain += (w.target - w.rain) * Math.min(1, dt * 0.3);
  w.lightning = Math.max(0, w.lightning - dt * 3);
  if (w.rain > 0.6 && Math.random() < dt * 0.06) { w.lightning = 1; R.flash = [0.22, 0.24, 0.3]; }

  const want = Math.floor(w.rain * R.cols * R.rows / 45);
  while (w.drops.length < want) w.drops.push({ x: Math.random() * (R.cols + 30), y: Math.random() * R.rows, end: Math.random() * R.rows * 1.2 });
  if (w.drops.length > want) w.drops.length = want;
  for (const d of w.drops) {
    d.y += dt * 55; d.x -= dt * (12 + windS * 25);
    if (d.y > d.end) {
      w.splashes.push({ x: Math.round(d.x), y: Math.round(d.y), life: 0.15 });
      d.x = Math.random() * (R.cols + 30); d.y = -2; d.end = Math.random() * R.rows * 1.15;
    }
  }
  for (const s of w.splashes) s.life -= dt;
  w.splashes = w.splashes.filter(s => s.life > 0);
}

// ------------------------------------------------------------------ Render

let VL = [];   // luces visibles este fotograma
let amb = [1, 1, 1];

function lightAt(x, y) {
  let lr = amb[0], lg = amb[1], lb = amb[2];
  const a = A();
  for (const L of VL) {
    const dx = x - L.x, dy = (y - L.y) * a;
    const d2 = dx * dx + dy * dy;
    if (d2 >= L.r2) continue;
    let f = 1 - Math.sqrt(d2) / L.r; f *= f * L.k;
    lr += L.c[0] * f; lg += L.c[1] * f; lb += L.c[2] * f;
  }
  return [lr, lg, lb];
}

function render() {
  R.clear();
  UI.clear();
  const cols = R.cols, rows = R.rows, a = A();
  let sx = 0, sy = 0;
  if (shake > 0) { sx = Math.round((Math.random() - 0.5) * 3); sy = Math.round((Math.random() - 0.5) * 2); }
  const c0 = Math.round(camX - cols / 2) + sx, r0 = Math.round(camY - rows / 2) + sy;
  viewC0 = c0; viewR0 = r0;

  // Luz ambiental según la hora y el clima
  const dl = daylight();
  amb = world.under ? [0.09, 0.08, 0.1] : lerp3([0.10, 0.13, 0.30], [1, 1, 1], dl);
  const dusk = Math.max(0, 1 - Math.abs(dl - 0.45) / 0.3);
  amb[0] += 0.28 * dusk; amb[1] += 0.06 * dusk; amb[2] -= 0.08 * dusk;
  const rain = world.under ? 0 : weather.rain;
  amb = amb.map((v, i) => v * (1 - 0.35 * rain) + (i === 2 ? 0.03 * rain : 0) + weather.lightning * 0.7);

  // Luces visibles
  const night = world.under ? 1 : 1 - dl;
  VL = [];
  const addL = (L, kMul) => {
    if (L.x + L.r < c0 || L.x - L.r > c0 + cols || L.y + L.r / a < r0 || L.y - L.r / a > r0 + rows) return;
    const fl = L.flicker !== undefined ? 0.85 + 0.15 * Math.sin(time * 11 + L.flicker * 7) * Math.sin(time * 7.3 + L.flicker) : 1;
    VL.push({ x: L.x, y: L.y, r: L.r, r2: L.r * L.r, c: L.c || L.color, k: L.k * kMul * fl });
  };
  for (const L of terr.lights) addL(L, 0.1 + night * 1.1);
  critterLights(addL);
  campLights(addL);
  nightLights(addL, c0, r0);
  raidLights(addL);
  witchLights(addL);
  if (state !== 'title') {
    if (night > 0.35) addL({ x: player.x - player.facing * 3.6, y: player.y - 1, r: 36, color: [1.0, 0.7, 0.38], k: 1.25 * (night - 0.35) / 0.65 + 0.2, flicker: 3 }, 1);
    for (const f of projectiles) addL({ x: f.x, y: f.y, r: 22, color: [1, 0.5, 0.15], k: 1.7 }, 1);
    for (const ar of arrows) addL({ x: ar.x, y: ar.y, r: 18, color: [1, 0.55, 0.15], k: 1.3 }, 1);
    for (const e of enemies) if (e.burn > 0) addL({ x: e.x, y: e.y, r: 16, color: [1, 0.45, 0.1], k: 1.0, flicker: 2 }, 1);
    for (const l of tempLights) addL(l, l.life / l.max);
    const boss = enemies.find(e => e.boss);
    if (boss) addL({ x: boss.x, y: boss.y - 6, r: 30, color: [1, 0.3, 0.05], k: 0.5 + 0.2 * Math.sin(time * 3), flicker: 1 }, 1);
  }

  // Mundo en vista 3/4: terreno con altura, árboles, casas y entidades ordenadas por profundidad
  const { CW, CH, water } = terr;
  const drawables = [], upper = [];
  const pb = state === 'play' ? player.bld : null;
  // dónde se dibuja algo: en el barrido normal, con la planta de arriba, o no se ve (dentro de otra casa)
  const place = (e, fn) => {
    const b = world.bldAt(Math.floor(e.x / TW), Math.floor(e.y / TH));
    if (b && b !== pb) return;
    if ((e.floor || 0) > 0) { if (b === pb && player.floor > 0) upper.push(fn); return; }
    drawables.push({ y: e.y, draw: fn });
  };
  for (const it of items) place(it, () => drawItem(it, c0, r0));
  for (const n of npcs) if (!n.camper || campTime()) place(n, () => drawRig(RIGS[n.role] ? n.role : 'peasant', n, c0, r0, 0));
  campDrawables(drawables, c0, r0);
  for (const e of enemies) {
    if (night > 0.55 && dist(e, player) > 40 && !e.boss && !e.passive) continue; // la oscuridad los oculta
    drawables.push({ y: e.y, draw: () => drawRig(e.type, e, c0, r0, e.flash) });
  }
  for (const c of corpses) drawables.push({ y: c.e.y, draw: () => drawRig(c.e.type, c.e, c0, r0, 0, c.life / 0.7, true) });
  const drawHero = () => drawRig('knight', player, c0, r0, player.iframes > 0 && Math.floor(time * 20) % 2 ? 0.05 : 0);
  if (state === 'play' && player.riding) drawables.push({ y: player.y, draw: () => {
    drawCart(player.x, player.y, c0, r0, 'back'); drawHero(); drawCart(player.x, player.y, c0, r0, 'front');
  } });
  else if (state === 'play' && player.mount) drawables.push({ y: player.y, draw: () => drawRider(c0, r0, drawHero) });
  else if (state === 'play') place(player, drawHero);
  horseDrawables(drawables, place, c0, r0);
  cartDrawables(drawables, c0, r0);
  webDrawables(drawables, c0, r0);
  shroomDrawables(drawables, c0, r0);
  bugDrawables(drawables, c0, r0);
  fineOcc = [];
  renderWorld3D(c0, r0, drawables, upper);
  resolveFineOcclusion();
  applyFog(c0, r0);
  drawCritters(c0, r0);
  drawMoths(c0, r0);
  drawNightlife(c0, r0);
  drawMist(c0, r0);
  drawExitSigns(c0, r0);
  drawRaidFlames(c0, r0);
  drawSkyLanterns(c0, r0);
  drawCampTalk(c0, r0);

  // Partículas y proyectiles
  for (const p of particles) {
    const k = p.life / p.max;
    R.put(Math.round(p.x) - c0, Math.round(p.y) - r0, p.ch.charCodeAt(0), p.c[0] * k + 20, p.c[1] * k, p.c[2] * k);
  }
  for (const f of projectiles) {
    const fc = Math.round(f.x) - c0, fr = Math.round(f.y) - r0;
    R.put(fc, fr, 64, 255, 240, 160);
    R.put(fc - 1, fr, 40, 255, 150, 40); R.put(fc + 1, fr, 41, 255, 150, 40);
  }
  drawArrows(c0, r0);
  if (state === 'play' && player.swing > 0) drawSwing(c0, r0);
  if (state === 'play') dimOutside(c0, r0);
  if (state === 'play' && !dialog) {
    const pr = contextPrompt();
    if (pr) {
      UI.worldText(player.x - c0, Math.round(player.y) - r0 - 14 - liftOf(player), pr, 255, 255, 255, 0.6);
    }
  }

  // Lluvia
  if (!world.under) for (const dp of weather.drops) {
    const v = 0.6 + 0.4 * dl;
    R.put(Math.round(dp.x), Math.round(dp.y), 47, 110 * v + 40, 130 * v + 40, 170 * v + 50);
  }
  if (!world.under) for (const s of weather.splashes) {
    const wx = s.x + c0, wy = s.y + r0;
    const onWater = wx >= 0 && wy >= 0 && wx < CW && wy < CH && water[wy * CW + wx];
    R.put(s.x, s.y, onWater ? 111 : 46, 140, 160, 200);
  }

  // Textos flotantes
  for (const f of floaters) {
    const k = Math.min(1, f.life * 2);
    UI.worldText(f.x - c0, Math.round(f.y) - r0, f.text, f.c[0] * k, f.c[1] * k, f.c[2] * k, 0);
  }

  if (state === 'play' || state === 'intro') drawAtmosphere();
  if (state === 'title') drawTitle();
  else if (state === 'intro') drawIntro();
  else if (state === 'play') { drawHud(); if (dialog) drawDialog(); if (showMap) drawMap(); }
  else if (state === 'dead') drawEndScreen('HAS CAIDO', [`Te venció ${deathCause} en el día ${dayNumber()}.`, `Nivel ${player.lvl}  ·  ${player.kills} enemigos derrotados`], [230, 60, 50]);
  else if (state === 'win') drawEndScreen('VICTORIA', [`Has salvado Valcorona en el día ${dayNumber()}.`, `Nivel ${player.lvl}  ·  ${player.kills} enemigos  ·  ${player.gold} de oro`], [255, 210, 60]);

  R.draw();
}

// Personajes en la capa fina (doble resolución): misma talla en pantalla, cuatro veces más detalle.
// Cada figura lleva un contorno negro fino y, si algo del mundo se dibuja después por delante
// (un muro, un árbol...), esa parte se oculta; al caballero se le dibuja la silueta.
const FINE = 2;
let fineOcc = [];   // { mo, snap: [4 bytes], fine: [{ fi, b0, b1 }], hero }

function drawRig(key, e, c0, r0, flash, fade = 1, dying = false) {
  const margin = key === 'dragon' ? 60 : key === 'spiderqueen' ? 45 : 25;
  if (e.x < c0 - margin || e.x > c0 + R.cols + margin || e.y < r0 - 5 || e.y > r0 + R.rows + margin) return;
  if (e._lx !== undefined && Math.hypot(e.x - e._lx, e.y - e._ly) > 0.005) {
    e._mt = time;
    const mdx = e.x - e._lx, mdy = (e.y - e._ly) * A();
    e._view = Math.abs(mdy) > Math.abs(mdx) * 1.2 ? (mdy < 0 ? 'back' : 'front') : 'side';
  }
  e._lx = e.x; e._ly = e.y;
  let atk = -1;
  if (e === player) { if (player.swing > 0) atk = 1 - player.swing / SWING; }
  else if (e.atkAnim > 0) atk = 1 - e.atkAnim / 0.3;
  const s = { phase: e.anim || 0, moving: !dying && time - (e._mt ?? -9) < 0.15, t: time + (e.home ? e.home.x % 7 : 0), atk,
              torch: (e === player && state === 'play' && isDarkHere()) || !!e.raider,
              view: e === player || (player && e === player.mount) ? (player.riding ? 'side' : player.view || 'side') : e._view || 'side' };
  const baseZ = liftOf(e);
  const fxw = e.x * FINE, fyw = e.y * FINE;
  const ras = rasterRig(scaleParts(RIGS[key](s, e), (RIG_SCALE[key] || RIG_SCALE.default) * FINE), A(),
                        fxw - Math.round(fxw), fyw - Math.round(fyw), e.facing < 0);
  for (const c of ras.cells) c.x += Math.round((e.x - leanCX) * (baseZ - c.y / FINE) * LEAN * FINE);
  const fsc = Math.round(fxw) - c0 * FINE, fsr = Math.round(fyw) - (r0 + baseZ) * FINE;
  const sc = Math.round(e.x) - c0, sr = Math.round(e.y) - r0 - baseZ;
  const hero = e === player;

  // sombra en el suelo (rejilla normal)
  const hw = Math.max(2, Math.round((ras.c1 - ras.c0) / FINE * 0.3));
  for (let x = -hw; x <= hw; x++) R.dim(sc + x, sr, Math.abs(x) === hw ? 0.7 : 0.45);

  const K = (x, y) => (x + 1024) * 2048 + y + 1024;
  const filled = new Set();
  for (const c of ras.cells) filled.add(K(c.x, c.y));
  // contorno negro fino alrededor de toda la figura
  const ring = [];
  const seen = new Set();
  for (const c of ras.cells) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const k2 = K(c.x + dx, c.y + dy);
    if (filled.has(k2) || seen.has(k2)) continue;
    seen.add(k2); ring.push([c.x + dx, c.y + dy]);
  }
  // el fondo detrás de la figura se apaga un poco para que destaque
  const mains = new Map();
  const addMain = (fx, fy) => {
    const mx = Math.floor((fsc + fx) / FINE), my = Math.floor((fsr + fy) / FINE);
    if (mx < 0 || my < 0 || mx >= R.cols || my >= R.rows) return null;
    const mo = (my * R.cols + mx) * 4;
    if (!mains.has(mo)) { mains.set(mo, { mx, my, fine: [] }); R.dim(mx, my, hero ? 0.4 : 0.6); }
    return mains.get(mo);
  };

  const L = lightAt(e.x, e.y - 3);
  const minL = hero ? 0.7 : e.boss || e.mini ? 0.6 : e.friendly ? 0.55 : 0.35;
  const lr = Math.max(minL, L[0]) * fade, lg = Math.max(minL, L[1]) * fade, lb = Math.max(minL, L[2]) * fade;
  const fd = R.fdata;
  const rec = (m, fi) => { if (m && fi >= 0) m.fine.push({ fi, b0: fd[fi], b1: fd[fi + 1] }); };
  for (const [x, y] of ring) rec(addMain(x, y), R.fput(fsc + x, fsr + y, 32, 0, 0, 0));
  for (const c of ras.cells) {
    if (dying && Math.random() > fade + 0.2) continue;
    const m = addMain(c.x, c.y);
    let fi;
    if (flash > 0) fi = R.fput(fsc + c.x, fsr + c.y, c.code, 255, 255, 255);
    else if (c.emit) fi = R.fput(fsc + c.x, fsr + c.y, c.code, c.c[0] * fade, c.c[1] * fade, c.c[2] * fade);
    else {
      // brillo en los bordes que reciben la luz, sombra en los contrarios
      const lit = !filled.has(K(c.x - 1, c.y)) || !filled.has(K(c.x, c.y - 1));
      const shade = !filled.has(K(c.x + 1, c.y)) || !filled.has(K(c.x, c.y + 1));
      const k = lit ? 1.2 : shade ? 0.78 : 1;
      fi = R.fput(fsc + c.x, fsr + c.y, c.code, c.c[0] * lr * k, c.c[1] * lg * k, c.c[2] * lb * k);
    }
    rec(m, fi);
  }
  if (!dying && (hero || (player && e === player.mount))) reflectRig(ras, fsc, Math.round(fyw) - r0 * FINE, fsr, c0, r0);
  if (!dying) drawLabel(e, c0, r0, Math.floor((fsr + ras.r0) / FINE));
  // instantánea del fondo: si luego cambia, es que algo se ha dibujado por delante
  for (const [mo, m] of mains) {
    const d = R.data;
    fineOcc.push({ mo, s0: d[mo], s1: d[mo + 1], s2: d[mo + 2], s3: d[mo + 3], fine: m.fine, hero });
  }
}

// Oculta lo que algo del mundo tapa (o lo pinta como silueta azul si es el caballero)
function resolveFineOcclusion() {
  const d = R.data, fd = R.fdata;
  for (const o of fineOcc) {
    if (d[o.mo] === o.s0 && d[o.mo + 1] === o.s1 && d[o.mo + 2] === o.s2 && d[o.mo + 3] === o.s3) continue;
    for (const f of o.fine) {
      if (fd[f.fi] !== f.b0 || fd[f.fi + 1] !== f.b1) continue;   // ya lo ha tapado otra figura
      if (o.hero && f.b0 !== 1 && !(grassMask && grassMask[o.mo >> 2])) { fd[f.fi + 1] = 60; fd[f.fi + 2] = 110; fd[f.fi + 3] = 200; }
      else fd[f.fi] = 0;
    }
  }
  fineOcc = [];
}

function drawLabel(e, c0, r0, lr0) {
  const isPlayer = e === player;
  const near = dist(e, player) < (e.passive ? 22 : 70) || isPlayer;
  if (!near || state === 'title' || (!isPlayer && !e.name)) return;
  let label, lc;
  if (isPlayer) { label = PLAYER_NAME; lc = [215, 215, 225]; }
  else if (e.role) { label = e.name.replace(/^(el|la|un|una) /, ''); label = label[0].toUpperCase() + label.slice(1); lc = [240, 210, 120]; }
  else { label = e.name; lc = e.boss ? [255, 90, 50] : e.friendly || e.passive ? [200, 220, 170] : [230, 110, 90]; }
  UI.worldText(e.x - c0, lr0, label, lc[0], lc[1], lc[2], 0.45);
  if (!isPlayer && !e.role && e.hp < e.maxHp && !e.boss) {
    const w = 8, n = Math.ceil(e.hp / e.maxHp * w);
    UI.worldText(e.x - c0, lr0, '[' + '|'.repeat(n) + '.'.repeat(w - n) + ']', 220, 70, 60, 0.45, -1);
  }
  if (e.role && dist(e, player) < 12 && !dialog) UI.worldText(e.x - c0, lr0, '[E] Hablar', 255, 255, 255, 0.55, -1);
}

function drawEntity(spr, e, c0, r0, mode, flash) {
  let fi = 0;
  if (mode === 'walk' && spr.walk.length > 1) fi = spr.walk[Math.floor(e.anim) % spr.walk.length];
  const frames = e.facing < 0 ? spr.left : spr.right;
  const fr = frames[fi] || frames[0];
  const sc = Math.round(e.x) - c0 - (fr.w >> 1), sr = Math.round(e.y) - r0 - fr.h + 1;
  const L = lightAt(e.x, e.y - 2);
  const isPlayer = e === player;
  const minL = isPlayer ? 0.55 : 0.3;
  const lr = Math.max(minL, L[0]), lg = Math.max(minL, L[1]), lb = Math.max(minL, L[2]);
  const white = flash > 0;
  for (const o of fr.outline) R.dim(sc + o.x, sr + o.y, 0.22);
  for (const c of fr.cells) {
    if (white) R.put(sc + c.x, sr + c.y, c.ch.charCodeAt(0), 255, 255, 255);
    else R.put(sc + c.x, sr + c.y, c.ch.charCodeAt(0), c.c[0] * lr, c.c[1] * lg, c.c[2] * lb);
  }
  // Etiqueta con nombre (al estilo MMO)
  const near = dist(e, player) < 70 || isPlayer;
  if (!near || state === 'title') return;
  let label, lc;
  if (isPlayer) { label = PLAYER_NAME; lc = [215, 215, 225]; }
  else if (e.role) { label = e.name.replace(/^(el|la|un|una) /, ''); label = label[0].toUpperCase() + label.slice(1); lc = [240, 210, 120]; }
  else { label = e.name; lc = e.boss ? [255, 90, 50] : [230, 110, 90]; }
  const lr0 = sr - 1;
  UI.worldText(e.x - c0, lr0, label, lc[0], lc[1], lc[2], 0.45);
  if (!isPlayer && !e.role && e.hp < e.maxHp && !e.boss) {
    const w = 8, n = Math.ceil(e.hp / e.maxHp * w);
    UI.worldText(e.x - c0, lr0, '[' + '|'.repeat(n) + '.'.repeat(w - n) + ']', 220, 70, 60, 0.45, -1);
  }
  if (e.role && dist(e, player) < 12 && !dialog) UI.worldText(e.x - c0, lr0, '[E] Hablar', 255, 255, 255, 0.55, -1);
}

function drawItem(it, c0, r0) {
  if (it.floor > 0) r0 += FLOOR_H;
  if (it.onWall) {
    r0 += CASTLE_WALL_H;
    const c = Math.round(it.x) - c0, r = Math.round(it.y) - r0;
    R.put(c - 1, r, 124, 120, 80, 45); R.put(c, r, 41, 200, 150, 80); R.put(c + 1, r, 41, 200, 150, 80); R.put(c + 2, r, 124, 120, 80, 45);
    R.put(c, r - 1, 47, 220, 220, 230); R.put(c + 1, r - 1, 47, 220, 220, 230);
    return;
  }
  const c = Math.round(it.x) - c0, r = Math.round(it.y) - r0;
  const pulse = 0.75 + 0.25 * Math.sin(time * 4 + it.x);
  if (it.kind === 'gold') R.put(c, r, 36, 255 * pulse, 210 * pulse, 60);
  else if (it.kind === 'potion') R.put(c, r, 33, 255 * pulse, 90, 210 * pulse);
  else if (it.kind === 'seeds') R.put(c, r, 58, 200 * pulse, 230 * pulse, 120);
  else if (it.kind === 'potato') R.put(c, r, 111, 230 * pulse, 190 * pulse, 120);
  else if (it.kind === 'meat') { R.put(c, r, 37, 230 * pulse, 90 * pulse, 80); R.put(c + 1, r, 111, 235, 225, 210); }
  else drawEntity(SPR.chest, { x: it.x, y: it.y, facing: 1, anim: 0, role: null, name: 'Tesoro', hp: 1, maxHp: 1 }, c0, r0, 'idle', 0);
}

function drawSwing(c0, r0) {
  const p = player;
  const base = Math.atan2(p.dir.y, p.dir.x);
  const prog = 1 - p.swing / SWING;
  for (let k = -4; k <= 4; k++) {
    const ang = base + k * 0.28;
    if ((k + 4) / 8 > prog + 0.25) continue;
    const rr = 7;
    const x = p.x + Math.cos(ang) * rr, y = p.y - 2 + Math.sin(ang) * rr / A();
    const t = (((ang + Math.PI / 2) % Math.PI) + Math.PI) % Math.PI;
    const ch = t < Math.PI / 8 || t > 7 * Math.PI / 8 ? '-' : t < 3 * Math.PI / 8 ? '\\' : t < 5 * Math.PI / 8 ? '|' : '/';
    R.put(Math.round(x) - c0, Math.round(y) - r0, ch.charCodeAt(0), 230, 245, 255);
  }
}

// ------------------------------------------------------------------ Interfaz

function box(c, r, w, h, title, tc = [240, 200, 90]) {
  UI.fclearRect(c, r, w, h);
  for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) {
    const edgeY = y === r || y === r + h - 1, edgeX = x === c || x === c + w - 1;
    const ch = edgeY && edgeX ? '+' : edgeY ? '-' : edgeX ? '|' : ' ';
    UI.put(x, y, ch.charCodeAt(0), 110, 105, 95);
  }
  if (title) UI.text(c + 2, r, ` ${title} `, tc[0], tc[1], tc[2]);
}

function bar(c, r, label, v, max, w, color) {
  const n = Math.max(0, Math.round(v / max * w));
  UI.text(c, r, label + ' [', 200, 200, 200);
  UI.text(c + label.length + 2, r, '|'.repeat(n), color[0], color[1], color[2]);
  UI.text(c + label.length + 2 + n, r, '.'.repeat(w - n), 70, 70, 75);
  UI.text(c + label.length + 2 + w, r, `] ${Math.ceil(v)}/${max}`, 200, 200, 200);
}

function placeName() {
  const r = world.regionAt(Math.floor(player.x / TW), Math.floor(player.y / TH));
  if (r) return r.name;
  if (player.bld) return player.bld.name + (player.floor > 0 ? ' (arriba)' : '');
  const n = TILE_DEFS[matAt(player.x, player.y)].name;
  return n[0].toUpperCase() + n.slice(1);
}

function wrap(text, w) {
  const out = []; let line = '';
  for (const word of text.split(' ')) {
    if ((line + ' ' + word).trim().length > w) { out.push(line); line = word; }
    else line = (line + ' ' + word).trim();
  }
  if (line) out.push(line);
  return out;
}

function drawHud() {
  const p = player;
  const hpc0 = p.hp / p.maxHp > 0.5 ? [90, 220, 80] : p.hp / p.maxHp > 0.25 ? [255, 200, 60] : [255, 70, 60];
  const fc0 = p.food > 50 ? [230, 190, 90] : p.food > 25 ? [255, 150, 60] : [255, 70, 50];
  const quest0 = quest === 0 ? 'Habla con el rey.' : quest >= 5 ? '¡Reino a salvo!' : dragonSlain ? 'Avisa al rey.'
    : quest === 1 ? 'Mata a la araña gigante.' : quest === 2 ? 'Colmillo al herrero.' : `Dragón (al ${compassTo(world.lair.x, world.lair.y)}).`;
  if (IS_TOUCH) {                                         // panel compacto para el móvil
    box(0, 0, 27, 7, `Nv ${p.lvl}`);
    bar(1, 1, 'HP', p.hp, p.maxHp, 9, hpc0);
    bar(1, 2, 'XP', p.xp, p.lvl * 30, 9, [110, 160, 255]);
    bar(1, 3, 'Co', p.food, 100, 9, fc0);
    UI.text(1, 4, `$${p.gold} !${p.potions} Pat ${p.potatoes} Car ${p.meat || 0}`.slice(0, 25), 235, 205, 120);
    UI.text(1, 5, quest0.slice(0, 25), 235, 225, 190);
  } else drawHudFull(p);
  drawHudRest(p);
}

function drawHudFull(p) {
  box(1, 0, 44, 9, `${PLAYER_NAME} · Nv ${p.lvl}`);
  const hpc = p.hp / p.maxHp > 0.5 ? [90, 220, 80] : p.hp / p.maxHp > 0.25 ? [255, 200, 60] : [255, 70, 60];
  bar(3, 1, 'HP', p.hp, p.maxHp, 20, hpc);
  bar(3, 2, 'XP', p.xp, p.lvl * 30, 20, [110, 160, 255]);
  const fc = p.food > 50 ? [230, 190, 90] : p.food > 25 ? [255, 150, 60] : [255, 70, 50];
  bar(3, 3, 'Co', p.food, 100, 20, fc);
  UI.text(3, 4, `$ ${p.gold}`, 255, 210, 60);
  UI.text(11, 4, `! ${p.potions}`, 255, 100, 210);
  UI.text(17, 4, `Patatas ${p.potatoes}`, 230, 195, 125);
  UI.text(28, 4, `Sem ${p.seeds}`, 185, 220, 120);
  UI.text(35, 4, `Carne ${p.meat || 0}`, 235, 140, 120);
  UI.text(3, 5, `Espada +${p.sword}  Armadura +${p.armor}  Setas ${p.shrooms || 0}  Fuego ${p.firePots || 0}${p.fireResT > 0 ? ' (activa)' : ''}`, 190, 190, 200);
  const q = quest === 0 ? 'Habla con el rey (salón del trono).'
    : quest >= 5 ? '¡El reino está a salvo!'
    : dragonSlain ? 'Vuelve y avisa al rey.'
    : quest === 1 ? 'Mata a la araña gigante (catacumbas).'
    : quest === 2 ? 'Lleva el colmillo al herrero.'
    : `Mata al dragón (montañas del ${compassTo(world.lair.x, world.lair.y)}).`;
  UI.text(3, 7, q.slice(0, 40), 235, 225, 190);
  UI.text(3, 6, 'Misión:', 240, 200, 90);
}

function drawHudRest(p) {

  // Arriba a la derecha: hora, lugar, clima
  const t1 = `Día ${dayNumber()} · ${clockText()}${isNight() ? ' (noche)' : ''}`;
  const t2 = placeName();
  const t3 = weather.rain > 0.3 ? 'Lluvia' : '';
  UI.dimRect(UI.cols - Math.max(t1.length, t2.length) - 3, 0, Math.max(t1.length, t2.length) + 3, 4, 0.25);
  UI.text(UI.cols - t1.length - 2, 1, t1, 200, 200, 220);
  UI.text(UI.cols - t2.length - 2, 2, t2, 140, 190, 255);
  if (t3) UI.text(UI.cols - t3.length - 2, 3, t3, 140, 160, 210);

  // Barra del jefe
  const boss = enemies.find(e => (e.boss || e.mini) && e.engaged);
  if (boss) {
    const w = Math.min(60, UI.cols - 20), c = (UI.cols - w) >> 1;
    const bn = boss.name.toUpperCase();
    UI.text((UI.cols - bn.length) >> 1, 1, bn, 255, 90, 40);
    const n = Math.ceil(boss.hp / boss.maxHp * w);
    UI.text(c - 1, 2, '[', 160, 60, 40);
    UI.text(c, 2, '#'.repeat(n), 255, 70, 30);
    UI.text(c + n, 2, '-'.repeat(w - n), 80, 30, 25);
    UI.text(c + w, 2, ']', 160, 60, 40);
  }

  drawRaidHud();

  // Mensajes
  const recent = messages.filter(m => time - m.t < 8).slice(-5);
  const ml = TOUCH ? touchPad.left + 1 : 1, mw = UI.cols - ml - (TOUCH ? touchPad.right : 1) - 2;
  recent.forEach((m, k) => {
    const row = UI.rows - 2 - (recent.length - 1 - k), t = m.text.slice(0, mw);
    UI.dimRect(ml, row, t.length + 2, 1, 0.25);
    const fade = Math.min(1, (8 - (time - m.t)) / 2);
    UI.text(ml + 1, row, t, m.c[0] * fade, m.c[1] * fade, m.c[2] * fade);
  });
  if (player.mount) {
    const hint = 'A caballo: vas mucho más rápido · E para bajar';
    UI.dimRect(((UI.cols - hint.length) >> 1) - 1, UI.rows - 8, hint.length + 2, 1, 0.25);
    UI.text((UI.cols - hint.length) >> 1, UI.rows - 8, hint, 235, 205, 140);
  }
  if (player.riding) {
    const hint = `En el vagón hacia ${player.riding.dest}: haz clic (o ESPACIO) para lanzar la lanza de fuego`;
    UI.dimRect(((UI.cols - hint.length) >> 1) - 1, UI.rows - 8, hint.length + 2, 1, 0.25);
    UI.text((UI.cols - hint.length) >> 1, UI.rows - 8, hint, 255, 200, 110);
  }
  if (player.onWall) {
    const hint = player.perch ? 'En la torreta: haz clic (o ESPACIO) para lanzar la lanza de fuego' : player.hasBow ? 'En lo alto: apunta con el ratón y haz clic para lanzar flechas de fuego' : 'En la muralla: coge un arco del soporte (pasa por encima)';
    UI.dimRect(((UI.cols - hint.length) >> 1) - 1, UI.rows - 8, hint.length + 2, 1, 0.25);
    UI.text((UI.cols - hint.length) >> 1, UI.rows - 8, hint, 255, 200, 110);
  }
  const help = 'WASD mover · ESPACIO atacar · SHIFT esquivar · E usar/hablar · R comer · Q poción · M mapa · G guardar · F p.fuego · N música · V efectos · +/- zoom';
  if (!TOUCH && UI.cols > help.length + 50) UI.text(UI.cols - help.length - 2, UI.rows - 1, help, 90, 90, 100);
}

function drawDialog() {
  const w = Math.min(UI.cols - 6, 76);
  const lines = wrap(dialog.lines[dialog.i], w - 4);
  const h = lines.length + 4;
  const c = (UI.cols - w) >> 1, r = UI.rows - h - 3;
  box(c, r, w, h, dialog.name[0].toUpperCase() + dialog.name.slice(1));
  lines.forEach((l, k) => UI.text(c + 2, r + 2 + k, l, 240, 230, 205));
  const more = dialog.i < dialog.lines.length - 1 ? '[E] continuar' : '[E] cerrar';
  UI.text(c + w - more.length - 2, r + h - 1, more, Math.floor(time * 2) % 2 ? 255 : 160, 220, 120);
}

// Mapa de todo el reino. Lo explorado se ve con todo su color; lo demás, más apagado.
let mapCache = null, mapImg = null;
function drawMap() {
  const mw = Math.min(UI.cols - 6, 220), mh = Math.min(UI.rows - 7, 90);
  const c = (UI.cols - mw) >> 1, r = ((UI.rows - mh) >> 1) + 1;
  box(c - 1, r - 2, mw + 2, mh + 3, world.under ? 'Mapa de las catacumbas  ·  [M] cerrar' : 'Mapa del reino de Valcorona  ·  [M] cerrar');
  // muestreo: en cada celda del mapa manda lo más importante (asentamientos, caminos, ríos)
  if (!mapCache || mapCache.w !== mw || mapCache.h !== mh || mapCache.world !== world) {
    const cells = new Uint8Array(mw * mh);
    const rank = t => t === T.CRYPT_UP ? 10 : t === T.CRYPTFLOOR || t === T.SARCO || t === T.WEB ? 2 : t === T.CWALL || t === T.TOWER ? 9 : t === T.HWALL || t === T.WINDOW || t === T.DOOR ? 8 : t === T.PLAZA ? 7
      : t === T.BRIDGE ? 6 : t === T.ROAD ? 5 : t === T.WATER || t === T.LAKE ? 4 : t === T.FIELD ? 3 : 0;
    for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
      const x0 = x * world.W / mw, y0 = y * world.H / mh, sx = world.W / mw, sy = world.H / mh;
      let best = world.get(Math.floor(x0 + sx / 2), Math.floor(y0 + sy / 2)), br = rank(best);
      for (let k = 0; k < 9; k++) {
        const t = world.get(Math.floor(x0 + ((k % 3) + 0.5) * sx / 3), Math.floor(y0 + (((k / 3) | 0) + 0.5) * sy / 3));
        if (rank(t) > br) { br = rank(t); best = t; }
      }
      cells[y * mw + x] = best;
    }
    mapCache = { w: mw, h: mh, world, cells };
  }
  const MAPCH = { [T.FOREST]: 'T', [T.PINE]: 'A', [T.MOUNTAIN]: '^', [T.SNOW]: '^', [T.HILL]: 'n', [T.WATER]: '~', [T.DEEP]: '~', [T.LAKE]: '~',
                  [T.ROAD]: ':', [T.BRIDGE]: '=', [T.CWALL]: '#', [T.TOWER]: '#', [T.HWALL]: 'n', [T.WINDOW]: 'n', [T.PLAZA]: '.', [T.FIELD]: '='};
  // el dibujo del terreno se guarda como imagen y se rehace cada poco (es lo más costoso)
  const mkey = `${mw}x${mh}:${UI.cw}:${world.under}:${mapCache.world === world}`;
  if (!mapImg || mapImg.key !== mkey || time - mapImg.t > 1.5 || time < mapImg.t) {
    const cv = mapImg && mapImg.key === mkey ? mapImg.cv : document.createElement('canvas');
    cv.width = Math.ceil(mw * UI.cw); cv.height = Math.ceil(mh * UI.ch);
    const saved = UI.ctx;
    UI.ctx = cv.getContext('2d'); UI.ctx.clearRect(0, 0, cv.width, cv.height); UI.ctx.font = UI.font; UI.ctx.textBaseline = 'middle';
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
    const t = mapCache.cells[y * mw + x];
    const tx = Math.floor((x + 0.5) * world.W / mw), ty = Math.floor((y + 0.5) * world.H / mh);
    const seen = explored[ty * world.W + tx];
    if (world.under) {      // bajo tierra solo se ve lo explorado
      if (!seen || t === T.CRYPTWALL) continue;
      UI.put(x, y, t === T.CRYPT_UP ? 60 : 46, t === T.CRYPT_UP ? 240 : 150, t === T.CRYPT_UP ? 220 : 140, t === T.CRYPT_UP ? 160 : 120);
      continue;
    }
    const def = TILE_DEFS[t];
    const k = seen ? 0.95 : 0.4;
    const ch = MAPCH[t] || def.ch;
    let col = def.fg;
    if (t === T.HWALL || t === T.WINDOW) col = [210, 110, 70];
    UI.put(x, y, ch.charCodeAt(0), col[0] * k, col[1] * k, col[2] * k);
  }
    UI.ctx = saved;
    mapImg = { cv, key: mkey, t: time };
  }
  UI.ctx.drawImage(mapImg.cv, c * UI.cw, r * UI.ch);
  const at = (tx, ty) => [c + Math.floor(tx * mw / world.W), r + Math.floor(ty * mh / world.H)];
  const label = (tx, ty, text, col) => {
    const [x0, y] = at(tx, ty);
    const x = Math.max(c + (text.length >> 1) + 1, Math.min(c + mw - (text.length >> 1) - 2, x0));
    UI.dimRect(x - (text.length >> 1) - 1, y, text.length + 2, 1, 0.15);
    UI.text(x - (text.length >> 1), y, text, col[0], col[1], col[2]);
  };
  if (world.under) {
    for (const e of world.cryptEntrances) if (explored[e.y * world.W + e.x]) label(e.x, e.y - 6, 'Bajo ' + e.name, [235, 205, 155]);
    if (world.spiderLair && explored[world.spiderLair.y * world.W + world.spiderLair.x]) label(world.spiderLair.x, world.spiderLair.y - 8, 'Nido de la araña', [255, 90, 50]);
    const [px2, py2] = at(player.x / TW, player.y / TH);
    if (Math.floor(time * 3) % 2) UI.put(px2, py2, 64, 255, 255, 120);
    return;
  }
  label(world.castle.cx, world.castle.y - 3, 'Castillo de Valcorona', [255, 215, 70]);
  if (world.city) label(world.city.x, world.city.y - 34, 'Ciudad de Altamira', [255, 215, 70]);
  if (world.cemetery) label(world.cemetery.x, world.cemetery.y0 - 2, 'Cementerio', [190, 190, 210]);
  if (world.witch && player.metWitch) label(world.witch.x, world.witch.y0 - 2, 'Cabaña de la bruja', [190, 140, 230]);
  if (world.ancient && player.metWitch) label(world.ancient.x, world.ancient.y - 9, 'Árbol centenario', [150, 230, 130]);
  for (const s of settlements()) if (s.burnedAt >= 0) label(s.x, s.y + 3, '(en llamas)', [255, 110, 50]);
  if (raid && Math.floor(time * 3) % 2) label(raid.s.x, raid.s.y + 3, '¡ATAQUE!', [255, 60, 40]);
  for (const st of world.stables || []) label(Math.round((st.x0 + st.x1) / 2), st.y0 - 2, 'Caballeriza', [230, 190, 120]);
  for (const h of horses) if (h.wild) label(h.x / TW, h.y / TH - 2, 'Caballo salvaje', [230, 190, 120]);
  for (const v of world.villages) if (!v.main) label(v.x, v.y - 12, v.name, [235, 205, 155]);
  label(world.villages[0].x, world.villages[0].y + 24, 'Villa Real', [235, 205, 155]);
  const [lx, ly] = at(world.lair.x, world.lair.y);
  UI.put(lx, ly, 68, 255, 70, 40);
  label(world.lair.x, world.lair.y - 8, 'Guarida del dragón', [255, 90, 50]);
  const [px, py] = at(player.x / TW, player.y / TH);
  if (Math.floor(time * 3) % 2) UI.put(px, py, 64, 255, 255, 120);
  const leg = '@ tú   # castillo   n casas   : camino   ~ río   T bosque   A pinar   ^ montaña   D dragón';
  UI.text(c + ((mw - leg.length) >> 1), r + mh, leg, 150, 150, 160);
}

const TITLE_ART = String.raw`
    _    ____   ____ ___ ___    __        _____  ____  _     ____
   / \  / ___| / ___|_ _|_ _|   \ \      / / _ \|  _ \| |   |  _ \
  / _ \ \___ \| |    | | | |     \ \ /\ / / | | | |_) | |   | | | |
 / ___ \ ___) | |___ | | | |      \ V  V /| |_| |  _ <| |___| |_| |
/_/   \_\____/ \____|___|___|      \_/\_/  \___/|_| \_\_____|____/`.split('\n').slice(1);

function drawTitle() {
  const w = Math.max(...TITLE_ART.map(l => l.length));
  const c = (UI.cols - w) >> 1, r = Math.max(2, (UI.rows >> 1) - 10);
  UI.dimRect(c - 4, r - 2, w + 8, 18, 0.12);
  TITLE_ART.forEach((l, k) => {
    for (let x = 0; x < l.length; x++) if (l[x] !== ' ') {
      const g = 0.75 + 0.25 * Math.sin(time * 2 + x * 0.15 + k * 0.4);
      UI.put(c + x, r + k, l.charCodeAt(x), 255 * g, 200 * g, 70 * g);
    }
  });
  const sub = ['El reino de Valcorona está aterrorizado por un dragón.', 'Eres su último caballero.'];
  sub.forEach((s, k) => UI.text((UI.cols - s.length) >> 1, r + 7 + k, s, 225, 220, 205));
  const keysTxt = ['WASD / flechas: mover   ESPACIO / clic: atacar   SHIFT: esquivar',
                   'E: hablar / usar / cosechar   R: comer   Q: poción   M: mapa   + / -: zoom'];
  keysTxt.forEach((s, k) => UI.text((UI.cols - s.length) >> 1, r + 10 + k, s, 150, 150, 165));
  if (Math.floor(time * 1.6) % 2) { const s = 'Pulsa ENTER para una nueva partida'; UI.text((UI.cols - s.length) >> 1, r + 14, s, 255, 255, 255); }
  const sv = readSave();
  if (sv) { const s = `C: continuar la partida guardada (nivel ${sv.p.lvl}, ${new Date(sv.savedAt).toLocaleString()})`; UI.text((UI.cols - s.length) >> 1, r + 16, s, 140, 230, 140); }
}

function drawEndScreen(title, lines, color) {
  const w = 54, h = 9, c = (UI.cols - w) >> 1, r = (UI.rows - h) >> 1;
  box(c, r, w, h, '', color);
  const t = title.split('').join(' ');
  UI.text(c + ((w - t.length) >> 1), r + 2, t, color[0], color[1], color[2]);
  lines.forEach((l, k) => UI.text(c + ((w - l.length) >> 1), r + 4 + k, l, 220, 215, 200));
  if (Math.floor(time * 1.6) % 2) { const s = state === 'dead' ? 'ENTER: reaparecer en el castillo' : 'ENTER: seguir explorando'; UI.text(c + ((w - s.length) >> 1), r + h - 2, s, 255, 255, 255); }
}

// ------------------------------------------------------------------ Controles

const BLOCKED = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'];
addEventListener('keydown', ev => {
  keys[ev.code] = true;
  if (BLOCKED.includes(ev.code)) ev.preventDefault();
  if (state === 'title') {
    if (ev.code === 'Enter' || ev.code === 'Space') beginIntro();
    if (ev.code === 'KeyC') loadSavedGame();
    return;
  }
  if (state === 'intro') { if (!ev.repeat) introKey(ev.code); return; }
  if (state === 'dead') { if (ev.code === 'Enter') respawn(); return; }
  if (state === 'win') { if (ev.code === 'Enter') { state = 'play'; msg('El reino es libre. Sigue explorando, héroe.', [255, 215, 60]); } return; }
  if (state !== 'play') return;
  if (dialog) { if (['KeyE', 'Enter', 'Space'].includes(ev.code) && !ev.repeat) advanceDialog(); return; }
  if (showMap) { if (ev.code === 'KeyM' || ev.code === 'Escape') showMap = false; return; }
  switch (ev.code) {
    case 'Space': case 'KeyJ': attack(); break;
    case 'KeyE': {
      if (player.riding) break;
      if (dismount()) break;
      if (cryptAction()) break;
      if (trainAction()) break;
      if (wallStairsAction()) break;
      if (stairsAction()) break;
      if (mountHorse()) break;
      if (pickShroom()) break;
      const n = nearestNpc();
      if (n) { interact(n); break; }
      const c = cropNearPlayer();
      if (c) farmAction(c);
      break;
    }
    case 'KeyR': if ((player.meat || 0) > 0) eatMeat(); else eatPotato(); break;
    case 'KeyG': saveGame(false); break;
    case 'KeyV': msg(Sfx.toggle() ? 'Efectos de sonido: activados.' : 'Efectos de sonido: silenciados.', [200, 190, 160]); break;
    case 'KeyN': msg(Music.toggle() ? 'Música: activada.' : 'Música: silenciada.', [200, 190, 160]); break;
    case 'KeyQ': drinkPotion(); break;
    case 'KeyF': drinkFire(); break;
    case 'KeyM': showMap = true; break;
    case 'ShiftLeft': case 'ShiftRight': case 'KeyK': dash(); break;
    case 'Equal': case 'NumpadAdd': setFont(fontPx + 1); break;
    case 'Minus': case 'NumpadSubtract': setFont(fontPx - 1); break;
  }
});
addEventListener('keyup', ev => { keys[ev.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
R.canvas.addEventListener('mousedown', ev => {
  if (state !== 'play' || dialog || showMap) return;
  if (player.riding || (player.onWall && player.perch)) { const t = mouseToWorld(ev); shootLance(t.x, t.y); }
  else if (player.onWall && player.hasBow) { const t = mouseToWorld(ev); shootArrow(t.x, t.y); }
  else attack();
});
addEventListener('resize', () => { R.resize(); UI.resize(); });

function setFont(px) {
  fontPx = Math.max(6, Math.min(20, px));
  try { localStorage.setItem('aw-font2', fontPx); } catch (e) { /* sin almacenamiento */ }
  R.setFont(fontPx);
}

// Galería de personajes (index.html?galeria): todas las figuras animadas sobre negro
function runGallery() {
  const keysG = ['knight', 'king', 'guard', 'smith', 'armorer', 'healer', 'peasant', 'goblin', 'bandit', 'skeleton', 'orc', 'wolf', 'bear', 'dragon'];
  const ents = keysG.map(k => ({ key: k, x: 0, y: 0, anim: 0, facing: 1, home: { x: 0 }, tint: [70, 110, 60], hat: true, atkAnim: 0, fireCd: 2 }));
  let mode = 0; // 0 quieto, 1 andando, 2 atacando
  addEventListener('keydown', ev => { if (ev.code === 'Space') mode = (mode + 1) % 3; if (ev.code === 'KeyF') ents.forEach(e => e.facing *= -1); if (ev.code === 'Equal') setFont(fontPx + 1); if (ev.code === 'Minus') setFont(fontPx - 1); });
  amb = [1, 1, 1]; VL = [];
  leanCX = 0;
  player = { x: -999, y: -999 };
  state = 'gallery';
  function loop() {
    requestAnimationFrame(loop);
    time += 1 / 60;
    R.clear();
    leanCX = R.cols / 2;
    let x = 14, y = 26;
    for (const e of ents) {
      const w = e.key === 'dragon' ? 70 : e.key === 'bear' || e.key === 'wolf' ? 30 : 20;
      if (x + w > R.cols) { x = 14; y += 30; }
      e.x = x + (e.key === 'dragon' ? 30 : 0); e.y = y;
      if (mode === 1) { e.anim += 0.15; e._mt = time; e._lx = e.x; }
      if (mode === 2) { e.atkAnim = 0.3 - ((time * 1.2) % 1) * 0.3; e.fireCd = 0.3 - ((time * 1.2) % 1) * 0.3; } else e.atkAnim = 0;
      const fake = e.key === 'knight' ? e : e;
      if (e.key === 'knight' && mode === 2) { player = e; e.swing = SWING * (1 - ((time * 1.2) % 1)); }
      drawRig(e.key, fake, 0, 0, 0);
      fineOcc = [];
      R.text(e.x - (e.key.length >> 1), e.y + 2, e.key, 150, 150, 160);
      x += w;
    }
    player = { x: -999, y: -999 };
    R.text(2, 1, 'GALERÍA  ·  ESPACIO: quieto / andando / atacando  ·  F: girar  ·  +/-: zoom', 240, 200, 90);
    R.draw();
  }
  loop();
}

if (location.search.includes('galeria')) runGallery();
else { newWorld(); requestAnimationFrame(frame); }

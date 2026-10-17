'use strict';
// Guardar y cargar partida en el navegador (localStorage). El mundo se vuelve a generar con la
// misma semilla, así que solo se guarda lo que cambia: el jugador, la misión, lo recogido,
// los huertos, lo explorado y la vida del dragón y la araña gigante.

const SAVE_KEY = 'asciiworld-save';
const SAVE_VERSION = 3;
const PLAYER_KEYS = ['x', 'y', 'hp', 'maxHp', 'lvl', 'xp', 'gold', 'potions', 'sword', 'armor', 'kills', 'food',
                     'potatoes', 'seeds', 'hasBow', 'gotSeeds', 'facing', 'meat', 'fang', 'dragonbane', 'shrooms', 'firePots', 'golemHeart', 'oakElixir', 'metWitch'];

function packBits(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 8) {
    let b = 0;
    for (let k = 0; k < 8; k++) if (u8[i + k]) b |= 1 << k;
    s += String.fromCharCode(b);
  }
  return btoa(s);
}
function unpackBits(str, n) {
  const s = atob(str), u = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (s.charCodeAt(i >> 3) & (1 << (i & 7))) u[i] = 1;
  return u;
}

function saveGame(silent) {
  if (state !== 'play' || !player) return;
  const S = world.under ? surfLevel : stashLevel();
  const U = world.under ? stashLevel() : underLevel;
  const p = {};
  for (const k of PLAYER_KEYS) p[k] = player[k];
  const hpOf = (L, type) => { const e = L && L.enemies.find(e2 => e2.type === type); return e ? e.hp : 0; };
  const data = {
    v: SAVE_VERSION, seed: S.world.seed, dayTime, quest, dragonSlain, p, level: world.under ? 1 : 0,
    itemsS: S.items.filter(i => i.id !== undefined).map(i => i.id),
    itemsU: U ? U.items.filter(i => i.id !== undefined).map(i => i.id) : null,
    crops: crops.map(c => c.stage).join(','),
    exS: packBits(S.explored), exU: U ? packBits(U.explored) : null,
    dragon: hpOf(S, 'dragon'), golem: hpOf(S, 'golem'), queen: U ? hpOf(U, 'spiderqueen') : null,
    savedAt: Date.now(),
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    if (!silent) { msg('Partida guardada.', [140, 230, 140]); floater(player.x, player.y - 12, 'Guardado', [140, 230, 140]); }
  } catch (e) {
    if (!silent) msg('No se pudo guardar la partida.', [255, 120, 100]);
  }
}

function readSave() {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY));
    return d && d.v === SAVE_VERSION ? d : null;
  } catch (e) { return null; }
}

function loadSavedGame() {
  const d = readSave();
  if (!d) return false;
  newWorld(d.seed, () => { startGame(true); applySave(d); });
  return true;
}

function applySave(d) {
  Object.assign(player, d.p);
  dayTime = d.dayTime; quest = d.quest; dragonSlain = d.dragonSlain;
  const keepS = new Set(d.itemsS);
  items = items.filter(it => it.id === undefined || keepS.has(it.id));
  d.crops.split(',').forEach((v, i) => { if (crops[i]) crops[i].stage = +v; });
  explored = unpackBits(d.exS, explored.length);
  for (const e of enemies) if (e.type === 'dragon') { if (d.dragon <= 0) e.dead = true; else e.hp = d.dragon; }
  for (const e of enemies) if (e.type === 'golem' && d.golem !== undefined) { if (d.golem <= 0) e.dead = true; else if (d.golem < e.maxHp) { e.hp = d.golem; e.sleep = false; } }
  enemies = enemies.filter(e => !e.dead);
  if (d.itemsU || d.level === 1) {
    underLevel = buildUnder();
    if (d.itemsU) { const keepU = new Set(d.itemsU); underLevel.items = underLevel.items.filter(it => keepU.has(it.id)); }
    if (d.exU) underLevel.explored = unpackBits(d.exU, underLevel.explored.length);
    for (const e of underLevel.enemies) if (e.type === 'spiderqueen') { if (d.queen !== null && d.queen <= 0) e.dead = true; else if (d.queen) e.hp = d.queen; }
    underLevel.enemies = underLevel.enemies.filter(e => !e.dead);
  }
  if (d.level === 1) { surfLevel = stashLevel(); loadLevel(underLevel); player.level = 1; critters = []; }
  camX = player.x; camY = player.y;
  mapCache = null;
  msg('Partida cargada. ¡Bienvenido de nuevo, caballero!', [140, 230, 140]);
}

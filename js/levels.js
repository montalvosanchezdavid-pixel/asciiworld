'use strict';
// Niveles: la superficie y las catacumbas. Cada nivel tiene su mundo, terreno, objetos,
// personajes, enemigos y lo explorado; al bajar o subir se intercambian. Las catacumbas
// se generan la primera vez que se baja.

let surfLevel = null, underLevel = null;
const stashLevel = () => ({ world, terr, items, npcs, enemies, explored });
function loadLevel(L) { world = L.world; terr = L.terr; items = L.items; npcs = L.npcs; enemies = L.enemies; explored = L.explored; }
function resetLevels() { surfLevel = null; underLevel = null; }

function buildUnder() {
  const sw = surfLevel ? surfLevel.world : world;
  const uw = generateUnder(sw);
  const ut = bakeTerrain(uw);
  const L = { world: uw, terr: ut, items: uw.items.map((it, i) => ({ ...it, id: i, ...cellOfTile(it.x, it.y) })),
              npcs: [], enemies: [], explored: new Uint8Array(uw.W * uw.H) };
  if (uw.spiderLair) { const p = cellOfTile(uw.spiderLair.x, uw.spiderLair.y); L.enemies.push(makeEnemy('spiderqueen', p.x, p.y)); }
  return L;
}

// Cambia de nivel; la primera vez que se baja hay una breve pantalla de carga
function changeLevel(toUnder, ent) {
  const doIt = () => {
    if (toUnder) {
      surfLevel = stashLevel();
      if (!underLevel) underLevel = buildUnder();
      loadLevel(underLevel);
      const p = cellOfTile(ent.x, ent.y + 1);      // al pie de la escalera
      player.x = p.x; player.y = p.y;
    } else {
      underLevel = stashLevel();
      loadLevel(surfLevel);
      const p = cellOfTile(ent.x, ent.y + 1);
      player.x = p.x; player.y = p.y;
    }
    player.level = toUnder ? 1 : 0; player.bld = null; player.floor = 0; player.onWall = false; player.perch = null;
    projectiles = []; arrows = []; particles = []; corpses = []; tempLights = []; critters = [];
    camX = player.x; camY = player.y;
    mapCache = null;
    state = 'play';
    msg(toUnder ? 'Desciendes a las catacumbas. Huele a humedad y a muerte...' : `Sales a la superficie en ${ent.name}.`, [205, 195, 165]);
    saveGame(true);
  };
  if (toUnder && !underLevel) {
    state = 'loading';
    R.clear(); UI.clear();
    const t = 'Descendiendo a las catacumbas...';
    UI.text((UI.cols - t.length) >> 1, UI.rows >> 1, t, 205, 195, 165);
    R.draw();
    setTimeout(doIt, 30);
  } else doIt();
}

// Arriba hay que pisar la trampilla; abajo basta con estar en la escalinata o justo delante
function entranceHere() {
  const tx = Math.floor(player.x / TW), ty = Math.floor(player.y / TH);
  if (!world.under) return world.cryptEntrances.find(e => e.x === tx && e.y === ty);
  return world.cryptEntrances.find(e => Math.abs(tx - e.x) <= 1 && ty >= e.y - 2 && ty <= e.y + 1);
}

function cryptAction() {
  if (player.riding) return false;
  if (!world.under && tileOf(player.x, player.y) !== T.CRYPT_DOWN) return false;
  const ent = entranceHere();
  if (ent) { changeLevel(!world.under, ent); return true; }
  return false;
}

const upName = e => ('Subir a ' + e.name).replace(' a el ', ' al ');
function cryptPrompt() {
  if (!world.under) return tileOf(player.x, player.y) === T.CRYPT_DOWN ? '[E] Bajar a las catacumbas' : null;
  const e = entranceHere();
  return e ? '[E] ' + upName(e) : null;
}

// Cartel sobre cada escalinata de subida
function drawExitSigns(c0, r0) {
  if (!world.under) return;
  for (const e of world.cryptEntrances) {
    const t = ('^ SALIDA: ' + e.name.replace(/^el /, '') + ' ^').toUpperCase();
    const c = e.x * TW + 3 - c0, r = (e.y - 3) * TH - 6 - r0;
    if (c < -40 || c > R.cols + 40 || r < 0 || r >= R.rows) continue;
    const L = lightInto(e.x * TW, e.y * TH);
    const k = Math.max(0.55, Math.min(1, L[0]));
    UI.worldText(c, r, t, 255 * k, 215 * k, 120 * k, 0.75);
  }
}

// Si mueres bajo tierra, despiertas en la superficie
function leaveUnderForRespawn() {
  if (!world.under) return;
  underLevel = stashLevel();
  loadLevel(surfLevel);
  player.level = 0;
  critters = []; mapCache = null;
}

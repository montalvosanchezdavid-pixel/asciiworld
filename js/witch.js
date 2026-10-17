'use strict';
// La bruja Morgana y el Gólem del Roble.
// La bruja vende pociones de curación baratas, prepara pociones de fuego con setas luminosas
// (se recogen de noche en los bosques) y, con el corazón del gólem, el Elixir del Roble.
// El gólem duerme junto al árbol centenario y despierta si te acercas.

const WITCH_POTION = 10, FIRE_TIME = 90;

// ---------------------------------------------------------------- setas luminosas
function shroomNear() {
  if (world.under || !terr.shrooms || nightK() < 0.3) return null;
  let best = null, bd = 7;
  for (const s of terr.shrooms) {
    if (s.pickedAt !== undefined && dayTime - s.pickedAt < 1) continue;
    const d = Math.hypot(s.x - player.x, (s.y - player.y) * A());
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}
const shroomPrompt = () => (shroomNear() ? '[E] Recoger seta luminosa' : null);
function pickShroom() {
  const s = shroomNear();
  if (!s) return false;
  s.pickedAt = dayTime;
  player.shrooms = (player.shrooms || 0) + 1;
  burst(s.x, s.y - 1, 10, "*'.", s.c, [40, 80, 160], 10, 0.8);
  floater(player.x, player.y - 12, '+1 seta luminosa', s.c);
  if (player.shrooms === 1) msg('Recoges una seta luminosa. Dicen que la bruja del bosque sabe qué hacer con ellas...', [150, 220, 255]);
  Sfx.coin();
  return true;
}

// ---------------------------------------------------------------- poción de fuego
function drinkFire() {
  const p = player;
  if (!(p.firePots > 0)) { msg('No tienes pociones de fuego. La bruja del bosque las prepara con setas luminosas.', [170, 170, 170]); return; }
  p.firePots--; p.fireResT = FIRE_TIME;
  Sfx.gulp();
  burst(p.x, p.y - 6, 18, '*^', [255, 200, 90], [255, 90, 20], 18, 0.8);
  msg(`Bebes una poción de fuego: durante ${FIRE_TIME} segundos las llamas apenas te dañan.`, [255, 180, 90]);
}
// cuánto daño de fuego recibes: poción (temporal) y Elixir del Roble (permanente)
const fireFactor = () => (player.fireResT > 0 ? 0.25 : 1) * (player.oakElixir ? 0.7 : 1);

function updateWitchStuff(dt) {
  const p = player;
  if (p.fireResT > 0) {
    p.fireResT -= dt;
    if (Math.random() < dt * 10) particles.push({ x: p.x + (Math.random() - 0.5) * 6, y: p.y - Math.random() * 12 - liftOf(p), vx: 0, vy: -4, life: 0.5, max: 0.5, float: true, ch: "'", c: [255, 170, 60] });
    if (p.fireResT <= 0) msg('El efecto de la poción de fuego se desvanece.', [200, 160, 120]);
  }
  // el caldero burbujea y echa vapor verde
  const w = world.witch;
  if (w && !world.under && Math.random() < dt * 14) {
    const c = cellOfTile(w.x, w.y);
    if (Math.abs(c.x - p.x) < 220 && Math.abs(c.y - p.y) < 100)
      particles.push({ x: c.x + (Math.random() - 0.5) * 4, y: c.y - 3, vx: windS * 2 + (Math.random() - 0.5) * 2, vy: -3 - Math.random() * 3, life: 1.6, max: 1.6, float: true,
                       ch: Math.random() < 0.4 ? 'o' : '~', c: [120 + Math.random() * 60, 255, 120] });
  }
}

function witchLights(addL) {
  const w = world.witch;
  if (w && !world.under) { const c = cellOfTile(w.x, w.y); addL({ x: c.x, y: c.y - 2, r: 30, color: [0.4, 1, 0.45], k: 1.1, flicker: 5 }, 1); }
  const a = world.ancient;
  if (a && !world.under && nightK() > 0.2) { const c = cellOfTile(a.x, a.y); addL({ x: c.x, y: c.y - 6, r: 60, color: [0.35, 1, 0.55], k: 0.8 * nightK(), flicker: 9 }, 1); }
}

// ---------------------------------------------------------------- la bruja
function witchTalk(p, lines) {
  if (!p.metWitch) {
    p.metWitch = true;
    const a = world.ancient;
    lines.push('Je, je... Un caballero en mi cabaña. Hacía años que nadie se perdía tan lejos.',
      `Soy Morgana. Mis pociones de curación son las más baratas del reino: ${WITCH_POTION} monedas.`,
      'Tráeme dos setas luminosas, de las que brillan de noche en los bosques, y te prepararé una poción de fuego. Contra el aliento de un dragón... vale su peso en oro. (F para beberla)');
    if (a) lines.push(`Y si eres valiente: al ${compassTo(a.x, a.y)} del castillo crece un roble centenario. A sus pies duerme un gólem. Tráeme su corazón y te haré el Elixir del Roble.`);
    return;
  }
  if (p.golemHeart && !p.oakElixir) {
    p.golemHeart = false; p.oakElixir = true; p.maxHp += 25; p.hp = p.maxHp;
    lines.push('¡El corazón del gólem! Aún late con la savia del roble...', 'Unas gotas de rocío, raíz de mandrágora, tres palabras antiguas... Bebe, caballero.',
      'El Elixir del Roble corre ya por tus venas: más vida, y el fuego te muerde menos. Para siempre.');
    msg('¡Elixir del Roble! +25 de vida máxima y resistencia permanente al fuego.', [140, 255, 140]);
    burst(player.x, player.y - 6, 30, '*+', [180, 255, 160], [60, 200, 80], 30, 1.0);
    Sfx.levelUp();
    return;
  }
  if ((p.shrooms || 0) >= 2) {
    const n = Math.floor(p.shrooms / 2);
    p.shrooms -= n * 2; p.firePots = (p.firePots || 0) + n;
    lines.push(`Setas luminosas... perfecto. Al caldero con ellas. ¡Burbujea, burbujea!`, `Toma: ${n > 1 ? n + ' pociones' : 'una poción'} de fuego. Bébela con F justo antes de que el dragón escupa.`);
    msg(`Obtienes ${n} ${n > 1 ? 'pociones' : 'poción'} de fuego.`, [255, 180, 90]);
    return;
  }
  if (p.gold >= WITCH_POTION) {
    p.gold -= WITCH_POTION; p.potions++;
    lines.push(`Una poción de curación, recién hecha. (-${WITCH_POTION} oro)`, (p.shrooms ? 'Te falta una seta más para la poción de fuego.' : 'No olvides: dos setas luminosas, una poción de fuego.'));
    return;
  }
  lines.push(`Sin oro no hay pociones, cariño. ${WITCH_POTION} monedas cada una.`, 'O tráeme setas luminosas: esas te las cambio por pociones de fuego.');
}

// ---------------------------------------------------------------- el gólem
function golemWake(e, d) {
  if (!e.sleep) return false;
  if ((d < 42 && !player.onWall) || e.hp < e.maxHp) {
    e.sleep = false; e.engaged = true;
    msg('¡La tierra tiembla! El Gólem del Roble despierta...', [150, 230, 140]);
    shake = Math.max(shake, 0.6); Sfx.crash();
    burst(e.x, e.y - 4, 30, '.,%', [150, 140, 120], [80, 70, 60], 30, 1.0);
    return false;
  }
  return true;              // sigue dormido
}
// Si te alejas, el gólem vuelve a su árbol, se echa a dormir y recupera fuerzas
function golemReturn(e, dt) {
  if (e.sleep || dist(e, player) < 75) return false;
  const dx = e.home.x - e.x, dy = (e.home.y - e.y) * A(), l = Math.hypot(dx, dy);
  e.engaged = false;
  if (l < 3) {
    e.sleep = true; e.hp = e.maxHp; e.facing = -1;
    return true;
  }
  e.x += dx / l * e.spd * 0.8 * dt; e.y += dy / l * e.spd * 0.8 / A() * dt;
  e.facing = dx > 0 ? 1 : -1; e.anim += dt * 4;
  return true;
}

function golemSlam(e) {
  shake = Math.max(shake, 0.35);
  Sfx.crash();
  for (let k = 0; k < 36; k++) {
    const a = (k / 36) * Math.PI * 2;
    particles.push({ x: e.x + e.facing * 6, y: e.y, vx: Math.cos(a) * 30, vy: Math.sin(a) * 12, life: 0.5, max: 0.5, ch: '.,o'[(k % 3)], c: [150, 135, 110] });
  }
}

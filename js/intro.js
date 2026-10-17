'use strict';
// Intro: la cámara sobrevuela el reino mientras se cuenta su historia, con bandas de cine y
// texto que se escribe solo. ESPACIO/ENTER pasa de escena; ESC la salta entera.

let intro = null;

function introScenes() {
  const w = world, c = w.castle, city = w.city;
  const vill = w.villages.filter(v => !v.main);
  const fest = vill[0] || w.villages[0], burn = vill[1] || vill[0] || w.villages[0];
  const cem = w.cemetery || w.cemeteries[0];
  const dir = compassTo(w.lair.x, w.lair.y);
  const T2 = (x, y) => cellOfTile(x, y);
  return [
    { from: T2(c.cx - 30, c.y + c.h + 20), to: T2(c.cx + 10, c.y + c.h + 8), day: 0.42,
      title: 'I · La fundación',
      text: 'Hace muchas generaciones, tus antepasados levantaron Valcorona entre bosques y ríos. Alzaron el castillo y, a sus pies, Villa Real: un reino pequeño, pero justo y en paz.' },
    { from: T2(city.x - 40, city.y - 10), to: T2(city.x + 20, city.y + 4), day: 0.5,
      title: 'II · La edad dorada',
      text: 'El reino creció. Al otro lado de las tierras se alzó Altamira, la ciudad amurallada, y bajo la tierra un tren unió las dos grandes ciudades a través de las viejas catacumbas.' },
    { from: T2(fest.x - 20, fest.y + 6), to: T2(fest.x + 6, fest.y), day: 0.93, lanterns: fest,
      title: 'III · Los días felices',
      text: 'En las aldeas giraban los molinos y pastaban los rebaños. Y en las noches de verano, los aldeanos soltaban farolillos al cielo para pedir sus deseos.' },
    { from: T2(city.x + 10, city.y + 10), to: T2((city.x + w.lair.x) / 2, (city.y + w.lair.y) / 2), day: 0.78,
      title: 'IV · La codicia',
      text: 'Pero los mineros de Altamira querían más oro. Cavaron hondo, cada vez más hondo, bajo las montañas... hasta que sus picos golpearon algo que respiraba.' },
    { from: T2(w.lair.x - 12, w.lair.y + 6), to: T2(w.lair.x + 2, w.lair.y + 1), day: 0.12, shake: true,
      title: 'V · El despertar',
      text: `Una noche de invierno, las montañas del ${dir} se abrieron. De su vientre salió Ignaroth, el dragón, con escamas duras como la roca y un aliento que funde el acero.` },
    { from: T2(burn.x - 30, burn.y + 8), to: T2(burn.x, burn.y + 3), day: 0.04, burn, horde: true,
      title: 'VI · Sus siervos',
      text: 'Con él llegaron sus siervos: orcos, goblins y bandidos que adoran el fuego. Asaltaron las aldeas, quemaron los campos y se llevaron el ganado.' },
    { from: T2(cem.x - 12, cem.y1 + 6), to: T2(cem.x, (cem.y0 + cem.y1) / 2 + 2), day: 0.98,
      title: 'VII · El silencio',
      text: 'En las catacumbas despertó también la Araña Gigante, y el tren dejó de pasar. Uno tras otro, los caballeros del rey partieron hacia las montañas. Ninguno volvió.' },
    { from: T2(c.cx, c.y + c.h + 26), to: T2(c.cx, c.y + c.h - 4), day: 0.27,
      title: 'VIII · El último caballero',
      text: 'Hoy, el rey Alfonso espera en su trono a quien le queda. Al último caballero de Valcorona. A ti.' },
  ];
}

function beginIntro() {
  startGame(true);              // crea al caballero y el estado de la partida, sin mensajes
  state = 'intro';
  intro = { scenes: introScenes(), i: -1, t: 0, horde: [] };
  nextScene();
}

function sceneCleanup() {
  const sc = intro && intro.scenes[intro.i];
  if (!sc) return;
  if (sc.burn) for (const s of settlements()) if (s.name === sc.burn.name) for (const b of s.houses) { b.fire = 0; b.char = 0; }
  for (const e of intro.horde) e.dead = true;
  enemies = enemies.filter(e => !e.dead);
  intro.horde = [];
}

function nextScene() {
  sceneCleanup();
  intro.i++; intro.t = 0;
  const sc = intro.scenes[intro.i];
  if (!sc) { endIntro(); return; }
  dayTime = Math.floor(dayTime) + sc.day;
  camX = sc.from.x; camY = sc.from.y;
  particles = [];
  if (sc.lanterns) { const camp = (world.camps || []).find(cp => cp.village === sc.lanterns.name) || world.camps[0]; if (camp) { const f = cellOfTile(camp.x, camp.y); releaseLanterns(f.x, f.y, 18); } }
  if (sc.burn) for (const s of settlements()) if (s.name === sc.burn.name) for (const b of s.houses) { b.fire = 0.6 + Math.random() * 0.4; b.char = 0.3; }
  if (sc.horde) {
    const v = sc.burn, c = cellOfTile(v.x - 22, v.y + 4);
    for (let k = 0; k < 7; k++) {
      const e = makeEnemy(['orc', 'goblin', 'bandit', 'goblin', 'orc', 'bandit', 'warlord'][k], c.x + (k % 4) * 9 - 14, c.y + Math.floor(k / 4) * 4 - 2);
      e.facing = 1; e.raider = { s: { x: v.x, y: v.y } }; e.introWalk = true;
      intro.horde.push(e); enemies.push(e);
    }
  }
  if (sc.shake) { shake = 0.8; Sfx.crash(); }
}

function endIntro() {
  sceneCleanup();
  intro = null;
  startGame(false);             // empieza la partida de verdad, en el patio del castillo
}

const introDur = sc => 4.5 + sc.text.length / 34;

function updateIntro(dt) {
  const sc = intro.scenes[intro.i];
  intro.t += dt;
  const u = Math.min(1, intro.t / (introDur(sc) + 2)), e = u * u * (3 - 2 * u);
  camX = sc.from.x + (sc.to.x - sc.from.x) * e;
  camY = sc.from.y + (sc.to.y - sc.from.y) * e;
  player.x = camX; player.y = camY;           // los efectos (fuego, farolillos, niebla) se activan donde mira la cámara
  for (const h of intro.horde) { h.x += 9 * dt; h.anim += dt * 7; }
  updateWeather(dt); updateWind(dt); updateCritters(dt); updateNightlife(dt);
  updateVillageLife(dt); updateRaidFires(dt); updateMist(dt); updateParticles(dt);
  if (intro.t > introDur(sc) + 2.5) nextScene();
}

function introKey(code) {
  if (code === 'Escape') { endIntro(); return; }
  if (code !== 'Space' && code !== 'Enter') return;
  const sc = intro.scenes[intro.i];
  const shown = Math.floor(intro.t * 34);
  if (shown < sc.text.length) intro.t = sc.text.length / 34 + 0.01;   // primero, termina de escribir
  else nextScene();
}

// La narración, escrita en un pergamino que se desenrolla entre dos varas de madera
function drawIntro() {
  const sc = intro.scenes[intro.i];
  const cols = UI.cols, rows = UI.rows, x = UI.ctx, cw = UI.cw, ch = UI.ch;
  // el mundo de fondo, algo apagado, y fundidos entre escenas
  const fadeIn = Math.min(1, intro.t / 0.8), fadeOut = Math.min(1, Math.max(0, (introDur(sc) + 2.5 - intro.t) / 0.6));
  UI.dimRect(0, 0, cols, rows, 0.62 * Math.min(fadeIn, fadeOut) + 0.08);

  // medidas del pergamino
  const pw = Math.min(78, cols - 8), tw = pw - 8;
  const body = sc.text, cap = body[0], rest = body.slice(1);
  const lines = wrapIndent(rest, tw, 3, 2);
  const ph = lines.length + 6;
  const unroll = Math.min(1, intro.t / 0.9), vis = Math.max(1, Math.round(ph * (1 - Math.pow(1 - unroll, 3))));
  const c0 = (cols - pw) >> 1, r0 = Math.max(2, rows - ph - 4);
  const X = c => c * cw, Yc = r => r * ch;

  // papel: color viejo, manchas, bordes rasgados y sombra
  x.fillStyle = 'rgba(0,0,0,0.45)';
  x.fillRect(X(c0) + cw * 0.6, Yc(r0 + 1) + ch * 0.4, pw * cw, (vis - 1) * ch);
  for (let r = 0; r < vis; r++) for (let c = 0; c < pw; c++) {
    const edge = c === 0 || c === pw - 1;
    if (edge && hash2(c, r * 7 + intro.i) > 0.55) continue;                  // borde rasgado
    const n = hash2(c * 3 + intro.i, r * 5) * 0.12 + Math.sin(c * 0.3 + r * 0.7) * 0.03;
    const stain = hash2(Math.floor(c / 5) + 40, Math.floor(r / 2) + intro.i * 3) > 0.86 ? 0.12 : 0;
    const k = 1 - n - stain - (edge ? 0.18 : 0) - (r === 0 || r === vis - 1 ? 0.1 : 0);
    x.fillStyle = `rgb(${(222 * k) | 0},${(196 * k) | 0},${(146 * k) | 0})`;
    x.fillRect(X(c0 + c), Yc(r0 + 1 + r), cw + 0.6, ch + 0.6);
  }
  // varas de madera arriba y abajo
  const rod = (r) => {
    x.fillStyle = 'rgb(92,58,30)'; x.fillRect(X(c0 - 1), Yc(r) + ch * 0.25, (pw + 2) * cw, ch * 0.5);
    x.fillStyle = 'rgb(150,100,55)'; x.fillRect(X(c0 - 1), Yc(r) + ch * 0.3, (pw + 2) * cw, ch * 0.12);
    x.fillStyle = 'rgb(200,160,80)'; x.font = UI.font; x.textBaseline = 'middle';
    for (const cx of [c0 - 2, c0 + pw + 1]) x.fillText('O', X(cx), Yc(r) + ch / 2);
  };
  rod(r0); rod(r0 + vis + 1);

  // tinta
  x.font = UI.font; x.textBaseline = 'middle';
  const ink = (str, c, r, col) => { if (r < vis - 0) { x.fillStyle = col; x.fillText(str, X(c), Yc(r0 + 1 + r) + ch / 2); } };
  const tk = Math.min(1, intro.t * 1.5);
  const title = `~·~  ${sc.title}  ~·~`;
  ink(title, c0 + ((pw - title.length) >> 1), 1, `rgba(130,28,22,${tk})`);
  const shown = Math.floor(intro.t * 34);
  // letra capitular, grande y roja
  if (shown > 0 && vis > 4) {
    x.font = `bold ${Math.round(UI.fpx * 2.3)}px ${FONT_FAMILY}`;
    x.fillStyle = 'rgb(150,30,20)'; x.textBaseline = 'top';
    x.fillText(cap, X(c0 + 4), Yc(r0 + 4) - ch * 0.15);
    x.font = UI.font; x.textBaseline = 'middle';
  }
  let left = Math.max(0, shown - 1);
  lines.forEach((l, k) => {
    const part = l.text.slice(0, Math.max(0, left));
    left -= l.text.length + 1;
    ink(part, c0 + 4 + l.indent, 3 + k, 'rgb(62,38,18)');
  });
  const hint = 'ESPACIO: siguiente  ·  ESC: saltar la intro';
  x.fillStyle = 'rgba(200,190,170,0.7)';
  x.fillText(hint, X(cols - hint.length - 2), Yc(rows - 1) + ch / 2);
}

// Parte el texto en líneas, dejando hueco a la izquierda en las primeras (para la capitular)
function wrapIndent(text, w, indent, nIndent) {
  const words = text.split(' '), out = [];
  let line = '';
  const width = () => w - (out.length < nIndent ? indent : 0);
  for (const wd of words) {
    if ((line + (line ? ' ' : '') + wd).length > width()) { out.push({ text: line, indent: out.length < nIndent ? indent : 0 }); line = wd; }
    else line += (line ? ' ' : '') + wd;
  }
  if (line) out.push({ text: line, indent: out.length < nIndent ? indent : 0 });
  return out;
}

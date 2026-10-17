'use strict';
// Vida en los pueblos: por la noche los aldeanos se juntan alrededor de la hoguera a charlar,
// brindar y comer, y de vez en cuando sueltan juntos farolillos de papel que suben al cielo.
// También el chorro de las fuentes de los jardines.

const CAMP_LINES = [
  '¡Siéntate con nosotros, caballero! Hay sopa de patata para todos.',
  'Cuando soltamos los farolillos pedimos un deseo: que el dragón no vuelva.',
  'Dicen que bajo la tierra corre un tren entre las ciudades...',
  'De noche, lejos del fuego, el bosque es peligroso. Quédate cerca.',
];
const CAMP_TALK = ['¡Salud!', '¡Ja, ja, ja!', '¿Otra jarra?', 'Mmm, qué rico...', '¡Cuéntalo otra vez!', 'Mi abuelo vio al dragón',
                   '¿Oís a los lobos?', '¡Por el rey!', 'Pásame el pan', 'Esta noche hay estrellas', '¡Qué frío hace!', 'Cántanos algo'];

// Los aldeanos salen al anochecer y se retiran al amanecer
const campTime = () => !world.under && daylight() < 0.5;

let campTalk = [], skyLanterns = [], lanternT = 20, fireT = 0, fountainT = 0;

function campFire(i) { const cp = world.camps[i]; return { x: cp.x * TW + TW / 2, y: cp.y * TH + 1.5 }; }

function updateCamper(n, dt) {
  n.atkAnim = (n.atkAnim || 0) - dt;
  if (!campTime()) return;
  const f = campFire(n.camp);
  n.facing = f.x > n.x ? 1 : -1;
  n.anim += dt * 0.5;
  if (dist(n, player) > 160) return;
  if (Math.random() < dt * 0.12) n.atkAnim = 0.3;                                       // brinda o come
  if (Math.random() < dt * 0.1 && !campTalk.some(t => t.n === n)) {
    campTalk.push({ n, text: CAMP_TALK[(Math.random() * CAMP_TALK.length) | 0], life: 3 });
    if (n.atkAnim <= 0 && Math.random() < 0.5) n.atkAnim = 0.3;
  }
  if (n.atkAnim > 0.25 && Math.random() < 0.3 && !n.mug) burst(n.x + n.facing * 2, n.y - 6, 2, ".'", [230, 200, 140], [160, 120, 70], 5, 0.4);
}

function updateVillageLife(dt) {
  campTalk.forEach(t => { t.life -= dt; });
  campTalk = campTalk.filter(t => t.life > 0);
  if (world.under) { skyLanterns = []; return; }
  const night = campTime();
  // fuego, chispas y humo de las hogueras cercanas
  fireT -= dt;
  if (night && fireT <= 0) {
    fireT = 0.03;
    for (let i = 0; i < (world.camps || []).length; i++) {
      const f = campFire(i);
      if (Math.abs(f.x - player.x) > 200 || Math.abs(f.y - player.y) > 90) continue;
      particles.push({ x: f.x + (Math.random() - 0.5) * 3, y: f.y - 3 - Math.random() * 2, vx: (Math.random() - 0.5) * 3, vy: -5 - Math.random() * 7,
                       life: 0.6, max: 0.6, float: true, ch: "*'.^"[(Math.random() * 4) | 0], c: lerp3([255, 230, 120], [255, 70, 15], Math.random()) });
      if (Math.random() < 0.3) particles.push({ x: f.x + (Math.random() - 0.5) * 2, y: f.y - 7, vx: windS * 3 + (Math.random() - 0.5) * 2, vy: -3 - Math.random() * 2,
                       life: 2.2, max: 2.2, float: true, ch: '~-.'[(Math.random() * 3) | 0], c: [95, 95, 105] });
    }
  }
  // farolillos de papel: a veces los sueltan todos juntos
  lanternT -= dt;
  // si llegas de noche a una hoguera, enseguida los sueltan para ti
  if (night && lanternT > 6) (world.camps || []).forEach((c, i) => {
    const f = campFire(i);
    if (Math.hypot(f.x - player.x, (f.y - player.y) * A()) < 90 && time - (c.lastLaunch || -999) > 90) lanternT = 6;
  });
  if (night && lanternT <= 0) {
    lanternT = 50 + Math.random() * 70;
    let best = -1, bd = 260;
    (world.camps || []).forEach((c, i) => { const f = campFire(i); const d = Math.hypot(f.x - player.x, (f.y - player.y) * A()); if (d < bd) { bd = d; best = i; } });
    if (best >= 0) {
      const f = campFire(best);
      world.camps[best].lastLaunch = time;
      releaseLanterns(f.x, f.y, 12 + ((Math.random() * 8) | 0));
      if (bd < 120) msg('Los aldeanos sueltan farolillos de papel al cielo...', [255, 200, 120]);
    }
  }
  for (const l of skyLanterns) {
    if (l.delay > 0) { l.delay -= dt; if (l.delay <= 0) burst(l.x, l.y - l.z, 8, "*'.", [255, 240, 170], [255, 120, 40], 14, 0.7); continue; }
    l.vz = Math.min(l.vmax, l.vz + dt * 1.2);                                   // coge aire caliente y acelera
    l.z += l.vz * dt; l.x += (windS * 3 + Math.sin(time * 0.7 + l.seed) * 2.2) * dt; l.life -= dt;
    // estela de chispas que caen
    if (l.z < 160 && Math.random() < dt * 9) particles.push({ x: l.x + (Math.random() - 0.5), y: l.y - l.z + 1.5, vx: (Math.random() - 0.5) * 2, vy: 3 + Math.random() * 3,
      life: 0.9, max: 0.9, float: true, ch: Math.random() < 0.5 ? "'" : '.', c: [255, 200, 110] });
  }
  skyLanterns = skyLanterns.filter(l => l.life > 0 && l.z < 600);
  // chorro de las fuentes
  fountainT -= dt;
  if (fountainT <= 0) {
    fountainT = 0.05;
    for (const g of world.gardens || []) {
      const fx = g.fx * TW + TW / 2, fy = g.fy * TH + 1;
      if (Math.abs(fx - player.x) > 200 || Math.abs(fy - player.y) > 90) continue;
      for (let k = 0; k < 2; k++) particles.push({ x: fx + (Math.random() - 0.5) * 1.5, y: fy - 2 - Math.random() * 3, vx: (Math.random() - 0.5) * 7, vy: -4 + Math.random() * 6,
        life: 0.55, max: 0.55, float: true, ch: "'.,:"[(Math.random() * 4) | 0], c: [150, 200, 255] });
    }
  }
}

// Luz de las hogueras y de los farolillos que aún van bajos
function campLights(addL) {
  if (world.under || !campTime()) return;
  (world.camps || []).forEach((c, i) => { const f = campFire(i); addL({ x: f.x, y: f.y, r: 58, color: [1.0, 0.58, 0.24], k: 2.6, flicker: i * 3.1 }, 1); });
  let n = 0;
  for (const l of skyLanterns) if (l.delay <= 0 && l.z < 130 && n++ < 10)       // iluminan el suelo bajo ellos mientras suben
    addL({ x: l.x, y: l.y, r: 34 - l.z * 0.12, color: [l.col[0] / 255, l.col[1] / 255 * 0.85, l.col[2] / 255 * 0.6], k: 1.8 * (1 - l.z / 130) + 0.15, flicker: l.seed }, 1);
}

// Llamas de la hoguera, ordenadas en el barrido con lo demás
function campDrawables(drawables, c0, r0) {
  if (world.under || !campTime()) return;
  (world.camps || []).forEach((c, i) => {
    const f = campFire(i);
    if (f.x < c0 - 10 || f.x > c0 + R.cols + 10 || f.y < r0 - 5 || f.y > r0 + R.rows + 10) return;
    drawables.push({ y: f.y, draw: () => {
      const bx = Math.round(f.x) - c0, by = Math.round(f.y) - r0;
      for (let h = 0; h < 7; h++) for (let dx = -3; dx <= 3; dx++) {
        const w = 3.2 - h * 0.48 + Math.sin(time * 9 + h * 2 + dx) * 0.6;
        if (Math.abs(dx) > w) continue;
        const k = 1 - h / 7;
        const hot = Math.abs(dx) < w * 0.5 && h < 4;
        const ch = h === 6 ? "'" : hot ? (Math.sin(time * 13 + dx * 3 + h) > 0 ? 64 : 35) : '^)(*'[(h + dx + ((time * 10) | 0)) & 3];
        const code = typeof ch === 'number' ? ch : ch.charCodeAt(0);
        R.put(bx + dx, by - 1 - h, code, 255, hot ? 235 : 120 + 110 * k, hot ? 140 : 30 * k);
      }
    } });
  });
}

function drawCampTalk(c0, r0) {
  for (const t of campTalk) {
    const n = t.n;
    const k = Math.min(1, t.life * 1.5);
    const r = Math.round(n.y) - r0 - 17;
    if (r < 0 || r >= R.rows) continue;
    UI.worldText(n.x - c0, r, t.text, 250 * k, 240 * k, 210 * k, 0.6);
  }
}

// Farolillos: papel de colores iluminado por dentro, con su llamita, que sube meciéndose.
// Cerca se ven grandes y con detalle; muy alto quedan como estrellas cálidas que titilan.
const LANTERN_COLS = [[255, 95, 55], [255, 160, 60], [255, 210, 90], [255, 120, 150], [255, 140, 40]];
function releaseLanterns(x, y, n) {
  for (let k = 0; k < n; k++) skyLanterns.push({ x: x + (Math.random() - 0.5) * 34, y: y + (Math.random() - 0.5) * 10, z: 5 + Math.random() * 3,
    vz: 1.2, vmax: 4 + Math.random() * 3, delay: k * 0.35 + Math.random() * 0.6, seed: Math.random() * 10, life: 60,
    col: LANTERN_COLS[(Math.random() * LANTERN_COLS.length) | 0], big: Math.random() < 0.35 });
  // los aldeanos lo celebran
  for (const nn of npcs) if (Math.hypot(nn.x - x, (nn.y - y) * A()) < 60 && (!nn.camper || campTime()) && Math.random() < 0.7)
    floater(nn.x, nn.y - 14, ['¡Ooooh!', '¡Qué bonito!', '¡Pide un deseo!', '¡Mira, mira!', '¡Más alto!'][(Math.random() * 5) | 0], [255, 220, 160]);
}

function drawSkyLanterns(c0, r0) {
  for (const l of skyLanterns) {
    if (l.delay > 0) continue;
    const sx = Math.round(l.x) - c0, sy = Math.round(l.y - l.z) - r0;
    if (sx < -3 || sx > R.cols + 3 || sy < -3 || sy > R.rows + 3) continue;
    const fl = 0.82 + 0.18 * Math.sin(time * 9 + l.seed * 5) * Math.sin(time * 5.3 + l.seed);
    const c = l.col, hot = [255, 245, 200];
    const P = (dx, dy, ch, col, k = 1) => R.put(sx + dx, sy + dy, ch.charCodeAt(0), col[0] * k * fl, col[1] * k * fl, col[2] * k * fl);
    if (l.z < 70) {                                   // cerca: farolillo grande con su llama
      const w = l.big ? 2 : 1;
      P(0, -2 - (l.big ? 1 : 0), '_', c, 0.75);
      for (let dx = -w; dx <= w; dx++) P(dx, -1 - (l.big ? 1 : 0), dx === -w ? '/' : dx === w ? '\\' : '=', c, 0.9);
      if (l.big) for (let dx = -w; dx <= w; dx++) P(dx, -1, dx === -w ? '(' : dx === w ? ')' : '#', c, 1.15);
      for (let dx = -w; dx <= w; dx++) P(dx, 0, dx === -w ? '(' : dx === w ? ')' : (dx === 0 ? '@' : '#'), dx === 0 ? hot : c, 1.25);
      P(-w, 1, '\\', c, 0.7); P(w, 1, '/', c, 0.7); if (w > 1) P(0, 1, '-', c, 0.6);
      P(0, 2, Math.sin(time * 20 + l.seed) > 0 ? "'" : '`', [255, 230, 120], 1.2);               // llamita
    } else if (l.z < 160) {                           // a media altura: más pequeño
      const k = 1 - (l.z - 70) / 140;
      P(0, -1, '^', c, 0.8 * k); P(-1, 0, '(', c, k); P(0, 0, '#', hot, 1.1 * k); P(1, 0, ')', c, k);
    } else {                                          // en lo alto: estrella cálida que titila
      const k = Math.max(0.35, 1 - (l.z - 160) / 300) * (0.7 + 0.3 * Math.sin(time * 6 + l.seed * 9));
      P(0, 0, k > 0.7 ? '*' : '+', [255, 200, 120], k * 1.2);
    }
  }
}

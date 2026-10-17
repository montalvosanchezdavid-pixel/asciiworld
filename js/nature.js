'use strict';
// Niebla nocturna del cementerio
let mistT = 0, mistNoise = null;
// Banco de niebla: velo azulado que se arrastra sobre las tumbas (se mezcla con lo ya dibujado)
function drawMist(c0, r0) {
  const cm = world.cemetery;
  if (world.under || !cm) return;
  const night = 1 - daylight();
  if (night < 0.3) return;
  const k0 = Math.min(1, (night - 0.3) / 0.4);
  mistNoise ||= makeNoise(new RNG(777));
  const X0 = (cm.x0 - 3) * TW, X1 = (cm.x1 + 4) * TW, Y0 = (cm.y0 - 2) * TH, Y1 = (cm.y1 + 3) * TH;
  const d = R.data, cols = R.cols, rows = R.rows;
  for (let sr = Math.max(0, Y0 - r0); sr < Math.min(rows, Y1 - r0); sr++) {
    const wy = sr + r0;
    for (let sc = Math.max(0, X0 - c0); sc < Math.min(cols, X1 - c0); sc++) {
      const wx = sc + c0;
      const ex = Math.min(wx - X0, X1 - wx) / 30, ey = Math.min(wy - Y0, Y1 - wy) / 10;    // bordes difuminados
      const edge = Math.min(1, ex, ey);
      let f = fbm(mistNoise, wx * 0.035 - time * 0.25, wy * 0.09 + Math.sin(time * 0.2) * 0.3, 3);
      f = (f - 0.42) * 2.4 * edge * k0;
      if (f <= 0) continue;
      f = Math.min(0.75, f);
      const o = (sr * cols + sc) * 4;
      d[o + 1] = d[o + 1] * (1 - f) + 120 * f; d[o + 2] = d[o + 2] * (1 - f) + 132 * f; d[o + 3] = d[o + 3] * (1 - f) + 160 * f;
      if (f > 0.35 && (d[o] === 0 || d[o] === 14)) d[o] = f > 0.55 ? 94 : 13;   // '~' o '-' donde no hay nada
    }
  }
}
function updateMist(dt) {
  const cm = world.cemetery;
  if (world.under || !cm || !isNight()) return;
  const cx = (cm.x0 + cm.x1 + 1) / 2 * TW, cy = (cm.y0 + cm.y1 + 1) / 2 * TH;
  if (Math.hypot(cx - player.x, (cy - player.y) * A()) > 260) return;
  mistT -= dt;
  while (mistT <= 0) {
    mistT += 0.06;
    const x = (cm.x0 - 2 + Math.random() * (cm.x1 - cm.x0 + 5)) * TW, y = (cm.y0 - 1 + Math.random() * (cm.y1 - cm.y0 + 3)) * TH;
    particles.push({ x, y, vx: 2 + Math.random() * 3, vy: (Math.random() - 0.5) * 0.6, life: 3, max: 3, float: true,
                     ch: '~-.'[(Math.random() * 3) | 0], c: [150, 165, 190] });
  }
}
// Viento (hierba y árboles que se mecen, hojas al vuelo) y fauna que reacciona al jugador:
// luciérnagas de noche, mariposas de día y pájaros que echan a volar cuando te acercas.

let windT = 0, windS = 0.6;   // tiempo y fuerza del viento
let critters = [];
let swarms = [];              // claros del bosque donde se juntan muchas luciérnagas

// Busca claros: bosque con pradera cerca, separados entre sí
function initNature() {
  critters = []; swarms = [];
  const rnd = new RNG(world.seed + 31);
  for (let k = 0; k < 6000 && swarms.length < 140; k++) {
    const tx = rnd.int(3, world.W - 4), ty = rnd.int(3, world.H - 4);
    if (world.get(tx, ty) !== T.FOREST || world.isSafe(tx, ty)) continue;
    let open = false;
    for (let dy = -2; dy <= 2 && !open; dy++) for (let dx = -2; dx <= 2; dx++) {
      const t = world.get(tx + dx, ty + dy);
      if (t === T.MEADOW || t === T.GRASS || t === T.FLOWERS) { open = true; break; }
    }
    if (!open) continue;
    const x = tx * TW + TW / 2, y = ty * TH + TH / 2;
    if (swarms.some(s => Math.hypot(s.x - x, (s.y - y) * 1.8) < 90)) continue;
    swarms.push({ x, y, active: false });
  }
}

function updateWind(dt) {
  windT += dt;
  windS = 0.45 + 0.3 * Math.sin(windT * 0.13) + 0.2 * Math.sin(windT * 0.47 + 1.3) + weather.rain * 0.5;
}
// Fuerza local del viento (las ráfagas viajan de oeste a este)
const windAt = (x, y) => windS * (0.6 + 0.4 * Math.sin(windT * 1.9 - x * 0.045 + y * 0.02));

// Ola de viento sobre la hierba: 0 = quieta, 1 = muy doblada
const grassGust = (x, y) => Math.sin(x * 0.06 - windT * 2.6 + y * 0.04) * windS;

function critterTileOk(kind, x, y) {
  const t = matAt(x, y);
  if (world.bldAt(Math.floor(x / TW), Math.floor(y / TH))) return false;
  if (kind === 'firefly') return t === T.GRASS || t === T.MEADOW || t === T.FOREST || t === T.PINE || t === T.FLOWERS || t === T.FIELD;
  if (kind === 'butterfly') return t === T.FLOWERS || t === T.MEADOW || t === T.GRASS || t === T.FIELD;
  return t === T.GRASS || t === T.MEADOW || t === T.ROAD || t === T.SAND || t === T.HILL || t === T.PLAZA;
}

function spawnCritter(kind) {
  const viewW = R.cols, viewH = R.rows;
  for (let k = 0; k < 20; k++) {
    const x = camX + (Math.random() - 0.5) * viewW * 1.1, y = camY + (Math.random() - 0.5) * viewH * 1.1;
    if (!critterTileOk(kind, x, y)) continue;
    if (Math.hypot(x - player.x, (y - player.y) * A()) < 25) continue;
    if (kind === 'bird') {     // bandada posada en el suelo
      const n = 3 + ((Math.random() * 4) | 0);
      for (let i = 0; i < n; i++) {
        const bx = x + (Math.random() - 0.5) * 10, by = y + (Math.random() - 0.5) * 4;
        if (critterTileOk('bird', bx, by)) critters.push({ kind, x: bx, y: by, z: 0, vx: 0, vy: 0, vz: 0, flying: false, ph: Math.random() * 10, life: 1 });
      }
      return;
    }
    critters.push({ kind, x, y, z: kind === 'firefly' ? 2 + Math.random() * 6 : 3 + Math.random() * 4,
                    vx: 0, vy: 0, ph: Math.random() * 10, life: 0,
                    col: [[255, 220, 60], [120, 170, 255], [255, 120, 200], [245, 245, 245], [255, 150, 50]][(Math.random() * 5) | 0] });
    return;
  }
}

function updateCritters(dt) {
  if (world.under) { critters = []; return; }
  const night = 1 - daylight();
  // Enjambres: al acercarte de noche a un claro aparecen decenas de luciérnagas juntas
  for (const sw of swarms) {
    const near = Math.abs(sw.x - camX) < R.cols * 0.65 && Math.abs(sw.y - camY) < R.rows * 0.75;
    if (night > 0.5 && near && !sw.active) {
      sw.active = true;
      for (let i = 0; i < 40; i++) {
        const gx = (Math.random() + Math.random() + Math.random() - 1.5) * 12, gy = (Math.random() + Math.random() + Math.random() - 1.5) * 4;
        critters.push({ kind: 'firefly', home: sw, x: sw.x + gx, y: sw.y + gy, z: 1 + Math.random() * 7, vx: 0, vy: 0, ph: Math.random() * 10, life: 0 });
      }
    } else if (sw.active && (night < 0.4 || Math.abs(sw.x - camX) > R.cols * 1.3 || Math.abs(sw.y - camY) > R.rows * 1.5)) sw.active = false;
  }
  const want = { firefly: night > 0.5 ? 25 : 0, butterfly: night < 0.35 && weather.rain < 0.3 ? 12 : 0, bird: night < 0.4 ? 18 : 0 };
  const count = { firefly: 0, butterfly: 0, bird: 0 };
  for (const c of critters) if (!c.home) count[c.kind]++;
  for (const k in want) if (count[k] < want[k] && Math.random() < dt * 6) spawnCritter(k);

  const a = A();
  for (const c of critters) {
    const dx = c.x - player.x, dy = (c.y - player.y) * a;
    const d = Math.hypot(dx, dy) || 1;
    if (c.kind === 'bird') {
      if (!c.flying) {
        c.ph += dt;
        if (Math.random() < dt * 0.8) { c.x += (Math.random() - 0.5) * 1.5; }       // picotea y da saltitos
        const scared = d < 28 || arrows.some(ar => Math.hypot(ar.x - c.x, (ar.y - c.y) * a) < 20);
        if (scared) {
          c.flying = true;
          const ang = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.9;
          const sp = 35 + Math.random() * 20;
          c.vx = Math.cos(ang) * sp; c.vy = Math.sin(ang) * sp / a; c.vz = 7 + Math.random() * 5;
        }
      } else {
        c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt; c.vz *= 0.985;
        c.ph += dt * 14;
      }
    } else {
      // vuelo errático
      c.ph += dt;
      const turn = c.kind === 'butterfly' ? 60 : 25;
      c.vx += (Math.random() - 0.5) * turn * dt * 4;
      c.vy += (Math.random() - 0.5) * turn * dt * 2;
      c.vx *= 0.96; c.vy *= 0.96;
      c.vx += windAt(c.x, c.y) * dt * 4;      // el viento los empuja un poco
      // vuelven a su claro (las del enjambre)
      if (c.home) { c.vx += (c.home.x - c.x) * 0.9 * dt; c.vy += (c.home.y - c.y) * 2.2 * dt; }
      // huyen del jugador (el enjambre se dispersa con fuerza)
      const flee = c.kind === 'butterfly' ? 18 : c.home ? 34 : 24;
      if (d < flee) {
        const f = (1 - d / flee) * (c.home ? 260 : 120) * dt;
        c.vx += dx / d * f; c.vy += dy / d * f / a;
      }
      c.x += c.vx * dt; c.y += c.vy * dt;
      c.z += Math.sin(c.ph * (c.kind === 'butterfly' ? 6 : 1.5)) * dt * 3;
      c.z = Math.max(1, Math.min(9, c.z));
      c.life = Math.min(1, c.life + dt);
    }
    const off = c.home ? !c.home.active : Math.abs(c.x - camX) > R.cols * 0.75 || Math.abs(c.y - camY) > R.rows * 0.9;
    if (off || (c.kind === 'firefly' && night < 0.4) || (c.kind !== 'firefly' && night > 0.55)) c.dead = true;
  }
  critters = critters.filter(c => !c.dead);

  // hojas arrastradas por el viento
  if (windS > 0.5 && Math.random() < dt * windS * 5 && terr) {
    const x = camX - R.cols * 0.55, y = camY + (Math.random() - 0.5) * R.rows;
    particles.push({ x, y, vx: 25 + windS * 30, vy: (Math.random() - 0.3) * 4, life: 4, max: 4, float: true,
                     ch: ",'~`"[(Math.random() * 4) | 0], c: [[110, 170, 60], [200, 170, 60], [210, 110, 40]][(Math.random() * 3) | 0] });
  }
}

// Luces de las luciérnagas más cercanas
function critterLights(addL) {
  let n = 0;
  for (const c of critters) {
    if (c.kind !== 'firefly' || n >= 14) continue;
    const g = 0.5 + 0.5 * Math.sin(time * 3 + c.ph * 7);
    if (g < 0.35) continue;
    addL({ x: c.x, y: c.y, r: 8, color: [0.7, 1.0, 0.35], k: 0.45 * g }, 1);
    n++;
  }
}

function drawCritters(c0, r0) {
  for (const c of critters) {
    const sx = Math.round(c.x + lean(c.x, c.z)) - c0, sy = Math.round(c.y - c.z) - r0;
    if (c.kind === 'firefly') {
      const g = (0.5 + 0.5 * Math.sin(time * 3 + c.ph * 7)) * c.life;
      if (g < 0.2) continue;
      R.put(sx, sy, g > 0.7 ? 42 : 46, 120 + 135 * g, 255 * g, 70 * g);
    } else if (c.kind === 'butterfly') {
      const L = lightInto(c.x, c.y);
      const flap = Math.sin(time * 18 + c.ph * 5) > 0;
      R.put(sx, sy, flap ? 119 : 118, c.col[0] * L[0], c.col[1] * L[1], c.col[2] * L[2]);   // w / v
    } else {
      const L = lightInto(c.x, c.y);
      if (c.flying) {
        R.dim(Math.round(c.x) - c0, Math.round(c.y) - r0, 0.5);                                   // sombra en el suelo
        R.put(sx, sy, Math.sin(c.ph) > 0 ? 118 : 94, 50 * L[0], 45 * L[1], 40 * L[2]);            // v / ^
      } else R.put(sx, sy, Math.sin(c.ph * 3) > 0.6 ? 44 : 101, 110 * L[0], 85 * L[1], 60 * L[2]); // , / e
    }
  }
}

'use strict';
// Atmósfera y luz: sombras de nubes que se deslizan, luz moteada en el bosque, neblina del alba,
// rayos de sol al amanecer y al atardecer, polillas alrededor de los farolillos y una viñeta
// suave en los bordes de la pantalla.

// Sombra de las nubes en (wx, wy): 1 = a pleno sol, ~0.7 = bajo una nube
function cloudAt(wx, wy) {
  const v = Math.sin(wx * 0.017 + time * 0.09) * Math.sin(wy * 0.041 - time * 0.05 + wx * 0.006) + 0.45 * Math.sin(wx * 0.009 - wy * 0.02 + time * 0.07);
  return v > 0.3 ? 1 - Math.min(1, (v - 0.3) * 2.2) * 0.32 : 1;
}

// Rayos de sol entre las copas: manchas de luz que bailan con el viento
const sunFleck = (wx, wy) => Math.sin(wx * 0.9 + windT * 2.2) * Math.sin(wy * 1.7 - windT * 1.6 + wx * 0.3);

// Neblina del alba (rosada) y bruma gris cuando llueve, sobre lo ya dibujado
function applyFog(c0, r0) {
  if (world.under) return;
  const f = ((dayTime % 1) + 1) % 1;
  const dawn = Math.max(0, 1 - Math.abs(f - 0.27) / 0.07), rainF = weather.rain * 0.32;
  const k0 = dawn * 0.5 + rainF;
  if (k0 < 0.03) return;
  const fc = dawn * 0.5 > rainF ? [215, 200, 210] : [150, 160, 175];
  const d = R.data, cols = R.cols, rows = R.rows;
  for (let r = 0; r < rows; r++) {
    const wy = r + r0;
    for (let c = 0; c < cols; c++) {
      const wx = c + c0;
      const n = 0.5 + 0.5 * Math.sin(wx * 0.031 + time * 0.12) * Math.sin(wy * 0.083 - time * 0.07 + wx * 0.01);
      const k = k0 * (0.35 + 0.65 * n), i = (r * cols + c) * 4;
      d[i + 1] += (fc[0] - d[i + 1]) * k; d[i + 2] += (fc[1] - d[i + 2]) * k; d[i + 3] += (fc[2] - d[i + 3]) * k;
      if (d[i] === 0 && k > 0.3 && n > 0.75) d[i] = 13;     // jirones de niebla: '-'
    }
  }
}

// Polillas revoloteando alrededor de los farolillos encendidos
function drawMoths(c0, r0) {
  if (world.under || nightK() < 0.4) return;
  let n = 0;
  for (const L of terr.lights) {
    if (L.r !== 28 || L.x < c0 - 5 || L.x > c0 + R.cols + 5 || L.y < r0 - 5 || L.y > r0 + R.rows + 10) continue;
    if (++n > 12) break;
    for (let k = 0; k < 3; k++) {
      const s = L.flicker * 7 + k * 2.1, a = time * (2.2 + k * 0.7) + s;
      const x = L.x + Math.cos(a) * (3 + Math.sin(time * 1.3 + s) * 1.5), y = L.y - 7 + Math.sin(a * 1.3) * 1.6;
      R.put(Math.round(x) - c0, Math.round(y) - r0, Math.sin(time * 30 + s) > 0 ? 118 : 39, 255, 235, 190);
    }
  }
}

// Viñeta y rayos de luz, en la capa de interfaz (por encima del mundo, por debajo del panel)
function drawAtmosphere() {
  const x = UI.ctx, W = UI.canvas.width, H = UI.canvas.height;
  if (!W) return;
  const dl = daylight(), night = world.under ? 1 : Math.max(0, Math.min(1, (0.6 - dl) / 0.4));
  // rayos de sol al amanecer y al atardecer
  const dusk = world.under ? 0 : Math.max(0, 1 - Math.abs(dl - 0.5) / 0.22) * (1 - weather.rain);
  if (dusk > 0.05) {
    x.save();
    x.globalCompositeOperation = 'lighter';
    const f = ((dayTime % 1) + 1) % 1, fromLeft = f < 0.5;          // de mañana por la izquierda, de tarde por la derecha
    for (let k = 0; k < 6; k++) {
      const bx = ((k * 0.19 + Math.sin(time * 0.05 + k) * 0.04 + time * 0.004) % 1.2 - 0.1) * W, bw = W * (0.03 + 0.03 * ((k * 7) % 3));
      const sl = H * 0.55 * (fromLeft ? 1 : -1);
      const g = x.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, `rgba(255,190,110,${0.11 * dusk})`); g.addColorStop(1, 'rgba(255,170,90,0)');
      x.fillStyle = g;
      x.beginPath(); x.moveTo(bx, 0); x.lineTo(bx + bw, 0); x.lineTo(bx + bw + sl, H); x.lineTo(bx + sl, H); x.closePath(); x.fill();
    }
    x.restore();
  }
  // viñeta: bordes más oscuros, azulados de noche y casi negros bajo tierra
  const g = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.hypot(W, H) * 0.56);
  const a = (world.under ? 0.65 : 0.28 + 0.27 * night) * (IS_TOUCH ? 0.45 : 1);    // en el móvil, más suave
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, night > 0.5 && !world.under ? `rgba(4,8,26,${a})` : `rgba(0,0,0,${a})`);
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
}

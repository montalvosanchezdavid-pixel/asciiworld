'use strict';
// Telarañas: cuelgan de las esquinas de las catacumbas, de los muros del cementerio y de
// las lápidas. Si pasas a través, se rompen en hilos que caen flotando; al rato, cuando
// no miras, las arañas las vuelven a tejer.

function buildWebs(w) {
  const webs = [];
  const rng = new RNG(w.seed + 313);
  const isT = (x, y, t) => w.get(x, y) === t;
  const add = (cx, cy, z, dir, R) => webs.push({ cx, cy, z, dir, R, Rx: Math.round(R * 2.2), broken: false, brokenAt: 0, seed: rng.next() });
  if (w.under) {
    const lair = w.spiderLair;
    for (let ty = 1; ty < w.H - 1; ty++) for (let tx = 1; tx < w.W - 1; tx++) {
      const t = w.get(tx, ty);
      if (t !== T.CRYPTFLOOR && t !== T.WEB && t !== T.RAIL) continue;
      if (!isT(tx, ty - 1, T.CRYPTWALL)) continue;
      const nearLair = lair && Math.abs(tx - lair.x) < 14 && Math.abs(ty - lair.y) < 9;
      const p = nearLair ? 0.9 : 0.5;
      const R = nearLair ? 3 + rng.next() * 1.5 : 2.2 + rng.next() * 1.6;
      if (isT(tx - 1, ty, T.CRYPTWALL) && rng.chance(p)) add(tx * TW, ty * TH, 4, 1, R);
      if (isT(tx + 1, ty, T.CRYPTWALL) && rng.chance(p)) add(tx * TW + TW - 1, ty * TH, 4, -1, R);
      if (!isT(tx - 1, ty, T.CRYPTWALL) && !isT(tx + 1, ty, T.CRYPTWALL) && rng.chance(nearLair ? 0.25 : 0.05))
        add(tx * TW + 2, ty * TH, 4, rng.chance(0.5) ? 1 : -1, R);
    }
  } else {
    // en el bosque: entre los árboles, colgando de las ramas
    if (terr && terr.trees) for (const tr of terr.trees) {
      const t = w.get(Math.floor(tr.x / TW), Math.floor(tr.y / TH));
      if ((t !== T.FOREST && t !== T.PINE) || !rng.chance(0.03)) continue;
      const dir = rng.chance(0.5) ? 1 : -1;
      add(Math.round(tr.x + dir * tr.rx * 0.5), Math.floor(tr.y + tr.ry * 0.6) + 1, 4, dir, 2.2 + rng.next() * 1.4);
    }
    for (const cm of w.cemeteries || []) {
      // esquinas interiores del muro
      add(cm.x0 * TW + TW, (cm.y0 + 1) * TH, 4, 1, 3.2);
      add((cm.x1) * TW - 1, (cm.y0 + 1) * TH, 4, -1, 3.2);
      // a lo largo del muro del fondo y entre las tumbas
      for (let tx = cm.x0 + 2; tx < cm.x1 - 1; tx++) if (rng.chance(0.12)) add(tx * TW, (cm.y0 + 1) * TH, 4, rng.chance(0.5) ? 1 : -1, 2.2 + rng.next());
      for (let ty = cm.y0 + 1; ty < cm.y1; ty++) for (let tx = cm.x0 + 1; tx < cm.x1; tx++) {
        if (!isT(tx, ty, T.GRAVE) || graveKind(tx, ty) === 2 || !rng.chance(0.3)) continue;
        const dir = rng.chance(0.5) ? 1 : -1;
        add(tx * TW + TW / 2 + dir * 2.5, ty * TH + 1, 3, dir, 1.8 + rng.next() * 0.8);
      }
    }
  }
  return webs;
}

const websOf = () => (world.webs ||= buildWebs(world));

// Celdas de una telaraña de esquina: radios que salen del anclaje y anillos que los cruzan
function webCells(wb) {
  const cells = [];
  const { Rx, R, dir } = wb;
  const spokes = [0, Math.PI / 6, Math.PI / 3, Math.PI / 2];
  for (let j = 0; j <= Math.ceil(R); j++) for (let i = 0; i <= Rx; i++) {
    const u = i / Rx, v = j / R;
    const rho = Math.hypot(u, v);
    if (rho > 1.02 || (i === 0 && j === 0)) continue;
    const th = Math.atan2(v, u);
    let ch = null, k = 1;
    for (const s of spokes) {
      if (Math.abs(th - s) * rho * Math.max(Rx, R) < 0.55) {
        ch = s === 0 ? '-' : s === Math.PI / 2 ? '|' : (dir > 0 ? '\\' : '/');
        k = 1;
      }
    }
    if (!ch) for (const ring of [0.38, 0.68, 0.98]) {
      if (Math.abs(rho - ring) < 0.5 / Math.max(Rx, R) + 0.04) { ch = (i + j) % 2 ? '.' : (th < 0.7 ? '_' : ':'); k = 0.75; }
    }
    if (ch) cells.push([i * dir, j, ch, k]);
  }
  return cells;
}

function drawWeb(wb, c0, r0) {
  if (wb.broken) return;
  const cells = wb._cells ||= webCells(wb);
  const u = wb.breaking ? (time - wb.breaking) / 0.55 : 0;          // al romperse: brilla y se deshace
  const L = lightInto(wb.cx + wb.dir * wb.Rx / 2, wb.cy);
  const lr = Math.max(0.5, L[0]), lg = Math.max(0.5, L[1]), lb = Math.max(0.58, L[2]);
  const o = lean(wb.cx, wb.z);
  // tiembla un poco cuando te acercas
  const near = Math.hypot(player.x - wb.cx, (player.y - wb.cy) * A()) < wb.Rx * 2.5;
  for (let n = 0; n < cells.length; n++) {
    const [dx, dy, ch, k0] = cells[n];
    if (u > 0 && hash2(n * 7 + 1, wb.seed * 1000) < u * 1.1) continue;
    const k = k0 * (1 + 1.8 * (u > 0 ? 1 - u : 0));
    const sway = near ? Math.round(Math.sin(time * 14 + dy) * 0.6 * (dy / wb.R)) : 0;
    const sh = 0.8 + 0.35 * Math.sin(time * 1.3 + wb.seed * 20 + dx * 0.7 - dy);   // brillo sedoso
    const c = 225 * k * sh;
    const gl = u > 0 ? 1 - u : 0;
    R.put(Math.round(wb.cx + dx + o + sway) - c0, Math.round(wb.cy - wb.z + dy) - r0, ch.charCodeAt(0),
          c * Math.max(lr, gl), c * Math.max(lg, gl * 0.95), (c + 15) * Math.max(lb, gl * 0.8));
  }
}

function webDrawables(drawables, c0, r0) {
  for (const wb of websOf()) {
    if (wb.broken || wb.cx < c0 - 15 || wb.cx > c0 + R.cols + 15 || wb.cy < r0 - 2 || wb.cy > r0 + R.rows + 8) continue;
    drawables.push({ y: wb.cy, draw: () => drawWeb(wb, c0, r0) });
  }
}

// Romper las telarañas al pasar (también desde el vagón) y volver a tejerlas con el tiempo
function updateWebs() {
  if (state !== 'play' || player.onWall || player.floor > 0) return;
  for (const wb of websOf()) {
    if (wb.broken) {
      if (time - wb.brokenAt > 150 && Math.hypot(player.x - wb.cx, (player.y - wb.cy) * A()) > 150) wb.broken = false;
      continue;
    }
    if (wb.breaking) {
      if (time - wb.breaking < 0.55) continue;
      wb.breaking = 0; wb.broken = true; wb.brokenAt = time;
      continue;
    }
    const mx = wb.cx + wb.dir * wb.Rx * 0.45;
    if (Math.abs(player.x - mx) > wb.Rx * 0.75 || Math.abs(player.y - wb.cy) > 2.2) continue;
    wb.breaking = time;
    Sfx.tear();
    tempLights.push({ x: mx, y: wb.cy - 1, r: 16, c: [0.85, 0.9, 1.0], k: 0.9, life: 0.6, max: 0.6 });
    const o = lean(wb.cx, wb.z);
    for (const [dx, dy, ch] of wb._cells ||= webCells(wb)) {
      if (Math.random() < 0.45) continue;
      particles.push({ x: wb.cx + dx + o, y: wb.cy - wb.z + dy, vx: (Math.random() - 0.5) * 5 + (player.dir ? player.dir.x * 4 : 0), vy: 1.5 + Math.random() * 3.5,
                       life: 0.8 + Math.random() * 1.1, max: 1.9, float: true, ch: Math.random() < 0.5 ? ch : "',.~*"[(Math.random() * 5) | 0], c: [240, 240, 255] });
    }
  }
}

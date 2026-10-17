'use strict';
// Vista 3/4 con perspectiva. El mundo se recorre fila a fila de norte a sur y todo lo
// que tiene altura se levanta del suelo. Además, cuanto más alto está algo, más se aleja
// del centro de la cámara (como una cámara real mirando desde arriba): así se ven también
// los laterales de casas, murallas, torres y árboles, con paralaje al moverse.

const CASTLE_WALL_H = 15, TOWER_H = 24, FLOOR_H = 11, MAX_UP = 34, LEAN = 0.006;
let playerCells = [];   // celdas del caballero, para dibujar su silueta si algo lo tapa
let leanCX = 0;         // columna del mundo en el centro de la cámara
const lean = (wx, z) => Math.round((wx - leanCX) * z * LEAN);

function bldWallH(b) {
  if (b.name === 'Palacio real') return FLOOR_H * 2 + 5;
  if (b.style === 'tower') return 32;
  if (b.style === 'windmill') return 22;
  if (b.style === 'church') return 22;
  return b.floors > 1 ? FLOOR_H * 2 : FLOOR_H;
}
const roofPitch = b => b.name === 'Palacio real' || b.style === 'tower' || b.style === 'windmill' ? 0
  : Math.max(4, Math.min(b.style === 'fachwerk' ? 18 : 12, Math.round(b.h * TH / (b.style === 'fachwerk' ? 1.7 : 2.6))));
const WT_ROOF = 20;   // altura del tejado de las torres de madera sobre su plataforma
const roofZAt = (b, y) => {
  const Y0 = b.y * TH, Yb = Y0 + b.h * TH - 1, ym = (Y0 + Yb) / 2, half = Math.max(1, (Yb - Y0) / 2);
  return bldWallH(b) + roofPitch(b) * Math.max(0, 1 - Math.abs(y - ym) / half);
};
// Punta de la chimenea (para el humo)
function chimneyTop(b) {
  const x = b.chimney.x * TW + 3, y = b.chimney.y * TH + 1;
  return { x: x + lean(x, roofZAt(b, y) + 3), y: y - Math.round(roofZAt(b, y)) - 3 };
}

function renderWorld3D(c0, r0, drawables, upperDraw) {
  const cols = R.cols, rows = R.rows, a = A();
  leanCX = c0 + cols / 2;
  const { CW, CH, glyph, col, water, phase, mat, hgt, treeRows, wdepth, puddle } = terr;
  // agua: color del cielo que refleja (día, atardecer, noche), brillo del sol y lluvia
  const dl = daylight(), dusk = Math.max(0, 1 - Math.abs(dl - 0.45) / 0.3), rainK = world.under ? 0 : weather.rain;
  const sky = [90 + 120 * dusk, 140 + 30 * dusk - 40 * (1 - dl), 200 - 60 * dusk];
  const sunK = world.under ? 0 : Math.max(0, dl - 0.55) * 2.2 * (1 - rainK), tk = Math.floor(time * 4), rk = Math.floor(time * 6);
  const pl = state === 'play' && player && !player.onWall && !(player.floor > 0) ? player : null;
  if (!grassMask || grassMask.length !== cols * rows) grassMask = new Uint8Array(cols * rows); else grassMask.fill(0);
  const d = R.data;
  const pb = state === 'play' ? player.bld : null;
  const Wt = world.W, bg = world.bldGrid;
  const top = r0 - 2, nRows = rows + MAX_UP + 3;
  const buckets = new Array(nRows);
  const push = (wy, fn) => {
    let k = wy - top;
    if (k < 0) return;
    if (k >= nRows) k = nRows - 1;
    (buckets[k] ||= []).push(fn);
  };
  for (const dr of drawables) push(Math.round(dr.y), dr.draw);
  for (const b of world.buildings) {
    const X0 = b.x * TW, Y0 = b.y * TH, ybot = Y0 + b.h * TH - 1;
    if (X0 + b.w * TW + 12 < c0 || X0 - 12 > c0 + cols || ybot < r0 - 2 || Y0 - bldWallH(b) - 12 > r0 + rows) continue;
    if (b === pb) { if (b.upper) push(ybot, () => drawUpperFloor(b, c0, r0, upperDraw)); }
    else push(ybot, () => drawBuilding3D(b, c0, r0));
  }
  for (const t of world.watchtowers || []) {
    const X0 = t.x * TW, Y0 = t.y * TH, Yb = Y0 + t.h * TH - 1;
    if (X0 + 30 < c0 || X0 - 30 > c0 + cols || Yb + 6 < r0 || Y0 - t.ph - WT_ROOF - 10 > r0 + rows) continue;
    push(Y0, () => watchtowerBack(t, c0, r0));
    push(Yb, () => watchtowerFront(t, c0, r0));
  }
  playerCells = [];

  let lr = 1, lg = 1, lb = 1, add = 0;
  // cada bloque de 16x8 celdas guarda solo las luces que lo alcanzan (con muchas luces, mucho más rápido)
  const BW = 16, BH = 8, gx0 = c0 - 8, gy0 = top - 8, NBX = Math.ceil((cols + 16) / BW), NBY = Math.ceil((nRows + 16) / BH);
  const blocks = new Array(NBX * NBY);
  for (let k = 0; k < VL.length; k++) {
    const L = VL[k], ry = L.r / a;
    const bx0 = Math.max(0, Math.floor((L.x - L.r - gx0) / BW)), bx1 = Math.min(NBX - 1, Math.floor((L.x + L.r - gx0) / BW));
    const by0 = Math.max(0, Math.floor((L.y - ry - gy0) / BH)), by1 = Math.min(NBY - 1, Math.floor((L.y + ry - gy0) / BH));
    for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) (blocks[by * NBX + bx] ||= []).push(L);
  }
  const NONE = [];
  const clouds = sunK > 0.05;
  const light = (wx, wy) => {
    const cf = clouds ? cloudAt(wx, wy) : 1;
    lr = amb[0] * cf; lg = amb[1] * cf; lb = amb[2] * cf; add = 0;
    const bx = Math.floor((wx - gx0) / BW), by = Math.floor((wy - gy0) / BH);
    const list = bx >= 0 && by >= 0 && bx < NBX && by < NBY ? (blocks[by * NBX + bx] || NONE) : VL;
    for (let k = 0; k < list.length; k++) {
      const L = list[k];
      const dx = wx - L.x, dy = (wy - L.y) * a;
      const d2 = dx * dx + dy * dy;
      if (d2 >= L.r2) continue;
      let f = 1 - Math.sqrt(d2) / L.r; f *= f * L.k;
      lr += L.c[0] * f; lg += L.c[1] * f; lb += L.c[2] * f;
      add += f;
    }
  };
  let wspan = 1;
  const write = (c, r, g, cr, cg, cb) => {
    if (r < 0 || r >= rows) return;
    const vr = cr * lr + (lr > amb[0] ? add * 18 : 0), vg = cg * lg + (lg > amb[1] ? add * 10 : 0), vb = cb * lb;
    for (let s2 = 0; s2 < wspan; s2++) {
      const cc = c + s2;
      if (cc < 0 || cc >= cols) continue;
      const o = (r * cols + cc) * 4;
      d[o] = g - 32;
      d[o + 1] = vr > 255 ? 255 : vr; d[o + 2] = vg > 255 ? 255 : vg; d[o + 3] = vb > 255 ? 255 : vb;
    }
  };
  const tallOf = (m, wx, wy) => {
    if (m === T.CRYPTWALL) return 4;
    if (m === T.HEDGE) return 2 + (hash2((wx / 3) | 0, (wy / 2) | 0) > 0.6 ? 1 : 0);
    if (m === T.BASIN) return 1;
    if (m === T.CEMWALL) {                      // muro bajo, con pilares en las esquinas y a los lados de la puerta
      const tx = (wx / TW) | 0, ty = (wy / TH) | 0;
      const isC = (x, y) => world.get(x, y) === T.CEMWALL;
      const gate = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !isC(tx + dx, ty + dy) && TILE_DEFS[world.get(tx + dx, ty + dy)].pass && isC(tx - dx, ty - dy));
      const corner = (isC(tx + 1, ty) || isC(tx - 1, ty)) && (isC(tx, ty + 1) || isC(tx, ty - 1));
      const lx = wx % TW;
      if ((gate || corner) && lx >= 1 && lx <= 4) return 8;
      return (tx + ty) % 4 === 0 && lx >= 2 && lx <= 3 ? 5 : 4;
    }
    if (m !== T.CWALL && m !== T.TOWER && m !== T.HWALL && m !== T.WINDOW) return 0;
    const ty = (wy / TH) | 0;
    const bid = bg[ty * Wt + ((wx / TW) | 0)];
    if (bid < 0) return m === T.TOWER ? TOWER_H : m === T.CWALL ? CASTLE_WALL_H : FLOOR_H;
    if (pb && bid === pb.id) {             // casa en la que estás: interior en 3D
      if (ty === pb.y) return bldWallH(pb);            // pared del fondo, entera
      if (ty === pb.y + pb.h - 1) return 1;            // pared delantera recortada
      return 3;                                        // laterales y tabiques, bajos
    }
    return 0;                               // la tapa su tejado
  };

  for (let k = 0; k < nRows; k++) {
    const wy = top + k;
    if (wy >= 0 && wy < CH) {
      const sr = wy - r0;
      for (let c = 0; c < cols; c++) {
        const wx = c0 + c;
        if (wx < 0 || wx >= CW) continue;
        const i = wy * CW + wx;
        const m = mat[i];
        let g = glyph[i], cr = col[i * 3], cg = col[i * 3 + 1], cb = col[i * 3 + 2];
        let h = tallOf(m, wx, wy) || hgt[i];
        let outer = false, merlon = false;
        if ((m === T.CWALL || m === T.TOWER) && h >= CASTLE_WALL_H) {
          outer = true;
          const isW = j => { const t = mat[j]; return t === T.CWALL || t === T.TOWER; };
          const nN = wy > 0 && !isW(i - CW), nS = wy + 1 < CH && !isW(i + CW), nE = !isW(i + 1), nW = !isW(i - 1);
          if ((nN || nS) && ((wx / 3) | 0) % 2 === 0) { h += 3; merlon = true; }
          else if ((nE || nW) && !nN && !nS && (wy >> 1) % 2 === 0) { h += 3; merlon = true; }
          else if (hash2(wx >> 2, wy >> 1) > 0.85) h -= 1;      // piedras gastadas
        }
        if (h === 0 && (sr < 0 || sr >= rows)) continue;
        if (h > 0 && (sr < 0 || sr - h >= rows)) continue;

        const wv = water[i];
        if (wv && m !== T.WELL) {
          const ph = phase[i] / 255;
          // cada celda se mece despacio a su ritmo, con un oleaje ancho y lento por encima
          const tw = Math.sin(time * 0.8 + ph * 6.283), swell = Math.sin(wx * 0.045 + wy * 0.12 - time * 0.4);
          const wn = Math.max(0, Math.min(1, 0.5 + tw * 0.28 + swell * 0.24));
          const dep = Math.min(1, (wdepth[i] || 1) / 12) * (m === T.DEEP ? 1 : m === T.LAKE ? 0.5 : 0.85);
          // color por profundidad: turquesa en la orilla, azul intenso mar adentro, y un poco del cielo reflejado
          cr = 95 - 60 * dep; cg = 200 - 100 * dep; cb = 215 - 25 * dep;
          const refl = 0.18 + 0.2 * wn;
          cr += (sky[0] - cr) * refl; cg += (sky[1] - cg) * refl; cb += (sky[2] - cb) * refl;
          const kk = 0.85 + 0.45 * wn;
          cr *= kk; cg *= kk; cb *= kk;
          g = wn > 0.36 ? 126 : 45;                                               // ~ ondas, - remansos
          if (wn > 0.8) { cr += 55; cg += 60; cb += 45; }
          if (dep < 0.35) {                                                       // reflejos de luz en el fondo poco profundo
            const ca = Math.sin(wx * 0.5 + time * 2.1) * Math.sin(wy * 1.3 - time * 1.7 + wx * 0.2);
            if (ca > 0.6) { cr += 35; cg += 45; cb += 30; }
          }
          if (wv === 2) {                                                         // espuma que va y viene en la orilla
            const lap = Math.sin(time * 1.6 + ph * 6.28 + wx * 0.05);
            if (lap > 0.1) { g = lap > 0.6 ? 126 : 45; cr = 205; cg = 225; cb = 235; }
          }
          if (sunK > 0 && hash2(wx + tk * 17, wy * 3 + (tk >> 2)) > 0.992 - wn * 0.004) { g = 42; cr = cg = cb = 255 * Math.min(1, 0.6 + sunK); }  // destellos del sol
          if (rainK > 0.2 && hash2(wx * 7 + rk, wy * 3 - rk) > 1 - 0.03 * rainK) { g = 111; cr = 170; cg = 195; cb = 225; }                 // gotas de lluvia
        } else if (puddle[i]) {
          // charco: refleja el cielo, con el borde de barro y ondas cuando lo pisan
          if (puddle[i] === 2) { g = 46; cr = 75; cg = 62; cb = 48; }
          else {
            const wn = 0.5 + 0.5 * Math.sin(wx * 0.6 + wy * 0.8 + time * 1.3);
            g = wn > 0.75 ? 126 : 45;
            cr = sky[0] * 0.75 + 20 * wn; cg = sky[1] * 0.8 + 20 * wn; cb = sky[2] * 0.9 + 20 * wn;
            for (const rp of ripples) {
              const dd = Math.hypot(wx - rp.x, (wy - rp.y) * a) - rp.t * 18;
              if (Math.abs(dd) < 0.9) { g = 111; const k = 1 - rp.t; cr += 90 * k; cg += 90 * k; cb += 80 * k; }
            }
            if (sunK > 0 && hash2(wx + tk * 13, wy) > 0.985) { g = 42; cr = cg = cb = 250; }
          }
        } else if (m === T.FIELD) {
          const cp = cropGlyph(wx, wy);
          if (cp) { g = cp[0]; cr = cp[1]; cg = cp[2]; cb = cp[3]; }
        }
        light(wx, wy);

        if (h === 0) {
          let sh = 1;   // sombra de contacto al pie de lo alto
          if (wy > 0) {
            const up = i - CW;
            if (hgt[up] > 0 || tallOf(mat[up], wx, wy - 1) > 1) {
              sh = 0.5;
              if ((mat[up] === T.CWALL || mat[up] === T.TOWER) && hash2(wx, wy) > 0.7) { g = hash2(wx, wy + 5) > 0.5 ? 111 : 46; cr = 130; cg = 126; cb = 118; }
            }
          }
          if (sunK > 0.1 && (m === T.FOREST || m === T.PINE) && sunFleck(wx, wy) > 0.8) sh *= 1.7;
          if ((m === T.GRASS || m === T.MEADOW || m === T.FLOWERS) && (g === 124 || g === 92 || g === 47 || g === 34 || g === 119 || g === 87 || g === 118)) {
            // matojos sueltos: cada uno se mece a su ritmo; las rachas llegan en manchas, no en líneas
            const tuft = hash2(wx * 3 + 1, wy * 7 + 2);
            if (tuft > 0.42) {
              const gust = Math.sin(wx * 0.037 + time * 0.55) * Math.sin(wy * 0.071 - time * 0.43 + wx * 0.013);
              const sway = (Math.sin(time * (1.3 + tuft * 1.8) + tuft * 40) * 0.55 + gust * 1.3) * windS;
              if (sway > 0.36) { g = 47; sh *= 1.15; } else if (sway < -0.3) g = 92; else if (sway > -0.05 && sway < 0.08) g = 124;
            }
            // al pasar, la hierba se aparta y se aplasta a tus pies
            if (pl) {
              const pdx = wx - pl.x, pdy = (wy - pl.y) * a;
              if (pdx * pdx + pdy * pdy < (pl.mount ? 22 : 9)) { g = pdx > 0 ? 47 : 92; sh *= 0.78; }
            }
          }
          write(c, sr, g, cr * sh, cg * sh, cb * sh);
          continue;
        }

        // Columna con altura: cara frontal, lateral (por la perspectiva) y tapa
        const southH = wy + 1 < CH ? (tallOf(mat[i + CW], wx, wy + 1) || hgt[i + CW]) : 0;
        const faces = southH < h;
        const hv = hash2(wx, wy);
        const isWall = m === T.CWALL || m === T.TOWER || m === T.CEMWALL;
        const isHouse = m === T.HWALL || m === T.WINDOW;
        const isStair = m === T.WALLSTAIRS;
        const backWall = pb && h > 3 && ((wy / TH) | 0) === pb.y && bg[pb.y * Wt + ((wx / TW) | 0)] === pb.id;
        let prev = 0;
        for (let z = 0; z <= h; z++) {
          const off = z ? lean(wx, z) : 0;
          const x = c + off, y = sr - z;
          if (y < 0) break;
          wspan = z ? Math.max(1, lean(wx + 1, z) - off + 1) : 1;
          if (y < rows) {
            if (z === h) {
              if (isStair) write(x, y, 61, 185, 185, 195);
              else if (backWall) write(x, y, 61, 120, 100, 80);
              else if (isWall && outer) {
                const kk = 0.8 + hv * 0.35;
                if (merlon) write(x, y, hv > 0.5 ? 35 : 37, 205 * kk, 200 * kk, 190 * kk);
                else if (hv > 0.93) write(x, y, 34, 90, 130, 70);                                   // musgo
                else write(x, y, (wx + (wy % 2) * 2) % 5 === 0 ? 124 : 61, 175 * kk, 172 * kk, 165 * kk);
              }
              else if (m === T.CEMWALL) {
                const kk = 0.75 + hv * 0.35;
                if (h >= 8) write(x, y, 94, 200 * kk, 198 * kk, 190 * kk);                                     // remate del pilar
                else if (hv > 0.78) write(x, y, hv > 0.9 ? 34 : 59, 80 * kk, 125 * kk, 65 * kk);                 // musgo e hiedra
                else write(x, y, 61, 170 * kk, 166 * kk, 156 * kk);
              }
              else if (isWall) write(x, y, 61, 190, 190, 200); else write(x, y, g, cr * 1.1, cg * 1.1, cb * 1.1);
            } else if (faces || lean(wx, z + 1) !== off) {
              const f = h - 1 - z;
              if (backWall) { const iw = interiorFace(pb, m, wx, z); write(x, y, iw[0], iw[1], iw[2], iw[3]); }
              else if (isStair) write(x, y, z % 2 ? 95 : 124, 125, 125, 135);
              else if (isWall) {
                const slit = !merlon && wx % 18 === 9 && (f === 4 || f === 5 || f === 6);
                if (slit) write(x, y, 124, 25, 25, 35);
                else { const sf = stoneFace(wx, z, h, (wy / TH) | 0); write(x, y, sf[0], sf[1], sf[2], sf[3]); }
              } else if (isHouse) write(x, y, wx % 4 === 0 ? 124 : 61, cr * 0.6, cg * 0.6, cb * 0.6);
              else if (m === T.HEDGE) { const lk = 0.55 + hash2(wx * 3, wy + z * 7) * 0.4; write(x, y, hash2(wx, z + wy) > 0.5 ? 37 : 38, 50 * lk, 115 * lk, 45 * lk); }
              else {
                const kk = (0.62 - 0.35 * f / h) * (0.8 + hv * 0.4);
                const ch = hash2(wx, wy * 13 + z) > 0.6 ? 124 : hash2(wx * 3, z) > 0.5 ? 33 : 58;
                write(x, y, ch, cr * kk, cg * kk, cb * kk);
              }
            }
            // cara lateral que deja ver la perspectiva
            if (z && off !== prev) {
              wspan = 1;
              const a1 = Math.min(off, prev), a2 = Math.max(off, prev);
              const sk = isWall ? 0.5 : 0.4;
              for (let xx = a1; xx <= a2; xx++) if (xx !== off) {
                if (isWall) { const sf = stoneFace(wx + xx, z, h, ((wy / TH) | 0) + 7); write(c + xx, y, sf[0], sf[1] * 0.6, sf[2] * 0.6, sf[3] * 0.6); }
                else write(c + xx, y, 58, cr * sk, cg * sk, cb * sk);
              }
            }
          }
          prev = off;
        }
        wspan = 1;
      }
      if (terr.rockRows[wy]) for (const rk of terr.rockRows[wy]) if (rk.x > c0 - 8 && rk.x < c0 + cols + 8) drawRock(rk, c0, r0);
      if (terr.graveRows && terr.graveRows[wy]) for (const gv of terr.graveRows[wy]) if (gv.x > c0 - 8 && gv.x < c0 + cols + 8) drawGrave(gv, c0, r0);
      if (terr.tallRows && terr.tallRows[wy]) for (const cl of terr.tallRows[wy]) if (cl.x > c0 - 4 && cl.x < c0 + cols + 4) drawTallGrass(cl, c0, r0, pl);
      if (treeRows[wy]) for (const tr of treeRows[wy]) if (tr.x > c0 - 12 && tr.x < c0 + cols + 12) drawTree(tr, c0, r0);
    }
    const bk = buckets[k];
    if (bk) for (const fn of bk) fn();
  }

  // Silueta del caballero cuando algo lo tapa
  for (const pc of playerCells) {
    if (d[pc.o] === pc.g) continue;
    d[pc.o] = pc.g; d[pc.o + 1] = 70; d[pc.o + 2] = 120; d[pc.o + 3] = 210;
  }
}

// Árboles de distintos tipos (roble, roble grande, abedul, arbusto, seco, sauce, pino y ciprés),
// inclinados por la perspectiva y mecidos por el viento
const TREE_LOOK = {
  oak:     { th: 3, ryk: 1.15, ramp: '.:;=+*#%@', dark: [8, 35, 10],  light: [110, 190, 70] },
  bigoak:  { th: 4, ryk: 1.2,  ramp: '.:;=+*#%@', dark: [6, 30, 8],   light: [95, 175, 60] },
  birch:   { th: 6, ryk: 1.5,  ramp: '.:;oO0@',   dark: [40, 70, 20], light: [175, 220, 95] },
  bush:    { th: 0, ryk: 0.9,  ramp: '.:;%#&@',   dark: [6, 32, 12],  light: [80, 160, 70] },
  willow:  { th: 4, ryk: 1.0,  ramp: '.:;"~%#',   dark: [20, 50, 20], light: [120, 185, 90] },
  pine:    { th: 2, ryk: 1.7,  ramp: '.:;^^AA#',  dark: [5, 30, 22],  light: [70, 150, 100] },
  cypress: { th: 1, ryk: 3.2,  ramp: '.:;!|#%',   dark: [6, 34, 18],  light: [55, 125, 75] },
  dead:    { th: 6, ryk: 0,    ramp: '',          dark: [0, 0, 0],    light: [0, 0, 0] },
  ancient: { th: 11, ryk: 1.25, ramp: '.:;=+*#%@', dark: [5, 28, 12],  light: [100, 185, 80] },
};

function drawTree(tr, c0, r0) {
  const look = TREE_LOOK[tr.type] || TREE_LOOK[tr.pine ? 'pine' : 'oak'];
  const L = lightInto(tr.x, tr.base);
  const l0 = L[0], l1 = L[1], l2 = L[2];
  const th = Math.max(0, Math.round(look.th * (tr.hk || 1)));
  const tx = Math.round(tr.x);
  if (state === 'play' && player && !world.under && player.moving && !player.onWall &&
      Math.abs(player.x - tr.x) < tr.rx * 0.9 + 1 && Math.abs(player.y - tr.base) < 2.5) {
    if (time - (tr.shakeAt ?? -9) > 0.9) {                       // ¡zas! hojas que caen y un susurro de ramas
      for (let k = 0; k < 4 + tr.rx; k++) particles.push({ x: tr.x + (Math.random() - 0.5) * tr.rx * 2, y: tr.base - th - tr.ry * look.ryk * Math.random() * 1.5,
        vx: (Math.random() - 0.5) * 6, vy: 1 + Math.random() * 2, g: 5, life: 1 + Math.random() * 0.8, max: 1.8, float: true,
        ch: "',`"[(Math.random() * 3) | 0], c: tr.type === 'dead' ? [130, 110, 80] : look.light });
      Sfx.rustle();
    }
    tr.shakeAt = time;
  }
  const shk = Math.max(0, 1 - (time - (tr.shakeAt ?? -9)) / 0.9);
  const dapple = !world.under && daylight() > 0.6;
  const jig = shk > 0 ? Math.round(Math.sin(time * 32 + tr.x) * 1.6 * shk) : 0;
  const put = (x, y, code, r, g, b) => R.put(x - c0, y - r0, code, r * l0, g * l1, b * l2);
  const sway = windAt(tr.x, tr.base) * (0.7 + 0.6 * hash2(tr.base, tx)) * Math.sin(windT * 2.2 + tr.x * 0.31 + tr.base * 0.17);

  // Tronco
  for (let z = 0; z <= th; z++) {
    const o = lean(tr.x, z) + Math.round(sway * 0.8 * z / Math.max(1, th + 4));
    if (tr.type === 'birch') {
      const mark = hash2(tx, z * 3 + tr.base) > 0.65;
      put(tx + o, tr.base - z, mark ? 61 : 124, mark ? 40 : 225, mark ? 40 : 225, mark ? 40 : 215);
    } else if (tr.type === 'ancient') {
      const wz = Math.max(3, 5 - Math.floor(z / 4));                            // más ancho en la base (raíces)
      for (let dx = -wz; dx <= wz; dx++) {
        const edge = Math.abs(dx) === wz, rune = !edge && dx === 1 && z % 3 === 1 && z > 1;
        const k = 0.55 + 0.35 * hash2(tx + dx, z) - (edge ? 0.2 : 0);
        if (rune) put(tx + dx + o, tr.base - z, 42, 100, 255 * (0.6 + 0.4 * Math.sin(time * 2 + z)), 130);
        else put(tx + dx + o, tr.base - z, edge ? (dx < 0 ? 40 : 41) : hash2(dx, z + tx) > 0.5 ? 124 : 35, 120 * k, 85 * k, 50 * k);
      }
    } else if (tr.type === 'dead') put(tx + o, tr.base - z, 124, 120, 100, 80);
    else {
      put(tx + o, tr.base - z, 124, 110, 75, 42);
      if (tr.rx > 4.5) put(tx + 1 + o, tr.base - z, 124, 85, 58, 32);
    }
  }

  // Árbol seco: ramas desnudas
  if (tr.type === 'dead') {
    const topY = tr.base - th, o = lean(tr.x, th) + Math.round(sway * 0.8);
    put(tx + o, topY - 1, 89, 130, 110, 90);                              // Y
    for (let j = 1; j <= 3; j++) {
      put(tx + o - j, topY - 1 - j, 92, 115, 95, 75);                     // rama izquierda
      put(tx + o + j, topY - j, 47, 115, 95, 75);                         // rama derecha
    }
    put(tx + o - 1, tr.base - Math.floor(th / 2), 92, 110, 90, 70);
    put(tx + o + 2, topY - 4, 94, 100, 85, 70);
    return;
  }

  // Copa (o varias copas en el roble grande)
  const ry = tr.ry * look.ryk;
  const cyc = tr.base - th - ry * (tr.type === 'bush' ? 0.7 : 0.85);
  const blobs = tr.type === 'ancient'
    ? [[-tr.rx * 0.45, ry * 0.2, 0.62], [tr.rx * 0.45, ry * 0.15, 0.64], [0, -ry * 0.45, 0.7], [-tr.rx * 0.22, -ry * 0.05, 0.6], [tr.rx * 0.25, -ry * 0.1, 0.58]]
    : tr.type === 'bigoak'
    ? [[-tr.rx * 0.38, ry * 0.15, 0.68], [tr.rx * 0.38, ry * 0.1, 0.7], [0, -ry * 0.45, 0.66]]
    : [[0, 0, 1]];
  const ramp = look.ramp;
  for (const [bx, by, bk] of blobs) {
    const rx2 = tr.rx * bk, ry2 = ry * bk, cx0 = tr.x + bx, cy0 = cyc + by;
    for (let cy = Math.floor(cy0 - ry2); cy <= cy0 + ry2; cy++) {
      const sr = cy - r0;
      if (sr < 0 || sr >= R.rows) continue;
      const o = lean(tr.x, tr.base - cy) + Math.round(sway * 2.4 * clamp01((tr.base - cy - th) / (2 * ry + 1))) + jig;
      for (let cx = Math.floor(cx0 - rx2); cx <= cx0 + rx2; cx++) {
        let dx = (cx + 0.5 - cx0) / rx2;
        const dy = (cy + 0.5 - cy0) / ry2;
        if (tr.type === 'pine') dx /= Math.max(0.15, (dy + 1.1) / 2.1);          // cono
        if (tr.type === 'cypress') dx /= Math.max(0.2, 1 - Math.abs(dy) * 0.35);  // huso
        const leaf = (hash2(cx, cy * 3 + 7) - 0.5) * 0.35;
        const d2 = dx * dx + dy * dy;
        if (d2 > 1 + leaf) continue;
        const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, d2)));
        let lit = clamp01(dx * -0.55 + dy * -0.6 + nz * 0.58 + leaf + (hash2(cx, cy) - 0.5) * 0.25 + 0.14 * Math.sin(windT * 7 + cx * 1.7 + cy * 2.3) * windS
                          + (dapple && sunFleck(cx, cy) > 0.85 ? 0.35 : 0));
        lit = 0.15 + lit * 0.85;
        let code = ramp.charCodeAt(Math.min(ramp.length - 1, Math.floor(lit * ramp.length)));
        let c = lerp3(look.dark, look.light, lit);
        if (tr.type === 'bush' && hash2(cx * 5, cy * 7) > 0.93) { code = 111; c = [210, 40, 50]; }   // bayas
        put(cx + o, cy, code, c[0], c[1], c[2]);
      }
    }
  }

  // Sauce: ramas que cuelgan y se mueven con el viento
  if (tr.type === 'willow') {
    const bottom = cyc + ry * 0.6;
    for (let cx = Math.floor(tr.x - tr.rx * 0.9); cx <= tr.x + tr.rx * 0.9; cx += 2) {
      const len = 2 + Math.floor(hash2(cx, tr.base) * 4);
      for (let j = 0; j < len; j++) {
        const cy = Math.floor(bottom) + j;
        const o = lean(tr.x, tr.base - cy) + Math.round(sway * (1.6 + j * 0.5));
        const k = 0.6 + hash2(cx, j) * 0.4;
        put(cx + o, cy, j === len - 1 ? 39 : (j % 2 ? 59 : 124), 70 * k, 140 * k, 70 * k);
      }
    }
  }
}

// Roca: bloque redondeado con luz del noroeste, musgo arriba y espuma si está en el agua
function drawRock(rk, c0, r0) {
  const L = lightInto(rk.x, rk.base);
  const H = rk.h, cyc = rk.base - H * 0.45, ryv = rk.ry + H * 0.5;
  for (let cy = Math.floor(cyc - ryv); cy <= rk.base; cy++) {
    const sr = cy - r0;
    if (sr < 0 || sr >= R.rows) continue;
    const o = lean(rk.x, Math.max(0, rk.base - cy));
    for (let cx = Math.floor(rk.x - rk.rx); cx <= rk.x + rk.rx; cx++) {
      const dx = (cx + 0.5 - rk.x) / rk.rx, dy = (cy + 0.5 - cyc) / ryv;
      const jag = (hash2(cx * 3, cy * 5) - 0.5) * 0.25;
      const d2 = dx * dx + dy * dy;
      if (d2 > 1 + jag) continue;
      const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, d2)));
      const lit = clamp01(dx * -0.5 + dy * -0.7 + nz * 0.6 + (hash2(cx, cy) - 0.5) * 0.3);
      const ramp = '.:;=+*#%@';
      const code = ramp.charCodeAt(Math.min(ramp.length - 1, Math.floor((0.15 + lit * 0.85) * ramp.length)));
      let c = lerp3([55, 54, 50], [210, 205, 195], lit);
      if (!rk.inWater && dy < -0.35 && hash2(cx * 7, cy) > 0.55) c = lerp3([40, 70, 35], [110, 160, 80], lit);   // musgo
      if (rk.inWater && cy >= rk.base - 1) c = [c[0] * 0.7, c[1] * 0.8, c[2] * 1.0];                           // mojada
      R.put(cx + o - c0, sr, code, c[0] * L[0], c[1] * L[1], c[2] * L[2]);
    }
  }
}

// Mata de hierba alta: hojas que se mecen y que se apartan (y se sacuden) cuando pasas por ellas.
// Lo que dibuja queda marcado para que, si tapa al caballero, lo oculte en vez de pintar su silueta.
let grassMask = null;
function drawTallGrass(cl, c0, r0, pl) {
  const cols = R.cols, rows = R.rows;
  let push = 0;
  if (pl) {
    const dx = cl.x - pl.x, dy = (cl.y - pl.y) * A();
    if (Math.abs(dx) < 4 + (pl.mount ? 3 : 0) && Math.abs(dy) < 3.5) {
      push = dx >= 0 ? 1 : -1;
      if (pl.moving && time - cl.shakeAt > 0.5) { cl.shakeAt = time; if (Math.random() < 0.35) Sfx.rustle(); }
    }
  }
  const shk = Math.max(0, 1 - (time - cl.shakeAt) / 0.7);
  const gust = Math.sin(cl.x * 0.037 + time * 0.55) * Math.sin(cl.y * 0.071 - time * 0.43 + cl.x * 0.013);
  const L = lightInto(cl.x, cl.y);
  for (const b of cl.blades) {
    const sw = (Math.sin(time * 1.6 + cl.ph + b.ph) * 0.45 + gust * 1.1) * windS + push * 1.6 + Math.sin(time * 30 + b.ph) * shk * 0.9;
    for (let z = 0; z < b.h; z++) {
      const u = (z + 1) / b.h;
      const off = Math.round(sw * u * u * 1.4);
      const sx = Math.round(cl.x) + b.dx + off + lean(cl.x, z) - c0, sy = cl.y - z - r0;
      if (sx < 0 || sx >= cols || sy < 0 || sy >= rows) continue;
      const lean2 = sw * u;
      const ch = z === b.h - 1 ? (Math.abs(lean2) < 0.35 ? 39 : lean2 > 0 ? 47 : 92) : (Math.abs(lean2) < 0.45 ? 124 : lean2 > 0 ? 47 : 92);
      const c = z === b.h - 1 ? cl.tip : cl.col, k = 0.65 + 0.45 * u;
      R.put(sx, sy, ch, c[0] * k * L[0], c[1] * k * L[1], c[2] * k * L[2]);
      if (grassMask) grassMask[sy * cols + sx] = 1;
    }
  }
}

// Lápidas, cruces y obeliscos: piedra iluminada desde el noroeste, con musgo, inscripción y velas
const GRAVE_ART = [
  [' .-. ', '(###)', '|RIP|', '[===]'],
  ['  |  ', '-=+=-', '  #  ', ' [#] '],
  null,
  ['  ^  ', ' |#| ', ' |#| ', ' |#| ', '[###]'],
];
function drawGrave(gv, c0, r0) {
  const art = GRAVE_ART[gv.kind];
  const L = lightInto(gv.x, gv.base);
  const H = art.length, mossy = gv.seed > 0.55, worn = gv.seed < 0.15;
  const inscr = gv.kind === 0 ? (gv.seed > 0.5 ? 'RIP' : gv.seed > 0.3 ? '-+-' : '.:.') : null;
  for (let r = 0; r < H; r++) {
    const z = H - 1 - r;
    const sr = gv.base - z - r0;
    if (sr < 0 || sr >= R.rows) continue;
    const o = lean(gv.x, z);
    for (let k = 0; k < 5; k++) {
      let ch = art[r][k];
      if (ch === ' ') continue;
      if (worn && r === 0 && k === 3) continue;                       // piedra desportillada
      let carved = false;
      if (inscr && r === 2 && k >= 1 && k <= 3) { ch = inscr[k - 1]; carved = true; }
      const lit = clamp01(0.75 - (k - 1) * 0.18 + (z / H) * 0.25 + (hash2(gv.tx * 9 + k, r + gv.ty) - 0.5) * 0.2);
      let c = carved ? [60, 58, 55] : lerp3([70, 70, 74], [215, 212, 205], lit);
      if (!carved && ch === '#') ch = lit > 0.7 ? '#' : lit > 0.45 ? '=' : ':';
      if (mossy && !carved && z < H * 0.5 && hash2(gv.tx * 3 + k, r * 7 + gv.ty) > 0.6) { c = lerp3([40, 70, 35], [100, 150, 75], lit); ch = ';'; }
      R.put(Math.round(gv.x) - 2 + k + o - c0, sr, ch.charCodeAt(0), c[0] * L[0], c[1] * L[1], c[2] * L[2]);
    }
  }
  if (gv.candle) {                                                     // vela encendida al pie
    const sr = gv.base + 1 - r0, sc = Math.round(gv.x) + 2 - c0;
    const fl = 0.75 + 0.25 * Math.sin(time * 9 + gv.seed * 40);
    R.put(sc, sr, 105, 235, 225, 200);
    R.put(sc, sr - 1, 39, 255 * fl, 200 * fl, 90 * fl);
  }
}

// Sillares de la muralla: hiladas de bloques de tamaño irregular, musgo, hiedra y grietas
const _SF = [0, 0, 0, 0];
function stoneFace(wx, z, h, seed) {
  const course = z >> 1;
  const bw = 3 + ((hash2(course, seed) * 4) | 0);
  const xo = wx + ((hash2(course * 3 + 1, seed) * 7) | 0);
  const bi = Math.floor(xo / bw), bx = xo - bi * bw;
  const hb = hash2(bi * 5 + seed, course);
  let ch, r = 152, g = 148, b = 140, k = 0.7 + hb * 0.4;
  if (bx === 0) { ch = '|'; k *= 0.45; }
  else if ((z & 1) === 0) { ch = '_'; k *= 0.6; }
  else ch = hb > 0.75 ? '%' : hb > 0.4 ? '#' : '=';
  if (hb > 0.88) { r = 110; g = 132; b = 90; }          // piedra con musgo
  else if (hb < 0.08) { r = 155; g = 132; b = 108; }    // piedra más cálida
  if (z < 3 && hash2(wx, z + 40) > 0.45) { ch = z === 0 ? '"' : ';'; r = 70; g = 118; b = 55; k = 0.85; }
  const ivy = hash2(wx >> 1, seed + 99);
  if (ivy > 0.9 && z > h - (ivy - 0.9) * 10 * h) {      // hiedra que cuelga desde arriba
    ch = hash2(wx, z) > 0.5 ? '%' : ';'; r = 62; g = 138; b = 62; k = 0.7 + hash2(wx * 3, z) * 0.4;
  }
  if (hash2(wx * 3 + 7, z * 5 + seed) > 0.985) { ch = '/'; k *= 0.4; }   // grietas
  k *= 0.62 + 0.38 * (z / h);                           // más oscuro abajo
  _SF[0] = ch.charCodeAt(0); _SF[1] = r * k; _SF[2] = g * k; _SF[3] = b * k;
  return _SF;
}

// Cara interior de la pared del fondo: zócalo, vigas, ventanas y decoración
const _IF = [0, 0, 0, 0];
function interiorFace(b, m, wx, z) {
  const tlx = wx % TW, fz = z % FLOOR_H;
  let ch = '.', c = [190, 170, 135];
  if (b.roof === 'slate') { ch = ((wx + (z & 1) * 2) & 3) === 0 ? '|' : '_'; c = [135, 135, 145]; }
  else if (b.roof === 'thatch') { ch = z % 2 ? '=' : '-'; c = [135, 92, 52]; }
  else if (tlx === 0) { ch = '|'; c = [110, 70, 40]; }
  if (z === 0 || fz === 0) { ch = z === 0 ? '_' : '='; c = [105, 70, 40]; }
  else if (fz === FLOOR_H - 1) { ch = '='; c = [115, 76, 44]; }
  else if (m === T.WINDOW && fz >= 4 && fz <= 6 && tlx >= 1 && tlx <= 4) {
    ch = tlx === 1 ? '[' : tlx === 4 ? ']' : fz === 5 ? '=' : '#';
    c = tlx === 1 || tlx === 4 ? [110, 75, 45] : (isNight() ? [40, 50, 90] : [140, 190, 235]);
  } else if (b.name === 'Palacio real' && wx % 30 >= 12 && wx % 30 <= 13 && fz >= 2 && fz <= 8) {
    ch = fz === 5 ? '*' : '#'; c = fz === 5 ? [255, 210, 80] : [175, 30, 40];      // estandartes
  } else if (b.roof === 'red' && (wx * 7 + b.id) % 23 === 0 && fz === 5) { ch = 'o'; c = [200, 170, 90]; }   // platos colgados
  _IF[0] = ch.charCodeAt(0); _IF[1] = c[0]; _IF[2] = c[1]; _IF[3] = c[2];
  return _IF;
}

// Fachadas: material de la pared según el tipo de tejado
function wallLook(b, cx, z, hs) {
  const tlx = cx % TW;
  if (b.style === 'fachwerk') {     // entramado alemán: yeso blanco con vigas oscuras y cruces de San Andrés
    const fz = z % FLOOR_H, tcol = Math.floor(cx / TW);
    const beam = [72, 46, 28];
    if (tlx === 0 || fz === 0 || fz === FLOOR_H - 1) return [tlx === 0 ? '|' : '=', beam];
    if (tcol % 2 === 0 && fz >= 1 && fz <= FLOOR_H - 2) {
      const d = Math.round((fz - 1) * 4 / (FLOOR_H - 3));
      if (tlx === 1 + d) return ['\\', beam];
      if (tlx === 5 - d) return ['/', beam];
    }
    return [hs > 0.75 ? ':' : '.', [225, 215, 190]];
  }
  if (b.style === 'witch') {
    if (tlx === 0) return ['|', [60, 45, 32]];
    const hb = hash2(cx, z * 7 + b.id);
    if (hb > 0.9) return [' ', [10, 10, 10]];                                  // tablón roto
    if (hb > 0.75 && z < 4) return ['%', [60, 110, 50]];                        // musgo
    return [(cx & 1) ? '|' : ':', (cx & 1) ? [92, 74, 56] : [70, 56, 44]];
  }
  if (b.style === 'mausoleum') {    // mármol claro con columnas acanaladas
    const tcol = cx % 8;
    if (tcol === 0 || tcol === 1) return [tcol === 0 ? '|' : '!', [235, 232, 222]];
    if (z === 0 || z === FLOOR_H - 1) return ['=', [210, 205, 195]];
    return [((cx + (z & 1) * 3) % 5) === 0 ? '|' : z % 2 ? '_' : '.', [185, 182, 175]];
  }
  if (b.style === 'barn') {         // establo: tablones rojos con marco blanco
    if (tlx === 0 || z === 0 || z % FLOOR_H === FLOOR_H - 1) return [tlx === 0 ? '|' : '=', [225, 215, 200]];
    return [(cx & 1) ? '|' : ':', (cx & 1) ? [150, 45, 35] : [120, 35, 28]];
  }
  if (b.style === 'windmill') return [z < 4 ? (((cx + (z & 1) * 2) & 3) === 0 ? '|' : '_') : (tlx === 0 ? '|' : '.'), z < 4 ? [150, 145, 135] : [215, 205, 180]];
  if (b.roof === 'slate' || b.style === 'tower' || b.style === 'church') return [((cx + (z & 1) * 2) & 3) === 0 ? '|' : '_', [150, 150, 160]];
  if (b.roof === 'thatch') return [tlx === 0 ? '|' : (z % 2 ? '=' : '-'), [145, 98, 56]];
  const beam = tlx === 0 || z % FLOOR_H === FLOOR_H - 1 || z % FLOOR_H === 0;
  return beam ? [tlx === 0 ? '|' : '=', [115, 72, 40]] : [hs > 0.7 ? ':' : '.', [205, 190, 155]];
}

// Casa vista desde fuera: lateral, tejado a dos aguas y fachada sur con puerta y ventanas
function drawBuilding3D(b, c0, r0) {
  const cols = R.cols, rows = R.rows;
  const X0 = b.x * TW, Y0 = b.y * TH, w = b.w * TW, h = b.h * TH, X1 = X0 + w - 1, Yb = Y0 + h - 1;
  const hw = bldWallH(b);
  const st = ROOF[b.roof] || ROOF.red;
  const ym = (Y0 + Yb) / 2;
  const night = isNight();
  const put = (x, y, ch, c, L) => {
    const sx = x - c0, sy = y - r0;
    if (sx < 0 || sy < 0 || sx >= cols || sy >= rows) return;
    if (L) R.put(sx, sy, ch.charCodeAt(0), c[0] * L[0], c[1] * L[1], c[2] * L[2]);
    else R.put(sx, sy, ch.charCodeAt(0), c[0], c[1], c[2]);
  };

  // Sombra al sureste
  for (let cy = Y0 - Math.floor(hw / 2); cy <= Yb + 1; cy++) for (let cx = X1 + 1; cx < X1 + 6; cx++) R.dim(cx - c0, cy - r0, 0.5);
  for (let cx = X0 + 3; cx <= X1; cx++) { R.dim(cx - c0, Yb + 1 - r0, 0.55); R.dim(cx - c0, Yb + 2 - r0, 0.8); }

  // Pared lateral que mira hacia el centro de la cámara (con hastial bajo el tejado)
  const sideX = (X0 + X1) / 2 < leanCX ? X1 : X0;
  const sideK = sideX === X1 ? 0.55 : 0.8;   // la luz viene del noroeste
  for (let y = Y0; y <= Yb; y++) {
    const zt = Math.floor(roofZAt(b, y));
    const L = lightInto(sideX, y);
    for (let z = 0; z <= zt; z++) {
      const o1 = lean(sideX, z), o0 = z ? lean(sideX, z - 1) : 0;
      const [ch, c] = wallLook(b, y, z, hash2(sideX, y * 7 + z));
      const cc = [c[0] * sideK, c[1] * sideK, c[2] * sideK];
      for (let xx = Math.min(o0, o1); xx <= Math.max(o0, o1); xx++) put(sideX + xx, y - z, ch, cc, L);
    }
  }

  const palace = b.name === 'Palacio real';
  const conical = b.style === 'tower' || b.style === 'windmill';
  // tejado cónico centrado en la planta, a la altura hz
  const cone = (cxc, cyc, hz, rx, height, thatch) => {
    const L = lightInto(cxc, cyc);
    for (let zz = 0; zz <= height; zz++) {
      const r = rx * (1 - zz / (height + 1)), row = cyc - (hz + zz);
      for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
        const edge = Math.abs(dx) >= r - 0.6;
        let ch, k = 0.75 + 0.35 * (1 - (dx + r) / (2 * r + 0.01));
        if (zz === height) ch = '^';
        else if (edge) ch = dx < 0 ? '/' : '\\';
        else ch = thatch ? (hash2(cxc + dx, zz) > 0.5 ? '"' : ';') : (zz % 2 ? '=' : '-');
        const c = thatch ? [200 * k, 165 * k, 85 * k] : [110 * k, 120 * k, 150 * k];
        put(Math.round(cxc + dx) + lean(cxc + dx, hz + zz), row, ch, c, L);
      }
    }
  };
  if (conical) {
    for (let y = Y0; y <= Yb; y++) {           // azotea con almenas
      const L = lightInto((X0 + X1) / 2, y);
      for (let cx = X0; cx <= X1; cx++) {
        const edge = cx <= X0 + 1 || cx >= X1 - 1 || y === Y0 || y === Yb;
        put(cx + lean(cx, hw), y - hw, edge ? ((cx >> 1) % 2 ? 'n' : '_') : '.', edge ? [200, 200, 205] : [100, 98, 104], L);
      }
    }
    cone((X0 + X1) / 2, Math.round(ym), hw, w / 2 + 2, b.style === 'tower' ? 20 : 14, b.style === 'windmill');
  }
  const turret = (tx, ty) => {   // torreón redondo con tejado cónico
    const H = hw + 10, r = 4;
    const L = lightInto(tx, ty);
    for (let z = 0; z <= H + 6; z++) {
      const o = lean(tx, z);
      const rr = z <= H ? r : Math.round(r * (1 - (z - H) / 6.5));
      for (let dx = -rr - (z > H ? 1 : 0); dx <= rr + (z > H ? 1 : 0); dx++) {
        let ch, c;
        if (z > H) { ch = dx < 0 ? '/' : dx > 0 ? '\\' : '^'; c = [95, 105, 140]; if (Math.abs(dx) <= rr) ch = dx < 0 ? '/' : dx > 0 ? '\\' : 'A'; }
        else if (z === H) { ch = dx % 2 ? 'n' : '_'; c = [200, 200, 210]; }
        else { ch = ((dx + (z & 1) * 2) & 3) === 0 ? '|' : '_'; const k = 0.9 - (dx + r) / (2 * r) * 0.45; c = [160 * k, 160 * k, 172 * k]; }
        if (z > H && Math.abs(dx) > rr + 1) continue;
        put(tx + dx + o, ty - z, ch, c, L);
      }
    }
  };
  if (palace) {
    // azotea de piedra con almenas
    for (let y = Y0; y <= Yb; y++) {
      const L = lightInto((X0 + X1) / 2, y);
      for (let cx = X0; cx <= X1; cx++) {
        const edge = cx <= X0 + 1 || cx >= X1 - 1 || y === Y0 || y === Yb;
        const hs = hash2(cx, y);
        const ch = edge ? ((cx >> 1) % 2 ? 'n' : '_') : (hs > 0.6 ? ',' : '.');
        const c = edge ? [205, 205, 215] : [110, 108, 116];
        put(cx + lean(cx, hw), y - hw, ch, c, L);
      }
    }
    turret(X0 + 4, Y0 + 2); turret(X1 - 4, Y0 + 2);
  }
  // Tejado a dos aguas (vertiente norte casi oculta, vertiente sur bien visible)
  let prevRow = -Infinity;
  for (let y = Y0; y <= Yb && !palace && !conical; y++) {
    const z = roofZAt(b, y), zi = Math.round(z);
    const row = y - zi;
    const from = row > prevRow + 1 && prevRow > -Infinity ? prevRow + 1 : row;
    const north = y < ym, ridgeRow = Math.abs(y - ym) < 0.75;
    const L = lightInto((X0 + X1) / 2, y);
    for (let ry = from; ry <= row; ry++) {
      for (let cx = X0; cx <= X1; cx++) {
        const sx0 = cx + lean(cx, zi), sx1 = cx + 1 + lean(cx + 1, zi);
        const hs = hash2(cx, y);
        let ch, c;
        if (ridgeRow) { ch = cx % 2 ? '=' : '#'; c = [st.ridge[0] * 1.6, st.ridge[1] * 1.6, st.ridge[2] * 1.6]; }
        else if (cx === X0) { ch = north ? '/' : '\\'; c = st.dark; }
        else if (cx === X1) { ch = north ? '\\' : '/'; c = st.dark; }
        else {
          const r2 = ry - row + (y - Y0);
          const tileRow = r2 % 2 === 0;
          if (b.roof === 'thatch') ch = hs > 0.55 ? '"' : hs > 0.25 ? "'" : ';';
          else if (b.roof === 'slate') ch = tileRow ? ((cx + (r2 >> 1)) % 3 === 0 ? '|' : '=') : '-';
          else ch = tileRow ? ((cx + (r2 >> 1)) % 2 ? 'n' : 'm') : '_';
          // degradado: más claro junto a la cumbrera, más oscuro hacia el alero
          const t = clamp01(Math.abs(y - ym) / Math.max(1, (Yb - Y0) / 2));
          const k2 = north ? 1.05 : (1.0 - t * 0.35) * (tileRow ? 1 : 0.7);
          c = [st.light[0] * k2, st.light[1] * k2, st.light[2] * k2];
          if (y === Yb) { ch = '_'; c = st.dark; }
        }
        const kk = 0.85 + hs * 0.25;
        for (let sx = sx0; sx < Math.max(sx0 + 1, sx1); sx++) put(sx, ry, ch, [c[0] * kk, c[1] * kk, c[2] * kk], L);
      }
    }
    prevRow = Math.max(prevRow, row);
  }

  // Fachada sur
  const doorSouth = b.door.y === b.y + b.h - 1;
  const glow = 0.8 + 0.2 * Math.sin(time * 5 + b.id);
  const Lf = lightInto((X0 + X1) / 2, Yb);
  for (let z = hw - 1; z >= 0; z--) {
    const y = Yb - z;
    for (let cx = X0; cx <= X1; cx++) {
      const sx0 = cx + lean(cx, z), sx1 = cx + 1 + lean(cx + 1, z);
      const tlx = cx % TW, tcol = Math.floor(cx / TW);
      const hs = hash2(cx, y * 5 + z);
      let [ch, c] = wallLook(b, cx, z, hs);
      let emit = false;
      if (cx === X0 || cx === X1) { ch = '|'; c = [c[0] * 0.6, c[1] * 0.6, c[2] * 0.6]; }
      if (z === hw - 1) { ch = '_'; c = [c[0] * 0.45, c[1] * 0.45, c[2] * 0.45]; }   // sombra del alero
      const fz = z % FLOOR_H;
      const isWinCol = tcol > b.x && tcol < b.x + b.w - 1 && tcol !== b.door.x && (tcol - b.x) % 2 === 1 && tlx >= 1 && tlx <= 4;
      if (b.style === 'church' && isWinCol && z >= 5 && z <= 15) {        // vidrieras ojivales
        ch = z === 15 ? '^' : tlx === 1 || tlx === 4 ? '|' : '#';
        const glass = [[200, 60, 60], [70, 110, 220], [220, 190, 70]][(tcol + (z >> 2)) % 3];
        c = tlx === 1 || tlx === 4 || z === 15 ? [150, 150, 160] : (night && b.hearth ? glass : [glass[0] * 0.7, glass[1] * 0.7, glass[2] * 0.7]);
        emit = night && b.hearth && tlx > 1 && tlx < 4;
      } else if (b.style === 'tower' && tlx >= 2 && tlx <= 3 && tcol === b.x + 2 && fz >= 5 && fz <= 7 && z > 8 && z < hw - 1) {
        ch = '|'; c = night && b.hearth ? [255 * glow, 180 * glow, 70 * glow] : [30, 30, 40];   // aspillera
      } else if (isWinCol && fz >= 5 && fz <= 7 && z < hw - 1 && b.style !== 'church' && b.style !== 'tower') {
        ch = tlx === 1 ? '[' : tlx === 4 ? ']' : fz === 6 ? '=' : '#';
        if (b.style === 'witch') {                                              // ventanas tapiadas con tablones
          ch = tlx === 1 || tlx === 4 ? '|' : fz === 6 ? 'X' : '=';
          c = night && (fz !== 6) && tlx > 1 && tlx < 4 ? [90 * glow, 255 * glow, 110 * glow] : [80, 60, 42];
          emit = night && fz !== 6 && tlx > 1 && tlx < 4;
        } else if (night && windowLit(b)) { c = [255 * glow, 185 * glow, 80 * glow]; emit = tlx > 1 && tlx < 4; }
        else c = tlx === 1 || tlx === 4 ? [110, 75, 45] : [120, 165, 210];
      }
      if (doorSouth && !palace && tcol === b.door.x && z <= 6 && tlx >= 1 && tlx <= 4) {
        if (z === 6) ch = tlx === 1 || tlx === 4 ? '.' : '-';
        else ch = tlx === 1 || tlx === 4 ? '|' : (tlx === 3 && z === 3 ? 'o' : '#');
        c = ch === 'o' ? [220, 190, 90] : [140, 88, 45];
      }
      if (palace) {
        const dxp = cx - (b.door.x * TW + TW / 2);
        const archTop = 10 - Math.round((dxp * dxp) / 14);
        if (Math.abs(dxp) <= 9 && z <= archTop) {      // gran portón en arco
          ch = z === archTop ? (dxp < 0 ? '/' : dxp > 0 ? '\\' : '^') : (Math.abs(dxp) % 3 === 0 ? '|' : '#');
          c = z === archTop ? [190, 190, 200] : [120, 75, 38];
          if (z === 4 && Math.abs(dxp) === 1) { ch = 'o'; c = [230, 200, 90]; }
        }
        const bx = (cx - X0) % 24;
        if ((bx === 6 || bx === 7) && z >= hw - 14 && z <= hw - 3 && Math.abs(dxp) > 11) {   // estandartes
          ch = z === hw - 9 ? '*' : (z === hw - 14 ? 'V' : '#');
          c = z === hw - 9 ? [255, 210, 80] : [185, 30, 40];
        }
      }
      const kk = 0.88 + hs * 0.18;
      for (let sx = sx0; sx < Math.max(sx0 + 1, sx1); sx++) {
        if (emit) put(sx, y, ch, c, null);
        else put(sx, y, ch, [c[0] * kk, c[1] * kk, c[2] * kk], Lf);
      }
    }
  }

  if (palace) { turret(X0 + 4, Yb); turret(X1 - 4, Yb); }
  if (b.style === 'church') {
    // rosetón en lo alto de la fachada
    const rx0 = (X0 + X1) / 2, rz = hw - 5;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.hypot(dx / 2, dy);
      if (d > 2.2) continue;
      const ch = d > 1.6 ? 'O' : d < 0.6 ? '*' : '+';
      const c = d > 1.6 ? [170, 170, 180] : [[220, 70, 70], [80, 120, 230], [230, 200, 80]][(dx + dy + 6) % 3];
      put(Math.round(rx0 + dx) + lean(rx0 + dx, rz + dy), Yb - rz - dy, ch, c, night && b.hearth ? null : Lf);
    }
    // campanario en el extremo oeste, con aguja
    const tx0 = X0, tx1 = X0 + 2 * TW - 1, TH2 = hw + 22;
    const Lt = lightInto(tx0 + 6, Yb);
    for (let z = 0; z <= TH2; z++) for (let cx = tx0; cx <= tx1; cx++) {
      let ch = ((cx + (z & 1) * 2) & 3) === 0 ? '|' : '_', c = [155, 155, 165];
      if (cx === tx0 || cx === tx1) { ch = '|'; c = [110, 110, 120]; }
      if (z > hw + 8 && z < hw + 15 && cx > tx0 + 3 && cx < tx1 - 3) { ch = z === hw + 14 ? '^' : '#'; c = [30, 28, 35]; }   // ventana de las campanas
      if (z === TH2) { ch = (cx >> 1) % 2 ? 'n' : '_'; c = [205, 205, 215]; }
      put(cx + lean(cx, z), Yb - z, ch, c, Lt);
    }
    cone((tx0 + tx1) / 2, Yb, TH2, 7, 18, false);
  }
  if (b.style === 'windmill') {
    // aspas que giran con el viento
    const hx = (X0 + X1) / 2, hz = hw - 3, hy = Yb - hz;
    const ang0 = time * (0.4 + windS * 1.6) + b.id;
    const a = A();
    for (let k = 0; k < 4; k++) {
      const an = ang0 + k * Math.PI / 2, ca = Math.cos(an), sa = Math.sin(an);
      const lc = Math.abs(ca) > Math.abs(sa) * 2.4 ? '-' : Math.abs(sa) > Math.abs(ca) * 2.4 ? '|' : (ca * sa > 0 ? '\\' : '/');
      for (let tt = 1; tt <= 17; tt++) {
        const x = hx + ca * tt, y = hy + sa * tt / a;
        put(Math.round(x) + lean(x, hz), Math.round(y), lc, [120, 85, 50], null);
        if (tt > 4) {    // tela de la vela, a un lado del brazo
          const px = x - sa * 2.2, py = y + ca * 2.2 / a;
          put(Math.round(px) + lean(px, hz), Math.round(py), '#', [215, 205, 180], Lf);
        }
      }
    }
    put(Math.round(hx) + lean(hx, hz), hy, 'O', [150, 110, 60], null);
  }

  // Chimenea sobre el tejado
  if (b.chimney && !palace && !conical) {
    const cy = b.chimney.y * TH + 1, z = Math.round(roofZAt(b, cy));
    const L = lightInto(b.chimney.x * TW + 3, cy);
    for (let dz = 0; dz < 4; dz++) for (let dx = 2; dx <= 4; dx++) {
      const cx = b.chimney.x * TW + dx, zz = z + dz;
      const ch = dz === 3 ? (dx === 3 ? '.' : '#') : (dx === 3 ? '=' : '#');
      put(cx + lean(cx, zz), cy - zz, ch, [130, 118, 112], L);
    }
  }
}

// Casa en la que está el jugador con dos plantas: la planta de arriba se dibuja encima,
// elevada FLOOR_H filas. Desde abajo solo se ven la viga y los pilares; estando arriba
// es sólida y la planta baja se sigue viendo por delante.
function drawUpperFloor(b, c0, r0, upperDraw) {
  const fb = b.floorBake;
  if (!fb) return;
  const cols = R.cols, rows = R.rows;
  const opaque = player.floor >= 1, z = FLOOR_H;
  const X0 = fb.X0, X1 = fb.X0 + fb.w - 1, Yb = fb.Y0 + fb.h - 1;
  // pilares en las esquinas delanteras y viga del forjado
  for (const px of [X0, X1]) for (let zz = 0; zz <= z; zz++) {
    const sx = px + lean(px, zz) - c0, sy = Yb - zz - r0;
    if (sx >= 0 && sy >= 0 && sx < cols && sy < rows) R.put(sx, sy, 124, 120, 80, 45);
  }
  for (let cx = X0; cx <= X1; cx++) {
    const sx = cx + lean(cx, z - 1) - c0, sy = Yb - z + 1 - r0;
    if (sx >= 0 && sy >= 0 && sx < cols && sy < rows) R.put(sx, sy, 61, opaque ? 130 : 80, opaque ? 88 : 55, opaque ? 50 : 30);
  }
  if (!opaque) return;
  for (let cy = fb.Y0; cy <= Yb; cy++) {
    const sy = cy - z - r0;
    if (sy < 1 || sy >= rows) continue;
    for (let cx = X0; cx <= X1; cx++) {
      const sx = cx + lean(cx, z) - c0;
      if (sx < 0 || sx >= cols) continue;
      const j = (cy - fb.Y0) * fb.w + (cx - X0);
      const m = fb.m[j];
      const L = lightInto(cx, cy);
      const cr = fb.c[j * 3] * L[0], cg = fb.c[j * 3 + 1] * L[1], cb = fb.c[j * 3 + 2] * L[2];
      R.put(sx, sy, fb.g[j], cr, cg, cb);
      if (lean(cx + 1, z) - lean(cx, z) > 0) R.put(sx + 1, sy, fb.g[j], cr, cg, cb);
      if (m === T.HWALL || m === T.WINDOW || m === T.CWALL) R.put(sx, sy - 1, fb.g[j], cr * 1.15, cg * 1.15, cb * 1.15);
    }
  }
  for (const fn of upperDraw) fn();
}

// Torre de madera para arqueros: parte trasera (postes de atrás y plataforma) y parte delantera
// (postes, riostras en X, escalera de mano, barandilla y tejado). Se dibujan por separado para
// que el arquero que está encima quede entre ambas.
function watchtowerBack(t, c0, r0) {
  const X0 = t.x * TW, X1 = X0 + t.w * TW - 1, Y0 = t.y * TH, Yb = Y0 + t.h * TH - 1, ph = t.ph;
  const L = lightInto(X0 + 9, Yb);
  const put = (x, y, ch, c) => R.put(x - c0, y - r0, ch.charCodeAt(0), c[0] * L[0], c[1] * L[1], c[2] * L[2]);
  for (const px of [X0 + 1, X1 - 1]) for (let z = 0; z <= ph + WT_ROOF; z++) put(px + lean(px, z), Y0 + 1 - z, '|', [110, 75, 42]);
  for (let cy = Y0; cy <= Yb; cy++) for (let cx = X0; cx <= X1; cx++) {
    const edge = cx === X0 || cx === X1 || cy === Y0;
    put(cx + lean(cx, ph), cy - ph, edge ? '#' : (cx % 3 === 0 ? '|' : '='), edge ? [145, 100, 58] : [175, 128, 78]);
  }
  for (let cx = X0; cx <= X1; cx++) put(cx + lean(cx, ph + 2), Y0 - ph - 2, cx % 3 === 0 ? '+' : '-', [160, 115, 65]);
}

function watchtowerFront(t, c0, r0) {
  const X0 = t.x * TW, X1 = X0 + t.w * TW - 1, Y0 = t.y * TH, Yb = Y0 + t.h * TH - 1, ph = t.ph;
  const L = lightInto(X0 + 9, Yb);
  const put = (x, y, ch, c) => R.put(Math.round(x) - c0, y - r0, ch.charCodeAt(0), c[0] * L[0], c[1] * L[1], c[2] * L[2]);
  const wood = [125, 85, 48];
  // riostras en X entre los postes delanteros
  for (let z = 1; z < ph; z++) {
    const f = z / ph;
    const xa = X0 + 1 + (X1 - X0 - 2) * f, xb = X1 - 1 - (X1 - X0 - 2) * f;
    put(xa + lean(xa, z), Yb - z, '/', [100, 70, 40]);
    put(xb + lean(xb, z), Yb - z, '\\', [100, 70, 40]);
  }
  for (const px of [X0 + 1, X1 - 1]) for (let z = 0; z <= ph + WT_ROOF; z++) put(px + lean(px, z), Yb - z, '|', wood);
  // escalera de mano apoyada en la fachada
  const lx = t.ladder.x * TW + 2;
  for (let z = 0; z <= ph + 1; z++) {
    const y = Yb + 2 - z;
    put(lx + lean(lx, z), y, '|', [150, 105, 60]);
    put(lx + 2 + lean(lx + 2, z), y, '|', [150, 105, 60]);
    if (z % 2 === 0) put(lx + 1 + lean(lx + 1, z), y, '=', [170, 120, 70]);
  }
  // barandilla delantera
  for (let cx = X0; cx <= X1; cx++) put(cx + lean(cx, ph + 2), Yb - ph - 2, cx % 3 === 0 ? '+' : '-', [170, 120, 70]);
  // tejado de paja a cuatro aguas
  const rz = ph + WT_ROOF;
  for (let cy = Y0 - 1; cy <= Yb + 1; cy++) for (let cx = X0 - 2; cx <= X1 + 2; cx++)
    put(cx + lean(cx, rz), cy - rz, cy === Yb + 1 ? '_' : hash2(cx, cy) > 0.5 ? '"' : ';', cy === Yb + 1 ? [130, 100, 50] : [195, 160, 85]);
  const cx0 = (X0 + X1) / 2, half = (X1 - X0) / 2 + 3;
  for (let k = 1; k <= 7; k++) {
    const hwid = half * (1 - k / 8), row = Y0 - rz - k;
    for (let dx = -Math.ceil(hwid); dx <= Math.ceil(hwid); dx++) {
      const edge = Math.abs(dx) >= hwid - 0.6;
      put(cx0 + dx + lean(cx0 + dx, rz + k), row, k === 7 ? '^' : edge ? (dx < 0 ? '/' : '\\') : '"', [205 - k * 6, 170 - k * 6, 90]);
    }
  }
}

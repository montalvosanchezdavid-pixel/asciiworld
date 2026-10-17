'use strict';
// Convierte el mapa de casillas en un mundo a resolución de carácter:
// cada casilla son TW x TH caracteres con textura, sombreado y árboles.

const TW = 6, TH = 3;
const C = s => s.charCodeAt(0);

function lerp3(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const ramp = (str, v) => C(str[Math.min(str.length - 1, Math.max(0, Math.floor(v * str.length)))]);

// Tipo de tumba por casilla: 0 lápida, 1 cruz, 2 losa, 3 obelisco
const graveKind = (tx, ty) => { const r = hash2(tx * 7, ty * 13); return r < 0.42 ? 0 : r < 0.72 ? 1 : r < 0.86 ? 2 : 3; };

function bakeTerrain(world) {
  const CW = world.W * TW, CH = world.H * TH;
  const N = CW * CH;
  const glyph = new Uint8Array(N);
  const col = new Uint8Array(N * 3);
  const mat = new Uint8Array(N);
  const water = new Uint8Array(N);   // 0 = no, 1 = agua, 2 = orilla
  const hgt = new Uint8Array(N);     // altura en filas (montañas) para la vista 3/4
  const phase = new Uint8Array(N);   // fase aleatoria para animar el agua
  const rng = new RNG(world.seed + 7);
  const nJx = makeNoise(rng), nJy = makeNoise(rng), nTex = makeNoise(rng), nH = makeNoise(rng), nDetail = makeNoise(rng);

  const natural = new Set([T.DEEP, T.WATER, T.LAKE, T.SAND, T.GRASS, T.MEADOW, T.FLOWERS, T.FOREST, T.PINE, T.HILL, T.MOUNTAIN, T.SNOW]);
  const tileAt = (tx, ty) => world.get(Math.floor(tx), Math.floor(ty));

  // 1) Material de cada carácter (bordes orgánicos con ruido)
  for (let cy = 0; cy < CH; cy++) for (let cx = 0; cx < CW; cx++) {
    const tx = (cx + 0.5) / TW, ty = (cy + 0.5) / TH;
    let t = tileAt(tx, ty);
    if (natural.has(t) || t === T.ROAD) {
      const jx = (fbm(nJx, cx * 0.06, cy * 0.11, 3) - 0.5) * 1.6;
      const jy = (fbm(nJy, cx * 0.06, cy * 0.11, 3) - 0.5) * 1.6;
      if (t === T.ROAD) {                          // el camino se come o cede un poco de borde
        const t3 = tileAt(tx + jx * 0.45, ty + jy * 0.45);
        if (natural.has(t3) && t3 !== T.DEEP && t3 !== T.WATER && t3 !== T.LAKE) t = t3;
      } else {
        const t2 = tileAt(tx + jx, ty + jy);
        if (natural.has(t2)) t = t2;
        if (tileAt(tx + jx * 0.45, ty + jy * 0.45) === T.ROAD && t !== T.WATER && t !== T.DEEP && t !== T.LAKE) t = T.ROAD;
      }
    }
    mat[cy * CW + cx] = t;
  }

  const height = (cx, cy) => fbm(nH, cx * 0.045, cy * 0.08, 5);
  const set = (i, ch, c) => { glyph[i] = ch; col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]; };
  const scale = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  const isMat = (cx, cy, ts) => cx >= 0 && cy >= 0 && cx < CW && cy < CH && ts.includes(mat[cy * CW + cx]);

  // 2) Textura base de cada material (función reutilizada para las plantas superiores)
  let wflag = 0, hflag = 0;
  const ART = {
    [T.BED]:         ['[~~~~]', '|####|', "'----'"],
    [T.TABLE]:       [' ____ ', '|____|', ' |  | '],
    [T.BARREL]:      [' .--. ', '|====|', " '--' "],
    [T.HEARTH]:      ['#^^^^#', '#)**(#', '######'],
    [T.SHELF]:       ['|=|=|=', '|o|#|o', '------'],
    [T.STAIRS_UP]:   ['   _|^', ' _|   ', '_|    '],
    [T.STAIRS_DOWN]: ['_     ', '_|_   ', '   |_v'],
    [T.STALL]:       ['/^^^^\\', '|[oo]|', '|____|'],
    [T.SARCO]:       ['/====\\', '|+  +|', '\\====/'],
    [T.CRYPT_DOWN]:  ['#====#', '#::::#', '#....#'],
    [T.CRYPT_UP]:    ['======', '------', '______'],
    [T.LADDER]:      ['  |=| ', '  |=| ', '  |=| '],
    [T.CAMPFIRE]:    [' .  . ', '(\\##/)', " '--' "],
    [T.LOG]:         ['      ', '(====)', " '  ' "],
    [T.CAULDRON]:    [' ,~., ', '(@@@@)', " '--' "],
  };
  const artColor = (t, ch, lx, ly, h) => {
    switch (t) {
      case T.BED: return ly === 0 ? [230, 225, 210] : ch === '#' ? [175, 45, 50] : [140, 95, 55];
      case T.TABLE: return [160, 112, 65];
      case T.BARREL: return ch === '=' ? [130, 130, 140] : [150, 100, 52];
      case T.HEARTH: return '^*()'.includes(ch) ? (ch === '*' ? [255, 230, 120] : [255, 130, 40]) : [125, 120, 115];
      case T.SHELF: return ch === 'o' ? [[200, 60, 60], [80, 160, 220], [220, 200, 80]][(lx + ly) % 3] : [135, 92, 50];
      case T.STAIRS_UP: case T.STAIRS_DOWN: return '^v'.includes(ch) ? [255, 230, 120] : [185, 160, 120];
      case T.STALL: return ly === 0 ? (lx % 2 ? [235, 235, 225] : [210, 50, 45]) : ch === 'o' ? [240, 150, 40] : [140, 95, 55];
      case T.SARCO: return ch === '+' ? [200, 170, 90] : [155, 150, 140];
      case T.CRYPT_DOWN: return ch === '#' ? [150, 145, 135] : ch === '=' ? [120, 110, 95] : [45, 40, 36];
      case T.CRYPT_UP: return ly === 0 ? [215, 208, 190] : ly === 1 ? [160, 152, 138] : [105, 98, 88];
      case T.LADDER: return [150, 105, 60];
      case T.CAMPFIRE: return ch === '#' ? [70, 60, 55] : ch === '.' ? [140, 135, 125] : [120, 80, 45];
      case T.LOG: return ch === '=' ? [140, 95, 52] : [100, 66, 36];
      case T.CAULDRON: return ch === '@' ? [120, 255, 110] : ch === '~' || ch === ',' || ch === '.' ? [170, 255, 160] : [70, 70, 75];
    }
    return [150, 150, 150];
  };
  const shadeCell = (t, cx, cy, i, set, isMat) => {
    const h = hash2(cx, cy);
    const v = clamp01((fbm(nTex, cx * 0.09, cy * 0.16, 3) - 0.25) * 2);
    const lx = cx % TW, ly = cy % TH;
    switch (t) {
      case T.DEEP: case T.WATER: case T.LAKE: {
        wflag = 1;
        set(i, C('~'), t === T.DEEP ? [20, 50, 120] : [40, 90, 170]);
        break;
      }
      case T.GRASS: case T.MEADOW: case T.FLOWERS: {
        const vv = clamp01(v * 0.75 + h * 0.35);
        const dark = t === T.MEADOW ? [30, 60, 15] : [18, 52, 16];
        const light = t === T.MEADOW ? [120, 170, 55] : [80, 165, 60];
        let c = scale(lerp3(dark, light, vv), 0.85 + h * 0.3);
        let ch = ramp(t === T.MEADOW ? '.,;:\'""wwW' : '.,,;:\'"|/\\v', vv);
        if (t === T.FLOWERS && h > 0.8) {
          ch = C(h > 0.93 ? '@' : h > 0.86 ? '*' : 'o');
          c = [[240, 200, 60], [230, 110, 170], [240, 240, 240], [170, 120, 240]][(h * 1000 | 0) % 4];
        } else if (h > 0.996) { ch = C('*'); c = [230, 210, 90]; }
        set(i, ch, c);
        break;
      }
      case T.FOREST: case T.PINE: {
        const vv = clamp01(v * 0.6 + h * 0.4);
        set(i, ramp('.,,:;"', vv), lerp3([10, 30, 10], [40, 85, 30], vv));
        break;
      }
      case T.SAND: {
        const vv = clamp01(v * 0.6 + h * 0.4);
        set(i, ramp('..,,:;', vv), lerp3([120, 100, 60], [215, 195, 135], vv));
        break;
      }
      case T.HILL: {
        const vv = clamp01(v * 0.7 + h * 0.3);
        let ch = ramp('.,:;nnmm', vv);
        let c = lerp3([55, 60, 30], [150, 140, 80], vv);
        if (h > 0.97) { ch = C('o'); c = [130, 125, 115]; }
        set(i, ch, c);
        break;
      }
      case T.MOUNTAIN: case T.SNOW: {
        const k = 1.0;
        const gx = (height(cx + 1, cy) - height(cx - 1, cy)) * 9;
        const gy = (height(cx, cy + 1) - height(cx, cy - 1)) * 9 * 0.6;
        const lit = clamp01(0.55 - gx * 1.6 - gy * 1.8 + (h - 0.5) * 0.25);
        const snowy = t === T.SNOW || height(cx, cy) > 0.66;
        let ch;
        const g = Math.hypot(gx, gy);
        if (g < 0.08) ch = h > 0.5 ? C('^') : C('.');
        else if (Math.abs(gx) > Math.abs(gy) * 1.5) ch = gx > 0 ? C('\\') : C('/');
        else ch = ramp(':;=#%', lit);
        const c = snowy ? lerp3([90, 100, 130], [245, 248, 255], lit) : lerp3([45, 38, 32], [195, 180, 160], lit * k);
        set(i, ch, c);
        hflag = 3 + Math.round(clamp01((height(cx, cy) - 0.3) * 2.4) * (t === T.SNOW ? 11 : 8));
        break;
      }
      case T.ROAD: {
        const vv = clamp01(v * 0.5 + h * 0.5);
        let ch = ramp('..,:;', vv), c = lerp3([85, 65, 40], [175, 145, 100], vv);
        if (h > 0.95) { ch = C('o'); c = [140, 130, 120]; }
        set(i, ch, c);
        break;
      }
      case T.BRIDGE: {
        const plank = (cx + (cy >> 1)) % 5 === 0;
        set(i, plank ? C('|') : C('='), scale([150, 100, 55], 0.75 + h * 0.4));
        break;
      }
      case T.CWALL: case T.TOWER: {
        const top = !isMat(cx, cy - 1, [T.CWALL]);
        const brick = ((cx + (cy & 1) * 2) & 3) === 0;
        const c = scale([150, 150, 160], 0.7 + h * 0.4 + (top ? 0.35 : 0));
        set(i, top ? C(cx % 3 === 0 ? 'n' : '=') : brick ? C('|') : C('_'), c);
        break;
      }
      case T.CFLOOR: {
        const edge = lx === 0 || ly === 0;
        set(i, edge ? C(lx === 0 && ly === 0 ? '+' : lx === 0 ? '|' : '-') : ramp('..,:', h),
          scale(edge ? [70, 68, 72] : [95, 92, 88], 0.7 + h * 0.35));
        break;
      }
      case T.CARPET: {
        const border = lx === 0 || lx === TW - 1;
        if (border) set(i, C(':'), [210, 170, 60]);
        else set(i, C((cx + cy) % 3 === 0 ? 'x' : '%'), scale([180, 30, 40], 0.8 + h * 0.3));
        break;
      }
      case T.GATE: case T.DOOR: {
        set(i, lx % 2 ? C('|') : C('#'), scale([150, 95, 45], 0.8 + h * 0.3));
        break;
      }
      case T.HWALL: {
        const top = !isMat(cx, cy - 1, [T.HWALL]);
        set(i, top ? C('^') : (cx % 4 === 0 ? C('|') : C('=')), scale(top ? [190, 80, 50] : [150, 100, 55], 0.75 + h * 0.35));
        break;
      }
      case T.HFLOOR: {
        set(i, (cx + Math.floor(cy * 3.7)) % 7 === 0 ? C('|') : C('-'), scale([110, 75, 42], 0.65 + h * 0.35));
        break;
      }
      case T.WELL: {
        const inner = ly === 1 && lx >= 2 && lx <= 3;
        if (inner) { wflag = 1; set(i, C('~'), [60, 110, 200]); }
        else set(i, C(ly === 1 ? '|' : 'o'), [150, 150, 160]);
        break;
      }
      case T.PLAZA: {
        set(i, h > 0.85 ? C('o') : h > 0.45 ? C('.') : C(','), scale([140, 126, 104], 0.5 + h * 0.35));
        break;
      }
      case T.CAVE: case T.BONES: {
        if (t === T.BONES && h > 0.6) set(i, C(h > 0.85 ? '%' : h > 0.7 ? 'x' : '~'), [215, 205, 180]);
        else set(i, ramp('.,,:;', clamp01(v * 0.6 + h * 0.4)), lerp3([45, 30, 25], [110, 80, 60], v));
        break;
      }
      case T.WALLSTAIRS: {
        set(i, ly === 2 ? C('_') : lx === 0 || lx === TW - 1 ? C('|') : C('='), scale([175, 175, 185], 0.8 + h * 0.25));
        break;
      }
      case T.ROCK: {
        set(i, C(h > 0.5 ? ':' : '.'), scale([70, 68, 62], 0.8 + h * 0.3));
        break;
      }
      case T.FIELD: {
        if (ly === 1) set(i, h > 0.5 ? C('=') : C('~'), scale([125, 85, 45], 0.75 + h * 0.4));
        else set(i, h > 0.6 ? C(',') : C('.'), scale([80, 52, 30], 0.7 + h * 0.4));
        break;
      }
      case T.FENCE: {
        const horiz = isMat(cx - TW, cy, [T.FENCE]) || isMat(cx + TW, cy, [T.FENCE]);
        const vert = isMat(cx, cy - TH, [T.FENCE]) || isMat(cx, cy + TH, [T.FENCE]);
        let ch = 0;
        if (horiz && ly === 1) ch = lx % 3 === 0 ? C('+') : C('-');
        if (vert && (lx === 2)) ch = ly === 1 ? C('+') : C('|');
        if (ch) set(i, ch, scale([165, 115, 65], 0.8 + h * 0.3));
        else shadeCell(T.GRASS, cx, cy, i, set, isMat);
        break;
      }
      case T.RUG: {
        const border = lx === 0 || lx === TW - 1 || ly === 0 || ly === TH - 1;
        if (border) set(i, C(ly === 0 || ly === TH - 1 ? '=' : ':'), [215, 175, 70]);
        else set(i, C((lx + ly) % 2 ? 'x' : '%'), scale([170, 40, 55], 0.85 + h * 0.3));
        break;
      }
      case T.WINDOW: {
        if (ly === 1 && lx >= 1 && lx <= 4) set(i, C(lx === 1 ? '[' : lx === 4 ? ']' : '='), [140, 195, 245]);
        else shadeCell(T.HWALL, cx, cy, i, set, isMat);
        break;
      }
      case T.CRYPTWALL: {
        set(i, ramp('.:;#%', clamp01(v * 0.6 + h * 0.4)), lerp3([28, 25, 22], [88, 80, 72], v));
        break;
      }
      case T.CRYPTFLOOR: {
        if (h > 0.985) { set(i, C(h > 0.993 ? '%' : 'x'), [200, 195, 175]); break; }          // huesos
        const edge = lx === 0 || ly === 0;
        set(i, edge ? C(lx === 0 && ly === 0 ? '+' : lx === 0 ? '|' : '-') : ramp('.,:;', clamp01(v * 0.5 + h * 0.5)),
          scale(edge ? [55, 50, 44] : [100, 90, 76], 0.7 + h * 0.35));
        break;
      }
      case T.GRAVE: {
        const tx = (cx / TW) | 0, ty = (cy / TH) | 0;
        const kind = graveKind(tx, ty);
        if (kind === 2) {                                   // losa tumbada en el suelo
          const ch = [' ____ ', '[####]', "'----'"][ly][lx];
          if (ch === ' ') shadeCell(T.GRASS, cx, cy, i, set, isMat);
          else set(i, C(ch), scale(ch === '#' ? [120, 118, 112] : [175, 172, 165], 0.75 + h * 0.3));
          break;
        }
        if (ly < 2) {                                       // pie de la lápida, en sombra
          set(i, C(lx >= 1 && lx <= 4 ? (ly === 0 ? '_' : ',') : '.'), scale([60, 62, 48], 0.7 + h * 0.4));
          break;
        }
        // montículo de tierra con alguna flor
        const fl = hash2(tx * 31 + lx, ty * 17);
        if (lx >= 1 && lx <= 4) {
          if (fl > 0.8) set(i, C('*'), [[210, 60, 60], [235, 210, 90], [225, 225, 235], [180, 110, 200]][(fl * 97 | 0) % 4]);
          else set(i, C(lx === 1 || lx === 4 ? '~' : '='), scale([110, 82, 52], 0.7 + h * 0.4));
        } else shadeCell(T.GRASS, cx, cy, i, set, isMat);
        break;
      }
      case T.ROOTS: {
        set(i, C('~?&%'[(h * 4) | 0]), scale([105, 75, 45], 0.6 + h * 0.5));
        break;
      }
      case T.HEDGE: {
        set(i, C(h > 0.66 ? '%' : h > 0.33 ? '&' : '#'), lerp3([30, 70, 28], [80, 150, 60], clamp01(v * 0.6 + h * 0.5)));
        break;
      }
      case T.FLOWERBED: {
        const tx = (cx / TW) | 0, ty = (cy / TH) | 0;
        const pal = [[225, 50, 60], [245, 205, 70], [175, 90, 215], [240, 240, 235], [245, 120, 170], [250, 140, 50]];
        const fc = pal[((hash2(tx * 3, ty * 7) * pal.length) | 0) % pal.length];
        if (ly === 2) set(i, C(lx % 2 ? ',' : '"'), scale([60, 120, 50], 0.7 + h * 0.4));            // hojas
        else if ((lx + ly) % 2 === 0) set(i, C(h > 0.6 ? '@' : h > 0.3 ? '*' : 'o'), scale(fc, 0.8 + h * 0.3));
        else set(i, C('.'), scale([70, 48, 28], 0.7 + h * 0.4));                                 // tierra
        break;
      }
      case T.BASIN: {
        set(i, C(ly === 1 ? 'o' : '='), scale([190, 186, 176], 0.8 + h * 0.3));
        break;
      }
      case T.CEMWALL: {
        set(i, C('#'), scale([150, 146, 136], 0.7 + h * 0.3));
        break;
      }
      case T.RAIL: {
        const tx = (cx / TW) | 0, ty = (cy / TH) | 0;
        const isR = (x, y) => world.get(x, y) === T.RAIL;
        const W_ = isR(tx - 1, ty), E_ = isR(tx + 1, ty), N_ = isR(tx, ty - 1), S_ = isR(tx, ty + 1);
        const horiz = (W_ && lx <= 3) || (E_ && lx >= 2) || (!N_ && !S_);
        const vert = (N_ && ly <= 1) || (S_ && ly >= 1) || (!W_ && !E_);
        let ch = 0, c = null;
        if (horiz && ly === 1) { ch = C('='); c = [150, 150, 160]; }
        else if (horiz && (ly === 0 || ly === 2) && lx % 2 === 1) { ch = C(':'); c = [110, 75, 45]; }
        if (vert && (lx === 1 || lx === 4)) { ch = C('|'); c = [150, 150, 160]; }
        else if (vert && !ch && (lx === 2 || lx === 3)) { ch = C('-'); c = [110, 75, 45]; }
        if (ch) set(i, ch, scale(c, 0.8 + h * 0.3));
        else shadeCell(T.CRYPTFLOOR, cx, cy, i, set, isMat);
        break;
      }
      case T.WEB: {
        const k = (lx + ly * 2) % 4;
        set(i, C(k === 0 ? 'x' : k === 1 ? '/' : k === 2 ? '\\' : '-'), scale([205, 205, 220], 0.7 + h * 0.3));
        break;
      }
      case T.BED: case T.TABLE: case T.BARREL: case T.HEARTH: case T.SHELF: case T.STAIRS_UP: case T.STAIRS_DOWN: case T.STALL:
      case T.SARCO: case T.CRYPT_DOWN: case T.CRYPT_UP: case T.LADDER: case T.CAMPFIRE: case T.LOG: case T.CAULDRON: {
        const ch = ART[t][ly][lx];
        if (ch === ' ') shadeCell(t === T.STALL ? T.PLAZA : t === T.SARCO || t === T.CRYPT_UP ? T.CRYPTFLOOR : t === T.LADDER || t === T.CAMPFIRE || t === T.LOG || t === T.CAULDRON ? T.GRASS : T.HFLOOR, cx, cy, i, set, isMat);
        else set(i, C(ch), scale(artColor(t, ch, lx, ly, h), 0.85 + h * 0.25));
        break;
      }
      default: set(i, C('.'), [60, 60, 60]);
    }
  };
  for (let cy = 0; cy < CH; cy++) for (let cx = 0; cx < CW; cx++) {
    const i = cy * CW + cx;
    wflag = 0; hflag = 0;
    shadeCell(mat[i], cx, cy, i, set, isMat);
    if (wflag) { water[i] = 1; phase[i] = (hash2(cx, cy) * 255) | 0; }
    hgt[i] = hflag;
  }

  // 3) Orillas con espuma
  for (let cy = 1; cy < CH - 1; cy++) for (let cx = 1; cx < CW - 1; cx++) {
    const i = cy * CW + cx;
    if (water[i] !== 1 || mat[i] === T.WELL) continue;
    if (!water[i - 1] || !water[i + 1] || !water[i - CW] || !water[i + CW]) water[i] = 2;
  }
  // Profundidad: distancia a la orilla (en pasos), hasta 14
  const wdepth = new Uint8Array(N);
  {
    const q = new Int32Array(N); let qh = 0, qt = 0;
    for (let i = 0; i < N; i++) if (water[i] === 2) { wdepth[i] = 1; q[qt++] = i; }
    while (qh < qt) {
      const i = q[qh++], dv = wdepth[i];
      if (dv >= 14) continue;
      const cx = i % CW;
      for (const j of [i - CW, i + CW, cx > 0 ? i - 1 : -1, cx < CW - 1 ? i + 1 : -1]) {
        if (j < 0 || j >= N || water[j] !== 1 || wdepth[j]) continue;
        wdepth[j] = dv + (j === i - 1 || j === i + 1 ? 0.5 : 1) + 1 | 0; q[qt++] = j;
      }
    }
    for (let i = 0; i < N; i++) if (water[i] === 1 && !wdepth[i]) wdepth[i] = 14;
  }
  // Charcos: sobre todo en caminos y prados del campo (pocos en pueblos), de formas irregulares
  // (varias manchas fundidas) y de tres tamaños: pequeños, medianos y alguna charca grande
  const puddle = new Uint8Array(N);
  const puddles = [];
  if (!world.under) for (let ty = 1; ty < world.H - 1; ty++) for (let tx = 1; tx < world.W - 1; tx++) {
    const t = world.get(tx, ty);
    let p = t === T.ROAD ? 0.988 : t === T.GRASS || t === T.MEADOW ? 0.9975 : t === T.PLAZA ? 0.997 : 2;
    if (world.isSafe(tx, ty)) p = 1 - (1 - p) * 0.15;                      // en los pueblos, muy pocos
    if (hash2(tx * 5 + 3, ty * 11 + 1) < p) continue;
    const sz = hash2(tx * 9, ty * 4), u = hash2(ty, tx), v = hash2(tx * 3, ty);
    const [rx, ry] = sz < 0.68 ? [2.5 + u * 2, 1.3 + v * 0.9] : sz < 0.94 ? [5 + u * 3.5, 2.4 + v * 1.4] : [11 + u * 7, 4.2 + v * 2.5];
    const cx = tx * TW + TW / 2 + (u - 0.5) * 3, cy = ty * TH + TH / 2;
    const blobs = [{ x: cx, y: cy, rx, ry }];
    const nb = 1 + ((hash2(tx * 7, ty * 13) * 3) | 0);
    for (let b = 0; b < nb; b++) {
      const a = hash2(tx + b * 17, ty * 5) * Math.PI * 2, f = 0.45 + hash2(tx * b + 3, ty) * 0.35;
      blobs.push({ x: cx + Math.cos(a) * rx * 0.65, y: cy + Math.sin(a) * ry * 0.6, rx: rx * f, ry: ry * (f + 0.1) });
    }
    puddles.push({ x: cx, y: cy, rx, ry, big: sz >= 0.94 });
    const X0 = Math.floor(cx - rx * 1.8), X1 = Math.ceil(cx + rx * 1.8), Y0 = Math.floor(cy - ry * 1.8), Y1 = Math.ceil(cy + ry * 1.8);
    for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
      if (x < 0 || y < 0 || x >= CW || y >= CH) continue;
      const i = y * CW + x, m = mat[i];
      if (water[i] || !(m === T.ROAD || m === T.PLAZA || m === T.GRASS || m === T.MEADOW || m === T.FLOWERS || m === T.SAND)) continue;
      let d2 = 9;
      for (const bl of blobs) { const dx = (x + 0.5 - bl.x) / bl.rx, dy = (y + 0.5 - bl.y) / bl.ry; d2 = Math.min(d2, dx * dx + dy * dy); }
      d2 += (hash2(x * 3, y * 7) - 0.5) * 0.35;
      if (d2 < 0.75) puddle[i] = 1; else if (d2 < 1.15 && !puddle[i]) puddle[i] = 2;
    }
  }

  // 4) Árboles: copas redondas sombreadas, con sombra proyectada
  const trees = [];
  for (let ty = 0; ty < world.H; ty++) for (let tx = 0; tx < world.W; tx++) {
    const t = world.get(tx, ty);
    let n = 0;
    if (t === T.FOREST) n = rng.chance(0.85) ? rng.int(1, 2) : 0;
    else if (t === T.PINE) n = rng.int(1, 2);
    else if ((t === T.GRASS || t === T.MEADOW) && rng.chance(0.025)) n = 1;
    else if (t === T.HILL && rng.chance(0.04)) n = 1;
    for (let k = 0; k < n; k++) {
      const x = tx * TW + rng.next() * TW, y = ty * TH + rng.next() * TH;
      const m = mat[Math.floor(y) * CW + Math.floor(x)];
      if (!natural.has(m) || m === T.DEEP || m === T.WATER || m === T.LAKE || m === T.MOUNTAIN || m === T.SNOW || m === T.SAND) continue;
      let nearWater = false;
      for (let dy = -2; dy <= 2 && !nearWater; dy++) for (let dx = -2; dx <= 2; dx++) if (world.get(tx + dx, ty + dy) === T.WATER || world.get(tx + dx, ty + dy) === T.LAKE) { nearWater = true; break; }
      const r = rng.next();
      let type;
      const inCem = (world.cemeteries || []).some(cem => tx >= cem.x0 - 2 && tx <= cem.x1 + 2 && ty >= cem.y0 - 2 && ty <= cem.y1 + 2);
      const inGarden = (world.gardens || []).some(g => tx >= g.x0 && tx <= g.x1 && ty >= g.y0 && ty <= g.y1);
      const wt = world.witch, inWitch = wt && tx >= wt.x0 - 4 && tx <= wt.x1 + 4 && ty >= wt.y0 - 3 && ty <= wt.y1 + 3;
      if (inCem) type = r < 0.55 ? 'cypress' : 'dead';
      else if (inWitch) type = r < 0.5 ? 'dead' : r < 0.8 ? 'willow' : 'oak';
      else if (inGarden) type = r < 0.5 ? 'cypress' : 'bush';
      else if (t === T.PINE) type = r < 0.7 ? 'pine' : r < 0.9 ? 'cypress' : 'dead';
      else if (t === T.HILL) type = r < 0.5 ? 'pine' : r < 0.85 ? 'bush' : 'dead';
      else if (nearWater && r < 0.45) type = 'willow';
      else if (t === T.FOREST) type = r < 0.42 ? 'oak' : r < 0.56 ? 'bigoak' : r < 0.72 ? 'birch' : r < 0.95 ? 'bush' : 'dead';
      else type = r < 0.35 ? 'oak' : r < 0.6 ? 'bush' : r < 0.8 ? 'birch' : 'cypress';
      const size = { oak: [3, 3], bigoak: [6, 3], birch: [2, 1.2], bush: [2, 1.6], dead: [2.5, 1.5], willow: [5, 2.5], pine: [2.5, 1.5], cypress: [1.5, 0.8] }[type];
      // tamaños variados: arbolillos jóvenes, adultos y algún gigante viejo
      const age = rng.next();
      const f = type === 'bush' ? 0.7 + rng.next() * 0.6 : age < 0.22 ? 0.5 + rng.next() * 0.25 : age < 0.85 ? 0.85 + rng.next() * 0.35 : 1.35 + rng.next() * 0.45;
      const rx = (size[0] + rng.next() * size[1]) * f;
      trees.push({ x, y, rx, ry: rx / 1.75, pine: type === 'pine', type, hk: 0.55 + 0.55 * f });
    }
  }
  if (world.ancient) trees.push({ x: world.ancient.x * TW + TW / 2, y: world.ancient.y * TH + 2, rx: 12, ry: 12 / 1.75, type: 'ancient', hk: 1 });
  trees.sort((a, b) => a.y - b.y);
  for (const tr of trees) { // sombras
    const sx = tr.x + tr.rx * 0.5, sy = tr.y + tr.ry * 0.7;
    for (let cy = Math.floor(sy - tr.ry); cy <= sy + tr.ry; cy++) for (let cx = Math.floor(sx - tr.rx); cx <= sx + tr.rx; cx++) {
      if (cx < 0 || cy < 0 || cx >= CW || cy >= CH) continue;
      const dx = (cx + 0.5 - sx) / tr.rx, dy = (cy + 0.5 - sy) / tr.ry;
      if (dx * dx + dy * dy > 1) continue;
      const i = cy * CW + cx;
      if (water[i]) continue;
      col[i * 3] *= 0.45; col[i * 3 + 1] *= 0.45; col[i * 3 + 2] *= 0.5;
    }
  }
  // Las montañas que rodean la guarida se rebajan para que la pelea con el dragón se vea
  {
    const lx = world.lair.x * TW + TW / 2, ly = world.lair.y * TH + TH / 2;
    for (let cy = Math.max(0, Math.floor(ly - 40)); cy < Math.min(CH, ly + 40); cy++)
      for (let cx = Math.max(0, Math.floor(lx - 80)); cx < Math.min(CW, lx + 80); cx++) {
        const e = ((cx - lx) / 70) ** 2 + ((cy - ly) / 36) ** 2;
        if (e < 1) { const i = cy * CW + cx; hgt[i] = Math.min(hgt[i], e < 0.5 ? 1 : 3); }
      }
  }

  // Escalinatas de las catacumbas: peldaños que suben hacia el techo
  if (world.under) for (const e of world.cryptEntrances) {
    const top = (e.y - 2) * TH, bot = (e.y + 1) * TH;
    for (let cy = top; cy < bot; cy++) for (let cx = (e.x - 1) * TW; cx < (e.x + 2) * TW; cx++) {
      const i = cy * CW + cx;
      hgt[i] = Math.max(1, Math.round(4 * (bot - cy) / (bot - top)));
      const edge = cx === (e.x - 1) * TW || cx === (e.x + 2) * TW - 1;
      if (edge) { glyph[i] = C('|'); col[i * 3] = 120; col[i * 3 + 1] = 112; col[i * 3 + 2] = 100; }
      else if ((cy - top) % 2 === 0) { glyph[i] = C(cx % 4 === 0 ? '=' : '_'); col[i * 3] = 215; col[i * 3 + 1] = 205; col[i * 3 + 2] = 185; }
      else { glyph[i] = C(cx === e.x * TW + 3 && cy % 3 === 1 ? '^' : '-'); const k = cx === e.x * TW + 3 ? 1.2 : 0.75; col[i * 3] = 170 * k; col[i * 3 + 1] = 160 * k; col[i * 3 + 2] = 140 * k; }
    }
  }

  // Rampa de las escalinatas: sube hasta la altura de la muralla
  for (const st of world.wallStairs) {
    const top = st.top * TH, n = (st.bottom - st.top + 1) * TH;
    for (let cy = top; cy < top + n; cy++) for (let cx = st.x * TW; cx < st.x * TW + TW; cx++)
      hgt[cy * CW + cx] = Math.max(1, Math.round(CASTLE_WALL_H * (1 - (cy - top) / n)));
  }

  const rockRows = new Array(CH).fill(null);
  for (const r0 of world.rocks) {
    const x = r0.x * TW, y = r0.y * TH;
    const rx = r0.inWater ? 1.6 + rng.next() * 2.2 : 1.6 + rng.next() * 3.2, ry = rx / 1.75;
    const rk = { x, y, rx, ry, inWater: r0.inWater, h: Math.max(2, Math.round(ry * 1.3 + rx * 0.35)), base: Math.min(CH - 1, Math.floor(y + ry * 0.6)) };
    for (let cy = Math.floor(y - ry - 1); cy <= y + ry + 1; cy++) for (let cx = Math.floor(x - rx - 2); cx <= x + rx + 2; cx++) {
      if (cx < 0 || cy < 0 || cx >= CW || cy >= CH) continue;
      const dx = (cx + 0.5 - x) / rx, dy = (cy + 0.5 - y) / ry, d2 = dx * dx + dy * dy;
      const i = cy * CW + cx;
      if (d2 <= 1) { mat[i] = T.ROCK; water[i] = 0; glyph[i] = C('.'); col[i * 3] = 60; col[i * 3 + 1] = 58; col[i * 3 + 2] = 54; }
      else if (d2 <= 1.9 && water[i]) water[i] = 2;                       // espuma alrededor
      else if (d2 <= 1.6 && !water[i]) { col[i * 3] *= 0.55; col[i * 3 + 1] *= 0.55; col[i * 3 + 2] *= 0.55; }   // sombra
    }
    (rockRows[rk.base] ||= []).push(rk);
  }

  const graveRows = new Array(CH).fill(null);
  for (let ty = 0; ty < world.H; ty++) for (let tx = 0; tx < world.W; tx++) {
    if (world.get(tx, ty) !== T.GRAVE) continue;
    const kind = graveKind(tx, ty);
    if (kind === 2) continue;
    const gv = { x: tx * TW + TW / 2, base: ty * TH + 1, kind, seed: hash2(tx * 5, ty * 3), tx, ty };
    (graveRows[gv.base] ||= []).push(gv);
  }

  const treeRows = new Array(CH).fill(null);
  for (const tr of trees) {
    tr.base = Math.min(CH - 1, Math.floor(tr.y + tr.ry * 0.6));
    (treeRows[tr.base] ||= []).push(tr);
  }

  // 5) Luces fijas: antorchas del castillo, faroles de las aldeas, braseros de la guarida
  const lights = [];
  const tileCenter = (tx, ty) => ({ x: tx * TW + TW / 2, y: ty * TH + TH / 2 });
  const torch = (tx, ty, color = [1.0, 0.6, 0.25], r = 26, k = 1.1) =>
    lights.push({ ...tileCenter(tx, ty), color, r, k, flicker: rng.next() * 10 });
  for (const [x, y] of world.lamps) torch(x, y, [1.0, 0.65, 0.3], 28, 1.0);
  // velas en algunas tumbas
  for (let cy = 0; cy < CH; cy++) if (graveRows[cy]) for (const gv of graveRows[cy])
    if (gv.seed > 0.72) { gv.candle = true; lights.push({ x: gv.x + 2.5, y: gv.base + 1.5, color: [1.0, 0.68, 0.32], r: 17, k: 1.5, flicker: gv.seed * 10 }); }
  for (const b of world.buildings) {
    torch(b.outside.x, b.outside.y, [1.0, 0.65, 0.3], 18, 0.7);
    if (b.hearth) lights.push({ ...tileCenter(b.hearth.x, b.hearth.y), color: [1.0, 0.5, 0.18], r: 24, k: 1.3, flicker: rng.next() * 10, hearth: true });
  }
  const lr = world.lair;
  if (!world.under) for (const [dx, dy] of [[-4, -3], [4, -3], [-4, 3], [4, 3]]) torch(lr.x + dx, lr.y + dy, [1.0, 0.35, 0.1], 32, 1.3);

  function bakeFloor(b) {
    const w = b.w * TW, h = b.h * TH, X0 = b.x * TW, Y0 = b.y * TH;
    const g = new Uint8Array(w * h), c = new Uint8Array(w * h * 3), m = new Uint8Array(w * h);
    const upAt = (cx, cy) => {
      const tx = Math.floor(cx / TW), ty = Math.floor(cy / TH);
      if (tx < b.x || ty < b.y || tx >= b.x + b.w || ty >= b.y + b.h) return T.HWALL;
      return b.upper[(ty - b.y) * b.w + (tx - b.x)];
    };
    const isM2 = (cx, cy, ts) => ts.includes(upAt(cx, cy));
    const set2 = (i, ch, col2) => { g[i] = ch; c[i * 3] = col2[0]; c[i * 3 + 1] = col2[1]; c[i * 3 + 2] = col2[2]; };
    for (let cy = Y0; cy < Y0 + h; cy++) for (let cx = X0; cx < X0 + w; cx++) {
      const i = (cy - Y0) * w + (cx - X0);
      m[i] = upAt(cx, cy);
      shadeCell(m[i], cx, cy, i, set2, isM2);
    }
    return { g, c, m, w, h, X0, Y0 };
  }
  for (const b of world.buildings) if (b.upper) b.floorBake = bakeFloor(b);

  // Matas de hierba alta: muchas en la hierba alta, menos en la pradera y alguna en el bosque
  const tallRows = new Array(CH).fill(null);
  if (!world.under) for (let ty = 1; ty < world.H - 1; ty++) for (let tx = 1; tx < world.W - 1; tx++) {
    const t = world.get(tx, ty);
    const n = t === T.MEADOW ? 3 : t === T.GRASS ? 1 : t === T.FOREST || t === T.FLOWERS ? 1 : 0;
    for (let k = 0; k < n; k++) {
      const hsh = hash2(tx * 31 + k * 7, ty * 17 + k);
      if (hsh < (t === T.MEADOW ? 0.35 : t === T.GRASS ? 0.82 : 0.7)) continue;
      const x = tx * TW + 0.5 + hash2(tx + k, ty * 5) * (TW - 1), y = Math.floor(ty * TH + hash2(ty + k * 3, tx) * TH);
      const i = y * CW + Math.floor(x);
      if (water[i] || puddle[i] || !(mat[i] === T.GRASS || mat[i] === T.MEADOW || mat[i] === T.FOREST || mat[i] === T.FLOWERS)) continue;
      const blades = [];
      const nb = 2 + ((hash2(x, y * 3) * 4) | 0);
      for (let b = 0; b < nb; b++) blades.push({ dx: b - (nb >> 1) + (hash2(b, x) > 0.5 ? 0 : 0), h: 2 + ((hash2(x * 3 + b, y) * 3) | 0), ph: hash2(b * 7, y) * 6.3 });
      const g = 0.75 + hash2(y, x) * 0.5;
      (tallRows[y] ||= []).push({ x, y, blades, col: [70 * g, 150 * g, 55 * g], tip: hash2(x, y * 7) > 0.7 ? [215, 190, 110] : [140 * g, 200 * g, 90 * g], ph: hash2(x * 5, y) * 30, shakeAt: -9 });
    }
  }

  // Corros de setas luminiscentes en el bosque (brillan de noche)
  const shrooms = [];
  if (!world.under) for (let ty = 2; ty < world.H - 2; ty++) for (let tx = 2; tx < world.W - 2; tx++) {
    const t = world.get(tx, ty);
    if ((t !== T.FOREST && t !== T.PINE) || hash2(tx * 13, ty * 7) < 0.982) continue;
    const pal = [[90, 200, 255], [110, 255, 215], [190, 120, 255], [80, 150, 255]];
    const c = pal[(hash2(tx, ty * 3) * pal.length) | 0];
    const cells = [[0, 0, 111]];
    if (hash2(tx + 1, ty) > 0.3) cells.push([1, 0, 44]);
    if (hash2(tx, ty + 2) > 0.4) cells.push([-1, 0, 46]);
    if (hash2(tx + 3, ty) > 0.5) cells.push([2, -1, 111]);
    shrooms.push({ x: tx * TW + 1 + hash2(tx, ty) * 4, y: ty * TH + 1 + hash2(ty, tx) * 2, c, cells, ph: hash2(tx * 7, ty) * 10 });
  }

  return { CW, CH, glyph, col, mat, water, phase, lights, trees, treeRows, rockRows, graveRows, tallRows, hgt, shrooms, wdepth, puddle, puddles };
}

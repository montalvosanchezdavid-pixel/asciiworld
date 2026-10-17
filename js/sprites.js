'use strict';
// Sprites ASCII multicarácter. Cada sprite mira a la derecha; el izquierdo se genera en espejo.
// "mask" colorea carácter a carácter con letras de la paleta; "chars" colorea por carácter.

const PAL = {
  r: [225, 55, 45], s: [180, 185, 200], d: [40, 40, 60], b: [65, 100, 220], w: [230, 240, 255],
  y: [240, 195, 60], g: [120, 120, 135], n: [220, 175, 140], k: [130, 85, 45], K: [85, 58, 32],
  G: [100, 200, 65], H: [70, 140, 50], e: [255, 225, 60], R: [200, 40, 30], O: [245, 130, 35],
  x: [230, 225, 205], c: [80, 220, 210], p: [160, 80, 200], W: [250, 250, 250], l: [160, 160, 170],
  P: [255, 90, 200], m: [150, 30, 25],
};

const MIRROR = { '/': '\\', '\\': '/', '(': ')', ')': '(', '[': ']', ']': '[', '<': '>', '>': '<', '{': '}', '}': '{', '`': "'", "'": '`' };

function makeSprite(def) {
  const build = (art, mask) => {
    const w = Math.max(...art.map(l => l.length));
    const h = art.length;
    const cells = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ch = art[y][x] || ' ';
      if (ch === ' ') continue;
      const m = mask && mask[y] && mask[y][x] && mask[y][x] !== ' ' ? mask[y][x]
        : (def.chars && def.chars[ch]) || def.color;
      cells.push({ x, y, ch, c: PAL[m] });
    }
    const filled = new Set(cells.map(c => c.x + ',' + c.y));
    const outline = [];
    const seen = new Set();
    for (const c of cells) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const k = (c.x + dx) + ',' + (c.y + dy);
      if (filled.has(k) || seen.has(k)) continue;
      seen.add(k); outline.push({ x: c.x + dx, y: c.y + dy });
    }
    return { w, h, cells, outline };
  };
  const mirror = f => ({
    w: f.w, h: f.h,
    cells: f.cells.map(c => ({ ...c, x: f.w - 1 - c.x, ch: MIRROR[c.ch] || c.ch })),
    outline: f.outline.map(o => ({ x: f.w - 1 - o.x, y: o.y })),
  });
  const frames = def.frames.map((art, i) => build(art, def.masks ? def.masks[i] || def.masks[0] : null));
  return { right: frames, left: frames.map(mirror), idle: def.idle ?? 0, walk: def.walk || [0] };
}

const KNIGHT_TOP = ['  _^_ |', '  [=] |', ' /|#|\\+', '  |#|  '];
const KNIGHT_MASK_TOP = ['  rrr w', '  sds w', ' ssbssy', '  sbs  ', '  g g  '];

const SPR = {
  knight: makeSprite({
    color: 's',
    frames: [
      [...KNIGHT_TOP, '  / \\  '],
      [...KNIGHT_TOP, '  |\\   '],
      [...KNIGHT_TOP, '  / \\  '],
      [...KNIGHT_TOP, '   /|  '],
    ],
    masks: [KNIGHT_MASK_TOP, ['  rrr w', '  sds w', ' ssbssy', '  sbs  ', '  gg   '], KNIGHT_MASK_TOP, ['  rrr w', '  sds w', ' ssbssy', '  sbs  ', '   gg  ']],
    walk: [0, 1, 2, 3],
  }),
  king: makeSprite({
    color: 'R',
    frames: [[' www ', ' (o) ', '/|#|\\', ' |#| ', ' / \\ ']],
    masks: [[' yyy ', ' nnn ', 'RRyRR', ' RyR ', ' g g ']],
  }),
  guard: makeSprite({
    color: 's',
    frames: [[' _n_ |', ' [-] |', '/|#|\\+', ' |#|  ', ' / \\  ']],
    masks: [[' sss w', ' sds w', 'ssbssy', ' sbs  ', ' g g  ']],
  }),
  smith: makeSprite({
    color: 'O',
    frames: [[' ,,,  ', ' (o) T', '/|#|\\|', ' |#|  ', ' / \\  ']],
    masks: [[' KKK  ', ' nnn l', 'nOOOnk', ' OOO  ', ' g g  ']],
  }),
  armorer: makeSprite({
    color: 'l',
    frames: [[' _n_  ', ' [o]  ', '/|#|[]', ' |#|  ', ' / \\  ']],
    masks: [[' lll  ', ' lnl  ', 'llplyy', ' lpl  ', ' g g  ']],
  }),
  healer: makeSprite({
    color: 'c',
    frames: [[' /^\\ ', ' (o) ', '/|+|\\', '/   \\']],
    masks: [[' ccc ', ' cnc ', 'ccWcc', 'c   c']],
  }),
  peasant: makeSprite({
    color: 'k',
    frames: [[' ___ ', ' (o) ', '/|=|\\', ' |_| ', ' / \\ '], [' ___ ', ' (o) ', '/|=|\\', ' |_| ', ' | \\ ']],
    masks: [[' KKK ', ' nnn ', 'nkKkn', ' kKk ', ' g g ']],
    walk: [0, 1],
  }),
  goblin: makeSprite({
    color: 'G',
    frames: [[' ,_, ', '(o.o)', '/)=(\\', ' / \\ '], [' ,_, ', '(o.o)', '/)=(\\', ' |\\  ']],
    masks: [['     ', ' e e ', '  k  ']],
    walk: [0, 1],
  }),
  wolf: makeSprite({
    color: 'l',
    frames: [
      ['     /\\_ ', '~___/ o \\', ' \\____ _/', ' /|  /|  '],
      ['     /\\_ ', '~___/ o \\', ' \\____ _/', ' |\\  |\\  '],
    ],
    masks: [['', '      e  ']],
    walk: [0, 1],
  }),
  bandit: makeSprite({
    color: 'm',
    frames: [[' /^\\  ', ' (-)  ', '/|#|\\-', ' |#|  ', ' / \\  '], [' /^\\  ', ' (-)  ', '/|#|\\-', ' |#|  ', ' | \\  ']],
    masks: [[' KKK  ', ' KnK  ', 'KmmmKW', ' mmm  ', ' K K  ']],
    walk: [0, 1],
  }),
  skeleton: makeSprite({
    color: 'x',
    frames: [[' .-. ', '(x.x)', ' /|\\ ', ' /|\\ ', ' / \\ '], [' .-. ', '(x.x)', ' /|\\ ', ' /|\\ ', ' | \\ ']],
    masks: [['', ' R R ']],
    walk: [0, 1],
  }),
  orc: makeSprite({
    color: 'H',
    frames: [[' _..._ ', '( o o )', '/|=#=|\\', ' |###| ', ' /   \\ '], [' _..._ ', '( o o )', '/|=#=|\\', ' |###| ', ' |   \\ ']],
    masks: [['', '  R R  ', '  kkk  ', '  kkk  ']],
    walk: [0, 1],
  }),
  bear: makeSprite({
    color: 'k',
    frames: [
      [' (\\_/)    ', ' (o o)___ ', ' / ,,    )', ' |_|---|_|'],
      [' (\\_/)    ', ' (o o)___ ', ' / ,,    )', '  |_|-|_| '],
    ],
    masks: [['', '  e e    ', '   KK    ']],
    walk: [0, 1],
  }),
  dragon: makeSprite({
    color: 'R',
    chars: { o: 'e', v: 'W', '#': 'O', '~': 'O' },
    frames: [[
      ' __                          __ ',
      '/  \\___                  ___/  \\',
      '\\      \\___   _.--._   ___/      /',
      ' \\         \\_/ (o  o) \\_/         /',
      '  \\___       \\  \\  /  /       ___/',
      '      \\_______\\  \\/  /_______/',
      '               \\ vvvv /',
      '               /|####|\\',
      '              / |####| \\',
      '                |####|',
      '                 \\##/',
      '                  \\/',
      '                  ~~',
    ], [
      '                                ',
      ' __                          __ ',
      '/  \\___      _.--._      ___/  \\',
      '\\      \\___ / (o  o) \\ ___/      /',
      ' \\___      \\_\\  \\  /  /_/      ___/',
      '     \\_______\\  \\/  /_______/',
      '               \\ vvvv /',
      '               /|####|\\',
      '              / |####| \\',
      '                |####|',
      '                 \\##/',
      '                  \\/',
      '                   ~~',
    ]],
    walk: [0, 1],
  }),
  chest: makeSprite({ color: 'k', chars: { $: 'y' }, frames: [[' ___ ', '[_$_]']] }),
};

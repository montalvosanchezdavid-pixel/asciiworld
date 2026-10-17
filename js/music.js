'use strict';
// Música medieval generada al momento con Web Audio: bordón de quintas, laúd punteado,
// flauta, pandero y campanas. Cambia con el momento: de día una danza en 6/8, de noche
// algo más lento y suave, y en las catacumbas un bordón oscuro con notas sueltas.
// Las melodías se componen en frases que se repiten (A A B A) para que suenen a canción.
// [N] activa o silencia la música.

const Music = (() => {
  const VOL = 0.22;
  let ctx = null, master = null, wet = null, noise = null, timer = null, sfxBus = null;
  let on = true, nextT = 0, bar = 0, mood = '', song = null;
  try { on = localStorage.getItem('asciiworld-music') !== 'off'; } catch (e) {}

  const MODES = { dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], mixolydian: [0, 2, 4, 5, 7, 9, 10] };
  const MOODS = {
    day:   { root: 62, mode: 'dorian', eighth: 0.19, drum: true },
    night: { root: 57, mode: 'dorian', eighth: 0.30, drum: false },
    under: { root: 52, mode: 'phrygian', eighth: 0.42, drum: false },
  };
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  const pick = a => a[(Math.random() * a.length) | 0];

  // ---------------------------------------------------------------- instrumentos
  function env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function out(node, dry = 1, rev = 0.35) {
    const gd = ctx.createGain(); gd.gain.value = dry; node.connect(gd); gd.connect(master);
    const gw = ctx.createGain(); gw.gain.value = rev; node.connect(gw); gw.connect(wet);
  }
  // laúd: cuerda punteada, brillante al principio y apagándose
  function lute(t, m, dur, vol = 0.18) {
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o1.type = 'triangle'; o2.type = 'sawtooth';
    o1.frequency.value = hz(m); o2.frequency.value = hz(m) * 1.003;
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    f.type = 'lowpass'; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(500, t + dur * 1.2);
    o1.connect(f); o2.connect(g2); g2.connect(f); f.connect(g);
    env(g, t, 0.004, vol, dur * 1.6);
    out(g);
    o1.start(t); o2.start(t); o1.stop(t + dur * 1.8); o2.stop(t + dur * 1.8);
  }
  // flauta dulce: seno con vibrato y entrada suave
  function flute(t, m, dur, vol = 0.09) {
    const o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = hz(m);
    lfo.frequency.value = 5.2; lg.gain.value = hz(m) * 0.006;
    lfo.connect(lg); lg.connect(o.frequency);
    const o2 = ctx.createOscillator(), g2 = ctx.createGain();
    o2.type = 'triangle'; o2.frequency.value = hz(m) * 2; g2.gain.value = 0.12;
    o2.connect(g2); g2.connect(g); o.connect(g);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.07);
    g.gain.setValueAtTime(vol * 0.85, t + Math.max(0.08, dur - 0.08));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12);
    out(g, 1, 0.5);
    for (const x of [o, lfo, o2]) { x.start(t); x.stop(t + dur + 0.2); }
  }
  // bordón: quinta grave sostenida, como una zanfona o una gaita lejana
  function drone(t, m, dur, vol = 0.035) {
    for (const [iv, dt] of [[0, 0], [7, 0.002], [-12, 0]]) {
      const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = hz(m + iv) * (1 + dt);
      f.type = 'lowpass'; f.frequency.value = 420;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol * (iv === -12 ? 0.8 : 1), t + 0.6);
      g.gain.setValueAtTime(vol * (iv === -12 ? 0.8 : 1), t + dur - 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.3);
      o.connect(f); f.connect(g); out(g, 1, 0.2);
      o.start(t); o.stop(t + dur + 0.4);
    }
  }
  // pandero: golpe grave de parche y chasquido de sonajas
  function drum(t, strong) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(strong ? 110 : 140, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.15);
    o.connect(g); env(g, t, 0.003, strong ? 0.28 : 0.14, 0.18); out(g, 1, 0.1);
    o.start(t); o.stop(t + 0.25);
    const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), gn = ctx.createGain();
    n.buffer = noise; f.type = 'bandpass'; f.frequency.value = strong ? 2500 : 6000; f.Q.value = 0.8;
    n.connect(f); f.connect(gn); env(gn, t, 0.002, strong ? 0.06 : 0.035, 0.09); out(gn, 1, 0.15);
    n.start(t); n.stop(t + 0.15);
  }
  // campana lejana (catacumbas)
  function bell(t, m, vol = 0.05) {
    for (const [r, k] of [[1, 1], [2.76, 0.4], [5.4, 0.2]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = hz(m) * r;
      o.connect(g); env(g, t, 0.005, vol * k, 3.5 / r); out(g, 0.6, 0.9);
      o.start(t); o.stop(t + 4);
    }
  }

  // ---------------------------------------------------------------- composición
  const RHYTHMS = {
    day:   [[2, 1, 2, 1], [3, 3], [1, 1, 1, 1, 2], [2, 1, 3], [1, 1, 1, 3], [2, 1, 1, 1, 1]],
    night: [[3, 3], [6], [4, 2], [2, 1, 3], [3, 2, 1]],
    under: [[6], [6], [4, 2], [0]],
  };
  function makePhrase(md, start, end) {
    const bars = [];
    let deg = start;
    for (let b = 0; b < 4; b++) {
      const rh = pick(RHYTHMS[md]);
      const notes = [];
      let off = 0;
      for (let k = 0; k < rh.length; k++) {
        const len = rh[k];
        if (len === 0) { off = 6; break; }
        if (b === 3 && k === rh.length - 1) deg = end;                       // la frase cierra en la tónica o la quinta
        else deg = Math.max(-2, Math.min(9, deg + pick([-2, -1, -1, 0, 1, 1, 2, 3, -3])));
        notes.push([off, len, deg]);
        off += len;
      }
      bars.push(notes);
    }
    return bars;
  }
  function newSong(md) {
    const A = makePhrase(md, 0, 4), B = makePhrase(md, 4, 0);
    return { md, parts: [A, A, B, A] };
  }
  const degToMidi = (cfg, deg) => {
    const sc = MODES[cfg.mode], o = Math.floor(deg / 7), d = ((deg % 7) + 7) % 7;
    return cfg.root + sc[d] + 12 * o;
  };

  function scheduleBar(t) {
    const cfg = MOODS[mood], e = cfg.eighth;
    const part = song.parts[Math.floor(bar / 4) % 4], notes = part[bar % 4];
    const phraseBar = bar % 16;
    // bordón cada compás (en catacumbas, más grave)
    drone(t, cfg.root - 12, e * 6 + 0.05, mood === 'under' ? 0.045 : mood === 'night' ? 0.025 : 0.03);
    if (mood === 'day') {
      lute(t, cfg.root - 12, e * 2, 0.14);                                  // bajo en el primer tiempo
      lute(t + e * 3, cfg.root - 5, e * 2, 0.09);
      for (const [off, len, deg] of notes) lute(t + off * e, degToMidi(cfg, deg), len * e, 0.16);
      if (phraseBar >= 8) for (const [off, len, deg] of notes) flute(t + off * e, degToMidi(cfg, deg) + 12, len * e * 0.95, 0.045);
      if (cfg.drum) { drum(t, true); drum(t + e * 3, false); if (Math.random() < 0.5) drum(t + e * 5, false); if (Math.random() < 0.3) drum(t + e * 2, false); }
    } else if (mood === 'night') {
      for (const off of [0, 2, 4]) lute(t + off * e, cfg.root + [0, 7, 12][off / 2], e * 2, 0.06);
      for (const [off, len, deg] of notes) flute(t + off * e, degToMidi(cfg, deg) + 12, len * e * 0.95, 0.075);
    } else {
      for (const [off, len, deg] of notes) if (Math.random() < 0.7) flute(t + off * e, degToMidi(cfg, deg), len * e, 0.05);
      if (bar % 4 === 0 && Math.random() < 0.6) bell(t + e * (1 + ((Math.random() * 4) | 0)), cfg.root + pick([12, 19, 24]));
    }
    bar++;
    if (bar % 16 === 0) song = newSong(mood);                                 // canción nueva cada cuatro frases
  }

  function currentMood() {
    if (typeof world === 'undefined' || !world) return 'day';
    if (world.under) return 'under';
    return (state === 'play' || state === 'intro') && isNight() ? 'night' : 'day';
  }

  function tick() {
    if (!ctx) return;
    const now = ctx.currentTime;
    if (nextT < now) nextT = now + 0.05;
    while (nextT < now + 0.6) {
      const md = currentMood();
      if (md !== mood) { mood = md; bar = 0; song = newSong(md); }
      scheduleBar(nextT);
      nextT += MOODS[mood].eighth * 6;
    }
  }

  function start() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = on ? VOL : 0;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(comp);   // efectos de sonido
    // sala de piedra: eco corto realimentado y filtrado
    wet = ctx.createGain(); wet.gain.value = 1;
    const d1 = ctx.createDelay(1), fb = ctx.createGain(), lp = ctx.createBiquadFilter();
    d1.delayTime.value = 0.27; fb.gain.value = 0.32; lp.type = 'lowpass'; lp.frequency.value = 1800;
    wet.connect(d1); d1.connect(lp); lp.connect(fb); fb.connect(d1);
    const wg = ctx.createGain(); wg.gain.value = 0.5; lp.connect(wg); wg.connect(master);
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
    const ch = noise.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    nextT = ctx.currentTime + 0.15;
    timer = setInterval(tick, 80);
  }

  function toggle() {
    on = !on;
    try { localStorage.setItem('asciiworld-music', on ? 'on' : 'off'); } catch (e) {}
    start();
    if (master) master.gain.setTargetAtTime(on ? VOL : 0, ctx.currentTime, 0.2);
    return on;
  }

  // el navegador solo deja sonar audio tras la primera tecla o clic
  for (const ev of ['keydown', 'pointerdown']) addEventListener(ev, start);

  return { start, toggle, get on() { return on; }, audio: () => (ctx && ctx.state === 'running' ? { ctx, bus: sfxBus, wet, noise } : null) };
})();

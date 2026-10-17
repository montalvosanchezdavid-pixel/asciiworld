'use strict';
// Efectos de sonido sintetizados con Web Audio (comparten el contexto de la música):
// lluvia y truenos, pasos según el suelo, cascos del caballo, espada, flechas y lanzas,
// golpes, monedas, pociones, telarañas, el traqueteo del vagón y el crepitar de la hoguera.
// [V] activa o silencia los efectos.

const Sfx = (() => {
  let on = true, rain = null, rumble = null, stepT = 0, clackT = 0, crackleT = 0, lastLightning = 0;
  try { on = localStorage.getItem('asciiworld-sfx') !== 'off'; } catch (e) {}
  const A_ = () => (on ? Music.audio() : null);

  // ---------------------------------------------------------------- piezas básicas
  function burst(au, t, { f = 2000, q = 1, type = 'bandpass', a = 0.003, d = 0.08, vol = 0.1, sweep = 0, rev = 0.1, pan = 0 }) {
    const { ctx, bus, wet, noise } = au;
    const n = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    n.buffer = noise; n.playbackRate.value = 0.8 + Math.random() * 0.4;
    if (a + d > 0.2) n.loop = true;
    fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (sweep) fl.frequency.exponentialRampToValueAtTime(Math.max(40, f * sweep), t + a + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    n.connect(fl); fl.connect(g);
    let o = g;
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); o = p; }
    o.connect(bus);
    if (rev) { const gw = ctx.createGain(); gw.gain.value = rev; o.connect(gw); gw.connect(wet); }
    n.start(t, Math.random() * 0.2); n.stop(t + a + d + 0.05);
  }
  function tone(au, t, { f = 440, f2 = 0, type = 'sine', a = 0.003, d = 0.1, vol = 0.1, rev = 0.15 }) {
    const { ctx, bus, wet } = au;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    o.connect(g); g.connect(bus);
    if (rev) { const gw = ctx.createGain(); gw.gain.value = rev; g.connect(gw); gw.connect(wet); }
    o.start(t); o.stop(t + a + d + 0.05);
  }
  function loop(au, f, type, q) {
    const { ctx, bus } = au;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate), ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    const n = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    n.buffer = buf; n.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = 0;
    n.connect(fl); fl.connect(g); g.connect(bus); n.start();
    return { g, fl };
  }
  const now = au => au.ctx.currentTime;

  // ---------------------------------------------------------------- efectos
  const play = {
    swing() { const au = A_(); if (!au) return; burst(au, now(au), { f: 700, q: 0.9, a: 0.04, d: 0.16, vol: 0.13, sweep: 4.5 }); },
    hit(crit) {
      const au = A_(); if (!au) return; const t = now(au);
      burst(au, t, { f: 900, q: 0.7, d: 0.09, vol: 0.22, type: 'lowpass' });
      tone(au, t, { f: 140, f2: 60, d: 0.12, vol: 0.22, rev: 0 });
      if (crit) { tone(au, t, { f: 1800, type: 'triangle', d: 0.35, vol: 0.06 }); tone(au, t, { f: 2470, type: 'triangle', d: 0.3, vol: 0.04 }); }
    },
    throw(lance) {
      const au = A_(); if (!au) return; const t = now(au);
      burst(au, t, { f: lance ? 500 : 1200, q: 1.2, a: 0.02, d: lance ? 0.3 : 0.2, vol: 0.11, sweep: lance ? 3 : 2.2 });
      burst(au, t + 0.02, { f: 3000, q: 0.5, d: 0.25, vol: 0.04, type: 'highpass' });              // fuego
      if (!lance) tone(au, t, { f: 220, f2: 110, type: 'triangle', d: 0.08, vol: 0.06, rev: 0 });    // cuerda del arco
    },
    burn() {
      const au = A_(); if (!au) return; const t = now(au);
      tone(au, t, { f: 120, f2: 50, d: 0.18, vol: 0.18, rev: 0.1 });
      for (let k = 0; k < 5; k++) burst(au, t + k * 0.03 + Math.random() * 0.03, { f: 2500 + Math.random() * 2000, q: 2, d: 0.03, vol: 0.05 });
    },
    hurt() {
      const au = A_(); if (!au) return; const t = now(au);
      tone(au, t, { f: 180, f2: 70, type: 'triangle', d: 0.2, vol: 0.18, rev: 0 });
      burst(au, t, { f: 600, q: 1, d: 0.1, vol: 0.12, type: 'lowpass' });
    },
    coin() { const au = A_(); if (!au) return; const t = now(au); tone(au, t, { f: 1318, type: 'triangle', d: 0.12, vol: 0.07 }); tone(au, t + 0.07, { f: 1975, type: 'triangle', d: 0.25, vol: 0.06 }); },
    gulp() { const au = A_(); if (!au) return; const t = now(au); for (let k = 0; k < 3; k++) tone(au, t + k * 0.13, { f: 300 + k * 60, f2: 520 + k * 60, d: 0.07, vol: 0.09, rev: 0 }); },
    eat() { const au = A_(); if (!au) return; const t = now(au); for (let k = 0; k < 3; k++) burst(au, t + k * 0.16, { f: 1800, q: 0.8, d: 0.06, vol: 0.08 }); },
    levelUp() { const au = A_(); if (!au) return; const t = now(au); [0, 4, 7, 12].forEach((s, k) => tone(au, t + k * 0.09, { f: 523 * Math.pow(2, s / 12), type: 'triangle', d: 0.4, vol: 0.07, rev: 0.4 })); },
    tear() { const au = A_(); if (!au) return; const t = now(au); burst(au, t, { f: 4500, q: 0.6, d: 0.12, vol: 0.035, type: 'highpass' }); tone(au, t, { f: 2400, f2: 3600, type: 'sine', d: 0.25, vol: 0.02, rev: 0.6 }); },
    bell() {                                                     // campana de alarma: tres toques
      const au = A_(); if (!au) return; const t = now(au);
      for (let i = 0; i < 3; i++) for (const [r, k] of [[1, 1], [2.4, 0.5], [3.9, 0.25], [5.4, 0.15]])
        tone(au, t + i * 0.7, { f: 392 * r, type: 'sine', a: 0.004, d: 2.2 / r, vol: 0.14 * k, rev: 0.6 });
    },
    crash() {                                                     // se derrumba un tejado en llamas
      const au = A_(); if (!au) return; const t = now(au);
      burst(au, t, { f: 300, q: 0.6, type: 'lowpass', a: 0.01, d: 1.2, vol: 0.35, rev: 0.4 });
      for (let k = 0; k < 8; k++) burst(au, t + 0.05 + Math.random() * 0.5, { f: 1200 + Math.random() * 2500, q: 2, d: 0.04, vol: 0.08 });
    },
    hammer(x, y) {                                                // obras de reconstrucción
      const au = A_(); if (!au) return;
      const d = Math.hypot(x - player.x, (y - player.y) * A()); if (d > 160) return;
      const v = 0.08 * (1 - d / 160), t = now(au);
      tone(au, t, { f: 900, f2: 500, d: 0.05, vol: v, rev: 0.2 }); burst(au, t, { f: 2500, q: 2, d: 0.02, vol: v * 0.6 });
    },
    squeak() {                                                    // chillido de murciélago
      const au = A_(); if (!au) return; const t = now(au);
      for (let k = 0; k < 2; k++) tone(au, t + k * 0.06, { f: 4200 + Math.random() * 1500, f2: 2600, type: 'sine', d: 0.04, vol: 0.025, rev: 0.3 });
    },
    splash(big) {                                                 // pisada en un charco
      const au = A_(); if (!au) return; const t = now(au);
      burst(au, t, { f: 1300, q: 0.8, d: big ? 0.16 : 0.1, vol: big ? 0.12 : 0.08, rev: 0.05 });
      for (let k = 0; k < (big ? 4 : 2); k++) tone(au, t + 0.03 + Math.random() * 0.08, { f: 900 + Math.random() * 900, f2: 1800 + Math.random() * 600, d: 0.04, vol: 0.03, rev: 0.1 });
    },
    rustle() {                                                    // ramas y hojas al rozarlas
      const au = A_(); if (!au) return; const t = now(au);
      for (let k = 0; k < 3; k++) burst(au, t + k * 0.05 + Math.random() * 0.04, { f: 3500 + Math.random() * 2500, q: 0.7, d: 0.08, vol: 0.035, rev: 0.05 });
    },
    thunder() {
      const au = A_(); if (!au) return; const t = now(au) + 0.3 + Math.random() * 1.2;
      burst(au, t, { f: 180, q: 0.5, type: 'lowpass', a: 0.06, d: 2.8, vol: 0.5, sweep: 0.5, rev: 0.4 });
      burst(au, t + 0.25, { f: 90, q: 0.5, type: 'lowpass', a: 0.2, d: 2.2, vol: 0.4, rev: 0.3 });
    },
  };

  // ---------------------------------------------------------------- pasos según el suelo
  const GRASSY = new Set([T.GRASS, T.MEADOW, T.FLOWERS, T.FOREST, T.PINE, T.HILL, T.FIELD, T.FLOWERBED]);
  const WOODEN = new Set([T.HFLOOR, T.BRIDGE, T.DOOR, T.STAIRS_UP, T.STAIRS_DOWN, T.LADDER]);
  const SANDY = new Set([T.SAND, T.CAVE, T.BONES]);
  function footstep(au, m) {
    const t = now(au), pan = (Math.random() - 0.5) * 0.3;
    if (player.mount) {                                                    // galope: ta-ca-tán
      for (const [dt, v] of [[0, 0.07], [0.07, 0.05], [0.15, 0.08]]) {
        tone(au, t + dt, { f: 620, f2: 300, d: 0.05, vol: v, rev: 0.05 });
        burst(au, t + dt, { f: 1500, q: 1, d: 0.025, vol: v * 0.6, pan });
      }
      return;
    }
    if (player.floor > 0 || WOODEN.has(m)) { tone(au, t, { f: 170, f2: 110, d: 0.08, vol: 0.09, rev: 0.05 }); burst(au, t, { f: 900, q: 1.2, d: 0.05, vol: 0.04, pan }); }
    else if (GRASSY.has(m)) {
      burst(au, t, { f: 3200, q: 0.7, d: 0.09, vol: 0.045, pan, rev: 0 });
      burst(au, t + 0.03, { f: 5000, q: 0.8, d: 0.06, vol: 0.025, pan, rev: 0 });
      if ((m === T.FOREST || m === T.PINE) && Math.random() < 0.35)       // ramitas y hojas secas
        for (let k = 0; k < 3; k++) burst(au, t + 0.02 + k * 0.025, { f: 3500 + Math.random() * 2500, q: 3, d: 0.012, vol: 0.05, pan });
    }
    else if (SANDY.has(m)) burst(au, t, { f: 1400, q: 0.5, type: 'lowpass', d: 0.13, vol: 0.06, pan, rev: 0 });
    else { burst(au, t, { f: 1900, q: 1.6, d: 0.04, vol: 0.07, pan, rev: 0.12 }); tone(au, t, { f: 110, f2: 70, d: 0.05, vol: 0.06, rev: 0 }); }   // piedra
  }

  // ---------------------------------------------------------------- sonidos continuos
  function update(dt) {
    const au = A_();
    if (!au) { if (rain) rain.g.gain.value = 0; if (rumble) rumble.g.gain.value = 0; return; }
    const t = now(au), p = player, playing = state === 'play';
    rain ||= loop(au, 2600, 'bandpass', 0.4);
    rumble ||= loop(au, 160, 'lowpass', 0.7);
    // lluvia: más fuerte cuanto más llueve, apagada bajo techo
    const rv = playing && !world.under ? weather.rain * (p.bld ? 0.05 : 0.16) : 0;
    rain.g.gain.setTargetAtTime(rv, t, 0.6);
    rain.fl.frequency.setTargetAtTime(p.bld ? 900 : 2600, t, 0.5);
    if (rv > 0.02 && Math.random() < dt * 25 * weather.rain) burst(au, t + Math.random() * 0.05, { f: 4000 + Math.random() * 3000, q: 4, d: 0.015, vol: 0.02 * weather.rain, pan: Math.random() - 0.5, rev: 0 });
    if (weather.lightning > 0.9 && lastLightning <= 0.9 && playing && !world.under) play.thunder();
    lastLightning = weather.lightning;
    // vagón del tren: traqueteo y chirridos según la velocidad
    const rs = playing && p.riding ? p.riding.spd : 0;
    rumble.g.gain.setTargetAtTime(rs * 0.012, t, 0.3);
    if (rs > 1) {
      clackT -= dt * rs;
      if (clackT <= 0) { clackT = 3; tone(au, t, { f: 300, f2: 180, type: 'square', d: 0.03, vol: 0.03, rev: 0.2 }); tone(au, t + 0.09, { f: 280, f2: 170, type: 'square', d: 0.03, vol: 0.03, rev: 0.2 }); }
    }
    if (!playing) return;
    // pasos
    if (p.moving && !p.riding && !p.onWall) {
      stepT -= dt;
      if (stepT <= 0) { stepT = p.mount ? 0.3 : p.dashT > 0 ? 0.12 : 0.33; footstep(au, matAt(p.x, p.y + 0.5)); }
    } else stepT = 0.05;
    // crepitar de la hoguera si estás cerca de noche
    {
      let best = 999;
      if (typeof campTime === 'function' && campTime()) (world.camps || []).forEach((c, i) => { const f = campFire(i); best = Math.min(best, Math.hypot(f.x - p.x, (f.y - p.y) * A())); });
      for (const b of visibleHouses()) if (b.fire > 0.1) best = Math.min(best, Math.hypot((b.x + b.w / 2) * TW - p.x, ((b.y + b.h / 2) * TH - p.y) * A()) * (1.4 - b.fire * 0.6));
      if (best < 110) {
        crackleT -= dt;
        if (crackleT <= 0) {
          const k = 1 - best / 110;
          crackleT = 0.04 + Math.random() * 0.25;
          burst(au, t, { f: 2000 + Math.random() * 3000, q: 2.5, d: 0.012 + Math.random() * 0.02, vol: 0.06 * k, pan: (Math.random() - 0.5) * 0.4, rev: 0 });
          if (Math.random() < 0.15) burst(au, t, { f: 500, q: 0.7, type: 'lowpass', d: 0.2, vol: 0.05 * k, rev: 0 });
        }
      }
    }
  }

  function toggle() {
    on = !on;
    try { localStorage.setItem('asciiworld-sfx', on ? 'on' : 'off'); } catch (e) {}
    return on;
  }

  return { ...play, update, toggle };
})();

'use strict';
// Controles táctiles para móvil y tableta: joystick a la izquierda, botones de acción a la
// derecha, toques en pantalla para apuntar (torretas, muralla, vagón), pellizco para el zoom,
// botones de pantalla completa y aviso para girar el móvil. Todo se traduce a las mismas
// teclas que usa el juego, así que no hay lógica duplicada.
// Se activa solo en pantallas táctiles (o con ?tactil en la dirección, para probarlo).

const TOUCH = IS_TOUCH;
let touchPad = { left: 0, right: 0 };       // columnas de interfaz que ocupan los controles (para no tapar mensajes)

(function setupTouch() {
  if (!TOUCH) return;
  document.body.classList.add('touch');
  const standalone = window.navigator.standalone || matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
  if (/iPhone|iPad|iPod/.test(navigator.userAgent) && !standalone) document.body.classList.add('ios');
  const press = code => { if (!keys[code]) { keys[code] = true; window.dispatchEvent(new KeyboardEvent('keydown', { code })); } };
  const release = code => { if (keys[code]) { keys[code] = false; window.dispatchEvent(new KeyboardEvent('keyup', { code })); } };
  const tap = code => { press(code); setTimeout(() => release(code), 60); };

  const root = document.createElement('div');
  root.id = 'touch';
  root.innerHTML = `
    <div id="stick"><div id="knob"></div></div>
    <div id="acts">
      <button class="big" data-k="Space">⚔</button>
      <button class="mid b-e" data-k="KeyE">E</button>
      <button class="mid b-dash" data-k="ShiftLeft">»</button>
      <button class="sm b-bag" id="bag" title="Mochila">🎒</button>
    </div>
    <div id="bagmenu" class="pop">
      <button data-k="KeyQ" data-close>♥<small>Poción</small></button>
      <button data-k="KeyR" data-close>🍖<small>Comer</small></button>
      <button data-k="KeyF" data-close>🔥<small>Fuego</small></button>
      <button data-k="KeyM" data-close>🗺<small>Mapa</small></button>
    </div>
    <div id="topbar"><button id="gear" title="Opciones">⚙</button></div>
    <div id="gearmenu" class="pop">
      <button data-k="Minus">−<small>Alejar</small></button>
      <button data-k="Equal">+<small>Acercar</small></button>
      <button data-k="KeyG" data-close>💾<small>Guardar</small></button>
      <button id="fs" data-close>⛶<small>Pantalla</small></button>
      <button data-k="KeyN">♪<small>Música</small></button>
    </div>
    <div id="menu">
      <button id="newgame">Nueva partida</button>
      <button id="cont">Continuar</button>
    </div>
    <button id="skip">Saltar intro ›</button>
    <div id="iostip">Para jugar a pantalla completa: toca <b>Compartir</b> <span>⬆</span> y luego <b>«Añadir a pantalla de inicio»</b>.</div>
    <div id="rotate">Gira el móvil para jugar en horizontal ⟳</div>`;
  document.body.appendChild(root);

  // botones: mientras se pulsan, la tecla está pulsada
  for (const b of root.querySelectorAll('button[data-k]')) {
    const code = b.dataset.k;
    b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); b.classList.add('on'); press(code); });
    const up = e => { e.preventDefault(); b.classList.remove('on'); release(code); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
  }
  // menús desplegables: la mochila y las opciones
  const pops = { bag: root.querySelector('#bagmenu'), gear: root.querySelector('#gearmenu') };
  const toggle = (name) => { for (const k in pops) pops[k].classList.toggle('open', k === name && !pops[k].classList.contains('open')); };
  root.querySelector('#bag').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); toggle('bag'); });
  root.querySelector('#gear').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); toggle('gear'); });
  for (const b of root.querySelectorAll('[data-close]')) b.addEventListener('pointerup', () => setTimeout(() => toggle(null), 80));
  R.canvas.addEventListener('pointerdown', () => toggle(null));
  const goFull = async () => {
    try { if (!document.fullscreenElement && document.documentElement.requestFullscreen) { await document.documentElement.requestFullscreen(); await screen.orientation.lock('landscape'); } }
    catch (err) { /* iPhone y algunos navegadores no lo permiten */ }
  };
  root.querySelector('#newgame').addEventListener('pointerdown', e => { e.preventDefault(); goFull(); tap('Enter'); });
  root.querySelector('#cont').addEventListener('pointerdown', e => { e.preventDefault(); goFull(); tap('KeyC'); });
  root.querySelector('#skip').addEventListener('pointerdown', e => { e.preventDefault(); tap('Escape'); });
  root.querySelector('#fs').addEventListener('pointerdown', async e => {
    e.preventDefault();
    try {
      if (!document.fullscreenElement) { await document.documentElement.requestFullscreen(); await screen.orientation.lock('landscape'); }
      else await document.exitFullscreen();
    } catch (err) { /* no todos los móviles lo permiten */ }
  });

  // joystick: dirección en 8 sectores
  const stick = root.querySelector('#stick'), knob = root.querySelector('#knob');
  let sid = null;
  const DIRS = ['KeyD', 'KeyS', 'KeyA', 'KeyW'];
  const setDir = (dx, dy) => {
    const r = stick.clientWidth / 2, l = Math.hypot(dx, dy), k = Math.min(1, l / r);
    knob.style.transform = `translate(${dx / (l || 1) * k * r * 0.6}px, ${dy / (l || 1) * k * r * 0.6}px)`;
    const want = { KeyD: false, KeyS: false, KeyA: false, KeyW: false };
    if (k > 0.25) {
      const a = Math.atan2(dy, dx), s = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;   // 0 = derecha, 2 = abajo...
      if (s === 7 || s === 0 || s === 1) want.KeyD = true;
      if (s >= 1 && s <= 3) want.KeyS = true;
      if (s >= 3 && s <= 5) want.KeyA = true;
      if (s >= 5 && s <= 7) want.KeyW = true;
    }
    for (const c of DIRS) want[c] ? press(c) : release(c);
  };
  const center = () => { const b = stick.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; };
  stick.addEventListener('pointerdown', e => { e.preventDefault(); sid = e.pointerId; try { stick.setPointerCapture(sid); } catch (err) { /* sin captura */ } const [cx, cy] = center(); setDir(e.clientX - cx, e.clientY - cy); });
  stick.addEventListener('pointermove', e => { if (e.pointerId !== sid) return; const [cx, cy] = center(); setDir(e.clientX - cx, e.clientY - cy); });
  const stickUp = e => { if (e.pointerId !== sid) return; sid = null; setDir(0, 0); knob.style.transform = ''; };
  stick.addEventListener('pointerup', stickUp); stick.addEventListener('pointercancel', stickUp);

  // tocar la pantalla: en menús avanza; en la torreta, la muralla o el vagón, apunta y dispara
  const pts = new Map();
  let pinch0 = 0, font0 = 0;
  R.canvas.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') return;
    e.preventDefault();
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); font0 = fontPx; return; }
    if (state === 'title') return;                                  // ahí mandan los botones del menú
    if (state === 'intro' || state === 'dead' || state === 'win') { tap(state === 'intro' ? 'Space' : 'Enter'); return; }
    if (dialog) { tap('KeyE'); return; }
    if (showMap) { tap('KeyM'); return; }
    if (player && (player.riding || player.onWall)) R.canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: e.clientX, clientY: e.clientY }));
  });
  R.canvas.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2 && pinch0) {                                 // pellizco: zoom del mundo
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const f = Math.round(font0 * d / pinch0);
      if (f !== fontPx) setFont(f);
    }
  });
  const ptUp = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch0 = 0; };
  R.canvas.addEventListener('pointerup', ptUp); R.canvas.addEventListener('pointercancel', ptUp);

  // qué se ve según el momento del juego, y cuánto sitio ocupan los controles
  setInterval(() => {
    document.body.dataset.state = state;
    root.querySelector('#cont').style.display = state === 'title' && readSave() ? '' : 'none';
    const dpr = R.dpr || 1, cw = UI.cw || 8;
    touchPad = { left: Math.ceil(stick.offsetWidth * 1.15 * dpr / cw), right: Math.ceil((root.querySelector('#acts').offsetWidth + 70) * dpr / cw) };
  }, 250);
})();

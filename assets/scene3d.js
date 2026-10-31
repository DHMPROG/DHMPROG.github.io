// 3D du portfolio : terrain low poly façon PS1 (hero), :ascii dans le terminal, :cv2.depth.
// Chargé à la demande par index.html. Si ce module échoue, le site garde ses versions 2D.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = s => document.querySelector(s);
let pal = {};
const listeners = [];
function readPalette() {
  const s = getComputedStyle(document.documentElement), g = n => s.getPropertyValue(n).trim();
  pal = { bg: g('--bg'), panel: g('--panel'), line: g('--line'), fg: g('--fg'), dim: g('--dim'), accent: g('--accent'), accent2: g('--accent2'), third: g('--third') };
  listeners.forEach(f => f());
}
const isLight = () => getComputedStyle(document.documentElement).colorScheme.includes('light');

/* =====================================================================
   1. Terrain de nuit, low poly façon PS1
   ===================================================================== */
const SNAP = { value: new THREE.Vector2(160, 100) };
// Matériau PS1 : sommets accrochés à la grille de pixels + textures en mapping affine (sans correction de perspective)
function ps1(color, { map = null, emissive = 0 } = {}) {
  const m = new THREE.MeshLambertMaterial({ color, map, flatShading: true, emissive: emissive ? color : 0x000000, emissiveIntensity: emissive });
  m.onBeforeCompile = sh => {
    sh.uniforms.uSnap = SNAP;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec2 uSnap;\nvarying float vAff;')
      .replace('#include <fog_vertex>', `#include <fog_vertex>
        vec4 sp = gl_Position; sp.xyz /= sp.w; sp.xy = floor(sp.xy * uSnap + 0.5) / uSnap; sp.xyz *= sp.w; gl_Position = sp;
        vAff = gl_Position.w;
        #ifdef USE_MAP
          vMapUv *= vAff;
        #endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vAff;')
      .replace('#include <map_fragment>', `#ifdef USE_MAP
          vec4 sampledDiffuseColor = texture2D( map, vMapUv / vAff );
          diffuseColor *= sampledDiffuseColor;
        #endif`);
  };
  return m;
}
function pixTex(w, h, paint, repeat = [1, 1]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const rnd = (a, b) => a + Math.random() * (b - a);

// Passe finale : tramage de Bayer 4×4 et couleur 15 bits (5 bits par canal), comme la PS1
const POST = new THREE.ShaderMaterial({
  uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    float bayer(vec2 p){ int x = int(mod(p.x, 4.0)), y = int(mod(p.y, 4.0));
      const float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
      return m[x + y * 4] / 16.0 - 0.5; }
    void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; c = pow(max(c, 0.0), vec3(1.0 / 2.2));
      c = floor(c * 31.0 + bayer(gl_FragCoord.xy) + 0.5) / 31.0; gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0); }`,
  depthTest: false, depthWrite: false,
});

function pitch(canvas, statsEl) {
  const R = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
  R.setPixelRatio(1);
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 80);
  const fog = new THREE.Fog(0x000000, 12, 30); scene.fog = fog;
  const postScene = new THREE.Scene(), postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), POST));
  let rt = null, lowW = 320, lowH = 180;

  const amb = new THREE.AmbientLight(0xffffff, 0.35); scene.add(amb);
  const moon = new THREE.DirectionalLight(0xaab8ff, 0.5); moon.position.set(-6, 10, -4); scene.add(moon);

  const FW = 11, FH = 7;
  // gazon tondu en bandes, avec du bruit de pixels
  const grass = pixTex(32, 32, (x, w, h) => {
    for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) {
      const band = Math.floor(i / 8) % 2, n = Math.random() * 14;
      x.fillStyle = band ? `rgb(${40 + n},${108 + n},${46 + n})` : `rgb(${34 + n},${94 + n},${40 + n})`; x.fillRect(i, j, 1, 1);
    }
  }, [FW / 2.2, FH / 2.2]);
  const field = new THREE.Mesh(new THREE.PlaneGeometry(FW + 2, FH + 2, 6, 4), ps1(0xffffff, { map: grass }));
  field.rotation.x = -Math.PI / 2; scene.add(field);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 40, 8, 6), ps1(0x3a4a34));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; scene.add(ground);
  // lignes
  const lineM = ps1(0xf2f2f2, { emissive: 0.25 }), T = 0.07;
  const seg = (w, d, x, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), lineM); m.position.set(x, 0.01, z); scene.add(m); };
  seg(FW, T, 0, -FH / 2); seg(FW, T, 0, FH / 2); seg(T, FH, -FW / 2, 0); seg(T, FH, FW / 2, 0); seg(T, FH, 0, 0);
  [-1, 1].forEach(s => {
    seg(T, 3.6, s * (FW / 2 - 1.6), 0); seg(1.6, T, s * (FW / 2 - 0.8), -1.8); seg(1.6, T, s * (FW / 2 - 0.8), 1.8);
    const post = (z) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.08), lineM); p.position.set(s * (FW / 2 + 0.05), 0.35, z); scene.add(p); };
    post(-0.7); post(0.7);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.48), lineM); bar.position.set(s * (FW / 2 + 0.05), 0.7, 0); scene.add(bar);
    const net = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.66, 1.4), ps1(0x8a8a8a)); net.position.set(s * (FW / 2 + 0.32), 0.33, 0); scene.add(net);
  });
  const circ = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.08, 14), lineM); circ.rotation.x = -Math.PI / 2; circ.position.y = 0.015; scene.add(circ);
  // gradins avec une foule de pixels
  const crowd = pixTex(64, 8, (x, w, h) => {
    const cols = ['#d94f30', '#3a6fd8', '#f2c14e', '#e8e8e8', '#2f9e6f', '#8a4fd8', '#222'];
    for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) { x.fillStyle = Math.random() < .18 ? '#1a1a1a' : cols[(Math.random() * cols.length) | 0]; x.fillRect(i, j, 1, 1); }
  }, [3, 1]);
  const standMat = ps1(0x5c5f66), crowdMat = ps1(0xffffff, { map: crowd });
  [-1].forEach(s => {
    for (let k = 0; k < 5; k++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(FW + 3, 0.45, 0.8), [standMat, standMat, crowdMat, standMat, s > 0 ? standMat : crowdMat, s > 0 ? crowdMat : standMat]);
      step.position.set(0, 0.22 + k * 0.45, s * (FH / 2 + 1.6 + k * 0.75)); scene.add(step);
    }
  });
  // projecteurs
  const lampMat = ps1(0xfff4c2, { emissive: 1.2 }), poleMat = ps1(0x77787d);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const x = sx * (FW / 2 + 1.6), z = sz * (FH / 2 + 4.6);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 6, 5), poleMat); pole.position.set(x, 3, z); scene.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.18), lampMat); head.position.set(x, 6.1, z); head.lookAt(0, 0, 0); scene.add(head);
    const L = new THREE.PointLight(0xfff1cc, 55, 0, 2); L.position.set(x * 0.7, 6, z * 0.7); scene.add(L);
  });
  // ciel étoilé
  const sg = new THREE.BufferGeometry(), sp = [];
  for (let i = 0; i < 260; i++) { const a = Math.random() * Math.PI * 2, e = rnd(0.12, 0.9); sp.push(Math.cos(a) * 26 * Math.cos(e), 26 * Math.sin(e), Math.sin(a) * 26 * Math.cos(e)); }
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1, sizeAttenuation: false, fog: false })); scene.add(stars);

  // joueurs low poly
  const teamA = ps1(0xff7a45), teamB = ps1(0x5f9dff), benchM = ps1(0x8a8f99), skin = ps1(0xe0b48a), shorts = ps1(0x1e1e24);
  const bodyG = new THREE.BoxGeometry(0.3, 0.38, 0.2), headG = new THREE.BoxGeometry(0.18, 0.18, 0.18), legG = new THREE.BoxGeometry(0.1, 0.26, 0.1);
  const spots = [];
  const formation = [[-5, 0], [-3.6, -2.4], [-3.6, -0.8], [-3.6, 0.8], [-3.6, 2.4], [-2, -2.2], [-2, 0], [-2, 2.2], [-0.8, -1.2], [-0.8, 1.2]];
  for (let i = 0; i < 10; i++) { spots.push([...formation[i], 0]); spots.push([-formation[i][0], -formation[i][1], 1]); }
  const MAXP = 99, players = [];
  for (let i = 0; i < MAXP; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(bodyG, teamA); body.position.y = 0.47; g.add(body);
    const head = new THREE.Mesh(headG, skin); head.position.y = 0.76; g.add(head);
    const l1 = new THREE.Mesh(legG, shorts), l2 = new THREE.Mesh(legG, shorts); l1.position.set(-0.07, 0.14, 0); l2.position.set(0.07, 0.14, 0); g.add(l1, l2);
    g.visible = false; scene.add(g);
    players.push({ g, body, l1, l2, x: 0, z: 0, tx: 0, tz: 0, speed: 3, active: false, bench: false, seed: Math.random() * 10 });
  }
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0), ps1(0xffffff, { emissive: 0.3 })); scene.add(ball);
  let pass = { from: null, to: null, t0: 0, dur: 1 };
  const stats = { req: 0, got: 0, wait: 0, n: 0, running: false };
  let runTok = 0;

  function applyColors() {
    teamA.color.set(pal.accent); teamB.color.set(pal.accent2 || '#5f9dff');
    const light = isLight(); const bg = new THREE.Color(pal.bg);
    scene.background = bg; fog.color.copy(bg);
    fog.near = light ? 9 : 12; fog.far = light ? 26 : 30;
    amb.intensity = light ? 1.1 : 0.35; moon.intensity = light ? 1.4 : 0.5; moon.color.set(light ? 0xfff2dd : 0xaab8ff);
    stars.visible = !light;
  }
  listeners.push(applyColors); applyColors();

  function book(n) {
    n = Math.max(1, Math.min(MAXP, n | 0)); const tok = ++runTok;
    players.forEach(p => { p.active = false; p.g.visible = false; });
    Object.assign(stats, { req: 0, got: 0, wait: 0, n, running: true });
    return new Promise(res => {
      let i = 0;
      const spawn = () => {
        if (tok !== runTok) return;
        const p = players[i]; p.active = true; p.g.visible = true; p.x = rnd(-.6, .6); p.z = FH / 2 + 3.2;
        stats.req++;
        if (stats.got < 20) { const s = spots[stats.got]; p.tx = s[0]; p.tz = s[1]; p.bench = false; p.body.material = s[2] ? teamB : teamA; stats.got++; }
        else { const k = stats.wait++; p.tx = -FW / 2 + 0.8 + (k % 15) * 0.62; p.tz = FH / 2 + 0.6 + Math.floor(k / 15) * 0.5; p.bench = true; p.body.material = benchM; }
        p.speed = rnd(3.2, 4.8);
        if (RM) { p.x = p.tx; p.z = p.tz; }
        i++;
        if (i < n) setTimeout(spawn, RM ? 0 : (n > 40 ? 40 : rnd(70, 160)));
        else setTimeout(() => { if (tok === runTok) { stats.running = false; drawStats(); res({ got: stats.got, req: stats.req, wait: stats.wait }); } }, RM ? 0 : 1800);
        drawStats();
      };
      spawn();
    });
  }
  function drawStats() {
    if (!statsEl || !stats.n) return;
    const en = document.documentElement.lang === 'en';
    statsEl.textContent = (en ? 'requests ' : 'requêtes ') + stats.req + ' · ' + (en ? 'spots ' : 'places ') + stats.got + '/20 · ' + (en ? 'waitlist ' : 'attente ') + stats.wait + ' · ' + (en ? 'overbooked 0' : 'surréservé 0');
    statsEl.classList.toggle('run', stats.running);
  }

  let mx = .5, my = .5, visible = true, W = 0, H = 0;
  addEventListener('pointermove', e => { mx = e.clientX / innerWidth; my = e.clientY / innerHeight; }, { passive: true });
  new IntersectionObserver(es => es.forEach(e => visible = e.isIntersecting), { threshold: 0.01 }).observe(canvas);
  function resize() {
    const r = canvas.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return;
    W = r.width; H = r.height;
    lowH = Math.round(Math.min(220, Math.max(140, H / 4.5))); lowW = Math.round(lowH * W / H);
    R.setSize(lowW, lowH, false);
    rt && rt.dispose(); rt = new THREE.WebGLRenderTarget(lowW, lowH, { magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter });
    POST.uniforms.tDiffuse.value = rt.texture;
    SNAP.value.set(lowW / 2, lowH / 2);
    cam.aspect = W / H; cam.updateProjectionMatrix();
    force = true;
  }
  new ResizeObserver(resize).observe(canvas);
  let force = true, acc = 1;
  function render() { R.setRenderTarget(rt); R.render(scene, cam); R.setRenderTarget(null); R.render(postScene, postCam); }

  function tick(dt, now) {
    if (!rt || (!visible && !force)) return;
    acc += dt; if (acc < 1 / 30 && !force) return; acc = 0; force = false;
    const t = now / 1000, wide = W / H;
    const dist = 14 * Math.max(1, 1.5 / wide), ang = (RM ? 0.35 : 0.35 + Math.sin(t * 0.06) * 0.25) + (mx - .5) * 0.2;
    cam.position.set(Math.sin(ang) * dist * 0.6, dist * 0.78 + (my - .5) * 0.8, Math.cos(ang) * dist * 0.85);
    cam.lookAt(wide > 1.2 ? -1.6 : 0, 0, -0.6);
    const onPitch = [];
    players.forEach(p => {
      if (!p.active) return;
      const wx = p.bench ? 0 : Math.sin(t * 0.7 + p.seed) * 0.3, wz = p.bench ? 0 : Math.cos(t * 0.5 + p.seed * 2) * 0.3;
      const dx = p.tx + wx - p.x, dz = p.tz + wz - p.z, d = Math.hypot(dx, dz), step = Math.min(d, p.speed * dt * (RM ? 0 : 1));
      if (d > 0.001 && !RM) { p.x += dx / d * step; p.z += dz / d * step; p.g.rotation.y = Math.atan2(dx, dz); }
      const run = d > 0.25 && !RM, sw = run ? Math.sin(t * 16 + p.seed) * 0.6 : 0;
      p.l1.rotation.x = sw; p.l2.rotation.x = -sw;
      p.g.position.set(p.x, run ? Math.abs(Math.sin(t * 16 + p.seed)) * 0.05 : 0, p.z);
      if (!p.bench && d < 0.7) onPitch.push(p);
    });
    if (onPitch.length > 1) {
      if (!pass.to || t - pass.t0 > pass.dur) {
        const from = pass.to && onPitch.includes(pass.to) ? pass.to : onPitch[(Math.random() * onPitch.length) | 0];
        let to = from; while (to === from) to = onPitch[(Math.random() * onPitch.length) | 0];
        pass = { from, to, t0: t, dur: 0.6 + Math.hypot(to.x - from.x, to.z - from.z) * 0.12 };
      }
      const k = Math.min(1, (t - pass.t0) / pass.dur), f = pass.from.g.position, g = pass.to.g.position;
      ball.visible = true; ball.position.set(f.x + (g.x - f.x) * k, 0.12 + Math.sin(k * Math.PI) * 0.7, f.z + (g.z - f.z) * k);
      ball.rotation.x += dt * 8;
    } else ball.visible = false;
    render();
  }
  return { tick, book, refresh: () => { force = true; } };
}

/* =====================================================================
   2. :ascii — objets 3D rendus en caractères, dans le terminal
   ===================================================================== */
const RAMP = " .`:-;=+*<>{}[]#%@";
const flat = (c = 0xffffff, e = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.05, emissive: c, emissiveIntensity: e });
function roundedBox(w, h, d, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3, curveSegments: 10 });
  g.center(); return g;
}
const BUILD = {
  name() {
    const g = new THREE.Group(), c = document.createElement('canvas'); c.width = 64; c.height = 20;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.font = '900 17px Arial, sans-serif'; x.textBaseline = 'middle'; x.fillText('AMINE', 1, 11);
    const d = x.getImageData(0, 0, 64, 20).data, pts = []; let maxX = 0;
    for (let yy = 0; yy < 20; yy++) for (let xx = 0; xx < 64; xx++) if (d[(yy * 64 + xx) * 4 + 3] > 128) { pts.push([xx, yy]); maxX = Math.max(maxX, xx); }
    const s = 5.2 / (maxX + 1), im = new THREE.InstancedMesh(new THREE.BoxGeometry(s * .9, s * .9, s * 1.6), flat(), pts.length), m = new THREE.Matrix4();
    pts.forEach(([xx, yy], i) => { m.makeTranslation((xx - maxX / 2) * s, (10 - yy) * s, Math.sin(xx * .35) * s * .6); im.setMatrixAt(i, m); });
    g.add(im); g.userData = { tilt: 0.18, yaw: -0.25, dist: 6.2 }; return g;
  },
  hub() {
    const g = new THREE.Group();
    const screen = new THREE.Mesh(roundedBox(2.6, 1.7, 0.12, 0.12), flat(0x3a3a3a)); screen.position.set(0, 0.35, 0.15); screen.rotation.x = -0.18; g.add(screen);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.05, 0.9, 40), flat(0xbbbbbb)); base.scale.z = .55; base.position.set(0, -0.75, -0.25); g.add(base);
    const tiles = new THREE.Group();
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) { const t = new THREE.Mesh(roundedBox(0.66, 0.56, 0.06, 0.08), flat(0x8a8a8a, 0.05)); t.position.set((c - 1) * 0.76, (0.5 - r) * 0.66, 0.12); tiles.add(t); }
    tiles.position.copy(screen.position); tiles.rotation.copy(screen.rotation); g.add(tiles);
    g.userData = { tilt: 0.08, yaw: -0.35, dist: 5, tick: now => { const k = Math.floor(now / 900) % 6; tiles.children.forEach((t, i) => { t.material.emissiveIntensity = i === k ? 1.2 : 0.05; t.position.z = i === k ? 0.07 : 0.12; }); } };
    return g;
  },
  phone() {
    const g = new THREE.Group(); g.add(new THREE.Mesh(roundedBox(1.25, 2.6, 0.12, 0.2), flat(0x777777)));
    const scr = new THREE.Mesh(roundedBox(1.1, 2.4, 0.02, 0.14), flat(0xffffff, 0.08)); scr.position.z = 0.1; g.add(scr);
    const rows = []; for (let i = 0; i < 4; i++) { const r = new THREE.Mesh(roundedBox(0.9, 0.3, 0.02, 0.06), flat(0xffffff, 0.45)); r.position.set(0, 0.75 - i * 0.42, 0.13); g.add(r); rows.push(r); }
    g.userData = { tilt: 0.1, yaw: -0.4, dist: 4.4, tick: now => { const k = Math.floor(now / 1100) % 4; rows.forEach((r, i) => r.material.emissiveIntensity = i === k ? 1.3 : 0.4); } };
    return g;
  },
  globe() {
    const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.SphereGeometry(1.45, 48, 32), flat(0x5a5a5a)));
    for (let la = -60; la <= 60; la += 30) { const r = 1.46 * Math.cos(la * Math.PI / 180), ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.018, 6, 96), flat(0xbbbbbb, .15)); ring.rotation.x = Math.PI / 2; ring.position.y = 1.46 * Math.sin(la * Math.PI / 180); g.add(ring); }
    for (let lo = 0; lo < 180; lo += 30) { const ring = new THREE.Mesh(new THREE.TorusGeometry(1.46, 0.018, 6, 96), flat(0xbbbbbb, .15)); ring.rotation.y = lo * Math.PI / 180; g.add(ring); }
    const toV = (lat, lon, r = 1.46) => { const p = (90 - lat) * Math.PI / 180, t = (lon + 180) * Math.PI / 180; return new THREE.Vector3(-r * Math.sin(p) * Math.cos(t), r * Math.cos(p), r * Math.sin(p) * Math.sin(t)); };
    const a = toV(45.5, -73.6), b = toV(49.0, 2.55), curve = new THREE.QuadraticBezierCurve3(a, a.clone().add(b).normalize().multiplyScalar(2.25), b);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.035, 8), flat(0xffffff, 1.2)));
    const plane = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 8), flat(0xffffff, 1.6)); g.add(plane);
    const up = new THREE.Vector3(0, 1, 0); g.rotation.y = 1.9;
    g.userData = { tilt: 0.35, yaw: -0.5, dist: 5.2, tick: now => { const t = (now / 4000) % 1; plane.position.copy(curve.getPointAt(t)); plane.quaternion.setFromUnitVectors(up, curve.getTangentAt(t).normalize()); } };
    return g;
  },
  ball() { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .6, flatShading: true }))); g.userData = { tilt: .2, yaw: 0, dist: 5.6 }; return g; },
  knot() { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.TorusKnotGeometry(1.05, 0.34, 180, 24), flat())); g.userData = { tilt: .3, yaw: 0, dist: 6 }; return g; },
};
const ALIAS = { nom: 'name', name: 'name', amine: 'name', hub: 'hub', nest: 'hub', 'nest-deck': 'hub', iphone: 'phone', phone: 'phone', heros: 'phone', globe: 'globe', abdian: 'globe', ballon: 'ball', ball: 'ball', noeud: 'knot', 'nœud': 'knot', knot: 'knot' };
let asciiR = null;
function ascii(pre, which) {
  const key = ALIAS[(which || 'nom').toLowerCase()]; if (!key) return null;
  if (!asciiR) { asciiR = new THREE.WebGLRenderer({ antialias: false }); asciiR.setSize(1, 1, false); }
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0);
  scene.add(new THREE.AmbientLight(0xffffff, 0.18));
  const keyL = new THREE.DirectionalLight(0xffffff, 2.0); keyL.position.set(2.5, 2, 4); scene.add(keyL);
  const rim = new THREE.DirectionalLight(0xffffff, 0.7); rim.position.set(-3, -1, -2); scene.add(rim);
  const pivot = new THREE.Group(); scene.add(pivot);
  const obj = BUILD[key](), u = obj.userData; pivot.add(obj);
  const cam = new THREE.PerspectiveCamera(38, 1, 0.1, 100); cam.position.set(0, 0, (u.dist || 5.4) * 0.8);
  const tgt = { x: u.tilt || 0, y: u.yaw || 0 }; pivot.rotation.set(tgt.x, tgt.y, 0);
  // taille de la grille de caractères
  const saved = [pre.style.fontSize, pre.style.lineHeight]; pre.style.fontSize = '9px'; pre.style.lineHeight = '1.1';
  const cs = getComputedStyle(pre), c2 = document.createElement('canvas').getContext('2d');
  c2.font = cs.fontSize + ' ' + cs.fontFamily; const cw = c2.measureText('M').width;
  const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.6;
  const cols = Math.max(24, Math.floor((pre.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) / cw) - 1);
  const rows = Math.max(18, Math.min(40, Math.floor((pre.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) / lh) - 3, Math.round(cols * cw / lh * 0.62)));
  const rt = new THREE.WebGLRenderTarget(cols, rows), buf = new Uint8Array(cols * rows * 4);
  cam.aspect = (cols * cw) / (rows * lh); cam.updateProjectionMatrix();
  let drag = null, shake = 0, alive = true, last = performance.now(), acc = 1, mx = .5, my = .4;
  const down = e => { drag = { x: e.clientX, y: e.clientY, rx: tgt.x, ry: tgt.y, moved: false }; };
  const move = e => { const r = pre.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width; my = (e.clientY - r.top) / r.height;
    if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true;
    tgt.y = drag.ry + dx * 0.01; tgt.x = Math.max(-1, Math.min(1, drag.rx + dy * 0.008)); };
  const up = () => { if (drag && !drag.moved) shake = 0.6; drag = null; };
  pre.addEventListener('pointerdown', down); addEventListener('pointermove', move); addEventListener('pointerup', up);
  pre.style.cursor = 'grab'; pre.style.touchAction = 'none';
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const head = '<span class="p">$ </span>ascii ' + esc(which || 'nom') + '\n';
  const foot = '\n<span class="c">' + (document.documentElement.lang === 'en' ? 'drag to rotate · click to shake · esc to quit' : 'glisse pour tourner · clique pour secouer · échap pour quitter') + '</span>';
  (function frame(now) {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!RM && !drag) tgt.y += dt * 0.45;
    pivot.rotation.x += (tgt.x - pivot.rotation.x) * 0.12; pivot.rotation.y += (tgt.y - pivot.rotation.y) * 0.12;
    keyL.position.set((mx - .5) * 9, (.5 - my) * 7, 4); shake = Math.max(0, shake - dt * 1.8);
    u.tick && u.tick(now);
    acc += dt;
    if (acc >= 1 / 24) {
      acc = 0;
      asciiR.setRenderTarget(rt); asciiR.render(scene, cam); asciiR.setRenderTarget(null);
      asciiR.readRenderTargetPixels(rt, 0, 0, cols, rows, buf);
      const n = RAMP.length - 1; let out = '';
      for (let y = 0; y < rows; y++) {
        const src = (rows - 1 - y) * cols * 4; let cur = -1, run = '';
        const flush = () => { if (!run) return; out += cur === 2 ? '<span class="k">' + esc(run) + '</span>' : cur === 0 ? '<span class="c">' + esc(run) + '</span>' : esc(run); run = ''; };
        for (let x = 0; x < cols; x++) {
          const i = src + x * 4, l = (0.299 * buf[i] + 0.587 * buf[i + 1] + 0.114 * buf[i + 2]) / 255;
          let g = RAMP[Math.min(n, Math.floor(l * n + 0.5))];
          if (shake > 0 && g !== ' ' && Math.random() < shake) g = RAMP[(Math.random() * n | 0) + 1];
          const b = l > 0.78 ? 2 : l > 0.3 ? 1 : 0;
          if (b !== cur) { flush(); cur = b; } run += g;
        }
        flush(); out += '\n';
      }
      pre.innerHTML = head + out + foot;
    }
    requestAnimationFrame(frame);
  })(last);
  return () => {
    alive = false; pre.removeEventListener('pointerdown', down); removeEventListener('pointermove', move); removeEventListener('pointerup', up);
    pre.style.cursor = ''; pre.style.touchAction = ''; pre.style.fontSize = saved[0]; pre.style.lineHeight = saved[1]; rt.dispose();
    obj.traverse(o => { o.geometry && o.geometry.dispose(); o.material && o.material.dispose && o.material.dispose(); });
  };
}

/* =====================================================================
   3. :cv2.depth — la page en nuage de points
   ===================================================================== */
let depthState = null;
function depthOf(el) {
  const m = [['#name', 2.4], ['.facts', 1.5], ['.badge', 1.5], ['.proj h3', 1.3], ['.hero .tag', 1.1], ['h2.sec', 1.2], ['.term', 0.9], ['.why', 0.8], ['.stack', 0.9], ['.links', 1.0], ['.demo', 0.4], ['.proj', 0.6], ['.tree', 0.3], ['.tabs', 0.15], ['.status', 0.1], ['.cmd', 0.1]];
  for (const [s, d] of m) if (el.closest(s)) return d;
  return 0.5;
}
function buildCloud() {
  const W = innerWidth, H = innerHeight, pos = [], dep = [];
  const add = (x, y, d) => { if (x < 0 || y < 0 || x > W || y > H) return; pos.push(x, y); dep.push(d + (Math.random() - .5) * 0.06); };
  const roots = ['.tabs', '.tree', '#buf', '.status', '.cmd'].map(s => $(s)).filter(Boolean), range = document.createRange();
  for (const root of roots) {
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => n.nodeValue.trim() && n.parentElement && !n.parentElement.closest('script,style,[hidden]') ? 1 : 2 });
    let n; while ((n = tw.nextNode()) && pos.length < 160000) {
      range.selectNodeContents(n); const d = depthOf(n.parentElement);
      for (const r of range.getClientRects()) {
        if (r.bottom < 0 || r.top > H || r.width < 1) continue;
        const step = Math.max(1.6, r.height / 9);
        for (let x = r.left; x < r.right; x += step) for (let k = 0.3; k <= 0.75; k += 0.15) add(x, r.top + r.height * k, d);
      }
    }
    root.querySelectorAll('.demo,.term,.field3d').forEach(el => {
      const r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > H) return; const d = el.classList.contains('field3d') ? -0.4 : depthOf(el) - 0.2;
      for (let x = r.left; x < r.right; x += 3) { add(x, r.top, d); add(x, r.bottom, d); }
      for (let y = r.top; y < r.bottom; y += 3) { add(r.left, y, d); add(r.right, y, d); }
    });
  }
  return { pos, dep, W, H };
}
function depth(on) {
  if (!on) { if (depthState) depthState.close(); return false; }
  if (depthState) return depthState.N;
  readPalette();
  const { pos, dep, W, H } = buildCloud(), N = dep.length;
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;inset:0;z-index:18;background:' + pal.bg + ';cursor:grab;touch-action:none';
  const hint = document.createElement('div');
  hint.style.cssText = 'position:absolute;left:50%;bottom:1.2rem;transform:translateX(-50%);font:12px "IBM Plex Mono",monospace;color:' + pal.dim + ';white-space:nowrap;pointer-events:none;max-width:calc(100% - 2rem);overflow:hidden;text-overflow:ellipsis';
  const en = document.documentElement.lang === 'en';
  hint.textContent = en ? 'depth map · ' + N.toLocaleString() + ' points · drag to orbit · scroll to zoom · esc to close' : 'carte de profondeur · ' + N.toLocaleString('fr-CA') + ' points · glisse pour tourner · molette pour zoomer · échap pour fermer';
  const r2 = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  r2.setPixelRatio(Math.min(2, devicePixelRatio || 1)); r2.setSize(W, H);
  wrap.appendChild(r2.domElement); wrap.appendChild(hint); document.body.appendChild(wrap);
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(40, W / H, 0.1, 200);
  const SC = 100, ZS = 1.4, geo = new THREE.BufferGeometry(), P = new Float32Array(N * 3), C = new Float32Array(N * 3);
  const c0 = new THREE.Color(pal.dim), c1 = new THREE.Color(pal.accent), c2 = new THREE.Color(pal.accent2), tmp = new THREE.Color();
  for (let i = 0; i < N; i++) {
    P[i * 3] = (pos[i * 2] - W / 2) / SC; P[i * 3 + 1] = -(pos[i * 2 + 1] - H / 2) / SC;
    const k = Math.max(0, Math.min(1, dep[i] / 2.4)); tmp.copy(c0).lerp(k > 0.55 ? c1 : c2, k > 0.55 ? (k - .55) / .45 * .9 + .1 : k / .55 * .6);
    C[i * 3] = tmp.r; C[i * 3 + 1] = tmp.g; C[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('color', new THREE.BufferAttribute(C, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true })); scene.add(pts);
  const fit = (H / SC / 2) / Math.tan(cam.fov * Math.PI / 360);
  const orb = { yaw: 0, pitch: 0, dist: fit, tYaw: 0.55, tPitch: 0.28, tDist: fit * 1.15 };
  let drag = null, t0 = performance.now(), raf = 0, alive = true, settled = false;
  wrap.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, yaw: orb.tYaw, pitch: orb.tPitch }; wrap.setPointerCapture(e.pointerId); wrap.style.cursor = 'grabbing'; });
  wrap.addEventListener('pointermove', e => { if (!drag) return; orb.tYaw = drag.yaw + (e.clientX - drag.x) * 0.005; orb.tPitch = Math.max(-1.2, Math.min(1.2, drag.pitch + (e.clientY - drag.y) * 0.004)); });
  wrap.addEventListener('pointerup', () => { drag = null; wrap.style.cursor = 'grab'; });
  wrap.addEventListener('wheel', e => { e.preventDefault(); orb.tDist = Math.max(fit * 0.35, Math.min(fit * 3, orb.tDist * (1 + e.deltaY * 0.001))); }, { passive: false });
  const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); } };
  addEventListener('keydown', onKey, true);
  function frame(now) {
    if (!alive) return;
    const k = RM ? 1 : Math.min(1, (now - t0) / 1100), ease = 1 - Math.pow(1 - k, 3);
    if (!settled) { for (let i = 0; i < N; i++) P[i * 3 + 2] = dep[i] * ZS * ease; geo.attributes.position.needsUpdate = true; if (k >= 1) settled = true; }
    if (!drag && !RM && k >= 1) orb.tYaw += 0.0012;
    const f = RM ? 1 : 0.08; orb.yaw += (orb.tYaw * ease - orb.yaw) * f; orb.pitch += (orb.tPitch * ease - orb.pitch) * f; orb.dist += (orb.tDist - orb.dist) * f;
    const cy = 1.2 * ease;
    cam.position.set(Math.sin(orb.yaw) * Math.cos(orb.pitch) * orb.dist, Math.sin(orb.pitch) * orb.dist, cy + Math.cos(orb.yaw) * Math.cos(orb.pitch) * orb.dist);
    cam.lookAt(0, 0, cy); r2.render(scene, cam); raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  function close() { alive = false; cancelAnimationFrame(raf); removeEventListener('keydown', onKey, true); geo.dispose(); pts.material.dispose(); r2.dispose(); wrap.remove(); depthState = null; }
  depthState = { close, N };
  return N;
}

/* =====================================================================
   démarrage
   ===================================================================== */
export function start() {
  readPalette();
  new MutationObserver(readPalette).observe(document.documentElement, { attributes: true, attributeFilter: ['data-palette', 'data-theme', 'lang'] });
  matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', readPalette);

  const heroCode = $('#readme .code');
  const cv = document.createElement('canvas'); cv.className = 'field3d'; cv.setAttribute('aria-hidden', 'true');
  heroCode.insertBefore(cv, heroCode.firstChild);
  const st = document.createElement('div'); st.className = 'pitch-stats'; st.setAttribute('aria-live', 'polite'); heroCode.appendChild(st);
  const P = pitch(cv, st);
  listeners.push(P.refresh);
  document.documentElement.classList.add('has3d');

  let last = performance.now();
  (function loop(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; P.tick(dt, now); requestAnimationFrame(loop); })(last);
  setTimeout(() => P.book(30), 300);

  return { book: n => P.book(n), depth, ascii };
}

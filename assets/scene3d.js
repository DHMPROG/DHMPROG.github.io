// :cv2.depth — la page en nuage de points 3D (Three.js).
// Chargé seulement quand la commande est tapée.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = s => document.querySelector(s);
let pal = {};
function readPalette() {
  const s = getComputedStyle(document.documentElement), g = n => s.getPropertyValue(n).trim();
  pal = { bg: g('--bg'), panel: g('--panel'), line: g('--line'), fg: g('--fg'), dim: g('--dim'), accent: g('--accent'), accent2: g('--accent2'), third: g('--third') };
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
    root.querySelectorAll('.demo,.term').forEach(el => {
      const r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > H) return; const d = depthOf(el) - 0.2;
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
  return { depth };
}

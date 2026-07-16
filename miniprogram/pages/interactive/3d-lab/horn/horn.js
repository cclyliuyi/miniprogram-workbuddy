// pages/interactive/3d-lab/horn/horn.js —— 喇叭天线 3D (r108)
const { createScopedThreejs } = require('threejs-miniprogram');
const { registerOrbitControls } = require('../orbit-controls');

Page({
  data: {
    aSlider: 60, aVal: '6.0',
    lSlider: 80, lVal: '8.0',
    tapSlider: 10, tapVal: '-10 dB',
    phase: '-', gain: '-', flare: '-', hpbw: '-',
  },

  THREE: null, canvasNode: null, renderer: null, scene: null,
  camera: null, controls: null, root: null,
  hornGroup: null, phaseGroup: null, waveGroup: null,
  animId: null,
  state: { A: 6, R: 8, tap: 10, ph: 0 },
  plotCtx: null, plotW: 0, plotH: 0,
  lastKey: '',

  onReady() { this.initThree(); this.init2D(); },
  onUnload() { this.dispose(); },
  onHide() { this.stopAnim(); },

  clamp(v, a, b) { return Math.max(a, Math.min(b, v)); },
  sinc(x) { return Math.abs(x) < 1e-6 ? 1 : Math.sin(x) / x; },

  initThree() {
    const sel = this.createSelectorQuery();
    sel.select('#three-canvas').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0]) return;
      const r = res[0];
      const canvas = r.node;
      if (!canvas) return;
      const cssW = r.width, cssH = r.height;
      if (!cssW || !cssH) { setTimeout(() => this.initThree(), 200); return; }

      this.canvasNode = canvas;
      const dpr = wx.getSystemInfoSync().pixelRatio || 2;
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;

      const THREE = createScopedThreejs(canvas);
      this.THREE = THREE;
      registerOrbitControls(THREE);

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setPixelRatio(dpr);
      renderer.setSize(cssW, cssH, false);
      renderer.setClearColor(0x090b14, 1);
      this.renderer = renderer;

      const scene = new THREE.Scene();
      this.scene = scene;
      const camera = new THREE.PerspectiveCamera(42, cssW / cssH, 0.01, 100);
      this.camera = camera;

      const controls = new THREE.OrbitControls(camera, canvas);
      controls.enableDamping = true;
      controls.target.set(0, 0, 0);
      this.controls = controls;

      scene.add(new THREE.AmbientLight(0xffffff, 0.54));
      const sun = new THREE.DirectionalLight(0xffffff, 0.82);
      sun.position.set(4, 3, 5);
      scene.add(sun);

      const root = new THREE.Group();
      scene.add(root);
      this.root = root;

      this.hornGroup = new THREE.Group();
      this.phaseGroup = new THREE.Group();
      this.waveGroup = new THREE.Group();
      root.add(this.hornGroup, this.phaseGroup, this.waveGroup);

      this.renderAll();
      this.startAnim();
    });
  },

  clearGroup(g) {
    while (g.children.length) {
      const o = g.children.pop();
      if (o.geometry) o.geometry.dispose();
    }
  },

  metrics() {
    const S = this.state;
    const A = S.A, R = S.R;
    const edge = Math.sqrt(R * R + (A / 2) ** 2) - R;
    const phaseDeg = 360 * edge;
    const flare = Math.atan((A / 2) / R) * 180 / Math.PI;
    const phaseLoss = Math.max(0.42, Math.cos(Math.min(Math.PI / 2, phaseDeg * Math.PI / 360)) ** 2);
    const tapLoss = 1 - 0.018 * S.tap;
    const eta = this.clamp(0.72 * phaseLoss * tapLoss, 0.28, 0.78);
    const gain = 10 * Math.log10(4 * Math.PI * eta * A * A);
    const hpbw = 51 / A * (1 + 0.35 * (1 - phaseLoss) + 0.012 * S.tap);
    return { edge, phaseDeg, flare, eta, gain, hpbw };
  },

  cut(deg, plane, m) {
    const S = this.state;
    const u = Math.sin(deg * Math.PI / 180);
    const x = Math.PI * S.A * u;
    const taper = Math.pow(10, -S.tap / 20);
    let f = Math.abs(this.sinc(x * (plane === 'E' ? 1 : 0.72)));
    f = taper + (1 - taper) * f;
    const phasePenalty = 1 / (1 + 0.0018 * m.phaseDeg * Math.abs(u) ** 1.6);
    return f * phasePenalty;
  },

  layout3d(m) {
    const THREE = this.THREE;
    const S = this.state;
    this.clearGroup(this.hornGroup);
    this.clearGroup(this.phaseGroup);
    this.clearGroup(this.waveGroup);

    const s = 0.12;
    const A = S.A * s, R = S.R * s, th = 0.26 * s;
    const ap = A, thr = Math.max(0.42 * s, ap * 0.18);
    const z0 = -R / 2, z1 = R / 2;

    // 喇叭壁
    const pts = [
      [-thr / 2, -thr / 2, z0], [thr / 2, -thr / 2, z0],
      [thr / 2, thr / 2, z0], [-thr / 2, thr / 2, z0],
      [-ap / 2, -ap / 2, z1], [ap / 2, -ap / 2, z1],
      [ap / 2, ap / 2, z1], [-ap / 2, ap / 2, z1]
    ].map(p => new THREE.Vector3(p[0], p[1], p[2]));

    const faces = [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
    const posArr = [];
    faces.forEach(f => {
      const [a, b, c, d] = f;
      [[a, b, c], [a, c, d]].forEach(t => t.forEach(i => {
        posArr.push(pts[i].x, pts[i].y, pts[i].z);
      }));
    });

    // ⚠️ r108: addAttribute
    const geo = new THREE.BufferGeometry();
    geo.addAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
    geo.computeVertexNormals();
    const metal = new THREE.MeshStandardMaterial({
      color: 0xc78a2e, metalness: 0.74, roughness: 0.32, side: THREE.DoubleSide
    });
    this.hornGroup.add(new THREE.Mesh(geo, metal));

    // 喉部
    const throat = new THREE.Mesh(
      new THREE.BoxGeometry(thr * 0.82, thr * 0.82, th),
      new THREE.MeshStandardMaterial({ color: 0x5f6f8a, metalness: 0.55, roughness: 0.42 })
    );
    throat.position.z = z0 - th * 0.55;
    this.hornGroup.add(throat);

    // 口径边框
    const rimPts = [pts[4], pts[5], pts[6], pts[7]];
    const rimGeo = new THREE.BufferGeometry().setFromPoints(rimPts);
    this.hornGroup.add(new THREE.LineLoop(rimGeo, new THREE.LineBasicMaterial({
      color: 0xf6c267, transparent: true, opacity: 0.45
    })));

    // 口径相位色图（点云）
    const N = 30;
    const p2 = [], col = [];
    const maxPhase = Math.max(1, m.phaseDeg);
    for (let iy = 0; iy < N; iy++) {
      for (let ix = 0; ix < N; ix++) {
        const x = (-0.5 + ix / (N - 1)) * ap;
        const y = (-0.5 + iy / (N - 1)) * ap;
        const rr = Math.sqrt(x * x + y * y) / (ap / Math.SQRT2);
        const phase = this.clamp(rr * rr * m.phaseDeg / maxPhase, 0, 1);
        const c = new THREE.Color().setHSL(0.60 - 0.42 * phase, 0.82, 0.45 + 0.14 * (1 - phase));
        p2.push(x, y, z1 + 0.01);
        col.push(c.r, c.g, c.b);
      }
    }
    const g2 = new THREE.BufferGeometry();
    g2.addAttribute('position', new THREE.Float32BufferAttribute(p2, 3));
    g2.addAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    this.phaseGroup.add(new THREE.Points(g2, new THREE.PointsMaterial({
      size: 0.014, vertexColors: true, transparent: true, opacity: 0.86
    })));

    // 等相位波前
    const waveMat = new THREE.LineBasicMaterial({ color: 0xdce6ff, transparent: true, opacity: 0.45 });
    for (let k = 0; k < 8; k++) {
      const z = z1 + 0.18 + k * 0.11;
      const rx = ap * 0.45 + k * 0.035;
      const pts2 = [];
      for (let i = 0; i <= 80; i++) {
        const a = i / 80 * Math.PI * 2;
        pts2.push(new THREE.Vector3(
          Math.cos(a) * rx, Math.sin(a) * rx, z + 0.022 * Math.sin(a * 2 + this.state.ph)
        ));
      }
      this.waveGroup.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts2), waveMat));
    }

    this.camera.position.set(ap * 0.85, ap * 0.65, R * 0.85);
    this.camera.near = 0.01; this.camera.far = 100;
    this.camera.updateProjectionMatrix();
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  },

  startAnim() {
    if (this.animId || !this.canvasNode) return;
    const tick = () => {
      this.animId = this.canvasNode.requestAnimationFrame(tick);
      this.state.ph += 0.025;
      if (this.root) this.root.rotation.y = 0.08 * Math.sin(this.state.ph * 0.16);
      if (this.waveGroup) {
        this.waveGroup.children.forEach((l, i) => {
          l.material.opacity = 0.25 + 0.22 * Math.sin(this.state.ph + i * 0.5) ** 2;
        });
      }
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    tick();
  },

  stopAnim() {
    if (this.animId && this.canvasNode) {
      this.canvasNode.cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  },

  dispose() {
    this.stopAnim();
    if (this.renderer) { this.renderer.dispose(); this.renderer = null; }
    if (this.controls) { this.controls.dispose(); this.controls = null; }
  },

  onTouchStart(e) { if (this.controls) this.controls.onTouchStart(e); },
  onTouchMove(e) { if (this.controls) this.controls.onTouchMove(e); },
  onTouchEnd(e) { if (this.controls) this.controls.onTouchEnd(e); },

  onA(e) { this.state.A = e.detail.value / 10; this.setData({ aVal: this.state.A.toFixed(1) }); this.renderAll(); },
  onR(e) { this.state.R = e.detail.value / 10; this.setData({ lVal: this.state.R.toFixed(1) }); this.renderAll(); },
  onTap(e) { this.state.tap = e.detail.value; this.setData({ tapVal: '-' + this.state.tap + ' dB' }); this.renderAll(); },

  renderAll() {
    const m = this.metrics();
    this.setData({
      phase: m.phaseDeg.toFixed(0) + '°',
      gain: m.gain.toFixed(1) + ' dBi',
      flare: m.flare.toFixed(1) + '°',
      hpbw: m.hpbw.toFixed(1) + '°',
    });
    const key = [this.state.A, this.state.R, this.state.tap].join('|');
    if (key !== this.lastKey) {
      this.layout3d(m);
      this.lastKey = key;
    }
    this.drawPattern(m);
  },

  init2D() {
    const sel = this.createSelectorQuery();
    sel.select('#plot').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0]) return;
      const r = res[0];
      const canvas = r.node;
      const ctx = canvas.getContext('2d');
      const dpr = wx.getSystemInfoSync().pixelRatio || 2;
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
      ctx.scale(dpr, dpr);
      this.plotCtx = ctx;
      this.plotW = r.width;
      this.plotH = r.height;
      this.drawPattern(this.metrics());
    });
  },

  drawPattern(m) {
    if (!this.plotCtx) return;
    const pg = this.plotCtx;
    const w = this.plotW, h = this.plotH;
    pg.fillStyle = '#0a0c16';
    pg.fillRect(0, 0, w, h);

    const L = 42, R = w - 16, T = 16, B = h - 26, minDb = -45;
    pg.strokeStyle = '#242a3f';
    pg.lineWidth = 1;
    for (let db = minDb; db <= 0; db += 10) {
      const y = T + (-db / (-minDb)) * (B - T);
      pg.beginPath();
      pg.moveTo(L, y); pg.lineTo(R, y); pg.stroke();
      pg.fillStyle = '#596486';
      pg.font = '10px Consolas';
      pg.textAlign = 'right';
      pg.fillText(db + ' dB', L - 7, y + 3);
    }

    const drawLine = (plane, color) => {
      let max = 0;
      const vals = [];
      for (let i = 0; i <= 360; i++) {
        const deg = -90 + i * 0.5;
        const v = this.cut(deg, plane, m);
        vals.push(v);
        max = Math.max(max, v);
      }
      pg.strokeStyle = color;
      pg.lineWidth = 2;
      pg.beginPath();
      vals.forEach((v, i) => {
        const db = this.clamp(20 * Math.log10(v / max), minDb, 0);
        const x = L + i * (R - L) / 360;
        const y = T + (-db / (-minDb)) * (B - T);
        i ? pg.lineTo(x, y) : pg.moveTo(x, y);
      });
      pg.stroke();
    };

    drawLine('E', '#6f91ff');
    drawLine('H', '#62d89e');

    pg.fillStyle = '#9aa6cc';
    pg.font = '10px sans-serif';
    pg.textAlign = 'left';
    pg.fillText('E 面', L + 8, T + 12);
    pg.fillStyle = '#75e6b1';
    pg.fillText('H 面', L + 52, T + 12);
  },
});

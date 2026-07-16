// pages/interactive/3d-lab/traveling-wave/traveling-wave.js —— 行波天线 3D (r108)
const { createScopedThreejs } = require('threejs-miniprogram');
const { registerOrbitControls } = require('../orbit-controls');

Page({
  data: {
    geo: 'line',
    lSlider: 30, lVal: '3.0',
    gSlider: 15, gVal: '0.15',
    angSlider: 35, angVal: '35°',
    mainAng: '-', fb: '-', ripple: '-', mode: '-',
  },

  THREE: null, canvasNode: null, renderer: null, scene: null,
  camera: null, controls: null, root: null,
  wireGroup: null, currGroup: null, patternGroup: null,
  animId: null,
  state: { geo: 'line', L: 3, ref: 0.15, ang: 35, t: 0 },
  plotCtx: null, plotW: 0, plotH: 0,

  onReady() { this.initThree(); this.init2D(); },
  onUnload() { this.dispose(); },
  onHide() { this.stopAnim(); },

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
      const dpr = wx.getWindowInfo().pixelRatio || 2;

      const THREE = createScopedThreejs(canvas);
      this.THREE = THREE;
      registerOrbitControls(THREE);

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setPixelRatio(Math.min(dpr, 2));
      renderer.setSize(cssW, cssH, false);
      renderer.setClearColor(0x090b14, 1);
      this.renderer = renderer;

      const scene = new THREE.Scene();
      this.scene = scene;
      const camera = new THREE.PerspectiveCamera(42, cssW / cssH, 0.01, 100);
      this.camera = camera;

      const controls = new THREE.OrbitControls(camera, canvas);
      controls.enableDamping = true;
      this.controls = controls;

      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const sun = new THREE.DirectionalLight(0xffffff, 0.8);
      sun.position.set(2, 4, 3);
      scene.add(sun);

      const root = new THREE.Group();
      scene.add(root);
      this.root = root;

      this.wireGroup = new THREE.Group();
      this.currGroup = new THREE.Group();
      this.patternGroup = new THREE.Group();
      root.add(this.wireGroup, this.currGroup, this.patternGroup);

      this.renderStatic();
      this.startAnim();
    });
  },

  clearGroup(g) {
    while (g.children.length) {
      const o = g.children.pop();
      if (o.geometry) o.geometry.dispose();
    }
  },

  armDirs() {
    const THREE = this.THREE;
    const S = this.state;
    if (S.geo === 'line') return [new THREE.Vector3(0, 0, 1)];
    const a = S.ang * Math.PI / 180;
    return [
      new THREE.Vector3(Math.sin(a), 0, Math.cos(a)),
      new THREE.Vector3(-Math.sin(a), 0, Math.cos(a))
    ];
  },

  current(z) {
    const S = this.state;
    return {
      re: Math.cos(S.t - 2 * Math.PI * z) + S.ref * Math.cos(S.t + 2 * Math.PI * z),
      im: Math.sin(S.t - 2 * Math.PI * z) + S.ref * Math.sin(S.t + 2 * Math.PI * z)
    };
  },

  af(deg) {
    const S = this.state;
    const th = deg * Math.PI / 180;
    const THREE = this.THREE;
    const obs = new THREE.Vector3(Math.sin(th), 0, Math.cos(th));
    let re = 0, im = 0, N = 360;
    for (const dir of this.armDirs()) {
      for (let i = 0; i <= N; i++) {
        const z = S.L * i / N;
        const c = this.current(z);
        const ph = 2 * Math.PI * z * dir.dot(obs);
        re += c.re * Math.cos(ph) - c.im * Math.sin(ph);
        im += c.re * Math.sin(ph) + c.im * Math.cos(ph);
      }
    }
    return Math.hypot(re, im);
  },

  pattern() {
    let vals = [], m = 0, main = 0;
    for (let i = 0; i <= 360; i++) {
      const deg = -90 + i * 0.5;
      const v = this.af(deg);
      vals.push(v);
      if (v > m) { m = v; main = deg; }
    }
    return { vals: vals.map(v => v / (m || 1)), main };
  },

  layout() {
    const THREE = this.THREE;
    const S = this.state;
    this.clearGroup(this.wireGroup);
    this.clearGroup(this.patternGroup);

    const scale = 0.32;
    const wireMat = new THREE.LineBasicMaterial({ color: 0xffc45f });

    for (const dir of this.armDirs()) {
      const pts = [];
      for (let i = 0; i <= 80; i++) pts.push(dir.clone().multiplyScalar(S.L * scale * i / 80));
      this.wireGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
    }

    const p = this.pattern();
    const patMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.78 });
    const pts = [];
    p.vals.forEach((v, i) => {
      const th = (-90 + i * 0.5) * Math.PI / 180;
      const rr = 0.8 * v;
      pts.push(new THREE.Vector3(Math.sin(th) * rr, -0.58, Math.cos(th) * rr));
    });
    this.patternGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), patMat));

    this.camera.position.set(1.8, 1.3, 2.1);
    this.controls.target.set(0, 0, 0.35);
    this.controls.update();
  },

  updateCurrents() {
    const THREE = this.THREE;
    const S = this.state;
    this.clearGroup(this.currGroup);

    const scale = 0.32;
    const fwdMat = new THREE.MeshBasicMaterial({ color: 0xffc45f });
    const revMat = new THREE.MeshBasicMaterial({ color: 0x5f8bff });

    for (const dir of this.armDirs()) {
      for (let i = 0; i <= 30; i++) {
        const z = S.L * i / 30;
        const c = this.current(z);
        const amp = Math.min(0.055, 0.025 + 0.018 * Math.hypot(c.re, c.im));
        const mat = c.re >= 0 ? fwdMat : revMat;
        const s = new THREE.Mesh(new THREE.SphereGeometry(amp, 10, 10), mat);
        s.position.copy(dir.clone().multiplyScalar(z * scale));
        s.position.y = 0.08 * Math.sin(S.t - 2 * Math.PI * z);
        this.currGroup.add(s);
      }
    }
  },

  startAnim() {
    if (this.animId || !this.canvasNode) return;
    const tick = () => {
      this.animId = this.canvasNode.requestAnimationFrame(tick);
      this.state.t += 0.045;
      this.updateCurrents();
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

  onGeo(e) {
    this.state.geo = e.currentTarget.dataset.g;
    this.setData({ geo: this.state.geo });
    this.renderStatic();
  },
  onL(e) {
    this.state.L = e.detail.value / 10;
    this.setData({ lVal: this.state.L.toFixed(1) });
    this.renderStatic();
  },
  onRef(e) {
    this.state.ref = e.detail.value / 100;
    this.setData({ gVal: this.state.ref.toFixed(2) });
    this.renderStatic();
  },
  onAng(e) {
    this.state.ang = e.detail.value;
    this.setData({ angVal: this.state.ang + '°' });
    this.renderStatic();
  },

  renderStatic() {
    const p = this.pattern();
    const S = this.state;
    const fb = 20 * Math.log10((this.af(p.main) || 1) / (this.af(p.main + 180) || 0.001));
    const ripple = (1 + S.ref) / (1 - S.ref);
    const mode = S.ref < 0.08 ? '近似行波' : S.ref < 0.35 ? '弱驻波' : '驻波明显';
    this.setData({
      mainAng: p.main.toFixed(0) + '°',
      fb: fb.toFixed(1) + ' dB',
      ripple: ripple.toFixed(1) + ':1',
      mode: mode,
    });
    this.layout();
    this.drawPlot(p);
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
      this.drawPlot(this.pattern());
    });
  },

  drawPlot(p) {
    if (!this.plotCtx || !p) return;
    const pg = this.plotCtx;
    const w = this.plotW, h = this.plotH;
    const cx = w / 2, cy = h / 2;
    const R = Math.min(w, h) * 0.39;

    pg.fillStyle = '#0a0c16';
    pg.fillRect(0, 0, w, h);

    pg.strokeStyle = '#252b46';
    for (const r of [0.25, 0.5, 0.75, 1]) {
      pg.beginPath();
      pg.arc(cx, cy, R * r, 0, Math.PI * 2);
      pg.stroke();
    }

    pg.strokeStyle = '#fff';
    pg.lineWidth = 2;
    pg.beginPath();
    p.vals.forEach((v, i) => {
      const th = (-90 + i * 0.5) * Math.PI / 180;
      const rr = R * v;
      const x = cx + Math.sin(th) * rr;
      const y = cy - Math.cos(th) * rr;
      i ? pg.lineTo(x, y) : pg.moveTo(x, y);
    });
    pg.stroke();
  },
});

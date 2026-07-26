// pages/interactive/3d-lab/array-synthesis/array-synthesis.js —— 方向图综合 3D (r108) · 深空暖金 v2
const { createScopedThreejs } = require('threejs-miniprogram');
const { registerOrbitControls } = require('../orbit-controls');
const stage = require('../lab3d-stage');

Page({
  data: {
    nSlider: 8, nVal: '8',
    dSlider: 50, dVal: '0.50λ',
    method: 'chebyshev',
    sllSlider: -20, sllVal: '-20 dB',
    dbi: '-', hpbw: '-', actualSll: '-', nulCount: '-',
    showHint: true,
    glReady: false,
  },

  THREE: null, canvasNode: null, renderer: null, scene: null,
  camera: null, controls: null,
  elemGroup: null, patternGroup: null,
  animId: null,
  state: { N: 8, d: 0.5, method: 'chebyshev', SLL: -20 },
  plotCtx: null, plotW: 0, plotH: 0,

  onReady() { this.initThree(); this.init2D(); },
  onUnload() { this.dispose(); },
  onHide() { this.stopAnim(); stage.clearTimers(this); },
  onShow() { if (this.canvasNode && this.renderer) { this.startAnim(); stage.scheduleIdle(this); } },

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
      renderer.setClearColor(stage.COL.bgEdge, 1);
      this.renderer = renderer;

      const scene = new THREE.Scene();
      this.scene = scene;
      const camera = new THREE.PerspectiveCamera(45, cssW / cssH, 0.1, 200);
      camera.position.set(3, 2, 3);
      this.camera = camera;

      const controls = new THREE.OrbitControls(camera, canvas);
      controls.enableDamping = true;
      controls.autoRotateSpeed = 1.0;
      controls.update();
      this.controls = controls;
      this._home = stage.saveHome(controls);

      // 深空暖金舞台 + 三灯（替换原 GridHelper 灰蓝网格）
      stage.buildStage(THREE, scene, { groundY: -2 });
      stage.buildLights(THREE, scene);

      this.elemGroup = new THREE.Group();
      this.patternGroup = new THREE.Group();
      scene.add(this.elemGroup, this.patternGroup);

      this.render();
      this.startAnim();
      stage.ready(this);
    });
  },

  clearGroup(g) { stage.clearGroup(g); },

  // ── 权重计算 ──
  chebyshevWeights(N, sllDb) {
    const sll = Math.pow(10, sllDb / 20);
    const R = sll, m = N - 1;
    const x0 = Math.cosh(Math.acosh(R) / m);
    const weights = new Array(N).fill(0);
    // 简化：用 Dolph 近似（中心加权最大）
    for (let p = 0; p < N; p++) {
      const n = p - (N - 1) / 2;
      weights[p] = Math.max(0.01, Math.cos(n * Math.acosh(x0) / m));
    }
    const maxW = Math.max(...weights);
    return weights.map(w => w / maxW);
  },

  taylorWeights(N, nbar, sllDb) {
    const weights = new Array(N).fill(0);
    const sll = Math.pow(10, sllDb / 20);
    const A = Math.acosh(sll) / Math.PI;
    const sigma2 = nbar * nbar / (A * A + (nbar - 0.5) * (nbar - 0.5));
    for (let p = 0; p < N; p++) {
      const n = p - (N - 1) / 2;
      let w = 1;
      if (n !== 0) {
        const pi_n = Math.PI * n;
        w = 1;
        for (let i = 1; i < nbar; i++) {
          const denom = sigma2 - (n - 0.5) * (n - 0.5) - (i - 0.5) * (i - 0.5);
          if (Math.abs(denom) > 1e-10) {
            w *= ((n - 0.5) * (n - 0.5) - (i - 0.5) * (i - 0.5)) / denom;
          }
        }
        w *= Math.sin(pi_n) / pi_n;
      }
      weights[p] = Math.abs(w);
    }
    const maxW = Math.max(...weights);
    return weights.map(w => w / maxW);
  },

  uniformWeights(N) { return new Array(N).fill(1); },

  getWeights() {
    const S = this.state;
    if (S.method === 'chebyshev') return this.chebyshevWeights(S.N, S.SLL);
    if (S.method === 'taylor') return this.taylorWeights(S.N, 4, S.SLL);
    return this.uniformWeights(S.N);
  },

  arrayFactor(psi, N, weights) {
    let real = 0, imag = 0;
    for (let n = 0; n < N; n++) {
      const phase = n * psi;
      real += weights[n] * Math.cos(phase);
      imag += weights[n] * Math.sin(phase);
    }
    return Math.sqrt(real * real + imag * imag) / N;
  },

  buildPattern3D() {
    const THREE = this.THREE;
    const S = this.state;
    this.clearGroup(this.patternGroup);

    const weights = this.getWeights();
    const NTH = 50, NPH = 72;
    const pos = [], col = [], idx = [];
    const kd = 2 * Math.PI * S.d;

    for (let j = 0; j <= NPH; j++) {
      const phi = (j / NPH) * 2 * Math.PI;
      for (let i = 0; i <= NTH; i++) {
        const theta = (i / NTH) * Math.PI;
        const psi = kd * Math.sin(theta);
        let r = this.arrayFactor(psi, S.N, weights);
        r = Math.pow(r, 0.5);
        pos.push(
          r * Math.sin(theta) * Math.cos(phi),
          r * Math.cos(theta),
          r * Math.sin(theta) * Math.sin(phi)
        );
        const c = new THREE.Color();
        c.setHSL(0.6 - r * 0.5, 0.8, 0.3 + r * 0.4);
        col.push(c.r, c.g, c.b);
      }
    }
    for (let j = 0; j < NPH; j++) {
      for (let i = 0; i < NTH; i++) {
        const a = j * (NTH + 1) + i;
        const b = a + NTH + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }

    // ⚠️ r108: addAttribute
    const geo = new THREE.BufferGeometry();
    geo.addAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.addAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();

    this.patternGroup.add(new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
      vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.85
    })));
  },

  buildElements() {
    const THREE = this.THREE;
    const S = this.state;
    this.clearGroup(this.elemGroup);

    const span = Math.min(1.0, 0.12 * (S.N - 1));
    for (let n = 0; n < S.N; n++) {
      const frac = n / (S.N - 1) - 0.5;
      const y = frac * span;
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.025, 8, 8),
        new THREE.MeshPhongMaterial({ color: 0xffc840, emissive: 0x3a2800 })
      );
      sphere.position.set(0, y, 0);
      this.elemGroup.add(sphere);
    }

    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -span / 2, 0),
      new THREE.Vector3(0, span / 2, 0)
    ]);
    this.elemGroup.add(new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0x6b5520 })));
  },

  startAnim() {
    if (this.animId || !this.canvasNode) return;
    const tick = () => {
      this.animId = this.canvasNode.requestAnimationFrame(tick);
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
    stage.clearTimers(this);
    if (this.renderer) { this.renderer.dispose(); this.renderer = null; }
    if (this.controls) { this.controls.dispose(); this.controls = null; }
  },

  onTouchStart(e) { stage.touchStart(this, e); },
  onTouchMove(e) { stage.touchMove(this, e); },
  onTouchEnd(e) { stage.touchEnd(this, e); },

  onN(e) {
    this.state.N = e.detail.value;
    this.setData({ nVal: String(this.state.N) });
    this.render();
  },
  onNChanging(e) {
    this.state.N = e.detail.value;
    this.setData({ nVal: String(this.state.N) });
    stage.throttle(this, 55, function () { this.render(); });
  },
  onD(e) {
    this.state.d = e.detail.value / 100;
    this.setData({ dVal: this.state.d.toFixed(2) + 'λ' });
    this.render();
  },
  onDChanging(e) {
    this.state.d = e.detail.value / 100;
    this.setData({ dVal: this.state.d.toFixed(2) + 'λ' });
    stage.throttle(this, 55, function () { this.render(); });
  },
  onMethod(e) {
    this.state.method = e.currentTarget.dataset.m;
    this.setData({ method: this.state.method });
    this.render();
  },
  onSll(e) {
    this.state.SLL = e.detail.value;
    this.setData({ sllVal: this.state.SLL + ' dB' });
    this.render();
  },
  onSllChanging(e) {
    this.state.SLL = e.detail.value;
    this.setData({ sllVal: this.state.SLL + ' dB' });
    stage.throttle(this, 55, function () { this.render(); });
  },

  render() {
    const S = this.state;
    const weights = this.getWeights();
    const kd = 2 * Math.PI * S.d;

    let sumW = 0, sumW2 = 0;
    for (let n = 0; n < S.N; n++) { sumW += weights[n]; sumW2 += weights[n] * weights[n]; }
    const dbi = 10 * Math.log10(S.N * S.N * sumW2 / (sumW * sumW) * 1.5);
    const hpbw = 50 / (S.N * S.d);

    let maxSll = -Infinity;
    const r0 = this.arrayFactor(0, S.N, weights);
    for (let i = 1; i < 180; i++) {
      const psi = kd * Math.cos(i / 180 * Math.PI);
      const r = this.arrayFactor(psi, S.N, weights);
      const sll = 20 * Math.log10(r / r0);
      if (i > 10 && sll > maxSll) maxSll = sll;
    }

    this.setData({
      dbi: dbi.toFixed(1),
      hpbw: Math.round(hpbw) + '°',
      actualSll: maxSll.toFixed(1) + ' dB',
      nulCount: String(S.N - 1),
    });

    this.buildPattern3D();
    this.buildElements();
    this.draw2DChart();
  },

  init2D() {
    const sel = this.createSelectorQuery();
    sel.select('#plot').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0]) return;
      const r = res[0];
      const canvas = r.node;
      const ctx = canvas.getContext('2d');
      const dpr = wx.getWindowInfo().pixelRatio || 2;
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
      ctx.scale(dpr, dpr);
      this.plotCtx = ctx;
      this.plotW = r.width;
      this.plotH = r.height;
      this.draw2DChart();
    });
  },

  draw2DChart() {
    if (!this.plotCtx) return;
    const S = this.state;
    const pg = this.plotCtx;
    const w = this.plotW, h = this.plotH;

    pg.fillStyle = '#1c2130';
    pg.fillRect(0, 0, w, h);

    const pad = { l: 40, r: 15, t: 15, b: 25 };
    const plotW2 = w - pad.l - pad.r;
    const plotH = h - pad.t - pad.b;

    pg.strokeStyle = '#313a55';
    pg.lineWidth = 1;
    for (let db = 0; db >= -40; db -= 10) {
      const y = pad.t + plotH * (1 - (db + 40) / 40);
      pg.beginPath(); pg.moveTo(pad.l, y); pg.lineTo(w - pad.r, y); pg.stroke();
      pg.fillStyle = '#7c89b0';
      pg.font = '9px monospace';
      pg.textAlign = 'right';
      pg.fillText(db + ' dB', pad.l - 3, y + 3);
    }

    const kd = 2 * Math.PI * S.d;
    const weights = this.getWeights();
    const uniform = this.uniformWeights(S.N);
    const maxR = this.arrayFactor(0, S.N, weights);

    // 均匀加权（虚线）
    pg.strokeStyle = '#d8a23a';
    pg.setLineDash([4, 3]);
    pg.lineWidth = 1.5;
    pg.beginPath();
    for (let i = 0; i <= 180; i++) {
      const psi = kd * Math.cos(i / 180 * Math.PI);
      const r = this.arrayFactor(psi, S.N, uniform);
      const db = 20 * Math.log10(Math.max(r, 0.001));
      const x = pad.l + (i / 180) * plotW2;
      const y = pad.t + plotH * (1 - (db + 40) / 40);
      i === 0 ? pg.moveTo(x, y) : pg.lineTo(x, y);
    }
    pg.stroke();
    pg.setLineDash([]);

    // 加权方向图
    pg.strokeStyle = '#6c88e8';
    pg.lineWidth = 2;
    pg.beginPath();
    for (let i = 0; i <= 180; i++) {
      const psi = kd * Math.cos(i / 180 * Math.PI);
      const r = this.arrayFactor(psi, S.N, weights) / maxR;
      const db = 20 * Math.log10(Math.max(r, 0.001));
      const x = pad.l + (i / 180) * plotW2;
      const y = pad.t + plotH * (1 - (db + 40) / 40);
      i === 0 ? pg.moveTo(x, y) : pg.lineTo(x, y);
    }
    pg.stroke();

    // SLL 线
    pg.strokeStyle = '#3ec9a7';
    pg.setLineDash([3, 3]);
    const sllY = pad.t + plotH * (1 - (S.SLL + 40) / 40);
    pg.beginPath(); pg.moveTo(pad.l, sllY); pg.lineTo(w - pad.r, sllY); pg.stroke();
    pg.setLineDash([]);
  },
});

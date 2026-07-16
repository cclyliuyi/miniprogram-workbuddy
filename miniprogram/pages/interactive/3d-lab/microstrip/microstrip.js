// pages/interactive/3d-lab/microstrip/microstrip.js —— 微带贴片天线 3D (r108)
const { createScopedThreejs } = require('threejs-miniprogram');
const { registerOrbitControls } = require('../orbit-controls');

Page({
  data: {
    fSlider: 245, fVal: '2.45 GHz',
    erSlider: 44, erVal: '4.40',
    hSlider: 160, hVal: '1.60 mm',
    insetSlider: 34, insetVal: '0.34',
    W: '-', L: '-', ee: '-', rin: '-', smin: '-', bw: '-',
  },

  THREE: null, canvasNode: null, renderer: null, scene: null,
  camera: null, controls: null, root: null,
  fieldGroup: null, currentGroup: null, dimGroup: null,
  fieldMats: [], currentMats: [],
  animId: null,
  state: { f: 2.45, er: 4.4, h: 1.6, inset: 0.34, ph: 0 },
  plotCtx: null, plotW: 0, plotH: 0,
  lastKey: '',
  // 持久化 mesh 引用（不再每帧 dispose）
  substrate: null, ground: null, patch: null, feed: null, slotL: null, slotR: null,

  onReady() { this.initThree(); this.init2D(); },
  onUnload() { this.dispose(); },
  onHide() { this.stopAnim(); },

  clamp(v, a, b) { return Math.max(a, Math.min(b, v)); },

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
      controls.dampingFactor = 0.08;
      controls.target.set(0, 0.08, 0);
      this.controls = controls;

      scene.add(new THREE.AmbientLight(0xffffff, 0.58));
      const key = new THREE.DirectionalLight(0xffffff, 0.82);
      key.position.set(3, 4, 5);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0x6f91ff, 0.42);
      rim.position.set(-3, 2, -4);
      scene.add(rim);

      const root = new THREE.Group();
      scene.add(root);
      this.root = root;

      this.fieldGroup = new THREE.Group();
      this.currentGroup = new THREE.Group();
      this.dimGroup = new THREE.Group();
      root.add(this.fieldGroup, this.currentGroup, this.dimGroup);

      // 初始化持久化 mesh（BoxGeometry 单位 1，后续 setBox 更新）
      const matSub = new THREE.MeshPhysicalMaterial({
        color: 0x24556e, transparent: true, opacity: 0.48,
        roughness: 0.65, metalness: 0, side: THREE.DoubleSide
      });
      const matGround = new THREE.MeshStandardMaterial({ color: 0xb26a24, metalness: 0.76, roughness: 0.34 });
      const matCopper = new THREE.MeshStandardMaterial({ color: 0xd99a32, emissive: 0x241205, metalness: 0.78, roughness: 0.28 });
      const matCut = new THREE.MeshBasicMaterial({ color: 0x0a0c16 });

      this.substrate = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), matSub);
      this.ground = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), matGround);
      this.patch = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), matCopper);
      this.feed = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), matCopper);
      this.slotL = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), matCut);
      this.slotR = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), matCut);
      root.add(this.substrate, this.ground, this.patch, this.feed, this.slotL, this.slotR);

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

  setBox(mesh, w, h, d, x, y, z) {
    const THREE = this.THREE;
    mesh.geometry.dispose();
    mesh.geometry = new THREE.BoxGeometry(Math.max(w, 0.001), Math.max(h, 0.001), Math.max(d, 0.001));
    mesh.position.set(x, y, z);
  },

  design() {
    const S = this.state;
    const c0 = 299792458, f = S.f * 1e9, h = S.h / 1000, er = S.er;
    const W = c0 / (2 * f) * Math.sqrt(2 / (er + 1));
    const ee = (er + 1) / 2 + (er - 1) / 2 / Math.sqrt(1 + 12 * h / W);
    const dl = 0.412 * h * ((ee + 0.3) * (W / h + 0.264)) / ((ee - 0.258) * (W / h + 0.8));
    const L = c0 / (2 * f * Math.sqrt(ee)) - 2 * dl;
    const redge = 260 * (L / W);
    const rin = redge * Math.pow(Math.cos(Math.PI * S.inset), 2);
    const bwPct = this.clamp(220 * (h / W) / Math.sqrt(er), 1.1, 12);
    const q = 100 / bwPct;
    return { W, L, ee, dl, redge, rin, bwPct, q, f0: S.f, hmm: S.h, er: S.er, Wmm: W * 1000, Lmm: L * 1000, dlmm: dl * 1000 };
  },

  gammaAt(freq, d) {
    const x = 2 * d.q * (freq / d.f0 - 1);
    const zr = d.rin, zi = d.rin * x;
    const ar = zr - 50, ai = zi, br = zr + 50, bi = zi;
    const den = br * br + bi * bi;
    const gr = (ar * br + ai * bi) / den;
    const gi = (ai * br - ar * bi) / den;
    return Math.hypot(gr, gi);
  },

  sweep(d) {
    const pts = [], span = 0.35;
    let min = 1, minF = d.f0, bwLow = null, bwHigh = null;
    for (let i = 0; i <= 420; i++) {
      const f = d.f0 * (1 - span + 2 * span * i / 420);
      const g = this.gammaAt(f, d);
      const db = 20 * Math.log10(Math.max(g, 1e-8));
      pts.push({ f, g, db });
      if (g < min) { min = g; minF = f; }
      if (db <= -10) { if (bwLow === null) bwLow = f; bwHigh = f; }
    }
    return { pts, min, minF, bwLow, bwHigh };
  },

  layout3d(d) {
    const THREE = this.THREE;
    const S = this.state;
    this.clearGroup(this.fieldGroup);
    this.clearGroup(this.currentGroup);
    this.clearGroup(this.dimGroup);
    this.fieldMats = [];
    this.currentMats = [];

    const s = 0.035;
    const W = d.Wmm * s, L = d.Lmm * s;
    const h = this.clamp(d.hmm * 0.08, 0.045, 0.20);
    const boardW = W * 1.75, boardL = L * 2.18;
    const top = h / 2 + 0.012;

    this.setBox(this.substrate, boardW, h, boardL, 0, 0, 0);
    this.setBox(this.ground, boardW, 0.018, boardL, 0, -h / 2 - 0.014, 0);
    this.setBox(this.patch, W, 0.024, L, 0, top, 0);

    const feedW = this.clamp(W * 0.12, 0.07, 0.18);
    const insetZ = S.inset * L;
    const feedLen = boardL / 2 - (L / 2 - insetZ);
    this.setBox(this.feed, feedW, 0.026, feedLen, 0, top + 0.006, (boardL / 2 + L / 2 - insetZ) / 2);

    const slotLen = Math.max(insetZ, 0.002);
    const slotW = this.clamp(feedW * 0.42, 0.025, 0.06);
    const slotZ = L / 2 - slotLen / 2;
    const slotVisible = slotLen > 0.02;
    this.setBox(this.slotL, slotW, 0.028, slotLen, -feedW * 0.86, top + 0.018, slotZ);
    this.setBox(this.slotR, slotW, 0.028, slotLen, feedW * 0.86, top + 0.018, slotZ);
    this.slotL.visible = this.slotR.visible = slotVisible;

    // 边缘缝隙场
    const matFieldA = new THREE.LineBasicMaterial({ color: 0x6fd8ff, transparent: true, opacity: 0.62 });
    const matFieldB = new THREE.LineBasicMaterial({ color: 0x6ff0b2, transparent: true, opacity: 0.52 });
    const edgeCount = 9;
    for (const side of [-1, 1]) {
      for (let k = 0; k < edgeCount; k++) {
        const x = -W * 0.42 + k * (W * 0.84) / (edgeCount - 1);
        const pts = [];
        for (let i = 0; i <= 28; i++) {
          const t = i / 28 * Math.PI;
          pts.push(new THREE.Vector3(x, top + 0.01 + Math.sin(t) * h * 1.65, side * (L / 2 + 0.02 + Math.sin(t) * 0.16)));
        }
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), side > 0 ? matFieldA : matFieldB);
        line.userData.phase = side > 0 ? 0 : Math.PI;
        line.userData.base = 0.3 + 0.55 * Math.abs(Math.cos((x / W) * Math.PI));
        this.fieldGroup.add(line);
        this.fieldMats.push(line);
      }
    }

    // 表面电流
    for (let k = 0; k < 11; k++) {
      const x = -W * 0.44 + k * (W * 0.88) / 10;
      const amp = Math.cos((x / W) * Math.PI * 0.85);
      const mat = new THREE.LineBasicMaterial({
        color: 0xffc45f, transparent: true, opacity: 0.55 * Math.abs(amp) + 0.15
      });
      this.currentMats.push(mat);
      const z1 = -L * 0.36, z2 = L * 0.36;
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x, top + 0.035, z1),
          new THREE.Vector3(x, top + 0.035, z2)
        ]), mat
      );
      line.userData.xnorm = x / (W / 2);
      this.currentGroup.add(line);
    }

    // 尺寸标注线
    const matDim = new THREE.LineBasicMaterial({ color: 0x8fa0cc, transparent: true, opacity: 0.72 });
    const yD = top + 0.05;
    const addLine = (a, b) => {
      this.dimGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), matDim));
    };
    addLine(new THREE.Vector3(-W / 2, yD, -L / 2 - 0.17), new THREE.Vector3(W / 2, yD, -L / 2 - 0.17));
    addLine(new THREE.Vector3(W / 2 + 0.17, yD, -L / 2), new THREE.Vector3(W / 2 + 0.17, yD, L / 2));

    // 相机
    const maxDim = Math.max(boardW, boardL);
    this.camera.position.set(maxDim * 0.86, maxDim * 0.64, maxDim * 1.02);
    this.camera.near = 0.01; this.camera.far = 100;
    this.camera.updateProjectionMatrix();
    this.controls.target.set(0, 0.03, 0);
    this.controls.update();
  },

  startAnim() {
    if (this.animId || !this.canvasNode) return;
    const tick = () => {
      this.animId = this.canvasNode.requestAnimationFrame(tick);
      this.state.ph += 0.035;

      if (this.fieldMats.length) {
        this.fieldMats.forEach(line => {
          line.material.opacity = (0.26 + 0.42 * (0.5 + 0.5 * Math.sin(this.state.ph + line.userData.phase))) * line.userData.base;
        });
      }
      if (this.currentMats.length) {
        this.currentGroup.children.forEach(line => {
          const amp = Math.max(0.12, 1 - Math.abs(line.userData.xnorm) * 0.62);
          line.material.opacity = 0.18 + 0.62 * amp * (0.5 + 0.5 * Math.sin(this.state.ph));
        });
      }
      if (this.root) this.root.rotation.y = 0.10 * Math.sin(this.state.ph * 0.18);
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

  onF(e) { this.state.f = e.detail.value / 100; this.setData({ fVal: this.state.f.toFixed(2) + ' GHz' }); this.renderAll(); },
  onEr(e) { this.state.er = e.detail.value / 10; this.setData({ erVal: this.state.er.toFixed(2) }); this.renderAll(); },
  onH(e) { this.state.h = e.detail.value / 100; this.setData({ hVal: this.state.h.toFixed(2) + ' mm' }); this.renderAll(); },
  onInset(e) { this.state.inset = e.detail.value / 100; this.setData({ insetVal: this.state.inset.toFixed(2) }); this.renderAll(); },

  renderAll() {
    const d = this.design();
    const sw = this.sweep(d);
    this.setData({
      W: d.Wmm.toFixed(1) + ' mm',
      L: d.Lmm.toFixed(1) + ' mm',
      ee: d.ee.toFixed(2),
      rin: d.rin.toFixed(0) + ' Ω',
      smin: (20 * Math.log10(sw.min)).toFixed(1) + ' dB',
      bw: sw.bwLow === null ? '未达 -10' : ((sw.bwHigh - sw.bwLow) / d.f0 * 100).toFixed(1) + '%',
    });
    const key = [this.state.f.toFixed(2), this.state.er.toFixed(2), this.state.h.toFixed(2), this.state.inset.toFixed(2)].join('|');
    if (key !== this.lastKey) {
      this.layout3d(d);
      this.lastKey = key;
    }
    this.drawS11(d, sw);
  },

  init2D() {
    const sel = this.createSelectorQuery();
    sel.select('#s11').fields({ node: true, size: true }).exec((res) => {
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
      this.renderAll();
    });
  },

  drawS11(d, sw) {
    if (!this.plotCtx) return;
    const pg = this.plotCtx;
    const w = this.plotW, h = this.plotH;
    pg.fillStyle = '#0a0c16';
    pg.fillRect(0, 0, w, h);
    const L = 42, R = w - 14, T = 18, B = h - 28, minDb = -35;
    pg.strokeStyle = '#242a3f';
    pg.lineWidth = 1;
    for (let db = minDb; db <= 0; db += 5) {
      const y = T + (-db / (-minDb)) * (B - T);
      pg.beginPath(); pg.moveTo(L, y); pg.lineTo(R, y); pg.stroke();
      if (db % 10 === 0) {
        pg.fillStyle = '#5f6886';
        pg.font = '10px Consolas';
        pg.textAlign = 'right';
        pg.fillText(db + ' dB', L - 7, y + 3);
      }
    }
    // -10dB 虚线
    const y10 = T + (10 / (-minDb)) * (B - T);
    pg.setLineDash([4, 4]);
    pg.strokeStyle = 'rgba(255,189,84,.55)';
    pg.beginPath(); pg.moveTo(L, y10); pg.lineTo(R, y10); pg.stroke();
    pg.setLineDash([]);

    const fMin = sw.pts[0].f, fMax = sw.pts[sw.pts.length - 1].f;
    pg.strokeStyle = '#7ca0ff';
    pg.lineWidth = 2;
    pg.beginPath();
    sw.pts.forEach((p, i) => {
      const x = L + (p.f - fMin) / (fMax - fMin) * (R - L);
      const db = this.clamp(p.db, minDb, 0);
      const y = T + (-db / (-minDb)) * (B - T);
      i ? pg.lineTo(x, y) : pg.moveTo(x, y);
    });
    pg.stroke();

    // f0 标线
    const x0 = L + (d.f0 - fMin) / (fMax - fMin) * (R - L);
    pg.strokeStyle = '#64d79f';
    pg.beginPath(); pg.moveTo(x0, T); pg.lineTo(x0, B); pg.stroke();

    pg.fillStyle = '#7a84a8';
    pg.font = '10px sans-serif';
    pg.textAlign = 'left';
    pg.fillText(fMin.toFixed(2) + ' GHz', L, B + 17);
    pg.textAlign = 'right';
    pg.fillText(fMax.toFixed(2) + ' GHz', R, B + 17);
    pg.textAlign = 'left';
    pg.fillStyle = '#9aa6cc';
    pg.fillText('min ' + (20 * Math.log10(sw.min)).toFixed(1) + ' dB @ ' + sw.minF.toFixed(2) + ' GHz', L, T - 6);
  },
});

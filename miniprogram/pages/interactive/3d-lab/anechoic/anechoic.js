// pages/interactive/3d-lab/anechoic/anechoic.js —— 微波暗室 3D (r108)
const { createScopedThreejs } = require('threejs-miniprogram');
const { registerOrbitControls } = require('../orbit-controls');

// 常量
const AUT_CENTER = { x: 1.35, y: 0, z: 0.05 };
const TX_HORN_SCALE = 0.68;
const TX_HORN_POSITION = { x: -2.24, y: 0.86, z: 0.05 };
const HORN_APERTURE_X = 0.96;

Page({
  data: {
    aut: 'horn',
    angSlider: 0, angVal: '0°',
    stepSlider: 5, stepVal: '5°',
    scanning: false, scanText: '自动扫描',
    pwr: '-', samples: '0', hpbw: '-', sll: '-',
  },

  THREE: null, canvasNode: null, renderer: null, scene: null,
  camera: null, controls: null, root: null,
  autGroup: null, sampleGroup: null,
  animId: null,
  state: {
    aut: 'horn', ang: 0, step: 5, scan: false,
    samples: [], phase: 0, lastScanAt: 0,
  },
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
      camera.position.set(2.8, 2.35, 3.1);
      this.camera = camera;

      const controls = new THREE.OrbitControls(camera, canvas);
      controls.enableDamping = true;
      controls.target.set(0, 0.75, 0);
      this.controls = controls;

      scene.add(new THREE.AmbientLight(0xffffff, 0.46));
      const key = new THREE.DirectionalLight(0xffffff, 0.95);
      key.position.set(-2, 4, 3);
      scene.add(key);
      const fill = new THREE.PointLight(0x5f8bff, 0.82, 5);
      fill.position.set(1.2, 1.4, 1.2);
      scene.add(fill);

      const root = new THREE.Group();
      scene.add(root);
      this.root = root;

      this.autGroup = new THREE.Group();
      this.sampleGroup = new THREE.Group();
      root.add(this.autGroup, this.sampleGroup);

      // 构建暗室
      this.buildChamber();
      this.buildTxHorn();

      this.camera.position.set(2.8, 2.35, 3.1);
      this.controls.target.set(0, 0.75, 0);
      this.controls.update();

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

  // ── 暗室场景 ──
  buildChamber() {
    const THREE = this.THREE;
    const root = this.root;
    const matFloor = new THREE.MeshStandardMaterial({ color: 0x101522, roughness: 0.86 });
    const matWall = new THREE.MeshStandardMaterial({ color: 0x151827, roughness: 0.88 });
    const matAbs = new THREE.MeshStandardMaterial({ color: 0x1b2237, roughness: 0.92 });

    const addBox = (w, h, d, x, y, z, mat) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      root.add(m);
    };

    addBox(6, 0.08, 4, 0, -0.04, 0, matFloor);
    addBox(0.08, 2.4, 4, -3, 1.16, 0, matWall);
    addBox(0.08, 2.4, 4, 3, 1.16, 0, matWall);
    addBox(6, 2.4, 0.08, 0, 1.16, -2, matWall);
    addBox(6, 0.08, 4, 0, 2.36, 0, matWall);

    // 吸波锥
    const coneGeo = new THREE.ConeGeometry(0.09, 0.34, 4);
    coneGeo.rotateX(Math.PI / 2);
    for (const side of [-1, 1]) {
      for (let z = -1.8; z <= 1.8; z += 0.34) {
        for (let y = 0.18; y <= 2.15; y += 0.34) {
          const p = new THREE.Mesh(coneGeo, matAbs);
          p.position.set(side * 2.94, y, z);
          p.rotation.z = side > 0 ? Math.PI / 2 : -Math.PI / 2;
          root.add(p);
        }
      }
    }
    for (let x = -2.7; x <= 2.7; x += 0.34) {
      for (let y = 0.18; y <= 2.15; y += 0.34) {
        const p = new THREE.Mesh(coneGeo, matAbs);
        p.position.set(x, y, -1.94);
        root.add(p);
      }
    }
  },

  buildTxHorn() {
    const THREE = this.THREE;
    this.addHornModel(this.root, {
      x: TX_HORN_POSITION.x, y: TX_HORN_POSITION.y, z: TX_HORN_POSITION.z,
      scale: TX_HORN_SCALE, stand: true
    });
  },

  addHornModel(parent, opts) {
    const THREE = this.THREE;
    opts = opts || {};
    const g = new THREE.Group();
    const matHorn = new THREE.MeshStandardMaterial({
      color: 0xc7892d, metalness: 0.82, roughness: 0.28, side: THREE.DoubleSide
    });
    const matHornDark = new THREE.MeshStandardMaterial({ color: 0x2a1705, metalness: 0.45, roughness: 0.52 });
    const matBase = new THREE.MeshStandardMaterial({ color: 0x252d40, roughness: 0.74 });

    const addBox = (w, h, d, x, y, z, mat) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      g.add(m);
    };
    const addRod = (radius, length, x, y, z, axis, mat) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 24), mat);
      if (axis === 'x') m.rotation.z = Math.PI / 2;
      if (axis === 'z') m.rotation.x = Math.PI / 2;
      m.position.set(x, y, z);
      g.add(m);
    };
    const addCyl = (radius, height, x, y, z, mat, seg = 48) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, seg), mat);
      m.position.set(x, y, z);
      g.add(m);
    };

    const near = { x: 0, y: 0.16, z: 0.13 };
    const far = { x: HORN_APERTURE_X, y: 0.45, z: 0.58 };

    addBox(0.48, 0.28, 0.22, -0.28, 0, 0, matHorn);
    addBox(0.08, 0.21, 0.16, -0.53, 0, 0, matHornDark);

    // 喇叭壁
    const quad = (a, b, c, d) => {
      const pos = [...a, ...b, ...c, ...a, ...c, ...d];
      const geo = new THREE.BufferGeometry();
      geo.addAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.computeVertexNormals();
      g.add(new THREE.Mesh(geo, matHorn));
    };

    quad(
      [near.x, near.y, -near.z], [far.x, far.y, -far.z],
      [far.x, far.y, far.z], [near.x, near.y, near.z]
    );
    quad(
      [near.x, -near.y, near.z], [far.x, -far.y, far.z],
      [far.x, -far.y, -far.z], [near.x, -near.y, -near.z]
    );
    quad(
      [near.x, -near.y, near.z], [far.x, -far.y, far.z],
      [far.x, far.y, far.z], [near.x, near.y, near.z]
    );
    quad(
      [near.x, near.y, -near.z], [far.x, far.y, -far.z],
      [far.x, -far.y, -far.z], [near.x, -near.y, -near.z]
    );

    if (opts.stand) {
      addRod(0.025, 0.58, -0.48, -0.5, 0, 'y', matBase);
      addCyl(0.16, 0.08, -0.48, -0.82, 0, matBase);
    }

    g.position.set(opts.x || 0, opts.y || 0.98, opts.z || 0);
    if (opts.rotationY) g.rotation.y = opts.rotationY;
    g.scale.setScalar(opts.scale || 1);
    parent.add(g);
    return g;
  },

  addTurntable(parent) {
    const THREE = this.THREE;
    const matBase = new THREE.MeshStandardMaterial({ color: 0x252d40, roughness: 0.74 });
    const matTop = new THREE.MeshStandardMaterial({ color: 0x394255, roughness: 0.54 });
    const addCyl = (r, h, x, y, z, mat, seg = 64) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat);
      m.position.set(x, y, z); parent.add(m);
    };
    addCyl(0.46, 0.11, 0, 0.16, 0, matBase);
    addCyl(0.34, 0.045, 0, 0.26, 0, matTop);
    addCyl(0.035, 0.62, 0, 0.58, 0, matBase, 32);
  },

  addAutHorn(parent) {
    const THREE = this.THREE;
    this.addHornModel(parent, { x: 0.05, y: 0.88, z: 0, rotationY: Math.PI, scale: 0.72, stand: false });
    const matBase = new THREE.MeshStandardMaterial({ color: 0x252d40, roughness: 0.74 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.18), matBase);
    m.position.set(0.18, 0.56, 0); parent.add(m);
  },

  addDipole(parent) {
    const THREE = this.THREE;
    const matBase = new THREE.MeshStandardMaterial({ color: 0x252d40, roughness: 0.74 });
    const matCopper = new THREE.MeshStandardMaterial({ color: 0xc98a2b, metalness: 0.7, roughness: 0.3 });
    const matDark = new THREE.MeshStandardMaterial({ color: 0x2a1705, metalness: 0.45, roughness: 0.52 });

    const addBox = (w, h, d, x, y, z, mat) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z); parent.add(m);
    };
    const addRod = (radius, length, x, y, z, axis, mat) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 24), mat);
      if (axis === 'x') m.rotation.z = Math.PI / 2;
      if (axis === 'z') m.rotation.x = Math.PI / 2;
      m.position.set(x, y, z); parent.add(m);
    };

    addBox(0.13, 0.16, 0.13, 0, 0.54, 0, matBase);
    addRod(0.018, 0.48, 0, 0.91, -0.27, 'z', matCopper);
    addRod(0.018, 0.48, 0, 0.91, 0.27, 'z', matCopper);
    addBox(0.04, 0.08, 0.055, -0.02, 0.91, 0, matDark);
    addRod(0.012, 0.46, 0, 0.67, 0, 'y', matBase);
    const coax = addRod(0.009, 0.38, 0.05, 0.48, 0.08, 'y', matBase);
  },

  addPatchPanel(parent, withArray) {
    const THREE = this.THREE;
    const matBoard = new THREE.MeshStandardMaterial({ color: 0x2ca66f, emissive: 0x03180f, roughness: 0.5 });
    const matSubstrate = new THREE.MeshStandardMaterial({ color: 0x1f6f56, roughness: 0.58 });
    const matCopper = new THREE.MeshStandardMaterial({ color: 0xc98a2b, metalness: 0.7, roughness: 0.3 });
    const matFeed = new THREE.MeshStandardMaterial({ color: 0x172233, roughness: 0.7 });
    const matBase = new THREE.MeshStandardMaterial({ color: 0x252d40, roughness: 0.74 });

    const addBox = (w, h, d, x, y, z, mat) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z); parent.add(m);
    };

    addBox(0.045, 0.62, 0.82, 0, 0.84, 0, matBoard);
    addBox(0.012, 0.54, 0.72, -0.032, 0.84, 0, matSubstrate);

    if (withArray) {
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
          addBox(0.018, 0.095, 0.095, -0.06, 0.72 + row * 0.085, -0.255 + col * 0.17, matCopper);
        }
      }
      addBox(0.026, 0.035, 0.76, -0.074, 0.86, 0, matFeed);
    } else {
      addBox(0.018, 0.34, 0.46, -0.06, 0.88, 0, matCopper);
      addBox(0.025, 0.12, 0.035, -0.075, 0.55, 0, matCopper);
    }
    addBox(0.1, 0.12, 0.1, 0.04, 0.45, 0, matBase);
  },

  makeAut() {
    const THREE = this.THREE;
    this.clearGroup(this.autGroup);
    this.autGroup.position.set(AUT_CENTER.x, AUT_CENTER.y, AUT_CENTER.z);
    this.autGroup.rotation.set(0, 0, 0);
    this.addTurntable(this.autGroup);
    if (this.state.aut === 'horn') this.addAutHorn(this.autGroup);
    else if (this.state.aut === 'dipole') this.addDipole(this.autGroup);
    else if (this.state.aut === 'array') this.addPatchPanel(this.autGroup, true);
  },

  pattern(deg) {
    const a = ((deg % 360) + 360) % 360;
    const th = Math.min(a, 360 - a) * Math.PI / 180;
    const front = Math.max(0, Math.cos(th));
    const back = Math.max(0, -Math.cos(th));
    if (this.state.aut === 'horn') return Math.max(0.004, front ** 12 + 0.018 * back ** 2);
    if (this.state.aut === 'dipole') return Math.max(0.035, Math.cos(a * Math.PI / 180) ** 2);
    if (this.state.aut === 'array') {
      const N = 8, d = 0.48;
      let re = 0, im = 0;
      for (let n = 0; n < N; n++) {
        const p = 2 * Math.PI * d * (n - (N - 1) / 2) * Math.sin(th);
        re += Math.cos(p); im += Math.sin(p);
      }
      return Math.max(0.004, (Math.hypot(re, im) / N) ** 2 * (0.18 + 0.82 * front ** 10) + 0.012 * back ** 2);
    }
    return Math.max(0.006, front ** 8 + 0.025 * back ** 2);
  },

  db(v) { return 10 * Math.log10(Math.max(v, 1e-7)); },

  updateScene() {
    const THREE = this.THREE;
    this.autGroup.rotation.y = -this.state.ang * Math.PI / 180;
    this.clearGroup(this.sampleGroup);

    // 扫描环
    const r = 0.72;
    const pts = [];
    for (let i = 0; i <= 128; i++) {
      const a = i / 128 * Math.PI * 2;
      pts.push(new THREE.Vector3(AUT_CENTER.x - Math.cos(a) * r, 0.3, AUT_CENTER.z + Math.sin(a) * r));
    }
    this.sampleGroup.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0x53607f, transparent: true, opacity: 0.42 })
    ));

    // 已采样点
    const matBlue = new THREE.MeshStandardMaterial({ color: 0x6f91ff, emissive: 0x07143f, roughness: 0.38 });
    for (const deg of this.state.samples) {
      const a = deg * Math.PI / 180;
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 12), matBlue);
      m.position.set(AUT_CENTER.x - Math.cos(a) * r, 0.33, AUT_CENTER.z + Math.sin(a) * r);
      this.sampleGroup.add(m);
    }
  },

  startAnim() {
    if (this.animId || !this.canvasNode) return;
    const tick = (now) => {
      this.animId = this.canvasNode.requestAnimationFrame(tick);
      this.state.phase += 0.02;
      if (this.state.scan && now - this.state.lastScanAt > 90) {
        this.state.lastScanAt = now;
        this.state.ang = (this.state.ang + this.state.step) % 360;
        if (this.state.samples.indexOf(this.state.ang) === -1) {
          this.state.samples.push(this.state.ang);
        }
        this.updateAll();
      }
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    tick(0);
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

  onAut(e) {
    this.state.aut = e.currentTarget.dataset.a;
    this.state.scan = false;
    this.state.samples = [];
    this.setData({ aut: this.state.aut, scanning: false, scanText: '自动扫描' });
    this.renderAll();
  },

  onAng(e) {
    this.state.ang = e.detail.value;
    if (this.state.samples.indexOf(this.state.ang) === -1) this.state.samples.push(this.state.ang);
    this.updateAll();
  },

  onStep(e) {
    this.state.step = e.detail.value;
    this.updateStats();
  },

  onScan() {
    this.state.scan = !this.state.scan;
    this.state.lastScanAt = 0;
    this.setData({ scanning: this.state.scan, scanText: this.state.scan ? '暂停扫描' : '自动扫描' });
  },

  onClear() {
    this.state.samples = [];
    this.updateAll();
  },

  updateStats() {
    const p = this.pattern(this.state.ang);
    let h = '-', s = '-';
    if (this.state.samples.length > 10) {
      const arr = [...this.state.samples].sort((a, b) => a - b);
      const vals = arr.map(d => this.pattern(d));
      const max = Math.max(...vals);
      const half = max / 2;
      const above = [];
      for (let i = 0; i < arr.length; i++) {
        if (vals[i] >= half) above.push(arr[i]);
      }
      if (above.length) h = ((above[above.length - 1] - above[0] + 360) % 360 || above.length * this.state.step).toFixed(0) + '°';
      const side = [];
      for (let i = 0; i < arr.length; i++) {
        if (Math.abs(((arr[i] + 540) % 360) - 180) > 35) side.push(vals[i]);
      }
      if (side.length) s = this.db(Math.max(...side) / max).toFixed(1) + ' dB';
    }
    this.setData({
      angVal: this.state.ang + '°',
      stepVal: this.state.step + '°',
      pwr: this.db(p).toFixed(1) + ' dB',
      samples: String(this.state.samples.length),
      hpbw: h,
      sll: s,
    });
    this.drawPolar();
  },

  updateAll() {
    this.updateStats();
    this.updateScene();
  },

  renderAll() {
    this.makeAut();
    this.updateAll();
  },

  init2D() {
    const sel = this.createSelectorQuery();
    sel.select('#polar').fields({ node: true, size: true }).exec((res) => {
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
      this.drawPolar();
    });
  },

  drawPolar() {
    if (!this.plotCtx) return;
    const pg = this.plotCtx;
    const w = this.plotW, h = this.plotH;
    const cx = w / 2, cy = h / 2;
    const R = Math.min(w, h) * 0.38;
    pg.fillStyle = '#0a0c16';
    pg.fillRect(0, 0, w, h);

    pg.strokeStyle = '#252b46';
    for (const r of [0.25, 0.5, 0.75, 1]) {
      pg.beginPath(); pg.arc(cx, cy, R * r, 0, Math.PI * 2); pg.stroke();
    }
    pg.beginPath();
    pg.moveTo(cx - R - 8, cy); pg.lineTo(cx + R + 8, cy);
    pg.moveTo(cx, cy - R - 8); pg.lineTo(cx, cy + R + 8);
    pg.stroke();

    pg.strokeStyle = '#f4f4f8';
    pg.lineWidth = 2;
    pg.beginPath();
    let first = true, firstPoint = null;
    const entries = [...this.state.samples].sort((a, b) => a - b);
    for (const deg of entries) {
      const val = this.pattern(deg);
      const a = (deg - 90) * Math.PI / 180;
      const rr = R * Math.sqrt(val);
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      if (first) { pg.moveTo(x, y); first = false; firstPoint = { x, y }; }
      else pg.lineTo(x, y);
    }
    const expected = Math.ceil(360 / Math.max(1, this.state.step));
    if (firstPoint && entries.length >= expected * 0.9) {
      pg.lineTo(firstPoint.x, firstPoint.y);
    }
    pg.stroke();

    // 当前指针
    const a = (this.state.ang - 90) * Math.PI / 180;
    pg.strokeStyle = '#64d79f';
    pg.beginPath(); pg.moveTo(cx, cy);
    pg.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    pg.stroke();
  },
});

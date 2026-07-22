// pages/interactive/radiation-3d/radiation-3d.js —— 三维辐射方向图 (Three.js) · 深空暖金 v2
const { createScopedThreejs } = require('threejs-miniprogram');
const { registerOrbitControls } = require('./orbit-controls');
const stage = require('../3d-lab/lab3d-stage');

Page({
  data: {
    S: {
      type: 'halfwave',
      ptype: 'power',
      opacityVal: 85,
      opacityText: '85%',
      rotate: false,
      showAxes: true,
      showCuts: true,
      showAnt: true,
    },
    hlSlider: 25,
    hlText: '0.25λ',
    stats: null,
    showHint: true,
    glReady: false,
  },

  THREE: null,
  canvasNode: null,
  renderer: null,
  scene: null,
  camera: null,
  controls: null,
  patMesh: null,
  cutsGroup: null,
  axesGroup: null,
  antGroup: null,
  antTop: null,
  animId: null,
  state: {
    type: 'halfwave',
    hl: 0.25,
    ptype: 'power',
    opacity: 0.85,
    rotate: false,
    showAxes: true,
    showCuts: true,
    showAnt: true,
  },

  onReady() {
    this.initThree();
  },

  onUnload() { this.dispose(); },
  onHide() { this.stopAnim(); stage.clearTimers(this); },
  onShow() {
    if (this.renderer) { this.startAnim(); stage.scheduleIdle(this); }
  },

  // ═══════════════════════════════════════════════════════════════
  //  Three.js 初始化 — 逐步验证
  // ═══════════════════════════════════════════════════════════════

  initThree() {
    const sel = this.createSelectorQuery();
    sel.select('#three-canvas').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0]) {
        console.error('[r3d] ❌ SelectorQuery returned empty');
        return;
      }
      const r = res[0];
      const canvas = r.node;
      if (!canvas) {
        console.error('[r3d] ❌ canvas node is null');
        return;
      }

      const cssW = r.width;
      const cssH = r.height;
      console.log('[r3d] canvas size:', cssW, 'x', cssH);

      if (!cssW || !cssH) {
        console.warn('[r3d] canvas size is 0, retrying...');
        setTimeout(() => this.initThree(), 200);
        return;
      }

      this.canvasNode = canvas;

      let THREE;
      try {
        THREE = createScopedThreejs(canvas);
        console.log('[r3d] ✅ THREE created, REVISION:', THREE.REVISION);
      } catch (err) {
        console.error('[r3d] ❌ createScopedThreejs failed:', err);
        return;
      }
      this.THREE = THREE;

      registerOrbitControls(THREE);

      // ── Step 1: 渲染器 ──
      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        const dpr = wx.getWindowInfo().pixelRatio;
        renderer.setPixelRatio(Math.min(dpr, 2));
        renderer.setSize(cssW, cssH, false);
        renderer.setClearColor(stage.COL.bgEdge, 1);
        console.log('[r3d] ✅ renderer created, drawingBuffer:', renderer.domElement.width, 'x', renderer.domElement.height);
      } catch (err) {
        console.error('[r3d] ❌ renderer failed:', err);
        return;
      }
      this.renderer = renderer;

      // ── Step 2: 场景 + 相机 ──
      const scene = new THREE.Scene();
      this.scene = scene;

      const camera = new THREE.PerspectiveCamera(45, cssW / cssH, 0.01, 100);
      camera.position.set(3, 2, 3);
      camera.lookAt(0, 0, 0);
      this.camera = camera;

      // ── Step 3: 深空穹顶 + 三灯 ──
      stage.buildStage(THREE, scene, { ground: false, halo: false });
      stage.buildLights(THREE, scene, { ambient: 0.7, key: 1.0 });

      // ── Step 4: 诊断球 — 先放一个最简单的亮球，确认渲染管线通畅 ──
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0x44aaff })
      );
      scene.add(ball);
      console.log('[r3d] ✅ diagnostic ball added');

      // 先渲染一帧看看球是否出现
      renderer.render(scene, camera);
      console.log('[r3d] ✅ first frame rendered');

      // ── Step 5: OrbitControls ──
      try {
        const controls = new THREE.OrbitControls(camera, canvas);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.autoRotateSpeed = 1.2;
        controls.minDistance = 1.2;
        controls.maxDistance = 8;
        this.controls = controls;
        this._home = stage.saveHome(controls);
        console.log('[r3d] ✅ controls created');
      } catch (e) {
        console.error('[r3d] ❌ controls failed:', e);
      }

      // ── Step 6: 正式内容（延迟加入，不阻塞首帧） ──
      setTimeout(() => {
        // 移除诊断球
        scene.remove(ball);
        ball.geometry.dispose();
        ball.material.dispose();

        this.setupGrid(THREE, scene);
        this.setupAxes(THREE, scene);
        this.setupAntenna(THREE, scene);
        this.buildPattern();
        this.refreshStats();
        console.log('[r3d] ✅ full scene loaded');
        stage.ready(this);
      }, 100);

      // 启动动画循环
      this.startAnim();
    });
  },

  // ── 获取实际可用宽高（兼容可能的小数边界） ──
  _getSize() {
    return new Promise((resolve) => {
      const sel = this.createSelectorQuery();
      sel.select('#three-canvas').boundingClientRect((rect) => {
        resolve(rect || { width: 300, height: 300 });
      }).exec();
    });
  },

  // ═══════════════════════════════════════════════════════════════
  //  场景元素
  // ═══════════════════════════════════════════════════════════════

  setupGrid(THREE, scene) {
    const size = 6, divs = 12;
    const step = size / divs;
    const half = size / 2;
    const pts = [];
    for (let i = 0; i <= divs; i++) {
      const v = -half + i * step;
      pts.push(-half, 0, v, half, 0, v);
      pts.push(v, 0, -half, v, 0, half);
    }
    const geo = new THREE.BufferGeometry();
    geo.addAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0xd4ad7e, transparent: true, opacity: 0.14, depthWrite: false,
    });
    const grid = new THREE.LineSegments(geo, mat);
    grid.position.y = -1.4;
    scene.add(grid);
  },

  setupAxes(THREE, scene) {
    const AL = 1.2;
    const group = new THREE.Group();
    const mkArrow = (dir, color) => {
      return new THREE.ArrowHelper(
        new THREE.Vector3(dir[0], dir[1], dir[2]).normalize(),
        new THREE.Vector3(0, 0, 0),
        AL, color, 0.12, 0.06
      );
    };
    try {
      group.add(mkArrow([1, 0, 0], 0xff4455));
      group.add(mkArrow([0, 1, 0], 0x44ff66));
      group.add(mkArrow([0, 0, 1], 0x4488ff));
      scene.add(group);
    } catch (e) {
      console.warn('[r3d] ArrowHelper failed:', e);
    }
    this.axesGroup = group;
  },

  setupAntenna(THREE, scene) {
    const group = new THREE.Group();
    const matl = new THREE.MeshPhongMaterial({ color: 0xffc840, emissive: 0x3a2800 });
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 1, 8), matl);
    const base = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), matl);
    group.add(top);
    group.add(base);
    scene.add(group);
    this.antGroup = group;
    this.antTop = top;
    top.scale.y = 0.5;
  },

  // ═══════════════════════════════════════════════════════════════
  //  辐射方向图数学
  // ═══════════════════════════════════════════════════════════════

  F(theta, type, hl) {
    const s = Math.sin(theta);
    switch (type) {
      case 'isotropic': return 1;
      case 'short': return s;
      case 'halfwave':
        return Math.abs(s) < 1e-9 ? 0
          : Math.abs(Math.cos(Math.PI / 2 * Math.cos(theta))) / s;
      case 'fullwave':
        return Math.abs(s) < 1e-9 ? 0
          : Math.abs(Math.cos(Math.PI * Math.cos(theta)) + 1) / s;
      case 'custom': {
        const kh = 2 * Math.PI * hl;
        return Math.abs(s) < 1e-9 ? 0
          : Math.abs(Math.cos(kh * Math.cos(theta)) - Math.cos(kh)) / s;
      }
    }
    return 0;
  },

  Fmax(type, hl, N) {
    N = N || 2000;
    let m = 0;
    for (let i = 0; i <= N; i++) {
      const v = this.F((i / N) * Math.PI, type, hl);
      if (v > m) m = v;
    }
    return m || 1;
  },

  heatRGB(t) {
    t = Math.max(0, Math.min(1, t));
    let r, g, b;
    if (t < 0.25) { r = 0; g = t * 4; b = 1; }
    else if (t < 0.5) { r = 0; g = 1; b = 2 - t * 4; }
    else if (t < 0.75) { r = t * 4 - 2; g = 1; b = 0; }
    else { r = 1; g = 4 - t * 4; b = 0; }
    return [r, g, b];
  },

  // ═══════════════════════════════════════════════════════════════
  //  构建 3D 网格
  // ═══════════════════════════════════════════════════════════════

  buildPattern() {
    if (!this.THREE || !this.scene) return;
    const THREE = this.THREE;
    const { type, hl, ptype, opacity } = this.state;

    if (this.patMesh) {
      this.scene.remove(this.patMesh);
      this.patMesh.geometry.dispose();
      this.patMesh.material.dispose();
      this.patMesh = null;
    }
    if (this.cutsGroup) {
      this.scene.remove(this.cutsGroup);
      this.cutsGroup = null;
    }

    try {
      const fm = this.Fmax(type, hl);
      const NTH = 80;
      const NPH = 120;
      const pos = [];
      const col = [];
      const idx = [];

      for (let j = 0; j <= NPH; j++) {
        const phi = (j / NPH) * 2 * Math.PI;
        for (let i = 0; i <= NTH; i++) {
          const theta = (i / NTH) * Math.PI;
          let r = this.F(theta, type, hl) / fm;
          if (ptype === 'power') r = r * r;
          pos.push(
            r * Math.sin(theta) * Math.cos(phi),
            r * Math.cos(theta),
            r * Math.sin(theta) * Math.sin(phi)
          );
          const c = this.heatRGB(r);
          col.push(c[0], c[1], c[2]);
        }
      }

      for (let j = 0; j < NPH; j++) {
        for (let i = 0; i < NTH; i++) {
          const a = j * (NTH + 1) + i;
          const b = a + NTH + 1;
          idx.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.addAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.addAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();

      const mat = new THREE.MeshPhongMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: opacity,
        shininess: 25,
      });

      this.patMesh = new THREE.Mesh(geo, mat);
      this.scene.add(this.patMesh);
      console.log('[r3d] pattern mesh built:', pos.length / 3, 'verts');

      this.buildCuts(THREE, type, hl, ptype, fm);

      if (this.antTop) {
        const hlVis = type === 'custom' ? hl : 0.25;
        this.antTop.scale.y = Math.max(0.05, hlVis * 2);
      }
    } catch (err) {
      console.error('[r3d] buildPattern error:', err);
    }
  },

  buildCuts(THREE, type, hl, ptype, fm) {
    const group = new THREE.Group();
    group.visible = this.state.showCuts;

    const ePts = [];
    const Ncut = 200;
    for (let i = 0; i <= Ncut; i++) {
      const theta = (i / Ncut) * Math.PI;
      let r = this.F(theta, type, hl) / fm;
      if (ptype === 'power') r = r * r;
      ePts.push(r * Math.sin(theta), r * Math.cos(theta), 0);
    }
    for (let i = Ncut; i >= 0; i--) {
      const theta = (i / Ncut) * Math.PI;
      let r = this.F(theta, type, hl) / fm;
      if (ptype === 'power') r = r * r;
      ePts.push(-r * Math.sin(theta), r * Math.cos(theta), 0);
    }
    const eGeo = new THREE.BufferGeometry();
    eGeo.addAttribute('position', new THREE.Float32BufferAttribute(ePts, 3));
    group.add(new THREE.LineLoop(eGeo,
      new THREE.LineBasicMaterial({ color: 0xffffff })));

    const hPts = [];
    for (let j = 0; j <= 180; j++) {
      const phi = (j / 180) * 2 * Math.PI;
      let r = this.F(Math.PI / 2, type, hl) / fm;
      if (ptype === 'power') r = r * r;
      hPts.push(r * Math.cos(phi), 0, r * Math.sin(phi));
    }
    const hGeo = new THREE.BufferGeometry();
    hGeo.addAttribute('position', new THREE.Float32BufferAttribute(hPts, 3));
    group.add(new THREE.LineLoop(hGeo,
      new THREE.LineBasicMaterial({ color: 0xffcc00 })));

    this.scene.add(group);
    this.cutsGroup = group;
  },

  // ═══════════════════════════════════════════════════════════════
  //  统计
  // ═══════════════════════════════════════════════════════════════

  refreshStats() {
    const { type, hl } = this.state;
    const N = 3000;
    const fm = this.Fmax(type, hl, N);
    const dt = Math.PI / N;
    let integral = 0;
    for (let i = 0; i <= N; i++) {
      const theta = i * dt;
      const f = this.F(theta, type, hl) / fm;
      const w = (i === 0 || i === N) ? 0.5 : 1;
      integral += w * f * f * Math.sin(theta) * dt;
    }
    const D = 2 / Math.max(integral, 1e-12);
    const dbi = 10 * Math.log10(D);

    const halfPow = 0.5 * fm * fm;
    let hpTheta = 0;
    for (let i = 0; i < N / 2; i++) {
      const theta = Math.PI / 2 - (i / (N / 2)) * (Math.PI / 2);
      const v = this.F(theta, type, hl);
      if (v * v <= halfPow) { hpTheta = theta; break; }
    }
    const HPBW = Math.round(2 * (Math.PI / 2 - hpTheta) * 180 / Math.PI);

    let Rr;
    if (type === 'isotropic') Rr = '—';
    else if (type === 'short') Rr = '~80(h/λ)²';
    else if (type === 'halfwave') Rr = '73Ω';
    else if (type === 'fullwave') Rr = '199Ω';
    else {
      const kh = 2 * Math.PI * hl;
      if (Math.abs(kh - Math.PI / 2) < 0.15) Rr = '~73Ω';
      else if (Math.abs(kh - Math.PI) < 0.15) Rr = '~199Ω';
      else Rr = '—';
    }

    this.setData({
      stats: { D: D.toFixed(2), dbi: dbi.toFixed(2), HPBW: HPBW + '°', Rr }
    });
  },

  // ═══════════════════════════════════════════════════════════════
  //  动画
  // ═══════════════════════════════════════════════════════════════

  startAnim() {
    if (this.animId || !this.canvasNode) return;
    const canvas = this.canvasNode;
    const tick = () => {
      if (this.controls) {
        this.controls.autoRotate = this.state.rotate;
        this.controls.update();
      }
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
      this.animId = canvas.requestAnimationFrame(tick);
    };
    this.animId = canvas.requestAnimationFrame(tick);
    console.log('[r3d] ✅ animation loop started');
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
    if (this.controls) { this.controls.dispose(); this.controls = null; }
    if (this.patMesh) {
      this.patMesh.geometry.dispose();
      this.patMesh.material.dispose();
      this.patMesh = null;
    }
    if (this.cutsGroup) {
      this.cutsGroup.children.forEach(c => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) c.material.dispose();
      });
      this.cutsGroup = null;
    }
    if (this.renderer) { this.renderer.dispose(); this.renderer = null; }
    this.scene = null;
    this.camera = null;
    this.THREE = null;
    this.canvasNode = null;
  },

  // ═══════════════════════════════════════════════════════════════
  //  UI 事件
  // ═══════════════════════════════════════════════════════════════

  onType(e) {
    this.state.type = e.currentTarget.dataset.t;
    this.setData({ 'S.type': this.state.type });
    this.buildPattern();
    this.refreshStats();
  },

  onHl(e) {
    const v = e.detail.value;
    this.state.hl = v / 100;
    this.setData({ hlSlider: v, hlText: this.state.hl.toFixed(2) + 'λ' });
    this.buildPattern();
    this.refreshStats();
  },
  onHlChanging(e) {
    const v = e.detail.value;
    this.state.hl = v / 100;
    this.setData({ hlSlider: v, hlText: this.state.hl.toFixed(2) + 'λ' });
    stage.throttle(this, 55, function () { this.buildPattern(); this.refreshStats(); });
  },

  onPtype(e) {
    this.state.ptype = e.currentTarget.dataset.p;
    this.setData({ 'S.ptype': this.state.ptype });
    this.buildPattern();
  },

  onOpacity(e) {
    const v = e.detail.value;
    this.state.opacity = v / 100;
    this.setData({ 'S.opacityVal': v, 'S.opacityText': v + '%' });
    if (this.patMesh) this.patMesh.material.opacity = v / 100;
  },
  onOpacityChanging(e) {
    const v = e.detail.value;
    this.state.opacity = v / 100;
    this.setData({ 'S.opacityVal': v, 'S.opacityText': v + '%' });
    if (this.patMesh) this.patMesh.material.opacity = v / 100;
  },

  onRotate() {
    this.state.rotate = !this.state.rotate;
    this.setData({ 'S.rotate': this.state.rotate });
    if (this.controls) this.controls.autoRotate = this.state.rotate;
  },

  onAxes() {
    this.state.showAxes = !this.state.showAxes;
    this.setData({ 'S.showAxes': this.state.showAxes });
    if (this.axesGroup) this.axesGroup.visible = this.state.showAxes;
  },

  onCuts() {
    this.state.showCuts = !this.state.showCuts;
    this.setData({ 'S.showCuts': this.state.showCuts });
    if (this.cutsGroup) this.cutsGroup.visible = this.state.showCuts;
  },

  onAnt() {
    this.state.showAnt = !this.state.showAnt;
    this.setData({ 'S.showAnt': this.state.showAnt });
    if (this.antGroup) this.antGroup.visible = this.state.showAnt;
  },

  onTouchStart(e) { stage.touchStart(this, e); },
  onTouchMove(e) { stage.touchMove(this, e); },
  onTouchEnd(e) { stage.touchEnd(this, e); },
});

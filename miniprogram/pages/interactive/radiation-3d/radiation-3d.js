// pages/interactive/radiation-3d/radiation-3d.js —— 三维辐射方向图 (Three.js)
const { createScopedThreejs } = require('threejs-miniprogram');
const { registerOrbitControls } = require('./orbit-controls');

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
  },

  // ── 内部状态（不经过 setData）──
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

  // ═══════════════════════════════════════════════════════════════
  //  Lifecycle
  // ═══════════════════════════════════════════════════════════════

  onLoad() {
    this.initThree();
  },

  onUnload() {
    this.dispose();
  },

  onHide() {
    this.stopAnim();
  },

  onShow() {
    if (this.renderer && this.state.rotate) this.startAnim();
  },

  // ═══════════════════════════════════════════════════════════════
  //  Three.js 初始化
  // ═══════════════════════════════════════════════════════════════

  initThree() {
    const sel = this.createSelectorQuery();
    sel.select('#three-canvas').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0] || !res[0].node) {
        console.error('[r3d] canvas node not found');
        return;
      }
      const canvas = res[0].node;
      this.canvasNode = canvas;

      // 创建作用域内的 THREE
      const THREE = createScopedThreejs(canvas);
      this.THREE = THREE;

      // 注册 OrbitControls
      registerOrbitControls(THREE);

      this.setupScene(THREE, canvas, res[0].width, res[0].height);
      this.buildPattern();
      this.refreshStats();
      this.startAnim();
    });
  },

  setupScene(THREE, canvas, cssW, cssH) {
    const dpr = wx.getWindowInfo().pixelRatio;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(dpr, 1.5));
    renderer.setClearColor(0x0d0f1a, 1);
    this.renderer = renderer;

    // Scene
    const scene = new THREE.Scene();
    this.scene = scene;

    // Camera
    const w = cssW || 686;
    const h = cssH || 600;
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.01, 100);
    camera.position.set(2.4, 1.4, 2.4);
    this.camera = camera;

    // OrbitControls（使用注册后的适配版本）
    const controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotateSpeed = 1.2;
    controls.enablePan = false;
    controls.minDistance = 1.2;
    controls.maxDistance = 6;
    this.controls = controls;

    // 调整尺寸
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.DirectionalLight(0xffffff, 0.7);
    sun.position.set(4, 8, 5);
    scene.add(sun);

    // Grid
    const grid = new THREE.GridHelper(6, 24, 0x1e2235, 0x171a28);
    grid.position.y = -1.4;
    scene.add(grid);

    // Axes group
    this.setupAxes(THREE, scene);

    // Antenna element
    this.setupAntenna(THREE, scene);
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
    group.add(mkArrow([1, 0, 0], 0xff4455)); // X
    group.add(mkArrow([0, 1, 0], 0x44ff66)); // Y (dipole axis)
    group.add(mkArrow([0, 0, 1], 0x4488ff)); // Z
    scene.add(group);
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
    top.scale.y = 0.5; // half-wave default
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

  Fmax(type, hl, N = 2000) {
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

    // 清除旧网格
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

    const fm = this.Fmax(type, hl);
    const NTH = 128;
    const NPH = 192;
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
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();

    const mat = new THREE.MeshPhongMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: opacity,
      shininess: 25,
      depthWrite: false,
    });

    this.patMesh = new THREE.Mesh(geo, mat);
    this.scene.add(this.patMesh);

    // ── 切线 ──
    this.buildCuts(THREE, type, hl, ptype, fm);

    // ── 天线元件尺寸 ──
    if (this.antTop) {
      const hlVis = type === 'custom' ? hl : 0.25;
      this.antTop.scale.y = Math.max(0.05, hlVis * 2);
    }
  },

  buildCuts(THREE, type, hl, ptype, fm) {
    const group = new THREE.Group();
    group.visible = this.state.showCuts;

    // E-plane (phi=0 and pi)
    const ePts = [];
    const Ncut = 400;
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
    eGeo.setAttribute('position', new THREE.Float32BufferAttribute(ePts, 3));
    group.add(new THREE.LineLoop(eGeo,
      new THREE.LineBasicMaterial({ color: 0xffffff })));

    // H-plane (theta=pi/2)
    const hPts = [];
    for (let j = 0; j <= 360; j++) {
      const phi = (j / 360) * 2 * Math.PI;
      let r = this.F(Math.PI / 2, type, hl) / fm;
      if (ptype === 'power') r = r * r;
      hPts.push(r * Math.cos(phi), 0, r * Math.sin(phi));
    }
    const hGeo = new THREE.BufferGeometry();
    hGeo.setAttribute('position', new THREE.Float32BufferAttribute(hPts, 3));
    group.add(new THREE.LineLoop(hGeo,
      new THREE.LineBasicMaterial({ color: 0xffcc00 })));

    this.scene.add(group);
    this.cutsGroup = group;
  },

  // ═══════════════════════════════════════════════════════════════
  //  统计计算
  // ═══════════════════════════════════════════════════════════════

  refreshStats() {
    const { type, hl } = this.state;
    const N = 3000;
    const fm = this.Fmax(type, hl, N);

    // 方向性 — 梯形积分
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

    // HPBW — 从赤道向极搜索
    const halfPow = 0.5 * fm * fm;
    let hpTheta = 0;
    for (let i = 0; i < N / 2; i++) {
      const theta = Math.PI / 2 - (i / (N / 2)) * (Math.PI / 2);
      const v = this.F(theta, type, hl);
      if (v * v <= halfPow) { hpTheta = theta; break; }
    }
    const HPBW = Math.round(2 * (Math.PI / 2 - hpTheta) * 180 / Math.PI);

    // 辐射电阻
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
      stats: {
        D: D.toFixed(2),
        dbi: dbi.toFixed(2),
        HPBW: HPBW + '°',
        Rr: Rr,
      }
    });
  },

  // ═══════════════════════════════════════════════════════════════
  //  动画循环
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
  },

  stopAnim() {
    if (this.animId && this.canvasNode) {
      this.canvasNode.cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  },

  // ═══════════════════════════════════════════════════════════════
  //  销毁
  // ═══════════════════════════════════════════════════════════════

  dispose() {
    this.stopAnim();
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
    const t = e.currentTarget.dataset.t;
    this.state.type = t;
    this.setData({ 'S.type': t });
    this.buildPattern();
    this.refreshStats();
  },

  onHl(e) {
    const v = e.detail.value;
    const hl = v / 100;
    this.state.hl = hl;
    this.setData({ hlSlider: v, hlText: hl.toFixed(2) + 'λ' });
    this.buildPattern();
    this.refreshStats();
  },

  onPtype(e) {
    const p = e.currentTarget.dataset.p;
    this.state.ptype = p;
    this.setData({ 'S.ptype': p });
    this.buildPattern();
  },

  onOpacity(e) {
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

  // ── Touch 事件传递给 OrbitControls ──
  onTouchStart(e) {
    if (this.controls && this.controls.onTouchStart) {
      this.controls.onTouchStart(e);
    }
  },

  onTouchMove(e) {
    if (this.controls && this.controls.onTouchMove) {
      this.controls.onTouchMove(e);
    }
  },

  onTouchEnd(e) {
    if (this.controls && this.controls.onTouchEnd) {
      this.controls.onTouchEnd(e);
    }
  },
});

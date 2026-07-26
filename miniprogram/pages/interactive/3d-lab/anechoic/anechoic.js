// pages/interactive/3d-lab/anechoic/anechoic.js —— 微波暗室 3D · 暖纸舞台
// 方向图模型（归一化功率，显示底 −30 dB，均为教学近似）：
//   喇叭：U(θ) = cos¹²θ（cos^q 馈源模型，HPBW = 2·acos(2^(−1/12)) ≈ 39°）
//   半波偶极子：U(ψ) = [cos(½π·cosψ)/sinψ]²，ψ 为与振子轴夹角（Balanis 4-84，HPBW ≈ 78°）
//   4×4 面阵：方位切面 = 4 元均匀线阵 AF（d = 0.5λ，rf.afUniform）× 单元因子 cos²θ
// HPBW：峰值两侧 −3 dB 交点（圆周解卷绕 + 线性插值）；SLL：主瓣第一零点之外搜索。
const { registerOrbitControls } = require('../orbit-controls');
const stage = require('../lab3d-stage');
const lc = require('../../../../utils/lab-canvas');
const { THEME } = require('../../../../utils/lab-theme');
const rf = require('../../../../utils/rf-math');
const haptic = require('../../../../utils/haptic');

const AUT_CENTER = { x: 1.35, y: 0, z: 0.05 };
const TX_HORN_SCALE = 0.68;
const TX_HORN_POSITION = { x: -2.24, y: 0.86, z: 0.05 };
const HORN_APERTURE_X = 0.96;
const FLOOR_LIN = 1e-3;      // −30 dB 显示底（避免 log 奇异，非物理后瓣模型）
const SCAN_RING_R = 0.72;

Page({
  data: {
    aut: 'horn',
    angSlider: 0, angVal: '0°',
    stepSlider: 5, stepVal: '5°',
    scanning: false, scanText: '自动扫描',
    pwr: '-', samples: '0', hpbw: '需完整扫描', sll: '需完整扫描',
    showHint: true,
    glReady: false,
  },

  THREE: null, canvasNode: null, renderer: null, scene: null,
  camera: null, controls: null, root: null,
  autGroup: null, sampleGroup: null,
  animId: null,
  state: { aut: 'horn', ang: 0, step: 5, scan: false, samples: [], lastScanAt: 0 },
  plotCtx: null, plotW: 0, plotH: 0,
  _sampleMeshes: null, _sampleGeo: null, _sampleMat: null,

  onReady() {
    this.initThree();
    stage.init2D(this, '#polar', (ctx, w, h) => {
      this.plotCtx = ctx; this.plotW = w; this.plotH = h;
      this.drawPolar();
    });
  },
  onUnload() { this.dispose(); },
  onHide() { this.stopAnim(); stage.clearTimers(this); },
  onShow() { if (this.canvasNode && this.renderer) { this.startAnim(); stage.scheduleIdle(this); } },

  // ═══ 3D 初始化（暖纸舞台：纸色背景 + 暖白三灯）═══
  initThree() {
    if (typeof this.createSelectorQuery !== 'function') return; // 非小程序环境（冒烟测试）
    stage.initThree(this, '#three-canvas', {
      cameraPos: [2.8, 2.35, 3.1],
      onReady: (env) => {
        const THREE = env.THREE;
        registerOrbitControls(THREE);
        this.THREE = THREE;
        this.canvasNode = env.canvas;
        this.renderer = env.renderer;
        this.scene = env.scene;
        this.camera = env.camera;

        const controls = new THREE.OrbitControls(this.camera, env.canvas);
        controls.enableDamping = true;
        controls.autoRotateSpeed = 1.0;
        controls.target.set(0, 0.75, 0);
        controls.update();
        this.controls = controls;
        this._home = stage.saveHome(controls);

        const root = new THREE.Group();
        this.scene.add(root);
        this.root = root;
        this.autGroup = new THREE.Group();
        this.sampleGroup = new THREE.Group();
        root.add(this.autGroup, this.sampleGroup);

        // 采样点对象池：共享几何/材质，更新只改 position/visible
        this._sampleMeshes = [];
        this._sampleGeo = new THREE.SphereGeometry(0.022, 10, 10);
        this._sampleMat = new THREE.MeshStandardMaterial({
          color: stage.THEME3D.teal, roughness: 0.4, metalness: 0.1,
        });

        try {
          this.buildChamber();
          this.buildTxHorn();
          this.buildScanRing();
          this.renderAll();
        } catch (err) {
          console.error('[anechoic] buildScene error:', err);
        }
        this.startAnim();
        stage.ready(this);
      },
    });
  },

  // ── 暗室场景（材质色一律取 stage.THEME3D）──
  buildChamber() {
    const THREE = this.THREE;
    const root = this.root;
    const C = stage.THEME3D;
    const matFloor = new THREE.MeshStandardMaterial({ color: C.warmGray, roughness: 0.8, metalness: 0.05 });
    const matWall = new THREE.MeshStandardMaterial({ color: C.card, roughness: 0.85, metalness: 0.02 });
    const matAbs = new THREE.MeshStandardMaterial({ color: C.indigo, roughness: 0.95, metalness: 0 });

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

    // 吸波锥（靛蓝泡沫）
    const coneGeo = new THREE.ConeGeometry(0.12, 0.38, 4);
    coneGeo.rotateX(Math.PI / 2);
    for (const side of [-1, 1]) {
      for (let z = -1.6; z <= 1.6; z += 0.8) {
        for (let y = 0.3; y <= 1.9; y += 0.8) {
          const p = new THREE.Mesh(coneGeo, matAbs);
          p.position.set(side * 2.94, y, z);
          p.rotation.z = side > 0 ? Math.PI / 2 : -Math.PI / 2;
          root.add(p);
        }
      }
    }
    for (let x = -2.4; x <= 2.4; x += 0.8) {
      for (let y = 0.3; y <= 1.9; y += 0.8) {
        const p = new THREE.Mesh(coneGeo, matAbs);
        p.position.set(x, y, -1.94);
        root.add(p);
      }
    }
  },

  buildTxHorn() {
    this.addHornModel(this.root, {
      x: TX_HORN_POSITION.x, y: TX_HORN_POSITION.y, z: TX_HORN_POSITION.z,
      scale: TX_HORN_SCALE, stand: true,
    });
  },

  // 扫描环（静态一次构建）
  buildScanRing() {
    const THREE = this.THREE;
    const pts = [];
    for (let i = 0; i <= 128; i++) {
      const a = i / 128 * Math.PI * 2;
      pts.push(new THREE.Vector3(
        AUT_CENTER.x - Math.cos(a) * SCAN_RING_R, 0.3, AUT_CENTER.z + Math.sin(a) * SCAN_RING_R
      ));
    }
    this.root.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: stage.THEME3D.warmGray, transparent: true, opacity: 0.7 })
    ));
  },

  addHornModel(parent, opts) {
    const THREE = this.THREE;
    const C = stage.THEME3D;
    opts = opts || {};
    const g = new THREE.Group();
    const matHorn = new THREE.MeshStandardMaterial({
      color: C.gold, metalness: 0.7, roughness: 0.3, side: THREE.DoubleSide,
    });
    const matHornDark = new THREE.MeshStandardMaterial({ color: C.ink, metalness: 0.4, roughness: 0.5 });
    const matBase = new THREE.MeshStandardMaterial({ color: C.warmGray, roughness: 0.6, metalness: 0.2 });

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

    const quad = (a, b, c, d) => {
      const pos = [...a, ...b, ...c, ...a, ...c, ...d];
      const geo = new THREE.BufferGeometry();
      geo.addAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.computeVertexNormals();
      g.add(new THREE.Mesh(geo, matHorn));
    };
    quad([near.x, near.y, -near.z], [far.x, far.y, -far.z], [far.x, far.y, far.z], [near.x, near.y, near.z]);
    quad([near.x, -near.y, near.z], [far.x, -far.y, far.z], [far.x, -far.y, -far.z], [near.x, -near.y, -near.z]);
    quad([near.x, -near.y, near.z], [far.x, -far.y, far.z], [far.x, far.y, far.z], [near.x, near.y, near.z]);
    quad([near.x, near.y, -near.z], [far.x, far.y, -far.z], [far.x, -far.y, -far.z], [near.x, -near.y, -near.z]);

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
    const C = stage.THEME3D;
    const matBase = new THREE.MeshStandardMaterial({ color: C.warmGray, roughness: 0.6, metalness: 0.2 });
    const matTop = new THREE.MeshStandardMaterial({ color: C.ink, roughness: 0.45, metalness: 0.3 });
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
    const matBase = new THREE.MeshStandardMaterial({ color: stage.THEME3D.warmGray, roughness: 0.6, metalness: 0.2 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.18), matBase);
    m.position.set(0.18, 0.56, 0); parent.add(m);
  },

  addDipole(parent) {
    const THREE = this.THREE;
    const C = stage.THEME3D;
    const matBase = new THREE.MeshStandardMaterial({ color: C.warmGray, roughness: 0.6, metalness: 0.2 });
    const matCopper = new THREE.MeshStandardMaterial({ color: C.accent, metalness: 0.6, roughness: 0.3 });
    const matDark = new THREE.MeshStandardMaterial({ color: C.ink, metalness: 0.4, roughness: 0.5 });

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
    addRod(0.009, 0.38, 0.05, 0.48, 0.08, 'y', matBase);
  },

  // 4×4 微带面阵（与数学模型一致）
  addPatchPanel(parent) {
    const THREE = this.THREE;
    const C = stage.THEME3D;
    const matBoard = new THREE.MeshStandardMaterial({ color: C.teal, roughness: 0.5, metalness: 0.1 });
    const matCopper = new THREE.MeshStandardMaterial({ color: C.gold, metalness: 0.6, roughness: 0.3 });
    const matFeed = new THREE.MeshStandardMaterial({ color: C.ink, roughness: 0.6, metalness: 0.2 });
    const matBase = new THREE.MeshStandardMaterial({ color: C.warmGray, roughness: 0.6, metalness: 0.2 });

    const addBox = (w, h, d, x, y, z, mat) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z); parent.add(m);
    };
    addBox(0.045, 0.62, 0.82, 0, 0.84, 0, matBoard);
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        addBox(0.018, 0.095, 0.095, -0.032, 0.72 + row * 0.085, -0.255 + col * 0.17, matCopper);
      }
    }
    addBox(0.026, 0.035, 0.76, -0.046, 0.86, 0, matFeed);
    addBox(0.1, 0.12, 0.1, 0.04, 0.45, 0, matBase);
  },

  makeAut() {
    if (!this.THREE) return;
    stage.clearGroup(this.autGroup);
    this.autGroup.position.set(AUT_CENTER.x, AUT_CENTER.y, AUT_CENTER.z);
    this.autGroup.rotation.set(0, 0, 0);
    this.addTurntable(this.autGroup);
    if (this.state.aut === 'dipole') this.addDipole(this.autGroup);
    else if (this.state.aut === 'array') this.addPatchPanel(this.autGroup);
    else this.addAutHorn(this.autGroup);
  },

  // ═══ 归一化功率方向图（模型见文件头注释）═══
  pattern(deg) {
    const a = ((deg % 360) + 360) % 360;
    const rad = a * Math.PI / 180;                    // 方位角 φ，0° 对准发射喇叭
    const th = Math.min(a, 360 - a) * Math.PI / 180;  // |偏轴角|
    if (this.state.aut === 'dipole') {
      // 半波偶极子（臂沿转台平面内水平轴）：cosψ = sinφ，sinψ = |cosφ|
      const spsi = Math.abs(Math.cos(rad));
      if (spsi < 1e-6) return FLOOR_LIN;
      const F = Math.cos(Math.PI / 2 * Math.sin(rad)) / spsi;
      return Math.max(FLOOR_LIN, F * F);
    }
    if (this.state.aut === 'array') {
      if (th > Math.PI / 2) return FLOOR_LIN;
      const psi = 2 * Math.PI * 0.5 * Math.sin(th);   // ψ = kd·sinθ，d = 0.5λ
      const af = rf.afUniform(4, psi);
      const el = Math.cos(th);                        // 贴片单元因子（场量）
      return Math.max(FLOOR_LIN, af * af * el * el);
    }
    // 标准喇叭（含默认）：cos^q 功率模型，q = 12
    if (th > Math.PI / 2) return FLOOR_LIN;
    return Math.max(FLOOR_LIN, Math.pow(Math.cos(th), 12));
  },

  db(v) { return 10 * Math.log10(Math.max(v, 1e-7)); },

  // ═══ HPBW / SLL 估计（峰值解卷绕 + 插值；主瓣零点外搜旁瓣）═══
  estimate() {
    const S = this.state;
    const need = Math.floor(360 / Math.max(1, S.step)) * 0.9;
    if (S.samples.length < need) return { enough: false, hpbw: null, sll: null };
    const arr = [...S.samples].sort((x, y) => x - y);
    const vals = arr.map((d) => this.pattern(d));
    const n = arr.length;
    const mod = (i) => ((i % n) + n) % n;
    let iMax = 0;
    for (let i = 1; i < n; i++) if (vals[i] > vals[iMax]) iMax = i;
    const pMax = vals[iMax], half = pMax / 2;

    // 从峰值沿圆周走，找 −3 dB 交点（累计角度解卷绕 + 线性插值）
    const walk = (dir) => {
      let acc = 0;
      for (let k = 1; k < n; k++) {
        const i0 = mod(iMax + dir * (k - 1));
        const i1 = mod(iMax + dir * k);
        const dAng = dir > 0 ? (arr[i1] - arr[i0] + 360) % 360 : (arr[i0] - arr[i1] + 360) % 360;
        if (vals[i1] < half) {
          const f = (vals[i0] - half) / (vals[i0] - vals[i1]);
          return { ang: acc + dAng * f, found: true };
        }
        acc += dAng;
        if (acc > 180) break;
      }
      return { ang: acc, found: false };
    };
    const wr = walk(1), wl = walk(-1);
    const hpbw = wr.found && wl.found ? wr.ang + wl.ang : null;

    // 主瓣第一零点（下降停止处：局部极小或底噪平台起点），零点之外找最大旁瓣
    const firstNull = (dir) => {
      let prev = pMax;
      for (let k = 1; k < n; k++) {
        const v = vals[mod(iMax + dir * k)];
        if (v >= prev) return mod(iMax + dir * (k - 1));
        prev = v;
      }
      return null;
    };
    const nR = firstNull(1), nL = firstNull(-1);
    let sll = null;
    if (nR !== null && nL !== null && nR !== nL) {
      let m = vals[nR], i = nR;
      let guard = 0;
      while (i !== nL && guard++ <= n) {
        m = Math.max(m, vals[i]);
        i = mod(i + 1);
      }
      m = Math.max(m, vals[nL]);
      if (m > 0) sll = this.db(m / pMax);
    }
    return { enough: true, hpbw, sll };
  },

  // ═══ 3D 场景更新（转台角 + 采样点对象池）═══
  updateScene() {
    if (!this.THREE) return;
    this.autGroup.rotation.y = -this.state.ang * Math.PI / 180;
    const samples = this.state.samples;
    for (let i = 0; i < samples.length; i++) {
      let m = this._sampleMeshes[i];
      if (!m) {
        m = new this.THREE.Mesh(this._sampleGeo, this._sampleMat);
        this.sampleGroup.add(m);
        this._sampleMeshes.push(m);
      }
      const a = samples[i] * Math.PI / 180;
      m.visible = true;
      m.position.set(
        AUT_CENTER.x - Math.cos(a) * SCAN_RING_R, 0.33, AUT_CENTER.z + Math.sin(a) * SCAN_RING_R
      );
    }
    for (let i = samples.length; i < this._sampleMeshes.length; i++) {
      this._sampleMeshes[i].visible = false;
    }
  },

  startAnim() {
    if (this.animId || !this.canvasNode) return;
    const tick = () => {
      this.animId = this.canvasNode.requestAnimationFrame(tick);
      const now = Date.now();
      if (this.state.scan && now - this.state.lastScanAt > 90) {
        this.state.lastScanAt = now;
        this.state.ang = (this.state.ang + this.state.step) % 360;
        if (this.state.samples.indexOf(this.state.ang) === -1) {
          this.state.samples.push(this.state.ang);
        }
        this.setData({ angSlider: this.state.ang });
        this.updateAll();
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
    stage.clearTimers(this);
    if (this.renderer) { this.renderer.dispose(); this.renderer = null; }
    if (this.controls) { this.controls.dispose(); this.controls = null; }
  },

  onTouchStart(e) { stage.touchStart(this, e); },
  onTouchMove(e) { stage.touchMove(this, e); },
  onTouchEnd(e) { stage.touchEnd(this, e); },

  // ═══ 交互 ═══
  onAut(e) {
    const a = e.currentTarget.dataset.a;
    if (!a) return;
    haptic.light();
    this.state.aut = a;
    this.state.scan = false;
    this.state.samples = [];
    this.state.ang = 0;   // 转台与滑杆一并复位
    this.setData({ aut: a, scanning: false, scanText: '自动扫描', angSlider: 0, angVal: '0°' });
    this.renderAll();
  },

  _pauseScan() {
    if (!this.state.scan) return;
    this.state.scan = false;
    this.setData({ scanning: false, scanText: '自动扫描' });
  },
  onAng(e) {
    this._pauseScan();   // 手动拖角度时暂停自动扫描，避免互相打架
    this.state.ang = e.detail.value;
    if (this.state.samples.indexOf(this.state.ang) === -1) this.state.samples.push(this.state.ang);
    this.updateAll();
  },
  onAngChanging(e) {
    this._pauseScan();
    this.state.ang = e.detail.value;
    stage.throttle(this, 55, function () { this.updateAll(); });
  },

  onStep(e) {
    if (e.detail.value === this.state.step) return;
    this.state.step = e.detail.value;
    this.state.samples = [];   // 步进变更 → 旧样本作废，避免混合步进数据
    this.updateAll();
  },
  onStepChanging(e) {
    if (e.detail.value === this.state.step) return;
    this.state.step = e.detail.value;
    this.state.samples = [];
    stage.throttle(this, 55, function () { this.updateAll(); });
  },

  onScan() {
    haptic.light();
    this.state.scan = !this.state.scan;
    this.state.lastScanAt = 0;
    this.setData({ scanning: this.state.scan, scanText: this.state.scan ? '暂停扫描' : '自动扫描' });
  },
  onClear() {
    haptic.light();
    this.state.samples = [];
    this.updateAll();
  },

  updateStats() {
    const p = this.pattern(this.state.ang);
    const est = this.estimate();
    this.setData({
      angVal: this.state.ang + '°',
      stepVal: this.state.step + '°',
      pwr: this.db(p).toFixed(1) + ' dB',
      samples: String(this.state.samples.length),
      hpbw: est.enough ? (est.hpbw !== null ? est.hpbw.toFixed(1) + '°' : '未跨 −3 dB') : '需完整扫描',
      sll: est.enough ? (est.sll !== null ? est.sll.toFixed(1) + ' dB' : '—') : '需完整扫描',
    });
    this.drawPolar();
  },

  updateAll() { this.updateStats(); this.updateScene(); },
  renderAll() { this.makeAut(); this.updateAll(); },

  // ═══ 2D：极坐标方向图（lab-canvas，dB 径向标尺 + 角度标注）═══
  drawPolar() {
    if (!this.plotCtx) return;
    const ctx = this.plotCtx, w = this.plotW, h = this.plotH;
    lc.clear(ctx, w, h);
    const cx = w / 2, cy = h / 2 + 2;
    const R = Math.min(w / 2 - 44, h / 2 - 26);
    const FLOOR = -30;
    lc.polarGrid(ctx, cx, cy, R, { rings: [0, -10, -20, -30], full: true });

    // 角度标注（0° = 对准发射喇叭，画面朝上）
    lc.label(ctx, '0°', cx, cy - R - 8, { align: 'center', color: THEME.inkSoft, font: THEME.fontTick });
    lc.label(ctx, '90°', cx + R + 26, cy + 12, { align: 'center', color: THEME.muted, font: THEME.fontTick });
    lc.label(ctx, '180°', cx, cy + R + 14, { align: 'center', color: THEME.muted, font: THEME.fontTick });
    lc.label(ctx, '270°', cx - R - 22, cy + 3, { align: 'center', color: THEME.muted, font: THEME.fontTick });
    lc.label(ctx, '径向：相对电平 dB（0 … −30）', 8, 14, { color: THEME.muted, font: THEME.fontTick });

    const radiusOf = (deg) => {
      const dbv = Math.max(FLOOR, Math.min(0, this.db(this.pattern(deg))));
      return R * (1 - dbv / FLOOR);
    };
    const xy = (deg, rr) => {
      const a = (deg - 90) * Math.PI / 180;   // 0° 朝上
      return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
    };

    // 实测样本曲线（赤陶）+ 采样点
    const entries = [...this.state.samples].sort((a, b) => a - b);
    if (entries.length) {
      ctx.strokeStyle = THEME.accent;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      entries.forEach((deg, i) => {
        const [x, y] = xy(deg, radiusOf(deg));
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      const expected = Math.ceil(360 / Math.max(1, this.state.step));
      if (entries.length >= expected * 0.9) ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = THEME.accent;
      for (const deg of entries) {
        const [x, y] = xy(deg, radiusOf(deg));
        ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill();
      }
    }

    // 当前转台指针（青绿）
    ctx.strokeStyle = THEME.teal;
    ctx.lineWidth = 1.5;
    const [px, py] = xy(this.state.ang, R);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();

    lc.legend(ctx, [
      { name: '实测样本（dB 归一）', color: THEME.accent },
      { name: '当前方位', color: THEME.teal },
    ], 10, h - 10);
  },

  onShareAppMessage() {
    return { title: '虚拟微波暗室 3D 实验室', path: '/pages/interactive/3d-lab/anechoic/anechoic' };
  },
});

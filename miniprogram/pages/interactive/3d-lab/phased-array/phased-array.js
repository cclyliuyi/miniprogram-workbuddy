// pages/interactive/3d-lab/phased-array/phased-array.js —— 相控阵 3D (Three.js r108)
// 核心：
//   阵因子 AF(θ) = |sin(Nψ/2)| / |N·sin(ψ/2)|
//   ψ = kd·cosθ + β
//   3D 方向图 Mesh + 栅瓣锥环 + 阵元球点 + OrbitControls + 2D 极坐标子图
const { createScopedThreejs } = require('threejs-miniprogram');
const { registerOrbitControls } = require('../orbit-controls');
const haptic = require('../../../../utils/haptic');
const stage = require('../lab3d-stage');

const NTH = 60;   // theta 采样（绕阵列轴）
const NPH = 80;   // phi 采样（绕阵列轴旋转）
const VCNT = (NTH + 1) * (NPH + 1);

Page({
  data: {
    S: { N: 8, d: 0.5, beta: 0, el: 'iso' },
    stats: null,
    scanOn: false,
    showHint: true,
    glReady: false,
  },

  THREE: null,
  canvasNode: null,
  renderer: null,
  scene: null,
  camera: null,
  controls: null,
  root: null,
  elemGroup: null,
  patGroup: null,
  lobeGroup: null,
  axesGroup: null,
  patMesh: null,
  patGeo: null,
  patPosArr: null,
  patColArr: null,
  animId: null,
  scanPhase: 0,
  state: { N: 8, d: 0.5, beta: 0, el: 'iso' },
  plotCanvas: null,
  plotCtx: null,
  plotW: 0,
  plotH: 0,
  dpr: 1,

  onReady() {
    this.initThree();
    this.init2D();
  },
  onUnload() { this.dispose(); },
  onHide() { this.stopAnim(); stage.clearTimers(this); },
  onShow() { if (this.canvasNode && this.renderer) { this.startAnim(); stage.scheduleIdle(this); } },

  // ═══════════════════════════════════════════════════════════════
  //  3D 初始化
  // ═══════════════════════════════════════════════════════════════

  initThree() {
    const sel = this.createSelectorQuery();
    sel.select('#three-canvas').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0]) { console.error('[pa3d] SelectorQuery empty'); return; }
      const r = res[0];
      const canvas = r.node;
      if (!canvas) { console.error('[pa3d] canvas null'); return; }

      const cssW = r.width, cssH = r.height;
      if (!cssW || !cssH) { setTimeout(() => this.initThree(), 200); return; }

      this.canvasNode = canvas;
      const dpr = wx.getWindowInfo().pixelRatio || 2;
      this.dpr = dpr;

      const THREE = createScopedThreejs(canvas);
      this.THREE = THREE;
      registerOrbitControls(THREE);

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setPixelRatio(Math.min(this.dpr, 2));
      renderer.setSize(cssW, cssH, false);
      renderer.setClearColor(stage.COL.bgEdge, 1);
      this.renderer = renderer;

      const scene = new THREE.Scene();
      this.scene = scene;

      const camera = new THREE.PerspectiveCamera(40, cssW / cssH, 0.01, 200);
      camera.position.set(2.6, 1.5, 2.6);
      this.camera = camera;

      const controls = new THREE.OrbitControls(camera, canvas);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.autoRotateSpeed = 1.0;
      controls.target.set(0, 0, 0);
      controls.update();
      this.controls = controls;
      this._home = stage.saveHome(controls);

      // 深空暖金舞台 + 三灯（替换原 GridHelper 灰蓝网格）
      stage.buildStage(THREE, scene, { groundY: -1.4 });
      stage.buildLights(THREE, scene);

      // 坐标轴
      const axesGroup = new THREE.Group();
      const AL = 1.2;
      axesGroup.add(new THREE.ArrowHelper(
        new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), AL, 0xff4455, 0.12, 0.06));
      axesGroup.add(new THREE.ArrowHelper(
        new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), AL, 0x44ff66, 0.12, 0.06));
      axesGroup.add(new THREE.ArrowHelper(
        new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0), AL, 0x4488ff, 0.12, 0.06));
      scene.add(axesGroup);
      this.axesGroup = axesGroup;

      // 阵元组
      this.elemGroup = new THREE.Group();
      scene.add(this.elemGroup);

      // 方向图 Mesh 预分配
      this.patPosArr = new Float32Array(VCNT * 3);
      this.patColArr = new Float32Array(VCNT * 3);
      const idxArr = [];
      for (let j = 0; j < NPH; j++) {
        for (let i = 0; i < NTH; i++) {
          const a = j * (NTH + 1) + i;
          const b = a + NTH + 1;
          idxArr.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }

      const patGeo = new THREE.BufferGeometry();
      // ⚠️ r108: addAttribute 不是 setAttribute
      patGeo.addAttribute('position', new THREE.BufferAttribute(this.patPosArr, 3));
      patGeo.addAttribute('color', new THREE.BufferAttribute(this.patColArr, 3));
      patGeo.setIndex(idxArr);
      this.patGeo = patGeo;

      const patMat = new THREE.MeshPhongMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
        shininess: 25,
        depthWrite: false,
      });
      this.patMesh = new THREE.Mesh(patGeo, patMat);
      scene.add(this.patMesh);

      // 栅瓣锥环组
      this.lobeGroup = new THREE.Group();
      scene.add(this.lobeGroup);

      // 首次构建
      this.rebuildElements();
      this.updatePattern();
      this.startAnim();
      stage.ready(this);
    });
  },

  // ═══════════════════════════════════════════════════════════════
  //  辅助
  // ═══════════════════════════════════════════════════════════════

  clearGroup(g) { stage.clearGroup(g); },

  heatRGB(t) {
    t = Math.max(0, Math.min(1, t));
    let r, g, b;
    if (t < 0.25)      { r = 0;         g = t * 4;     b = 1; }
    else if (t < 0.5)  { r = 0;         g = 1;         b = 2 - t * 4; }
    else if (t < 0.75) { r = t * 4 - 2; g = 1;         b = 0; }
    else               { r = 1;         g = 4 - t * 4; b = 0; }
    return [r, g, b];
  },

  // ═══════════════════════════════════════════════════════════════
  //  方向图数学
  // ═══════════════════════════════════════════════════════════════

  kd() { return 2 * Math.PI * this.state.d; },
  betaRad() { return this.state.beta * Math.PI / 180; },

  AF(gamma) {
    const ps = this.kd() * Math.cos(gamma) + this.betaRad();
    const den = this.state.N * Math.sin(ps / 2);
    if (Math.abs(den) < 1e-7) return 1;
    return Math.abs(Math.sin(this.state.N * ps / 2) / den);
  },

  EF(gamma) {
    if (this.state.el === 'iso') return 1;
    const s = Math.sin(gamma);
    if (Math.abs(s) < 1e-9) return 0;
    return Math.abs(Math.cos(Math.PI / 2 * Math.cos(gamma)) / s);
  },

  P(gamma) { return this.AF(gamma) * this.EF(gamma); },

  Pmax(Nsamp) {
    Nsamp = Nsamp || 1440;
    let m = 0;
    for (let i = 0; i <= Nsamp; i++) {
      const v = this.P(i / Nsamp * Math.PI);
      if (v > m) m = v;
    }
    return m || 1;
  },

  lobeCones() {
    const k = this.kd(), b = this.betaRad();
    const cones = [];
    if (k < 1e-9) return cones;
    for (let m = -8; m <= 8; m++) {
      const c = (-b - 2 * Math.PI * m) / k;
      if (c >= -1 && c <= 1) cones.push({ m: m, gamma: Math.acos(c) });
    }
    return cones;
  },

  // ═══════════════════════════════════════════════════════════════
  //  统计
  // ═══════════════════════════════════════════════════════════════

  calcStats() {
    const Ns = 1000;
    const pm = this.Pmax(Ns);
    const dt = Math.PI / Ns;
    const Pn = [];
    let mainIdx = 0, mainVal = -1;
    for (let i = 0; i <= Ns; i++) {
      const v = this.P(i * dt) / pm;
      Pn.push(v);
      if (v > mainVal) { mainVal = v; mainIdx = i; }
    }
    const gamma0 = mainIdx * dt;

    let integral = 0;
    for (let i = 0; i <= Ns; i++) {
      const w = (i === 0 || i === Ns) ? 0.5 : 1;
      integral += w * Pn[i] * Pn[i] * Math.sin(i * dt) * dt;
    }
    const D = 2 / Math.max(integral, 1e-12);
    const dbi = 10 * Math.log10(D);

    const half = Math.SQRT1_2;
    let li = mainIdx, ri = mainIdx;
    while (li > 0 && Pn[li] > half) li--;
    while (ri < Ns && Pn[ri] > half) ri++;
    const HPBW = Math.round((ri - li) * dt * 180 / Math.PI);

    let sll = 0;
    for (let i = 1; i < Ns; i++) {
      if (Pn[i] > Pn[i - 1] && Pn[i] >= Pn[i + 1]) {
        if (Math.abs(i - mainIdx) > 2 && Pn[i] > sll) sll = Pn[i];
      }
    }
    const sllDb = sll > 1e-4 ? 20 * Math.log10(sll) : -100;

    const cones = this.lobeCones();
    let gl = 0;
    for (const c of cones) {
      if (Math.abs(c.gamma - gamma0) > 0.05) gl++;
    }

    return { gamma0: gamma0, dbi: dbi, HPBW: HPBW, sllDb: sllDb, grating: gl };
  },

  // ═══════════════════════════════════════════════════════════════
  //  场景更新
  // ═══════════════════════════════════════════════════════════════

  rebuildElements() {
    const THREE = this.THREE;
    if (!THREE) return;
    this.clearGroup(this.elemGroup);

    const span = Math.min(1.0, 0.12 * (this.state.N - 1));
    const elemMat = new THREE.MeshPhongMaterial({ color: 0xffc840, emissive: 0x3a2800 });

    for (let n = 0; n < this.state.N; n++) {
      const frac = (this.state.N === 1) ? 0 : (n / (this.state.N - 1) - 0.5);
      const y = frac * span;
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 12), elemMat);
      m.position.set(0, y, 0);
      this.elemGroup.add(m);
    }

    // 阵列连线
    const pts = [
      new THREE.Vector3(0, -span / 2, 0),
      new THREE.Vector3(0, span / 2, 0)
    ];
    const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
    this.elemGroup.add(new THREE.Line(lineGeo,
      new THREE.LineBasicMaterial({ color: 0x6b5520 })));
  },

  updatePattern() {
    const THREE = this.THREE;
    if (!THREE || !this.patGeo) return;

    const pm = this.Pmax();

    // Pn 数组
    const Pn = new Float64Array(NTH + 1);
    for (let i = 0; i <= NTH; i++) {
      Pn[i] = this.P(i / NTH * Math.PI) / pm;
    }

    // 填充位置和颜色
    let v = 0;
    for (let j = 0; j <= NPH; j++) {
      const phi = (j / NPH) * 2 * Math.PI;
      const cph = Math.cos(phi), sph = Math.sin(phi);
      for (let i = 0; i <= NTH; i++) {
        const gamma = (i / NTH) * Math.PI;
        const r = Pn[i];
        const sg = Math.sin(gamma);
        this.patPosArr[v]     = r * sg * cph;
        this.patPosArr[v + 1] = r * Math.cos(gamma);
        this.patPosArr[v + 2] = r * sg * sph;
        const c = this.heatRGB(r);
        this.patColArr[v]     = c[0];
        this.patColArr[v + 1] = c[1];
        this.patColArr[v + 2] = c[2];
        v += 3;
      }
    }

    this.patGeo.attributes.position.needsUpdate = true;
    this.patGeo.attributes.color.needsUpdate = true;
    this.patGeo.computeVertexNormals();

    this.rebuildLobeRings(pm);
    this.refreshStats();
    this.drawPlot();
  },

  rebuildLobeRings(pm) {
    const THREE = this.THREE;
    if (!THREE) return;
    this.clearGroup(this.lobeGroup);

    const st = this.calcStats();
    const cones = this.lobeCones();
    const RING = 60;

    for (const c of cones) {
      const isMain = Math.abs(c.gamma - st.gamma0) < 0.05;
      const r = this.P(c.gamma) / pm;
      if (r < 0.02) continue;
      const pts = [];
      const sg = Math.sin(c.gamma), cy = Math.cos(c.gamma);
      for (let j = 0; j <= RING; j++) {
        const phi = (j / RING) * 2 * Math.PI;
        pts.push(new THREE.Vector3(
          r * sg * Math.cos(phi),
          r * cy,
          r * sg * Math.sin(phi)
        ));
      }
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      this.lobeGroup.add(new THREE.LineLoop(g, new THREE.LineBasicMaterial({
        color: isMain ? 0x33ff88 : 0xff4444,
      })));
    }
  },

  refreshStats() {
    const st = this.calcStats();
    this.setData({
      stats: {
        theta: Math.round(st.gamma0 * 180 / Math.PI),
        dbi: st.dbi.toFixed(1),
        hpbw: st.HPBW,
        sll: st.sllDb < -99 ? '—' : st.sllDb.toFixed(0),
        grating: st.grating,
      }
    });
  },

  // ═══════════════════════════════════════════════════════════════
  //  动画循环
  // ═══════════════════════════════════════════════════════════════

  startAnim() {
    if (this.animId || !this.canvasNode) return;
    const tick = () => {
      this.animId = this.canvasNode.requestAnimationFrame(tick);

      // 自动扫描
      if (this.data.scanOn) {
        this.scanPhase += 0.012;
        const A = Math.min(this.state.d * 360, 180);
        const beta = Math.round(A * Math.sin(this.scanPhase));
        this.state.beta = beta;
        this.setData({ 'S.beta': beta });
        this.updatePattern();
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

  // ═══════════════════════════════════════════════════════════════
  //  触摸事件（双击复位 + 闲置自转）
  // ═══════════════════════════════════════════════════════════════

  onTouchStart(e) { stage.touchStart(this, e); },
  onTouchMove(e) { stage.touchMove(this, e); },
  onTouchEnd(e) { stage.touchEnd(this, e); },

  // ═══════════════════════════════════════════════════════════════
  //  参数控制（拖动节流 + 松手精修）
  // ═══════════════════════════════════════════════════════════════

  onN(e) {
    this.state.N = e.detail.value;
    this.setData({ 'S.N': e.detail.value });
    this.rebuildElements();
    this.updatePattern();
  },
  onNChanging(e) {
    this.state.N = e.detail.value;
    this.setData({ 'S.N': e.detail.value });
    stage.throttle(this, 55, function () { this.rebuildElements(); this.updatePattern(); });
  },

  onD(e) {
    this.state.d = e.detail.value;
    this.setData({ 'S.d': e.detail.value });
    this.rebuildElements();
    this.updatePattern();
  },
  onDChanging(e) {
    this.state.d = e.detail.value;
    this.setData({ 'S.d': e.detail.value });
    stage.throttle(this, 55, function () { this.rebuildElements(); this.updatePattern(); });
  },

  onBeta(e) {
    this.state.beta = e.detail.value;
    this.setData({ 'S.beta': e.detail.value, scanOn: false });
    this.scanPhase = 0;
    this.updatePattern();
  },
  onBetaChanging(e) {
    this.state.beta = e.detail.value;
    this.setData({ 'S.beta': e.detail.value, scanOn: false });
    this.scanPhase = 0;
    stage.throttle(this, 55, function () { this.updatePattern(); });
  },

  setBroadside() {
    haptic.light();
    this.state.beta = 0;
    this.setData({ 'S.beta': 0, scanOn: false });
    this.scanPhase = 0;
    this.updatePattern();
  },

  setEndfireFwd() {
    haptic.light();
    const b = -Math.min(this.state.d * 360, 180);
    this.state.beta = Math.round(b);
    this.setData({ 'S.beta': Math.round(b), scanOn: false });
    this.scanPhase = 0;
    this.updatePattern();
  },

  setEndfireBack() {
    haptic.light();
    const b = Math.min(this.state.d * 360, 180);
    this.state.beta = Math.round(b);
    this.setData({ 'S.beta': Math.round(b), scanOn: false });
    this.scanPhase = 0;
    this.updatePattern();
  },

  setIso() {
    haptic.light();
    this.state.el = 'iso';
    this.setData({ 'S.el': 'iso' });
    this.updatePattern();
  },

  setDipole() {
    haptic.light();
    this.state.el = 'dipole';
    this.setData({ 'S.el': 'dipole' });
    this.updatePattern();
  },

  toggleScan() {
    haptic.light();
    const scanOn = !this.data.scanOn;
    this.setData({ scanOn });
    if (scanOn) this.scanPhase = 0;
  },

  // ═══════════════════════════════════════════════════════════════
  //  2D 极坐标子图
  // ═══════════════════════════════════════════════════════════════

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
      this.plotCanvas = canvas;
      this.plotCtx = ctx;
      this.plotW = r.width;
      this.plotH = r.height;
    });
  },

  drawPlot() {
    if (!this.plotCtx) return;
    const ctx = this.plotCtx;
    const w = this.plotW, h = this.plotH;
    const FLOOR = -40;

    ctx.fillStyle = '#1c2130';
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2, cy = h / 2;
    const R = Math.min(w, h) / 2 - 20;

    // dB 圆栅格
    ctx.strokeStyle = '#313a55';
    ctx.lineWidth = 0.5;
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'left';
    for (const db of [0, -10, -20, -30]) {
      const rr = R * (db - FLOOR) / -FLOOR;
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, 2 * Math.PI);
      ctx.stroke();
      if (db < 0) ctx.fillText(db + '', cx + 2, cy - rr + 9);
    }

    // 十字线
    ctx.strokeStyle = '#313a55';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(cx - R - 8, cy); ctx.lineTo(cx + R + 8, cy);
    ctx.moveTo(cx, cy - R - 8); ctx.lineTo(cx, cy + R + 8);
    ctx.stroke();

    // 方向图曲线
    const pm = this.Pmax();
    const Ns = 360;
    const pts = [];
    for (let i = 0; i <= Ns; i++) {
      const gamma = i / Ns * Math.PI;
      const val = this.P(gamma) / pm;
      const db = 20 * Math.log10(Math.max(val, 1e-4));
      const rn = Math.max(0, (db - FLOOR) / -FLOOR);
      pts.push({
        x: cx + R * rn * Math.sin(gamma),
        y: cy - R * rn * Math.cos(gamma),
      });
    }
    // 镜像
    for (let i = Ns; i >= 0; i--) {
      const gamma = i / Ns * Math.PI;
      const val = this.P(gamma) / pm;
      const db = 20 * Math.log10(Math.max(val, 1e-4));
      const rn = Math.max(0, (db - FLOOR) / -FLOOR);
      pts.push({
        x: cx - R * rn * Math.sin(gamma),
        y: cy - R * rn * Math.cos(gamma),
      });
    }

    // 填充
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
      else ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(108,136,232,0.14)';
    ctx.fill();

    // 描边
    ctx.strokeStyle = '#6c88e8';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
      else ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.closePath();
    ctx.stroke();
  },
});

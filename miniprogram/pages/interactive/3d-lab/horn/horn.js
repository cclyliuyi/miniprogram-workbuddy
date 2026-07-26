// pages/interactive/3d-lab/horn/horn.js —— 角锥喇叭天线 3D（r108）· 暖纸舞台
// 物理模型（Balanis《Antenna Theory》4th, Ch.13 口径天线）：
//   边缘程差 Δ = √(R²+(A/2)²) − R（λ 计），最大二次相位 δmax = 2πΔ（精确几何，泰勒展开即 A²/8R）
//   口径分布（可分离方口径 A×A）：
//     E 面 g(u) = 1（TE10 沿 E 面均匀）
//     H 面 g(u) = p + (1−p)·cos(πu/2)，p = 10^(−边缘电平/20)（pedestal-cosine；p=0 即纯 TE10 余弦）
//   方向图（1D 口径积分 + 单元因子）：
//     F(θ) = (1+cosθ)/2 · |∫₋₁¹ g(u)·exp(j[πA·u·sinθ − δmax·u²]) du|
//   口径效率（Fresnel 型积分，θ=0 的同一积分给出，读数与曲线自洽）：
//     η_plane = |∫g·e^(−jδmax·u²)du|² / (2∫g²du)，G = 10lg(4π·ηE·ηH·(A/λ)²)
//     校验：δ=0 时 ηE=1、ηH(p=0)=8/π²（TE10 经典因子）
//   HPBW 直接在数值方向图上搜 −3 dB 点 —— 无任何拟合系数。
const { registerOrbitControls } = require('../orbit-controls');
const stage = require('../lab3d-stage');
const lc = require('../../../../utils/lab-canvas');
const { THEME, rampColor } = require('../../../../utils/lab-theme');

const ASTEP = 1;        // 方向图角度步长（°），−90..90
const SCALE = 0.12;     // 场景缩放：1λ = 0.12 单位

Page({
  data: {
    aSlider: 60, aVal: '6.0 λ',
    lSlider: 80, lVal: '8.0 λ',
    tapSlider: 10, tapVal: '-10 dB',
    phase: '—', gain: '—', flare: '—', hpbw: '—',
    showHint: true,
    glReady: false,
  },

  THREE: null, canvasNode: null, renderer: null, scene: null,
  camera: null, controls: null, root: null,
  hornGroup: null, phaseGroup: null,
  animId: null,
  state: { A: 6, R: 8, tap: 10 },
  plotCtx: null, plotW: 0, plotH: 0,
  lastKey: '', _cache: null,

  onLoad() { this.renderAll(); },   // 读数先行，避免首帧占位符
  onReady() {
    this.initThree();
    stage.init2D(this, '#plot', (ctx, w, h) => {
      this.plotCtx = ctx; this.plotW = w; this.plotH = h;
      this.drawPlot(this.compute());
    });
  },
  onUnload() { this.dispose(); },
  onHide() { this.stopAnim(); stage.clearTimers(this); },
  onShow() { if (this.canvasNode && this.renderer) { this.startAnim(); stage.scheduleIdle(this); } },

  initThree() {
    stage.initThree(this, '#three-canvas', {
      cameraPos: [1.15, 0.9, 1.55],
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
        controls.target.set(0, 0, 0.1);
        controls.update();
        this.controls = controls;
        this._home = stage.saveHome(controls);

        const root = new THREE.Group();
        this.scene.add(root);
        this.root = root;
        this.hornGroup = new THREE.Group();
        this.phaseGroup = new THREE.Group();
        root.add(this.hornGroup, this.phaseGroup);

        this.lastKey = '';       // 强制首次搭建
        this.renderAll();
        this.startAnim();
        stage.ready(this);
      },
    });
  },

  // ═══════════════ 物理：口径积分（无魔法系数）═══════════════
  // 口径分布 g(u)，u ∈ [−1,1]
  gDist(plane, u, p) {
    return plane === 'H' ? p + (1 - p) * Math.cos(Math.PI * u / 2) : 1;
  },

  // ∫₋₁¹ g(u)·exp(j[πA·u·sinθ − δmax·u²]) du 的模（梯形积分）
  apInt(plane, sinTh, A, dMax, p, N) {
    const du = 2 / N;
    let re = 0, im = 0;
    for (let i = 0; i <= N; i++) {
      const u = -1 + i * du;
      const w = (i === 0 || i === N) ? 0.5 : 1;
      const g = this.gDist(plane, u, p);
      const ph = Math.PI * A * u * sinTh - dMax * u * u;
      re += w * g * Math.cos(ph);
      im += w * g * Math.sin(ph);
    }
    return Math.hypot(re, im) * du;
  },

  // 数值方向图上搜 −3 dB 点（自峰值向外，线性内插）；无交点返回 null
  hpbwOf(ang, db) {
    let mi = 0;
    for (let i = 1; i < db.length; i++) if (db[i] > db[mi]) mi = i;
    for (let j = mi + 1; j < db.length; j++) {
      if (db[j] <= -3) {
        const t = (-3 - db[j - 1]) / (db[j] - db[j - 1]);
        return 2 * (ang[j - 1] + t * ASTEP - ang[mi]);
      }
    }
    return null;
  },

  compute() {
    const S = this.state;
    const key = [S.A, S.R, S.tap].join('|');
    if (this._cache && this._cache.key === key) return this._cache;

    const A = S.A, R = S.R;
    const edge = Math.sqrt(R * R + (A / 2) ** 2) - R;    // λ
    const phaseDeg = 360 * edge;
    const dMax = 2 * Math.PI * edge;                     // rad
    const flare = Math.atan((A / 2) / R) * 180 / Math.PI;
    const p = Math.pow(10, -S.tap / 20);
    // 积分点数按最快相位变化自适应（πA·sinθ 项 + 二次项）
    const N = Math.min(400, Math.max(64, Math.ceil(4 * (Math.PI * A + 2 * dMax))));

    // 口径效率：θ=0 的同一积分（分子）/ 2∫g²du（分母）
    const effPlane = (plane) => {
      const num = this.apInt(plane, 0, A, dMax, p, N) ** 2;
      const du = 2 / N;
      let den = 0;
      for (let i = 0; i <= N; i++) {
        const w = (i === 0 || i === N) ? 0.5 : 1;
        den += w * this.gDist(plane, -1 + i * du, p) ** 2;
      }
      return num / (2 * den * du);
    };
    const etaE = effPlane('E');
    const etaH = effPlane('H');
    const gain = 10 * Math.log10(4 * Math.PI * etaE * etaH * A * A);

    // E/H 面数值方向图（含单元因子 (1+cosθ)/2），各自归一化
    const ang = [], eRaw = [], hRaw = [];
    for (let i = 0; i <= 180 / ASTEP * 2; i++) {
      const deg = -90 + i * ASTEP;
      const th = deg * Math.PI / 180;
      const el = (1 + Math.cos(th)) / 2;
      ang.push(deg);
      eRaw.push(el * this.apInt('E', Math.sin(th), A, dMax, p, N));
      hRaw.push(el * this.apInt('H', Math.sin(th), A, dMax, p, N));
    }
    const toDb = (arr) => {
      const mx = Math.max(...arr) || 1;
      return arr.map((v) => Math.max(-60, 20 * Math.log10(Math.max(v / mx, 1e-6))));
    };
    const eDb = toDb(eRaw), hDb = toDb(hRaw);

    this._cache = {
      key, edge, phaseDeg, dMax, flare, etaE, etaH, gain,
      ang, eDb, hDb,
      hpbwE: this.hpbwOf(ang, eDb),
      hpbwH: this.hpbwOf(ang, hDb),
    };
    return this._cache;
  },

  // ═══════════════ 3D 几何（材质色一律取 stage.THEME3D / lab-theme）═══════════════
  layout3d(m) {
    const THREE = this.THREE;
    if (!THREE) return;
    const C = stage.THEME3D;
    const S = this.state;
    stage.clearGroup(this.hornGroup);
    stage.clearGroup(this.phaseGroup);

    const ap = S.A * SCALE, R = S.R * SCALE, th = 0.26 * SCALE;
    const thr = Math.max(0.42 * SCALE, ap * 0.18);
    const z0 = -R / 2, z1 = R / 2;

    // ── 喇叭壁 · 赭金 ──
    const pts = [
      [-thr / 2, -thr / 2, z0], [thr / 2, -thr / 2, z0],
      [thr / 2, thr / 2, z0], [-thr / 2, thr / 2, z0],
      [-ap / 2, -ap / 2, z1], [ap / 2, -ap / 2, z1],
      [ap / 2, ap / 2, z1], [-ap / 2, ap / 2, z1]
    ].map((q) => new THREE.Vector3(q[0], q[1], q[2]));

    const faces = [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
    const posArr = [];
    faces.forEach((f) => {
      const [a, b, c, d] = f;
      [[a, b, c], [a, c, d]].forEach((t) => t.forEach((i) => {
        posArr.push(pts[i].x, pts[i].y, pts[i].z);
      }));
    });
    const geo = new THREE.BufferGeometry();
    geo.addAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));  // r108 API
    geo.computeVertexNormals();
    this.hornGroup.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: C.gold, metalness: 0.35, roughness: 0.55,
      side: THREE.DoubleSide, transparent: true, opacity: 0.92,
    })));

    // 棱线 + 口径边框 · 暖灰/赤陶勾边
    const edgeLines = [];
    [0, 1, 2, 3].forEach((i) => { edgeLines.push(pts[i], pts[i + 4]); });
    this.hornGroup.add(new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(edgeLines),
      new THREE.LineBasicMaterial({ color: C.warmGray, transparent: true, opacity: 0.8 })
    ));
    this.hornGroup.add(new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([pts[4], pts[5], pts[6], pts[7]]),
      new THREE.LineBasicMaterial({ color: C.accent, transparent: true, opacity: 0.9 })
    ));

    // ── 喉部（馈电波导段）· 暖灰 ──
    const throat = new THREE.Mesh(
      new THREE.BoxGeometry(thr * 0.82, thr * 0.82, th),
      new THREE.MeshStandardMaterial({ color: C.warmGray, metalness: 0.3, roughness: 0.6 })
    );
    throat.position.z = z0 - th * 0.55;
    this.hornGroup.add(throat);

    // ── 口径相位色面：固定标尺 0°→360°（赤陶 ramp 浅→深），随参数真实变化 ──
    const SEG = 29;
    const pg = new THREE.PlaneBufferGeometry(ap, ap, SEG, SEG);
    const ppos = pg.getAttribute('position');
    const col = [];
    for (let i = 0; i < ppos.count; i++) {
      const rl = Math.hypot(ppos.getX(i), ppos.getY(i)) / SCALE;   // 半径（λ）
      const phase = 360 * (Math.hypot(S.R, rl) - S.R);             // 相对中心的相位滞后（°）
      const c = new THREE.Color(rampColor(Math.min(1, phase / 360)));
      col.push(c.r, c.g, c.b);
    }
    pg.addAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const apertureMesh = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.95, side: THREE.DoubleSide,
    }));
    apertureMesh.position.z = z1 + 0.012;
    this.phaseGroup.add(apertureMesh);
  },

  // ═══════════════ 动画（仅阻尼/自转，无装饰性假动画）═══════════════
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

  // ═══════════════ 参数：拖动节流 + 松手精修 ═══════════════
  onAChanging(e) { this.state.A = e.detail.value / 10; stage.throttle(this); },
  onRChanging(e) { this.state.R = e.detail.value / 10; stage.throttle(this); },
  onTapChanging(e) { this.state.tap = e.detail.value; stage.throttle(this); },
  onA(e) { this.state.A = e.detail.value / 10; this.renderAll(); },
  onR(e) { this.state.R = e.detail.value / 10; this.renderAll(); },
  onTap(e) { this.state.tap = e.detail.value; this.renderAll(); },

  fmtHpbw(v) { return v == null ? '>90°' : v.toFixed(1) + '°'; },

  renderAll() {
    const S = this.state;
    const m = this.compute();
    this.setData({
      aVal: S.A.toFixed(1) + ' λ',
      lVal: S.R.toFixed(1) + ' λ',
      tapVal: (S.tap === 0 ? '0' : '-' + S.tap) + ' dB',
      phase: m.phaseDeg.toFixed(0) + '°',
      gain: m.gain.toFixed(1) + ' dBi',
      flare: m.flare.toFixed(1) + '°',
      hpbw: this.fmtHpbw(m.hpbwE) + ' / ' + this.fmtHpbw(m.hpbwH),
    });
    const key = m.key;
    if (key !== this.lastKey) {
      this.layout3d(m);
      this.lastKey = key;
    }
    this.drawPlot(m);
  },

  // ═══════════════ 2D 方向图（lab-canvas 纸底 · 坐标轴 + 刻度 + 图例）═══════════════
  drawPlot(m) {
    if (!this.plotCtx) return;
    if (!m) m = this.compute();
    const ctx = this.plotCtx, w = this.plotW, h = this.plotH;
    lc.clear(ctx, w, h);
    const box = { x: 46, y: 24, w: w - 60, h: h - 66 };
    const p = lc.plot(ctx, box, [-90, 90], [-45, 0]);
    p.axes({
      xTicks: [-90, -60, -30, 0, 30, 60, 90],
      yTicks: [-40, -30, -20, -10, 0],
      xFmt: (v) => v + '°',
      xLabel: 'θ（°）',
      yLabel: '归一化电平（dB）',
    });
    p.area(m.ang, m.eDb, THEME.accent, -45);
    p.line(m.ang, m.eDb, THEME.accent, 2);
    p.line(m.ang, m.hDb, THEME.teal, 2);
    p.guideY(-3);
    lc.label(ctx, '−3 dB', box.x + box.w - 4, p.Y(-3) - 4, {
      align: 'right', color: THEME.muted, font: THEME.fontTick,
    });
    lc.legend(ctx, [
      { name: 'E 面（均匀分布）', color: THEME.accent },
      { name: 'H 面（边缘电平 ' + (this.state.tap === 0 ? '0' : '−' + this.state.tap) + ' dB）', color: THEME.teal },
    ], box.x, h - 12);
  },

  onShareAppMessage() {
    return { title: '喇叭天线 3D 实验室', path: '/pages/interactive/3d-lab/horn/horn' };
  },
});

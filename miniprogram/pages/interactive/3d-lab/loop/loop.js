// pages/interactive/3d-lab/loop/loop.js —— 小环天线 3D（Three.js r108）· 暖纸舞台
// 物理模型（Balanis《Antenna Theory》4th）：
//   Rr = 320π⁴N²(S/λ²)²（Eq.5-24a，rf.smallLoopRr），S = πa²
//   η = Rr/(Rr+Rloss)（Eq.2-90）；D = 1.5（1.76 dBi，Eq.5-30）；G = ηD
//   远场功率方向图 ∝ sin²θ（Eq.5-27b）；磁偶极子场线 r = r₀sin²θ（极向闭合）
// 适用条件：电小环 C = 2πa < 0.1λ（电流沿环等幅同相）
const { registerOrbitControls } = require('../orbit-controls');
const stage = require('../lab3d-stage');
const lc = require('../../../../utils/lab-canvas');
const { THEME, alpha } = require('../../../../utils/lab-theme');
const rf = require('../../../../utils/rf-math');

const A_MIN = 0.005, A_MAX = 0.05;      // a/λ 滑块范围（电小环附近）
const A_SMALL = 0.1 / (2 * Math.PI);    // C=0.1λ 对应 a/λ≈0.0159

Page({
  data: {
    aSlider: 15, aVal: '0.015',
    nSlider: 1, nVal: '1',
    lossSlider: 50, lossVal: '0.50 Ω',
    rr: '-', eta: '-', gain: '-', area: '-',
    warn: '',
    showHint: true,
    glReady: false,
  },

  THREE: null, canvasNode: null, renderer: null, scene: null,
  camera: null, controls: null, root: null,
  fieldGroup: null, patGroup: null, chargeGroup: null,
  loopMesh: null, animId: null,
  state: { a: 0.015, n: 1, loss: 0.5, t: 0 },
  _particles: null,
  plotCtx: null, plotW: 0, plotH: 0,
  etaCtx: null, etaW: 0, etaH: 0,

  onReady() {
    this.initThree();
    stage.init2D(this, '#plot', (ctx, w, h) => {
      this.plotCtx = ctx; this.plotW = w; this.plotH = h;
      this.drawPolar();
    });
    stage.init2D(this, '#etaPlot', (ctx, w, h) => {
      this.etaCtx = ctx; this.etaW = w; this.etaH = h;
      this.updateStats();
    });
  },
  onUnload() { this.dispose(); },
  onHide() { this.stopAnim(); stage.clearTimers(this); },
  onShow() { if (this.canvasNode && this.renderer) { this.startAnim(); stage.scheduleIdle(this); } },

  // ═══ 3D 初始化（暖纸舞台：纸色背景 + 暖白三灯）═══
  initThree() {
    stage.initThree(this, '#three-canvas', {
      cameraPos: [1.45, 1.2, 1.65],
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
        controls.target.set(0, 0, 0);
        controls.update();
        this.controls = controls;
        this._home = stage.saveHome(controls);

        const root = new THREE.Group();
        this.scene.add(root);
        this.root = root;
        this.fieldGroup = new THREE.Group();
        this.patGroup = new THREE.Group();
        this.chargeGroup = new THREE.Group();
        root.add(this.fieldGroup, this.patGroup, this.chargeGroup);

        this.layout();
        this.updateStats();
        this.startAnim();
        stage.ready(this);
      },
    });
  },

  loopR() { return 0.48 + this.state.a * 1.5; },

  // ═══ 场景构建（材质色一律取 stage.THEME3D）═══
  layout() {
    const THREE = this.THREE;
    if (!THREE) return;
    const C = stage.THEME3D;

    stage.clearGroup(this.fieldGroup);
    stage.clearGroup(this.patGroup);
    stage.clearGroup(this.chargeGroup);
    this._particles = null;

    if (this.loopMesh) {
      this.root.remove(this.loopMesh);
      this.loopMesh.geometry.dispose();
      this.loopMesh.material.dispose();
    }

    const R = this.loopR();

    // 载流环 · 赤陶
    this.loopMesh = new THREE.Mesh(
      new THREE.TorusGeometry(R, 0.018, 14, 96),
      new THREE.MeshStandardMaterial({ color: C.accent, metalness: 0.25, roughness: 0.45 })
    );
    this.root.add(this.loopMesh);

    // 磁偶极子场线（极向闭合环）：球坐标场线方程 r = r₀·sin²θ，
    // 在过 z 轴的子午面内取曲线、绕轴复制 6 个方位 —— 每条都穿过环心闭合。
    const fieldMat = new THREE.LineBasicMaterial({
      color: C.gold, transparent: true, opacity: 0.42,
    });
    const NP = 64;
    for (let m = 0; m < 6; m++) {
      const phi = m / 6 * Math.PI * 2;
      const cp = Math.cos(phi), sp = Math.sin(phi);
      [R + 0.28, R + 0.62].forEach((r0) => {
        const pts = [];
        for (let i = 0; i <= NP; i++) {
          const th = 0.06 + (Math.PI - 0.12) * i / NP;   // θ: 0→π（避开原点奇异）
          const r = r0 * Math.sin(th) * Math.sin(th);
          const rho = r * Math.sin(th);                   // 环面内半径
          pts.push(new THREE.Vector3(rho * cp, rho * sp, r * Math.cos(th)));
        }
        this.fieldGroup.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), fieldMat));
      });
    }

    // sin²θ 功率方向图曲面 · 青绿半透明
    const pos = [], idx = [];
    const nt = 40, np = 80;
    for (let i = 0; i <= nt; i++) {
      const th = i / nt * Math.PI;
      const rr = 0.86 * Math.sin(th) * Math.sin(th);
      for (let j = 0; j <= np; j++) {
        const ph = j / np * Math.PI * 2;
        pos.push(rr * Math.sin(th) * Math.cos(ph), rr * Math.sin(th) * Math.sin(ph), rr * Math.cos(th));
      }
    }
    for (let i = 0; i < nt; i++) {
      for (let j = 0; j < np; j++) {
        const a = i * (np + 1) + j, b = a + 1, c = a + (np + 1), d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.addAttribute('position', new THREE.Float32BufferAttribute(pos, 3));  // r108 API
    geo.setIndex(idx);
    geo.computeVertexNormals();
    this.patGroup.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: C.teal, transparent: true, opacity: 0.15, side: THREE.DoubleSide,
    })));

    // 电流粒子 · 靛蓝：预分配 18 个（共享几何/材质），动画只改 position/scale
    const partGeo = new THREE.SphereGeometry(0.028, 8, 8);
    const partMat = new THREE.MeshBasicMaterial({ color: C.indigo, transparent: true, opacity: 1 });
    this._particles = [];
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Mesh(partGeo, partMat);
      this.chargeGroup.add(m);
      this._particles.push(m);
    }
  },

  // 电小环电流等幅同相：粒子同速绕环、大小/亮度随 |cos ωt| 整体呼吸
  updateCharges() {
    if (!this._particles) return;
    const S = this.state;
    const R = this.loopR();
    const breathe = Math.abs(Math.cos(S.t));
    const sc = 0.7 + 0.5 * breathe;
    for (let i = 0; i < this._particles.length; i++) {
      const m = this._particles[i];
      const a = i / this._particles.length * Math.PI * 2 + S.t * 0.6;
      m.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
      m.scale.set(sc, sc, sc);
    }
    this._particles[0].material.opacity = 0.35 + 0.65 * breathe;
  },

  // ═══ 动画循环 ═══
  startAnim() {
    if (this.animId || !this.canvasNode) return;
    const tick = () => {
      this.animId = this.canvasNode.requestAnimationFrame(tick);
      this.state.t += 0.045;
      this.updateCharges();
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

  // ═══ 触摸（双击复位 + 闲置自转）═══
  onTouchStart(e) { stage.touchStart(this, e); },
  onTouchMove(e) { stage.touchMove(this, e); },
  onTouchEnd(e) { stage.touchEnd(this, e); },

  // ═══ 参数控制 ═══
  onA(e) {
    this.state.a = e.detail.value / 1000;
    this.setData({ aVal: this.state.a.toFixed(3) });
    this.updateStats(); this.layout();
  },
  onAChanging(e) {
    this.state.a = e.detail.value / 1000;
    this.setData({ aVal: this.state.a.toFixed(3) });
    stage.throttle(this, 55, function () { this.updateStats(); this.layout(); });
  },
  onTurns(e) {
    this.state.n = e.detail.value;
    this.setData({ nVal: String(this.state.n) });
    this.updateStats();
  },
  onTurnsChanging(e) {
    this.state.n = e.detail.value;
    this.setData({ nVal: String(this.state.n) });
    stage.throttle(this, 55, function () { this.updateStats(); });
  },
  onLoss(e) {
    this.state.loss = e.detail.value / 100;
    this.setData({ lossVal: this.state.loss.toFixed(2) + ' Ω' });
    this.updateStats();
  },
  onLossChanging(e) {
    this.state.loss = e.detail.value / 100;
    this.setData({ lossVal: this.state.loss.toFixed(2) + ' Ω' });
    stage.throttle(this, 55, function () { this.updateStats(); });
  },

  // ═══ 物理读数（公式全部来自 rf-math / Balanis）═══
  calc(a, n, loss) {
    const s1 = Math.PI * a * a;                 // 单匝面积 S/λ²
    const rr = rf.smallLoopRr(s1, n);           // 320π⁴N²(S/λ²)²
    const eta = rr / (rr + loss);
    const gainDbi = rf.linToDb(1.5 * eta);      // G = ηD，D = 1.5
    return { rr, eta, gainDbi, area: n * s1 };
  },
  fmtRr(rr) {
    if (rr < 0.01) return (rr * 1000).toFixed(2) + ' mΩ';
    return rr < 1 ? rr.toFixed(3) + ' Ω' : rr.toFixed(2) + ' Ω';
  },

  updateStats() {
    const S = this.state;
    const v = this.calc(S.a, S.n, S.loss);
    const cOverL = 2 * Math.PI * S.a;
    this.setData({
      rr: this.fmtRr(v.rr),
      eta: (v.eta * 100).toFixed(v.eta < 0.001 ? 3 : 1) + '%',
      gain: v.gainDbi.toFixed(1) + ' dBi',
      area: v.area.toFixed(4),
      warn: cOverL > 0.1
        ? '周长 C = 2πa = ' + cOverL.toFixed(2) + 'λ > 0.1λ，已超出电小环模型适用范围，读数仅供定性参考'
        : '',
    });
    this.drawEta();
  },

  // ═══ 2D 图一：sin²θ 功率方向图（全圆极坐标，dB 刻度）═══
  drawPolar() {
    const ctx = this.plotCtx;
    if (!ctx) return;
    const w = this.plotW, h = this.plotH;
    lc.clear(ctx, w, h);
    const cx = w / 2, cy = h / 2 + 4;
    const R = Math.min(w / 2 - 46, h / 2 - 22);
    const FLOOR = -30;

    lc.polarGrid(ctx, cx, cy, R, { rings: [0, -10, -20, -30], full: true });

    // 10·lg(sin²θ) = 20·lg|sinθ|，θ 自环轴（上）起量，全圆
    ctx.beginPath();
    for (let i = 0; i <= 360; i++) {
      const th = i * Math.PI / 180;
      const s = Math.abs(Math.sin(th));
      let db = s < 1e-6 ? FLOOR : Math.max(FLOOR, 20 * Math.log10(s));
      const r = R * (1 - db / FLOOR);
      const x = cx + r * Math.sin(th), y = cy - r * Math.cos(th);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = alpha(THEME.accent, 0.10);
    ctx.fill();
    ctx.strokeStyle = THEME.accent;
    ctx.lineWidth = 2;
    ctx.stroke();

    lc.label(ctx, '0°（环轴 · 零点）', cx, cy - R - 8, { align: 'center', color: THEME.inkSoft });
    lc.label(ctx, '90°（环面 · 最大）', cx + R * 0.62, cy + 14, { color: THEME.inkSoft });
    lc.label(ctx, '180°', cx, cy + R + 14, { align: 'center', color: THEME.muted, font: THEME.fontTick });
    lc.label(ctx, '径向刻度：dB', cx - R - 6, cy - R - 8, { align: 'left', color: THEME.muted, font: THEME.fontTick });
    lc.legend(ctx, [{ name: '10·lg sin²θ（功率，dB）', color: THEME.accent }], 10, h - 12);
  },

  // ═══ 2D 图二：效率 η 随 a/λ 变化（随 N / Rloss 实时变化）═══
  drawEta() {
    const ctx = this.etaCtx;
    if (!ctx) return;
    const S = this.state;
    const w = this.etaW, h = this.etaH;
    lc.clear(ctx, w, h);
    const box = { x: 44, y: 20, w: w - 60, h: h - 56 };
    const p = lc.plot(ctx, box, [A_MIN, A_MAX], [0, 100]);

    // C>0.1λ 区（模型失效危险区）
    p.bandX(A_SMALL, A_MAX, THEME.dangerSoft);

    p.axes({
      xTicks: [0.01, 0.02, 0.03, 0.04, 0.05],
      yTicks: [0, 25, 50, 75, 100],
      xLabel: 'a/λ（环半径）',
      yLabel: 'η（%）',
    });

    const N = 120, xs = [], ys = [];
    for (let i = 0; i <= N; i++) {
      const a = A_MIN + (A_MAX - A_MIN) * i / N;
      xs.push(a);
      ys.push(this.calc(a, S.n, S.loss).eta * 100);
    }
    p.area(xs, ys, THEME.teal, 0);
    p.line(xs, ys, THEME.teal, 2);

    const now = this.calc(S.a, S.n, S.loss);
    p.guideX(S.a);
    p.dot(S.a, now.eta * 100, THEME.accent);

    lc.label(ctx, 'C > 0.1λ 超模型', p.X(A_SMALL) + 4, box.y + 12, {
      color: THEME.danger, font: THEME.fontTick,
    });
    lc.label(ctx, 'η = Rr/(Rr+Rloss)，N=' + S.n + '，Rloss=' + S.loss.toFixed(2) + 'Ω',
      box.x + 2, box.y - 8, { color: THEME.inkSoft });
    lc.label(ctx, 'a=' + S.a.toFixed(3) + ' → η=' + (now.eta * 100).toFixed(1) + '%',
      p.X(S.a) + 6, p.Y(now.eta * 100) - 8, { color: THEME.accent });
  },

  onShareAppMessage() {
    return { title: '小环天线 3D 实验室', path: '/pages/interactive/3d-lab/loop/loop' };
  },
});

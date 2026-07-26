// pages/interactive/3d-lab/parabolic/parabolic.js —— 抛物面反射器 3D（r108）· 暖纸舞台
// 物理模型（Balanis《Antenna Theory》4th, Ch.15 反射面天线；口径 D = 6λ 固定）：
//   抛物面 z = r²/(4F)；馈源看边缘半张角 θ0 = 2·atan(D/4F)（Balanis 15-25，计入反射面深度）
//   口面相位误差：δ(r) = (2π/λ)·{|馈源→P| + (z_rim − z_P) − 中心路径}（射线光程，轴向离焦 Δz）
//   相位效率（均匀口面幅度的圆口径积分）：η_ph = |∫₀¹ e^{jδ(ρ)}·2ρ dρ|²
//   照明效率（cos²θ 理想馈源的锥削×溢出闭式，Balanis 15-55a）：
//     η_ill = 24·{sin²(θ0/2) + ln[cos(θ0/2)]}²·cot²(θ0/2)（θ0≈66° 时峰值 ≈0.83）
//   增益：G = 10lg(η_ill·η_ph·(πD/λ)²) —— 圆口径 (πD/λ)²，相位峰峰值与增益读数自洽。
const { registerOrbitControls } = require('../orbit-controls');
const stage = require('../lab3d-stage');
const haptic = require('../../../../utils/haptic');
const lc = require('../../../../utils/lab-canvas');
const { THEME, divergeColor } = require('../../../../utils/lab-theme');

const NERR = 80;   // 口面相位误差径向采样数

Page({
  data: {
    fdSlider: 40, fdVal: '0.40',
    raySlider: 18, rayVal: '18 条',
    dzSlider: 0, dzVal: '0.00 f',
    showIn: true, showOut: true, showPhase: true,
    focal: '—', theta: '—', phase: '—', gain: '—',
    showHint: true,
    glReady: false,
  },

  THREE: null, canvasNode: null, renderer: null, scene: null,
  camera: null, controls: null, root: null,
  dishGroup: null, rayGroup: null,
  animId: null,
  state: { fd: 0.40, rays: 18, dz: 0, show: { in: true, out: true, phase: true } },
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

  clamp(v, a, b) { return Math.max(a, Math.min(b, v)); },

  initThree() {
    stage.initThree(this, '#three-canvas', {
      cameraPos: [4.0, -4.3, 3.5],
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
        controls.target.set(0, 0, 0.8);
        controls.update();
        this.controls = controls;
        this._home = stage.saveHome(controls);

        const root = new THREE.Group();
        this.scene.add(root);
        this.root = root;
        this.dishGroup = new THREE.Group();
        this.rayGroup = new THREE.Group();
        root.add(this.dishGroup, this.rayGroup);

        this.lastKey = '';
        this.renderAll();
        this.startAnim();
        stage.ready(this);
      },
    });
  },

  // ═══════════════ 物理（纯数值，不依赖 THREE）═══════════════
  // 馈源(0,0,F+Δz) → 表面(r, z=r²/4F) → 口面参考面 z_rim 的光程（λ 计）
  pathLen(r, F, dz, zRef) {
    const z = r * r / (4 * F);
    return Math.hypot(r, z - F - dz) + (zRef - z);
  },

  compute() {
    const S = this.state;
    const key = [S.fd, S.dz].join('|');
    if (this._cache && this._cache.key === key) return this._cache;

    const D = 6;                                   // 口径（λ）固定
    const F = S.fd * D;
    const dz = S.dz * F;                           // 轴向离焦（λ）
    const theta0 = 2 * Math.atan(1 / (4 * S.fd));  // 馈源看边缘半张角（rad）
    const zRef = (D / 2) ** 2 / (4 * F);

    // 口面相位误差 δ(ρ)（°），ρ = r/(D/2)
    const c0 = this.pathLen(0, F, dz, zRef);
    const err = [];
    for (let i = 0; i <= NERR; i++) {
      const r = (D / 2) * i / NERR;
      err.push((this.pathLen(r, F, dz, zRef) - c0) * 360);
    }

    // 相位效率：η_ph = |∫₀¹ e^{jδ}·2ρdρ|²（梯形积分，均匀幅度）
    let re = 0, im = 0, wsum = 0;
    for (let i = 0; i <= NERR; i++) {
      const rho = i / NERR;
      const w = (i === 0 || i === NERR) ? 0.5 : 1;
      const d = err[i] * Math.PI / 180;
      re += w * rho * Math.cos(d);
      im += w * rho * Math.sin(d);
      wsum += w * rho;
    }
    const etaPh = wsum > 0 ? (re * re + im * im) / (wsum * wsum) : 1;

    // 照明效率（cos²θ 馈源闭式，Balanis 15-55a）
    const t2 = theta0 / 2;
    const etaIll = this.clamp(
      24 * Math.pow(Math.sin(t2) ** 2 + Math.log(Math.cos(t2)), 2) / Math.tan(t2) ** 2,
      0, 1
    );

    const gain = 10 * Math.log10(etaIll * etaPh * (Math.PI * D) ** 2);
    const pp = Math.max(...err) - Math.min(...err);

    this._cache = { key, D, F, dz, theta0, zRef, err, etaPh, etaIll, gain, pp };
    return this._cache;
  },

  // ═══════════════ 3D 几何（材质色一律取 stage.THEME3D / lab-theme）═══════════════
  layout3d(m) {
    const THREE = this.THREE;
    if (!THREE) return;
    const C = stage.THEME3D;
    const S = this.state;
    stage.clearGroup(this.dishGroup);
    stage.clearGroup(this.rayGroup);

    // ── 抛物面网格：顶点色 = 口面相位误差（固定标尺 ±180°：靛蓝=超前 / 赤陶=滞后）──
    const rs = 46, as = 96;
    const pos = [], col = [], idx = [];
    for (let ir = 0; ir <= rs; ir++) {
      const r = m.D / 2 * ir / rs;
      const z = r * r / (4 * m.F);
      const e = m.err[Math.round(ir / rs * NERR)];
      const c = new THREE.Color(divergeColor(this.clamp(e / 180, -1, 1)));
      for (let ia = 0; ia <= as; ia++) {
        const a = ia / as * Math.PI * 2;
        pos.push(r * Math.cos(a), r * Math.sin(a), z);
        col.push(c.r, c.g, c.b);
      }
    }
    for (let ir = 0; ir < rs; ir++) {
      for (let ia = 0; ia < as; ia++) {
        const a = ir * (as + 1) + ia, b = a + 1, c = a + (as + 1), d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.addAttribute('position', new THREE.Float32BufferAttribute(pos, 3));   // r108 API
    geo.addAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const dishMat = S.show.phase
      ? new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })
      : new THREE.MeshStandardMaterial({
          color: C.gold, metalness: 0.35, roughness: 0.55, side: THREE.DoubleSide,
        });
    this.dishGroup.add(new THREE.Mesh(geo, dishMat));

    // 边缘 · 赭金
    const rimPts = [];
    for (let i = 0; i <= 160; i++) {
      const a = i / 160 * Math.PI * 2;
      rimPts.push(new THREE.Vector3(m.D / 2 * Math.cos(a), m.D / 2 * Math.sin(a), m.zRef));
    }
    this.dishGroup.add(new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(rimPts),
      new THREE.LineBasicMaterial({ color: C.gold, transparent: true, opacity: 0.75 })
    ));

    // 焦轴 + 馈源 · 赤陶
    const feed = new THREE.Vector3(0, 0, m.F + m.dz);
    this.dishGroup.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), feed]),
      new THREE.LineBasicMaterial({ color: C.warmGray, transparent: true, opacity: 0.5 })
    ));
    const feedMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 18, 18),
      new THREE.MeshStandardMaterial({ color: C.accent, metalness: 0.25, roughness: 0.5 })
    );
    feedMesh.position.copy(feed);
    this.dishGroup.add(feedMesh);

    // ── 射线：入射 靛蓝 / 反射 青绿；反射线延长到出口平面，离焦时可见汇聚/发散 ──
    const inMat = new THREE.LineBasicMaterial({ color: C.indigo, transparent: true, opacity: 0.55 });
    const outMat = new THREE.LineBasicMaterial({ color: C.teal, transparent: true, opacity: 0.75 });
    const zExit = m.zRef + 2.6;
    const rings = Math.max(1, Math.round(S.rays / 6));
    const per = Math.max(8, Math.round(S.rays / rings));
    for (let ir = 1; ir <= rings; ir++) {
      const r = m.D / 2 * (0.22 + 0.70 * ir / rings);
      for (let ia = 0; ia < per; ia++) {
        const a = ia / per * Math.PI * 2;
        const z = r * r / (4 * m.F);
        const p = new THREE.Vector3(r * Math.cos(a), r * Math.sin(a), z);
        // 镜面反射 r = i − 2(i·n)n，n ∝ (−x,−y,2F)
        const inc = p.clone().sub(feed).normalize();
        const n = new THREE.Vector3(-p.x, -p.y, 2 * m.F).normalize();
        const dir = inc.sub(n.multiplyScalar(2 * inc.dot(n))).normalize();
        const t = dir.z > 0.04 ? Math.min(14, (zExit - p.z) / dir.z) : 3;
        const end = p.clone().add(dir.multiplyScalar(t));
        if (S.show.in) {
          this.rayGroup.add(new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([feed, p]), inMat));
        }
        if (S.show.out) {
          this.rayGroup.add(new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([p, end]), outMat));
        }
      }
    }
  },

  // ═══════════════ 动画（仅阻尼/自转，无装饰性摆动）═══════════════
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
  onFd(e) { this.state.fd = e.detail.value / 100; this.renderAll(); },
  onFdChanging(e) { this.state.fd = e.detail.value / 100; stage.throttle(this); },
  onRays(e) { this.state.rays = e.detail.value; this.renderAll(); },
  onRaysChanging(e) { this.state.rays = e.detail.value; stage.throttle(this); },
  onDz(e) { this.state.dz = e.detail.value / 100; this.renderAll(); },
  onDzChanging(e) { this.state.dz = e.detail.value / 100; stage.throttle(this); },

  onTogIn() { haptic.light(); this.state.show.in = !this.state.show.in; this.setData({ showIn: this.state.show.in }); this.renderAll(); },
  onTogOut() { haptic.light(); this.state.show.out = !this.state.show.out; this.setData({ showOut: this.state.show.out }); this.renderAll(); },
  onTogPhase() { haptic.light(); this.state.show.phase = !this.state.show.phase; this.setData({ showPhase: this.state.show.phase }); this.renderAll(); },

  renderAll() {
    const S = this.state;
    const m = this.compute();
    this.setData({
      fdVal: S.fd.toFixed(2),
      rayVal: S.rays + ' 条',
      dzVal: (S.dz >= 0 ? '+' : '') + S.dz.toFixed(2) + ' f',
      focal: m.F.toFixed(2) + ' λ',
      theta: (m.theta0 * 180 / Math.PI).toFixed(1) + '°',
      phase: m.pp.toFixed(0) + '°',
      gain: m.gain.toFixed(1) + ' dBi',
    });
    this.drawPlot(m);
    const key = [m.key, S.rays, S.show.in, S.show.out, S.show.phase].join('|');
    if (key !== this.lastKey) {
      this.layout3d(m);
      this.lastKey = key;
    }
  },

  // ═══════════════ 2D 口面相位误差（lab-canvas 纸底 · 轴 + 刻度 + 效率联动标注）═══════════════
  drawPlot(m) {
    if (!this.plotCtx) return;
    if (!m) m = this.compute();
    const ctx = this.plotCtx, w = this.plotW, h = this.plotH;
    lc.clear(ctx, w, h);
    const maxAbs = Math.max(...m.err.map((x) => Math.abs(x)));
    const ySpan = Math.max(15, maxAbs * 1.2);
    const box = { x: 52, y: 26, w: w - 66, h: h - 68 };
    const p = lc.plot(ctx, box, [0, 1], [-ySpan, ySpan]);
    p.axes({
      xTicks: [0, 0.25, 0.5, 0.75, 1],
      xFmt: (v) => String(v),
      yFmt: (v) => v.toFixed(0) + '°',
      xLabel: 'r / R（0=中心 → 1=边缘）',
      yLabel: '口面相位误差 δ（°）',
    });
    p.guideY(0);
    const xs = m.err.map((_, i) => i / NERR);
    p.area(xs, m.err, THEME.accent, 0);
    p.line(xs, m.err, THEME.accent, 2);
    // 相位 → 增益的因果联动读数
    const lossDb = -10 * Math.log10(Math.max(m.etaPh, 1e-6));
    lc.label(ctx,
      'η_ph = ' + (m.etaPh * 100).toFixed(1) + '% → 相位损失 ' + lossDb.toFixed(2) + ' dB',
      box.x + box.w, box.y - 8, { align: 'right', color: THEME.ink, font: THEME.fontTitle });
    lc.legend(ctx, [{ name: 'δ(r) 路径相位误差（D = 6λ）', color: THEME.accent }], box.x, h - 12);
  },

  onShareAppMessage() {
    return { title: '抛物面反射天线 3D 实验室', path: '/pages/interactive/3d-lab/parabolic/parabolic' };
  },
});

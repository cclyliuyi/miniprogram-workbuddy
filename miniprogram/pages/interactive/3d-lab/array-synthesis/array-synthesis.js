// pages/interactive/3d-lab/array-synthesis/array-synthesis.js —— 方向图综合 3D（暖纸舞台）
// 物理内核（全部真实公式）：
//   Dolph-Chebyshev 权重：rf.chebyshevWeights（T_{N−1} 采样逆 DFT，数值验证等副瓣精确）
//   Taylor n̄ 权重：F(m) 系数法（Taylor 1955 / Elliott），本页实现（rf-math 暂无），已数值验证
//   阵因子：rf.afWeighted；方向性 D ≈ (2d/λ)·(Σw)²/Σw²；HPBW / 实际 SLL / 零点数由方向图数值搜索
const { registerOrbitControls } = require('../orbit-controls');
const stage = require('../lab3d-stage');
const haptic = require('../../../../utils/haptic');
const rf = require('../../../../utils/rf-math');
const lc = require('../../../../utils/lab-canvas');
const { THEME, alpha, rampColor } = require('../../../../utils/lab-theme');

const METHOD_LABELS = { chebyshev: 'Dolph-Chebyshev', taylor: 'Taylor', uniform: '均匀' };

Page({
  data: {
    nSlider: 8, nVal: '8 元',
    dSlider: 50, dVal: '0.50 λ',
    method: 'chebyshev',
    sllSlider: -20, sllVal: '-20 dB',
    nbar: 4, nbarList: [3, 4, 5, 6],
    dbi: '-', hpbw: '-', actualSll: '-', nulCount: '-',
    showHint: true,
    glReady: false,
  },

  THREE: null, canvasNode: null, renderer: null, scene: null,
  camera: null, controls: null,
  elemGroup: null, patternGroup: null,
  animId: null,
  state: { N: 8, d: 0.5, method: 'chebyshev', SLL: -20, nbar: 4 },

  onReady() {
    this.initThree();
    this.renderAll();   // 读数与 2D 切面不依赖 WebGL，先行渲染
  },
  onUnload() { this.dispose(); },
  onHide() { this.stopAnim(); stage.clearTimers(this); },
  onShow() { if (this.canvasNode && this.renderer) { this.startAnim(); stage.scheduleIdle(this); } },

  initThree() {
    stage.initThree(this, '#three-canvas', {
      cameraPos: [2.7, 1.9, 2.7],
      onReady: (env) => {
        this.THREE = env.THREE;
        this.canvasNode = env.canvas;
        this.renderer = env.renderer;
        this.scene = env.scene;
        this.camera = env.camera;

        registerOrbitControls(env.THREE);
        const controls = new env.THREE.OrbitControls(env.camera, env.canvas);
        controls.enableDamping = true;
        controls.autoRotateSpeed = 1.0;
        controls.update();
        this.controls = controls;
        this._home = stage.saveHome(controls);

        this.elemGroup = new env.THREE.Group();
        this.patternGroup = new env.THREE.Group();
        env.scene.add(this.elemGroup, this.patternGroup);

        this.renderAll();
        this.startAnim();
        stage.ready(this);
      },
    });
  },

  // ── 权重 ──
  // Taylor n̄ 线源综合（F(m) 空间因子系数 → 元位置采样）。
  // 数值验证：N=16、SLL −15/−20/−25/−30、n̄=3..6 时实测首副瓣与设定偏差 < 0.6 dB。
  taylorWeights(N, sllDbPos, nbar) {
    const R = Math.pow(10, sllDbPos / 20);              // 主瓣/副瓣电压比（>1）
    const A = Math.acosh(R) / Math.PI;
    const s2 = nbar * nbar / (A * A + (nbar - 0.5) * (nbar - 0.5)); // σ²（展宽因子平方）
    const F = [];
    for (let m = 1; m < nbar; m++) {
      let num = 1;
      for (let n = 1; n < nbar; n++) num *= 1 - (m * m) / (s2 * (A * A + (n - 0.5) * (n - 0.5)));
      let den = 1;
      for (let n = 1; n < nbar; n++) if (n !== m) den *= 1 - (m * m) / (n * n);
      F.push((Math.pow(-1, m + 1) / 2) * num / den);
    }
    const w = [];
    for (let p = 0; p < N; p++) {
      const xi = (p - (N - 1) / 2) / N;                 // 元位置 ∈ (−1/2, 1/2)
      let v = 1;
      for (let m = 1; m < nbar; m++) v += 2 * F[m - 1] * Math.cos(2 * Math.PI * m * xi);
      w.push(v);
    }
    const peak = Math.max(...w.map(Math.abs));
    return w.map((v) => v / peak);
  },

  getWeights() {
    const S = this.state;
    if (S.method === 'chebyshev') return rf.chebyshevWeights(S.N, -S.SLL);
    if (S.method === 'taylor') return this.taylorWeights(S.N, -S.SLL, S.nbar);
    return new Array(S.N).fill(1);
  },

  // 归一化阵因子 |AF|(θ)，θ 为与阵轴（y 轴）夹角，边射主瓣在 θ=90°
  afTheta(weights, kd, thetaRad, r0) {
    return rf.afWeighted(weights, kd * Math.cos(thetaRad)) / r0;
  },

  // ── 主重算：指标 + 3D + 2D ──
  renderAll() {
    const S = this.state;
    const weights = this.getWeights();
    const kd = 2 * Math.PI * S.d;
    const r0 = rf.afWeighted(weights, 0);
    const D2R = Math.PI / 180;

    // 方向性 D ≈ (2d/λ)·(Σw)²/Σw²（各向同性元、边射、无栅瓣近似；d=λ/2 均匀阵 → N）
    let sumW = 0, sumW2 = 0;
    for (let n = 0; n < S.N; n++) { sumW += weights[n]; sumW2 += weights[n] * weights[n]; }
    const dLin = 2 * S.d * sumW * sumW / sumW2;
    const dbi = 10 * Math.log10(dLin);

    // HPBW：从主瓣 90° 向外数值搜 −3 dB 点（自动含锥削展宽）
    let hpbw = NaN;
    for (let t = 90; t <= 180; t += 0.05) {
      if (this.afTheta(weights, kd, t * D2R, r0) <= Math.SQRT1_2) { hpbw = 2 * (t - 90); break; }
    }

    // 实际 SLL：先找主瓣外第一零点，再搜其后峰值
    const step = 0.05;
    let prev = 1, nullTh = NaN;
    for (let t = 90 + step; t <= 180; t += step) {
      const v = this.afTheta(weights, kd, t * D2R, r0);
      if (v > prev) { nullTh = t - step; break; }
      prev = v;
    }
    let maxSll = -Infinity;
    if (isFinite(nullTh)) {
      for (let t = nullTh; t <= 180; t += step) {
        const db = 20 * Math.log10(this.afTheta(weights, kd, t * D2R, r0) + 1e-12);
        if (db > maxSll) maxSll = db;
      }
    }

    // 可见区零点数：局部极小且深于 −12 dB
    const samp = [];
    for (let t = 0; t <= 180; t += 0.25) samp.push(this.afTheta(weights, kd, t * D2R, r0));
    let nulls = 0;
    for (let i = 1; i < samp.length - 1; i++) {
      if (samp[i] <= samp[i - 1] && samp[i] < samp[i + 1] &&
        20 * Math.log10(samp[i] + 1e-12) < -12) nulls++;
    }

    this.setData({
      dbi: isFinite(dbi) ? dbi.toFixed(1) : '-',
      hpbw: isFinite(hpbw) ? hpbw.toFixed(1) + '°' : '>180°',
      actualSll: isFinite(maxSll) ? maxSll.toFixed(1) + ' dB' : '无副瓣',
      nulCount: String(nulls),
    });

    this.buildPattern3D(weights, kd, r0);
    this.buildElements();
    this.draw2D(weights, kd, r0);
  },

  // ── 3D 方向图（半径 ∝ √|AF|，视觉压缩以便观察副瓣；着色 = 赤陶 ramp）──
  buildPattern3D(weights, kd, r0) {
    const THREE = this.THREE;
    if (!THREE) return;
    stage.clearGroup(this.patternGroup);

    // ramp 色 LUT（避免逐顶点解析 hex）
    const LUT = [];
    for (let i = 0; i <= 24; i++) {
      const hex = rampColor(i / 24).replace('#', '');
      LUT.push([
        parseInt(hex.slice(0, 2), 16) / 255,
        parseInt(hex.slice(2, 4), 16) / 255,
        parseInt(hex.slice(4, 6), 16) / 255,
      ]);
    }

    const NTH = 60, NPH = 72;
    const pos = [], col = [], idx = [];
    for (let j = 0; j <= NPH; j++) {
      const phi = (j / NPH) * 2 * Math.PI;
      for (let i = 0; i <= NTH; i++) {
        const theta = (i / NTH) * Math.PI;          // θ 为与阵轴 y 的夹角
        const af = this.afTheta(weights, kd, theta, r0);
        const r = Math.sqrt(af);                    // 显示压缩（注脚已注明）
        pos.push(
          r * Math.sin(theta) * Math.cos(phi),
          r * Math.cos(theta),
          r * Math.sin(theta) * Math.sin(phi)
        );
        const c = LUT[Math.max(0, Math.min(24, Math.round(af * 24)))];
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

    // r108: addAttribute
    const geo = new THREE.BufferGeometry();
    geo.addAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.addAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();

    this.patternGroup.add(new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
      vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.92,
    })));
  },

  // ── 阵元（沿 y 轴，间距与 d/λ 真实联动，超长时整体等比缩放到舞台内）──
  buildElements() {
    const THREE = this.THREE;
    if (!THREE) return;
    const S = this.state;
    stage.clearGroup(this.elemGroup);

    const U = 0.24;                                  // 场景单位 / λ
    const rawLen = (S.N - 1) * S.d * U;
    const fit = Math.min(1, 2.4 / Math.max(rawLen, 1e-6));
    const span = rawLen * fit;
    for (let n = 0; n < S.N; n++) {
      const y = (S.N === 1 ? 0 : n / (S.N - 1) - 0.5) * span;
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.03, 10, 10),
        new THREE.MeshPhongMaterial({ color: stage.THEME3D.gold })
      );
      sphere.position.set(0, y, 0);
      this.elemGroup.add(sphere);
    }
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -span / 2 - 0.05, 0),
      new THREE.Vector3(0, span / 2 + 0.05, 0),
    ]);
    this.elemGroup.add(new THREE.Line(lineGeo,
      new THREE.LineBasicMaterial({ color: stage.THEME3D.warmGray })));
  },

  // ── 2D dB 方向图（lab-canvas，纸底 + θ 轴刻度）──
  draw2D(weights, kd, r0) {
    if (!weights) {                                  // 允许无参调用（自行取当前状态）
      weights = this.getWeights();
      kd = 2 * Math.PI * this.state.d;
      r0 = rf.afWeighted(weights, 0);
    }
    if (this._plot) { this._draw2D(this._plot, weights, kd, r0); return; }
    lc.mount(this, '#plot', (ctx, w, h) => {
      this._plot = { ctx, w, h };
      this._draw2D(this._plot, weights, kd, r0);
    });
  },

  _draw2D(pl, weights, kd, r0) {
    const { ctx, w, h } = pl;
    const S = this.state;
    lc.clear(ctx, w, h);
    const box = { x: 44, y: 20, w: w - 58, h: h - 56 };
    const p = lc.plot(ctx, box, [0, 180], [-40, 0]);
    p.axes({
      xTicks: [0, 45, 90, 135, 180],
      yTicks: [0, -10, -20, -30, -40],
      xFmt: (v) => v + '°',
      xLabel: 'θ（与阵轴夹角）',
      yLabel: '|AF| dB',
    });

    const D2R = Math.PI / 180;
    const xs = [], ysW = [], ysU = [];
    const uni = new Array(S.N).fill(1);
    for (let t = 0; t <= 180; t += 0.5) {
      xs.push(t);
      ysW.push(20 * Math.log10(this.afTheta(weights, kd, t * D2R, r0) + 1e-12));
      ysU.push(20 * Math.log10(rf.afWeighted(uni, kd * Math.cos(t * D2R)) + 1e-12));
    }

    const methodName = S.method === 'taylor'
      ? 'Taylor n̄=' + S.nbar
      : METHOD_LABELS[S.method];

    if (S.method !== 'uniform') {
      // 均匀参考（赭金虚线）
      ctx.save();
      ctx.setLineDash([4, 3]);
      p.line(xs, ysU, THEME.gold, 1.5);
      ctx.restore();
      // SLL 目标线（青绿虚线）
      p.guideY(S.SLL, alpha(THEME.teal, 0.85));
      lc.label(ctx, 'SLL 目标 ' + S.SLL + ' dB', box.x + box.w - 4, p.Y(S.SLL) - 5,
        { align: 'right', color: THEME.teal, font: THEME.fontTick });
    }
    p.line(xs, ysW, THEME.accent, 2);

    const items = [{ name: methodName, color: THEME.accent }];
    if (S.method !== 'uniform') items.push({ name: '均匀参考', color: THEME.gold });
    lc.legend(ctx, items, box.x + 4, box.y + 10);
  },

  // ── 动画/触摸/生命周期 ──
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

  // ── 参数事件 ──
  onN(e) {
    this.state.N = e.detail.value;
    this.setData({ nVal: this.state.N + ' 元' });
    this.renderAll();
  },
  onNChanging(e) {
    this.state.N = e.detail.value;
    this.setData({ nVal: this.state.N + ' 元' });
    stage.throttle(this);
  },
  onD(e) {
    this.state.d = e.detail.value / 100;
    this.setData({ dVal: this.state.d.toFixed(2) + ' λ' });
    this.renderAll();
  },
  onDChanging(e) {
    this.state.d = e.detail.value / 100;
    this.setData({ dVal: this.state.d.toFixed(2) + ' λ' });
    stage.throttle(this);
  },
  onMethod(e) {
    haptic.light();
    this.state.method = e.currentTarget.dataset.m;
    this.setData({ method: this.state.method });
    this.renderAll();
  },
  onNbar(e) {
    haptic.light();
    const nb = Number(e.currentTarget.dataset.nb) || 4;
    this.state.nbar = nb;
    this.setData({ nbar: nb });
    this.renderAll();
  },
  onSll(e) {
    if (this.state.method === 'uniform') return;
    this.state.SLL = e.detail.value;
    this.setData({ sllVal: this.state.SLL + ' dB' });
    this.renderAll();
  },
  onSllChanging(e) {
    if (this.state.method === 'uniform') return;
    this.state.SLL = e.detail.value;
    this.setData({ sllVal: this.state.SLL + ' dB' });
    stage.throttle(this);
  },

  onShareAppMessage() {
    return { title: '方向图综合实验室', path: '/pages/interactive/3d-lab/array-synthesis/array-synthesis' };
  },
});

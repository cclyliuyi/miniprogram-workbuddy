// pages/interactive/3d-lab/traveling-wave/traveling-wave.js —— 行波天线 3D（r108）· 暖纸舞台
// 物理模型（Balanis《Antenna Theory》4th，Ch.10）：
//   线上电流（无耗）：I(z′) = e^{−jβz′} + Γ e^{+jβz′}，β = 2π/λ
//   远场（含线元的元因子 sinΘ，Balanis 10-1a）：
//     E(θ) ∝ Σ_臂 sinΘ_臂 · ∫₀ᴸ I(z′) e^{jβz′cosΘ_臂} dz′，Θ_臂 = 臂轴与观察方向夹角
//   纯行波长线主瓣锥角 θmax ≈ arccos(1 − 0.371λ/L)（Balanis 10-4）；轴向为零点
//   电流驻波比 SWR = (1+|Γ|)/(1−|Γ|)（Pozar 2-41）
const { registerOrbitControls } = require('../orbit-controls');
const stage = require('../lab3d-stage');
const haptic = require('../../../../utils/haptic');
const lc = require('../../../../utils/lab-canvas');
const { THEME, alpha } = require('../../../../utils/lab-theme');
const rf = require('../../../../utils/rf-math');

const ASTEP = 2;                 // 方向图角度步长（°），全圆 180 点
const WIRE_SCALE = 0.32;         // 场景缩放：1λ = 0.32 单位

Page({
  data: {
    geo: 'line',
    lSlider: 30, lVal: '3.0 λ',
    gSlider: 15, gVal: '0.15',
    angSlider: 35, angVal: '35°',
    mainAng: '-', fb: '-', swr: '-', mode: '-',
    showHint: true,
    glReady: false,
  },

  THREE: null, canvasNode: null, renderer: null, scene: null,
  camera: null, controls: null, root: null,
  wireGroup: null, currGroup: null, patternGroup: null,
  animId: null,
  state: { geo: 'line', L: 3, ref: 0.15, ang: 35, t: 0 },
  _parts: null, _patCache: null,
  plotCtx: null, plotW: 0, plotH: 0,

  onReady() {
    this.initThree();
    stage.init2D(this, '#plot', (ctx, w, h) => {
      this.plotCtx = ctx; this.plotW = w; this.plotH = h;
      this.drawPlot(this.pattern());
    });
  },
  onUnload() { this.dispose(); },
  onHide() { this.stopAnim(); stage.clearTimers(this); },
  onShow() { if (this.canvasNode && this.renderer) { this.startAnim(); stage.scheduleIdle(this); } },

  initThree() {
    stage.initThree(this, '#three-canvas', {
      cameraPos: [1.8, 1.3, 2.1],
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
        controls.target.set(0, 0, 0.35);
        controls.update();
        this.controls = controls;
        this._home = stage.saveHome(controls);

        const root = new THREE.Group();
        this.scene.add(root);
        this.root = root;
        this.wireGroup = new THREE.Group();
        this.currGroup = new THREE.Group();
        this.patternGroup = new THREE.Group();
        root.add(this.wireGroup, this.currGroup, this.patternGroup);

        this.renderStatic();
        this.startAnim();
        stage.ready(this);
      },
    });
  },

  // 臂方向（单位向量，x-z 平面；长线沿 z，V 形对称于 z 轴）
  armDirs() {
    const S = this.state;
    if (S.geo === 'line') return [{ x: 0, z: 1 }];
    const a = S.ang * Math.PI / 180;
    return [{ x: Math.sin(a), z: Math.cos(a) }, { x: -Math.sin(a), z: Math.cos(a) }];
  },

  // 电流相量 I(z′) = e^{−jβz′} + Γe^{+jβz′}（z′ 以 λ 为单位，β=2π；与 t 无关）
  currentPhasor(z) {
    const G = this.state.ref;
    const ph = 2 * Math.PI * z;
    return { re: Math.cos(ph) * (1 + G), im: Math.sin(ph) * (G - 1) };
  },
  // 瞬时电流 Re{I(z′)e^{jωt}}（粒子动画用，含反射项的真实合成波）
  currentInst(z) {
    const S = this.state;
    return Math.cos(S.t - 2 * Math.PI * z) + S.ref * Math.cos(S.t + 2 * Math.PI * z);
  },

  // 远场幅度：|Σ臂 sinΘ·∫I e^{jβz cosΘ} dz|（梯形积分，采样 ~48 点/λ）
  af(deg) {
    const S = this.state;
    const th = deg * Math.PI / 180;
    const ox = Math.sin(th), oz = Math.cos(th);
    const N = Math.min(400, Math.max(32, Math.round(48 * S.L)));
    let re = 0, im = 0;
    for (const d of this.armDirs()) {
      const cosT = d.x * ox + d.z * oz;
      const sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT));   // 元因子
      if (sinT < 1e-9) continue;
      let ar = 0, ai = 0;
      for (let i = 0; i <= N; i++) {
        const z = S.L * i / N;
        const w = (i === 0 || i === N) ? 0.5 : 1;
        const c = this.currentPhasor(z);
        const ph = 2 * Math.PI * z * cosT;
        const cp = Math.cos(ph), sp = Math.sin(ph);
        ar += w * (c.re * cp - c.im * sp);
        ai += w * (c.re * sp + c.im * cp);
      }
      re += sinT * ar;
      im += sinT * ai;
    }
    return Math.hypot(re, im);
  },

  // 全圆方向图（θ ∈ [−180°,180°)，缓存：t 不影响幅度）
  pattern() {
    const S = this.state;
    const key = S.geo + '|' + S.L + '|' + S.ref + '|' + S.ang;
    if (this._patCache && this._patCache.key === key) return this._patCache;

    const n = 360 / ASTEP;
    const vals = [];
    let m = 0, mi = 0;
    for (let i = 0; i < n; i++) {
      const v = this.af(-180 + i * ASTEP);
      vals.push(v);
      if (v > m) { m = v; mi = i; }
    }
    const mainDeg = -180 + mi * ASTEP;
    const back = vals[(mi + n / 2) % n];
    const fbDb = 20 * Math.log10(m / Math.max(back, m * 1e-3));  // ≤60 dB 封顶
    const p = {
      key,
      vals: vals.map((v) => v / (m || 1)),
      step: ASTEP,
      main: mainDeg,
      mainFold: Math.abs(mainDeg) > 180 ? 360 - Math.abs(mainDeg) : Math.abs(mainDeg),
      fb: fbDb,
    };
    this._patCache = p;
    return p;
  },

  // ═══ 3D 场景（材质色一律取 stage.THEME3D）═══
  layout(p) {
    const THREE = this.THREE;
    if (!THREE) return;
    const C = stage.THEME3D;
    const S = this.state;
    stage.clearGroup(this.wireGroup);
    stage.clearGroup(this.patternGroup);
    stage.clearGroup(this.currGroup);
    this._parts = null;

    // 导线 · 赭金
    const wireMat = new THREE.LineBasicMaterial({ color: C.gold });
    for (const d of this.armDirs()) {
      const pts = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(d.x * S.L * WIRE_SCALE, 0, d.z * S.L * WIRE_SCALE),
      ];
      this.wireGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
    }

    // 方向图切面曲线（x-z 面，与导线同平面）· 赤陶
    const patMat = new THREE.LineBasicMaterial({ color: C.accent });
    const pts = [];
    p.vals.forEach((v, i) => {
      const th = (-180 + i * p.step) * Math.PI / 180;
      const rr = 0.8 * v;
      pts.push(new THREE.Vector3(Math.sin(th) * rr, 0, Math.cos(th) * rr));
    });
    this.patternGroup.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), patMat));

    // 长线模式：方向图绕线轴旋成锥面 · 青绿半透明（旋转对称仅对单线成立）
    if (S.geo === 'line') {
      const half = [];                             // θ ∈ [0,180°]
      for (let i = 0; i <= 180 / p.step; i++) half.push(p.vals[(i + 180 / p.step) % p.vals.length]);
      const nphi = 40, pos = [], idx = [];
      for (let i = 0; i < half.length; i++) {
        const th = i * p.step * Math.PI / 180;
        const rr = 0.8 * half[i];
        for (let j = 0; j <= nphi; j++) {
          const ph = j / nphi * Math.PI * 2;
          pos.push(rr * Math.sin(th) * Math.cos(ph), rr * Math.sin(th) * Math.sin(ph), rr * Math.cos(th));
        }
      }
      for (let i = 0; i < half.length - 1; i++) {
        for (let j = 0; j < nphi; j++) {
          const a = i * (nphi + 1) + j, b = a + 1, c = a + (nphi + 1), d = c + 1;
          idx.push(a, c, b, b, c, d);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.addAttribute('position', new THREE.Float32BufferAttribute(pos, 3));  // r108 API
      geo.setIndex(idx);
      geo.computeVertexNormals();
      this.patternGroup.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: C.teal, transparent: true, opacity: 0.12, side: THREE.DoubleSide,
      })));
    }

    // 电流粒子 · 赤陶：预分配（共享几何/材质），动画只改 position/scale
    const partGeo = new THREE.SphereGeometry(0.022, 8, 8);
    const partMat = new THREE.MeshBasicMaterial({ color: C.accent });
    this._parts = [];
    for (const d of this.armDirs()) {
      for (let i = 0; i <= 26; i++) {
        const m = new THREE.Mesh(partGeo, partMat);
        this.currGroup.add(m);
        this._parts.push({ m, d, z: S.L * i / 26 });
      }
    }
  },

  // 粒子 = 瞬时合成电流 Re{I(z)e^{jωt}}（含反射项）：高度 = 瞬时值，大小 ∝ |瞬时值|
  updateCurrents() {
    if (!this._parts) return;
    const S = this.state;
    const norm = 1 + S.ref;
    for (const p of this._parts) {
      const inst = this.currentInst(p.z) / norm;
      p.m.position.set(p.d.x * p.z * WIRE_SCALE, 0.09 * inst, p.d.z * p.z * WIRE_SCALE);
      const sc = 0.55 + 0.75 * Math.abs(inst);
      p.m.scale.set(sc, sc, sc);
    }
  },

  startAnim() {
    if (this.animId || !this.canvasNode) return;
    const tick = () => {
      this.animId = this.canvasNode.requestAnimationFrame(tick);
      this.state.t += 0.045;
      this.updateCurrents();
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

  // ═══ 参数控制 ═══
  onGeo(e) {
    haptic.light();
    this.state.geo = e.currentTarget.dataset.g;
    this.setData({ geo: this.state.geo });
    this.renderStatic();
  },
  onL(e) {
    this.state.L = e.detail.value / 10;
    this.setData({ lVal: this.state.L.toFixed(1) + ' λ' });
    this.renderStatic();
  },
  onLChanging(e) {
    this.state.L = e.detail.value / 10;
    this.setData({ lVal: this.state.L.toFixed(1) + ' λ' });
    stage.throttle(this, 55, function () { this.renderStatic(); });
  },
  onRef(e) {
    this.state.ref = e.detail.value / 100;
    this.setData({ gVal: this.state.ref.toFixed(2) });
    this.renderStatic();
  },
  onRefChanging(e) {
    this.state.ref = e.detail.value / 100;
    this.setData({ gVal: this.state.ref.toFixed(2) });
    stage.throttle(this, 55, function () { this.renderStatic(); });
  },
  onAng(e) {
    this.state.ang = e.detail.value;
    this.setData({ angVal: this.state.ang + '°' });
    if (this.state.geo === 'v') this.renderStatic();
  },
  onAngChanging(e) {
    this.state.ang = e.detail.value;
    this.setData({ angVal: this.state.ang + '°' });
    if (this.state.geo === 'v') stage.throttle(this, 55, function () { this.renderStatic(); });
  },

  // ═══ 读数 + 重绘（pattern() 带缓存，只算一遍）═══
  renderStatic() {
    const S = this.state;
    const p = this.pattern();
    const swr = rf.vswrFromGamma(Math.min(S.ref, 0.999));
    // 分档用 SWR 表述（教学阈值：<1.2 / <2 / ≥2）
    const mode = swr < 1.2 ? '近似行波' : swr < 2 ? '弱驻波' : '驻波明显';
    this.setData({
      mainAng: p.mainFold.toFixed(0) + '°',
      fb: p.fb >= 60 ? '>60 dB' : p.fb.toFixed(1) + ' dB',
      swr: swr.toFixed(2) + ' : 1',
      mode,
    });
    this.layout(p);
    this.drawPlot(p);
  },

  // ═══ 2D 全圆极坐标方向图（dB 刻度，θ 自线轴/角平分线起量）═══
  drawPlot(p) {
    const ctx = this.plotCtx;
    if (!ctx || !p) return;
    const w = this.plotW, h = this.plotH;
    lc.clear(ctx, w, h);
    const cx = w / 2, cy = h / 2 + 4;
    const R = Math.min(w / 2 - 46, h / 2 - 22);
    const FLOOR = -30;

    lc.polarGrid(ctx, cx, cy, R, { rings: [0, -10, -20, -30], full: true });

    const toXY = (deg, v) => {
      const db = Math.max(FLOOR, 20 * Math.log10(Math.max(v, 1e-6)));
      const r = R * (1 - db / FLOOR);
      const th = deg * Math.PI / 180;
      return [cx + r * Math.sin(th), cy - r * Math.cos(th)];
    };

    ctx.beginPath();
    p.vals.forEach((v, i) => {
      const xy = toXY(-180 + i * p.step, v);
      i === 0 ? ctx.moveTo(xy[0], xy[1]) : ctx.lineTo(xy[0], xy[1]);
    });
    ctx.closePath();
    ctx.fillStyle = alpha(THEME.accent, 0.10);
    ctx.fill();
    ctx.strokeStyle = THEME.accent;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 主瓣标记
    const mi = Math.round((p.main + 180) / p.step) % p.vals.length;
    const mxy = toXY(p.main, p.vals[mi]);
    lc.dot(ctx, mxy[0], mxy[1], THEME.accent, 3.5);
    lc.label(ctx, 'θmax=' + p.mainFold.toFixed(0) + '°', mxy[0] + 6, mxy[1] - 6, { color: THEME.accent });

    lc.label(ctx, '0°（线轴/角平分线）', cx, cy - R - 8, { align: 'center', color: THEME.inkSoft });
    lc.label(ctx, '180°（后向）', cx, cy + R + 14, { align: 'center', color: THEME.muted, font: THEME.fontTick });
    lc.label(ctx, '径向刻度：dB', cx - R - 6, cy - R - 8, { align: 'left', color: THEME.muted, font: THEME.fontTick });
    lc.legend(ctx, [{ name: '归一化 |E(θ)|（dB，含元因子 sinΘ）', color: THEME.accent }], 10, h - 12);
  },

  onShareAppMessage() {
    return { title: '行波天线 3D 实验室', path: '/pages/interactive/3d-lab/traveling-wave/traveling-wave' };
  },
});

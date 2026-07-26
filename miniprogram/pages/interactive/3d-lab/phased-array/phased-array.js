// pages/interactive/3d-lab/phased-array/phased-array.js —— 相控阵 3D（r108）· 暖纸舞台
// 物理模型（Balanis《Antenna Theory》4th，Ch.6）：
//   阵因子 AF(γ) = |sin(Nψ/2)/(N·sinψ/2)|，ψ = kd·cosγ + β，kd = 2πd/λ（Balanis 6-10c）
//   阵元因子（与阵轴共线的半波偶极子）EF(γ) = |cos(π/2·cosγ)/sinγ|（Balanis 4-84）
//   方向图相乘：P(γ) = AF×EF；方向性 D = 2/∫₀^π Pn²(γ)sinγ dγ（绕阵轴旋转对称）
//   栅瓣主极大：ψ = 2πm ⇒ cosγ = (−β−2πm)/kd，|cosγ| ≤ 1
const { registerOrbitControls } = require('../orbit-controls');
const haptic = require('../../../../utils/haptic');
const stage = require('../lab3d-stage');
const lc = require('../../../../utils/lab-canvas');
const { THEME, alpha, rampColor } = require('../../../../utils/lab-theme');
const rf = require('../../../../utils/rf-math');

const NTH = 60;   // theta 采样（沿阵轴夹角 γ）
const NPH = 80;   // phi 采样（绕阵轴旋转）
const VCNT = (NTH + 1) * (NPH + 1);

// 3D 曲面顶点色 LUT：主题赤陶顺序渐变（浅→深），替换原 jet 彩虹热图
const RAMP = (() => {
  const n = 48, a = [];
  for (let i = 0; i < n; i++) {
    const hx = rampColor(i / (n - 1)).replace('#', '');
    a.push([
      parseInt(hx.slice(0, 2), 16) / 255,
      parseInt(hx.slice(2, 4), 16) / 255,
      parseInt(hx.slice(4, 6), 16) / 255,
    ]);
  }
  return a;
})();

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
  elemGroup: null,
  lobeGroup: null,
  patMesh: null,
  patGeo: null,
  patPosArr: null,
  patColArr: null,
  animId: null,
  scanPhase: 0,
  state: { N: 8, d: 0.5, beta: 0, el: 'iso' },
  plotCtx: null,
  plotW: 0,
  plotH: 0,
  _stats: null,
  _pm: 1,

  onReady() {
    this.initThree();
    stage.init2D(this, '#plot', (ctx, w, h) => {
      this.plotCtx = ctx; this.plotW = w; this.plotH = h;
      if (this._stats) this.drawPlot(this._stats);
    });
  },
  onUnload() { this.dispose(); },
  onHide() { this.stopAnim(); stage.clearTimers(this); },
  onShow() { if (this.canvasNode && this.renderer) { this.startAnim(); stage.scheduleIdle(this); } },

  // ═══════════════════════════════════════════════════════════════
  //  3D 初始化（暖纸舞台：scene.background = 0xf3efe6，暖白三灯）
  // ═══════════════════════════════════════════════════════════════

  initThree() {
    stage.initThree(this, '#three-canvas', {
      fov: 40, cameraPos: [2.6, 1.5, 2.6],
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
        controls.dampingFactor = 0.06;
        controls.autoRotateSpeed = 1.0;
        controls.target.set(0, 0, 0);
        controls.update();
        this.controls = controls;
        this._home = stage.saveHome(controls);

        // 坐标轴：x/z 暖灰辅助，阵轴 y 用赭金标示（材质色一律取 stage.THEME3D）
        const C = stage.THEME3D;
        const O = new THREE.Vector3(0, 0, 0);
        const axes = new THREE.Group();
        axes.add(new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), O, 1.2, C.warmGray, 0.1, 0.05));
        axes.add(new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), O, 1.3, C.gold, 0.12, 0.06));
        axes.add(new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), O, 1.2, C.warmGray, 0.1, 0.05));
        this.scene.add(axes);

        this.elemGroup = new THREE.Group();
        this.lobeGroup = new THREE.Group();
        this.scene.add(this.elemGroup, this.lobeGroup);

        // 方向图 Mesh 预分配（动画中只写 attribute，不重建对象）
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
        // r108: addAttribute（不是 setAttribute）
        patGeo.addAttribute('position', new THREE.BufferAttribute(this.patPosArr, 3));
        patGeo.addAttribute('color', new THREE.BufferAttribute(this.patColArr, 3));
        patGeo.setIndex(idxArr);
        this.patGeo = patGeo;

        this.patMesh = new THREE.Mesh(patGeo, new THREE.MeshPhongMaterial({
          vertexColors: true,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.88,
          shininess: 20,
          depthWrite: false,
        }));
        this.scene.add(this.patMesh);

        this.rebuildElements();
        this.updatePattern();
        this.startAnim();
        stage.ready(this);
      },
    });
  },

  // ═══════════════════════════════════════════════════════════════
  //  方向图数学（公式取自 rf-math / Balanis，页面不自造系数）
  // ═══════════════════════════════════════════════════════════════

  kd() { return 2 * Math.PI * this.state.d; },
  betaRad() { return this.state.beta * Math.PI / 180; },

  // 阵因子：rf.afUniform 即 |sin(Nψ/2)/(N·sinψ/2)|（已数值验证）
  AF(gamma) { return rf.afUniform(this.state.N, this.kd() * Math.cos(gamma) + this.betaRad()); },

  // 阵元因子：半波偶极子（轴向与阵轴共线），iso 时为 1
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

  // 栅瓣锥角：ψ = 2πm ⇒ cosγ = (−β−2πm)/kd
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
  //  统计：D（数值积分）/ HPBW / SLL（剔除栅瓣）/ 栅瓣数
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

    // 方向性 D = 2/∫Pn²sinγdγ（梯形，端点半权）
    let integral = 0;
    for (let i = 0; i <= Ns; i++) {
      const w = (i === 0 || i === Ns) ? 0.5 : 1;
      integral += w * Pn[i] * Pn[i] * Math.sin(i * dt) * dt;
    }
    const D = 2 / Math.max(integral, 1e-12);
    const dbi = 10 * Math.log10(D);

    // HPBW：向两侧搜到场值 1/√2；主瓣贴端射时只有半边在 [0,π]，按旋转对称补全
    const half = Math.SQRT1_2;
    let li = mainIdx, ri = mainIdx;
    while (li > 0 && Pn[li] > half) li--;
    while (ri < Ns && Pn[ri] > half) ri++;
    let hpbwRad = (ri - li) * dt;
    if (mainIdx <= 1) hpbwRad = 2 * ri * dt;
    else if (mainIdx >= Ns - 1) hpbwRad = 2 * (Ns - li) * dt;
    const HPBW = Math.round(hpbwRad * 180 / Math.PI);

    // 栅瓣（偏离主瓣的 0 dB 主极大）
    const gl = this.lobeCones().filter((c) => Math.abs(c.gamma - gamma0) > 0.05);

    // SLL：局部极大中排除主瓣 ±2 采样与栅瓣邻域（栅瓣不算副瓣）
    let sll = 0;
    for (let i = 1; i < Ns; i++) {
      if (!(Pn[i] > Pn[i - 1] && Pn[i] >= Pn[i + 1])) continue;
      if (Math.abs(i - mainIdx) <= 2) continue;
      const g = i * dt;
      let nearGl = false;
      for (const c of gl) { if (Math.abs(c.gamma - g) < 0.06) { nearGl = true; break; } }
      if (!nearGl && Pn[i] > sll) sll = Pn[i];
    }
    const sllDb = sll > 1e-4 ? 20 * Math.log10(sll) : -100;

    return { gamma0, dbi, HPBW, sllDb, grating: gl.length, li: li * dt, ri: ri * dt };
  },

  // ═══════════════════════════════════════════════════════════════
  //  场景更新
  // ═══════════════════════════════════════════════════════════════

  rebuildElements() {
    const THREE = this.THREE;
    if (!THREE) return;
    stage.clearGroup(this.elemGroup);
    const C = stage.THEME3D;

    const span = Math.min(1.0, 0.12 * (this.state.N - 1));
    const elemMat = new THREE.MeshPhongMaterial({ color: C.gold });
    for (let n = 0; n < this.state.N; n++) {
      const frac = (this.state.N === 1) ? 0 : (n / (this.state.N - 1) - 0.5);
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 12), elemMat);
      m.position.set(0, frac * span, 0);
      this.elemGroup.add(m);
    }
    const pts = [
      new THREE.Vector3(0, -span / 2, 0),
      new THREE.Vector3(0, span / 2, 0),
    ];
    this.elemGroup.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: C.warmGray })
    ));
  },

  // 只更新 3D 曲面顶点（自动扫描时每帧调用，不触发 setData）
  updateMesh(pm) {
    if (!this.patGeo) return;
    const Pn = new Float64Array(NTH + 1);
    for (let i = 0; i <= NTH; i++) Pn[i] = this.P(i / NTH * Math.PI) / pm;

    let v = 0;
    const last = RAMP.length - 1;
    for (let j = 0; j <= NPH; j++) {
      const phi = (j / NPH) * 2 * Math.PI;
      const cph = Math.cos(phi), sph = Math.sin(phi);
      for (let i = 0; i <= NTH; i++) {
        const gamma = (i / NTH) * Math.PI;
        const r = Pn[i];
        const sg = Math.sin(gamma);
        this.patPosArr[v] = r * sg * cph;
        this.patPosArr[v + 1] = r * Math.cos(gamma);
        this.patPosArr[v + 2] = r * sg * sph;
        const c = RAMP[Math.min(last, Math.round(r * last))];
        this.patColArr[v] = c[0];
        this.patColArr[v + 1] = c[1];
        this.patColArr[v + 2] = c[2];
        v += 3;
      }
    }
    this.patGeo.attributes.position.needsUpdate = true;
    this.patGeo.attributes.color.needsUpdate = true;
    this.patGeo.computeVertexNormals();
  },

  // 全量更新：曲面 + 锥环 + 读数 + 2D 图
  updatePattern() {
    const pm = this.Pmax();
    this._pm = pm;
    this.updateMesh(pm);
    const st = this.calcStats();
    this._stats = st;
    this.rebuildLobeRings(pm, st);
    this.refreshStats(st);
    this.drawPlot(st);
  },

  rebuildLobeRings(pm, st) {
    const THREE = this.THREE;
    if (!THREE) return;
    stage.clearGroup(this.lobeGroup);
    const C = stage.THEME3D;
    const RING = 60;

    for (const c of this.lobeCones()) {
      const isMain = Math.abs(c.gamma - st.gamma0) < 0.05;
      const r = this.P(c.gamma) / pm;
      if (r < 0.02) continue;
      const pts = [];
      const sg = Math.sin(c.gamma), cy = Math.cos(c.gamma);
      for (let j = 0; j <= RING; j++) {
        const phi = (j / RING) * 2 * Math.PI;
        pts.push(new THREE.Vector3(r * sg * Math.cos(phi), r * cy, r * sg * Math.sin(phi)));
      }
      this.lobeGroup.add(new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: isMain ? C.teal : C.danger })
      ));
    }
  },

  refreshStats(st) {
    st = st || this._stats;
    if (!st) return;
    this.setData({
      stats: {
        theta: Math.round(st.gamma0 * 180 / Math.PI),
        dbi: st.dbi.toFixed(1),
        hpbw: st.HPBW,
        sll: st.sllDb < -99 ? '—' : st.sllDb.toFixed(0),
        grating: st.grating,
      },
    });
  },

  // ═══════════════════════════════════════════════════════════════
  //  动画循环（自动扫描：3D 每帧、setData/统计/2D 图节流 ~9Hz）
  // ═══════════════════════════════════════════════════════════════

  startAnim() {
    if (this.animId || !this.canvasNode) return;
    const tick = () => {
      this.animId = this.canvasNode.requestAnimationFrame(tick);

      if (this.data.scanOn) {
        this.scanPhase += 0.012;
        const A = Math.min(this.state.d * 360, 180);
        this.state.beta = Math.round(A * Math.sin(this.scanPhase));
        const pm = this.Pmax();
        this._pm = pm;
        this.updateMesh(pm);
        const now = Date.now();
        if (now - (this._scanSync || 0) > 110) {
          this._scanSync = now;
          this.setData({ 'S.beta': this.state.beta });
          const st = this.calcStats();
          this._stats = st;
          this.rebuildLobeRings(pm, st);
          this.refreshStats(st);
          this.drawPlot(st);
        }
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

  // 普通端射条件 β = ∓kd（度数即 360·d）；d>0.5λ 时超出滑杆 ±180°，截断并提示
  _endfire(sign) {
    haptic.light();
    const kdDeg = this.state.d * 360;
    if (kdDeg > 180) {
      wx.showToast({ title: '|β|=kd=' + Math.round(kdDeg) + '° 超出 ±180°，已截断（非真端射）', icon: 'none' });
    }
    const b = Math.round(sign * Math.min(kdDeg, 180));
    this.state.beta = b;
    this.setData({ 'S.beta': b, scanOn: false });
    this.scanPhase = 0;
    this.updatePattern();
  },
  setEndfireFwd() { this._endfire(-1); },
  setEndfireBack() { this._endfire(1); },

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
  //  2D 全圆极坐标方向图（lab-canvas 纸底；γ 自阵轴起量，0° 朝上）
  // ═══════════════════════════════════════════════════════════════

  drawPlot(st) {
    const ctx = this.plotCtx;
    if (!ctx || !st) return;
    const w = this.plotW, h = this.plotH;
    lc.clear(ctx, w, h);
    const cx = w / 2, cy = h / 2 + 4;
    const R = Math.min(w / 2 - 50, h / 2 - 30);
    const FLOOR = -40;
    const pm = this._pm || this.Pmax();

    lc.polarGrid(ctx, cx, cy, R, { rings: [0, -10, -20, -30, -40], full: true });

    // HPBW 扇形高亮（canvas 角 = γ − 90°，因 x=sinγ、y=−cosγ）
    if (st.ri > st.li) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, st.li - Math.PI / 2, st.ri - Math.PI / 2);
      ctx.closePath();
      ctx.fillStyle = alpha(THEME.gold, 0.14);
      ctx.fill();
    }

    const toXY = (g, sgn) => {
      const v = this.P(g) / pm;
      const db = Math.max(FLOOR, 20 * Math.log10(Math.max(v, 1e-4)));
      const r = R * (1 - db / FLOOR);
      return [cx + sgn * r * Math.sin(g), cy - r * Math.cos(g)];
    };

    // 方向图曲线（右半 γ∈[0,π]，左半镜像：绕阵轴旋转对称）
    const NS = 240;
    ctx.beginPath();
    for (let i = 0; i <= NS; i++) {
      const xy = toXY(i / NS * Math.PI, 1);
      i === 0 ? ctx.moveTo(xy[0], xy[1]) : ctx.lineTo(xy[0], xy[1]);
    }
    for (let i = NS; i >= 0; i--) {
      const xy = toXY(i / NS * Math.PI, -1);
      ctx.lineTo(xy[0], xy[1]);
    }
    ctx.closePath();
    ctx.fillStyle = alpha(THEME.accent, 0.10);
    ctx.fill();
    ctx.strokeStyle = THEME.accent;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // 主瓣方向 θ₀：虚线 + 标记点
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = THEME.teal;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + R * Math.sin(st.gamma0), cy - R * Math.cos(st.gamma0));
    ctx.stroke();
    ctx.restore();
    const tip = toXY(st.gamma0, 1);
    lc.dot(ctx, tip[0], tip[1], THEME.teal, 3.5);
    lc.label(ctx, 'θ₀=' + Math.round(st.gamma0 * 180 / Math.PI) + '°', tip[0] + 6, tip[1] - 6, { color: THEME.teal });

    // 角度标注（辐条为每 30°；dB 数字在右侧由 polarGrid 标出）
    lc.label(ctx, '0°（阵轴）', cx, cy - R - 8, { align: 'center', color: THEME.inkSoft });
    lc.label(ctx, '90°', cx - R - 8, cy, { align: 'right', color: THEME.muted, font: THEME.fontTick });
    lc.label(ctx, '180°', cx, cy + R + 14, { align: 'center', color: THEME.muted, font: THEME.fontTick });
    lc.label(ctx, '径向: dB', cx - R - 6, cy - R - 6, { align: 'left', color: THEME.muted, font: THEME.fontTick });

    lc.legend(ctx, [
      { name: '归一化方向图', color: THEME.accent },
      { name: '主瓣 θ₀', color: THEME.teal },
      { name: 'HPBW 区间', color: THEME.gold },
    ], 10, h - 10);
  },

  onShareAppMessage() {
    return { title: '相控阵扫描 3D 实验室', path: '/pages/interactive/3d-lab/phased-array/phased-array' };
  },
});

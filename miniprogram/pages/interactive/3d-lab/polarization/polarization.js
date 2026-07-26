// pages/interactive/3d-lab/polarization/polarization.js —— 极化椭圆 3D（r108）· 暖纸舞台
// 物理模型（Balanis §4.4 / IEEE Std 145）：
//   E(z,t) = x̂ Ex cos(ωt−βz) + ŷ Ey cos(ωt−βz+δ)
//   tan2ψ = 2ExEy·cosδ/(Ex²−Ey²)　sin2χ = 2ExEy·sinδ/(Ex²+Ey²)
//   AR = OA/OB（长轴/短轴），AR(dB) = 20·lg AR
//   IEEE 旋向：顺 +z 传播方向观察，δ<0 → 右旋（RHCP），δ>0 → 左旋
const { registerOrbitControls } = require('../orbit-controls');
const haptic = require('../../../../utils/haptic');
const stage = require('../lab3d-stage');
const lc = require('../../../../utils/lab-canvas');
const { THEME, alpha } = require('../../../../utils/lab-theme');
const rf = require('../../../../utils/rf-math');

const AMP = 0.42;   // 场景缩放：|E| = 1 → 0.42 单位
const NVEC = 13;    // 沿传播轴的 E 矢量个数（预分配，动画只改坐标）

Page({
  data: {
    S: { ex: 1, ey: 0.55, del: 0, preset: 'linear' },
    params: null,
    showHint: true,
    glReady: false,
  },

  THREE: null,
  canvasNode: null,
  renderer: null,
  scene: null,
  camera: null,
  controls: null,
  waveGroup: null,
  vecGroup: null,
  animId: null,
  t: 0,
  state: { ex: 1, ey: 0.55, del: 0 },
  _vecs: null,
  _ell: null,
  plotCtx: null,
  plotW: 0,
  plotH: 0,

  onReady() {
    this.initThree();
    stage.init2D(this, '#ellipse', (ctx, w, h) => {
      this.plotCtx = ctx; this.plotW = w; this.plotH = h;
      this.drawEllipse();
    });
    this.computeParams();
  },
  onUnload() { this.dispose(); },
  onHide() { this.stopAnim(); stage.clearTimers(this); },
  onShow() { if (this.canvasNode && this.renderer) { this.startAnim(); stage.scheduleIdle(this); } },

  // ═══════════════════════════════════════════════════════════════
  //  3D 初始化（暖纸舞台：scene.background = 0xf3efe6，暖白三灯）
  // ═══════════════════════════════════════════════════════════════

  initThree() {
    stage.initThree(this, '#three-canvas', {
      fov: 42, cameraPos: [1.7, 1.25, 2.5],
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

        this.waveGroup = new THREE.Group();
        this.vecGroup = new THREE.Group();
        this.scene.add(this.waveGroup, this.vecGroup);

        this.layout();
        this.buildVectors();
        this.startAnim();
        stage.ready(this);
      },
    });
  },

  // 场分量：ph = ωt − βz（z 以 λ、t 以 1/ω 归一）。
  // 注意相位符号：原实现用 ph = βz − ωt 再加 δ，等价于把 δ 取反，
  // 会让 3D 动画旋向与 IEEE 约定相反，此处已修正为 ωt − βz + δ。
  E(z, t) {
    const ph = (t !== undefined ? t : this.t) - 2 * Math.PI * z;
    return {
      x: this.state.ex * Math.cos(ph),
      y: this.state.ey * Math.cos(ph + this.state.del * Math.PI / 180),
    };
  },

  // ═══════════════════════════════════════════════════════════════
  //  场景构建（材质色一律取 stage.THEME3D：Ex 赤陶 / Ey 青绿 / 合成 E 赭金）
  // ═══════════════════════════════════════════════════════════════

  addLine(points, mat, parent) {
    const THREE = this.THREE;
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const l = new THREE.Line(geo, mat);
    (parent || this.waveGroup).add(l);
    return l;
  },

  layout() {
    const THREE = this.THREE;
    if (!THREE) return;
    const C = stage.THEME3D;
    stage.clearGroup(this.waveGroup);

    // 传播轴（暖灰）+ +z 方向箭头
    this.addLine([
      new THREE.Vector3(0, 0, -1.8),
      new THREE.Vector3(0, 0, 1.8),
    ], new THREE.LineBasicMaterial({ color: C.warmGray }));
    this.waveGroup.add(new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 1.8), 0.22, C.warmGray, 0.12, 0.06));

    // 端面 x̂ / ŷ 取向箭头（与 2D 图坐标对应）
    const zf = 1.8;
    this.waveGroup.add(new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, zf), 0.5, C.accent, 0.1, 0.05));
    this.waveGroup.add(new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, zf), 0.5, C.teal, 0.1, 0.05));

    // 三条波形曲线（静态快照 t=0）：Ex 赤陶 / Ey 青绿 / 合成 E 赭金
    const matX = new THREE.LineBasicMaterial({ color: C.accent, transparent: true, opacity: 0.85 });
    const matY = new THREE.LineBasicMaterial({ color: C.teal, transparent: true, opacity: 0.85 });
    const matE = new THREE.LineBasicMaterial({ color: C.gold, transparent: true, opacity: 0.9 });

    const px = [], py = [], pe = [];
    for (let i = 0; i <= 260; i++) {
      const z = -1.7 + i / 260 * 3.4;
      const e = this.E(z, 0);
      px.push(new THREE.Vector3(e.x * AMP, 0, z));
      py.push(new THREE.Vector3(0, e.y * AMP, z));
      pe.push(new THREE.Vector3(e.x * AMP, e.y * AMP, z));
    }
    this.addLine(px, matX);
    this.addLine(py, matY);
    this.addLine(pe, matE);
  },

  // E 矢量预分配：NVEC 组 Line + 端点球建一次，动画中只写 position（消除每帧建/毁对象）
  buildVectors() {
    const THREE = this.THREE;
    if (!THREE || this._vecs) return;
    const C = stage.THEME3D;
    const lineMat = new THREE.LineBasicMaterial({ color: C.gold, transparent: true, opacity: 0.75 });
    const dotGeo = new THREE.SphereGeometry(0.022, 8, 8);
    const dotMat = new THREE.MeshBasicMaterial({ color: C.gold });

    this._vecs = [];
    for (let k = 0; k < NVEC; k++) {
      const z = -1.5 + k * 0.25;
      const arr = new Float32Array(6);
      arr[2] = z; arr[5] = z;
      const geo = new THREE.BufferGeometry();
      geo.addAttribute('position', new THREE.BufferAttribute(arr, 3));   // r108 API
      const line = new THREE.Line(geo, lineMat);
      const dot = new THREE.Mesh(dotGeo, dotMat);
      this.vecGroup.add(line);
      this.vecGroup.add(dot);
      this._vecs.push({ arr, geo, dot, z });
    }
  },

  updateVectors() {
    if (!this._vecs) return;
    for (const v of this._vecs) {
      const e = this.E(v.z);
      v.arr[3] = e.x * AMP;
      v.arr[4] = e.y * AMP;
      v.geo.attributes.position.needsUpdate = true;
      v.dot.position.set(v.arr[3], v.arr[4], v.z);
    }
  },

  // ═══════════════════════════════════════════════════════════════
  //  极化参数（rf.polarizationEllipse：长短轴 / 倾角 ψ / AR(dB)）
  // ═══════════════════════════════════════════════════════════════

  computeParams() {
    const { ex, ey, del } = this.state;
    if (ex < 1e-6 && ey < 1e-6) {
      this._ell = null;
      this.setData({ params: { type: '—', ar: '—', arDb: '—', tilt: '—', sense: '无' } });
      return;
    }
    const ell = rf.polarizationEllipse(ex, ey, del * Math.PI / 180);
    this._ell = ell;
    const arLin = ell.minor < 1e-9 ? Infinity : ell.major / ell.minor;

    // 分类阈值（教学约定，工程惯例圆极化以 AR<3 dB 论）：
    //   AR < 3 dB → 圆极化；AR > 30 dB → 线极化；其余椭圆
    let type = '椭圆极化';
    if (!isFinite(ell.arDb) || ell.arDb > 30) type = '线极化';
    else if (ell.arDb < 3) type = '圆极化';

    // 旋向与类型联动：线极化强制"无"，消除"线极化 + 右旋"矛盾组合
    const sense = type === '线极化' ? '无'
      : (del > 0 ? '左旋' : del < 0 ? '右旋' : '无');

    this.setData({
      params: {
        type,
        ar: isFinite(arLin) ? arLin.toFixed(2) : '∞',
        arDb: isFinite(ell.arDb) ? ell.arDb.toFixed(1) + ' dB' : '∞ dB',
        tilt: (ell.tilt * 180 / Math.PI).toFixed(0),
        sense,
      },
    });
  },

  // ═══════════════════════════════════════════════════════════════
  //  动画循环
  // ═══════════════════════════════════════════════════════════════

  startAnim() {
    if (this.animId || !this.canvasNode) return;
    const tick = () => {
      this.animId = this.canvasNode.requestAnimationFrame(tick);
      this.t += 0.035;
      this.updateVectors();
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

  onEx(e) {
    this.state.ex = e.detail.value;
    this.setData({ 'S.ex': e.detail.value, 'S.preset': '' });
    this._updateStatic();
  },
  onExChanging(e) {
    this.state.ex = e.detail.value;
    this.setData({ 'S.ex': e.detail.value, 'S.preset': '' });
    stage.throttle(this, 55, function () { this._updateStatic(); });
  },
  onEy(e) {
    this.state.ey = e.detail.value;
    this.setData({ 'S.ey': e.detail.value, 'S.preset': '' });
    this._updateStatic();
  },
  onEyChanging(e) {
    this.state.ey = e.detail.value;
    this.setData({ 'S.ey': e.detail.value, 'S.preset': '' });
    stage.throttle(this, 55, function () { this._updateStatic(); });
  },
  onDel(e) {
    this.state.del = e.detail.value;
    this.setData({ 'S.del': e.detail.value, 'S.preset': '' });
    this._updateStatic();
  },
  onDelChanging(e) {
    this.state.del = e.detail.value;
    this.setData({ 'S.del': e.detail.value, 'S.preset': '' });
    stage.throttle(this, 55, function () { this._updateStatic(); });
  },

  _updateStatic() {
    this.computeParams();
    this.layout();
    this.drawEllipse();
  },

  setLinear() {
    haptic.light();
    this.state.ex = 1; this.state.ey = 0.55; this.state.del = 0;
    this.setData({ S: { ex: 1, ey: 0.55, del: 0, preset: 'linear' } });
    this._updateStatic();
  },
  setRHCP() {
    haptic.light();
    this.state.ex = 1; this.state.ey = 1; this.state.del = -90;
    this.setData({ S: { ex: 1, ey: 1, del: -90, preset: 'rhcp' } });
    this._updateStatic();
  },
  setLHCP() {
    haptic.light();
    this.state.ex = 1; this.state.ey = 1; this.state.del = 90;
    this.setData({ S: { ex: 1, ey: 1, del: 90, preset: 'lhcp' } });
    this._updateStatic();
  },
  setEllipse() {
    haptic.light();
    this.state.ex = 1; this.state.ey = 0.55; this.state.del = 70;
    this.setData({ S: { ex: 1, ey: 0.55, del: 70, preset: 'ellipse' } });
    this._updateStatic();
  },

  // ═══════════════════════════════════════════════════════════════
  //  2D 端面极化椭圆（lab-canvas 纸底；z=0 平面，+z 出屏迎波观察）
  // ═══════════════════════════════════════════════════════════════

  drawEllipse() {
    const ctx = this.plotCtx;
    if (!ctx) return;
    const w = this.plotW, h = this.plotH;
    const { ex, ey, del } = this.state;
    const dRad = del * Math.PI / 180;
    lc.clear(ctx, w, h);

    // 等比正方绘图区（保证圆极化画出来是圆）
    const side = Math.min(w - 84, h - 62);
    const box = { x: (w - side) / 2 + 10, y: 22, w: side, h: side };
    const p = lc.plot(ctx, box, [-1.15, 1.15], [-1.15, 1.15]);
    p.axes({
      xTicks: [-1, -0.5, 0, 0.5, 1],
      yTicks: [-1, -0.5, 0, 0.5, 1],
      xLabel: 'Ex（归一化 E）',
      yLabel: 'Ey（归一化 E）',
    });

    // Ex/Ey 幅度参考框（外接矩形 2Ex × 2Ey）
    if (ex > 1e-3 || ey > 1e-3) {
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = THEME.gridStrong;
      ctx.lineWidth = 1;
      ctx.strokeRect(p.X(-ex), p.Y(ey), p.X(ex) - p.X(-ex), p.Y(-ey) - p.Y(ey));
      ctx.restore();
    }

    // 长/短轴虚线 + 倾角 ψ 弧标（靛蓝）
    const ell = this._ell;
    if (ell && ell.minor > 1e-3) {
      const ct = Math.cos(ell.tilt), st = Math.sin(ell.tilt);
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = THEME.indigo;
      ctx.beginPath();
      ctx.moveTo(p.X(-ell.major * ct), p.Y(-ell.major * st));
      ctx.lineTo(p.X(ell.major * ct), p.Y(ell.major * st));
      ctx.moveTo(p.X(ell.minor * st), p.Y(-ell.minor * ct));
      ctx.lineTo(p.X(-ell.minor * st), p.Y(ell.minor * ct));
      ctx.stroke();
      ctx.restore();
      if (Math.abs(ell.tilt) > 0.07) {
        ctx.strokeStyle = THEME.indigo;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(p.X(0), p.Y(0), 26, 0, -ell.tilt, ell.tilt > 0);
        ctx.stroke();
        const mid = ell.tilt / 2;
        lc.label(ctx, 'ψ=' + (ell.tilt * 180 / Math.PI).toFixed(0) + '°',
          p.X(0) + 38 * Math.cos(mid), p.Y(0) - 38 * Math.sin(mid),
          { color: THEME.indigo, align: 'center', baseline: 'middle', font: THEME.fontTick });
      }
    }

    // E 矢量端点轨迹（时间正向 φ=ωt：x=Ex·cosφ，y=Ey·cos(φ+δ)）· 赭金
    const xs = [], ys = [];
    for (let i = 0; i <= 240; i++) {
      const t = i / 240 * 2 * Math.PI;
      xs.push(ex * Math.cos(t));
      ys.push(ey * Math.cos(t + dRad));
    }
    p.line(xs, ys, THEME.gold, 2);

    // 旋向箭头（沿时间正向切线；+z 出屏迎波观察：右旋呈逆时针）
    if (ell && ell.minor / Math.max(ell.major, 1e-9) > 0.06) {
      const t0 = 0.9, t1 = 1.18;
      const x0 = p.X(ex * Math.cos(t0)), y0 = p.Y(ey * Math.cos(t0 + dRad));
      const x1 = p.X(ex * Math.cos(t1)), y1 = p.Y(ey * Math.cos(t1 + dRad));
      if (Math.hypot(x1 - x0, y1 - y0) > 4) {
        lc.arrow(ctx, x0, y0, x1, y1, THEME.gold, 2);
        lc.label(ctx, del < 0 ? '右旋' : '左旋', x1 + 8, y1, { color: THEME.gold });
      }
    }

    lc.legend(ctx, [
      { name: 'E 端点轨迹', color: THEME.gold },
      { name: '长/短轴 · ψ', color: THEME.indigo },
    ], box.x, h - 8);
  },

  onShareAppMessage() {
    return { title: '极化椭圆 3D 实验室', path: '/pages/interactive/3d-lab/polarization/polarization' };
  },
});

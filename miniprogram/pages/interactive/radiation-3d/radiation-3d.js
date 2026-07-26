// pages/interactive/radiation-3d/radiation-3d.js —— 三维辐射方向图（three.js · 暖纸舞台）
// 物理模型（Balanis, Antenna Theory 4th ed.）：
//   有限长偶极子场方向图 F(θ) = [cos(kh·cosθ) − cos(kh)] / sinθ（h 为半长，kh = 2π·h/λ）
//   方向性 D = 4π·U_max / P_rad，φ 对称时化简为 2 / ∫₀^π F̂²(θ)·sinθ dθ
//   辐射电阻（参考电流波腹）Rr = (η₀/2π)·∫₀^π F²(θ)·sinθ dθ —— 半波 ≈73Ω、全波 ≈199Ω
//   HPBW：先找全局最大辐射角 θmax，再向两侧搜 F² = F²max/2 交点
const { registerOrbitControls } = require('./orbit-controls');
const stage = require('../3d-lab/lab3d-stage');
const haptic = require('../../../utils/haptic');
const rf = require('../../../utils/rf-math');
const { rampColor } = require('../../../utils/lab-theme');

const T3 = stage.THEME3D;

// 暖色顺序渐变 LUT（lab-theme rampColor → [r,g,b] 0..1，曲面顶点色用）
const RAMP_LUT = (() => {
  const lut = [];
  for (let i = 0; i <= 64; i++) {
    const hex = rampColor(i / 64).replace('#', '');
    lut.push([
      parseInt(hex.slice(0, 2), 16) / 255,
      parseInt(hex.slice(2, 4), 16) / 255,
      parseInt(hex.slice(4, 6), 16) / 255,
    ]);
  }
  return lut;
})();
function rampRGB(t) {
  return RAMP_LUT[Math.round(Math.max(0, Math.min(1, t)) * 64)];
}

// geometry.setAttribute / 旧版 addAttribute 兼容
function setAttr(geo, name, attr) {
  if (geo.setAttribute) geo.setAttribute(name, attr);
  else geo.addAttribute(name, attr);
}

const TYPE_LABELS = {
  isotropic: '理想点源', short: '短偶极子', halfwave: '半波偶极子',
  fullwave: '全波偶极子', custom: '自定义长度偶极子',
};
const F_FORMULA = {
  isotropic: 'F(θ) = 1（理想点源，仅作参考基准）',
  short: 'F(θ) = sinθ（无穷小偶极子，l ≪ λ）',
  halfwave: 'F(θ) = cos(π/2·cosθ) / sinθ',
  fullwave: 'F(θ) = [cos(π·cosθ) + 1] / sinθ',
  custom: 'F(θ) = [cos(kh·cosθ) − cos kh] / sinθ，kh = 2π·h/λ',
};
const DB_TICKS = ['−40', '−30', '−20', '−10', '0 dB'];
const LIN_TICKS = ['0', '0.25', '0.5', '0.75', '1'];
const DB_FLOOR = -40;   // dB 上色下限

Page({
  data: {
    S: {
      type: 'halfwave',
      ptype: 'power',
      cmap: 'db',
      opacityVal: 85,
      opacityText: '85%',
      rotate: false,
      showAxes: true,
      showCuts: true,
      showAnt: true,
    },
    hlSlider: 25,
    hlText: '0.25 λ',
    stats: null,
    statNote: '',
    captionText: TYPE_LABELS.halfwave + ' · 功率方向图',
    formulaF: F_FORMULA.halfwave,
    legendTicks: DB_TICKS,
    showHint: true,
    glReady: false,
  },

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
  envDispose: null,
  state: {
    type: 'halfwave', hl: 0.25, ptype: 'power', cmap: 'db',
    opacity: 0.85, rotate: false, showAxes: true, showCuts: true, showAnt: true,
  },

  onReady() {
    stage.initThree(this, '#three-canvas', {
      fov: 45,
      cameraPos: [3, 2.1, 3],
      onReady: (env) => this.setupScene(env),
    });
  },

  onUnload() { this.dispose(); },
  onHide() { this.stopAnim(); stage.clearTimers(this); },
  onShow() {
    if (this.renderer) { this.startAnim(); stage.scheduleIdle(this); }
  },

  // ═══ 场景搭建（纸色背景 + 暖白三灯由 stage.initThree 布好）═══
  setupScene(env) {
    const THREE = env.THREE;
    this.THREE = THREE;
    this.canvasNode = env.canvas;
    this.renderer = env.renderer;
    this.scene = env.scene;
    this.camera = env.camera;
    this.envDispose = env.dispose;
    this.camera.lookAt(0, 0, 0);

    registerOrbitControls(THREE);
    const controls = new THREE.OrbitControls(this.camera, env.canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotateSpeed = 1.2;
    controls.minDistance = 1.2;
    controls.maxDistance = 8;
    this.controls = controls;
    this._home = stage.saveHome(controls);

    this.setupGrid(THREE, this.scene);
    this.setupAxes(THREE, this.scene);
    this.setupAntenna(THREE, this.scene);
    this.buildPattern();
    this.refreshStats();
    this.startAnim();
    stage.ready(this);
  },

  // 地面网格（暖灰辅助线）
  setupGrid(THREE, scene) {
    const size = 6, divs = 12;
    const step = size / divs, half = size / 2;
    const pts = [];
    for (let i = 0; i <= divs; i++) {
      const v = -half + i * step;
      pts.push(-half, 0, v, half, 0, v);
      pts.push(v, 0, -half, v, 0, half);
    }
    const geo = new THREE.BufferGeometry();
    setAttr(geo, 'position', new THREE.Float32BufferAttribute(pts, 3));
    const grid = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
      color: T3.warmGray, transparent: true, opacity: 0.22, depthWrite: false,
    }));
    grid.position.y = -1.4;
    scene.add(grid);
  },

  // 坐标轴（暖灰箭头 + X/Y/Z 精灵文字标注）
  setupAxes(THREE, scene) {
    const AL = 1.25;
    const group = new THREE.Group();
    const mkArrow = (dir) => new THREE.ArrowHelper(
      new THREE.Vector3(dir[0], dir[1], dir[2]).normalize(),
      new THREE.Vector3(0, 0, 0), AL, T3.warmGray, 0.1, 0.05
    );
    try {
      group.add(mkArrow([1, 0, 0]));
      group.add(mkArrow([0, 1, 0]));
      group.add(mkArrow([0, 0, 1]));
    } catch (e) { /* ArrowHelper 不可用则只留文字 */ }
    const L = AL + 0.16;
    [['X', [L, 0, 0]], ['Y', [0, L, 0]], ['Z', [0, 0, L]]].forEach(([txt, pos]) => {
      const sp = this.axisLabelSprite(THREE, txt, pos);
      if (sp) group.add(sp);
    });
    group.visible = this.state.showAxes;
    scene.add(group);
    this.axesGroup = group;
  },

  // 文字精灵（离屏 canvas 纹理；失败时静默降级为无标注）
  axisLabelSprite(THREE, text, pos) {
    try {
      const size = 64;
      let cv;
      try {
        cv = wx.createOffscreenCanvas({ type: '2d', width: size, height: size });
      } catch (e) {
        cv = wx.createOffscreenCanvas();
        cv.width = size; cv.height = size;
      }
      const c = cv.getContext('2d');
      c.clearRect(0, 0, size, size);
      c.font = '600 42px sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = '#4c463c';   // THEME.inkSoft
      c.fillText(text, size / 2, size / 2);
      const tex = new THREE.Texture(cv);
      tex.needsUpdate = true;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false,
      }));
      sp.position.set(pos[0], pos[1], pos[2]);
      sp.scale.set(0.26, 0.26, 1);
      return sp;
    } catch (e) {
      return null;
    }
  },

  // 天线元件（赭金，沿极轴 Y）
  setupAntenna(THREE, scene) {
    const group = new THREE.Group();
    const matl = new THREE.MeshPhongMaterial({ color: T3.gold, emissive: 0x241803 });
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 1, 8), matl);
    const feed = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), matl);
    group.add(rod);
    group.add(feed);
    group.visible = this.state.showAnt;
    scene.add(group);
    this.antGroup = group;
    this.antTop = rod;
    rod.scale.y = 0.5;
  },

  // ═══ 方向图数学（Balanis 式 4-62a 及特例）═══
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

  Fmax(type, hl, N) {
    N = N || 2000;
    let m = 0;
    for (let i = 0; i <= N; i++) {
      const v = this.F((i / N) * Math.PI, type, hl);
      if (v > m) m = v;
    }
    return m || 1;
  },

  // ═══ 构建 3D 曲面 ═══
  buildPattern() {
    if (!this.THREE || !this.scene) return;
    const THREE = this.THREE;
    const { type, hl, ptype, opacity, cmap } = this.state;

    if (this.patMesh) {
      this.scene.remove(this.patMesh);
      this.patMesh.geometry.dispose();
      this.patMesh.material.dispose();
      this.patMesh = null;
    }
    if (this.cutsGroup) {
      this.scene.remove(this.cutsGroup);
      stage.clearGroup(this.cutsGroup);
      this.cutsGroup = null;
    }

    const fm = this.Fmax(type, hl);
    const NTH = 80, NPH = 120;
    const pos = [], col = [], idx = [];

    for (let j = 0; j <= NPH; j++) {
      const phi = (j / NPH) * 2 * Math.PI;
      for (let i = 0; i <= NTH; i++) {
        const theta = (i / NTH) * Math.PI;
        const rn = this.F(theta, type, hl) / fm;   // 场归一化
        const r = ptype === 'power' ? rn * rn : rn; // 绘图半径
        pos.push(
          r * Math.sin(theta) * Math.cos(phi),
          r * Math.cos(theta),
          r * Math.sin(theta) * Math.sin(phi)
        );
        const t = cmap === 'db'
          ? Math.max(0, 1 + 20 * Math.log10(Math.max(rn, 1e-9)) / -DB_FLOOR)
          : r;
        const c = rampRGB(t);
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
    setAttr(geo, 'position', new THREE.Float32BufferAttribute(pos, 3));
    setAttr(geo, 'color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();

    this.patMesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: opacity,
      shininess: 18,
    }));
    this.scene.add(this.patMesh);

    this.buildCuts(THREE, type, hl, ptype, fm);

    if (this.antTop) {
      const hlVis = type === 'custom' ? hl : 0.25;
      this.antTop.scale.y = Math.max(0.05, hlVis * 2);
    }
  },

  // 主平面切面：E 面（φ=0，含极轴）靛蓝 · H 面（θ=90°）青绿
  buildCuts(THREE, type, hl, ptype, fm) {
    const group = new THREE.Group();
    group.visible = this.state.showCuts;

    const ePts = [];
    const Ncut = 200;
    const rAt = (theta) => {
      const rn = this.F(theta, type, hl) / fm;
      return ptype === 'power' ? rn * rn : rn;
    };
    for (let i = 0; i <= Ncut; i++) {
      const theta = (i / Ncut) * Math.PI;
      const r = rAt(theta);
      ePts.push(r * Math.sin(theta), r * Math.cos(theta), 0);
    }
    for (let i = Ncut; i >= 0; i--) {
      const theta = (i / Ncut) * Math.PI;
      const r = rAt(theta);
      ePts.push(-r * Math.sin(theta), r * Math.cos(theta), 0);
    }
    const eGeo = new THREE.BufferGeometry();
    setAttr(eGeo, 'position', new THREE.Float32BufferAttribute(ePts, 3));
    group.add(new THREE.LineLoop(eGeo,
      new THREE.LineBasicMaterial({ color: T3.indigo })));

    const hPts = [];
    const rH = rAt(Math.PI / 2);
    for (let j = 0; j <= 180; j++) {
      const phi = (j / 180) * 2 * Math.PI;
      hPts.push(rH * Math.cos(phi), 0, rH * Math.sin(phi));
    }
    const hGeo = new THREE.BufferGeometry();
    setAttr(hGeo, 'position', new THREE.Float32BufferAttribute(hPts, 3));
    group.add(new THREE.LineLoop(hGeo,
      new THREE.LineBasicMaterial({ color: T3.teal })));

    this.scene.add(group);
    this.cutsGroup = group;
  },

  // ═══ 读数：方向性 / HPBW / 辐射电阻 ═══
  refreshStats() {
    const { type, hl } = this.state;
    const N = 3000;
    const dt = Math.PI / N;

    // 采样 F²，同时找全局最大
    const f2 = new Array(N + 1);
    let imax = 0;
    for (let i = 0; i <= N; i++) {
      const v = this.F(i * dt, type, hl);
      f2[i] = v * v;
      if (f2[i] > f2[imax]) imax = i;
    }
    const f2max = f2[imax] || 1;

    // 方向性 D = 2 / ∫ F̂² sinθ dθ（梯形积分）
    let integral = 0;
    for (let i = 0; i <= N; i++) {
      const w = (i === 0 || i === N) ? 0.5 : 1;
      integral += w * (f2[i] / f2max) * Math.sin(i * dt) * dt;
    }
    const D = 2 / Math.max(integral, 1e-12);
    const dbi = 10 * Math.log10(D);

    // HPBW：从 θmax 向两侧分别搜索 F² = F²max/2 的交点
    let hpbwText = '—';
    if (type !== 'isotropic') {
      const half = f2max / 2;
      const cross = (dir) => {
        for (let i = imax + dir; i >= 0 && i <= N; i += dir) {
          if (f2[i] <= half) {
            const iPrev = i - dir;
            const frac = (f2[iPrev] - half) / Math.max(f2[iPrev] - f2[i], 1e-12);
            return (iPrev + dir * frac) * dt;
          }
        }
        return NaN;
      };
      const lo = cross(-1);
      const hi = cross(1);
      if (isFinite(lo) && isFinite(hi)) {
        hpbwText = ((hi - lo) * 180 / Math.PI).toFixed(1) + '°';
      }
    }

    // 辐射电阻（参考电流波腹）：Rr = (η₀/2π)·∫ F² sinθ dθ，正弦电流通式
    let rrText, statNote;
    if (type === 'isotropic') {
      rrText = '—';
      statNote = '理想点源：HPBW 与 Rr 不适用（无方向选择、无实体电流）。';
    } else if (type === 'short') {
      rrText = '20π²(l/λ)²';
      statNote = '短偶极子 Rr 假设三角形电流分布（l = 2h ≪ λ）；如 l = 0.1λ 时 Rr ≈ 1.97 Ω。';
    } else {
      const kh = type === 'halfwave' ? Math.PI / 2
        : type === 'fullwave' ? Math.PI
          : 2 * Math.PI * hl;
      rrText = this.rrCurrentMax(kh).toFixed(1) + ' Ω';
      statNote = type === 'fullwave'
        ? 'Rr 参考电流波腹；全波偶极子中心馈电点在电流零点，实际输入阻抗高达数千欧。'
        : 'Rr 参考电流波腹（Balanis 表值口径，半波时与输入电阻一致）。';
    }
    if (type === 'custom' && hl > 0.625 && hpbwText !== '—') {
      statNote += ' 总长 >1.25λ 后主瓣偏离侧射方向，HPBW 为主瓣（θmax=' +
        (imax * dt * 180 / Math.PI).toFixed(0) + '°）两侧半功率点夹角。';
    }

    this.setData({
      stats: { D: D.toFixed(2), dbi: dbi.toFixed(2), HPBW: hpbwText, Rr: rrText },
      statNote,
    });
  },

  // Rr（参考电流波腹）= (η₀/2π)·∫₀^π [cos(kh·cosθ)−cos(kh)]²/sinθ dθ
  rrCurrentMax(kh) {
    const N = 2000, dt = Math.PI / N;
    const ck = Math.cos(kh);
    let s = 0;
    for (let i = 1; i < N; i++) {
      const th = i * dt, st = Math.sin(th);
      const f = (Math.cos(kh * Math.cos(th)) - ck) / st;
      s += f * f * st * dt;
    }
    return rf.ETA0 / (2 * Math.PI) * s;
  },

  // ═══ 动画 ═══
  startAnim() {
    if (this.animId || !this.canvasNode) return;
    const canvas = this.canvasNode;
    const tick = () => {
      if (this.controls) this.controls.update();
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

  dispose() {
    this.stopAnim();
    stage.clearTimers(this);
    if (this.controls) { this.controls.dispose(); this.controls = null; }
    if (this.patMesh) {
      this.patMesh.geometry.dispose();
      this.patMesh.material.dispose();
      this.patMesh = null;
    }
    if (this.cutsGroup) { stage.clearGroup(this.cutsGroup); this.cutsGroup = null; }
    if (this.axesGroup) { this.axesGroup = null; }
    if (this.antGroup) { this.antGroup = null; }
    if (this.envDispose) { this.envDispose(); this.envDispose = null; }
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.THREE = null;
    this.canvasNode = null;
  },

  // ═══ UI 事件 ═══
  _caption() {
    return TYPE_LABELS[this.state.type] + ' · ' +
      (this.state.ptype === 'power' ? '功率方向图' : '场方向图');
  },

  onType(e) {
    const t = e.currentTarget.dataset.t;
    if (!t || !F_FORMULA[t]) return;
    haptic.light();
    this.state.type = t;
    this.setData({
      'S.type': t,
      formulaF: F_FORMULA[t],
      captionText: this._caption(),
    });
    this.buildPattern();
    this.refreshStats();
  },

  onHl(e) {
    const v = e.detail.value;
    this.state.hl = v / 100;
    this.setData({ hlSlider: v, hlText: this.state.hl.toFixed(2) + ' λ' });
    this.buildPattern();
    this.refreshStats();
  },
  onHlChanging(e) {
    const v = e.detail.value;
    this.state.hl = v / 100;
    this.setData({ hlSlider: v, hlText: this.state.hl.toFixed(2) + ' λ' });
    stage.throttle(this, 55, function () { this.buildPattern(); this.refreshStats(); });
  },

  onPtype(e) {
    const p = e.currentTarget.dataset.p;
    if (p !== 'power' && p !== 'field') return;
    haptic.light();
    this.state.ptype = p;
    this.setData({ 'S.ptype': p, captionText: this._caption() });
    this.buildPattern();
  },

  onCmap(e) {
    const c = e.currentTarget.dataset.c;
    if (c !== 'db' && c !== 'lin') return;
    haptic.light();
    this.state.cmap = c;
    this.setData({
      'S.cmap': c,
      legendTicks: c === 'db' ? DB_TICKS : LIN_TICKS,
    });
    this.buildPattern();
  },

  onOpacity(e) {
    const v = e.detail.value;
    this.state.opacity = v / 100;
    this.setData({ 'S.opacityVal': v, 'S.opacityText': v + '%' });
    if (this.patMesh) this.patMesh.material.opacity = v / 100;
  },
  onOpacityChanging(e) { this.onOpacity(e); },

  onRotate() {
    haptic.light();
    this.state.rotate = !this.state.rotate;
    this.setData({ 'S.rotate': this.state.rotate });
    if (this.controls) this.controls.autoRotate = this.state.rotate;
  },

  onAxes() {
    haptic.light();
    this.state.showAxes = !this.state.showAxes;
    this.setData({ 'S.showAxes': this.state.showAxes });
    if (this.axesGroup) this.axesGroup.visible = this.state.showAxes;
  },

  onCuts() {
    haptic.light();
    this.state.showCuts = !this.state.showCuts;
    this.setData({ 'S.showCuts': this.state.showCuts });
    if (this.cutsGroup) this.cutsGroup.visible = this.state.showCuts;
  },

  onAnt() {
    haptic.light();
    this.state.showAnt = !this.state.showAnt;
    this.setData({ 'S.showAnt': this.state.showAnt });
    if (this.antGroup) this.antGroup.visible = this.state.showAnt;
  },

  onTouchStart(e) { stage.touchStart(this, e); },
  onTouchMove(e) { stage.touchMove(this, e); },
  onTouchEnd(e) { stage.touchEnd(this, e); },

  onShareAppMessage() {
    return {
      title: '三维天线辐射方向图',
      path: '/pages/interactive/radiation-3d/radiation-3d',
    };
  },
});

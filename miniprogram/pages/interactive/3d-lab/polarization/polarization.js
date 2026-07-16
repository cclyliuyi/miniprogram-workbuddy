// pages/interactive/3d-lab/polarization/polarization.js —— 极化椭圆 3D (Three.js r108)
// 核心：
//   E(z,t) = x̂ Ex cos(ωt−βz) + ŷ Ey cos(ωt−βz+δ)
//   3D 行进波曲线 + 13 个矢量箭头动画 + 2D 端面椭圆
const { createScopedThreejs } = require('threejs-miniprogram');
const { registerOrbitControls } = require('../orbit-controls');
const haptic = require('../../../../utils/haptic');

Page({
  data: {
    S: { ex: 1, ey: 0.55, del: 0, preset: 'linear' },
    params: null,
  },

  THREE: null,
  canvasNode: null,
  renderer: null,
  scene: null,
  camera: null,
  controls: null,
  root: null,
  waveGroup: null,
  vecGroup: null,
  animId: null,
  t: 0,
  state: { ex: 1, ey: 0.55, del: 0 },
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
  onHide() { this.stopAnim(); },

  // ═══════════════════════════════════════════════════════════════
  //  3D 初始化
  // ═══════════════════════════════════════════════════════════════

  initThree() {
    const sel = this.createSelectorQuery();
    sel.select('#three-canvas').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0]) { console.error('[pol3d] SelectorQuery empty'); return; }
      const r = res[0];
      const canvas = r.node;
      if (!canvas) { console.error('[pol3d] canvas null'); return; }

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
      renderer.setClearColor(0x090b14, 1);
      this.renderer = renderer;

      const scene = new THREE.Scene();
      this.scene = scene;

      const camera = new THREE.PerspectiveCamera(42, cssW / cssH, 0.01, 100);
      camera.position.set(1.7, 1.25, 2.5);
      this.camera = camera;

      const controls = new THREE.OrbitControls(camera, canvas);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.target.set(0, 0, 0);
      controls.update();
      this.controls = controls;

      // 光照
      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const sun = new THREE.DirectionalLight(0xffffff, 0.8);
      sun.position.set(3, 4, 3);
      scene.add(sun);

      this.root = new THREE.Group();
      scene.add(this.root);

      this.waveGroup = new THREE.Group();
      this.vecGroup = new THREE.Group();
      this.root.add(this.waveGroup, this.vecGroup);

      // 首次构建
      this.layout();
      this.startAnim();
      this.computeParams();
      this.drawEllipse();
    });
  },

  // ═══════════════════════════════════════════════════════════════
  //  辅助
  // ═══════════════════════════════════════════════════════════════

  clearGroup(g) {
    while (g.children.length) {
      const o = g.children.pop();
      if (o.geometry) o.geometry.dispose();
    }
  },

  addLine(points, mat, parent) {
    const THREE = this.THREE;
    parent = parent || this.waveGroup;
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const l = new THREE.Line(geo, mat);
    parent.add(l);
    return l;
  },

  // E 场分量
  E(z, t) {
    const ph = 2 * Math.PI * z - (t !== undefined ? t : this.t);
    return {
      x: this.state.ex * Math.cos(ph),
      y: this.state.ey * Math.cos(ph + this.state.del * Math.PI / 180),
    };
  },

  // ═══════════════════════════════════════════════════════════════
  //  场景构建
  // ═══════════════════════════════════════════════════════════════

  layout() {
    const THREE = this.THREE;
    if (!THREE) return;

    this.clearGroup(this.waveGroup);
    this.clearGroup(this.vecGroup);

    // 传播轴
    const axisMat = new THREE.LineBasicMaterial({ color: 0x2a3148 });
    this.addLine([
      new THREE.Vector3(0, 0, -1.8),
      new THREE.Vector3(0, 0, 1.8)
    ], axisMat);

    // 三条波形曲线（静态快照 t=0）
    const matX = new THREE.LineBasicMaterial({ color: 0xff8066, transparent: true, opacity: 0.85 });
    const matY = new THREE.LineBasicMaterial({ color: 0x6f91ff, transparent: true, opacity: 0.85 });
    const matE = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.82 });

    const px = [], py = [], pe = [];
    for (let i = 0; i <= 260; i++) {
      const z = -1.7 + i / 260 * 3.4;
      const e = this.E(z, 0);
      px.push(new THREE.Vector3(e.x * 0.42, 0, z));
      py.push(new THREE.Vector3(0, e.y * 0.42, z));
      pe.push(new THREE.Vector3(e.x * 0.42, e.y * 0.42, z));
    }
    this.addLine(px, matX);
    this.addLine(py, matY);
    this.addLine(pe, matE);
  },

  updateVectors() {
    const THREE = this.THREE;
    if (!THREE) return;
    this.clearGroup(this.vecGroup);

    const matE = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    for (let k = 0; k < 13; k++) {
      const z = -1.5 + k * 0.25;
      const e = this.E(z);
      const o = new THREE.Vector3(0, 0, z);
      const tip = new THREE.Vector3(e.x * 0.42, e.y * 0.42, z);

      this.addLine([o, tip], matE, this.vecGroup);

      // 端点球
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), dotMat);
      dot.position.copy(tip);
      this.vecGroup.add(dot);
    }
  },

  // ═══════════════════════════════════════════════════════════════
  //  极化参数计算
  // ═══════════════════════════════════════════════════════════════

  computeParams() {
    const { ex, ey, del } = this.state;
    const d = del * Math.PI / 180;
    const den = ex * ex + ey * ey || 1;
    const psi = 0.5 * Math.atan2(2 * ex * ey * Math.cos(d), ex * ex - ey * ey);
    const sin2chi = 2 * ex * ey * Math.sin(d) / den;
    const chi = 0.5 * Math.asin(Math.max(-1, Math.min(1, sin2chi)));
    const ratio = Math.abs(Math.tan(chi));
    const ar = ratio < 1e-3 ? Infinity : 1 / ratio;

    let type = '椭圆';
    if (!Number.isFinite(ar) || ar > 30) type = '线极化';
    else if (ar < 1.08) type = '圆极化';

    const sense = Math.abs(del) < 3 || Math.abs(Math.abs(del) - 180) < 3 ? '无' : (del > 0 ? '左旋' : '右旋');

    this.setData({
      params: {
        type,
        ar: Number.isFinite(ar) ? ar.toFixed(2) : '∞',
        tilt: (psi * 180 / Math.PI).toFixed(0),
        sense,
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
    if (this.renderer) { this.renderer.dispose(); this.renderer = null; }
    if (this.controls) { this.controls.dispose(); this.controls = null; }
  },

  // ═══════════════════════════════════════════════════════════════
  //  触摸事件
  // ═══════════════════════════════════════════════════════════════

  onTouchStart(e) { if (this.controls) this.controls.onTouchStart(e); },
  onTouchMove(e) { if (this.controls) this.controls.onTouchMove(e); },
  onTouchEnd(e) { if (this.controls) this.controls.onTouchEnd(e); },

  // ═══════════════════════════════════════════════════════════════
  //  参数控制
  // ═══════════════════════════════════════════════════════════════

  onEx(e) {
    this.state.ex = e.detail.value;
    this.setData({ 'S.ex': e.detail.value, 'S.preset': '' });
    this._updateStatic();
  },
  onEy(e) {
    this.state.ey = e.detail.value;
    this.setData({ 'S.ey': e.detail.value, 'S.preset': '' });
    this._updateStatic();
  },
  onDel(e) {
    this.state.del = e.detail.value;
    this.setData({ 'S.del': e.detail.value, 'S.preset': '' });
    this._updateStatic();
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
  //  2D 端面椭圆
  // ═══════════════════════════════════════════════════════════════

  init2D() {
    const sel = this.createSelectorQuery();
    sel.select('#ellipse').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0]) return;
      const r = res[0];
      const canvas = r.node;
      const ctx = canvas.getContext('2d');
      const dpr = wx.getSystemInfoSync().pixelRatio || 2;
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
      ctx.scale(dpr, dpr);
      this.plotCanvas = canvas;
      this.plotCtx = ctx;
      this.plotW = r.width;
      this.plotH = r.height;
    });
  },

  drawEllipse() {
    if (!this.plotCtx) return;
    const ctx = this.plotCtx;
    const w = this.plotW, h = this.plotH;
    const { ex, ey, del } = this.state;

    ctx.fillStyle = '#0a0c16';
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2, cy = h / 2;
    const R = Math.min(w, h) * 0.36;

    // 十字轴
    ctx.strokeStyle = '#252b46';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(cx - R - 16, cy); ctx.lineTo(cx + R + 16, cy);
    ctx.moveTo(cx, cy - R - 16); ctx.lineTo(cx, cy + R + 16);
    ctx.stroke();

    // 椭圆轨迹
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 360; i++) {
      const t = i / 360 * Math.PI * 2;
      const ex_ = ex * Math.cos(t);
      const ey_ = ey * Math.cos(t + del * Math.PI / 180);
      const px = cx + ex_ * R;
      const py = cy - ey_ * R;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // 标注
    ctx.fillStyle = '#ff8066';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Ex', cx + R + 6, cy + 4);
    ctx.fillStyle = '#6f91ff';
    ctx.fillText('Ey', cx + 6, cy - R - 4);
  },
});

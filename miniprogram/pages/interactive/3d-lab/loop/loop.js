// pages/interactive/3d-lab/loop/loop.js —— 小环天线 3D (Three.js r108) · 深空暖金 v2
const { createScopedThreejs } = require('threejs-miniprogram');
const { registerOrbitControls } = require('../orbit-controls');
const stage = require('../lab3d-stage');

Page({
  data: {
    aSlider: 50,   // 50 → a=0.050
    aVal: '0.050',
    nSlider: 1,
    nVal: '1',
    lossSlider: 50, // 50 → loss=0.50
    lossVal: '0.50 Ω',
    rr: '-',
    eta: '-',
    area: '-',
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
  fieldGroup: null,
  patGroup: null,
  chargeGroup: null,
  loopMesh: null,
  animId: null,
  state: { a: 0.05, n: 1, loss: 0.5, t: 0 },
  plotCanvas: null,
  plotCtx: null,
  plotW: 0,
  plotH: 0,
  dpr: 1,
  _chargePool: null,  // 对象池：预创建 18 个球体，每帧只更新位置

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
      if (!res || !res[0]) { console.error('[loop] SelectorQuery empty'); return; }
      const r = res[0];
      const canvas = r.node;
      if (!canvas) { console.error('[loop] canvas null'); return; }

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

      const camera = new THREE.PerspectiveCamera(42, cssW / cssH, 0.01, 200);
      camera.position.set(1.45, 1.2, 1.65);
      this.camera = camera;

      const controls = new THREE.OrbitControls(camera, canvas);
      controls.enableDamping = true;
      controls.autoRotateSpeed = 1.0;
      controls.target.set(0, 0, 0);
      controls.update();
      this.controls = controls;
      this._home = stage.saveHome(controls);

      // 深空暖金舞台 + 三灯
      stage.buildStage(THREE, scene, { groundY: -1.0 });
      stage.buildLights(THREE, scene);

      const root = new THREE.Group();
      scene.add(root);
      this.root = root;

      this.fieldGroup = new THREE.Group();
      this.patGroup = new THREE.Group();
      this.chargeGroup = new THREE.Group();
      root.add(this.fieldGroup, this.patGroup, this.chargeGroup);

      this.layout();
      this.startAnim();
      stage.ready(this);
    });
  },

  // ═══════════════════════════════════════════════════════════════
  //  场景构建
  // ═══════════════════════════════════════════════════════════════

  clearGroup(g) { stage.clearGroup(g); },

  // 创建文字标注 Sprite
  makeLabel(text, x, y, z, scale) {
    const THREE = this.THREE;
    const canvas = wx.createOffscreenCanvas({ type: '2d', width: 256, height: 64 });
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.font = 'bold 28px sans-serif';
    ctx.fillStyle = 'rgba(246,217,168,0.92)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(x, y, z);
    sprite.scale.set((scale || 0.4) * 4, (scale || 0.4), 1);
    return sprite;
  },

  layout() {
    const THREE = this.THREE;
    const S = this.state;

    this.clearGroup(this.fieldGroup);
    this.clearGroup(this.patGroup);
    this.clearGroup(this.chargeGroup);  // 清除旧池 mesh
    this._chargePool = null;  // 重置池引用，下次 updateCharges 会重建

    if (this.loopMesh) {
      this.root.remove(this.loopMesh);
      this.loopMesh.geometry.dispose();
    }

    const R = 0.48 + S.a * 1.5;

    // 环（Phong 材质：高光反射代替 envMap）
    this.loopMesh = new THREE.Mesh(
      new THREE.TorusGeometry(R, 0.022, 16, 96),
      new THREE.MeshPhongMaterial({
        color: 0xffc45f, specular: 0xf6d9a8, shininess: 48,
        emissive: 0x241606, emissiveIntensity: 0.3,
      })
    );
    this.root.add(this.loopMesh);

    // 近区磁场闭合线（偶极子形态：从环内穿出、外部回绕）
    for (let k = 0; k < 10; k++) {
      const phi = k / 10 * Math.PI * 2;
      const spread = 0.28 + 0.12 * Math.sin(k * 1.3);
      const pts = [];
      for (let i = 0; i <= 64; i++) {
        const t = i / 64 * Math.PI * 2;
        // 偶极子磁力线参数方程（在环平面内）
        const rr = R * 0.55 * (1 + 0.6 * Math.cos(t));
        const localX = rr * Math.cos(t) * spread;
        const localZ = rr * Math.sin(t) * 0.7;
        pts.push(new THREE.Vector3(
          Math.cos(phi) * localX,
          Math.sin(phi) * localX,
          localZ
        ));
      }
      const opacity = 0.32 + 0.18 * Math.abs(Math.cos(phi));
      const fieldMat = new THREE.LineBasicMaterial({
        color: 0x6c88e8, transparent: true, opacity: opacity
      });
      this.fieldGroup.add(new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(pts), fieldMat));
    }

    // sin²θ 功率方向图 (甜甜圈)——渐变色 + 描边
    const pos = [], col = [], idx = [];
    const nt = 48, np = 96;
    for (let i = 0; i <= nt; i++) {
      const th = i / nt * Math.PI;
      const sinTh = Math.sin(th);
      const rr = 0.86 * sinTh * sinTh;
      // 渐变色：轴向(θ=0,π)深蓝 → 环面(θ=π/2)暖金
      const t = sinTh * sinTh; // 0=轴向, 1=环面
      const c = new THREE.Color().setHSL(0.62 - 0.50 * t, 0.72, 0.35 + 0.25 * t);
      for (let j = 0; j <= np; j++) {
        const ph = j / np * Math.PI * 2;
        pos.push(
          rr * sinTh * Math.cos(ph),
          rr * sinTh * Math.sin(ph),
          rr * Math.cos(th)
        );
        col.push(c.r, c.g, c.b);
      }
    }
    for (let i = 0; i < nt; i++) {
      for (let j = 0; j < np; j++) {
        const a = i * (np + 1) + j;
        const b = a + 1;
        const c = a + (np + 1);
        const d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.addAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.addAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();

    this.patGroup.add(new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
      vertexColors: true, transparent: true, opacity: 0.38,
      side: THREE.DoubleSide, specular: 0x334466, shininess: 12,
    })));

    // 方向图边缘描边（环面最大处 θ=π/2 的圆）
    const rimPts = [];
    for (let j = 0; j <= 96; j++) {
      const ph = j / 96 * Math.PI * 2;
      rimPts.push(new THREE.Vector3(0.86 * Math.cos(ph), 0.86 * Math.sin(ph), 0));
    }
    this.patGroup.add(new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(rimPts),
      new THREE.LineBasicMaterial({ color: 0xf6d9a8, transparent: true, opacity: 0.7 })
    ));

    // 文字标注
    this.patGroup.add(this.makeLabel('sin²θ 方向图', 0, 0, 0.95, 0.3));
    this.fieldGroup.add(this.makeLabel('磁力线', R * 0.7, 0, 0.4, 0.26));
  },

  updateCharges() {
    const THREE = this.THREE;
    const S = this.state;
    const R = 0.48 + S.a * 1.5;

    // 对象池：首次创建 18 个球体，之后只更新位置/缩放/颜色
    if (!this._chargePool) {
      this._chargePool = [];
      const posMat = new THREE.MeshBasicMaterial({ color: 0xff8a5b });
      const negMat = new THREE.MeshBasicMaterial({ color: 0x5f8bff });
      for (let i = 0; i < 18; i++) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), posMat.clone());
        this.chargeGroup.add(m);
        this._chargePool.push(m);
      }
    }

    for (let i = 0; i < 18; i++) {
      const a = i / 18 * Math.PI * 2 + S.t;
      const amp = 0.5 + 0.5 * Math.sin(i * 0.7 + S.t);
      const m = this._chargePool[i];
      m.position.set(Math.cos(a) * R, Math.sin(a) * R, 0.03 * Math.sin(S.t + i));
      m.scale.setScalar(1 + 0.48 * amp);
      m.material.color.setHex(amp > 0.5 ? 0xff8a5b : 0x5f8bff);
    }
  },

  // ═══════════════════════════════════════════════════════════════
  //  动画循环
  // ═══════════════════════════════════════════════════════════════

  startAnim() {
    if (this.animId || !this.canvasNode) return;
    const tick = () => {
      this.animId = this.canvasNode.requestAnimationFrame(tick);
      this.state.t += 0.045;
      this.updateCharges();
      if (this.fieldGroup) this.fieldGroup.rotation.z = 0.07 * Math.sin(this.state.t * 0.25);
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

  onA(e) {
    this.state.a = e.detail.value / 1000;
    this.setData({ aVal: this.state.a.toFixed(3) });
    this.updateStats();
    this.layout();
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

  updateStats() {
    const S = this.state;
    const area = S.n * Math.PI * S.a * S.a;
    const rr = 31200 * area * area;
    const eta = rr / (rr + S.loss);
    this.setData({
      rr: rr < 1 ? rr.toFixed(3) + ' Ω' : rr.toFixed(1) + ' Ω',
      eta: (eta * 100).toFixed(1) + '%',
      area: area.toFixed(4),
    });
    this.drawPlot();
  },

  // ═══════════════════════════════════════════════════════════════
  //  2D 方向图
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
      this.dpr = dpr;
      this.updateStats();
      this.drawPlot();
    });
  },

  drawPlot() {
    if (!this.plotCtx) return;
    const pg = this.plotCtx;
    const w = this.plotW, h = this.plotH;
    const cx = w / 2, cy = h / 2;
    const R = Math.min(w, h) * 0.36;

    pg.fillStyle = '#1c2130';
    pg.fillRect(0, 0, w, h);

    pg.strokeStyle = '#313a55';
    pg.beginPath();
    pg.moveTo(cx - R - 12, cy); pg.lineTo(cx + R + 12, cy);
    pg.moveTo(cx, cy - R - 12); pg.lineTo(cx, cy + R + 12);
    pg.stroke();

    pg.strokeStyle = '#f0e6d6';
    pg.lineWidth = 2;
    pg.beginPath();
    for (let i = 0; i <= 720; i++) {
      const th = i / 720 * Math.PI;
      const r = Math.sin(th) ** 2 * R;
      const x = cx + r * Math.sin(th);
      const y = cy - r * Math.cos(th);
      i ? pg.lineTo(x, y) : pg.moveTo(x, y);
    }
    for (let i = 720; i >= 0; i--) {
      const th = i / 720 * Math.PI;
      const r = Math.sin(th) ** 2 * R;
      pg.lineTo(cx - r * Math.sin(th), cy - r * Math.cos(th));
    }
    pg.closePath();
    pg.stroke();
    pg.fillStyle = 'rgba(108,136,232,.12)';
    pg.fill();

    pg.fillStyle = '#7c89b0';
    pg.font = '11px sans-serif';
    pg.fillText('轴向为零，环面内最大', cx - R, cy + R + 22);
  },
});

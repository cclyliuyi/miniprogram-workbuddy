// pages/interactive/3d-lab/loop/loop.js —— 小环天线 3D (Three.js r108)
const { createScopedThreejs } = require('threejs-miniprogram');
const { registerOrbitControls } = require('../orbit-controls');

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
      renderer.setClearColor(0x2a2e3a, 1);
      this.renderer = renderer;

      const scene = new THREE.Scene();
      this.scene = scene;

      const camera = new THREE.PerspectiveCamera(42, cssW / cssH, 0.01, 100);
      camera.position.set(1.45, 1.2, 1.65);
      this.camera = camera;

      const controls = new THREE.OrbitControls(camera, canvas);
      controls.enableDamping = true;
      controls.target.set(0, 0, 0);
      controls.update();
      this.controls = controls;

      // 三点布光（暖色调）
      scene.add(new THREE.AmbientLight(0xfff4e6, 0.75));
      const sun = new THREE.DirectionalLight(0xfff0d8, 1.2);
      sun.position.set(3, 4, 4);
      scene.add(sun);
      const rim = new THREE.DirectionalLight(0xffd9a8, 0.5);
      rim.position.set(-3, 1, -3);
      scene.add(rim);

      const root = new THREE.Group();
      scene.add(root);
      this.root = root;

      this.fieldGroup = new THREE.Group();
      this.patGroup = new THREE.Group();
      this.chargeGroup = new THREE.Group();
      root.add(this.fieldGroup, this.patGroup, this.chargeGroup);

      this.layout();
      this.startAnim();
    });
  },

  // ═══════════════════════════════════════════════════════════════
  //  场景构建
  // ═══════════════════════════════════════════════════════════════

  clearGroup(g) {
    while (g.children.length) {
      const o = g.children.pop();
      if (o.geometry) o.geometry.dispose();
    }
  },

  layout() {
    const THREE = this.THREE;
    const S = this.state;

    this.clearGroup(this.fieldGroup);
    this.clearGroup(this.patGroup);
    this.clearGroup(this.chargeGroup);

    if (this.loopMesh) {
      this.root.remove(this.loopMesh);
      this.loopMesh.geometry.dispose();
    }

    const R = 0.48 + S.a * 1.5;

    // 环
    this.loopMesh = new THREE.Mesh(
      new THREE.TorusGeometry(R, 0.018, 14, 96),
      new THREE.MeshStandardMaterial({ color: 0xffc45f, metalness: 0.65, roughness: 0.28 })
    );
    this.root.add(this.loopMesh);

    // 近区磁场闭合线
    const fieldMat = new THREE.LineBasicMaterial({ color: 0x6f91ff, transparent: true, opacity: 0.48 });
    for (let k = 0; k < 8; k++) {
      const z = (-0.55 + k * 0.16);
      const pts = [];
      for (let i = 0; i <= 96; i++) {
        const a = i / 96 * Math.PI * 2;
        pts.push(new THREE.Vector3(
          Math.cos(a) * (R * 0.7 + 0.18 * Math.cos(z * 5)),
          Math.sin(a) * (R * 0.7 + 0.18 * Math.cos(z * 5)),
          z * 0.55
        ));
      }
      this.fieldGroup.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), fieldMat));
    }

    // sin²θ 功率方向图 (甜甜圈)
    const pos = [], idx = [];
    const nt = 40, np = 80;
    for (let i = 0; i <= nt; i++) {
      const th = i / nt * Math.PI;
      const rr = 0.86 * Math.sin(th) * Math.sin(th);
      for (let j = 0; j <= np; j++) {
        const ph = j / np * Math.PI * 2;
        pos.push(
          rr * Math.sin(th) * Math.cos(ph),
          rr * Math.sin(th) * Math.sin(ph),
          rr * Math.cos(th)
        );
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

    // ⚠️ r108: addAttribute 不是 setAttribute
    const geo = new THREE.BufferGeometry();
    geo.addAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();

    this.patGroup.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.16, side: THREE.DoubleSide
    })));
  },

  updateCharges() {
    const THREE = this.THREE;
    const S = this.state;
    this.clearGroup(this.chargeGroup);

    const R = 0.48 + S.a * 1.5;
    const posMat = new THREE.MeshBasicMaterial({ color: 0xff8a5b });
    const negMat = new THREE.MeshBasicMaterial({ color: 0x5f8bff });

    for (let i = 0; i < 18; i++) {
      const a = i / 18 * Math.PI * 2 + S.t;
      const amp = 0.5 + 0.5 * Math.sin(i * 0.7 + S.t);
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.025 + 0.012 * amp, 8, 8),
        amp > 0.5 ? posMat : negMat
      );
      m.position.set(Math.cos(a) * R, Math.sin(a) * R, 0.03 * Math.sin(S.t + i));
      this.chargeGroup.add(m);
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

  onA(e) {
    this.state.a = e.detail.value / 1000;
    this.setData({ aVal: this.state.a.toFixed(3) });
    this.updateStats();
    this.layout();
  },
  onTurns(e) {
    this.state.n = e.detail.value;
    this.setData({ nVal: String(this.state.n) });
    this.updateStats();
  },
  onLoss(e) {
    this.state.loss = e.detail.value / 100;
    this.setData({ lossVal: this.state.loss.toFixed(2) + ' Ω' });
    this.updateStats();
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
      const dpr = wx.getSystemInfoSync().pixelRatio || 2;
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

    pg.fillStyle = '#0a0c16';
    pg.fillRect(0, 0, w, h);

    pg.strokeStyle = '#252b46';
    pg.beginPath();
    pg.moveTo(cx - R - 12, cy); pg.lineTo(cx + R + 12, cy);
    pg.moveTo(cx, cy - R - 12); pg.lineTo(cx, cy + R + 12);
    pg.stroke();

    pg.strokeStyle = '#fff';
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
    pg.fillStyle = 'rgba(111,145,255,.12)';
    pg.fill();

    pg.fillStyle = '#9aa6cc';
    pg.font = '11px sans-serif';
    pg.fillText('轴向为零，环面内最大', cx - R, cy + R + 22);
  },
});

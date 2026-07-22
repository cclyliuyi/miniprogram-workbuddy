// pages/interactive/3d-lab/parabolic/parabolic.js —— 抛物面反射器 3D (r108) · 深空暖金 v2
const { createScopedThreejs } = require('threejs-miniprogram');
const { registerOrbitControls } = require('../orbit-controls');
const stage = require('../lab3d-stage');

Page({
  data: {
    fdSlider: 40, fdVal: '0.40',
    raySlider: 18, rayVal: '18',
    dzSlider: 0, dzVal: '0.00',
    showIn: true, showOut: true, showPhase: true,
    focal: '-', theta: '-', phase: '-', gain: '-',
    showHint: true,
    glReady: false,
  },

  THREE: null, canvasNode: null, renderer: null, scene: null,
  camera: null, controls: null, root: null,
  dishGroup: null, rayGroup: null, phaseGroup: null,
  animId: null,
  state: { fd: 0.40, rays: 18, dz: 0, show: { in: true, out: true, phase: true } },
  plotCtx: null, plotW: 0, plotH: 0,
  lastKey: '',

  onReady() { this.initThree(); this.init2D(); },
  onUnload() { this.dispose(); },
  onHide() { this.stopAnim(); stage.clearTimers(this); },
  onShow() { if (this.canvasNode && this.renderer) { this.startAnim(); stage.scheduleIdle(this); } },

  clamp(v, a, b) { return Math.max(a, Math.min(b, v)); },

  initThree() {
    const sel = this.createSelectorQuery();
    sel.select('#three-canvas').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0]) return;
      const r = res[0];
      const canvas = r.node;
      if (!canvas) return;
      const cssW = r.width, cssH = r.height;
      if (!cssW || !cssH) { setTimeout(() => this.initThree(), 200); return; }

      this.canvasNode = canvas;
      const dpr = wx.getWindowInfo().pixelRatio || 2;

      const THREE = createScopedThreejs(canvas);
      this.THREE = THREE;
      registerOrbitControls(THREE);

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setPixelRatio(Math.min(dpr, 2));
      renderer.setSize(cssW, cssH, false);
      renderer.setClearColor(stage.COL.bgEdge, 1);
      this.renderer = renderer;

      const scene = new THREE.Scene();
      this.scene = scene;
      const camera = new THREE.PerspectiveCamera(42, cssW / cssH, 0.01, 200);
      this.camera = camera;

      const controls = new THREE.OrbitControls(camera, canvas);
      controls.enableDamping = true;
      controls.autoRotateSpeed = 1.0;
      this.controls = controls;

      // 深空暖金舞台 + 三灯（盘面半径 3λ，地面按比例放大）
      stage.buildStage(THREE, scene, { groundY: -3.4, groundScale: 1.8 });
      stage.buildLights(THREE, scene);

      const root = new THREE.Group();
      scene.add(root);
      this.root = root;

      this.dishGroup = new THREE.Group();
      this.rayGroup = new THREE.Group();
      this.phaseGroup = new THREE.Group();
      root.add(this.dishGroup, this.rayGroup, this.phaseGroup);

      this.renderAll();
      this.startAnim();
      stage.ready(this);
    });
  },

  clearGroup(g) { stage.clearGroup(g); },

  metrics() {
    const S = this.state;
    const D = 6;
    const F = S.fd * D;
    const theta = Math.atan((D / 2) / F);
    const dz = S.dz * F;
    const loss = 1 / (1 + 18 * S.dz * S.dz);
    const gain = 10 * Math.log10(4 * Math.PI * 0.56 * loss * D * D);
    return { D, F, theta, dz, loss, gain };
  },

  surfacePoint(r, ang, m) {
    const THREE = this.THREE;
    return new THREE.Vector3(r * Math.cos(ang), r * Math.sin(ang), r * r / (4 * m.F));
  },

  normalAt(p, m) {
    const THREE = this.THREE;
    return new THREE.Vector3(-p.x, -p.y, 2 * m.F).normalize();
  },

  reflectDir(feed, p, m) {
    const inc = p.clone().sub(feed).normalize();
    const n = this.normalAt(p, m);
    return inc.sub(n.multiplyScalar(2 * inc.dot(n))).normalize();
  },

  pathError(r, m) {
    const THREE = this.THREE;
    const feed = new THREE.Vector3(0, 0, m.F + m.dz);
    const p = this.surfacePoint(r, 0, m);
    const zRef = (m.D / 2) ** 2 / (4 * m.F);
    return feed.distanceTo(p) + (zRef - p.z);
  },

  errors(m) {
    const arr = [];
    const c = this.pathError(0, m);
    for (let i = 0; i <= 80; i++) {
      const r = (m.D / 2) * i / 80;
      arr.push((this.pathError(r, m) - c) * 360);
    }
    return arr;
  },

  layout3d(m, err) {
    const THREE = this.THREE;
    const S = this.state;
    this.clearGroup(this.dishGroup);
    this.clearGroup(this.rayGroup);
    this.clearGroup(this.phaseGroup);

    // 抛物面网格
    const rs = 46, as = 96;
    const pos = [], col = [], idx = [];
    const maxErr = Math.max(1, ...err.map(x => Math.abs(x)));

    for (let ir = 0; ir <= rs; ir++) {
      const r = m.D / 2 * ir / rs;
      for (let ia = 0; ia <= as; ia++) {
        const a = ia / as * Math.PI * 2;
        const p = this.surfacePoint(r, a, m);
        pos.push(p.x, p.y, p.z);
        const e = (this.pathError(r, m) - this.pathError(0, m)) * 360 / maxErr;
        const c = new THREE.Color().setHSL(0.58 - 0.38 * (e * 0.5 + 0.5), 0.74, 0.45);
        col.push(c.r, c.g, c.b);
      }
    }
    for (let ir = 0; ir < rs; ir++) {
      for (let ia = 0; ia < as; ia++) {
        const a = ir * (as + 1) + ia;
        const b = a + 1;
        const c = a + (as + 1);
        const d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }

    // ⚠️ r108: addAttribute
    const geo = new THREE.BufferGeometry();
    geo.addAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.addAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();

    const dishMat = new THREE.MeshStandardMaterial({
      color: 0xb06f2b, metalness: 0.45, roughness: 0.30,
      emissive: 0x201205, emissiveIntensity: 0.35,
      side: THREE.DoubleSide, transparent: true, opacity: 0.92
    });
    this.dishGroup.add(new THREE.Mesh(geo, dishMat));

    // 边缘
    const rimPts = [];
    for (let i = 0; i <= 160; i++) rimPts.push(this.surfacePoint(m.D / 2, i / 160 * Math.PI * 2, m));
    this.dishGroup.add(new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(rimPts),
      new THREE.LineBasicMaterial({ color: 0xf3c36b, transparent: true, opacity: 0.65 })
    ));

    // 馈源
    const feed = new THREE.Vector3(0, 0, m.F + m.dz);
    const feedMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 18, 18),
      new THREE.MeshStandardMaterial({ color: 0x7fa0ff, emissive: 0x1a3870, emissiveIntensity: 0.5, metalness: 0.35, roughness: 0.38 })
    );
    feedMesh.position.copy(feed);
    this.dishGroup.add(feedMesh);

    // 射线
    const inMat = new THREE.LineBasicMaterial({ color: 0x6c88e8, transparent: true, opacity: 0.62 });
    const outMat = new THREE.LineBasicMaterial({ color: 0xf0e6d6, transparent: true, opacity: 0.70 });

    const rings = Math.max(1, Math.round(S.rays / 6));
    const per = Math.max(8, Math.round(S.rays / rings));
    for (let ir = 1; ir <= rings; ir++) {
      const r = m.D / 2 * (0.22 + 0.70 * ir / rings);
      for (let ia = 0; ia < per; ia++) {
        const p = this.surfacePoint(r, ia / per * Math.PI * 2, m);
        const dir = this.reflectDir(feed, p, m);
        const end = p.clone().add(dir.multiplyScalar(1.35));

        if (S.show.in) {
          const g1 = new THREE.BufferGeometry().setFromPoints([feed, p]);
          this.rayGroup.add(new THREE.Line(g1, inMat));
        }
        if (S.show.out) {
          const g2 = new THREE.BufferGeometry().setFromPoints([p, end]);
          this.rayGroup.add(new THREE.Line(g2, outMat));
        }
      }
    }

    if (S.show.phase) {
      this.phaseGroup.add(new THREE.Points(geo.clone(), new THREE.PointsMaterial({
        size: 0.035, vertexColors: true, transparent: true, opacity: 0.9
      })));
    }

    // 相机只在首次定位；之后用户视角不被参数修改打断
    if (!this._camInit) {
      this.camera.position.set(m.D * 0.66, -m.D * 0.72, m.D * 0.58);
      this.controls.target.set(0, 0, m.F * 0.28);
      this.camera.near = 0.01; this.camera.far = 200;
      this.camera.updateProjectionMatrix();
      this.controls.update();
      this._home = stage.saveHome(this.controls);
      this._camInit = true;
    }
    this.controls.update();
  },

  startAnim() {
    if (this.animId || !this.canvasNode) return;
    const tick = () => {
      this.animId = this.canvasNode.requestAnimationFrame(tick);
      if (this.root) this.root.rotation.z = 0.035 * Math.sin(Date.now() / 2100);
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

  onFd(e) { this.state.fd = e.detail.value / 100; this.setData({ fdVal: this.state.fd.toFixed(2) }); this.renderAll(); },
  onFdChanging(e) { this.state.fd = e.detail.value / 100; this.setData({ fdVal: this.state.fd.toFixed(2) }); stage.throttle(this); },
  onRays(e) { this.state.rays = e.detail.value; this.setData({ rayVal: String(this.state.rays) }); this.renderAll(); },
  onRaysChanging(e) { this.state.rays = e.detail.value; this.setData({ rayVal: String(this.state.rays) }); stage.throttle(this); },
  onDz(e) { this.state.dz = e.detail.value / 100; this.setData({ dzVal: this.state.dz.toFixed(2) }); this.renderAll(); },
  onDzChanging(e) { this.state.dz = e.detail.value / 100; this.setData({ dzVal: this.state.dz.toFixed(2) }); stage.throttle(this); },

  onTogIn() { this.state.show.in = !this.state.show.in; this.setData({ showIn: this.state.show.in }); this.renderAll(); },
  onTogOut() { this.state.show.out = !this.state.show.out; this.setData({ showOut: this.state.show.out }); this.renderAll(); },
  onTogPhase() { this.state.show.phase = !this.state.show.phase; this.setData({ showPhase: this.state.show.phase }); this.renderAll(); },

  renderAll() {
    const m = this.metrics();
    const err = this.errors(m);
    this.setData({
      focal: m.F.toFixed(2) + ' λ',
      theta: (m.theta * 180 / Math.PI).toFixed(1) + '°',
      phase: (Math.max(...err) - Math.min(...err)).toFixed(0) + '°',
      gain: m.gain.toFixed(1) + ' dBi',
    });
    this.drawPlot(m, err);
    const key = JSON.stringify(this.state);
    if (key !== this.lastKey) {
      this.layout3d(m, err);
      this.lastKey = key;
    }
  },

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
      this.plotCtx = ctx;
      this.plotW = r.width;
      this.plotH = r.height;
      const m = this.metrics();
      this.drawPlot(m, this.errors(m));
    });
  },

  drawPlot(m, err) {
    if (!this.plotCtx) return;
    const pg = this.plotCtx;
    const w = this.plotW, h = this.plotH;
    pg.fillStyle = '#1c2130';
    pg.fillRect(0, 0, w, h);
    const L = 40, R = w - 14, T = 16, B = h - 24;
    const max = Math.max(20, ...err.map(x => Math.abs(x)));
    pg.strokeStyle = '#313a55';
    for (let i = -2; i <= 2; i++) {
      const y = (T + B) / 2 - i * (B - T) / 4;
      pg.beginPath(); pg.moveTo(L, y); pg.lineTo(R, y); pg.stroke();
    }
    pg.strokeStyle = '#6c88e8';
    pg.lineWidth = 2;
    pg.beginPath();
    err.forEach((e, i) => {
      const x = L + i * (R - L) / (err.length - 1);
      const y = (T + B) / 2 - e / max * (B - T) * 0.46;
      i ? pg.lineTo(x, y) : pg.moveTo(x, y);
    });
    pg.stroke();
    pg.fillStyle = '#7c89b0';
    pg.font = '10px Consolas';
    pg.textAlign = 'left';
    pg.fillText('中心 → 边缘路径相位误差', L, T - 4);
    pg.textAlign = 'right';
    pg.fillText('±' + max.toFixed(0) + '°', R, T - 4);
  },
});

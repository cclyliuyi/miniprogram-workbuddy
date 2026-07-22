// pages/interactive/3d-lab/horn/horn.js —— 喇叭天线 3D (r108) · 深空暖金实验室 v2
const { createScopedThreejs } = require('threejs-miniprogram');
const { registerOrbitControls } = require('../orbit-controls');
const stage = require('../lab3d-stage');
const COL = stage.COL;

Page({
  data: {
    aSlider: 60, aVal: '6.0',
    lSlider: 80, lVal: '8.0',
    tapSlider: 10, tapVal: '-10 dB',
    phase: '-', gain: '-', flare: '-', hpbw: '-',
    showHint: true,   // 手势提示（2.4s 后淡出）
    glReady: false,   // WebGL 骨架屏开关
  },

  THREE: null, canvasNode: null, renderer: null, scene: null,
  camera: null, controls: null, root: null,
  hornGroup: null, phaseGroup: null, waveGroup: null,
  animId: null,
  state: { A: 6, R: 8, tap: 10, ph: 0 },
  plotCtx: null, plotW: 0, plotH: 0,
  lastKey: '',
  _camInit: false, _home: null,        // 相机只初始化一次；home 视角用于双击复位
  _pt: null,                           // 参数重建节流定时器
  _idleT: null, _hintT: null,          // 闲置自转 / 提示淡出定时器
  _lastTap: 0, _moved: false, _tapX: 0, _tapY: 0,

  onReady() { this.initThree(); this.init2D(); },
  onUnload() { this.dispose(); },
  onHide() { this.stopAnim(); this.clearTimers(); },
  onShow() { if (this.canvasNode && this.renderer) { this.startAnim(); stage.scheduleIdle(this); } },

  clamp(v, a, b) { return Math.max(a, Math.min(b, v)); },
  sinc(x) { return Math.abs(x) < 1e-6 ? 1 : Math.sin(x) / x; },

  // ═══════════════ 场景初始化 ═══════════════
  initThree() {
    const sel = this.createSelectorQuery();
    sel.select('#three-canvas').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0]) { console.error('[horn] SelectorQuery empty'); return; }
      const r = res[0];
      const canvas = r.node;
      if (!canvas) { console.error('[horn] canvas null'); return; }
      const cssW = r.width, cssH = r.height;
      if (!cssW || !cssH) { setTimeout(() => this.initThree(), 200); return; }

      try {
        this.canvasNode = canvas;
        const dpr = wx.getWindowInfo().pixelRatio || 2;

        const THREE = createScopedThreejs(canvas);
        this.THREE = THREE;
        registerOrbitControls(THREE);

        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setPixelRatio(Math.min(dpr, 2));
        renderer.setSize(cssW, cssH, false);
        renderer.setClearColor(COL.bgEdge, 1);
        this.renderer = renderer;

        const scene = new THREE.Scene();
        this.scene = scene;
        const camera = new THREE.PerspectiveCamera(42, cssW / cssH, 0.01, 200);
        this.camera = camera;

        const controls = new THREE.OrbitControls(camera, canvas);
        controls.enableDamping = true;
        controls.autoRotateSpeed = 1.0;
        this.controls = controls;

        this.buildStage = null;   // 舞台已模块化
        stage.buildStage(THREE, scene, { groundY: -1.08 });   // 渐变天穹 + 极坐标地面 + 接触光环
        stage.buildLights(THREE, scene);                      // 三灯：主光暖白 / 轮廓暖金 / 底部青蓝

        const root = new THREE.Group();
        scene.add(root);
        this.root = root;
        this.hornGroup = new THREE.Group();
        this.phaseGroup = new THREE.Group();
        this.waveGroup = new THREE.Group();
        root.add(this.hornGroup, this.phaseGroup, this.waveGroup);

        this.renderAll();
        this.startAnim();
        stage.ready(this);   // 撤骨架屏 + 提示淡出 + 闲置自转
      } catch (err) {
        console.error('[horn] initThree error:', err);
      }
    });
  },

  clearGroup(g) { stage.clearGroup(g); },

  // ═══════════════ 物理度量 ═══════════════
  metrics() {
    const S = this.state;
    const A = S.A, R = S.R;
    const edge = Math.sqrt(R * R + (A / 2) ** 2) - R;
    const phaseDeg = 360 * edge;
    const flare = Math.atan((A / 2) / R) * 180 / Math.PI;
    const phaseLoss = Math.max(0.42, Math.cos(Math.min(Math.PI / 2, phaseDeg * Math.PI / 360)) ** 2);
    const tapLoss = 1 - 0.018 * S.tap;
    const eta = this.clamp(0.72 * phaseLoss * tapLoss, 0.28, 0.78);
    const gain = 10 * Math.log10(4 * Math.PI * eta * A * A);
    const hpbw = 51 / A * (1 + 0.35 * (1 - phaseLoss) + 0.012 * S.tap);
    return { edge, phaseDeg, flare, eta, gain, hpbw };
  },

  cut(deg, plane, m) {
    const S = this.state;
    const u = Math.sin(deg * Math.PI / 180);
    const x = Math.PI * S.A * u;
    const taper = Math.pow(10, -S.tap / 20);
    let f = Math.abs(this.sinc(x * (plane === 'E' ? 1 : 0.72)));
    f = taper + (1 - taper) * f;
    const phasePenalty = 1 / (1 + 0.0018 * m.phaseDeg * Math.abs(u) ** 1.6);
    return f * phasePenalty;
  },

  // ═══════════════ 几何搭建 ═══════════════
  layout3d(m) {
    const THREE = this.THREE;
    const S = this.state;
    this.clearGroup(this.hornGroup);
    this.clearGroup(this.phaseGroup);
    this.clearGroup(this.waveGroup);

    const s = 0.12;
    const A = S.A * s, R = S.R * s, th = 0.26 * s;
    const ap = A, thr = Math.max(0.42 * s, ap * 0.18);
    const z0 = -R / 2, z1 = R / 2;

    // ── 喇叭壁（双调暖铜：降 metalness 补偿无 envMap，微自发光托底）──
    const pts = [
      [-thr / 2, -thr / 2, z0], [thr / 2, -thr / 2, z0],
      [thr / 2, thr / 2, z0], [-thr / 2, thr / 2, z0],
      [-ap / 2, -ap / 2, z1], [ap / 2, -ap / 2, z1],
      [ap / 2, ap / 2, z1], [-ap / 2, ap / 2, z1]
    ].map(p => new THREE.Vector3(p[0], p[1], p[2]));

    const faces = [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
    const posArr = [];
    faces.forEach(f => {
      const [a, b, c, d] = f;
      [[a, b, c], [a, c, d]].forEach(t => t.forEach(i => {
        posArr.push(pts[i].x, pts[i].y, pts[i].z);
      }));
    });

    // ⚠️ r108: addAttribute
    const geo = new THREE.BufferGeometry();
    geo.addAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
    geo.computeVertexNormals();
    const metal = new THREE.MeshStandardMaterial({
      color: COL.copper, metalness: 0.45, roughness: 0.30,
      emissive: 0x241408, emissiveIntensity: 0.35,
      side: THREE.DoubleSide,
    });
    this.hornGroup.add(new THREE.Mesh(geo, metal));

    // 四条棱线高光（勾勒轮廓，深色底上的"勾边"）
    const edgeLines = [];
    [0, 1, 2, 3].forEach(i => { edgeLines.push(pts[i], pts[i + 4]); });
    this.hornGroup.add(new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(edgeLines),
      new THREE.LineBasicMaterial({ color: COL.copperHi, transparent: true, opacity: 0.5 })
    ));

    // ── 喉部 ──
    const throat = new THREE.Mesh(
      new THREE.BoxGeometry(thr * 0.82, thr * 0.82, th),
      new THREE.MeshStandardMaterial({ color: COL.throat, metalness: 0.5, roughness: 0.4 })
    );
    throat.position.z = z0 - th * 0.55;
    this.hornGroup.add(throat);

    // ── 口径边框（提亮）──
    const rimPts = [pts[4], pts[5], pts[6], pts[7]];
    const rimGeo = new THREE.BufferGeometry().setFromPoints(rimPts);
    this.hornGroup.add(new THREE.LineLoop(rimGeo, new THREE.LineBasicMaterial({
      color: COL.copperHi, transparent: true, opacity: 0.9
    })));

    // ── 口径相位：点云 → 连续色面 ──
    const SEG = 29;
    const pg = new THREE.PlaneBufferGeometry(ap, ap, SEG, SEG);
    const ppos = pg.getAttribute('position');
    const col = [];
    const maxPhase = Math.max(1, m.phaseDeg);
    for (let i = 0; i < ppos.count; i++) {
      const x = ppos.getX(i), y = ppos.getY(i);
      const rr = Math.sqrt(x * x + y * y) / (ap / Math.SQRT2);
      const phase = this.clamp(rr * rr * m.phaseDeg / maxPhase, 0, 1);
      const c = new THREE.Color().setHSL(0.60 - 0.42 * phase, 0.82, 0.45 + 0.14 * (1 - phase));
      col.push(c.r, c.g, c.b);
    }
    pg.addAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const aperture = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.96, side: THREE.DoubleSide,
    }));
    aperture.position.z = z1 + 0.012;
    this.phaseGroup.add(aperture);

    // ── 等相位波前：加色混合 + 纵深衰减（发光感）──
    for (let k = 0; k < 8; k++) {
      const z = z1 + 0.18 + k * 0.11;
      const rx = ap * 0.45 + k * 0.035;
      const pts2 = [];
      for (let i = 0; i <= 80; i++) {
        const a = i / 80 * Math.PI * 2;
        pts2.push(new THREE.Vector3(
          Math.cos(a) * rx, Math.sin(a) * rx, z + 0.022 * Math.sin(a * 2 + this.state.ph)
        ));
      }
      const baseOp = 0.50 - k * 0.045;  // 越远越淡
      const wmat = new THREE.LineBasicMaterial({
        color: COL.wave, transparent: true, opacity: baseOp,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      wmat.userData = { baseOp };
      this.waveGroup.add(new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(pts2), wmat));
    }

    // 相机只在首次定位；之后用户视角不被参数修改打断
    if (!this._camInit) {
      this.camera.position.set(ap * 0.85, ap * 0.65, R * 0.85);
      this.camera.updateProjectionMatrix();
      this.controls.target.set(0, 0, 0);
      this.controls.update();
      this._home = stage.saveHome(this.controls);
      this._camInit = true;
    }
    this.controls.update();
  },

  // ═══════════════ 动画循环 ═══════════════
  startAnim() {
    if (this.animId || !this.canvasNode) return;
    const tick = () => {
      this.animId = this.canvasNode.requestAnimationFrame(tick);
      this.state.ph += 0.025;
      if (this.root) this.root.rotation.y = 0.08 * Math.sin(this.state.ph * 0.16);
      if (this.waveGroup) {
        this.waveGroup.children.forEach((l, i) => {
          const b = l.material.userData.baseOp || 0.3;
          l.material.opacity = b * (0.55 + 0.45 * Math.sin(this.state.ph + i * 0.5) ** 2);
        });
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

  clearTimers() { stage.clearTimers(this); },

  dispose() {
    this.stopAnim();
    this.clearTimers();
    if (this.renderer) { this.renderer.dispose(); this.renderer = null; }
    if (this.controls) { this.controls.dispose(); this.controls = null; }
  },

  // ═══════════════ 触摸：旋转/缩放 + 双击复位 + 闲置自转 ═══════════════
  onTouchStart(e) { stage.touchStart(this, e); },
  onTouchMove(e) { stage.touchMove(this, e); },
  onTouchEnd(e) { stage.touchEnd(this, e); },

  // ═══════════════ 参数：拖动节流 + 松手精修 ═══════════════
  onAChanging(e) { this.queueParam('A', e.detail.value / 10); },
  onRChanging(e) { this.queueParam('R', e.detail.value / 10); },
  onTapChanging(e) { this.queueParam('tap', e.detail.value); },

  queueParam(key, val) {
    this.state[key] = val;
    stage.throttle(this);                    // 55ms 节流窗口内合并
  },

  onA(e) { this.state.A = e.detail.value / 10; this.renderAll(); },
  onR(e) { this.state.R = e.detail.value / 10; this.renderAll(); },
  onTap(e) { this.state.tap = e.detail.value; this.renderAll(); },

  renderAll() {
    const S = this.state;
    const m = this.metrics();
    this.setData({
      aVal: S.A.toFixed(1),
      lVal: S.R.toFixed(1),
      tapVal: '-' + S.tap + ' dB',
      phase: m.phaseDeg.toFixed(0) + '°',
      gain: m.gain.toFixed(1) + ' dBi',
      flare: m.flare.toFixed(1) + '°',
      hpbw: m.hpbw.toFixed(1) + '°',
    });
    const key = [S.A, S.R, S.tap].join('|');
    if (key !== this.lastKey) {
      this.layout3d(m);
      this.lastKey = key;
    }
    this.drawPattern(m);
  },

  // ═══════════════ 2D 方向图（深空同色系）═══════════════
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
      this.plotCtx = ctx;
      this.plotW = r.width;
      this.plotH = r.height;
      this.drawPattern(this.metrics());
    });
  },

  drawPattern(m) {
    if (!this.plotCtx) return;
    const pg = this.plotCtx;
    const w = this.plotW, h = this.plotH;
    pg.fillStyle = '#1c2130';                    // 与 3D 天穹同系
    pg.fillRect(0, 0, w, h);

    const L = 42, R = w - 16, T = 16, B = h - 26, minDb = -45;
    pg.strokeStyle = '#313a55';
    pg.lineWidth = 1;
    for (let db = minDb; db <= 0; db += 10) {
      const y = T + (-db / (-minDb)) * (B - T);
      pg.beginPath();
      pg.moveTo(L, y); pg.lineTo(R, y); pg.stroke();
      pg.fillStyle = '#7c89b0';
      pg.font = '10px Consolas';
      pg.textAlign = 'right';
      pg.fillText(db + ' dB', L - 7, y + 3);
    }

    const drawLine = (plane, color, fill) => {
      let max = 0;
      const vals = [];
      for (let i = 0; i <= 360; i++) {
        const deg = -90 + i * 0.5;
        const v = this.cut(deg, plane, m);
        vals.push(v);
        max = Math.max(max, v);
      }
      // 曲线下淡填充（层次）
      pg.beginPath();
      vals.forEach((v, i) => {
        const db = this.clamp(20 * Math.log10(v / max), minDb, 0);
        const x = L + i * (R - L) / 360;
        const y = T + (-db / (-minDb)) * (B - T);
        i ? pg.lineTo(x, y) : pg.moveTo(x, y);
      });
      pg.strokeStyle = color;
      pg.lineWidth = 2;
      pg.stroke();
      pg.lineTo(R, B); pg.lineTo(L, B); pg.closePath();
      pg.fillStyle = fill;
      pg.fill();
    };

    drawLine('E', '#6c88e8', 'rgba(108,136,232,0.07)');
    drawLine('H', '#3ec9a7', 'rgba(62,201,167,0.06)');

    pg.fillStyle = '#9db1e8';
    pg.font = '10px sans-serif';
    pg.textAlign = 'left';
    pg.fillText('E 面', L + 8, T + 12);
    pg.fillStyle = '#6fdcbf';
    pg.fillText('H 面', L + 52, T + 12);
  },
});

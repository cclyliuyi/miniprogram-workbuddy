// pages/interactive/3d-lab/planar-array/planar-array.js —— 平面相控阵 3D（r108）· 暖纸舞台
// 物理模型（Balanis《Antenna Theory》4th，Ch.6 · 平面阵）：
//   2D 阵因子（可分离乘积）：AF(θ,φ) = AFx(θ,φ) · AFy(θ,φ)
//     AFx = |Σ wx[m]·exp(j·kd·sinθ·cosφ·(m−(N−1)/2))| / Σwx
//   波束指向：(θ₀,φ₀) → u₀=sinθ₀cosφ₀, w₀=sinθ₀sinφ₀
//   渐进相移：βx = −kd·u₀, βy = −kd·w₀
//   方向性（近似）：D ≈ π·N²·cosθ₀·ηtaper（ηtaper = (Σw)²/(N·Σw²)）
//   HPBW（近似）：0.886·λ/(N·d·cosθ₀·√ηtaper)
//   单元相位可视化：ψ_mn = −kd·(u₀·(m−c) + w₀·(n−c))，mod 2π 映射 HSL 色环
const { registerOrbitControls } = require('../orbit-controls');
const haptic = require('../../../../utils/haptic');
const stage = require('../lab3d-stage');
const lc = require('../../../../utils/lab-canvas');
const { THEME, alpha } = require('../../../../utils/lab-theme');

// ── 几何常量（移植自 HTML 源码，适配小程序单位）──
const D = 0.5;          // 单元间距 (λ)
const LAMBDA = 0.2;     // 1.5 GHz → 0.2 m（仅用于物理尺寸标注）
const PITCH = D * LAMBDA;
const TOP = 0.34;       // 阵面离地高度（安装柱顶端）
const R = 1.15;         // 波瓣最大半径
const kd = 2 * Math.PI * D;

// 波瓣曲面网格分辨率（移植 HTML 原值；性能已验证可承受）
const NT = 60;          // theta 采样（移植自 76，手机适度降到 60）
const NP = 120;         // phi 采样（移植自 150，手机适度降到 120）
const VCNT = (NT + 1) * (NP + 1);

// 波瓣曲面顶点色 LUT：主题暖色渐变（浅→深 = 弱→强）
const RAMP = (() => {
  const stops = [
    [0xf3efe6], [0xe8d9c0], [0xd4a96a], [0xb85c38], [0x8a3a1f], [0x5a1f0f],
  ].map(([hx]) => [(hx >> 16 & 255) / 255, (hx >> 8 & 255) / 255, (hx & 255) / 255]);
  const n = 48, lut = [];
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1) * (stops.length - 1);
    const k = Math.floor(x), f = x - k;
    const a = stops[k], b = stops[Math.min(k + 1, stops.length - 1)];
    lut.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]);
  }
  return lut;
})();

// 幅度加权（移植自 HTML 源码 setTaper）
function buildWeights(kind, n) {
  const w = new Array(n);
  for (let m = 0; m < n; m++) {
    const x = n > 1 ? m / (n - 1) : 0.5;
    w[m] = kind === 'cosine' ? Math.sin(Math.PI * (x * (n - 1) + 0.5) / n)
      : kind === 'hamming' ? 0.54 - 0.46 * Math.cos(2 * Math.PI * x)
      : 1;
  }
  return w;
}

// 阵因子（相位递推，移植自 HTML 源码 afAxis —— 无逐单元三角函数）
function afAxis(dpsi, weights, sumW, n) {
  let a = Math.cos(-(n - 1) / 2 * dpsi), b = Math.sin(-(n - 1) / 2 * dpsi);
  const c = Math.cos(dpsi), s = Math.sin(dpsi);
  let re = 0, im = 0;
  for (let m = 0; m < n; m++) {
    re += weights[m] * a; im += weights[m] * b;
    const na = a * c - b * s; b = a * s + b * c; a = na;
  }
  return Math.hypot(re, im) / sumW;
}

Page({
  data: {
    S: { sizeIdx: 1, theta: 0, phi: 0, taperIdx: 0 },
    sizeOpts: ['4 × 4', '8 × 8', '16 × 16'],
    taperOpts: ['均匀', '余弦', '低旁瓣'],
    taperKeys: ['uniform', 'cosine', 'hamming'],
    stats: null,
    scanOn: false,
    showSide: true,
    showHint: true,
    glReady: false,
  },

  THREE: null,
  canvasNode: null,
  renderer: null,
  scene: null,
  camera: null,
  controls: null,
  root: null,          // 整个阵列+波瓣的根 Group
  arrayGroup: null,    // 阵面（背板+基板+贴片）
  supportGroup: null,  // 安装柱+底座
  patches: [],         // ��片 Mesh 数组（用于相位着色更新）
  beamMesh: null,
  beamPosArr: null,
  beamColArr: null,
  beamGeo: null,
  axisMesh: null,
  animId: null,
  scanPhase: 0,
  // 运行态（不进 setData）
  state: { N: 8, theta: 0, phi: 0, taper: 'uniform' },
  weights: null,
  sumW: 1,
  plotCtx: null,
  plotW: 0,
  plotH: 0,
  _stats: null,

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
  //  3D 初始化（暖纸舞台：scene.background = 0xf3efe6）
  // ═══════════════════════════════════════════════════════════════

  initThree() {
    stage.initThree(this, '#three-canvas', {
      fov: 38, cameraPos: [1.7, 1.6, 1.9],
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
        controls.autoRotateSpeed = 0.8;
        controls.target.set(0, 0.3, 0);
        controls.update();
        this.controls = controls;
        this._home = stage.saveHome(controls);

        // 坐标轴：x/z 暖灰，y 用赭金（阵面法向）
        const C = stage.THEME3D;
        const O = new THREE.Vector3(0, 0, 0);
        const axes = new THREE.Group();
        axes.add(new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), O, 0.8, C.warmGray, 0.08, 0.04));
        axes.add(new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), O, 1.1, C.gold, 0.1, 0.05));
        axes.add(new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), O, 0.8, C.warmGray, 0.08, 0.04));
        this.scene.add(axes);

        // 场景图扁平化（参考 phased-array/horn 能工作的结构：Group 直接 add 到 scene，
        // 不做多层嵌套——r108 小程序版多层 Group 嵌套曾导致矩阵更新异常）
        this.arrayGroup = new THREE.Group();
        this.arrayGroup.position.y = TOP;
        this.supportGroup = new THREE.Group();
        this.scene.add(this.arrayGroup, this.supportGroup);

        // 共享材质（减少 draw call）
        this.matFrame = new THREE.MeshPhongMaterial({ color: 0x9aa6b2, shininess: 40 });
        this.matSub = new THREE.MeshPhongMaterial({ color: 0x4a5a52, shininess: 15 });
        this.matMast = new THREE.MeshPhongMaterial({ color: 0x6a7480, shininess: 30 });
        this.matPatch = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 30 });
        this.matBeam = new THREE.MeshPhongMaterial({
          vertexColors: true, transparent: true, opacity: 0.55,
          side: THREE.DoubleSide, shininess: 5, depthWrite: false,
        });
        this.matAxis = new THREE.MeshBasicMaterial({ color: C.gold });

        // 波瓣曲面预分配（动画中只写 attribute，不重建对象）
        this.beamPosArr = new Float32Array(VCNT * 3);
        this.beamColArr = new Float32Array(VCNT * 3);
        const idxArr = [];
        for (let i = 0; i < NT; i++) for (let j = 0; j < NP; j++) {
          const a = i * (NP + 1) + j, b = a + NP + 1;
          idxArr.push(a, b, a + 1, a + 1, b, b + 1);
        }
        const beamGeo = new THREE.BufferGeometry();
        beamGeo.addAttribute('position', new THREE.BufferAttribute(this.beamPosArr, 3));
        beamGeo.addAttribute('color', new THREE.BufferAttribute(this.beamColArr, 3));
        beamGeo.setIndex(idxArr);
        this.beamGeo = beamGeo;
        this.beamMesh = new THREE.Mesh(beamGeo, this.matBeam);
        this.beamMesh.position.y = TOP;
        this.beamMesh.renderOrder = 2;
        this.scene.add(this.beamMesh);

        // 波束指向轴
        this.axisMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.006, 0.006, 1, 12), this.matAxis
        );
        this.scene.add(this.axisMesh);

        // 首次构建（包 try-catch，任何异常都不能阻塞渲染循环启动）
        try {
          console.log('[planar-array] building face N=' + this.state.N);
          this.rebuildFace(this.state.N);
          console.log('[planar-array] setting taper');
          this.setTaper('uniform');
          console.log('[planar-array] update()');
          this.update();
          console.log('[planar-array] scene ready, meshes=', this.scene.children.length);
        } catch (err) {
          console.error('[planar-array] init scene error:', err);
        }
        this.startAnim();
        stage.ready(this);
        console.log('[planar-array] anim started, glReady=true');
      },
    });
  },

  // ═══════════════════════════════════════════════════════════════
  //  阵面几何构建（移植自 HTML 源码 buildFace，适度简化）
  // ═══════════════════════════════════════════════════════════════

  rebuildFace(n) {
    const THREE = this.THREE;
    if (!THREE) return;
    stage.clearGroup(this.arrayGroup);
    stage.clearGroup(this.supportGroup);
    this.patches = [];

    const ap = n * PITCH;
    const plate = ap + 0.12;
    const frame = plate + 0.04;

    // 背板（金属框）
    const back = new THREE.Mesh(new THREE.BoxGeometry(plate, 0.05, plate), this.matFrame);
    back.position.y = -0.026;
    this.arrayGroup.add(back);

    // 基板（介质层）
    const sub = new THREE.Mesh(new THREE.BoxGeometry(ap + 0.06, 0.01, ap + 0.06), this.matSub);
    sub.position.y = 0.004;
    this.arrayGroup.add(sub);

    // 4 根边框 rail
    for (let i = 0; i < 4; i++) {
      const long = i % 2 === 0, e = plate / 2;
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(long ? frame : 0.04, 0.07, long ? 0.04 : frame),
        this.matFrame
      );
      rail.position.set(long ? 0 : (i === 1 ? e : -e), -0.01, long ? (i === 0 ? e : -e) : 0);
      this.arrayGroup.add(rail);
    }

    // 4 根安装柱（standoff）
    for (let sx = -1; sx <= 1; sx += 2) for (let sz = -1; sz <= 1; sz += 2) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.022, 0.1, 16), this.matFrame
      );
      post.position.set(sx * (plate / 2 - 0.05), 0.03, sz * (plate / 2 - 0.05));
      this.arrayGroup.add(post);
    }

    // N×N 贴片阵列（每个贴片独立 geometry 以支持 vertexColors 相位着色）
    const pw = PITCH * 0.62;
    for (let m = 0; m < n; m++) for (let q = 0; q < n; q++) {
      const g = new THREE.BoxGeometry(pw, 0.007, pw);
      g.addAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3));
      const p = new THREE.Mesh(g, this.matPatch);
      p.position.set((m - (n - 1) / 2) * PITCH, 0.0125, (q - (n - 1) / 2) * PITCH);
      p.userData = { m, q };
      this.arrayGroup.add(p);
      this.patches.push(p);
    }

    // 安装柱（mast）+ 底座
    const mr = Math.max(0.055, plate * 0.07);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(mr, mr * 1.35, TOP, 24), this.matMast
    );
    mast.position.y = TOP / 2;
    this.supportGroup.add(mast);
    const br = Math.max(0.3, plate * 0.3);
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(br, br * 1.1, 0.04, 36), this.matMast
    );
    base.position.y = 0.02;
    this.supportGroup.add(base);
  },

  // ═══════════════════════════════════════════════════════════════
  //  幅度加权（移植自 HTML 源码 setTaper）
  // ═══════════════════════════════════════════════════════════════

  setTaper(kind) {
    this.state.taper = kind;
    this.weights = buildWeights(kind, this.state.N);
    this.sumW = this.weights.reduce((a, b) => a + b, 0);
  },

  // ═══════════════════════════════════════════════════════════════
  //  核心更新（移植自 HTML 源码 update）
  // ═══════════════════════════════════════════════════════════════

  update() {
    const THREE = this.THREE;
    if (!THREE || !this.beamGeo) return;

    const N = this.state.N;
    const w = this.weights, sw = this.sumW;
    const t0 = this.state.theta * Math.PI / 180;
    const p0 = this.state.phi * Math.PI / 180;
    const u0 = Math.sin(t0) * Math.cos(p0);
    const w0 = Math.sin(t0) * Math.sin(p0);
    const showSide = this.data.showSide;

    // ── 波瓣曲面 ──
    let sll = 0;
    for (let i = 0; i <= NT; i++) {
      const th = (i / NT) * Math.PI / 2;
      const st = Math.sin(th), ct = Math.cos(th);
      for (let j = 0; j <= NP; j++) {
        const ph = (j / NP) * Math.PI * 2;
        const u = st * Math.cos(ph), v = st * Math.sin(ph);
        let mag = afAxis(kd * (u - u0), w, sw, N) * afAxis(kd * (v - w0), w, sw, N)
          * Math.pow(Math.max(ct, 0), 0.6);
        // SLL 采样：偏离主瓣 0.35 rad 以上
        const ang = Math.acos(Math.max(-1, Math.min(1, u * u0 + v * w0 + ct * Math.cos(t0))));
        if (ang > 0.35 && mag > sll) sll = mag;
        if (!showSide) mag = mag > 0.25 ? mag : 0;
        const r = 0.02 + R * mag;
        const o = (i * (NP + 1) + j) * 3;
        this.beamPosArr[o] = r * u;
        this.beamPosArr[o + 1] = r * ct;
        this.beamPosArr[o + 2] = r * v;
        const c = RAMP[Math.min(RAMP.length - 1, Math.round(Math.pow(Math.min(1, mag), 0.75) * (RAMP.length - 1)))];
        this.beamColArr[o] = c[0];
        this.beamColArr[o + 1] = c[1];
        this.beamColArr[o + 2] = c[2];
      }
    }
    this.beamGeo.attributes.position.needsUpdate = true;
    this.beamGeo.attributes.color.needsUpdate = true;
    this.beamGeo.computeVertexNormals();

    // ── 贴片相位着色（HSL 色环）──
    const c = N > 1 ? (N - 1) / 2 : 0;
    const maxW = Math.max.apply(null, w);
    const colObj = new THREE.Color();
    for (const p of this.patches) {
      const m = p.userData.m, q = p.userData.q;
      let ps = -kd * ((m - c) * u0 + (q - c) * w0);
      ps = ((ps % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      const amp = 0.30 + 0.42 * (w[m] * w[q]) / (maxW * maxW);
      // r108 Color 有 setHSL
      colObj.setHSL(0.55 - 0.55 * (ps / (2 * Math.PI)), 0.72, amp);
      const arr = p.geometry.attributes.color.array;
      for (let k = 0; k < arr.length; k += 3) {
        arr[k] = colObj.r; arr[k + 1] = colObj.g; arr[k + 2] = colObj.b;
      }
      p.geometry.attributes.color.needsUpdate = true;
    }

    // ── 波束指向轴（防 setFromUnitVectors 零角度 NaN：dir 与 (0,1,0) 共线时跳过旋转）──
    const dir = new THREE.Vector3(u0, Math.cos(t0), w0);
    this.axisMesh.position.set(0, TOP, 0).addScaledVector(dir, 0.5);
    const fromAxis = new THREE.Vector3(0, 1, 0);
    if (fromAxis.dot(dir) < 0.9999) {
      this.axisMesh.quaternion.setFromUnitVectors(fromAxis, dir);
    } else {
      this.axisMesh.quaternion.set(0, 0, 0, 1);  // identity
    }
    this.axisMesh.scale.y = 1.4;

    // ── 读数统计 ──
    const ct0 = Math.max(Math.cos(t0), 0.05);
    const taperEta = (sw * sw) / (N * w.reduce((a, b) => a + b * b, 0));
    const hpbw = 0.886 * 57.2958 / (N * D * ct0 * Math.sqrt(taperEta));
    const gainDb = 10 * Math.log10(N * N * ct0 * taperEta);
    const sllDb = -Math.abs(20 * Math.log10(Math.max(sll, 1e-4)));
    const st = {
      theta: this.state.theta, phi: this.state.phi,
      hpbw: hpbw.toFixed(1), gain: gainDb.toFixed(1), sll: sllDb.toFixed(1),
      eta: (taperEta * 100).toFixed(0), u0, w0, t0,
    };
    this._stats = st;
    this.refreshStats(st);
    this.drawPlot(st);
  },

  refreshStats(st) {
    st = st || this._stats;
    if (!st) return;
    this.setData({
      stats: {
        dir: st.theta.toFixed(0) + '° / ' + st.phi.toFixed(0) + '°',
        hpbw: st.hpbw,
        gain: st.gain,
        sll: st.sll,
        eta: st.eta,
      },
    });
  },

  // ═══════════════════════════════════════════════════════════════
  //  动画循环（自动扫描：φ 方位旋转）
  // ═══════════════════════════════════════════════════════════════

  startAnim() {
    if (this.animId || !this.canvasNode) return;
    const tick = () => {
      this.animId = this.canvasNode.requestAnimationFrame(tick);

      try {
        if (this.data.scanOn) {
          this.state.phi = (this.state.phi + 0.8) % 360;
          if (this.state.theta < 38) this.state.theta = Math.min(38, this.state.theta + 0.4);
          const now = Date.now();
          if (now - (this._scanSync || 0) > 90) {
            this._scanSync = now;
            this.update();
            this.setData({ 'S.theta': Math.round(this.state.theta), 'S.phi': Math.round(this.state.phi) });
          } else {
            this._updateGeometryOnly();
          }
        }
      } catch (err) {
        console.error('[planar-array] tick update error:', err);
      }

      try {
        if (this.controls) this.controls.update();
      } catch (e) { /* controls 初始化前的帧 */ }
      try {
        this.renderer.render(this.scene, this.camera);
      } catch (e) {
        console.error('[planar-array] render error:', e);
      }
    };
    tick();
  },

  // 扫描时高频几何更新（不刷 UI）
  _updateGeometryOnly() {
    const N = this.state.N;
    const w = this.weights, sw = this.sumW;
    const t0 = this.state.theta * Math.PI / 180;
    const p0 = this.state.phi * Math.PI / 180;
    const u0 = Math.sin(t0) * Math.cos(p0);
    const w0 = Math.sin(t0) * Math.sin(p0);

    for (let i = 0; i <= NT; i++) {
      const th = (i / NT) * Math.PI / 2;
      const st = Math.sin(th), ct = Math.cos(th);
      for (let j = 0; j <= NP; j++) {
        const ph = (j / NP) * Math.PI * 2;
        const u = st * Math.cos(ph), v = st * Math.sin(ph);
        const mag = afAxis(kd * (u - u0), w, sw, N) * afAxis(kd * (v - w0), w, sw, N)
          * Math.pow(Math.max(ct, 0), 0.6);
        const r = 0.02 + R * (this.data.showSide ? mag : (mag > 0.25 ? mag : 0));
        const o = (i * (NP + 1) + j) * 3;
        this.beamPosArr[o] = r * u;
        this.beamPosArr[o + 1] = r * ct;
        this.beamPosArr[o + 2] = r * v;
      }
    }
    this.beamGeo.attributes.position.needsUpdate = true;
    this.beamGeo.computeVertexNormals();
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
  //  参数控件
  // ═══════════════════════════════════════════════════════════════

  onSizeTap(e) {
    const idx = +e.currentTarget.dataset.idx;
    const sizes = [4, 8, 16];
    const n = sizes[idx];
    haptic.light();
    this.state.N = n;
    this.setTaper(this.state.taper);
    this.rebuildFace(n);
    this.update();
    this.setData({ 'S.sizeIdx': idx });
  },

  onTaperTap(e) {
    const idx = +e.currentTarget.dataset.idx;
    const keys = ['uniform', 'cosine', 'hamming'];
    haptic.light();
    this.setTaper(keys[idx]);
    this.update();
    this.setData({ 'S.taperIdx': idx });
  },

  onTheta(e) {
    this.state.theta = e.detail.value;
    this.setData({ 'S.theta': e.detail.value, scanOn: false });
    this.update();
  },
  onThetaChanging(e) {
    this.state.theta = e.detail.value;
    this.setData({ 'S.theta': e.detail.value, scanOn: false });
    stage.throttle(this, 55, function () { this.update(); });
  },

  onPhi(e) {
    this.state.phi = e.detail.value;
    this.setData({ 'S.phi': e.detail.value, scanOn: false });
    this.update();
  },
  onPhiChanging(e) {
    this.state.phi = e.detail.value;
    this.setData({ 'S.phi': e.detail.value, scanOn: false });
    stage.throttle(this, 55, function () { this.update(); });
  },

  // 9 宫格预设（移植自 HTML arrows pad）
  onPad(e) {
    const { dx, dz } = e.currentTarget.dataset;
    haptic.light();
    this.setData({ scanOn: false });
    if (dx === '0' && dz === '0') {
      this.state.theta = 0; this.state.phi = 0;
    } else {
      const dxi = +dx, dzi = +dz;
      this.state.theta = (dxi !== 0 && dzi !== 0) ? 42 : 34;
      this.state.phi = ((Math.atan2(dzi, dxi) * 180 / Math.PI) + 360) % 360;
    }
    this.setData({ 'S.theta': Math.round(this.state.theta), 'S.phi': Math.round(this.state.phi) });
    this.update();
  },

  toggleScan() {
    haptic.light();
    const scanOn = !this.data.scanOn;
    this.setData({ scanOn });
    if (scanOn) {
      this.state.theta = Math.max(38, this.state.theta);
      this.scanPhase = 0;
    }
  },

  toggleSide() {
    haptic.light();
    this.setData({ showSide: !this.data.showSide });
    this.update();
  },

  // ═══════════════════════════════════════════════════════════════
  //  2D 子图：方位切面 dB 极坐标（φ=φ₀ 平面）
  // ═══════════════════════════════════════════════════════════════

  drawPlot(st) {
    const ctx = this.plotCtx;
    if (!ctx || !st) return;
    const W = this.plotW, H = this.plotH;
    lc.clear(ctx, W, H);
    const cx = W / 2, cy = H / 2 + 6;
    const Rad = Math.min(W / 2 - 44, H / 2 - 24);
    const FLOOR = -30;

    lc.polarGrid(ctx, cx, cy, Rad, { rings: [0, -10, -20, -30], full: true });

    // 沿 φ₀ 切面：θ∈[0,90]，u=sinθ cosφ₀
    const N = this.state.N, w = this.weights, sw = this.sumW;
    const p0 = st.phi * Math.PI / 180;
    const cosPhi = Math.cos(p0), sinPhi = Math.sin(p0);
    const NS = 180;
    const toXY = (theta, sgn) => {
      const th = theta * Math.PI / 180;
      const u = Math.sin(th) * cosPhi, v = Math.sin(th) * sinPhi;
      const mag = afAxis(kd * (u - st.u0), w, sw, N) * afAxis(kd * (v - st.w0), w, sw, N);
      const db = Math.max(FLOOR, 20 * Math.log10(Math.max(mag, 1e-4)));
      const r = Rad * (1 - db / FLOOR);
      // 极坐标：θ=0 朝上（+y），θ=90 朝外
      return [cx + sgn * r * Math.sin(th), cy - r * Math.cos(th)];
    };

    ctx.beginPath();
    for (let i = 0; i <= NS; i++) {
      const xy = toXY(i / NS * 90, 1);
      i === 0 ? ctx.moveTo(xy[0], xy[1]) : ctx.lineTo(xy[0], xy[1]);
    }
    for (let i = NS; i >= 0; i--) {
      const xy = toXY(i / NS * 90, -1);
      ctx.lineTo(xy[0], xy[1]);
    }
    ctx.closePath();
    ctx.fillStyle = alpha(THEME.accent, 0.10);
    ctx.fill();
    ctx.strokeStyle = THEME.accent;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // 主瓣方向标记
    const th0rad = st.theta * Math.PI / 180;
    const tip = [
      cx + Rad * 0.85 * Math.sin(th0rad) * Math.cos(p0),
      cy - Rad * 0.85 * Math.cos(th0rad),
    ];
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = THEME.teal;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(tip[0], tip[1]);
    ctx.stroke();
    ctx.restore();
    lc.dot(ctx, tip[0], tip[1], THEME.teal, 3.5);
    lc.label(ctx, 'θ=' + Math.round(st.theta) + '° φ=' + Math.round(st.phi) + '°',
      tip[0] + 6, tip[1] - 6, { color: THEME.teal });

    lc.label(ctx, '0°（阵面法向）', cx, cy - Rad - 10, { align: 'center', color: THEME.muted, font: THEME.fontTick });
    lc.label(ctx, '90°', cx - Rad - 6, cy, { align: 'right', color: THEME.muted, font: THEME.fontTick });
    lc.label(ctx, '径向: dB', cx - Rad + 4, cy - Rad - 4, { align: 'left', color: THEME.muted, font: THEME.fontTick });

    lc.legend(ctx, [
      { name: 'φ₀ 切面方向图', color: THEME.accent },
      { name: '波束指向', color: THEME.teal },
    ], 10, H - 10);
  },

  onShareAppMessage() {
    return { title: '平面相控阵 3D · 波束扫描', path: '/pages/interactive/3d-lab/planar-array/planar-array' };
  },
});

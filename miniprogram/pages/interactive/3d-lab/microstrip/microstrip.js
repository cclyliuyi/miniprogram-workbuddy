// pages/interactive/3d-lab/microstrip/microstrip.js —— 微带贴片天线 3D · 暖纸舞台
// 物理模型（Balanis《Antenna Theory》4th §14.2；尺寸设计取 rf-math.patchDesign）：
//   W = c/(2f₀)·√(2/(εr+1))（14-6）；εeff（14-1，W/h>1）；ΔL Hammerstad（14-2）
//   缝隙自导 G1 = I1/(120π²)（14-12）+ 互导 G12（14-18a，含 J0）→ Redge = 1/(2(G1+G12))
//   内凹馈电 Rin = Redge·cos²(π·y0/L)（14-20a）
//   相对带宽（VSWR≤2）FBW ≈ 3.77·(εr−1)/εr²·(W/L)·(h/λ0)；Q = (s−1)/(FBW√s)|s=2 = 1/(√2·FBW)
//   输入阻抗（TM10 并联谐振）Z = Rin/(1+jx)，x = 2Q(f/f0−1)
const { registerOrbitControls } = require('../orbit-controls');
const stage = require('../lab3d-stage');
const lc = require('../../../../utils/lab-canvas');
const { THEME, alpha } = require('../../../../utils/lab-theme');
const rf = require('../../../../utils/rf-math');
const haptic = require('../../../../utils/haptic');

// 常用基板预设（εr / 厚度 mm）
const PRESETS = {
  fr4: { er: 4.4, h: 1.6 },
  r4350: { er: 3.66, h: 0.762 },
  ptfe: { er: 2.2, h: 1.575 },
};

// Bessel J0（Numerical Recipes 有理近似，|误差|<1e-7；rf-math 仅含 J1）
function besselJ0(x) {
  const ax = Math.abs(x);
  if (ax < 8) {
    const y = x * x;
    const p1 = 57568490574.0 + y * (-13362590354.0 + y * (651619640.7 +
      y * (-11214424.18 + y * (77392.33017 + y * (-184.9052456)))));
    const p2 = 57568490411.0 + y * (1029532985.0 + y * (9494680.718 +
      y * (59272.64853 + y * (267.8532712 + y))));
    return p1 / p2;
  }
  const z = 8 / ax, y = z * z, xx = ax - 0.785398164;
  const p1 = 1.0 + y * (-0.1098628627e-2 + y * (0.2734510407e-4 +
    y * (-0.2073370639e-5 + y * 0.2093887211e-6)));
  const p2 = -0.1562499995e-1 + y * (0.1430488765e-3 + y * (-0.6911147651e-5 +
    y * (0.7621095161e-6 + y * (-0.934935152e-7))));
  return Math.sqrt(0.636619772 / ax) * (Math.cos(xx) * p1 - z * Math.sin(xx) * p2);
}

// 辐射缝隙自导 G1（Balanis 14-12）与互导 G12（14-18a），Simpson 数值积分
// I = ∫0^π [sin(k0W/2·cosθ)/cosθ]²·{1 或 J0(k0L·sinθ)}·sin³θ dθ；G = I/(120π²)
function slotConductance(k0W, k0L) {
  const N = 96;
  let s1 = 0, s12 = 0;
  for (let i = 0; i <= N; i++) {
    const th = Math.PI * i / N;
    const c = Math.cos(th), s = Math.sin(th);
    const u = Math.abs(c) < 1e-7 ? k0W / 2 : Math.sin(k0W / 2 * c) / c;
    const base = u * u * s * s * s;
    const wgt = (i === 0 || i === N) ? 1 : (i % 2 ? 4 : 2);
    s1 += wgt * base;
    s12 += wgt * base * besselJ0(k0L * s);
  }
  const k = (Math.PI / N / 3) / (120 * Math.PI * Math.PI);
  return { g1: s1 * k, g12: s12 * k };
}

Page({
  data: {
    fSlider: 245, fVal: '2.45 GHz',
    erSlider: 44, erVal: '4.40',
    hSlider: 160, hVal: '1.60 mm',
    insetSlider: 34, insetVal: '0.34',
    preset: 'fr4',
    W: '-', L: '-', ee: '-', redge: '-', rin: '-', insetSug: '-', smin: '-', bw: '-',
    warn: '',
    showHint: true,
    glReady: false,
  },

  THREE: null, canvasNode: null, renderer: null, scene: null,
  camera: null, controls: null, root: null,
  fieldGroup: null, currentGroup: null, dimGroup: null,
  fieldMat: null, currentMats: [],
  animId: null,
  state: { f: 2.45, er: 4.4, h: 1.6, inset: 0.34, ph: 0 },
  plotCtx: null, plotW: 0, plotH: 0,
  lastKey: '',
  substrate: null, ground: null, patch: null, feed: null, slotL: null, slotR: null,

  onReady() {
    this.initThree();
    stage.init2D(this, '#s11', (ctx, w, h) => {
      this.plotCtx = ctx; this.plotW = w; this.plotH = h;
      this.renderAll();
    });
  },
  onUnload() { this.dispose(); },
  onHide() { this.stopAnim(); stage.clearTimers(this); },
  onShow() { if (this.canvasNode && this.renderer) { this.startAnim(); stage.scheduleIdle(this); } },

  clamp(v, a, b) { return Math.max(a, Math.min(b, v)); },

  // ═══ 3D 初始化（暖纸舞台：纸色背景 + 暖白三灯）═══
  initThree() {
    if (typeof this.createSelectorQuery !== 'function') return; // 非小程序环境（冒烟测试）
    stage.initThree(this, '#three-canvas', {
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
        controls.dampingFactor = 0.08;
        controls.autoRotateSpeed = 1.0;
        controls.target.set(0, 0.08, 0);
        this.controls = controls;

        const root = new THREE.Group();
        this.scene.add(root);
        this.root = root;
        this.fieldGroup = new THREE.Group();
        this.currentGroup = new THREE.Group();
        this.dimGroup = new THREE.Group();
        root.add(this.fieldGroup, this.currentGroup, this.dimGroup);

        // 持久化 mesh（BoxGeometry 复用，参数变化只 setBox，不重建材质）
        const C = stage.THEME3D;
        const matSub = new THREE.MeshPhysicalMaterial({
          color: C.teal, transparent: true, opacity: 0.42,
          roughness: 0.6, metalness: 0, side: THREE.DoubleSide,
        });
        const matGround = new THREE.MeshStandardMaterial({
          color: C.warmGray, metalness: 0.4, roughness: 0.4,
        });
        const matCopper = new THREE.MeshStandardMaterial({
          color: C.accent, metalness: 0.5, roughness: 0.35,
        });
        const matCut = new THREE.MeshStandardMaterial({ color: C.teal, roughness: 0.7 });

        this.substrate = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), matSub);
        this.ground = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), matGround);
        this.patch = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), matCopper);
        this.feed = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), matCopper);
        this.slotL = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), matCut);
        this.slotR = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), matCut);
        root.add(this.substrate, this.ground, this.patch, this.feed, this.slotL, this.slotR);

        this.renderAll();
        this.startAnim();
        stage.ready(this);
      },
    });
  },

  setBox(mesh, w, h, d, x, y, z) {
    const THREE = this.THREE;
    if (!THREE || !mesh || !mesh.geometry) return;
    mesh.geometry.dispose();
    mesh.geometry = new THREE.BoxGeometry(Math.max(w, 0.001), Math.max(h, 0.001), Math.max(d, 0.001));
    mesh.position.set(x, y, z);
  },

  // ═══ 物理（一阶设计，公式见文件头注释）═══
  design() {
    const S = this.state;
    const f = S.f * 1e9, h = S.h / 1000, er = S.er;
    const pd = rf.patchDesign(f, er, h);            // W、L、εeff、ΔL（Balanis 14-1/2/6）
    const lam = rf.wavelength(f);
    const k0 = 2 * Math.PI / lam;
    const { g1, g12 } = slotConductance(k0 * pd.W, k0 * pd.L);
    const redge = 1 / (2 * (g1 + g12));             // 两缝同相：Rin(edge) = 1/(2(G1+G12))
    const rin = redge * Math.pow(Math.cos(Math.PI * S.inset), 2);  // 14-20a
    const fbw = 3.77 * (er - 1) / (er * er) * (pd.W / pd.L) * (h / lam); // VSWR≤2
    const q = 1 / (Math.SQRT2 * fbw);               // Q = (s−1)/(FBW√s)，s=2
    const insetSug = redge > 50 ? Math.acos(Math.sqrt(50 / redge)) / Math.PI : 0;
    return {
      W: pd.W, L: pd.L, ee: pd.epsEff, redge, rin, fbw, q, insetSug,
      f0: S.f, hmm: S.h, er, Wmm: pd.W * 1000, Lmm: pd.L * 1000, wOverH: pd.W / h,
    };
  },

  // 并联 RLC 单谐振：Z = Rin/(1+jx) → Γ = (Z−50)/(Z+50)
  gammaAt(freq, d) {
    const x = 2 * d.q * (freq / d.f0 - 1);
    const den = 1 + x * x;
    const z = rf.cx(d.rin / den, -d.rin * x / den);
    return rf.cAbs(rf.gammaFromZ(z, 50));
  },

  sweep(d) {
    const span = this.clamp(4 * d.fbw, 0.04, 0.25); // 扫频窗 ≈ ±4×FBW（仅显示范围）
    const pts = [];
    let min = 1, minF = d.f0, bwLow = null, bwHigh = null;
    for (let i = 0; i <= 240; i++) {
      const f = d.f0 * (1 - span + 2 * span * i / 240);
      const g = this.gammaAt(f, d);
      const db = 20 * Math.log10(Math.max(g, 1e-8));
      pts.push({ f, g, db });
      if (g < min) { min = g; minF = f; }
      if (db <= -10) { if (bwLow === null) bwLow = f; bwHigh = f; }
    }
    return { pts, min, minF, bwLow, bwHigh };
  },

  // ═══ 3D 布局（材质色一律取 stage.THEME3D）═══
  layout3d(d) {
    const THREE = this.THREE;
    if (!THREE) return;
    const C = stage.THEME3D;
    const S = this.state;
    stage.clearGroup(this.fieldGroup);
    stage.clearGroup(this.currentGroup);
    stage.clearGroup(this.dimGroup);
    this.fieldMat = null;
    this.currentMats = [];

    const s = 0.035;
    const W = d.Wmm * s, L = d.Lmm * s;
    const h = this.clamp(d.hmm * 0.08, 0.045, 0.20);
    const boardW = W * 1.75, boardL = L * 2.18;
    const top = h / 2 + 0.012;

    this.setBox(this.substrate, boardW, h, boardL, 0, 0, 0);
    this.setBox(this.ground, boardW, 0.018, boardL, 0, -h / 2 - 0.014, 0);
    this.setBox(this.patch, W, 0.024, L, 0, top, 0);

    const feedW = this.clamp(W * 0.12, 0.07, 0.18);
    const insetZ = S.inset * L;
    const feedLen = boardL / 2 - (L / 2 - insetZ);
    this.setBox(this.feed, feedW, 0.026, feedLen, 0, top + 0.006, (boardL / 2 + L / 2 - insetZ) / 2);

    const slotLen = Math.max(insetZ, 0.002);
    const slotW = this.clamp(feedW * 0.42, 0.025, 0.06);
    const slotZ = L / 2 - slotLen / 2;
    const slotVisible = slotLen > 0.02;
    this.setBox(this.slotL, slotW, 0.028, slotLen, -feedW * 0.86, top + 0.018, slotZ);
    this.setBox(this.slotR, slotW, 0.028, slotLen, feedW * 0.86, top + 0.018, slotZ);
    this.slotL.visible = this.slotR.visible = slotVisible;

    // 边缘缝隙场弧线（靛蓝）：两条辐射缝的等效磁流同相（边射成因），同相闪烁
    this.fieldMat = new THREE.LineBasicMaterial({
      color: C.indigo, transparent: true, opacity: 0.5,
    });
    const edgeCount = 9;
    for (const side of [-1, 1]) {
      for (let k = 0; k < edgeCount; k++) {
        const x = -W * 0.42 + k * (W * 0.84) / (edgeCount - 1);
        const pts = [];
        for (let i = 0; i <= 24; i++) {
          const t = i / 24 * Math.PI;
          pts.push(new THREE.Vector3(
            x, top + 0.01 + Math.sin(t) * h * 1.65,
            side * (L / 2 + 0.02 + Math.sin(t) * 0.16)
          ));
        }
        this.fieldGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), this.fieldMat));
      }
    }

    // 表面电流（赭金）：TM10 电流沿谐振长度 L 呈 sin(πz'/L)、横向近似均匀
    // 网格段：行 = z 位置（幅度按行取 sin），列 = x 位置（幅度一致）
    const rows = 7, cols = 7;
    for (let rIdx = 0; rIdx < rows; rIdx++) {
      const zc = -L * 0.44 + rIdx * (L * 0.88) / (rows - 1);
      const amp = Math.sin(Math.PI * (zc + L / 2) / L);
      const mat = new THREE.LineBasicMaterial({
        color: C.gold, transparent: true, opacity: 0.15 + 0.6 * amp,
      });
      this.currentMats.push({ mat, amp });
      const seg = L * 0.055;
      for (let cIdx = 0; cIdx < cols; cIdx++) {
        const x = -W * 0.42 + cIdx * (W * 0.84) / (cols - 1);
        this.currentGroup.add(new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(x, top + 0.035, zc - seg),
            new THREE.Vector3(x, top + 0.035, zc + seg),
          ]), mat
        ));
      }
    }

    // 尺寸标注（暖灰线 + 端刻度 + 墨色 W/L 描字）
    const matDim = new THREE.LineBasicMaterial({ color: C.warmGray, transparent: true, opacity: 0.85 });
    const matInk = new THREE.LineBasicMaterial({ color: C.ink });
    const yD = top + 0.05;
    const addLine = (pts, mat) => {
      this.dimGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat || matDim));
    };
    const zW = -L / 2 - 0.17;
    addLine([new THREE.Vector3(-W / 2, yD, zW), new THREE.Vector3(W / 2, yD, zW)]);
    addLine([new THREE.Vector3(-W / 2, yD, zW - 0.05), new THREE.Vector3(-W / 2, yD, zW + 0.05)]);
    addLine([new THREE.Vector3(W / 2, yD, zW - 0.05), new THREE.Vector3(W / 2, yD, zW + 0.05)]);
    const xL = W / 2 + 0.17;
    addLine([new THREE.Vector3(xL, yD, -L / 2), new THREE.Vector3(xL, yD, L / 2)]);
    addLine([new THREE.Vector3(xL - 0.05, yD, -L / 2), new THREE.Vector3(xL + 0.05, yD, -L / 2)]);
    addLine([new THREE.Vector3(xL - 0.05, yD, L / 2), new THREE.Vector3(xL + 0.05, yD, L / 2)]);
    // 字母 W（平躺，(u,v)→(x, z)，v 正向远离贴片）
    const gs = 0.07;
    const glyph = (uv, ox, oz) => uv.map(([u, v]) => new THREE.Vector3(ox + u * gs, yD, oz - v * gs));
    addLine(glyph([[-1.4, 1], [-0.7, -1], [0, 0.4], [0.7, -1], [1.4, 1]], 0, zW - 0.14), matInk);
    // 字母 L
    addLine(glyph([[-0.6, 1], [-0.6, -1], [0.8, -1]], xL + 0.14, 0), matInk);

    // 相机只在首次定位；之后不打断用户视角
    const maxDim = Math.max(boardW, boardL);
    if (!this._camInit) {
      this.camera.position.set(maxDim * 0.86, maxDim * 0.64, maxDim * 1.02);
      this.camera.updateProjectionMatrix();
      this.controls.target.set(0, 0.03, 0);
      this.controls.update();
      this._home = stage.saveHome(this.controls);
      this._camInit = true;
    }
    this.controls.update();
  },

  // ═══ 动画：缝隙场同相呼吸 + 电流 sin(πz/L) 包络闪烁 ═══
  startAnim() {
    if (this.animId || !this.canvasNode) return;
    const tick = () => {
      this.animId = this.canvasNode.requestAnimationFrame(tick);
      this.state.ph += 0.035;
      const pulse = 0.5 + 0.5 * Math.sin(this.state.ph);
      if (this.fieldMat) this.fieldMat.opacity = 0.2 + 0.5 * pulse;
      for (const it of this.currentMats) it.mat.opacity = it.amp * (0.2 + 0.65 * pulse);
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

  // ═══ 参数事件（data-k 统一入口）═══
  _setParam(k, raw) {
    const S = this.state;
    if (k === 'f') { S.f = raw / 100; this.setData({ fVal: S.f.toFixed(2) + ' GHz' }); }
    else if (k === 'er') { S.er = raw / 10; this.setData({ erVal: S.er.toFixed(2), preset: '' }); }
    else if (k === 'h') { S.h = raw / 100; this.setData({ hVal: S.h.toFixed(2) + ' mm', preset: '' }); }
    else if (k === 'inset') { S.inset = raw / 100; this.setData({ insetVal: S.inset.toFixed(2) }); }
    else return false;
    return true;
  },
  onParam(e) {
    if (this._setParam(e.currentTarget.dataset.k, e.detail.value)) this.renderAll();
  },
  onParamChanging(e) {
    if (this._setParam(e.currentTarget.dataset.k, e.detail.value)) stage.throttle(this);
  },
  onPreset(e) {
    const key = e.currentTarget.dataset.p;
    const p = PRESETS[key];
    if (!p) return;
    haptic.light();
    this.state.er = p.er;
    this.state.h = p.h;
    this.setData({
      preset: key,
      erSlider: Math.round(p.er * 10), erVal: p.er.toFixed(2),
      hSlider: Math.round(p.h * 100 / 5) * 5, hVal: p.h.toFixed(2) + ' mm',
    });
    this.renderAll();
  },

  renderAll() {
    const d = this.design();
    const sw = this.sweep(d);
    this.setData({
      W: d.Wmm.toFixed(1) + ' mm',
      L: d.Lmm.toFixed(1) + ' mm',
      ee: d.ee.toFixed(2),
      redge: d.redge.toFixed(0) + ' Ω',
      rin: d.rin.toFixed(0) + ' Ω',
      insetSug: d.insetSug > 0 ? d.insetSug.toFixed(2) : '—',
      smin: (20 * Math.log10(sw.min)).toFixed(1) + ' dB',
      bw: sw.bwLow === null ? '未入 −10 dB' : ((sw.bwHigh - sw.bwLow) / d.f0 * 100).toFixed(1) + '%',
      warn: d.wOverH < 1
        ? 'W/h = ' + d.wOverH.toFixed(2) + ' < 1：εeff/ΔL 近似超出适用域（要求 W/h > 1），读数仅供定性参考'
        : '',
    });
    const key = [this.state.f.toFixed(2), this.state.er.toFixed(2), this.state.h.toFixed(2), this.state.inset.toFixed(2)].join('|');
    if (key !== this.lastKey) {
      this.layout3d(d);
      this.lastKey = key;
    }
    this.drawS11(d, sw);
  },

  // ═══ 2D：S11 扫频曲线（lab-canvas 纸底 + 完整轴标注）═══
  drawS11(d, sw) {
    if (!this.plotCtx || !d || !sw) return;
    const ctx = this.plotCtx, w = this.plotW, h = this.plotH;
    lc.clear(ctx, w, h);
    const box = { x: 48, y: 24, w: w - 64, h: h - 60 };
    const fMin = sw.pts[0].f, fMax = sw.pts[sw.pts.length - 1].f;
    const p = lc.plot(ctx, box, [fMin, fMax], [-35, 0]);
    if (sw.bwLow !== null) p.bandX(sw.bwLow, sw.bwHigh, THEME.okSoft);
    p.axes({
      yTicks: [-30, -20, -10, 0],
      xFmt: (v) => v.toFixed(2),
      xLabel: 'f（GHz）',
      yLabel: '|S11|（dB）',
    });
    p.guideY(-10, alpha(THEME.gold, 0.6));
    p.guideX(d.f0, alpha(THEME.teal, 0.7));
    const xs = sw.pts.map((pt) => pt.f);
    const ys = sw.pts.map((pt) => Math.max(-35, pt.db));
    p.line(xs, ys, THEME.accent, 2);
    const minDb = 20 * Math.log10(sw.min);
    p.dot(sw.minF, Math.max(-35, minDb), THEME.accent);
    lc.label(ctx, '−10 dB', box.x + box.w - 4, p.Y(-10) - 5,
      { align: 'right', color: THEME.gold, font: THEME.fontTick });
    lc.label(ctx, 'f₀', p.X(d.f0) + 4, box.y + 12, { color: THEME.teal, font: THEME.fontTick });
    lc.label(ctx, 'min ' + minDb.toFixed(1) + ' dB @ ' + sw.minF.toFixed(2) + ' GHz',
      box.x + 2, box.y - 8, { color: THEME.ink, font: THEME.fontLabel });
    lc.legend(ctx, [{ name: '|S11|（TM₁₀ 单谐振并联 RLC 模型）', color: THEME.accent }], box.x, h - 8)
  },

  onShareAppMessage() {
    return { title: '微带贴片天线 3D 实验室', path: '/pages/interactive/3d-lab/microstrip/microstrip' };
  },
});

// pages/interactive/miniaturization/miniaturization.js —— 电小天线与 Chu 极限
// 物理（全部取自 utils/rf-math，无魔法系数）：
//   Chu–McLean 下界：Qmin = 1/(ka)³ + 1/(ka)（无耗、单模、a = 最小外接球半径）
//   短偶极子：Rrad = 20π²(l/λ)² = 20(ka)²（三角电流、中心馈电、a = l/2）
//   单匝小环：Rrad = 320π⁴(A/λ²)² = 20π²(ka)⁴（均匀电流、a = 环半径 b）
//   效率：η = Rrad/(Rrad + Rloss)
//   含损 Q ≈ η·Qmin → FBW ≈ (s−1)/(Q√s)：损耗越大带宽越宽（用效率换带宽）

const haptic = require('../../../utils/haptic')
const rf = require('../../../utils/rf-math')
const lc = require('../../../utils/lab-canvas')
const { THEME, alpha } = require('../../../utils/lab-theme')

const KA_MIN = 0.06, KA_MAX = 0.8

function fmtOhm(r) {
  if (r >= 10) return r.toFixed(1) + ' Ω'
  if (r >= 0.1) return r.toFixed(2) + ' Ω'
  const m = r * 1000
  return (m >= 10 ? m.toFixed(1) : m.toFixed(2)) + ' mΩ'
}

Page({
  data: {
    S: { mode: 'dipole', ka: 0.18, rloss: 5 },
    stats: null,
  },

  onLoad() { this.update() },
  onReady() { this.update() },

  // ═══ 事件 ═══
  onKa(e) { this.setData({ 'S.ka': e.detail.value }, () => this.update()) },
  onLoss(e) { this.setData({ 'S.rloss': e.detail.value }, () => this.update()) },
  setMode(e) {
    const m = e.currentTarget.dataset.m
    if (m !== 'dipole' && m !== 'loop') return
    haptic.light()
    this.setData({ 'S.mode': m }, () => this.update())
  },

  // ═══ 物理 ═══
  rrad(ka, mode) {
    if (mode === 'loop') return rf.smallLoopRr(ka * ka / (4 * Math.PI), 1) // = 20π²(ka)⁴
    return rf.shortDipoleRr(ka / Math.PI)                                  // = 20(ka)²
  },
  etaOf(ka, mode, rloss) {
    const r = this.rrad(ka, mode)
    return r / (r + rloss)
  },
  values() {
    const S = this.data.S
    const qmin = rf.chuQmin(S.ka)
    const r = this.rrad(S.ka, S.mode)
    const eta = this.etaOf(S.ka, S.mode, S.rloss)
    const qLossy = Math.max(1, eta * qmin)               // 含损 Q ≈ η·Qmin
    const fbw = Math.min(1, rf.fbwFromQ(qLossy, 2))      // VSWR≤2 相对带宽（含损）
    const fbw0 = Math.min(1, rf.fbwFromQ(Math.max(1, qmin), 2)) // 无耗极限带宽
    return { qmin, r, eta, qLossy, fbw, fbw0 }
  },

  update() {
    const v = this.values()
    this.setData({
      stats: {
        qmin: v.qmin > 999 ? Math.round(v.qmin).toLocaleString() : v.qmin.toFixed(1),
        rrad: fmtOhm(v.r),
        eta: (v.eta * 100).toFixed(v.eta < 0.1 ? 2 : 1) + '%',
        bw: (v.fbw * 100).toFixed(2) + '%',
        bw0: (v.fbw0 * 100).toFixed(2) + '%',
      },
    })
    this.drawScene()
    this.drawCurve()
  },

  // ═══ 场景图：Chu 球与辐射球（几何按 ka 真实比例）═══
  drawScene() {
    lc.mount(this, '#sceneCanvas', (ctx, w, h) => {
      lc.clear(ctx, w, h)
      const v = this.values()
      const S = this.data.S
      const cx = w * 0.5, cy = h * 0.52
      const rLam = Math.min(w, h) * 0.42          // 辐射球 r = λ/2π（画幅基准）
      const rA = Math.max(5, rLam * S.ka)         // Chu 球半径 a：rA/rLam = ka（真实比例）

      // 辐射球边界 r = λ/2π（虚线）
      ctx.save()
      ctx.setLineDash([5, 4])
      ctx.strokeStyle = alpha(THEME.indigo, 0.55)
      ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.arc(cx, cy, rLam, 0, Math.PI * 2); ctx.stroke()
      ctx.restore()

      // Chu 球（最小外接球，半径 a）
      ctx.fillStyle = alpha(THEME.accent, 0.07)
      ctx.beginPath(); ctx.arc(cx, cy, rA, 0, Math.PI * 2); ctx.fill()
      ctx.save()
      ctx.setLineDash([3, 3])
      ctx.strokeStyle = alpha(THEME.accent, 0.6)
      ctx.beginPath(); ctx.arc(cx, cy, rA, 0, Math.PI * 2); ctx.stroke()
      ctx.restore()

      // 天线（撑满 Chu 球）
      ctx.strokeStyle = THEME.ink
      ctx.lineCap = 'round'
      if (S.mode === 'loop') {
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.ellipse(cx, cy, rA * 0.9, rA * 0.45, 0, 0, Math.PI * 2)
        ctx.stroke()
      } else {
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(cx, cy - rA * 0.92); ctx.lineTo(cx, cy - 2)
        ctx.moveTo(cx, cy + 2); ctx.lineTo(cx, cy + rA * 0.92)
        ctx.stroke()
      }

      // 近区：双向往返箭头（无功储能），强度 ∝ log10(Qmin)
      const qNorm = Math.min(1, Math.log10(Math.max(1, v.qmin)) / 4)
      const r1 = Math.min(rA + 8, rLam * 0.5), r2 = rLam * 0.88
      for (let i = 0; i < 6; i++) {
        const a = Math.PI * 2 * i / 6 + Math.PI / 6
        const c = alpha(THEME.indigo, 0.3 + 0.55 * qNorm)
        lc.arrow(ctx, cx + r1 * Math.cos(a), cy + r1 * Math.sin(a),
          cx + r2 * Math.cos(a), cy + r2 * Math.sin(a), c, 1.5)
        lc.arrow(ctx, cx + r2 * Math.cos(a + 0.14), cy + r2 * Math.sin(a + 0.14),
          cx + r1 * Math.cos(a + 0.14), cy + r1 * Math.sin(a + 0.14), c, 1.5)
      }
      // 远区：净流出箭头，透明度 ∝ 辐射效率 η
      for (let i = 0; i < 10; i++) {
        const a = Math.PI * 2 * i / 10
        const rr1 = rLam + 6, rr2 = rLam + 22
        lc.arrow(ctx, cx + rr1 * Math.cos(a), cy + rr1 * Math.sin(a),
          cx + rr2 * Math.cos(a), cy + rr2 * Math.sin(a),
          alpha(THEME.teal, 0.2 + 0.75 * v.eta), 2)
      }

      // 标注
      lc.label(ctx, 'a（Chu 球）', cx + rA * 0.71 + 4, cy - rA * 0.71 - 4, {
        color: THEME.accent, font: THEME.fontTick,
      })
      lc.label(ctx, 'r = λ/2π', cx + rLam * 0.72, cy - rLam * 0.72, {
        color: THEME.indigo, font: THEME.fontLabel,
      })
      lc.label(ctx, 'ka = ' + S.ka.toFixed(2) + ' → Qmin ≈ ' +
        (v.qmin > 999 ? Math.round(v.qmin) : v.qmin.toFixed(1)),
        w - 12, 18, { align: 'right', color: THEME.ink, font: THEME.fontTitle })
      lc.legend(ctx, [
        { name: '近区储能（∝Q）', color: THEME.indigo },
        { name: '辐射（η=' + Math.round(v.eta * 100) + '%）', color: THEME.teal },
      ], 12, h - 12)
    })
  },

  // ═══ 曲线图：Qmin / η·Qmin（上）与 Rrad / η（下）vs ka ═══
  drawCurve() {
    lc.mount(this, '#curveCanvas', (ctx, w, h) => {
      lc.clear(ctx, w, h)
      const v = this.values()
      const S = this.data.S
      const N = 140
      const kas = []
      for (let i = 0; i <= N; i++) kas.push(KA_MIN + (KA_MAX - KA_MIN) * i / N)
      const xTicks = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]

      // ── 上图：Q（对数轴）──
      const boxQ = { x: 50, y: 20, w: w - 66, h: h * 0.36 }
      const pQ = lc.plot(ctx, boxQ, [KA_MIN, KA_MAX], [0, 4])
      pQ.axes({
        xTicks, yTicks: [0, 1, 2, 3, 4],
        yFmt: (t) => ['1', '10', '100', '10³', '10⁴'][t] || '',
        yLabel: 'Q（对数）',
      })
      const ysQ = kas.map((ka) => Math.log10(rf.chuQmin(ka)))
      const ysQe = kas.map((ka) =>
        Math.log10(Math.max(1, this.etaOf(ka, S.mode, S.rloss) * rf.chuQmin(ka))))
      pQ.area(kas, ysQ, THEME.accent, 0)
      pQ.line(kas, ysQ, THEME.accent, 2)
      ctx.save(); ctx.setLineDash([5, 4])
      pQ.line(kas, ysQe, THEME.teal, 2)
      ctx.restore()
      pQ.guideX(S.ka)
      pQ.dot(S.ka, Math.min(4, Math.log10(v.qmin)), THEME.accent)
      lc.label(ctx, 'Qmin（无耗下界）', pQ.X(0.13), pQ.Y(Math.min(4, Math.log10(rf.chuQmin(0.13)))) - 8, {
        color: THEME.accent, font: THEME.fontLabel,
      })
      lc.label(ctx, 'η·Qmin（含损）', pQ.X(0.44), pQ.Y(ysQe[Math.round((0.44 - KA_MIN) / (KA_MAX - KA_MIN) * N)]) + 14, {
        color: THEME.teal, font: THEME.fontLabel,
      })

      // ── 下图：Rrad（左对数轴）+ η（右轴 0–100%）──
      const boxR = { x: 50, y: boxQ.y + boxQ.h + 52, w: w - 66, h: 0 }
      boxR.h = h - boxR.y - 40
      const pR = lc.plot(ctx, boxR, [KA_MIN, KA_MAX], [-3, 2])
      pR.axes({
        xTicks, yTicks: [-3, -2, -1, 0, 1, 2],
        yFmt: (t) => ({ '-3': '1m', '-2': '10m', '-1': '0.1', 0: '1', 1: '10', 2: '100' }[t] || ''),
        xLabel: 'ka = 2πa/λ', yLabel: 'Rrad (Ω，对数)',
      })
      const ysR = kas.map((ka) => Math.log10(this.rrad(ka, S.mode)))
      pR.line(kas, ysR, THEME.gold, 2)
      // η 曲线（同一绘图区，右轴 0–1）
      const pE = lc.plot(ctx, boxR, [KA_MIN, KA_MAX], [0, 1])
      const ysE = kas.map((ka) => this.etaOf(ka, S.mode, S.rloss))
      pE.line(kas, ysE, THEME.teal, 2)
      ;[0, 0.5, 1].forEach((t) => {
        lc.label(ctx, Math.round(t * 100) + '%', boxR.x + boxR.w + 5, pE.Y(t) + 3, {
          color: THEME.teal, font: THEME.fontTick,
        })
      })
      pR.guideX(S.ka)
      pR.dot(S.ka, Math.max(-3, Math.min(2, Math.log10(v.r))), THEME.gold)
      pE.dot(S.ka, v.eta, THEME.teal)
      lc.label(ctx, 'Rrad', pR.X(0.62), pR.Y(ysR[Math.round((0.62 - KA_MIN) / (KA_MAX - KA_MIN) * N)]) - 8, {
        color: THEME.gold, font: THEME.fontLabel,
      })
      lc.label(ctx, 'η（右轴）', pE.X(0.30), pE.Y(ysE[Math.round((0.30 - KA_MIN) / (KA_MAX - KA_MIN) * N)]) - 8, {
        color: THEME.teal, font: THEME.fontLabel,
      })
    })
  },

  onShareAppMessage() {
    return { title: '电小天线与 Chu 极限', path: '/pages/interactive/miniaturization/miniaturization' }
  },
})

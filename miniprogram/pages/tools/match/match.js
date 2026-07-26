// pages/tools/match/match.js —— 传输线 & 阻抗匹配（微带线 / λ/4 / L 型 / 波导）
// 公式来源：Pozar《Microwave Engineering》4th（3.195/2.44/5.36/3.84）、
// Hammerstad–Jensen 1980（Z₀ 拟合）、Hammerstad 铜厚 Weff 分支、Bahl–Garg Δεeff。
const haptic = require('../../../utils/haptic')
const rf = require('../../../utils/rf-math')
const lc = require('../../../utils/lab-canvas')
const { THEME, alpha } = require('../../../utils/lab-theme')

const GAMMA_M = 0.2 // λ/4 带宽定义的可容忍反射（SWR ≤ 1.5）

// EIA 标准矩形波导（宽边 a，mm）—— WR 编号 = 宽边英寸 × 100
const WR_TABLE = [
  { name: 'WR-975', a: 247.65, band: 'UHF 0.75–1.15 GHz' },
  { name: 'WR-340', a: 86.36, band: 'S 波段 2.20–3.30 GHz' },
  { name: 'WR-284', a: 72.136, band: 'S 波段 2.60–3.95 GHz' },
  { name: 'WR-187', a: 47.549, band: 'C 波段 3.95–5.85 GHz' },
  { name: 'WR-137', a: 34.849, band: 'C 波段 5.85–8.20 GHz' },
  { name: 'WR-112', a: 28.499, band: 'X 波段 7.05–10.0 GHz' },
  { name: 'WR-90', a: 22.86, band: 'X 波段 8.2–12.4 GHz' },
  { name: 'WR-62', a: 15.799, band: 'Ku 波段 12.4–18.0 GHz' },
  { name: 'WR-42', a: 10.668, band: 'K 波段 18.0–26.5 GHz' },
  { name: 'WR-28', a: 7.112, band: 'Ka 波段 26.5–40.0 GHz' },
  { name: 'WR-19', a: 4.775, band: 'U 波段 40–60 GHz' },
  { name: 'WR-15', a: 3.759, band: 'V 波段 50–75 GHz' },
  { name: 'WR-12', a: 3.099, band: 'E 波段 60–90 GHz' },
  { name: 'WR-10', a: 2.54, band: 'W 波段 75–110 GHz' },
]

// ── 微带线分析：Hammerstad–Jensen Z₀ + Hammerstad εeff（含铜厚修正）──
// Weff = W + (1.25T/π)(1 + ln X)，宽线(W/H ≥ 1/2π) X=2H/T，窄线 X=4πW/T
// εeff：u ≥ 1 用标准式；u < 1 补 0.04(1−u)² 项（Pozar 3.195 完整式）
// 铜厚对 εeff：Δεeff = (εr−1)(T/H)/(4.6·√(W/H))（Bahl–Garg）
function msAnalyze(W, H, T, er) {
  const u0 = W / H
  let Weff = W
  if (T > 0) {
    const lnX = u0 >= 1 / (2 * Math.PI) ? Math.log(2 * H / T) : Math.log(4 * Math.PI * W / T)
    Weff = W + (1.25 * T / Math.PI) * (1 + lnX)
  }
  const u = Weff / H
  let ee = (er + 1) / 2 + (er - 1) / 2 / Math.sqrt(1 + 12 / u)
  if (u < 1) ee += (er - 1) / 2 * 0.04 * (1 - u) * (1 - u)
  if (T > 0) ee = Math.max(1, ee - (er - 1) * (T / H) / (4.6 * Math.sqrt(u0)))
  const F = 6 + (2 * Math.PI - 6) * Math.exp(-Math.pow(30.666 / u, 0.7528))
  const z0 = 60 / Math.sqrt(ee) * Math.log(F / u + Math.sqrt(1 + 4 / (u * u)))
  return { z0, ee, u }
}

// ── L 网络电路符号（画布小件）──
function vline(ctx, x, y1, y2, color) {
  ctx.strokeStyle = color || THEME.inkSoft; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke()
}
function hline(ctx, x1, x2, y, color) {
  ctx.strokeStyle = color || THEME.inkSoft; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke()
}
function coilH(ctx, x, y, color) { // 串联电感（跨度 ±20，含引线）
  ctx.strokeStyle = color; ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x - 20, y); ctx.lineTo(x - 15, y)
  for (let i = -1; i <= 1; i++) { ctx.moveTo(x + i * 10 - 5, y); ctx.arc(x + i * 10, y, 5, Math.PI, 0) }
  ctx.moveTo(x + 15, y); ctx.lineTo(x + 20, y)
  ctx.stroke()
}
function capH(ctx, x, y, color) { // 串联电容（跨度 ±20）
  ctx.strokeStyle = color; ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x - 20, y); ctx.lineTo(x - 4, y)
  ctx.moveTo(x + 4, y); ctx.lineTo(x + 20, y)
  ctx.moveTo(x - 4, y - 9); ctx.lineTo(x - 4, y + 9)
  ctx.moveTo(x + 4, y - 9); ctx.lineTo(x + 4, y + 9)
  ctx.stroke()
}
function coilV(ctx, x, y, color) { // 并联电感（中心 y，跨度 ±14）
  ctx.strokeStyle = color; ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x, y - 14); ctx.lineTo(x, y - 13.5)
  for (let i = -1; i <= 1; i++) { ctx.moveTo(x, y + i * 9 - 4.5); ctx.arc(x, y + i * 9, 4.5, -Math.PI / 2, Math.PI / 2) }
  ctx.moveTo(x, y + 13.5); ctx.lineTo(x, y + 14)
  ctx.stroke()
}
function capV(ctx, x, y, color) { // 并联电容（中心 y，跨度 ±14）
  ctx.strokeStyle = color; ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x, y - 14); ctx.lineTo(x, y - 3)
  ctx.moveTo(x - 9, y - 3); ctx.lineTo(x + 9, y - 3)
  ctx.moveTo(x - 9, y + 3); ctx.lineTo(x + 9, y + 3)
  ctx.moveTo(x, y + 3); ctx.lineTo(x, y + 14)
  ctx.stroke()
}
function gnd(ctx, x, y) {
  ctx.strokeStyle = THEME.inkSoft; ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(x - 9, y); ctx.lineTo(x + 9, y)
  ctx.moveTo(x - 6, y + 4); ctx.lineTo(x + 6, y + 4)
  ctx.moveTo(x - 3, y + 8); ctx.lineTo(x + 3, y + 8)
  ctx.stroke()
}

Page({
  data: {
    tabs: ['微带线', 'λ/4 变换器', 'L 型匹配', '波导截止'],
    activeTab: 0,
    // Tab1 微带线（fwd: W→Z₀，rev: Z₀→W）
    msMode: 'fwd',
    msW: '3.0', msH: '1.6', msT: '0.035', msEr: '4.4', msZ0: '50',
    msResult: null,
    // Tab2 λ/4 变换器
    qZin: '50', qZl: '100', qFreq: '2400', qEr: '4.4',
    qResult: null,
    // Tab3 L 型匹配
    lRs: '50', lRl: '100', lFreq: '2400',
    lResult: null,
    // Tab4 波导截止
    wgA: '22.86', wgB: '10.16', wgEr: '1',
    wgResult: null,
  },

  onLoad(options) {
    const t = options ? parseInt(options.tab, 10) : NaN
    if (t >= 0 && t <= 3) this.setData({ activeTab: t })
  },
  onReady() { this._calcActive(true) },

  switchTab(e) {
    const i = +e.currentTarget.dataset.index
    if (!(i >= 0 && i <= 3)) return
    haptic.light()
    this.setData({ activeTab: i }, () => this._calcActive(true))
  },
  _calcActive(silent) {
    const t = this.data.activeTab
    if (t === 0) this._calcMs(silent)
    else if (t === 1) this._calcQ(silent)
    else if (t === 2) this._calcL(silent)
    else this._calcWg(silent)
  },
  _bad(silent) { if (!silent) wx.showToast({ title: '参数有误', icon: 'none' }); return null },

  // ══════ Tab1: 微带线特征阻抗 ══════
  onMsW(e) { this.setData({ msW: e.detail.value, msResult: null }) },
  onMsH(e) { this.setData({ msH: e.detail.value, msResult: null }) },
  onMsT(e) { this.setData({ msT: e.detail.value, msResult: null }) },
  onMsEr(e) { this.setData({ msEr: e.detail.value, msResult: null }) },
  onMsZ0(e) { this.setData({ msZ0: e.detail.value, msResult: null }) },
  setMsMode(e) {
    const m = e.currentTarget.dataset.m
    if (m !== 'fwd' && m !== 'rev') return
    haptic.light()
    this.setData({ msMode: m, msResult: null }, () => this._calcMs(true))
  },
  calcMicrostrip() { haptic.medium(); this._calcMs(false) },

  _calcMs(silent) {
    const d = this.data
    const H = parseFloat(d.msH) * 1e-3
    const T = parseFloat(d.msT) * 1e-3
    const er = parseFloat(d.msEr)
    if (!(H > 0) || !(er >= 1) || !(T >= 0)) return this._bad(silent)
    let W, r, msResult
    if (d.msMode === 'rev') {
      const z0t = parseFloat(d.msZ0)
      if (!(z0t > 0)) return this._bad(silent)
      const wOverH = rf.microstripSynthesize(z0t, er) // Wheeler–Hammerstad 综合（零铜厚）
      if (!(wOverH > 0) || !isFinite(wOverH)) return this._bad(silent)
      W = wOverH * H
      r = msAnalyze(W, H, T, er) // 用含铜厚的分析式校核
      msResult = {
        mode: 'rev',
        wMm: (W * 1e3).toFixed(3),
        wOverH: wOverH.toFixed(3),
        z0: r.z0.toFixed(1),
        erEff: r.ee.toFixed(3),
      }
    } else {
      W = parseFloat(d.msW) * 1e-3
      if (!(W > 0)) return this._bad(silent)
      r = msAnalyze(W, H, T, er)
      const z0 = r.z0
      const hint = z0 < 20 ? '低阻抗宽线，适合功率分配'
        : z0 > 120 ? '高阻抗细线，适合 RF 扼流'
        : Math.abs(z0 - 50) < 3 ? '≈ 50Ω 标准匹配线' : '常规微带线'
      msResult = { mode: 'fwd', z0: z0.toFixed(1), erEff: r.ee.toFixed(3), wOverH: r.u.toFixed(2), hint }
    }
    this._msPlot = { W, H, T, er, u: W / H, z0: r.z0 }
    this.setData({ msResult }, () => this._drawMs())
  },

  _drawMs() {
    const P = this._msPlot
    if (!P) return
    lc.mount(this, '#msCanvas', (ctx, w, h) => {
      lc.clear(ctx, w, h)
      this._drawMsCross(ctx, w, P)
      // Z₀–W/H 曲线（对数横轴）
      const box = { x: 48, y: 118, w: w - 68, h: h - 164 }
      const xs = [], ys = []
      let ymax = 0
      for (let i = 0; i <= 120; i++) {
        const lu = -1 + 2 * i / 120
        const z = msAnalyze(Math.pow(10, lu) * P.H, P.H, P.T, P.er).z0
        xs.push(lu); ys.push(z)
        if (z > ymax) ymax = z
      }
      const p = lc.plot(ctx, box, [-1, 1], [0, Math.ceil(ymax / 50) * 50 + 20])
      const lt = [0.1, 0.2, 0.5, 1, 2, 5, 10]
      p.axes({
        xTicks: lt.map((v) => Math.log10(v)),
        xFmt: (v) => { const t = Math.pow(10, v); return t >= 1 ? String(Math.round(t)) : String(+t.toFixed(1)) },
        xLabel: 'W/H（对数轴）', yLabel: 'Z₀ (Ω)',
      })
      p.line(xs, ys, THEME.accent, 2)
      const lu0 = Math.log10(P.u)
      if (lu0 >= -1 && lu0 <= 1) {
        p.guideX(lu0); p.guideY(P.z0)
        p.dot(lu0, P.z0, THEME.accent)
      }
      lc.label(ctx, 'W/H = ' + P.u.toFixed(2) + ' → Z₀ ≈ ' + P.z0.toFixed(1) + ' Ω',
        box.x + box.w, box.y - 6, { align: 'right', color: THEME.ink, font: THEME.fontTitle })
    })
  },
  _drawMsCross(ctx, w, P) {
    const sx = 60, sw = w - 120, gy = 88, sh = 34, sy = gy - sh, cxm = sx + sw / 2
    ctx.fillStyle = THEME.bgSoft; ctx.fillRect(sx, sy, sw, sh)
    ctx.strokeStyle = THEME.gridStrong; ctx.lineWidth = 1; ctx.strokeRect(sx, sy, sw, sh)
    ctx.fillStyle = THEME.inkSoft; ctx.fillRect(sx, gy, sw, 4) // 接地板
    const tw = Math.min(sw * 0.8, Math.max(12, sw * 0.08 * P.u))
    const tt = 7
    ctx.fillStyle = THEME.accent; ctx.fillRect(cxm - tw / 2, sy - tt, tw, tt) // 导带
    const yd = sy - tt - 10
    lc.arrow(ctx, cxm, yd, cxm - tw / 2, yd, THEME.inkSoft, 1)
    lc.arrow(ctx, cxm, yd, cxm + tw / 2, yd, THEME.inkSoft, 1)
    lc.label(ctx, 'W = ' + (P.W * 1e3).toFixed(2) + ' mm', cxm, yd - 6,
      { align: 'center', color: THEME.ink, font: THEME.fontLabel })
    const xd = sx + sw + 12
    lc.arrow(ctx, xd, sy + sh / 2, xd, sy, THEME.inkSoft, 1)
    lc.arrow(ctx, xd, sy + sh / 2, xd, gy, THEME.inkSoft, 1)
    lc.label(ctx, 'H', xd + 5, sy + sh / 2 + 4, { color: THEME.ink, font: THEME.fontLabel })
    lc.label(ctx, 'εr = ' + P.er, cxm, sy + sh / 2 + 4,
      { align: 'center', color: THEME.inkSoft, font: THEME.fontNote })
    lc.label(ctx, 'T', cxm + tw / 2 + 6, sy - 1, { color: THEME.muted, font: THEME.fontTick })
    lc.label(ctx, '接地板', sx + 2, gy + 16, { color: THEME.muted, font: THEME.fontTick })
    lc.label(ctx, '横截面示意（非严格比例）', w - 4, 12,
      { align: 'right', color: THEME.muted, font: THEME.fontTick })
  },

  // ══════ Tab2: λ/4 阻抗变换器 ══════
  onQZin(e) { this.setData({ qZin: e.detail.value, qResult: null }) },
  onQZl(e) { this.setData({ qZl: e.detail.value, qResult: null }) },
  onQFreq(e) { this.setData({ qFreq: e.detail.value, qResult: null }) },
  onQEr(e) { this.setData({ qEr: e.detail.value, qResult: null }) },
  calcQuarter() { haptic.medium(); this._calcQ(false) },

  _calcQ(silent) {
    const d = this.data
    const zin = parseFloat(d.qZin), zl = parseFloat(d.qZl)
    const f = parseFloat(d.qFreq) * 1e6, er = parseFloat(d.qEr)
    if (!(zin > 0) || !(zl > 0) || !(f > 0) || !(er >= 1)) return this._bad(silent)
    const z1 = rf.quarterWaveZ(zin, zl)
    const lambda0 = rf.wavelength(f)
    // 微带上物理长度区间：εeff ∈ [(εr+1)/2, εr] → ℓ ∈ [λ₀/(4√εr), λ₀/(4√((εr+1)/2))]
    const lMin = lambda0 / (4 * Math.sqrt(er))
    const lMax = lambda0 / (4 * Math.sqrt((er + 1) / 2))
    const gamma0 = Math.abs(zl - zin) / (zl + zin) // 无变换器时的 |Γ|
    // 单节变换器精确相对带宽（Pozar 5.36），Γm = 0.2 (SWR ≤ 1.5)
    let thetaM = 0
    if (Math.abs(zl - zin) > 1e-9) {
      const t = GAMMA_M / Math.sqrt(1 - GAMMA_M * GAMMA_M) *
        2 * Math.sqrt(zin * zl) / Math.abs(zl - zin)
      thetaM = Math.acos(Math.min(1, t))
    }
    const fbw = 2 - 4 * thetaM / Math.PI
    this._qPlot = { zin, zl, z1, thetaM, fbw, gamma0, lambda0 }
    this.setData({
      qResult: {
        z1: z1.toFixed(1),
        l0: rf.fmtLen(lambda0 / 4),
        lRange: rf.fmtLen(lMin) + ' ~ ' + rf.fmtLen(lMax),
        gamma0: gamma0.toFixed(3),
        bw: fbw >= 1.999 ? '≥200%（已近匹配）' : (fbw * 100).toFixed(1) + '%',
      },
    }, () => this._drawQ())
  },

  _drawQ() {
    const P = this._qPlot
    if (!P) return
    lc.mount(this, '#qCanvas', (ctx, w, h) => {
      lc.clear(ctx, w, h)
      // 三段传输线示意
      const yw = 40
      hline(ctx, 16, w - 16, yw)
      const segs = [
        { x1: 16, x2: 104, hh: 10, c: THEME.indigo, t: 'Zin ' + lc.fmtNum(P.zin) + ' Ω' },
        { x1: 116, x2: w - 116, hh: 16, c: THEME.accent, t: 'Z₁ = ' + P.z1.toFixed(1) + ' Ω' },
        { x1: w - 104, x2: w - 16, hh: 10, c: THEME.teal, t: 'ZL ' + lc.fmtNum(P.zl) + ' Ω' },
      ]
      segs.forEach((s) => {
        ctx.fillStyle = alpha(s.c, 0.16)
        ctx.fillRect(s.x1, yw - s.hh / 2, s.x2 - s.x1, s.hh)
        ctx.strokeStyle = s.c; ctx.lineWidth = 1.5
        ctx.strokeRect(s.x1, yw - s.hh / 2, s.x2 - s.x1, s.hh)
        lc.label(ctx, s.t, (s.x1 + s.x2) / 2, yw - s.hh / 2 - 8,
          { align: 'center', color: s.c, font: THEME.fontLabel })
      })
      const mid = w / 2
      lc.arrow(ctx, mid, yw + 22, 116, yw + 22, THEME.inkSoft, 1)
      lc.arrow(ctx, mid, yw + 22, w - 116, yw + 22, THEME.inkSoft, 1)
      lc.label(ctx, 'ℓ = λ/4（f₀ 处）', mid, yw + 38,
        { align: 'center', color: THEME.inkSoft, font: THEME.fontTick })
      // |Γ|(f/f₀) 响应曲线（精确传输线理论）
      const box = { x: 48, y: 100, w: w - 68, h: h - 146 }
      const ymax = Math.max(0.35, Math.ceil((P.gamma0 + 0.05) * 10) / 10)
      const p = lc.plot(ctx, box, [0.5, 1.5], [0, ymax])
      p.axes({ xTicks: [0.5, 0.75, 1, 1.25, 1.5], xLabel: 'f / f₀', yLabel: '|Γ|' })
      const f1 = 2 * P.thetaM / Math.PI, f2 = 2 - 2 * P.thetaM / Math.PI
      p.bandX(Math.max(0.5, f1), Math.min(1.5, f2), THEME.okSoft)
      const xs = [], ys = []
      for (let i = 0; i <= 150; i++) {
        const fr = 0.5 + i / 150
        const zinC = rf.zinLossless(P.z1, rf.cx(P.zl), Math.PI / 2 * fr)
        xs.push(fr); ys.push(rf.cAbs(rf.gammaFromZ(zinC, P.zin)))
      }
      p.guideY(GAMMA_M)
      p.line(xs, ys, THEME.accent, 2)
      p.dot(1, 0, THEME.accent)
      lc.label(ctx, 'Γm = 0.2（SWR 1.5）', box.x + box.w - 4, p.Y(GAMMA_M) - 6,
        { align: 'right', color: THEME.inkSoft, font: THEME.fontTick })
      lc.label(ctx, 'SWR≤1.5 带宽 ≈ ' + (P.fbw * 100).toFixed(1) + '%',
        box.x + 6, box.y + 12, { color: THEME.teal, font: THEME.fontLabel })
    })
  },

  // ══════ Tab3: L 型匹配网络 ══════
  onLRs(e) { this.setData({ lRs: e.detail.value, lResult: null }) },
  onLRl(e) { this.setData({ lRl: e.detail.value, lResult: null }) },
  onLFreq(e) { this.setData({ lFreq: e.detail.value, lResult: null }) },
  calcLMatch() { haptic.medium(); this._calcL(false) },

  _calcL(silent) {
    const d = this.data
    const rs = parseFloat(d.lRs), rl = parseFloat(d.lRl), f = parseFloat(d.lFreq) * 1e6
    if (!(rs > 0) || !(rl > 0) || !(f > 0)) return this._bad(silent)
    if (Math.abs(rs - rl) < 1e-9) {
      if (!silent) wx.showToast({ title: 'R_S = R_L，已匹配无需 L 网络', icon: 'none' })
      this.setData({ lResult: null })
      return
    }
    const m = rf.lMatch(Math.min(rs, rl), Math.max(rs, rl)) // Q=√(R高/R低−1)
    const omega = 2 * Math.PI * f
    const comp = {
      lSeries: this.fmtH(m.xSeries / omega),   // 低通：串联 L
      cShunt: this.fmtF(1 / (omega * m.xParallel)),
      cSeries: this.fmtF(1 / (omega * m.xSeries)), // 高通：串联 C
      lShunt: this.fmtH(m.xParallel / omega),
    }
    // 串联臂在低阻侧、并联臂跨接高阻侧（标准 L 型设计规则）
    const shuntAtLoad = rl > rs
    const topologyNote = shuntAtLoad
      ? '串联臂靠源（低阻侧），并联臂跨接负载（高阻侧）'
      : '串联臂靠负载（低阻侧），并联臂跨接源（高阻侧）'
    this._lPlot = {
      rs, rl, q: m.q, ratio: Math.max(rs, rl) / Math.min(rs, rl),
      shuntAtLoad, comp,
    }
    this.setData({
      lResult: {
        q: m.q.toFixed(2),
        xs: m.xSeries.toFixed(1),
        xp: m.xParallel.toFixed(1),
        lSeries: comp.lSeries, cShunt: comp.cShunt,
        cSeries: comp.cSeries, lShunt: comp.lShunt,
        topologyNote,
      },
    }, () => this._drawL())
  },

  _drawL() {
    const P = this._lPlot
    if (!P) return
    lc.mount(this, '#lCanvas', (ctx, w, h) => {
      lc.clear(ctx, w, h)
      this._drawLnet(ctx, w, {
        y0: 2, title: '低通型（抑制高次谐波）', serKind: 'L', shKind: 'C',
        serLabel: 'L = ' + P.comp.lSeries, shLabel: 'C = ' + P.comp.cShunt, P,
      })
      this._drawLnet(ctx, w, {
        y0: 94, title: '高通型（隔直流 / 通低频）', serKind: 'C', shKind: 'L',
        serLabel: 'C = ' + P.comp.cSeries, shLabel: 'L = ' + P.comp.lShunt, P,
      })
      // Q–阻抗比曲线
      const rmax = Math.max(10, P.ratio * 1.4)
      const box = { x: 48, y: 200, w: w - 70, h: 42 }
      const p = lc.plot(ctx, box, [1, rmax], [0, Math.sqrt(rmax - 1) * 1.15])
      p.axes({ xLabel: 'R高 / R低', yLabel: 'Q' })
      const xs = [], ys = []
      for (let i = 0; i <= 100; i++) {
        const r = 1 + (rmax - 1) * i / 100
        xs.push(r); ys.push(Math.sqrt(r - 1))
      }
      p.line(xs, ys, THEME.gold, 2)
      p.dot(P.ratio, P.q, THEME.gold)
      lc.label(ctx, 'Q = √(R高/R低 − 1) · 当前 Q = ' + P.q.toFixed(2),
        box.x + box.w, box.y - 6, { align: 'right', color: THEME.ink, font: THEME.fontLabel })
    })
  },
  _drawLnet(ctx, w, o) {
    const P = o.P, yw = o.y0 + 44
    lc.label(ctx, o.title, 14, o.y0 + 14, { color: THEME.ink, font: THEME.fontTitle })
    // 源 / 负载端子
    const bs = { x: 18, w: 40 }, bl = { x: w - 58, w: 40 }
    ctx.strokeStyle = THEME.inkSoft; ctx.lineWidth = 1.5
    ctx.strokeRect(bs.x, yw - 8, bs.w, 16)
    ctx.strokeRect(bl.x, yw - 8, bl.w, 16)
    lc.label(ctx, 'RS ' + lc.fmtNum(P.rs) + 'Ω', bs.x + bs.w / 2, yw + 26,
      { align: 'center', color: THEME.inkSoft, font: THEME.fontTick })
    lc.label(ctx, 'RL ' + lc.fmtNum(P.rl) + 'Ω', bl.x + bl.w / 2, yw + 26,
      { align: 'center', color: THEME.inkSoft, font: THEME.fontTick })
    // 并联臂挂高阻侧，串联臂在低阻侧
    const xNode = P.shuntAtLoad ? bl.x - 28 : bs.x + bs.w + 28
    const serC = P.shuntAtLoad ? (bs.x + bs.w + xNode - 20) / 2 : (xNode + 20 + bl.x) / 2
    hline(ctx, bs.x + bs.w, serC - 20, yw)
    hline(ctx, serC + 20, bl.x, yw)
    if (o.serKind === 'L') coilH(ctx, serC, yw, THEME.accent)
    else capH(ctx, serC, yw, THEME.accent)
    lc.label(ctx, o.serLabel, serC, yw - 16,
      { align: 'center', color: THEME.accent, font: THEME.fontLabel })
    // 并联支路 → 地
    const yc = yw + 24
    ctx.fillStyle = THEME.ink
    ctx.beginPath(); ctx.arc(xNode, yw, 2.5, 0, Math.PI * 2); ctx.fill()
    vline(ctx, xNode, yw, yc - 14)
    if (o.shKind === 'C') capV(ctx, xNode, yc, THEME.teal)
    else coilV(ctx, xNode, yc, THEME.teal)
    vline(ctx, xNode, yc + 14, yw + 42)
    gnd(ctx, xNode, yw + 42)
    lc.label(ctx, o.shLabel, xNode + (P.shuntAtLoad ? -12 : 12), yc + 4,
      { align: P.shuntAtLoad ? 'right' : 'left', color: THEME.teal, font: THEME.fontLabel })
  },

  // ══════ Tab4: 波导截止频率 ══════
  onWgA(e) { this.setData({ wgA: e.detail.value, wgResult: null }) },
  onWgB(e) { this.setData({ wgB: e.detail.value, wgResult: null }) },
  onWgEr(e) { this.setData({ wgEr: e.detail.value, wgResult: null }) },
  calcWaveguide() { haptic.medium(); this._calcWg(false) },

  _calcWg(silent) {
    const d = this.data
    const a = parseFloat(d.wgA) * 1e-3, b = parseFloat(d.wgB) * 1e-3
    const er = parseFloat(d.wgEr) || 1
    if (!(a > 0) || !(b > 0) || !(er >= 1)) return this._bad(silent)
    // fc(TEmn) = c/(2√εr)·√((m/a)² + (n/b)²)（Pozar 3.84）
    const k = rf.C0 / (2 * Math.sqrt(er))
    const fc10 = k / a, fc20 = 2 * k / a, fc01 = k / b
    const fc11 = k * Math.sqrt(1 / (a * a) + 1 / (b * b))
    const fUpper = Math.min(fc20, fc01) // 单模带上限
    const fLowRec = 1.25 * fc10, fHighRec = 1.9 * fc10
    // WR 命名：编号 = 宽边英寸×100，按 a 匹配标准表（±1.5%）
    let bandName = ''
    for (const wg of WR_TABLE) {
      if (Math.abs(a * 1e3 - wg.a) / wg.a < 0.015) { bandName = wg.name + '（' + wg.band + '）'; break }
    }
    const g = 1e9
    this._wgPlot = {
      fc10: fc10 / g, fc20: fc20 / g, fc01: fc01 / g, fc11: fc11 / g,
      fUpper: fUpper / g, fLowRec: fLowRec / g, fHighRec: fHighRec / g,
    }
    this.setData({
      wgResult: {
        fc10: (fc10 / g).toFixed(3), fc20: (fc20 / g).toFixed(3),
        fc01: (fc01 / g).toFixed(3), fc11: (fc11 / g).toFixed(3),
        singleMode: (fc10 / g).toFixed(2) + ' ~ ' + (fUpper / g).toFixed(2) + ' GHz',
        recBand: (fLowRec / g).toFixed(2) + ' ~ ' + (fHighRec / g).toFixed(2) + ' GHz',
        bandName,
      },
    }, () => this._drawWg())
  },

  _drawWg() {
    const P = this._wgPlot
    if (!P) return
    lc.mount(this, '#wgCanvas', (ctx, w, h) => {
      lc.clear(ctx, w, h)
      const fmax = 1.25 * Math.max(P.fc20, P.fc01, P.fc11)
      const box = { x: 44, y: 26, w: w - 62, h: h - 72 }
      const p = lc.plot(ctx, box, [0, fmax], [0, 1])
      p.axes({ yTicks: [], xLabel: 'f (GHz)' })
      p.bandX(0, P.fc10, THEME.dangerSoft)
      p.bandX(P.fLowRec, P.fHighRec, THEME.okSoft)
      lc.label(ctx, '截止区', p.X(P.fc10 / 2), p.Y(0.08),
        { align: 'center', color: THEME.muted, font: THEME.fontTick })
      lc.label(ctx, '推荐带 1.25–1.9×fc₁₀', p.X((P.fLowRec + P.fHighRec) / 2), p.Y(0.08),
        { align: 'center', color: THEME.teal, font: THEME.fontTick })
      const modes = [
        { n: 'TE₁₀', f: P.fc10, c: THEME.accent, t: 0.92 },
        { n: 'TE₂₀', f: P.fc20, c: THEME.gold, t: 0.76 },
        { n: 'TE₀₁', f: P.fc01, c: THEME.indigo, t: 0.60 },
        { n: 'TE₁₁', f: P.fc11, c: THEME.plum, t: 0.44 },
      ]
      modes.forEach((m) => {
        const x = p.X(m.f)
        ctx.strokeStyle = m.c; ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(x, p.Y(0)); ctx.lineTo(x, p.Y(m.t)); ctx.stroke()
        const right = x > box.x + box.w - 64
        lc.label(ctx, m.n + ' ' + m.f.toFixed(2), x + (right ? -4 : 4), p.Y(m.t) + 4,
          { align: right ? 'right' : 'left', color: m.c, font: THEME.fontTick })
      })
    })
  },

  // ══════ 单位格式化 ══════
  fmtH(hv) {
    if (hv >= 1e-6) return (hv * 1e6).toFixed(2) + ' μH'
    return (hv * 1e9).toFixed(2) + ' nH'
  },
  fmtF(fv) {
    if (fv >= 1e-9) return (fv * 1e9).toFixed(2) + ' nF'
    return (fv * 1e12).toFixed(2) + ' pF'
  },

  onShareAppMessage() {
    return { title: '传输线 & 阻抗匹配计算器', path: '/pages/tools/match/match?tab=' + this.data.activeTab }
  },
})

// pages/interactive/friis/friis.js —— Friis / 雷达方程链路预算
// 物理公式全部来自 utils/rf-math（无魔法系数）：
//   Friis 单程：Pr(dBm) = Pt + Gt + Gr − 20lg(4πR/λ)，λ = c/f
//   雷达双程：Pr(dBm) = Pt + Gt + Gr + 10lg(λ²σ) − 10lg((4π)³R⁴)
//   最大作用距离：令 Pr = Pmin 反解 R（Friis 一次方根 / 雷达四次方根）

const haptic = require('../../../utils/haptic')
const rf = require('../../../utils/rf-math')
const lc = require('../../../utils/lab-canvas')
const { THEME, alpha } = require('../../../utils/lab-theme')

Page({
  data: {
    S: {
      mode: 'friis',
      pt: 30,       // dBm
      gt: 20,       // dBi
      gr: 20,       // dBi
      f: 10,        // GHz
      rExp: 2,      // 距离 R = 10^rExp m（滑块走对数刻度）
      rcsDbsm: 0,   // 目标 RCS（dBsm，雷达模式）
      smin: -90,    // 接收灵敏度 dBm
    },
    readout: null,
  },

  onLoad() { this.updateAndDraw() },
  onReady() { this.updateAndDraw() },
  onUnload() {
    if (this._timer) { clearTimeout(this._timer); this._timer = null }
  },

  // ═══ 事件（slider 用 bindchanging 实时 + 16ms 节流重绘）═══
  setFriis() { haptic.light(); this.setData({ 'S.mode': 'friis' }, () => this.updateAndDraw()) },
  setRadar() { haptic.light(); this.setData({ 'S.mode': 'radar' }, () => this.updateAndDraw()) },

  onPt(e)   { this._set('S.pt', e.detail.value) },
  onGt(e)   { this._set('S.gt', e.detail.value) },
  onGr(e)   { this._set('S.gr', e.detail.value) },
  onFreq(e) { this._set('S.f', e.detail.value) },
  onRExp(e) { this._set('S.rExp', e.detail.value) },
  onRcs(e)  { this._set('S.rcsDbsm', e.detail.value) },
  onSmin(e) { this._set('S.smin', e.detail.value) },

  _set(key, val) {
    this.setData({ [key]: val })
    if (this._timer) return
    this._timer = setTimeout(() => { this._timer = null; this.updateAndDraw() }, 16)
  },

  // ═══ 物理计算 ═══
  // Pr(dBm) @ R(m)
  prAtR(R, S) {
    if (R <= 0) return -Infinity
    const fHz = S.f * 1e9
    if (S.mode === 'friis') return rf.friisPrDbm(S.pt, S.gt, S.gr, fHz, R)
    // 雷达双程（收发增益分开的一般形式）
    const lam = rf.wavelength(fHz)
    const sigma = rf.dbToLin(S.rcsDbsm)               // dBsm → m²
    return S.pt + S.gt + S.gr + rf.linToDb(lam * lam * sigma) -
      rf.linToDb(Math.pow(4 * Math.PI, 3) * Math.pow(R, 4))
  },

  // 令 Pr = Pmin 反解最大作用距离（两种模式恒有正解）
  maxRange(S) {
    const lam = rf.wavelength(S.f * 1e9)
    if (S.mode === 'friis') {
      const val = S.pt + S.gt + S.gr - S.smin        // = 20lg(4πR/λ)
      return lam * Math.pow(10, val / 20) / (4 * Math.PI)
    }
    const sigma = rf.dbToLin(S.rcsDbsm)
    const val = S.pt + S.gt + S.gr + rf.linToDb(lam * lam * sigma) - S.smin
    return Math.pow(Math.pow(10, val / 10) / Math.pow(4 * Math.PI, 3), 0.25)
  },

  // ═══ 更新读数 + 重绘 ═══
  updateAndDraw() {
    const S = this.data.S
    const fHz = S.f * 1e9
    const lam = rf.wavelength(fHz)
    const Rcur = Math.pow(10, S.rExp)
    const Pr = this.prAtR(Rcur, S)

    // 路径损耗：Friis 用 FSPL；雷达为双程扩散损耗 − 目标项
    let pathLoss
    if (S.mode === 'friis') {
      pathLoss = rf.fsplDb(fHz, Rcur)
    } else {
      const sigma = rf.dbToLin(S.rcsDbsm)
      pathLoss = rf.linToDb(Math.pow(4 * Math.PI, 3) * Math.pow(Rcur, 4)) -
        rf.linToDb(lam * lam * sigma)
    }

    const rMax = this.maxRange(S)
    this.setData({
      readout: {
        R: rf.fmtLen(Rcur),
        Pr: isFinite(Pr) ? Pr.toFixed(1) : '—',
        pathLoss: isFinite(pathLoss) ? pathLoss.toFixed(1) : '—',
        maxRange: isFinite(rMax) && rMax > 0 ? rf.fmtLen(rMax) : '—',
        lambda: rf.fmtLen(lam),
        up: Pr >= S.smin,
      },
    })
    this.draw()
  },

  // ═══ 绘图：Pr–R 对数距离轴曲线（lab-canvas）═══
  draw() {
    lc.mount(this, '#chartCanvas', (ctx, w, h) => {
      lc.clear(ctx, w, h)
      const S = this.data.S
      const box = { x: 50, y: 24, w: w - 68, h: h - 70 }
      const LOG_MIN = 0, LOG_MAX = 5                  // 1 m … 100 km

      // 采样曲线（x = lg R）
      const N = 200
      const xs = [], ys = []
      let lo = S.smin, hi = S.smin
      for (let i = 0; i <= N; i++) {
        const logR = LOG_MIN + (LOG_MAX - LOG_MIN) * i / N
        const pr = this.prAtR(Math.pow(10, logR), S)
        xs.push(logR); ys.push(pr)
        if (isFinite(pr)) { lo = Math.min(lo, pr); hi = Math.max(hi, pr) }
      }
      const yMin = Math.floor((lo - 5) / 10) * 10
      const yMax = Math.ceil((hi + 5) / 10) * 10

      const p = lc.plot(ctx, box, [LOG_MIN, LOG_MAX], [yMin, yMax])
      const X_LBL = ['1 m', '10 m', '100 m', '1 km', '10 km', '100 km']
      p.axes({
        xTicks: [0, 1, 2, 3, 4, 5],
        xFmt: (v) => X_LBL[v] || '',
        xLabel: '距离 R（对数轴）',
        yLabel: 'Pr (dBm)',
      })

      // Pr 曲线（赤陶）+ 柔和填充
      p.area(xs, ys, THEME.accent, yMin)
      p.line(xs, ys, THEME.accent, 2)
      lc.label(ctx, S.mode === 'friis' ? 'Pr(R) ∝ 1/R²' : 'Pr(R) ∝ 1/R⁴',
        p.X(0.15), p.Y(ys[Math.round(N * 0.03)]) + 16,
        { color: THEME.accent, font: THEME.fontLabel })

      // 灵敏度门限 Pmin（赭金虚线，标签靠左端避开曲线右侧标注）
      p.guideY(S.smin, alpha(THEME.gold, 0.75))
      lc.label(ctx, 'Pmin = ' + S.smin + ' dBm', box.x + 6, p.Y(S.smin) - 5,
        { color: THEME.gold, font: THEME.fontLabel })

      // 最大作用距离 Rmax：曲线与 Pmin 的交点（两种模式都画）
      const rMax = this.maxRange(S)
      const logRmax = Math.log10(rMax)
      if (isFinite(logRmax) && logRmax >= LOG_MIN && logRmax <= LOG_MAX) {
        p.guideX(logRmax, alpha(THEME.indigo, 0.7))
        p.dot(logRmax, S.smin, THEME.indigo, 4)
        const onRight = logRmax > (LOG_MIN + LOG_MAX) / 2
        lc.label(ctx, 'Rmax ≈ ' + rf.fmtLen(rMax),
          p.X(logRmax) + (onRight ? -5 : 5), box.y + 30,
          { align: onRight ? 'right' : 'left', color: THEME.indigo, font: THEME.fontLabel })
      }

      // 当前距离标记点
      const curPr = this.prAtR(Math.pow(10, S.rExp), S)
      if (S.rExp >= LOG_MIN && S.rExp <= LOG_MAX && isFinite(curPr)) {
        p.guideX(S.rExp)
        if (curPr >= yMin && curPr <= yMax) {
          p.dot(S.rExp, curPr, THEME.accent)
          const onRight = S.rExp > (LOG_MIN + LOG_MAX) * 0.62
          lc.label(ctx, curPr.toFixed(1) + ' dBm',
            p.X(S.rExp) + (onRight ? -9 : 9), p.Y(curPr) - 8,
            { align: onRight ? 'right' : 'left', color: THEME.ink, font: THEME.fontTitle })
        }
      }

      // 模式注记（右上）
      lc.label(ctx, S.mode === 'friis' ? '−20 dB / 十倍距' : '−40 dB / 十倍距',
        box.x + box.w - 4, box.y + 13,
        { align: 'right', color: THEME.muted, font: THEME.fontTick })
    })
  },

  onShareAppMessage() {
    return { title: '链路预算 · Friis / 雷达方程', path: '/pages/interactive/friis/friis' }
  },
})

// pages/interactive/friis/friis.js —— Friis / 雷达方程交互
// 核心数学：
//   Friis 单程：Pr = Pt + Gt + Gr - 20log10(4πR/λ)
//   雷达双程：Pr = Pt + Gt + Gr + 10log10(λ²σ) - 10log10((4π)³R⁴)
//   λ = c/f,  c = 3e8 m/s

const haptic = require('../../../utils/haptic')
const C = 3e8 // 光速

Page({
  data: {
    S: {
      mode: 'friis',
      pt: 30,       // dBm
      gt: 20,       // dBi
      gr: 20,       // dBi
      f: 10,        // GHz
      rExp: 2,      // 距离量级 10^rExp m
      rcsDbsm: 0,   // dBsm (雷达模式)
      smin: -90,    // 灵敏度 dBm
    },
    readout: null,
  },

  onLoad() {
    this.updateAndDraw()
  },

  onReady() {
    this.updateAndDraw()
  },

  // ══════ 参数处理 ══════
  setFriis() {
    haptic.light()
    this.setData({ 'S.mode': 'friis' }, () => this.updateAndDraw())
  },
  setRadar() {
    haptic.light()
    this.setData({ 'S.mode': 'radar' }, () => this.updateAndDraw())
  },

  onPt(e)    { this.setData({ 'S.pt': e.detail.value }, () => this.updateAndDraw()) },
  onGt(e)    { this.setData({ 'S.gt': e.detail.value }, () => this.updateAndDraw()) },
  onGr(e)    { this.setData({ 'S.gr': e.detail.value }, () => this.updateAndDraw()) },
  onFreq(e)  { this.setData({ 'S.f': e.detail.value }, () => this.updateAndDraw()) },
  onRExp(e)  { this.setData({ 'S.rExp': e.detail.value }, () => this.updateAndDraw()) },
  onRcs(e)   { this.setData({ 'S.rcsDbsm': e.detail.value }, () => this.updateAndDraw()) },
  onSmin(e)  { this.setData({ 'S.smin': e.detail.value }, () => this.updateAndDraw()) },

  // ══════ 核心计算 ══════
  // Pr(dBm) at distance R(m)
  prAtR(R, S) {
    const lambda = C / (S.f * 1e9) // m
    if (S.mode === 'friis') {
      // Friis: Pr = Pt + Gt + Gr - 20log10(4πR/λ)
      if (R <= 0 || lambda <= 0) return -999
      const fspl = 20 * Math.log10(4 * Math.PI * R / lambda)
      return S.pt + S.gt + S.gr - fspl
    } else {
      // 雷达: Pr = Pt + Gt + Gr + 10log10(λ²σ) - 10log10((4π)³R⁴)
      if (R <= 0) return -999
      const sigma = Math.pow(10, S.rcsDbsm / 10) // m²
      const term1 = 10 * Math.log10(lambda * lambda * sigma)
      const term2 = 10 * Math.log10(Math.pow(4 * Math.PI, 3) * Math.pow(R, 4))
      return S.pt + S.gt + S.gr + term1 - term2
    }
  },

  // 求最大探测距离（Pr = smin 时的 R）
  maxRange(S) {
    const lambda = C / (S.f * 1e9)
    if (S.mode === 'friis') {
      // Pmin = Pt + Gt + Gr - 20log10(4πR/λ)
      // → 20log10(4πR/λ) = Pt + Gt + Gr - Pmin
      const val = S.pt + S.gt + S.gr - S.smin
      if (val <= 0) return 0
      // R = λ * 10^(val/20) / (4π)
      return lambda * Math.pow(10, val / 20) / (4 * Math.PI)
    } else {
      // Pmin = Pt + Gt + Gr + 10log10(λ²σ) - 10log10((4π)³R⁴)
      // → 10log10((4π)³R⁴) = Pt + Gt + Gr + 10log10(λ²σ) - Pmin
      const sigma = Math.pow(10, S.rcsDbsm / 10)
      const val = S.pt + S.gt + S.gr + 10 * Math.log10(lambda * lambda * sigma) - S.smin
      if (val <= 0) return 0
      // (4π)³R⁴ = 10^(val/10)
      // R⁴ = 10^(val/10) / (4π)³
      return Math.pow(Math.pow(10, val / 10) / Math.pow(4 * Math.PI, 3), 0.25)
    }
  },

  // ══════ 更新读数 + 重绘 ══════
  updateAndDraw() {
    const S = this.data.S
    const lambda = C / (S.f * 1e9) // m
    const lambdaMm = lambda * 1000

    // 当前距离（10^rExp）
    const Rcur = Math.pow(10, S.rExp)
    const Pr = this.prAtR(Rcur, S)

    // 路径损耗
    let pathLoss
    if (S.mode === 'friis') {
      pathLoss = 20 * Math.log10(4 * Math.PI * Rcur / lambda)
    } else {
      const sigma = Math.pow(10, S.rcsDbsm / 10)
      pathLoss = 10 * Math.log10(Math.pow(4 * Math.PI, 3) * Math.pow(Rcur, 4)) - 10 * Math.log10(lambda * lambda * sigma)
    }

    // 最大距离
    const rMax = this.maxRange(S)
    let maxRangeStr
    if (rMax <= 0) maxRangeStr = '—'
    else if (rMax >= 1000) maxRangeStr = (rMax / 1000).toFixed(1) + ' km'
    else maxRangeStr = rMax.toFixed(1) + ' m'

    const readout = {
      R: Rcur >= 1000 ? (Rcur / 1000).toFixed(1) + 'k' : Rcur.toFixed(1),
      Pr: Pr > -200 ? Pr.toFixed(1) : '—',
      pathLoss: isFinite(pathLoss) ? pathLoss.toFixed(1) : '—',
      maxRange: maxRangeStr,
      lambda: lambdaMm < 1 ? lambdaMm.toFixed(2) : lambdaMm.toFixed(0),
      aboveThreshold: Pr >= S.smin,
    }

    this.setData({ readout })
    this.drawChart()
  },

  // ══════ 绘图 ══════
  drawChart() {
    const query = wx.createSelectorQuery()
    query.select('#chartCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0]) return
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const dpr = wx.getWindowInfo().pixelRatio
        const w = res[0].width
        const h = res[0].height
        canvas.width = w * dpr
        canvas.height = h * dpr
        ctx.scale(dpr, dpr)

        const S = this.data.S
        this._draw(ctx, w, h, S)
      })
  },

  _draw(ctx, w, h, S) {
    ctx.clearRect(0, 0, w, h)

    // ═══ 绘图区域 ═══
    const padL = 52, padR = 20, padT = 16, padB = 36
    const plotW = w - padL - padR
    const plotH = h - padT - padB

    // ═══ 距离范围 (对数轴) ═══
    // 从 1m 到 10^5 m (0.1 km ~ 100 km)
    const rMinLog = 0   // log10(1)
    const rMaxLog = 5   // log10(100000)
    const rRange = rMaxLog - rMinLog

    // ═══ Pr 范围 ═══
    // 动态计算：在距离范围内取 Pr 的 min/max
    let prMin = Infinity, prMax = -Infinity
    const samples = 200
    for (let i = 0; i <= samples; i++) {
      const logR = rMinLog + (i / samples) * rRange
      const R = Math.pow(10, logR)
      const Pr = this.prAtR(R, S)
      if (isFinite(Pr) && Pr > -200) {
        if (Pr < prMin) prMin = Pr
        if (Pr > prMax) prMax = Pr
      }
    }
    // 扩展范围并取整
    prMin = Math.floor((prMin - 10) / 10) * 10
    prMax = Math.ceil((prMax + 10) / 10) * 10
    if (prMax - prMin < 40) { prMin -= 20; prMax += 20 }
    const prRange = prMax - prMin

    // ═══ 坐标变换 ═══
    const x2px = (logR) => padL + ((logR - rMinLog) / rRange) * plotW
    const y2px = (Pr) => padT + ((prMax - Pr) / prRange) * plotH

    // ═══ 网格 ═══
    ctx.strokeStyle = 'rgba(155,147,132,0.12)'
    ctx.lineWidth = 0.5
    // 垂直网格 (10^n m)
    ctx.font = '9px sans-serif'
    ctx.fillStyle = 'rgba(155,147,132,0.6)'
    ctx.textAlign = 'center'
    for (let n = 0; n <= 5; n++) {
      const px = x2px(n)
      ctx.beginPath()
      ctx.moveTo(px, padT)
      ctx.lineTo(px, padT + plotH)
      ctx.stroke()
      // 标签
      const labels = ['1m', '10m', '100m', '1km', '10km', '100km']
      ctx.fillText(labels[n], px, padT + plotH + 16)
    }
    // 水平网格
    ctx.textAlign = 'right'
    const prStep = prRange > 100 ? 20 : 10
    for (let Pr = Math.ceil(prMin / prStep) * prStep; Pr <= prMax; Pr += prStep) {
      const py = y2px(Pr)
      ctx.beginPath()
      ctx.moveTo(padL, py)
      ctx.lineTo(padL + plotW, py)
      ctx.stroke()
      ctx.fillText(Pr + '', padL - 6, py + 3)
    }

    // ═══ 轴标题 ═══
    ctx.fillStyle = 'rgba(155,147,132,0.8)'
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('距离 R', padL + plotW / 2, h - 4)
    ctx.save()
    ctx.translate(12, padT + plotH / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText('Pr (dBm)', 0, 0)
    ctx.restore()

    // ═══ 灵敏度门限线 ═══
    const sminY = y2px(S.smin)
    if (sminY >= padT && sminY <= padT + plotH) {
      ctx.strokeStyle = 'rgba(176,106,79,0.5)'
      ctx.lineWidth = 1
      ctx.setLineDash([6, 4])
      ctx.beginPath()
      ctx.moveTo(padL, sminY)
      ctx.lineTo(padL + plotW, sminY)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = 'rgba(176,106,79,0.7)'
      ctx.font = '9px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText('Pmin=' + S.smin, padL + plotW - 60, sminY - 4)
    }

    // ═══ Pr 曲线 ═══
    ctx.strokeStyle = '#b06a4f'
    ctx.lineWidth = 2
    ctx.beginPath()
    let started = false
    for (let i = 0; i <= samples; i++) {
      const logR = rMinLog + (i / samples) * rRange
      const R = Math.pow(10, logR)
      const Pr = this.prAtR(R, S)
      if (!isFinite(Pr) || Pr <= -200) continue
      const px = x2px(logR)
      const py = y2px(Pr)
      if (!started) { ctx.moveTo(px, py); started = true }
      else ctx.lineTo(px, py)
    }
    ctx.stroke()

    // 曲线下方填充（链路可达区域）
    ctx.lineTo(x2px(rMaxLog), padT + plotH)
    ctx.lineTo(x2px(rMinLog), padT + plotH)
    ctx.closePath()
    ctx.fillStyle = 'rgba(176,106,79,0.06)'
    ctx.fill()

    // ═══ 当前距离标记 ═══
    const curLogR = S.rExp
    if (curLogR >= rMinLog && curLogR <= rMaxLog) {
      const cx = x2px(curLogR)
      const curR = Math.pow(10, curLogR)
      const curPr = this.prAtR(curR, S)

      // 垂直辅助线
      ctx.strokeStyle = 'rgba(32,32,28,0.2)'
      ctx.lineWidth = 0.8
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(cx, padT)
      ctx.lineTo(cx, padT + plotH)
      ctx.stroke()
      ctx.setLineDash([])

      // 标记点
      if (isFinite(curPr) && curPr > -200) {
        const cy = y2px(curPr)
        ctx.fillStyle = '#b06a4f'
        ctx.beginPath()
        ctx.arc(cx, cy, 5, 0, 2 * Math.PI)
        ctx.fill()
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 1.5
        ctx.stroke()

        // 标签
        ctx.fillStyle = '#20201c'
        ctx.font = 'bold 10px sans-serif'
        ctx.textAlign = 'left'
        const labelX = cx + 8 > padL + plotW - 70 ? cx - 68 : cx + 8
        ctx.fillText(curPr.toFixed(1) + ' dBm', labelX, cy - 6)
      }
    }

    // ═══ 模式标注 ═══
    ctx.fillStyle = 'rgba(155,147,132,0.5)'
    ctx.font = '9px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(S.mode === 'friis' ? 'Friis (1/R²)' : 'Radar (1/R⁴)', padL + plotW - 4, padT + 12)
  },
})

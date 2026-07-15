// pages/interactive/broadband-matching/broadband-matching.js —— 宽带匹配
// 核心（教学模型）：
//   Z(f) = R + j*R*Q*(f/f0 - f0/f)
//   Γ = (Z - Z0)/(Z + Z0), RL = -20*log10|Γ|
//   天线类型影响 R 和 Q → 影响带宽
//   匹配方式调整阻抗变化速率

const haptic = require('../../../utils/haptic')
const Z0 = 50

Page({
  data: {
    S: { ant: 'thin', match: 'none', thick: 0.25, span: 0.55 },
    stats: null,
  },

  onLoad() { this.update() },
  onReady() { this.update() },

  onThick(e) { this.setData({ 'S.thick': e.detail.value }, () => this.update()) },
  onSpan(e)  { this.setData({ 'S.span': e.detail.value }, () => this.update()) },

  setThin()   { haptic.light(); this.setData({ 'S.ant': 'thin' },   () => this.update()) },
  setThick()  { haptic.light(); this.setData({ 'S.ant': 'thick' },  () => this.update()) },
  setFolded() { haptic.light(); this.setData({ 'S.ant': 'folded' }, () => this.update()) },
  setBicone() { haptic.light(); this.setData({ 'S.ant': 'bicone' }, () => this.update()) },

  setNoMatch(){ haptic.light(); this.setData({ 'S.match': 'none' },  () => this.update()) },
  setLMatch() { haptic.light(); this.setData({ 'S.match': 'l' },     () => this.update()) },
  setTaper()  { haptic.light(); this.setData({ 'S.match': 'taper' }, () => this.update()) },

  // ═══ 阻抗模型 ═══
  model(x) {
    const S = this.data.S
    let R = 73, Q = 8.5
    if (S.ant === 'thick')   { R = 68; Q = 5.2 - 2.4 * S.thick }
    if (S.ant === 'folded')  { R = 292; Q = 5.2 - 1.2 * S.thick }
    if (S.ant === 'bicone')  { R = 55 + 25 * (1 - S.thick); Q = 2.0 - 0.8 * S.thick }
    if (S.ant === 'thin')    { Q = 9.5 - 2 * S.thick }

    let X = R * Q * (x - 1 / x)
    if (S.match === 'l') {
      X *= Math.abs(x - 1) * 1.8
      R = Z0 + (R - Z0) * (0.25 + Math.abs(x - 1) * 1.2)
    }
    if (S.match === 'taper') {
      X *= 0.38
      R = Z0 + (R - Z0) * 0.22
      Q *= 0.45
    }
    return { R: Math.max(5, R), X, Q }
  },

  gamma(z) {
    const a = z.R - Z0, b = z.X
    const c = z.R + Z0, d = z.X
    const den = c * c + d * d
    return [(a * c + b * d) / den, (b * c - a * d) / den]
  },

  rl(z) {
    const g = this.gamma(z)
    return -20 * Math.log10(Math.max(1e-4, Math.hypot(g[0], g[1])))
  },

  sweep() {
    const S = this.data.S
    const lo = 1 - S.span, hi = 1 + S.span
    const pts = []
    for (let i = 0; i <= 360; i++) {
      const x = lo + (hi - lo) * i / 360
      const z = this.model(x)
      pts.push({ x, z, rl: this.rl(z), g: this.gamma(z) })
    }
    return pts
  },

  // ═══ 更新 ═══
  update() {
    const pts = this.sweep()

    // 带宽统计
    const inBand = pts.filter(p => p.rl >= 10)
    let bw = 0
    if (inBand.length) bw = inBand[inBand.length - 1].x - inBand[0].x
    const minrl = Math.max(...pts.map(p => p.rl))
    const qv = this.model(1).Q

    this.setData({
      stats: {
        bw: bw ? Math.round(bw * 100) + '%' : '<1%',
        minrl: minrl.toFixed(1),
        qv: qv.toFixed(1),
      }
    })

    this._pts = pts
    this.drawRL()
    this.drawSmith()
  },

  // ═══ 绘 RL ═══
  drawRL() {
    this._queryCanvas('#rlCanvas', (ctx, w, h) => {
      const pts = this._pts
      ctx.clearRect(0, 0, w, h)
      const padL = 42, padR = 16, padT = 12, padB = 32
      const plotW = w - padL - padR, plotH = h - padT - padB
      const rlMax = 45

      const x2px = (i) => padL + i * plotW / (pts.length - 1)
      const y2px = (rl) => padT + padH_2rl(rl, plotH, padT, padB)
      function padH_2rl(rl, ph, pT, pB) {
        return (1 - Math.min(45, rl) / 45) * (ph)
      }
      const yPx = (rl) => h - padB - (Math.min(45, rl) / 45) * plotH

      // 网格
      ctx.strokeStyle = 'rgba(155,147,132,0.12)'
      ctx.lineWidth = 0.5
      ctx.font = '9px sans-serif'
      ctx.fillStyle = 'rgba(155,147,132,0.6)'
      ctx.textAlign = 'right'
      for (let yv = 0; yv <= 40; yv += 10) {
        const py = h - padB - yv / 45 * plotH
        ctx.beginPath()
        ctx.moveTo(padL, py)
        ctx.lineTo(padL + plotW, py)
        ctx.stroke()
        ctx.fillText(yv + 'dB', padL - 4, py + 3)
      }

      // -10dB 门限线
      ctx.strokeStyle = 'rgba(122,145,129,0.5)'
      ctx.lineWidth = 0.8
      ctx.setLineDash([6, 5])
      const y10 = h - padB - 10 / 45 * plotH
      ctx.beginPath()
      ctx.moveTo(padL, y10)
      ctx.lineTo(padL + plotW, y10)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.textAlign = 'left'
      ctx.fillText('-10dB', padL + 4, y10 - 3)

      // 曲线
      ctx.strokeStyle = '#b06a4f'
      ctx.lineWidth = 2.2
      ctx.beginPath()
      pts.forEach((p, i) => {
        const px = x2px(i)
        const py = yPx(p.rl)
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      })
      ctx.stroke()

      // 填充（RL > 10dB 的区域）
      ctx.beginPath()
      pts.forEach((p, i) => {
        const px = x2px(i)
        const py = yPx(p.rl)
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      })
      ctx.lineTo(x2px(pts.length - 1), h - padB)
      ctx.lineTo(x2px(0), h - padB)
      ctx.closePath()
      ctx.fillStyle = 'rgba(176,106,79,0.06)'
      ctx.fill()

      // x 轴标注
      ctx.fillStyle = 'rgba(155,147,132,0.6)'
      ctx.font = '9px sans-serif'
      ctx.textAlign = 'center'
      const lo = pts[0].x, hi = pts[pts.length - 1].x
      ctx.fillText(lo.toFixed(2), padL, h - padB + 14)
      ctx.fillText('1.0', padL + plotW / 2, h - padB + 14)
      ctx.fillText(hi.toFixed(2), padL + plotW, h - padB + 14)
      ctx.fillText('f / f₀', padL + plotW / 2, h - 4)
    })
  },

  // ═══ 绘 Smith 轨迹 ═══
  drawSmith() {
    this._queryCanvas('#smithCanvas', (ctx, w, h) => {
      const pts = this._pts
      ctx.clearRect(0, 0, w, h)
      const R = Math.min(w, h) * 0.36
      const cx = w / 2, cy = h / 2 + 8

      // 外圆
      ctx.strokeStyle = 'rgba(155,147,132,0.3)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, 2 * Math.PI)
      ctx.stroke()

      // 等电阻圆
      ctx.strokeStyle = 'rgba(176,106,79,0.15)'
      ctx.lineWidth = 0.5
      for (const rr of [0.2, 0.5, 1, 2, 5]) {
        const cr = R / (rr + 1)
        const ccx = cx + R * rr / (rr + 1)
        ctx.beginPath()
        ctx.arc(ccx, cy, cr, 0, 2 * Math.PI)
        ctx.stroke()
      }

      // 实轴
      ctx.strokeStyle = 'rgba(155,147,132,0.2)'
      ctx.beginPath()
      ctx.moveTo(cx - R, cy)
      ctx.lineTo(cx + R, cy)
      ctx.stroke()

      // 匹配点（圆心）
      ctx.fillStyle = 'rgba(176,106,79,0.5)'
      ctx.beginPath()
      ctx.arc(cx, cy, 3, 0, 2 * Math.PI)
      ctx.fill()

      // 阻抗轨迹
      ctx.strokeStyle = '#b06a4f'
      ctx.lineWidth = 2
      ctx.beginPath()
      pts.forEach((p, i) => {
        const px = cx + p.g[0] * R
        const py = cy - p.g[1] * R
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      })
      ctx.stroke()

      // 中心频点标记
      const mid = pts[Math.floor(pts.length / 2)]
      ctx.fillStyle = '#7a9181'
      ctx.beginPath()
      ctx.arc(cx + mid.g[0] * R, cy - mid.g[1] * R, 5, 0, 2 * Math.PI)
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // 标注
      ctx.fillStyle = 'rgba(155,147,132,0.5)'
      ctx.font = '9px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Γ 平面', cx, cy + R + 18)
    })
  },

  // ═══ Canvas 工具 ═══
  _queryCanvas(id, callback) {
    const query = wx.createSelectorQuery()
    query.select(id)
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0]) return
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const dpr = wx.getWindowInfo().pixelRatio
        const w = res[0].width, h = res[0].height
        canvas.width = w * dpr
        canvas.height = h * dpr
        ctx.scale(dpr, dpr)
        callback(ctx, w, h)
      })
  },
})

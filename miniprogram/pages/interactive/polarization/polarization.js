// pages/interactive/polarization/polarization.js —— 极化椭圆（2D 降维）
// 核心：
//   E(z,t) = x̂ Ex cos(ωt−βz) + ŷ Ey cos(ωt−βz+δ)
//   倾角 ψ = ½ arctan(2ExEy cosδ / (Ex²−Ey²))
//   sin2χ = 2ExEy sinδ / (Ex²+Ey²)  → χ = ½arcsin(sin2χ)
//   轴比 AR = 1/|tan χ|
//   δ=0/180 线极化，Ex=Ey 且 δ=±90 圆极化

const haptic = require('../../../utils/haptic')

Page({
  data: {
    S: { ex: 1, ey: 0.55, del: 0, preset: 'linear' },
    params: null,
  },

  _t: 0,

  onLoad() {
    this.computeParams()
    this.drawEllipse()
  },

  onReady() {
    this._startAnim()
  },

  onUnload() {
    this._stopAnim()
  },

  onHide() {
    this._stopAnim()
  },

  // ═══ 参数 ═══
  onEx(e)  { this.setData({ 'S.ex': e.detail.value, 'S.preset': '' }, () => this._updateStatic()) },
  onEy(e)  { this.setData({ 'S.ey': e.detail.value, 'S.preset': '' }, () => this._updateStatic()) },
  onDel(e) { this.setData({ 'S.del': e.detail.value, 'S.preset': '' }, () => this._updateStatic()) },

  setLinear()  { haptic.light(); this.setData({ 'S': { ex: 1, ey: 0.55, del: 0, preset: 'linear' } },  () => this._updateStatic()) },
  setRHCP()    { haptic.light(); this.setData({ 'S': { ex: 1, ey: 1, del: -90, preset: 'rhcp' } },     () => this._updateStatic()) },
  setLHCP()    { haptic.light(); this.setData({ 'S': { ex: 1, ey: 1, del: 90, preset: 'lhcp' } },      () => this._updateStatic()) },
  setEllipse() { haptic.light(); this.setData({ 'S': { ex: 1, ey: 0.55, del: 70, preset: 'ellipse' } },() => this._updateStatic()) },

  _updateStatic() {
    this.computeParams()
    this.drawEllipse()
  },

  // ═══ 极化参数计算 ═══
  computeParams() {
    const { ex, ey, del } = this.data.S
    const d = del * Math.PI / 180
    const den = ex * ex + ey * ey || 1
    const psi = 0.5 * Math.atan2(2 * ex * ey * Math.cos(d), ex * ex - ey * ey)
    const sin2chi = 2 * ex * ey * Math.sin(d) / den
    const chi = 0.5 * Math.asin(Math.max(-1, Math.min(1, sin2chi)))
    const ratio = Math.abs(Math.tan(chi))
    const ar = ratio < 1e-3 ? Infinity : 1 / ratio

    let type = '椭圆'
    if (!Number.isFinite(ar) || ar > 30) type = '线极化'
    else if (ar < 1.08) type = '圆极化'

    const sense = Math.abs(del) < 3 || Math.abs(Math.abs(del) - 180) < 3 ? '无' : (del > 0 ? '左旋' : '右旋')

    this.setData({
      params: {
        type,
        ar: Number.isFinite(ar) ? ar.toFixed(2) : '∞',
        tilt: (psi * 180 / Math.PI).toFixed(0),
        sense,
      }
    })
  },

  // E 场分量
  E(z, t) {
    const ph = 2 * Math.PI * z - t
    return {
      x: this.data.S.ex * Math.cos(ph),
      y: this.data.S.ey * Math.cos(ph + this.data.S.del * Math.PI / 180)
    }
  },

  // ═══ 绘极化椭圆 ═══
  drawEllipse() {
    const query = wx.createSelectorQuery()
    query.select('#ellipseCanvas')
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
        this._drawEllipse(ctx, w, h)
      })
  },

  _drawEllipse(ctx, w, h) {
    const { ex, ey, del } = this.data.S
    ctx.clearRect(0, 0, w, h)
    const cx = w / 2, cy = h / 2
    const R = Math.min(w, h) * 0.36

    // 十字轴
    ctx.strokeStyle = 'rgba(155,147,132,0.2)'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(cx - R - 16, cy); ctx.lineTo(cx + R + 16, cy)
    ctx.moveTo(cx, cy - R - 16); ctx.lineTo(cx, cy + R + 16)
    ctx.stroke()

    // 标注
    ctx.fillStyle = 'rgba(176,106,79,0.6)'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('Ex', cx + R + 8, cy + 4)
    ctx.fillStyle = 'rgba(122,145,129,0.6)'
    ctx.fillText('Ey', cx + 4, cy - R - 8)

    // 椭圆轨迹
    ctx.strokeStyle = '#20201c'
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let i = 0; i <= 360; i++) {
      const t = i / 360 * Math.PI * 2
      const ex_ = ex * Math.cos(t)
      const ey_ = ey * Math.cos(t + del * Math.PI / 180)
      const px = cx + ex_ * R
      const py = cy - ey_ * R
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.stroke()
  },

  // ═══ 行波动画 ═══
  _startAnim() {
    this._stopAnim()
    const canvas = this._getWaveCanvas()
    if (!canvas) return
    this._animTimer = setInterval(() => {
      this._t += 0.18
      this.drawWave()
    }, 50)
  },

  _stopAnim() {
    if (this._animTimer) { clearInterval(this._animTimer); this._animTimer = null }
  },

  _getWaveCanvas() {
    return new Promise((resolve) => {
      const query = wx.createSelectorQuery()
      query.select('#waveCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0]) { resolve(null); return }
          const canvas = res[0].node
          const ctx = canvas.getContext('2d')
          const dpr = wx.getWindowInfo().pixelRatio
          const w = res[0].width, h = res[0].height
          if (canvas.width !== w * dpr) {
            canvas.width = w * dpr
            canvas.height = h * dpr
            ctx.scale(dpr, dpr)
          }
          resolve({ canvas, ctx, w, h })
        })
    })
  },

  async drawWave() {
    const info = await this._getWaveCanvas()
    if (!info) return
    const { ctx, w, h } = info
    const { ex, ey, del } = this.data.S

    ctx.clearRect(0, 0, w, h)

    const padL = 30, padR = 16, padT = 16, padB = 28
    const plotW = w - padL - padR
    const plotH = h - padT - padB
    const cy = padT + plotH / 2
    const amp = plotH * 0.35

    // 传播轴
    ctx.strokeStyle = 'rgba(155,147,132,0.2)'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(padL, cy)
    ctx.lineTo(padL + plotW, cy)
    ctx.stroke()

    // z 轴标注
    ctx.fillStyle = 'rgba(155,147,132,0.5)'
    ctx.font = '9px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText('z →', padL + plotW, cy + 14)

    const N = 200
    // Ex 波形（红）
    ctx.strokeStyle = '#b06a4f'
    ctx.lineWidth = 1.8
    ctx.beginPath()
    for (let i = 0; i <= N; i++) {
      const z = (i / N) * 2.5 // 0~2.5 λ
      const e = this.E(z, this._t)
      const px = padL + (z / 2.5) * plotW
      const py = cy - e.x * amp
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.stroke()

    // Ey 波形（绿）
    ctx.strokeStyle = '#7a9181'
    ctx.lineWidth = 1.8
    ctx.beginPath()
    for (let i = 0; i <= N; i++) {
      const z = (i / N) * 2.5
      const e = this.E(z, this._t)
      const px = padL + (z / 2.5) * plotW
      const py = cy - e.y * amp
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.stroke()

    // E 合矢量端点轨迹（深色）
    ctx.strokeStyle = 'rgba(32,32,28,0.7)'
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let i = 0; i <= N; i++) {
      const z = (i / N) * 2.5
      const e = this.E(z, this._t)
      // 将 E 矢量画在传播轴上，偏移表示
      const px = padL + (z / 2.5) * plotW
      const py = cy - (e.x + e.y) * amp * 0.5 // 混合投影
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.stroke()

    // 在几个采样点画 E 矢量箭头
    for (let k = 0; k < 13; k++) {
      const z = 0.15 + k * 0.2
      const e = this.E(z, this._t)
      const baseX = padL + (z / 2.5) * plotW
      const tipX = baseX
      const tipY = cy - (e.x + e.y) * amp * 0.5
      // 竖线
      ctx.strokeStyle = 'rgba(32,32,28,0.25)'
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.moveTo(baseX, cy)
      ctx.lineTo(tipX, tipY)
      ctx.stroke()
      // 端点
      ctx.fillStyle = '#b06a4f'
      ctx.beginPath()
      ctx.arc(tipX, tipY, 2, 0, 2 * Math.PI)
      ctx.fill()
    }

    // 图例
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillStyle = '#b06a4f'; ctx.fillText('Ex', padL + 4, padT + 10)
    ctx.fillStyle = '#7a9181'; ctx.fillText('Ey', padL + 24, padT + 10)
    ctx.fillStyle = 'rgba(32,32,28,0.7)'; ctx.fillText('E 合矢量', padL + 44, padT + 10)
  },
})

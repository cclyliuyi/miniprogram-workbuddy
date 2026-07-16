// pages/interactive/fourier-space-lab/fourier-space-lab.js —— 傅里叶空间实验室
// 4种模式：时频对偶 / 口径-方向图 / 阵列采样 / 不确定性
// 核心：sinc 函数、高斯函数、阵列因子

const haptic = require('../../../utils/haptic')

const LABELS = {
  signal: { left: '时间波形 x(t)', right: '频谱 |X(ω)|' },
  aperture: { left: '口径场分布 Ea(x)', right: '远场方向谱 |F(θ)|' },
  array: { left: '离散阵元采样 w[n]', right: '阵因子 |AF|' },
  uncertainty: { left: '空间波包 ψ(x)', right: '波数谱 |Ψ(k)|' },
}

Page({
  data: {
    S: { mode: 'signal', width: 46, spacing: 58, taper: 25 },
    leftLabel: LABELS.signal.left,
    rightLabel: LABELS.signal.right,
  },

  onLoad() { this.draw() },
  onReady() { this.draw() },

  // ═══ 事件 ═══
  onWidth(e) { this.setData({ 'S.width': e.detail.value }, () => this.draw()) },
  onSpacing(e) { this.setData({ 'S.spacing': e.detail.value }, () => this.draw()) },
  onTaper(e) { this.setData({ 'S.taper': e.detail.value }, () => this.draw()) },
  setSignal() { haptic.light(); this._setMode('signal') },
  setAperture() { haptic.light(); this._setMode('aperture') },
  setArray() { haptic.light(); this._setMode('array') },
  setUncertainty() { haptic.light(); this._setMode('uncertainty') },
  _setMode(m) {
    this.setData({ 'S.mode': m, leftLabel: LABELS[m].left, rightLabel: LABELS[m].right }, () => this.draw())
  },

  // ═══ 数学 ═══
  sinc(x) { return Math.abs(x) < 1e-4 ? 1 : Math.sin(x) / x },
  gauss(x, s) { return Math.exp(-(x * x) / (2 * s * s)) },

  arrayFactor(u, spacing, width, taper) {
    const d = spacing / 58
    const count = 13
    let re = 0, im = 0, norm = 0
    for (let n = 0; n < count; n++) {
      const p = n - (count - 1) / 2
      const ap = this.gauss(p / 6, width / 60) * (1 - taper + taper * Math.cos(Math.PI * p / (count - 1)) ** 2)
      const phase = Math.PI * d * p * u * 2.2
      re += ap * Math.cos(phase)
      im += ap * Math.sin(phase)
      norm += ap
    }
    return Math.sqrt(re * re + im * im) / Math.max(norm, 1e-6)
  },

  // ═══ Canvas ═══
  _queryCanvas(id, callback) {
    const q = wx.createSelectorQuery().in(this)
    q.select('#' + id).fields({ node: true, size: true }).exec((res) => {
      if (res && res[0] && res[0].node) {
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const dpr = wx.getWindowInfo().pixelRatio
        const w = res[0].width
        const h = res[0].height
        canvas.width = Math.max(1, Math.floor(w * dpr))
        canvas.height = Math.max(1, Math.floor(h * dpr))
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        callback(ctx, w, h)
      }
    })
  },

  _grid(ctx, x, y, w, h) {
    ctx.strokeStyle = 'rgba(148,163,184,0.13)'; ctx.lineWidth = 1
    for (let i = 0; i <= 8; i++) {
      const gx = x + w * i / 8
      ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); ctx.stroke()
    }
    for (let i = 0; i <= 4; i++) {
      const gy = y + h * i / 4
      ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(148,163,184,0.35)'
    ctx.beginPath(); ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2); ctx.stroke()
  },

  _plot(ctx, x, y, w, h, fn, color, fill) {
    const N = 200
    ctx.beginPath()
    for (let i = 0; i < N; i++) {
      const u = -1 + 2 * i / (N - 1)
      const v = fn(u)
      const px = x + (i / (N - 1)) * w
      const py = y + h / 2 - v * h * 0.42
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
    }
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.stroke()
    if (fill) {
      ctx.lineTo(x + w, y + h / 2); ctx.lineTo(x, y + h / 2); ctx.closePath()
      ctx.fillStyle = color.replace('1)', '0.1)'); ctx.fill()
    }
  },

  draw() {
    const S = this.data.S
    const width = S.width, spacing = S.spacing, taper = S.taper / 100

    this._queryCanvas('leftCanvas', (ctx, w, h) => {
      ctx.fillStyle = '#0a0c16'; ctx.fillRect(0, 0, w, h)
      const pad = 24
      const cw = w - pad * 2, ch = h - pad * 2 - 20

      this._grid(ctx, pad, pad, cw, ch)

      if (S.mode === 'signal') {
        const sigma = width / 100
        this._plot(ctx, pad, pad, cw, ch, u => this.gauss(u, sigma) * 0.92, 'rgba(100,181,255,1)', true)
      } else if (S.mode === 'aperture') {
        const ap = width / 88
        this._plot(ctx, pad, pad, cw, ch, u => Math.abs(u) < ap ? 0.82 * (1 - taper + taper * Math.cos(Math.PI * u / (2 * ap)) ** 2) : 0, 'rgba(112,226,163,1)', true)
      } else if (S.mode === 'array') {
        // 采样点
        const count = Math.max(4, Math.floor(cw / spacing))
        const start = pad + (cw - spacing * (count - 1)) / 2
        for (let i = 0; i < count; i++) {
          const px = start + i * spacing
          const pos = (i - (count - 1) / 2) / ((count - 1) / 2)
          const env = this.gauss(pos, width / 55) * (1 - 0.55 * taper + 0.55 * taper * Math.cos(Math.PI * pos / 2) ** 2)
          const py = pad + ch / 2 - env * ch * 0.36
          ctx.strokeStyle = 'rgba(255,209,102,0.85)'; ctx.lineWidth = 2
          ctx.beginPath(); ctx.moveTo(px, pad + ch / 2); ctx.lineTo(px, py); ctx.stroke()
          ctx.fillStyle = '#70e2a3'
          ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill()
        }
      } else if (S.mode === 'uncertainty') {
        const sx = width / 120
        this._plot(ctx, pad, pad, cw, ch, u => this.gauss(u, sx) * 0.86, 'rgba(100,181,255,0.95)', false)
        this._plot(ctx, pad, pad, cw, ch, u => this.gauss(u, sx) * Math.cos(18 * u) * 0.86, 'rgba(110,231,249,1)', false)
      }
    })

    this._queryCanvas('rightCanvas', (ctx, w, h) => {
      ctx.fillStyle = '#0a0c16'; ctx.fillRect(0, 0, w, h)
      const pad = 24
      const cw = w - pad * 2, ch = h - pad * 2 - 20

      this._grid(ctx, pad, pad, cw, ch)

      if (S.mode === 'signal') {
        const sigma = width / 100
        this._plot(ctx, pad, pad, cw, ch, u => this.gauss(u, 0.18 / sigma) * 0.92, 'rgba(255,209,102,1)', true)
      } else if (S.mode === 'aperture') {
        const ap = width / 88
        this._plot(ctx, pad, pad, cw, ch, u => {
          const main = Math.abs(this.sinc(8 * ap * u))
          const tapered = Math.exp(-Math.abs(u) * taper * 2.2)
          return Math.min(1, main * tapered) * 0.95
        }, 'rgba(100,181,255,1)', true)
      } else if (S.mode === 'array') {
        this._plot(ctx, pad, pad, cw, ch, u => this.arrayFactor(u * 1.25, spacing, width, taper), 'rgba(255,159,90,1)', true)
      } else if (S.mode === 'uncertainty') {
        const sx = width / 120
        const sk = Math.max(0.08, 0.16 / sx)
        this._plot(ctx, pad, pad, cw, ch, u => this.gauss(u, sk) * 0.92, 'rgba(255,209,102,1)', true)
      }
    })
  },

  onShareAppMessage() {
    return { title: '傅里叶空间实验室', path: '/pages/interactive/fourier-space-lab/fourier-space-lab' }
  },
})

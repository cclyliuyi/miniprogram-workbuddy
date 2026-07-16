// pages/interactive/boundary-mode-lab/boundary-mode-lab.js —— 边界模式格林函数实验室
// 4种模式：边界条件 / 模式筛选 / 格林函数叠加 / 对称性约束
// 热图：heatColor(v) → green(正) / blue(负)

const haptic = require('../../../utils/haptic')

const MODE_INFO = {
  boundary: { label: '边界条件：哪些场被允许，哪些被禁止', note: '边界不是几何装饰，它决定场能否存在以及如何辐射。红边=切向E被金属禁止。' },
  mode: { label: '模式筛选：边界决定允许的本征形态', note: '模式是边界筛选出来的允许波形，不是随手画出的花纹。改变m/n查看不同模式。' },
  green: { label: '格林函数：点源响应叠加成复杂场', note: '格林函数是点源响应；辐射积分和矩量法都在做响应叠加。' },
  symmetry: { label: '对称性：先预测，再计算', note: '镜面对称会约束场分布和方向图零点。先问对称性，再动手计算。' },
}

Page({
  data: {
    S: { mode: 'boundary', m: 2, n: 1, source: 34 },
    modeLabel: MODE_INFO.boundary.label,
    noteText: MODE_INFO.boundary.note,
  },

  _t: 0,
  _timer: null,

  onLoad() { this.draw() },
  onReady() { this.draw() },
  onShow() { this._startAnim() },
  onHide() { this._stopAnim() },
  onUnload() { this._stopAnim() },

  _startAnim() {
    if (this._timer) return
    this._timer = setInterval(() => {
      this._t += 0.05
      if (this.data.S.mode === 'green') this.draw()
    }, 60)
  },
  _stopAnim() { if (this._timer) { clearInterval(this._timer); this._timer = null } },

  // ═══ 事件 ═══
  onM(e) { this.setData({ 'S.m': e.detail.value }, () => this.draw()) },
  onN(e) { this.setData({ 'S.n': e.detail.value }, () => this.draw()) },
  onSource(e) { this.setData({ 'S.source': e.detail.value }, () => this.draw()) },
  setBoundary() { haptic.light(); this._setMode('boundary') },
  setMode() { haptic.light(); this._setMode('mode') },
  setGreen() { haptic.light(); this._setMode('green') },
  setSymmetry() { haptic.light(); this._setMode('symmetry') },
  _setMode(m) {
    this.setData({ 'S.mode': m, modeLabel: MODE_INFO[m].label, noteText: MODE_INFO[m].note }, () => this.draw())
  },

  // ═══ 热图配色 ═══
  heatColor(v) {
    const a = Math.min(1, Math.abs(v))
    if (v >= 0) return 'rgba(101,228,177,' + (0.08 + 0.72 * a) + ')'
    return 'rgba(124,160,255,' + (0.08 + 0.72 * a) + ')'
  },

  // ═══ Canvas ═══
  _queryCanvas(callback) {
    const q = wx.createSelectorQuery().in(this)
    q.select('#fieldCanvas').fields({ node: true, size: true }).exec((res) => {
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

  _drawFieldBox(ctx, x, y, w, h, fn) {
    const cols = 30, rows = 24
    const cw = w / cols, ch = h / rows
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const u = (i + 0.5) / cols, q = (j + 0.5) / rows
        const val = fn(u, q)
        ctx.fillStyle = this.heatColor(val)
        ctx.fillRect(x + u * w - cw / 2, y + q * h - ch / 2, cw + 1, ch + 1)
      }
    }
    ctx.strokeStyle = '#edf3ff'; ctx.lineWidth = 1.5
    ctx.strokeRect(x, y, w, h)
  },

  draw() {
    this._queryCanvas((ctx, w, h) => {
      const S = this.data.S
      ctx.fillStyle = '#080d14'; ctx.fillRect(0, 0, w, h)

      const fx = 40, fy = 30, fw = w - 80, fh = h - 60

      if (S.mode === 'boundary') {
        this._drawFieldBox(ctx, fx, fy, fw, fh, (u, q) => Math.sin(Math.PI * u) * Math.sin(Math.PI * q))
        // 红色边界（上下）
        ctx.strokeStyle = '#ff7a90'; ctx.lineWidth = 4
        ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + fw, fy); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(fx, fy + fh); ctx.lineTo(fx + fw, fy + fh); ctx.stroke()
      } else if (S.mode === 'mode') {
        this._drawFieldBox(ctx, fx, fy, fw, fh, (u, q) => Math.sin(S.m * Math.PI * u) * Math.sin(S.n * Math.PI * q))
        ctx.fillStyle = '#ffd166'; ctx.font = '13px sans-serif'; ctx.textAlign = 'left'
        ctx.fillText('E 模式 m=' + S.m + ', n=' + S.n, fx, fy + fh + 22)
      } else if (S.mode === 'green') {
        const src = S.source / 100
        const sources = [
          { x: src, y: 0.45, a: 1 },
          { x: 1 - src, y: 0.56, a: 0.78 },
          { x: 0.5, y: 0.32, a: -0.62 },
        ]
        this._drawFieldBox(ctx, fx, fy, fw, fh, (u, q) => {
          let sum = 0
          for (const s of sources) {
            const r = Math.hypot(u - s.x, q - s.y) + 0.025
            sum += s.a * Math.cos(34 * r - this._t * 2.2) / (1 + 8 * r)
          }
          return sum
        })
        // 点源标记
        sources.forEach(s => {
          ctx.fillStyle = s.a > 0 ? '#ffd166' : '#ff7a90'
          ctx.beginPath(); ctx.arc(fx + s.x * fw, fy + s.y * fh, 7, 0, Math.PI * 2); ctx.fill()
        })
      } else if (S.mode === 'symmetry') {
        this._drawFieldBox(ctx, fx, fy, fw, fh, (u, q) => {
          const left = Math.sin(S.m * Math.PI * u) * Math.sin(S.n * Math.PI * q)
          const right = Math.sin(S.m * Math.PI * (1 - u)) * Math.sin(S.n * Math.PI * q)
          return (left + right) / 2
        })
        // 对称轴
        ctx.setLineDash([6, 6]); ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(fx + fw / 2, fy); ctx.lineTo(fx + fw / 2, fy + fh); ctx.stroke()
        ctx.setLineDash([])
      }
    })
  },

  onShareAppMessage() {
    return { title: '边界模式格林函数实验室', path: '/pages/interactive/boundary-mode-lab/boundary-mode-lab' }
  },
})

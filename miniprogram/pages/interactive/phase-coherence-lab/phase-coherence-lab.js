// pages/interactive/phase-coherence-lab/phase-coherence-lab.js —— 相位相干实验室
// 3种模式：相量叠加 / 阵列扫描 / 等光程聚焦
// 核心公式：AF(θ) = |Σ e^{j(n·kd·sinθ + n·β)}| / N

const haptic = require('../../../utils/haptic')

const MODE_INFO = {
  phasor: { label: '相量叠加：同相增强，反相相消', note: '观察合成相量长度：相位差越接近 0，多个贡献越容易同相增强。' },
  array: { label: '阵列扫描：渐进相位补偿路径差', note: '阵列主瓣不是被机械转过去的，而是由渐进相位选择了相干方向。' },
  focus: { label: '等光程聚焦：相位误差降低峰值增益', note: '反射面和喇叭口径都需要控制相位误差，否则主瓣峰值会下降。' },
}

Page({
  data: {
    S: { mode: 'phasor', phase: 45, spacing: 55, count: 6 },
    modeLabel: MODE_INFO.phasor.label,
    noteText: MODE_INFO.phasor.note,
  },

  onLoad() { this.draw() },
  onReady() { this.draw() },

  // ═══ 事件 ═══
  onPhase(e) { this.setData({ 'S.phase': e.detail.value }, () => this.draw()) },
  onSpacing(e) { this.setData({ 'S.spacing': e.detail.value }, () => this.draw()) },
  onCount(e) { this.setData({ 'S.count': e.detail.value }, () => this.draw()) },
  setPhasor() { haptic.light(); this._setMode('phasor') },
  setArray() { haptic.light(); this._setMode('array') },
  setFocus() { haptic.light(); this._setMode('focus') },
  _setMode(m) {
    this.setData({ 'S.mode': m, modeLabel: MODE_INFO[m].label, noteText: MODE_INFO[m].note }, () => this.draw())
  },

  // ═══ 数学 ═══
  vals() {
    const S = this.data.S
    return {
      beta: S.phase * Math.PI / 180,
      betaDeg: S.phase,
      d: S.spacing / 100,
      n: S.count,
    }
  },

  arrayFactor(theta, n, d, beta) {
    let re = 0, im = 0
    for (let i = 0; i < n; i++) {
      const psi = 2 * Math.PI * d * i * Math.sin(theta) + i * beta
      re += Math.cos(psi); im += Math.sin(psi)
    }
    return Math.sqrt(re * re + im * im) / n
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

  _line(ctx, x1, y1, x2, y2, color, width) {
    ctx.strokeStyle = color; ctx.lineWidth = width || 1
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
  },

  draw() {
    const v = this.vals()
    const mode = this.data.S.mode

    // 主画布
    this._queryCanvas('mainCanvas', (ctx, w, h) => {
      ctx.fillStyle = '#090d16'; ctx.fillRect(0, 0, w, h)

      if (mode === 'phasor') {
        const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.32
        // 参考圆
        ctx.strokeStyle = '#253044'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
        // 相量链
        let x = cx, y = cy
        const step = Math.min(34, r * 0.3)
        for (let i = 0; i < v.n; i++) {
          const a = i * v.beta
          const nx = x + step * Math.cos(a)
          const ny = y - step * Math.sin(a)
          this._line(ctx, x, y, nx, ny, i % 2 ? '#7ca0ff' : '#65e4b1', 3)
          ctx.fillStyle = '#edf3ff'; ctx.beginPath(); ctx.arc(nx, ny, 3, 0, Math.PI * 2); ctx.fill()
          x = nx; y = ny
        }
        // 合成相量
        this._line(ctx, cx, cy, x, y, '#ffd166', 4)
        ctx.fillStyle = '#ffd166'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'
        const mag = Math.hypot(x - cx, y - cy) / (step * v.n)
        ctx.fillText('归一化幅度 ' + mag.toFixed(2), cx, h - 16)
      } else if (mode === 'array') {
        const baseY = h * 0.45, startX = 50, dx = (w - 100) / Math.max(1, v.n - 1)
        for (let i = 0; i < v.n; i++) {
          const px = startX + i * dx
          ctx.fillStyle = '#65e4b1'; ctx.beginPath(); ctx.arc(px, baseY, 7, 0, Math.PI * 2); ctx.fill()
          // 相位箭头
          const a = i * v.beta
          this._line(ctx, px, baseY - 20, px + 28 * Math.cos(a), baseY - 20 - 28 * Math.sin(a), '#ffd166', 3)
          // 波纹弧
          for (let k = 0; k < 3; k++) {
            ctx.strokeStyle = 'rgba(124,160,255,' + (0.14 + k * 0.09) + ')'
            ctx.beginPath(); ctx.arc(px, baseY, 36 + k * 30, -Math.PI * 0.86, -Math.PI * 0.14); ctx.stroke()
          }
        }
      } else if (mode === 'focus') {
        const focus = { x: w / 2, y: 50 }
        const baseY = h - 60, startX = 40, dx = (w - 80) / Math.max(1, v.n - 1)
        // 焦点
        ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(focus.x, focus.y, 8, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#ffd166'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left'
        ctx.fillText('焦点', focus.x + 12, focus.y + 5)
        // 源
        for (let i = 0; i < v.n; i++) {
          const px = startX + i * dx
          const error = Math.sin(i * 1.7) * v.betaDeg / 180 * 30
          ctx.fillStyle = '#65e4b1'; ctx.fillRect(px - 10, baseY + error, 20, 8)
          this._line(ctx, px, baseY + error, focus.x, focus.y, 'rgba(124,160,255,0.4)', 1.5)
        }
      }
    })

    // 方向图
    this._queryCanvas('patternCanvas', (ctx, w, h) => {
      ctx.fillStyle = '#090d16'; ctx.fillRect(0, 0, w, h)
      const ox = w / 2, oy = h - 30
      // 轴
      this._line(ctx, 20, oy, w - 20, oy, '#253044')
      this._line(ctx, ox, 20, ox, oy + 8, '#253044')
      // 方向图
      ctx.beginPath()
      for (let i = 0; i <= 240; i++) {
        const th = -Math.PI / 2 + Math.PI * i / 240
        const af = this.arrayFactor(th, v.n, v.d, v.beta)
        const px = ox + th / (Math.PI / 2) * (w * 0.42)
        const py = oy - af * (h * 0.72)
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
      }
      ctx.strokeStyle = '#65e4b1'; ctx.lineWidth = 2.5; ctx.stroke()

      // 预测主瓣角
      const steer = Math.asin(Math.max(-1, Math.min(1, -v.beta / (2 * Math.PI * v.d))))
      ctx.fillStyle = '#ffd166'; ctx.font = '12px sans-serif'; ctx.textAlign = 'left'
      ctx.fillText('预测主瓣角 ≈ ' + (steer * 180 / Math.PI).toFixed(1) + '°', 24, 20)
    })
  },

  onShareAppMessage() {
    return { title: '相位相干实验室', path: '/pages/interactive/phase-coherence-lab/phase-coherence-lab' }
  },
})

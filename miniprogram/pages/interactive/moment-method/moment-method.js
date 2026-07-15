// pages/interactive/moment-method/moment-method.js —— 矩量法（教学版）
// 核心（教学简化）：
//   细线分段电流：近似正弦分布 I(z) ≈ sin(π(1-|z|/L))
//   阻抗矩阵：Zmn ≈ Δz/√((zm-zn)²+a²), 自项 Znn ≈ ln(2Δz/a)
//   远场：AF(θ) = Σ In e^{j2πzₙcosθ} × sinθ
//   输入阻抗：近似公式

const haptic = require('../../../utils/haptic')

Page({
  data: {
    S: { N: 17, L: 0.5, a: 0.006, load: 'none' },
    stats: null,
  },

  onLoad() { this.update() },
  onReady() { this.update() },

  onN(e) { this.setData({ 'S.N': e.detail.value }, () => this.update()) },
  onL(e) { this.setData({ 'S.L': e.detail.value }, () => this.update()) },
  onA(e) { this.setData({ 'S.a': e.detail.value }, () => this.update()) },

  setNone() { haptic.light(); this.setData({ 'S.load': 'none' }, () => this.update()) },
  setTip()  { haptic.light(); this.setData({ 'S.load': 'tip' }, () => this.update()) },
  setLoss() { haptic.light(); this.setData({ 'S.load': 'loss' }, () => this.update()) },

  // ═══ 求解 ═══
  solve() {
    const S = this.data.S
    const N = Math.round(S.N)
    const dz = S.L / N
    const z = [], I = [], Z = []

    for (let i = 0; i < N; i++) z.push(-S.L / 2 + (i + 0.5) * dz)

    for (let i = 0; i < N; i++) {
      const x = Math.abs(z[i]) / (S.L / 2)
      let amp = Math.sin(Math.PI * (1 - x))
      if (S.load === 'tip') amp = 0.55 * amp + 0.45
      if (S.load === 'loss') amp *= Math.exp(-1.5 * x)
      I.push(amp)
    }

    const maxI = Math.max(...I)
    for (let i = 0; i < N; i++) I[i] /= maxI || 1

    for (let i = 0; i < N; i++) {
      Z[i] = []
      for (let j = 0; j < N; j++) {
        const r = Math.sqrt((z[i] - z[j]) ** 2 + S.a * S.a)
        let v = dz / r
        if (i === j) v = Math.log(2 * dz / S.a)
        Z[i][j] = v
      }
    }

    const zin = 45 + 38 * (S.L - 0.5) + 120 * S.a + (S.load === 'loss' ? 18 : 0)
    const xin = 42 * Math.tan(Math.PI * (S.L - 0.48))

    return { z, I, Z, dz, zin, xin }
  },

  far(theta, sol) {
    let re = 0, im = 0
    const N = this.data.S.N
    for (let i = 0; i < N; i++) {
      const ph = 2 * Math.PI * sol.z[i] * Math.cos(theta)
      re += sol.I[i] * Math.cos(ph)
      im += sol.I[i] * Math.sin(ph)
    }
    return Math.abs(Math.sin(theta)) * Math.hypot(re, im)
  },

  pattern(sol) {
    const arr = [], N = 360
    let m = 0, mi = 0
    for (let i = 0; i <= N; i++) {
      const th = i / N * Math.PI
      const v = this.far(th, sol)
      arr.push(v)
      if (v > m) { m = v; mi = i }
    }
    return { arr: arr.map(v => v / (m || 1)), mi }
  },

  // ═══ 更新 ═══
  update() {
    const sol = this.solve()
    const p = this.pattern(sol)
    const flatZ = sol.Z.flat ? sol.Z.flat() : [].concat(...sol.Z)
    const maxZ = Math.max(...flatZ)
    const minZ = Math.min(...flatZ)
    const cond = maxZ / (minZ || 1e-10)

    // HPBW
    const half = Math.pow(10, -3 / 20)
    let l = p.mi, r = p.mi
    while (l > 0 && p.arr[l] > half) l--
    while (r < p.arr.length - 1 && p.arr[r] > half) r++
    const hpbw = (r - l) * 0.5

    this.setData({
      stats: {
        zin: sol.zin.toFixed(0) + (sol.xin >= 0 ? '+j' : '-j') + Math.abs(sol.xin).toFixed(0) + 'Ω',
        cond: cond.toFixed(1),
        imax: '1.00',
        hpbw: hpbw.toFixed(1),
      }
    })
    this._sol = sol
    this._pattern = p
    this._maxZ = maxZ
    this.drawCurrent()
    this.drawMatrix()
    this.drawPattern()
  },

  // ═══ 绘电流 ═══
  drawCurrent() {
    this._queryCanvas('#currentCanvas', (ctx, w, h) => {
      const sol = this._sol
      ctx.clearRect(0, 0, w, h)
      const padL = 30, padR = 20, padT = 12, padB = 32
      const plotW = w - padL - padR, plotH = h - padT - padB
      const cy = padT + plotH * 0.65
      const N = sol.I.length
      const bw = plotW / N

      // 基线
      ctx.strokeStyle = 'rgba(155,147,132,0.2)'
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(padL, cy)
      ctx.lineTo(padL + plotW, cy)
      ctx.stroke()

      // 柱
      for (let i = 0; i < N; i++) {
        const x = padL + i * bw + bw * 0.15
        const bh = sol.I[i] * plotH * 0.45
        const barW = bw * 0.7
        const grad = ctx.createLinearGradient(0, cy - bh, 0, cy)
        grad.addColorStop(0, 'rgba(176,106,79,0.8)')
        grad.addColorStop(1, 'rgba(176,106,79,0.3)')
        ctx.fillStyle = grad
        ctx.fillRect(x, cy - bh, barW, bh)

        // 馈电段标记
        if (i === Math.floor(N / 2)) {
          ctx.fillStyle = '#7a9181'
          ctx.beginPath()
          ctx.arc(x + barW / 2, cy + 6, 3, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // z 轴标注
      ctx.fillStyle = 'rgba(155,147,132,0.5)'
      ctx.font = '9px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('−L/2', padL + 10, cy + 18)
      ctx.fillText('0', padL + plotW / 2, cy + 18)
      ctx.fillText('+L/2', padL + plotW - 10, cy + 18)
    })
  },

  // ═══ 绘阻抗矩阵热图 ═══
  drawMatrix() {
    this._queryCanvas('#matrixCanvas', (ctx, w, h) => {
      const sol = this._sol
      const maxZ = this._maxZ
      ctx.clearRect(0, 0, w, h)
      const N = sol.Z.length
      const side = Math.min(w - 40, h - 40)
      const ox = (w - side) / 2, oy = (h - side) / 2

      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          const v = sol.Z[i][j] / maxZ
          // 蓝→白→红 热图配色（适配暖色系：低=鼠尾草，高=赤陶）
          const hue = 225 - 190 * Math.pow(v, 0.55)
          const light = 12 + 48 * Math.pow(v, 0.6)
          ctx.fillStyle = `hsl(${hue},75%,${light}%)`
          ctx.fillRect(ox + j * side / N, oy + i * side / N, side / N + 0.5, side / N + 0.5)
        }
      }

      // 边框
      ctx.strokeStyle = 'rgba(176,106,79,0.3)'
      ctx.lineWidth = 0.8
      ctx.strokeRect(ox, oy, side, side)

      // 标注
      ctx.fillStyle = 'rgba(155,147,132,0.5)'
      ctx.font = '9px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('m →', ox + side / 2, oy + side + 12)
      ctx.save()
      ctx.translate(ox - 8, oy + side / 2)
      ctx.rotate(-Math.PI / 2)
      ctx.fillText('n ↓', 0, 0)
      ctx.restore()
    })
  },

  // ═══ 绘方向图 ═══
  drawPattern() {
    this._queryCanvas('#patternCanvas', (ctx, w, h) => {
      const p = this._pattern
      ctx.clearRect(0, 0, w, h)
      const cx = w / 2, cy = h / 2
      const R = Math.min(w, h) * 0.34

      // 极坐标栅格
      ctx.strokeStyle = 'rgba(155,147,132,0.15)'
      ctx.lineWidth = 0.5
      for (const r of [0.25, 0.5, 0.75, 1]) {
        ctx.beginPath()
        ctx.arc(cx, cy, R * r, 0, 2 * Math.PI)
        ctx.stroke()
      }

      // 方向图曲线
      ctx.strokeStyle = '#b06a4f'
      ctx.lineWidth = 2
      ctx.beginPath()
      p.arr.forEach((v, i) => {
        const th = i / (p.arr.length - 1) * Math.PI
        const rr = v * R
        const xx = cx + rr * Math.sin(th)
        const yy = cy - rr * Math.cos(th)
        if (i === 0) ctx.moveTo(xx, yy)
        else ctx.lineTo(xx, yy)
      })
      // 镜像
      for (let i = p.arr.length - 1; i >= 0; i--) {
        const th = i / (p.arr.length - 1) * Math.PI
        const rr = p.arr[i] * R
        ctx.lineTo(cx - rr * Math.sin(th), cy - rr * Math.cos(th))
      }
      ctx.closePath()
      ctx.fillStyle = 'rgba(176,106,79,0.08)'
      ctx.fill()
      ctx.stroke()
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

// pages/interactive/radiation-integral/radiation-integral.js —— 辐射积分可视化
// 核心：
//   电流分布 I(z')：均匀/正弦/三角/余弦
//   辐射积分 F(θ) = ∫ I(z') e^{jkz'cosθ} dz'  （Simpson 数值积分）
//   方向图含 |sinθ| 元因子
//   积分路径动画：在复平面上矢量叠加采样点

const haptic = require('../../../utils/haptic')

Page({
  data: {
    S: { L: 0.5, taper: 'sin', theta: 90 },
    stats: null,
  },

  _animPhase: 0,
  _animRunning: true,
  _timer: null,

  onLoad() { this.update() },
  onReady() { this.update() },
  onShow() { this._startAnim() },
  onHide() { this._stopAnim() },
  onUnload() { this._stopAnim() },

  // ═══ 动画 ═══
  _startAnim() {
    if (this._timer) return
    this._timer = setInterval(() => {
      if (this._animRunning) {
        this._animPhase += 0.05
        if (this._animPhase > Math.PI * 2) this._animPhase = 0
      }
      this.drawIntegral()
    }, 50)
  },
  _stopAnim() {
    if (this._timer) { clearInterval(this._timer); this._timer = null }
  },
  toggleAnim() {
    haptic.light()
    this._animRunning = !this._animRunning
  },

  // ═══ 事件 ═══
  onLen(e) { this.setData({ 'S.L': e.detail.value }, () => this.update()) },
  onTheta(e) { this.setData({ 'S.theta': e.detail.value }, () => this.update()) },
  setUniform() { haptic.light(); this.setData({ 'S.taper': 'uniform' }, () => this.update()) },
  setSin() { haptic.light(); this.setData({ 'S.taper': 'sin' }, () => this.update()) },
  setTri() { haptic.light(); this.setData({ 'S.taper': 'tri' }, () => this.update()) },
  setCos() { haptic.light(); this.setData({ 'S.taper': 'cos' }, () => this.update()) },

  // ═══ 物理 ═══
  amp(z) {
    const S = this.data.S
    const u = Math.abs(z) / (S.L / 2 || 1)
    if (u > 1) return 0
    if (S.taper === 'uniform') return 1
    if (S.taper === 'tri') return 1 - u
    if (S.taper === 'cos') return 0.5 + 0.5 * Math.cos(Math.PI * u)
    return Math.sin(Math.PI * (1 - u) / 2)
  },

  field(theta) {
    const S = this.data.S
    const th = theta * Math.PI / 180
    const N = 180, dz = S.L / N
    let re = 0, im = 0
    for (let i = 0; i <= N; i++) {
      const z = -S.L / 2 + i * dz
      const a = this.amp(z)
      const ph = 2 * Math.PI * z * Math.cos(th)
      const w = (i === 0 || i === N) ? 0.5 : 1
      re += w * a * Math.cos(ph) * dz
      im += w * a * Math.sin(ph) * dz
    }
    return Math.abs(Math.sin(th)) * Math.hypot(re, im)
  },

  sampleIntegral(theta, nSteps) {
    const S = this.data.S
    const th = theta * Math.PI / 180
    const N = nSteps, dz = S.L / N
    const pts = []
    let re = 0, im = 0
    for (let i = 0; i <= N; i++) {
      const z = -S.L / 2 + i * dz
      const a = this.amp(z)
      const ph = 2 * Math.PI * z * Math.cos(th)
      re += a * Math.cos(ph) * dz
      im += a * Math.sin(ph) * dz
      pts.push({ z, amp: a, ph, re, im, mag: Math.hypot(re, im) })
    }
    return pts
  },

  pattern() {
    const vals = [], N = 360
    let m = 0
    for (let i = 0; i <= N; i++) {
      const th = i / 2
      const v = this.field(th)
      vals.push(v)
      m = Math.max(m, v)
    }
    return vals.map(v => v / (m || 1))
  },

  // ═══ 更新 ═══
  update() {
    // 统计
    const p = this.pattern()
    const half = Math.sqrt(0.5)
    let l = 180, r = 180
    while (l > 0 && p[l] > half) l--
    while (r < p.length - 1 && p[r] > half) r++
    const bw = ((r - l) / 2).toFixed(0) + '°'

    let sll = 0
    for (let i = 0; i < p.length; i++) {
      if (Math.abs(i - 180) > Math.max(40, (r - l) / 2)) sll = Math.max(sll, p[i])
    }
    const sllStr = (20 * Math.log10(sll || 1e-6)).toFixed(1) + ' dB'

    const v = this.field(this.data.S.theta)
    const fieldStr = (20 * Math.log10(v || 1e-6)).toFixed(1) + ' dB'

    const pts = this.sampleIntegral(this.data.S.theta, 180)
    const intVal = pts[pts.length - 1].mag.toFixed(3)

    this.setData({ stats: { bw, sll: sllStr, field: fieldStr, intVal } })

    this.drawSource()
    this.drawIntegral()
    this.drawPattern()
  },

  // ═══ Canvas 查询 ═══
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

  // ═══ 电流分布 ═══
  drawSource() {
    this._queryCanvas('sourceCanvas', (g, w, h) => {
      const S = this.data.S
      g.fillStyle = '#0a0c16'; g.fillRect(0, 0, w, h)
      const L = 36, R = w - 20, T = 22, B = h - 28

      // 网格
      g.strokeStyle = '#1e2235'; g.lineWidth = 1
      for (let i = 0; i < 5; i++) {
        const y = T + i * (B - T) / 4
        g.beginPath(); g.moveTo(L, y); g.lineTo(R, y); g.stroke()
      }
      g.strokeStyle = '#2e3350'
      g.beginPath(); g.moveTo(L, B); g.lineTo(R, B); g.stroke()

      // 电流曲线
      g.strokeStyle = '#5b8fff'; g.lineWidth = 2.5; g.beginPath()
      for (let i = 0; i <= 200; i++) {
        const z = -S.L / 2 + S.L * i / 200
        const a = this.amp(z)
        const x = L + i * (R - L) / 200
        const y = B - a * (B - T) * 0.85
        i ? g.lineTo(x, y) : g.moveTo(x, y)
      }
      g.stroke()

      g.fillStyle = '#4a5168'; g.font = '9px monospace'; g.textAlign = 'center'
      g.fillText('-L/2', L + 4, B + 12)
      g.fillText('0', (L + R) / 2, B + 12)
      g.fillText('+L/2', R - 4, B + 12)
    })
  },

  // ═══ 积分路径 ═══
  drawIntegral() {
    this._queryCanvas('integralCanvas', (g, w, h) => {
      const S = this.data.S
      g.fillStyle = '#0a0c16'; g.fillRect(0, 0, w, h)
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.38
      const th = S.theta * Math.PI / 180

      // 参考圆
      const allPts = this.sampleIntegral(S.theta, 120)
      const totalMag = allPts[allPts.length - 1].mag || 1
      g.strokeStyle = '#1e2235'; g.lineWidth = 1
      for (const rr of [0.25, 0.5, 0.75, 1]) {
        g.beginPath(); g.arc(cx, cy, R * rr, 0, Math.PI * 2); g.stroke()
      }

      // 累积矢量
      g.strokeStyle = '#5b8fff'; g.lineWidth = 1.5
      g.beginPath(); g.moveTo(cx, cy)
      g.lineTo(cx + totalMag * Math.cos(this._animPhase) * R / totalMag,
               cy - totalMag * Math.sin(this._animPhase) * R / totalMag)
      g.stroke()

      // 积分采样点
      const visible = Math.floor((Math.sin(this._animPhase) * 0.5 + 0.5) * allPts.length)
      for (let i = 0; i <= visible && i < allPts.length; i++) {
        const p = allPts[i]
        const px = cx + p.re * R / totalMag
        const py = cy - p.im * R / totalMag
        const size = 3 + p.amp * 8
        const hue = ((p.ph * 180 / Math.PI) % 360 + 360) % 360
        g.fillStyle = 'hsl(' + hue + ',80%,60%)'
        g.beginPath(); g.arc(px, py, size, 0, Math.PI * 2); g.fill()
      }

      // 当前位置指示
      if (visible > 0 && visible <= allPts.length) {
        const p = allPts[Math.min(visible, allPts.length - 1)]
        g.strokeStyle = '#fff'; g.lineWidth = 2
        g.beginPath(); g.arc(cx + p.re * R / totalMag, cy - p.im * R / totalMag, 12, 0, Math.PI * 2); g.stroke()
      }

      // 文字
      g.fillStyle = '#59627f'; g.font = '10px sans-serif'; g.textAlign = 'left'
      g.fillText('θ=' + S.theta + '°  cosθ=' + Math.cos(th).toFixed(2), 10, h - 10)
      g.fillText('累积: ' + totalMag.toFixed(3), 10, 16)
    })
  },

  // ═══ 方向图 ═══
  drawPattern() {
    this._queryCanvas('patternCanvas', (g, w, h) => {
      const S = this.data.S
      g.fillStyle = '#0a0c16'; g.fillRect(0, 0, w, h)
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.38

      // 网格
      g.strokeStyle = '#1e2235'; g.lineWidth = 1
      for (const rr of [0.25, 0.5, 0.707, 1]) {
        g.beginPath(); g.arc(cx, cy, R * rr, 0, Math.PI * 2); g.stroke()
      }
      g.strokeStyle = '#2e3350'
      g.beginPath()
      g.moveTo(cx - R - 12, cy); g.lineTo(cx + R + 12, cy)
      g.moveTo(cx, cy - R - 12); g.lineTo(cx, cy + R + 12)
      g.stroke()

      // 方向图
      const p = this.pattern()
      g.strokeStyle = '#ffffff'; g.lineWidth = 2.2; g.beginPath()
      for (let i = 0; i < p.length; i++) {
        const th = i / 2 * Math.PI / 180
        const rr = p[i] * R
        const x = cx + rr * Math.sin(th)
        const y = cy - rr * Math.cos(th)
        i ? g.lineTo(x, y) : g.moveTo(x, y)
      }
      // 镜像
      for (let i = p.length - 1; i >= 0; i--) {
        const th = i / 2 * Math.PI / 180
        const rr = p[i] * R
        g.lineTo(cx - rr * Math.sin(th), cy + rr * Math.cos(th))
      }
      g.closePath(); g.stroke()
      g.fillStyle = 'rgba(255,255,255,0.06)'; g.fill()

      // 当前观测角
      const th = S.theta * Math.PI / 180
      const v = this.field(S.theta)
      const pV = Math.max(...p)
      const rr = v / pV * R
      g.strokeStyle = '#ff9944'; g.lineWidth = 1.5; g.setLineDash([4, 4])
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + rr * Math.sin(th), cy - rr * Math.cos(th)); g.stroke()
      g.setLineDash([])
      g.fillStyle = '#ff9944'; g.beginPath(); g.arc(cx + rr * Math.sin(th), cy - rr * Math.cos(th), 5, 0, Math.PI * 2); g.fill()
    })
  },

  onShareAppMessage() {
    return { title: '辐射积分可视化', path: '/pages/interactive/radiation-integral/radiation-integral' }
  },
})

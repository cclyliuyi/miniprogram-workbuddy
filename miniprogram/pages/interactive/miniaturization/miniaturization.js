// pages/interactive/miniaturization/miniaturization.js —— 电小天线与 Chu 极限
// 核心：
//   Chu Q 下界：Qmin ≈ 1/(ka)³ + 1/(ka)
//   辐射电阻：短偶极子 Rrad ≈ 80(ka)²，电小环 Rrad ∝ 1950(ka)⁴
//   效率：η = Rrad/(Rrad+Rloss)
//   带宽趋势：BW ∝ η/Q

const haptic = require('../../../utils/haptic')

Page({
  data: {
    S: { mode: 'dipole', ka: 0.18, rloss: 5 },
    stats: null,
  },

  _phase: 0,
  _timer: null,
  _sceneReady: false,
  _curveReady: false,

  onLoad() { this.update() },
  onReady() { this.update() },
  onShow() { this._startAnim() },
  onHide() { this._stopAnim() },
  onUnload() { this._stopAnim() },

  // ═══ 动画 ═══
  _startAnim() {
    if (this._timer) return
    this._timer = setInterval(() => {
      this._phase += 0.06
      if (this._sceneReady) this.drawScene()
    }, 50)
  },
  _stopAnim() {
    if (this._timer) { clearInterval(this._timer); this._timer = null }
  },

  // ═══ 事件 ═══
  onKa(e) { this.setData({ 'S.ka': e.detail.value }, () => this.update()) },
  onLoss(e) { this.setData({ 'S.rloss': e.detail.value }, () => this.update()) },
  setDipole() { haptic.light(); this.setData({ 'S.mode': 'dipole' }, () => this.update()) },
  setLoop() { haptic.light(); this.setData({ 'S.mode': 'loop' }, () => this.update()) },

  // ═══ 物理 ═══
  chuQ(ka) { return 1 / (ka * ka * ka) + 1 / ka },
  rradValue(ka, mode) {
    return mode === 'loop' ? 1950 * Math.pow(ka, 4) : 80 * ka * ka
  },
  etaValue(ka, mode, rloss) {
    const r = this.rradValue(ka, mode)
    return r / (r + rloss)
  },

  update() {
    const S = this.data.S
    const q = this.chuQ(S.ka)
    const r = this.rradValue(S.ka, S.mode)
    const eta = this.etaValue(S.ka, S.mode, S.rloss)
    const bw = 100 * eta / q

    let qStr, bwStr, rStr, etaStr
    qStr = q > 999 ? Math.round(q).toLocaleString() : q.toFixed(1)
    bwStr = bw < 0.01 ? '<0.01%' : bw.toFixed(2) + '%'
    rStr = r < 1 ? r.toFixed(2) + ' Ω' : r < 10 ? r.toFixed(1) + ' Ω' : Math.round(r) + ' Ω'
    etaStr = Math.round(eta * 100) + '%'

    this.setData({ stats: { qmin: qStr, bw: bwStr, rrad: rStr, eta: etaStr } })
    this.drawScene()
    this.drawCurve()
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

  drawScene() {
    if (!this._sceneReady) {
      this._queryCanvas('sceneCanvas', (ctx, w, h) => {
        this._sceneReady = true
        this._renderScene(ctx, w, h)
      })
    } else {
      this._queryCanvas('sceneCanvas', (ctx, w, h) => {
        this._renderScene(ctx, w, h)
      })
    }
  },

  _renderScene(g, w, h) {
    const S = this.data.S
    g.fillStyle = '#0a0c16'
    g.fillRect(0, 0, w, h)

    // 网格
    g.strokeStyle = '#1c2238'
    g.lineWidth = 1
    for (let i = 0; i < 6; i++) {
      const y = 24 + i * (h - 48) / 5
      g.beginPath(); g.moveTo(20, y); g.lineTo(w - 20, y); g.stroke()
    }

    const cx = w * 0.5
    const cy = h * 0.46
    const sphereR = Math.min(w * 0.28, h * 0.32)

    // 辐射球面光晕
    const grad = g.createRadialGradient(cx, cy, sphereR * 0.12, cx, cy, sphereR * 1.15)
    grad.addColorStop(0, 'rgba(255,196,92,0.20)')
    grad.addColorStop(0.45, 'rgba(255,116,65,0.10)')
    grad.addColorStop(1, 'rgba(80,106,255,0)')
    g.fillStyle = grad
    g.beginPath(); g.arc(cx, cy, sphereR * 1.18, 0, Math.PI * 2); g.fill()

    // Chu 球面虚线
    g.setLineDash([6, 5])
    g.strokeStyle = 'rgba(236,196,75,0.75)'
    g.lineWidth = 1.2
    g.beginPath(); g.arc(cx, cy, sphereR, 0, Math.PI * 2); g.stroke()
    g.setLineDash([])

    // 近场储能环
    const ka = S.ka
    const stored = Math.max(1.4, Math.min(12, 1 / (ka * ka)))
    for (let i = 5; i >= 1; i--) {
      const p = i / 5
      const rr = sphereR * (0.42 + p * 0.58)
      const alpha = 0.05 + 0.13 * p * Math.max(0.2, Math.min(1, stored / 8))
      g.beginPath()
      g.arc(cx, cy, rr, 0, Math.PI * 2)
      g.strokeStyle = 'rgba(255,183,76,' + alpha + ')'
      g.lineWidth = 8 * (1 - p) + 2
      g.stroke()
    }

    // 近场粒子
    for (let i = 0; i < 30; i++) {
      const a = i * 0.57 + this._phase * 0.35
      const rr = sphereR * (0.25 + 0.72 * ((i * 37) % 100) / 100)
      const x = cx + Math.cos(a) * rr
      const y = cy + Math.sin(a) * rr * 0.78
      const hot = 0.45 + 0.4 * Math.sin(this._phase + i)
      g.fillStyle = 'rgba(255,128,60,' + hot + ')'
      g.beginPath(); g.arc(x, y, 2.3, 0, Math.PI * 2); g.fill()
    }

    // 天线
    const scale = 0.32 + 0.28 * S.ka
    g.strokeStyle = '#ffd45d'
    g.fillStyle = '#ffd45d'
    g.lineCap = 'round'
    if (S.mode === 'loop') {
      const rx = sphereR * 0.24 * scale / 0.42
      const ry = rx * 0.58
      g.lineWidth = 5
      g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.stroke()
    } else {
      const len = sphereR * 0.55 * scale / 0.42
      g.lineWidth = 6
      g.beginPath()
      g.moveTo(cx, cy - len); g.lineTo(cx, cy - 12)
      g.moveTo(cx, cy + 12); g.lineTo(cx, cy + len)
      g.stroke()
      g.beginPath()
      g.arc(cx, cy - 10, 5, 0, Math.PI * 2)
      g.arc(cx, cy + 10, 5, 0, Math.PI * 2)
      g.fill()
    }

    // 辐射波弧
    const m = {
      eta: this.etaValue(S.ka, S.mode, S.rloss),
      q: this.chuQ(S.ka),
    }
    const waveA = Math.max(0.08, Math.min(0.9, m.eta))
    for (let i = 0; i < 4; i++) {
      const rr = sphereR * (1.22 + i * 0.18) + (this._phase * 12) % 24
      g.strokeStyle = 'rgba(102,145,255,' + ((0.12 + 0.11 * i) * waveA) + ')'
      g.lineWidth = 2
      g.beginPath(); g.arc(cx, cy, rr, -0.62, 0.62); g.stroke()
    }

    // 标注
    g.fillStyle = '#8290bd'
    g.font = '12px sans-serif'
    g.textAlign = 'center'
    g.fillText('ka=' + S.ka.toFixed(2) + '  Qmin≈' + (m.q > 999 ? Math.round(m.q) : m.q.toFixed(1)), cx, 24)
    g.fillStyle = '#6f789d'
    g.font = '11px sans-serif'
    g.fillText('ka 越小：储能更强，带宽更窄', cx, h - 12)
  },

  drawCurve() {
    this._queryCanvas('curveCanvas', (g, w, h) => {
      this._renderCurve(g, w, h)
    })
  },

  _renderCurve(g, w, h) {
    const S = this.data.S
    g.fillStyle = '#0a0c16'
    g.fillRect(0, 0, w, h)

    const L = 52, R = w - 28, T = 28, B = h - 34
    const mid = T + (B - T) * 0.52

    // 坐标轴
    g.strokeStyle = '#29304f'; g.lineWidth = 1
    g.beginPath(); g.moveTo(L, T); g.lineTo(L, mid - 18); g.lineTo(R, mid - 18); g.stroke()
    g.beginPath(); g.moveTo(L, mid + 22); g.lineTo(L, B); g.lineTo(R, B); g.stroke()

    // ka 刻度
    for (let i = 0; i <= 5; i++) {
      const x = L + i * (R - L) / 5
      const ka = 0.06 + i * (0.8 - 0.06) / 5
      g.strokeStyle = 'rgba(41,48,79,0.65)'
      g.beginPath(); g.moveTo(x, T); g.lineTo(x, B); g.stroke()
      g.fillStyle = '#596486'
      g.font = '10px sans-serif'
      g.textAlign = 'center'
      g.fillText(ka.toFixed(2), x, B + 16)
    }

    const xOf = ka => L + (ka - 0.06) / (0.8 - 0.06) * (R - L)
    const qy = q => {
      const l = Math.log10(q), lo = Math.log10(this.chuQ(0.8)), hi = Math.log10(this.chuQ(0.06))
      return (mid - 18) - (l - lo) / (hi - lo) * (mid - 18 - T)
    }
    const ey = e => B - e * (B - (mid + 22))

    // Q 曲线
    g.lineWidth = 2.5
    g.strokeStyle = '#6f91ff'
    g.beginPath()
    for (let i = 0; i <= 120; i++) {
      const ka = 0.06 + i * (0.8 - 0.06) / 120
      const x = xOf(ka), y = qy(this.chuQ(ka))
      i ? g.lineTo(x, y) : g.moveTo(x, y)
    }
    g.stroke()

    // 效率曲线
    g.strokeStyle = '#61d89d'
    g.beginPath()
    for (let i = 0; i <= 120; i++) {
      const ka = 0.06 + i * (0.8 - 0.06) / 120
      const x = xOf(ka), y = ey(this.etaValue(ka, S.mode, S.rloss))
      i ? g.lineTo(x, y) : g.moveTo(x, y)
    }
    g.stroke()

    // Rrad 曲线
    g.strokeStyle = '#ffbd57'
    g.beginPath()
    for (let i = 0; i <= 120; i++) {
      const ka = 0.06 + i * (0.8 - 0.06) / 120
      const r = this.rradValue(ka, S.mode)
      const norm = Math.max(0, Math.min(1, Math.log10(r + 0.05) / Math.log10(80)))
      const x = xOf(ka), y = B - norm * (B - (mid + 22))
      i ? g.lineTo(x, y) : g.moveTo(x, y)
    }
    g.stroke()

    // 当前 ka 垂直线
    const x = xOf(S.ka)
    const q = this.chuQ(S.ka)
    const eta = this.etaValue(S.ka, S.mode, S.rloss)
    const r = this.rradValue(S.ka, S.mode)

    g.setLineDash([5, 5])
    g.strokeStyle = 'rgba(255,255,255,0.35)'
    g.beginPath(); g.moveTo(x, T); g.lineTo(x, B); g.stroke()
    g.setLineDash([])

    // 当前点
    g.fillStyle = '#6f91ff'; g.beginPath(); g.arc(x, qy(q), 5, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#61d89d'; g.beginPath(); g.arc(x, ey(eta), 5, 0, Math.PI * 2); g.fill()
    const rNorm = Math.max(0, Math.min(1, Math.log10(r + 0.05) / Math.log10(80)))
    g.fillStyle = '#ffbd57'; g.beginPath(); g.arc(x, B - rNorm * (B - (mid + 22)), 5, 0, Math.PI * 2); g.fill()

    // 图例
    const lx = R - 150, ly = T + 8
    const items = [['#6f91ff', 'Qmin'], ['#61d89d', 'ηrad'], ['#ffbd57', 'Rrad']]
    items.forEach((it, i) => {
      g.fillStyle = it[0]; g.fillRect(lx, ly + 8 + i * 18, 16, 3)
      g.fillStyle = '#b7c0df'; g.font = '11px sans-serif'; g.textAlign = 'left'
      g.fillText(it[1], lx + 24, ly + 11 + i * 18)
    })
  },

  onShareAppMessage() {
    return { title: '电小天线与 Chu 极限', path: '/pages/interactive/miniaturization/miniaturization' }
  },
})

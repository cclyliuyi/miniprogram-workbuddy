// pages/interactive/phased-array/phased-array.js —— 相控阵波束扫描（2D 降维）
// 核心：
//   阵因子 AF(θ) = |sin(Nψ/2)| / |N·sin(ψ/2)|
//   ψ = kd·cosθ + β  (θ 自阵列轴 +Y 测量)
//   阵元因子 EF(θ)：各向同性=1，半波偶极子=|cos(π/2·cosθ)/sinθ|
//   总方向图 P = AF × EF
//   栅瓣：d/λ > 1/(1+|cosθ₀|) 时出现

const haptic = require('../../../utils/haptic')

Page({
  data: {
    S: { N: 8, d: 0.5, beta: 0, el: 'iso' },
    stats: null,
    scanOn: false,
  },

  onLoad() { this.update() },
  onReady() { this.update() },
  onUnload() { this._stopScan() },

  // ═══ 参数 ═══
  onN(e)    { this.setData({ 'S.N': e.detail.value }, () => this.update()) },
  onD(e)    { this.setData({ 'S.d': e.detail.value }, () => this.update()) },
  onBeta(e) { this.setData({ 'S.beta': e.detail.value, scanOn: false }, () => this._stopScanThenUpdate()) },

  _stopScanThenUpdate() {
    this._stopScan()
    this.update()
  },

  setBroadside() { haptic.light(); this._stopScan(); this.setData({ 'S.beta': 0, scanOn: false }, () => this.update()) },
  setEndfireFwd(){ haptic.light(); this._stopScan(); const b = -Math.min(this.data.S.d * 360, 180); this.setData({ 'S.beta': Math.round(b), scanOn: false }, () => this.update()) },
  setEndfireBack(){haptic.light(); this._stopScan(); const b = Math.min(this.data.S.d * 360, 180); this.setData({ 'S.beta': Math.round(b), scanOn: false }, () => this.update()) },

  setIso()    { haptic.light(); this.setData({ 'S.el': 'iso' }, () => this.update()) },
  setDipole() { haptic.light(); this.setData({ 'S.el': 'dipole' }, () => this.update()) },

  toggleScan() {
    haptic.light()
    const scanOn = !this.data.scanOn
    this.setData({ scanOn })
    if (scanOn) this._startScan()
    else this._stopScan()
  },

  _startScan() {
    this._scanTimer = setInterval(() => {
      const d = this.data.S.d
      const amp = Math.min(d * 360, 180)
      const phase = Date.now() / 1200
      const beta = Math.round(amp * Math.sin(phase))
      this.setData({ 'S.beta': beta })
      this.update()
    }, 80)
  },

  _stopScan() {
    if (this._scanTimer) { clearInterval(this._scanTimer); this._scanTimer = null }
  },

  // ═══ 方向图计算 ═══
  kd() { return 2 * Math.PI * this.data.S.d },

  AF(gamma) {
    const psi = this.kd() * Math.cos(gamma) + this.data.S.beta * Math.PI / 180
    const den = this.data.S.N * Math.sin(psi / 2)
    if (Math.abs(den) < 1e-7) return 1
    return Math.abs(Math.sin(this.data.S.N * psi / 2) / den)
  },

  EF(gamma) {
    if (this.data.S.el === 'iso') return 1
    const s = Math.sin(gamma)
    if (Math.abs(s) < 1e-9) return 0
    return Math.abs(Math.cos(Math.PI / 2 * Math.cos(gamma)) / s)
  },

  P(gamma) { return this.AF(gamma) * this.EF(gamma) },

  Pmax() {
    let m = 0
    for (let i = 0; i <= 1440; i++) {
      const v = this.P(i / 1440 * Math.PI)
      if (v > m) m = v
    }
    return m || 1
  },

  // ═══ 统计 ═══
  calcStats() {
    const Ns = 1000
    const pm = this.Pmax()
    const dt = Math.PI / Ns
    const Pn = []
    let mainIdx = 0, mainVal = -1
    for (let i = 0; i <= Ns; i++) {
      const v = this.P(i * dt) / pm
      Pn.push(v)
      if (v > mainVal) { mainVal = v; mainIdx = i }
    }
    const gamma0 = mainIdx * dt

    // 指向性
    let integral = 0
    for (let i = 0; i <= Ns; i++) {
      const w = (i === 0 || i === Ns) ? 0.5 : 1
      integral += w * Pn[i] * Pn[i] * Math.sin(i * dt) * dt
    }
    const D = 2 / Math.max(integral, 1e-12)
    const dbi = 10 * Math.log10(D)

    // HPBW
    const half = Math.SQRT1_2
    let li = mainIdx, ri = mainIdx
    while (li > 0 && Pn[li] > half) li--
    while (ri < Ns && Pn[ri] > half) ri++
    const HPBW = Math.round((ri - li) * dt * 180 / Math.PI)

    // SLL
    let sll = 0
    for (let i = 1; i < Ns; i++) {
      if (Pn[i] > Pn[i - 1] && Pn[i] >= Pn[i + 1]) {
        if (Math.abs(i - mainIdx) > 2 && Pn[i] > sll) sll = Pn[i]
      }
    }
    const sllDb = sll > 1e-4 ? 20 * Math.log10(sll) : -100

    // 栅瓣
    const cones = []
    const k = this.kd(), b = this.data.S.beta * Math.PI / 180
    for (let m = -8; m <= 8; m++) {
      const c = (-b - 2 * Math.PI * m) / k
      if (c >= -1 && c <= 1) cones.push(Math.acos(c))
    }
    let gl = 0
    for (const c of cones) {
      if (Math.abs(c - gamma0) > 0.05) gl++
    }

    return {
      theta: Math.round(gamma0 * 180 / Math.PI),
      dbi: dbi.toFixed(1),
      hpbw: HPBW,
      sll: sllDb < -99 ? '—' : sllDb.toFixed(0),
      grating: gl,
    }
  },

  // ═══ 更新 ═══
  update() {
    const stats = this.calcStats()
    this.setData({ stats })
    this.drawPolar()
  },

  // ═══ 绘图 ═══
  drawPolar() {
    const query = wx.createSelectorQuery()
    query.select('#polarCanvas')
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
        this._draw(ctx, w, h)
      })
  },

  _draw(ctx, w, h) {
    ctx.clearRect(0, 0, w, h)
    const pm = this.Pmax()
    const cx = w / 2
    const cy = h / 2
    const R = Math.min(w, h) / 2 - 30

    // dB 圆栅格
    ctx.strokeStyle = 'rgba(155,147,132,0.15)'
    ctx.lineWidth = 0.5
    ctx.font = '8px sans-serif'
    ctx.textAlign = 'left'
    const FLOOR = -40
    for (const db of [0, -10, -20, -30]) {
      const rr = R * (db - FLOOR) / -FLOOR
      ctx.beginPath()
      ctx.arc(cx, cy, rr, 0, 2 * Math.PI)
      ctx.stroke()
      if (db < 0) ctx.fillText(db + '', cx + 2, cy - rr + 9)
    }

    // 十字线
    ctx.strokeStyle = 'rgba(155,147,132,0.2)'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(cx - R - 8, cy); ctx.lineTo(cx + R + 8, cy)
    ctx.moveTo(cx, cy - R - 8); ctx.lineTo(cx, cy + R + 8)
    ctx.stroke()

    // 角度标注
    ctx.fillStyle = 'rgba(155,147,132,0.5)'
    ctx.font = '8px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('0°', cx, cy - R - 4)    // γ=0 端射
    ctx.fillText('90°', cx + R + 8, cy + 4) // γ=90° 边射
    ctx.fillText('180°', cx, cy + R + 12)
    ctx.fillText('270°', cx - R - 10, cy + 4)

    // 方向图曲线
    const Ns = 360
    const points = []
    for (let i = 0; i <= Ns; i++) {
      const gamma = i / Ns * Math.PI * 2 // 0~2π 全方位
      // 阵列沿 Y 轴，gamma 是自 Y 轴的角度
      // 在 canvas 上，0°=上，90°=右
      let val
      if (gamma <= Math.PI) {
        val = this.P(gamma) / pm
      } else {
        val = this.P(2 * Math.PI - gamma) / pm
      }
      const db = 20 * Math.log10(Math.max(val, 1e-4))
      const rn = Math.max(0, (db - FLOOR) / -FLOOR)
      // canvas 坐标：0°=上
      const angle = gamma - Math.PI / 2
      points.push({
        x: cx + R * rn * Math.cos(angle),
        y: cy + R * rn * Math.sin(angle),
      })
    }

    // 填充
    ctx.beginPath()
    for (let i = 0; i < points.length; i++) {
      if (i === 0) ctx.moveTo(points[i].x, points[i].y)
      else ctx.lineTo(points[i].x, points[i].y)
    }
    ctx.closePath()
    ctx.fillStyle = 'rgba(176,106,79,0.08)'
    ctx.fill()

    // 描边
    ctx.strokeStyle = '#b06a4f'
    ctx.lineWidth = 1.8
    ctx.beginPath()
    for (let i = 0; i < points.length; i++) {
      if (i === 0) ctx.moveTo(points[i].x, points[i].y)
      else ctx.lineTo(points[i].x, points[i].y)
    }
    ctx.closePath()
    ctx.stroke()

    // 标记主瓣方向
    const S = this.data.S
    const k = this.kd()
    const b = S.beta * Math.PI / 180
    // 主瓣 gamma0 = acos(-β/(kd))
    const cosG0 = k > 0 ? -b / k : 0
    if (Math.abs(cosG0) <= 1) {
      const gamma0 = Math.acos(cosG0)
      const angle = gamma0 - Math.PI / 2
      const px = cx + R * Math.cos(angle)
      const py = cy + R * Math.sin(angle)
      ctx.strokeStyle = 'rgba(122,145,129,0.5)'
      ctx.lineWidth = 1
      ctx.setLineDash([5, 4])
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(px, py)
      ctx.stroke()
      ctx.setLineDash([])

      // 箭头
      ctx.fillStyle = '#7a9181'
      ctx.beginPath()
      ctx.arc(px, py, 4, 0, 2 * Math.PI)
      ctx.fill()
    }

    // 阵列示意（中心竖线 + 阵元点）
    const arrLen = R * 0.3
    const N = S.N
    ctx.strokeStyle = 'rgba(155,147,132,0.3)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(cx, cy - arrLen)
    ctx.lineTo(cx, cy + arrLen)
    ctx.stroke()
    ctx.fillStyle = 'rgba(176,106,79,0.6)'
    for (let n = 0; n < N; n++) {
      const y = cy - arrLen + (n / Math.max(N - 1, 1)) * 2 * arrLen
      ctx.beginPath()
      ctx.arc(cx, y, 2.5, 0, 2 * Math.PI)
      ctx.fill()
    }
  },
})

// pages/interactive/smart-array/smart-array.js —— 自适应零陷波束形成
// 核心：
//   MVDR/Capon 波束形成器
//   约束：wᴴa(θs)=1, wᴴa(θi₁)=0, wᴴa(θi₂)=0
//   求解：3×3 复数矩阵 Gauss 消元
//   导向矢量：a(θ)=[1, e^{jkd·sinθ}, ..., e^{j(N-1)kd·sinθ}]ᵀ

const haptic = require('../../../utils/haptic')

// ═══ 复数运算 ═══
const EPS = 1e-12
const cadd = (a, b) => [a[0] + b[0], a[1] + b[1]]
const csub = (a, b) => [a[0] - b[0], a[1] - b[1]]
const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]]
const cdiv = (a, b) => {
  const n = b[0] * b[0] + b[1] * b[1] + EPS
  return [(a[0] * b[0] + a[1] * b[1]) / n, (a[1] * b[0] - a[0] * b[1]) / n]
}
const conj = a => [a[0], -a[1]]
const cmag = a => Math.hypot(a[0], a[1])

Page({
  data: {
    S: { N: 12, d: 0.5, sig: 20, jam1: -35, jam2: 45 },
    stats: null,
  },

  onLoad() { this.update() },
  onReady() { this.update() },

  // ═══ 事件 ═══
  onN(e) { this.setData({ 'S.N': e.detail.value }, () => this.update()) },
  onSig(e) { this.setData({ 'S.sig': e.detail.value }, () => this.update()) },
  onJam1(e) { this.setData({ 'S.jam1': e.detail.value }, () => this.update()) },
  onJam2(e) { this.setData({ 'S.jam2': e.detail.value }, () => this.update()) },

  // ═══ 导向矢量 ═══
  steer(deg) {
    const S = this.data.S
    const th = deg * Math.PI / 180
    const a = []
    for (let n = 0; n < S.N; n++) {
      const p = 2 * Math.PI * S.d * n * Math.sin(th)
      a.push([Math.cos(p), Math.sin(p)])
    }
    return a
  },

  // 内积 <a, b> = aᴴb
  inner(a, b) {
    let z = [0, 0]
    for (let n = 0; n < a.length; n++) {
      z = cadd(z, cmul(conj(a[n]), b[n]))
    }
    return z
  },

  // 3×3 复数矩阵 Gauss 消元
  solveComplex(A, b) {
    const n = b.length
    const M = A.map((row, r) => [...row, b[r]])

    for (let c = 0; c < n; c++) {
      // 选主元
      let piv = c, best = cmag(M[c][c])
      for (let r = c + 1; r < n; r++) {
        const v = cmag(M[r][c])
        if (v > best) { best = v; piv = r }
      }
      if (piv !== c) { const t = M[c]; M[c] = M[piv]; M[piv] = t }
      if (best < 1e-9) M[c][c] = [1e-6, 0]

      const pv = M[c][c]
      for (let k = c; k <= n; k++) M[c][k] = cdiv(M[c][k], pv)
      for (let r = 0; r < n; r++) {
        if (r === c) continue
        const f = M[r][c]
        if (cmag(f) < EPS) continue
        for (let k = c; k <= n; k++) M[r][k] = csub(M[r][k], cmul(f, M[c][k]))
      }
    }
    return M.map(row => row[n])
  },

  // MVDR 权值
  computeWeights() {
    const S = this.data.S
    const cols = [this.steer(S.sig), this.steer(S.jam1), this.steer(S.jam2)]
    const G = []

    // 构造 Gram 矩阵 G = AᴴA
    for (let r = 0; r < 3; r++) {
      G[r] = []
      for (let c = 0; c < 3; c++) {
        G[r][c] = this.inner(cols[r], cols[c])
      }
    }

    // 对角加载正则化
    const trace = G[0][0][0] + G[1][1][0] + G[2][2][0]
    const load = Math.max(1e-8, trace / 3 * 1e-6)
    for (let r = 0; r < 3; r++) G[r][r] = cadd(G[r][r], [load, 0])

    // 求解 G·x = [1, 0, 0]ᵀ
    const x = this.solveComplex(G, [[1, 0], [0, 0], [0, 0]])

    // 组合权值 w = Σ xₖ·aₖ
    const w = []
    for (let n = 0; n < S.N; n++) {
      let z = [0, 0]
      for (let k = 0; k < 3; k++) z = cadd(z, cmul(cols[k][n], x[k]))
      w.push(z)
    }
    return w
  },

  // 阵列响应
  resp(deg, wg) {
    const a = this.steer(deg)
    let z = [0, 0]
    for (let n = 0; n < a.length; n++) z = cadd(z, cmul(conj(wg[n]), a[n]))
    return cmag(z)
  },

  db(v, ref) { return 20 * Math.log10(Math.max(v, 1e-12) / Math.max(ref || 1, 1e-12)) },

  fmtDb(v) { return v < -80 ? '< -80 dB' : v.toFixed(1) + ' dB' },

  // ═══ 更新 ═══
  update() {
    const S = this.data.S
    const wg = this.computeWeights()

    // 采样方向图
    const vals = []
    let peak = 0, peakDeg = 0
    for (let k = 0; k <= 720; k++) {
      const deg = -90 + k * 0.25
      const v = this.resp(deg, wg)
      vals.push(v)
      if (v > peak) { peak = v; peakDeg = deg }
    }

    // 统计
    const targetResp = this.resp(S.sig, wg)
    const null1Resp = this.resp(S.jam1, wg)
    const null2Resp = this.resp(S.jam2, wg)
    const norm = Math.sqrt(wg.reduce((s, z) => s + z[0] * z[0] + z[1] * z[1], 0))

    this.setData({
      stats: {
        null1: this.fmtDb(this.db(null1Resp, targetResp)),
        null2: this.fmtDb(this.db(null2Resp, targetResp)),
        beam: peakDeg.toFixed(0) + '°',
        norm: norm.toFixed(2),
      }
    })

    this.drawPattern(vals, peak)
    this.drawWeights(wg)
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

  // ═══ 方向图 ═══
  drawPattern(vals, peak) {
    this._queryCanvas('patternCanvas', (g, w, h) => {
      const S = this.data.S
      g.fillStyle = '#0a0c16'; g.fillRect(0, 0, w, h)

      const L = 50, R = w - 20, T = 36, B = h - 36, minDb = -80

      // dB 网格
      g.strokeStyle = '#1e2235'; g.lineWidth = 1
      for (let d = minDb; d <= 0; d += 20) {
        const y = T + (-d / (-minDb)) * (B - T)
        g.beginPath(); g.moveTo(L, y); g.lineTo(R, y); g.stroke()
        g.fillStyle = '#59627f'; g.font = '10px monospace'; g.textAlign = 'right'
        g.fillText(d + '', L - 6, y + 4)
      }

      // 角度刻度
      for (let d = -90; d <= 90; d += 30) {
        const x = L + (d + 90) / 180 * (R - L)
        g.strokeStyle = 'rgba(41,48,79,0.5)'
        g.beginPath(); g.moveTo(x, T); g.lineTo(x, B); g.stroke()
        g.fillStyle = '#59627f'; g.font = '9px sans-serif'; g.textAlign = 'center'
        g.fillText(d + '°', x, B + 14)
      }

      // 方向图曲线
      g.strokeStyle = '#e8edf3'; g.lineWidth = 2.5; g.beginPath()
      let started = false
      for (let k = 0; k <= 720; k++) {
        const deg = -90 + k * 0.25
        const dB = Math.max(minDb, this.db(vals[k], peak))
        const x = L + k * (R - L) / 720
        const y = T + (-dB / (-minDb)) * (B - T)
        if (!started) { g.moveTo(x, y); started = true } else g.lineTo(x, y)
      }
      g.stroke()

      // 填充
      g.lineTo(R, T); g.lineTo(L, T); g.closePath()
      g.fillStyle = 'rgba(232,237,243,0.06)'; g.fill()

      // 方向标记
      const mark = (deg, color, label, yOff) => {
        const x = L + (deg + 90) / 180 * (R - L)
        g.strokeStyle = color; g.lineWidth = 2
        g.setLineDash([4, 4])
        g.beginPath(); g.moveTo(x, T); g.lineTo(x, B); g.stroke()
        g.setLineDash([])
        g.fillStyle = color; g.font = 'bold 10px sans-serif'
        g.textAlign = 'left'
        g.fillText(label, x + 4, T + 12 + yOff)
      }
      mark(S.sig, '#28c6a4', '目标 θs', 0)
      mark(S.jam1, '#ee6d7a', '干扰1', 14)
      mark(S.jam2, '#ff9944', '干扰2', 28)
    })
  },

  // ═══ 权值图 ═══
  drawWeights(wg) {
    this._queryCanvas('weightsCanvas', (g, w, h) => {
      const S = this.data.S
      g.fillStyle = '#0a0c16'; g.fillRect(0, 0, w, h)

      const L = 24, R = w - 24, cy = h * 0.58
      const step = (R - L) / Math.max(1, S.N - 1)

      // 轴
      g.strokeStyle = '#252838'; g.lineWidth = 1
      g.beginPath(); g.moveTo(L - 4, cy); g.lineTo(R + 4, cy); g.stroke()

      const maxMag = Math.max(...wg.map(cmag), 0.1)
      const scale = Math.min(28, h * 0.3) / maxMag

      for (let n = 0; n < S.N; n++) {
        const x = L + n * step
        const z = wg[n]
        const vx = z[0] * scale
        const vy = -z[1] * scale

        // 箭头
        g.strokeStyle = '#4f8cff'; g.lineWidth = 2
        g.beginPath(); g.moveTo(x, cy); g.lineTo(x + vx, cy + vy); g.stroke()

        // 端点
        g.fillStyle = '#ffd166'
        g.beginPath(); g.arc(x, cy, 3.5, 0, Math.PI * 2); g.fill()

        // 标号
        if (S.N <= 16) {
          g.fillStyle = '#4a5168'; g.font = '9px monospace'; g.textAlign = 'center'
          g.fillText(n + 1, x, cy + 16)
        }
      }

      // 说明
      g.fillStyle = '#6c7698'; g.font = '10px sans-serif'; g.textAlign = 'left'
      g.fillText('横=实部，纵=虚部', 8, 14)
    })
  },

  onShareAppMessage() {
    return { title: '智能天线 · MVDR 自适应零陷', path: '/pages/interactive/smart-array/smart-array' }
  },
})

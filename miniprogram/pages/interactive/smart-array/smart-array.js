// pages/interactive/smart-array/smart-array.js —— MVDR（Capon）自适应波束形成
// 真实协方差实现（非硬约束零陷）：
//   R = σ²I + Σ JNRᵢ·a(θᵢ)a(θᵢ)ᴴ，σ² = 1（空间白噪声）
//   w = R⁻¹a(θs) / (a(θs)ᴴ R⁻¹ a(θs))
//   零陷深度随干噪比 JNR 物理变化；干扰靠近目标时零陷变浅、‖w‖ 激增
// 导向矢量 a(θ) = [e^{j2πnd·sinθ/λ}]（rf-math 同源相位约定，d 以 λ 计）
const haptic = require('../../../utils/haptic')
const rf = require('../../../utils/rf-math')
const lc = require('../../../utils/lab-canvas')
const { THEME, alpha } = require('../../../utils/lab-theme')

// ═══ 复数线性代数（[re, im] 数组，仅矩阵求解用）═══
const EPS = 1e-12
const cadd = (a, b) => [a[0] + b[0], a[1] + b[1]]
const csub = (a, b) => [a[0] - b[0], a[1] - b[1]]
const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]]
const cdiv = (a, b) => {
  const n = b[0] * b[0] + b[1] * b[1] + EPS
  return [(a[0] * b[0] + a[1] * b[1]) / n, (a[1] * b[0] - a[0] * b[1]) / n]
}
const conj = (a) => [a[0], -a[1]]
const cmag = (a) => Math.hypot(a[0], a[1])

Page({
  data: {
    S: { N: 12, d100: 50, jnr: 25, sig: 20, jam1: -35, jam2: 45, dual: true },
    stats: null,
    warn: '',
  },

  _vals: null,
  _peak: 1,
  _wg: null,
  _norm: 0,

  onLoad() { this.update() },
  onReady() { this.update() },

  // ═══ 事件 ═══
  onN(e) { this.setData({ 'S.N': e.detail.value }, () => this.update()) },
  onD(e) { this.setData({ 'S.d100': e.detail.value }, () => this.update()) },
  onJnr(e) { this.setData({ 'S.jnr': e.detail.value }, () => this.update()) },
  onSig(e) { this.setData({ 'S.sig': e.detail.value }, () => this.update()) },
  onJam1(e) { this.setData({ 'S.jam1': e.detail.value }, () => this.update()) },
  onJam2(e) { this.setData({ 'S.jam2': e.detail.value }, () => this.update()) },
  setMode(e) {
    const m = e.currentTarget.dataset.m
    if (m !== '1' && m !== '2') return
    haptic.light()
    this.setData({ 'S.dual': m === '2' }, () => this.update())
  },

  // ═══ 导向矢量 a(θ) ═══
  steer(deg) {
    const S = this.data.S
    const d = S.d100 / 100
    const th = deg * Math.PI / 180
    const a = []
    for (let n = 0; n < S.N; n++) {
      const p = 2 * Math.PI * d * n * Math.sin(th)
      a.push([Math.cos(p), Math.sin(p)])
    }
    return a
  },

  // 内积 aᴴb
  inner(a, b) {
    let z = [0, 0]
    for (let n = 0; n < a.length; n++) z = cadd(z, cmul(conj(a[n]), b[n]))
    return z
  },

  // n×n 复数 Gauss-Jordan 消元（带列主元）
  solveComplex(A, b) {
    const n = b.length
    const M = A.map((row, r) => [...row, b[r]])
    for (let c = 0; c < n; c++) {
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
    return M.map((row) => row[n])
  },

  // ═══ MVDR 权值：w = R⁻¹a(θs) / (a(θs)ᴴR⁻¹a(θs)) ═══
  computeWeights() {
    const S = this.data.S
    const N = S.N
    const as = this.steer(S.sig)
    const jamDegs = S.dual ? [S.jam1, S.jam2] : [S.jam1]
    const jnr = Math.pow(10, S.jnr / 10)
    // R = I + Σ JNR·a(θᵢ)a(θᵢ)ᴴ（σ² = 1，正定，无需额外加载）
    const R = []
    for (let r = 0; r < N; r++) {
      R[r] = []
      for (let c = 0; c < N; c++) R[r][c] = r === c ? [1, 0] : [0, 0]
    }
    jamDegs.forEach((deg) => {
      const a = this.steer(deg)
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          const t = cmul(a[r], conj(a[c]))
          R[r][c] = cadd(R[r][c], [jnr * t[0], jnr * t[1]])
        }
      }
    })
    const x = this.solveComplex(R, as)          // x = R⁻¹a(θs)
    const den = this.inner(as, x)               // a(θs)ᴴR⁻¹a(θs)，实、正
    return x.map((z) => cdiv(z, den))
  },

  // 阵列响应 |wᴴa(θ)|
  resp(deg, wg) {
    const a = this.steer(deg)
    let z = [0, 0]
    for (let n = 0; n < a.length; n++) z = cadd(z, cmul(conj(wg[n]), a[n]))
    return cmag(z)
  },

  db(v, ref) { return 20 * Math.log10(Math.max(v, 1e-12) / Math.max(ref || 1, 1e-12)) },
  fmtDb(v) { return v <= -100 ? '< −100 dB' : v.toFixed(1) + ' dB' },

  // ═══ 更新 ═══
  update() {
    const S = this.data.S
    const d = S.d100 / 100
    const wg = this.computeWeights()

    // 方向图采样 −90°..+90°，步距 0.5°
    const vals = []
    let peak = 1e-12, peakDeg = 0
    for (let k = 0; k <= 360; k++) {
      const deg = -90 + k * 0.5
      const v = this.resp(deg, wg)
      vals.push(v)
      if (v > peak) { peak = v; peakDeg = deg }
    }

    const tR = this.resp(S.sig, wg)
    const n1 = this.db(this.resp(S.jam1, wg), tR)
    const n2 = S.dual ? this.db(this.resp(S.jam2, wg), tR) : null
    const norm = Math.sqrt(wg.reduce((s, z) => s + z[0] * z[0] + z[1] * z[1], 0))

    this._vals = vals; this._peak = peak; this._wg = wg; this._norm = norm

    // 警示：干扰进入主瓣（HPBW ≈ 0.886λ/(Nd)）/ 栅瓣
    const hpbwDeg = rf.hpbwUniformApprox(S.N, d) * 180 / Math.PI
    const warns = []
    if (Math.abs(S.jam1 - S.sig) < hpbwDeg / 2) warns.push('干扰1 进入主瓣：零陷变浅、‖w‖ 激增')
    if (S.dual && Math.abs(S.jam2 - S.sig) < hpbwDeg / 2) warns.push('干扰2 进入主瓣：零陷变浅、‖w‖ 激增')
    if (d >= rf.gratingLobeLimit(S.sig * Math.PI / 180)) warns.push('d/λ ≥ 1/(1+|sinθs|)，出现栅瓣')

    this.setData({
      stats: {
        null1: this.fmtDb(n1),
        null2: S.dual ? this.fmtDb(n2) : '—',
        beam: peakDeg.toFixed(1) + '°',
        norm: norm.toFixed(2),
      },
      warn: warns.join('；'),
    })
    this.drawPattern()
    this.drawWeights()
  },

  // ═══ 方向图（直角坐标 dB）═══
  drawPattern() {
    if (!this._vals) return
    lc.mount(this, '#patternCanvas', (ctx, w, h) => {
      lc.clear(ctx, w, h)
      const S = this.data.S
      const vals = this._vals, peak = this._peak
      const box = { x: 50, y: 24, w: w - 66, h: h - 62 }
      const p = lc.plot(ctx, box, [-90, 90], [-80, 0])
      p.axes({
        xTicks: [-90, -60, -30, 0, 30, 60, 90],
        yTicks: [0, -20, -40, -60, -80],
        xFmt: (v) => v + '°',
        xLabel: 'θ（°）',
        yLabel: '|wᴴa(θ)|（dB re 峰值）',
      })
      const xs = [], ys = []
      for (let k = 0; k <= 360; k++) {
        xs.push(-90 + k * 0.5)
        ys.push(Math.max(-80, this.db(vals[k], peak)))
      }
      p.area(xs, ys, THEME.accent)
      p.line(xs, ys, THEME.accent, 2)

      // 方向标记（颜色与滑条标签一一对应）
      const mark = (deg, color, name, row) => {
        p.guideX(deg, alpha(color, 0.7))
        const x = p.X(deg)
        const flip = x > box.x + box.w - 64
        lc.label(ctx, name, x + (flip ? -4 : 4), box.y + 12 + row * 14, {
          align: flip ? 'right' : 'left', color, font: THEME.fontLabel,
        })
      }
      mark(S.sig, THEME.teal, '目标 ' + S.sig + '°', 0)
      mark(S.jam1, THEME.indigo, '干扰1 ' + S.jam1 + '°', 1)
      if (S.dual) mark(S.jam2, THEME.gold, '干扰2 ' + S.jam2 + '°', 2)
    })
  },

  // ═══ 权值图：上 = 幅度柱状，下 = 相位针 ═══
  drawWeights() {
    if (!this._wg) return
    lc.mount(this, '#weightsCanvas', (ctx, w, h) => {
      lc.clear(ctx, w, h)
      const wg = this._wg
      const N = wg.length
      const mags = wg.map(cmag)
      const phs = wg.map((z) => Math.atan2(z[1], z[0]) * 180 / Math.PI)
      const ymax = Math.max(...mags, 1e-6) * 1.2
      const boxA = { x: 56, y: 22, w: w - 74, h: (h - 96) * 0.56 }
      const boxP = { x: 56, y: boxA.y + boxA.h + 36, w: w - 74, h: (h - 96) * 0.44 }
      const xt = []
      const st = N > 16 ? 4 : N > 8 ? 2 : 1
      for (let n = 1; n <= N; n += st) xt.push(n)

      // 幅度 |wₙ|（坐标轴随范数缩放，权值发散一目了然）
      const pa = lc.plot(ctx, boxA, [0.5, N + 0.5], [0, ymax])
      pa.axes({ xTicks: xt, xFmt: (v) => String(v), yTicks: lc.niceTicks(0, ymax, 3), yLabel: '|wₙ|' })
      const bw2 = boxA.w / N * 0.55
      for (let n = 0; n < N; n++) {
        const x = pa.X(n + 1)
        const y = pa.Y(mags[n])
        ctx.fillStyle = THEME.accent
        ctx.fillRect(x - bw2 / 2, y, bw2, boxA.y + boxA.h - y)
      }
      // 均匀阵参考 |wₙ| = 1/N
      if (1 / N <= ymax) {
        pa.guideY(1 / N, alpha(THEME.teal, 0.8))
        lc.label(ctx, '均匀阵 1/N', boxA.x + boxA.w, pa.Y(1 / N) - 5, {
          align: 'right', color: THEME.teal, font: THEME.fontTick,
        })
      }
      lc.label(ctx, '‖w‖ = ' + this._norm.toFixed(2) + '（静态 1/√N = ' + (1 / Math.sqrt(N)).toFixed(2) + '）',
        boxA.x + boxA.w, boxA.y - 8, { align: 'right', color: THEME.ink, font: THEME.fontLabel })

      // 相位 ∠wₙ
      const pp = lc.plot(ctx, boxP, [0.5, N + 0.5], [-180, 180])
      pp.axes({
        xTicks: xt, xFmt: (v) => String(v),
        yTicks: [-180, -90, 0, 90, 180],
        yLabel: '∠wₙ（°）', xLabel: '阵元 n',
      })
      pp.guideY(0)
      ctx.strokeStyle = THEME.indigo; ctx.lineWidth = 2; ctx.lineCap = 'round'
      for (let n = 0; n < N; n++) {
        const x = pp.X(n + 1)
        ctx.beginPath(); ctx.moveTo(x, pp.Y(0)); ctx.lineTo(x, pp.Y(phs[n])); ctx.stroke()
      }
      for (let n = 0; n < N; n++) {
        ctx.fillStyle = THEME.indigo
        ctx.beginPath(); ctx.arc(pp.X(n + 1), pp.Y(phs[n]), 2.5, 0, Math.PI * 2); ctx.fill()
      }
    })
  },

  onShareAppMessage() {
    return { title: '智能天线 · MVDR 自适应零陷', path: '/pages/interactive/smart-array/smart-array' }
  },
})

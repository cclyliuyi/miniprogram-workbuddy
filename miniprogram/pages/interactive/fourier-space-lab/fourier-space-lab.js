// pages/interactive/fourier-space-lab/fourier-space-lab.js —— 傅里叶空间实验室
// 4 种模式共用同一傅里叶结构：时-频 / 口径-方向图 / 阵列-阵因子 / 波包-波数谱
// 物理模型全部真实（无魔法系数）：
//   高斯对：x(t)=e^(−t²/2σt²) ↔ |X(f)|=e^(−f²/2σf²)，σf = 1/(2πσt)
//   口径方向图：F(sinθ) = ∫Ea(x)·e^(j2πx·sinθ/λ)dx —— 128 点数值积分
//   阵因子：ψ = 2π(d/λ)·sinθ，|AF| 用 rf.afWeighted（左右共用同一组权重）
//   波包：ψ(x)=e^(−x²/4σx²)cos(k₀x)，谱中心 ±k₀，σk = 1/(2σx)（高斯下限）

const haptic = require('../../../utils/haptic')
const rf = require('../../../utils/rf-math')
const lc = require('../../../utils/lab-canvas')
const { THEME } = require('../../../utils/lab-theme')

const N_EL = 13   // 阵元数（固定）
const K0 = 12     // 不确定性模式载波波数 rad/单位长度

const LABELS = {
  signal: { left: '时间波形 x(t)（高斯脉冲）', right: '幅度谱 |X(f)|' },
  aperture: { left: '口径场分布 Ea(x)（余弦-台座渐削）', right: '远场方向图 |F(sinθ)|（dB，数值积分）' },
  array: { left: '阵元权重 wₙ（对连续渐削包络的采样）', right: '阵因子 |AF(sinθ)|（dB）' },
  uncertainty: { left: '空间波包 ψ(x) = 包络 × cos(k₀x)', right: '波数谱 |Ψ(k)|（中心 ±k₀）' },
}
const WIDTH_NAMES = { signal: '脉宽 σt', aperture: '口径 a', uncertainty: '波包宽 σx' }

const NOTES = [
  { m: 'signal', t: '宽窄互补：σt·σf = 1/(2π) 恒定，脉冲越宽频谱越窄' },
  { m: 'aperture', t: '口径越大主瓣越窄；边缘渐削压低副瓣，代价是主瓣展宽、口径效率下降' },
  { m: 'array', t: '阵列是连续口径的采样：采样使谱周期复制，d/λ ≥ 1 时复制谱进入可见区成为栅瓣' },
  { m: 'uncertainty', t: 'σx·σk = 1/2：高斯波包取到不确定性下限；载波 k₀ 只把谱平移到 ±k₀，不改变宽度' },
]

Page({
  data: {
    S: { mode: 'signal', width: 46, spacing: 58, taper: 25 },
    leftLabel: LABELS.signal.left,
    rightLabel: LABELS.signal.right,
    widthName: WIDTH_NAMES.signal,
    vals: { width: '', spacing: '' },
    stats: [],
    notes: NOTES,
  },

  onLoad() { this.update() },
  onReady() { this.update() },

  // ═══ 事件 ═══
  onWidth(e) { this.setData({ 'S.width': e.detail.value }, () => this.update()) },
  onSpacing(e) { this.setData({ 'S.spacing': e.detail.value }, () => this.update()) },
  onTaper(e) { this.setData({ 'S.taper': e.detail.value }, () => this.update()) },
  setMode(e) {
    haptic.light()
    const m = e.currentTarget.dataset.m
    if (!LABELS[m]) return
    this.setData({
      'S.mode': m,
      leftLabel: LABELS[m].left,
      rightLabel: LABELS[m].right,
      widthName: WIDTH_NAMES[m] || '',
    }, () => this.update())
  },

  // ═══ 物理模型（每次参数变化重算，无过期结果）═══
  model() {
    const S = this.data.S
    const T = S.taper / 100
    const m = { mode: S.mode, T }
    if (S.mode === 'signal') {
      m.sigT = S.width / 100                    // ns
      m.sigF = 1 / (2 * Math.PI * m.sigT)       // GHz（高斯对精确关系）
    } else if (S.mode === 'aperture') {
      m.aLam = S.width / 10                     // a/λ ∈ [1.2, 9.0]
      m.pat = this._aperturePattern(m.aLam, T)
      m.hpbw = this._hpbwDeg(m.pat.us, m.pat.dbs)
      m.sll = this._sllDb(m.pat.dbs)
    } else if (S.mode === 'array') {
      m.dLam = S.spacing / 100                  // d/λ ∈ [0.25, 1.2]
      m.weights = []
      for (let n = 0; n < N_EL; n++) {
        const p = n - (N_EL - 1) / 2
        m.weights.push(1 - T + T * Math.pow(Math.cos(Math.PI * p / (N_EL - 1)), 2))
      }
      m.pat = this._arrayPattern(m.weights, m.dLam)
      m.hpbw = this._hpbwDeg(m.pat.us, m.pat.dbs)
      m.glU = 1 / m.dLam                        // 栅瓣位置 sinθ = ±λ/d
    } else {
      m.sigX = S.width / 100                    // 任意长度单位
      m.sigK = 1 / (2 * m.sigX)                 // 高斯下限（|·|² 标准差约定）
      m.k0 = K0
    }
    return m
  },

  // 口径分布的数值傅里叶积分：F(u) = Σ Ea(xᵢ)·e^(j2πxᵢu)，u = sinθ
  _aperturePattern(aLam, T) {
    const M = 128, NP = 241
    const xs = [], es = []
    let f0 = 0
    for (let i = 0; i < M; i++) {
      const x = (i / (M - 1) - 0.5) * aLam      // x/λ
      const e = 1 - T + T * Math.pow(Math.cos(Math.PI * x / aLam), 2)
      xs.push(x); es.push(e); f0 += e
    }
    const us = [], dbs = []
    for (let j = 0; j < NP; j++) {
      const u = -1 + 2 * j / (NP - 1)
      let re = 0, im = 0
      for (let i = 0; i < M; i++) {
        const ph = 2 * Math.PI * xs[i] * u
        re += es[i] * Math.cos(ph)
        im += es[i] * Math.sin(ph)
      }
      us.push(u)
      dbs.push(Math.max(-40, 20 * Math.log10(Math.max(Math.hypot(re, im) / f0, 1e-4))))
    }
    return { us, dbs }
  },

  // 阵因子：ψ = 2π(d/λ)·sinθ（宽边 β=0），rf.afWeighted 已归一化
  _arrayPattern(weights, dLam) {
    const NP = 241
    const us = [], dbs = []
    for (let j = 0; j < NP; j++) {
      const u = -1 + 2 * j / (NP - 1)
      const af = rf.afWeighted(weights, 2 * Math.PI * dLam * u)
      us.push(u)
      dbs.push(Math.max(-40, 20 * Math.log10(Math.max(af, 1e-4))))
    }
    return { us, dbs }
  },

  // 从计算好的方向图实测 −3dB 波束宽度（度）
  _hpbwDeg(us, dbs) {
    const c = (us.length - 1) / 2
    for (let i = c; i < us.length - 1; i++) {
      if (dbs[i] >= -3 && dbs[i + 1] < -3) {
        const f = (-3 - dbs[i]) / (dbs[i + 1] - dbs[i])
        const u3 = us[i] + f * (us[i + 1] - us[i])
        if (u3 > 1) return null
        return 2 * Math.asin(Math.min(1, u3)) * 180 / Math.PI
      }
    }
    return null
  },

  // 实测最高副瓣电平：主瓣首个局部极小之外的最大值
  _sllDb(dbs) {
    const c = (dbs.length - 1) / 2
    let i = c
    while (i < dbs.length - 1 && dbs[i + 1] <= dbs[i]) i++
    if (i >= dbs.length - 1) return null
    let m = -99
    for (let j = i; j < dbs.length; j++) m = Math.max(m, dbs[j])
    return m
  },

  // ═══ 读数与重绘 ═══
  update() {
    const m = this.model()
    this._m = m
    const S = this.data.S
    let widthVal = '', stats = []
    if (m.mode === 'signal') {
      widthVal = m.sigT.toFixed(2) + ' ns'
      stats = [
        { label: '脉宽 σt', value: m.sigT.toFixed(2) + ' ns', cls: 'tp-c-accent' },
        { label: '谱宽 σf = 1/(2πσt)', value: m.sigF.toFixed(2) + ' GHz', cls: 'tp-c-teal' },
        { label: '时频积 σt·σf（恒定）', value: '1/(2π) ≈ 0.159', cls: 'tp-c-indigo', wide: true },
      ]
    } else if (m.mode === 'aperture') {
      widthVal = m.aLam.toFixed(1) + ' λ'
      stats = [
        { label: '口径宽度 a/λ', value: m.aLam.toFixed(1), cls: 'tp-c-accent' },
        { label: '实测 HPBW', value: m.hpbw == null ? '—' : m.hpbw.toFixed(1) + '°', cls: 'tp-c-teal' },
        { label: '实测最高副瓣', value: m.sll == null ? '—' : m.sll.toFixed(1) + ' dB', cls: 'tp-c-gold' },
        { label: '边缘台座 1−T', value: (1 - m.T).toFixed(2), cls: 'tp-c-indigo' },
      ]
    } else if (m.mode === 'array') {
      widthVal = ''
      const gl = m.glU <= 1
        ? { label: '栅瓣位置 sinθ = ±λ/d', value: '±' + m.glU.toFixed(2), cls: 'tp-c-danger' }
        : { label: '栅瓣（λ/d = ' + m.glU.toFixed(2) + '）', value: '可见区外', cls: 'tp-c-teal' }
      stats = [
        { label: '阵元间距 d/λ（N=13）', value: m.dLam.toFixed(2), cls: 'tp-c-accent' },
        { label: '实测 HPBW', value: m.hpbw == null ? '—' : m.hpbw.toFixed(1) + '°', cls: 'tp-c-gold' },
        gl,
      ]
    } else {
      widthVal = 'σx = ' + m.sigX.toFixed(2)
      stats = [
        { label: '波包宽 σx', value: m.sigX.toFixed(2), cls: 'tp-c-accent' },
        { label: '谱宽 σk = 1/(2σx)', value: m.sigK.toFixed(2), cls: 'tp-c-teal' },
        { label: '不确定性积 σx·σk（高斯取等号）', value: '0.500', cls: 'tp-c-indigo', wide: true },
      ]
    }
    this.setData({
      vals: { width: widthVal, spacing: 'd/λ = ' + (S.spacing / 100).toFixed(2) },
      stats,
    }, () => this.draw())
  },

  draw() {
    if (!this._m) this._m = this.model()
    lc.mount(this, '#leftCanvas', (ctx, w, h) => this._drawLeft(ctx, w, h))
    lc.mount(this, '#rightCanvas', (ctx, w, h) => this._drawRight(ctx, w, h))
  },

  // ═══ 左画布：分布 ═══
  _drawLeft(ctx, w, h) {
    lc.clear(ctx, w, h)
    const m = this._m
    const box = { x: 46, y: 18, w: w - 62, h: h - 52 }

    if (m.mode === 'signal') {
      const p = lc.plot(ctx, box, [-3, 3], [0, 1.12])
      p.axes({ xTicks: [-3, -2, -1, 0, 1, 2, 3], yTicks: [0, 0.5, 1], xLabel: 't（ns）', yLabel: 'x(t)' })
      const xs = [], ys = []
      for (let i = 0; i <= 240; i++) {
        const t = -3 + 6 * i / 240
        xs.push(t); ys.push(Math.exp(-t * t / (2 * m.sigT * m.sigT)))
      }
      p.area(xs, ys, THEME.accent, 0)
      p.line(xs, ys, THEME.accent, 2)
      p.guideX(-m.sigT); p.guideX(m.sigT)
      lc.label(ctx, 'σt = ' + m.sigT.toFixed(2) + ' ns', p.X(m.sigT) + 5, p.Y(0.62), { color: THEME.accent })
    } else if (m.mode === 'aperture') {
      const p = lc.plot(ctx, box, [-5, 5], [0, 1.15])
      p.axes({ xTicks: [-4, -2, 0, 2, 4], yTicks: [0, 0.5, 1], xLabel: 'x/λ', yLabel: 'Ea' })
      const xs = [], ys = []
      for (let i = 0; i <= 320; i++) {
        const x = -5 + 10 * i / 320
        xs.push(x)
        ys.push(Math.abs(x) <= m.aLam / 2
          ? 1 - m.T + m.T * Math.pow(Math.cos(Math.PI * x / m.aLam), 2) : 0)
      }
      p.area(xs, ys, THEME.accent, 0)
      p.line(xs, ys, THEME.accent, 2)
      lc.label(ctx, 'a = ' + m.aLam.toFixed(1) + ' λ', p.X(0), p.Y(1.08),
        { align: 'center', color: THEME.ink, font: THEME.fontLabel })
      lc.label(ctx, '边缘 1−T = ' + (1 - m.T).toFixed(2), p.X(-m.aLam / 2) - 5, p.Y(1 - m.T) - 6,
        { align: 'right', color: THEME.teal })
    } else if (m.mode === 'array') {
      const p = lc.plot(ctx, box, [-8, 8], [0, 1.15])
      p.axes({ xTicks: [-8, -4, 0, 4, 8], yTicks: [0, 0.5, 1], xLabel: 'x/λ', yLabel: 'wₙ' })
      // 连续渐削包络（与阵元权重同一公式，虚线）
      const half = (N_EL - 1) / 2 * m.dLam
      const xs = [], ys = []
      for (let i = 0; i <= 200; i++) {
        const x = -half + 2 * half * i / 200
        xs.push(x)
        ys.push(1 - m.T + m.T * Math.pow(Math.cos(Math.PI * x / (2 * half || 1)), 2))
      }
      ctx.save(); ctx.setLineDash([4, 4])
      p.line(xs, ys, THEME.teal, 1.5)
      ctx.restore()
      // 阵元采样杆（与右图 afWeighted 共用同一 weights）
      for (let n = 0; n < N_EL; n++) {
        const x = (n - (N_EL - 1) / 2) * m.dLam
        ctx.strokeStyle = THEME.accent; ctx.lineWidth = 2; ctx.lineCap = 'round'
        ctx.beginPath(); ctx.moveTo(p.X(x), p.Y(0)); ctx.lineTo(p.X(x), p.Y(m.weights[n])); ctx.stroke()
        lc.dot(ctx, p.X(x), p.Y(m.weights[n]), THEME.accent, 3)
      }
      lc.legend(ctx, [
        { name: '阵元权重 wₙ', color: THEME.accent },
        { name: '连续渐削包络', color: THEME.teal },
      ], box.x + 6, box.y + 8)
    } else {
      const p = lc.plot(ctx, box, [-3, 3], [-1.18, 1.18])
      p.axes({ xTicks: [-3, -2, -1, 0, 1, 2, 3], yTicks: [-1, 0, 1], xLabel: 'x（任意单位）', yLabel: 'ψ(x)' })
      const xs = [], env = [], envN = [], wav = []
      for (let i = 0; i <= 300; i++) {
        const x = -3 + 6 * i / 300
        const e = Math.exp(-x * x / (4 * m.sigX * m.sigX))
        xs.push(x); env.push(e); envN.push(-e); wav.push(e * Math.cos(m.k0 * x))
      }
      ctx.save(); ctx.setLineDash([4, 4])
      p.line(xs, env, THEME.teal, 1.5)
      p.line(xs, envN, THEME.teal, 1.5)
      ctx.restore()
      p.line(xs, wav, THEME.accent, 2)
      p.guideX(-m.sigX); p.guideX(m.sigX)
      lc.label(ctx, '±σx', p.X(m.sigX) + 4, p.Y(-0.9), { color: THEME.inkSoft })
      lc.legend(ctx, [
        { name: '波包 ψ(x)', color: THEME.accent },
        { name: '包络 e^(−x²/4σx²)', color: THEME.teal },
      ], box.x + 6, box.y + 8)
    }
  },

  // ═══ 右画布：对偶谱 ═══
  _drawRight(ctx, w, h) {
    lc.clear(ctx, w, h)
    const m = this._m
    const box = { x: 46, y: 18, w: w - 62, h: h - 52 }

    if (m.mode === 'signal') {
      const p = lc.plot(ctx, box, [-2, 2], [0, 1.12])
      p.axes({ xTicks: [-2, -1, 0, 1, 2], yTicks: [0, 0.5, 1], xLabel: 'f（GHz）', yLabel: '|X(f)|' })
      const xs = [], ys = []
      for (let i = 0; i <= 240; i++) {
        const f = -2 + 4 * i / 240
        xs.push(f); ys.push(Math.exp(-f * f / (2 * m.sigF * m.sigF)))
      }
      p.area(xs, ys, THEME.teal, 0)
      p.line(xs, ys, THEME.teal, 2)
      p.guideX(-m.sigF); p.guideX(m.sigF)
      lc.label(ctx, 'σf = ' + m.sigF.toFixed(2) + ' GHz', p.X(m.sigF) + 5, p.Y(0.62), { color: THEME.teal })
      lc.label(ctx, 'σt·σf = 1/(2π)', box.x + box.w, box.y - 6,
        { align: 'right', color: THEME.ink, font: THEME.fontLabel })
    } else if (m.mode === 'aperture') {
      const p = lc.plot(ctx, box, [-1, 1], [-40, 2])
      p.axes({
        xTicks: [-1, -0.5, 0, 0.5, 1], yTicks: [0, -10, -20, -30, -40],
        xLabel: 'sinθ', yLabel: '|F|（dB）',
      })
      p.area(m.pat.us, m.pat.dbs, THEME.teal, -40)
      p.line(m.pat.us, m.pat.dbs, THEME.teal, 2)
      if (m.sll != null) {
        p.guideY(m.sll, THEME.gold)
        lc.label(ctx, 'SLL ' + m.sll.toFixed(1) + ' dB', box.x + box.w - 4, p.Y(m.sll) - 5,
          { align: 'right', color: THEME.gold })
      }
      lc.label(ctx, 'HPBW ≈ ' + (m.hpbw == null ? '—' : m.hpbw.toFixed(1) + '°'),
        box.x + box.w, box.y - 6, { align: 'right', color: THEME.ink, font: THEME.fontLabel })
    } else if (m.mode === 'array') {
      const p = lc.plot(ctx, box, [-1, 1], [-40, 2])
      p.axes({
        xTicks: [-1, -0.5, 0, 0.5, 1], yTicks: [0, -10, -20, -30, -40],
        xLabel: 'sinθ', yLabel: '|AF|（dB）',
      })
      p.area(m.pat.us, m.pat.dbs, THEME.accent, -40)
      p.line(m.pat.us, m.pat.dbs, THEME.accent, 2)
      if (m.glU <= 1) {
        p.guideX(-m.glU, THEME.danger)
        p.guideX(m.glU, THEME.danger)
        lc.label(ctx, '栅瓣 sinθ = ±λ/d', p.X(0), box.y + 12,
          { align: 'center', color: THEME.danger })
      } else {
        lc.label(ctx, '栅瓣在可见区外（λ/d = ' + m.glU.toFixed(2) + ' > 1）', p.X(0), box.y + 12,
          { align: 'center', color: THEME.muted })
      }
      lc.label(ctx, 'd/λ = ' + m.dLam.toFixed(2) + ' · N = ' + N_EL,
        box.x + box.w, box.y - 6, { align: 'right', color: THEME.ink, font: THEME.fontLabel })
    } else {
      const p = lc.plot(ctx, box, [-25, 25], [0, 1.12])
      p.axes({ xTicks: [-20, -10, 0, 10, 20], yTicks: [0, 0.5, 1], xLabel: 'k（rad/单位）', yLabel: '|Ψ(k)|' })
      const xs = [], ys = []
      let peak = 0
      for (let i = 0; i <= 300; i++) {
        const k = -25 + 50 * i / 300
        const v = Math.exp(-Math.pow(k - m.k0, 2) / (4 * m.sigK * m.sigK)) +
          Math.exp(-Math.pow(k + m.k0, 2) / (4 * m.sigK * m.sigK))
        xs.push(k); ys.push(v); peak = Math.max(peak, v)
      }
      for (let i = 0; i < ys.length; i++) ys[i] /= peak
      p.area(xs, ys, THEME.teal, 0)
      p.line(xs, ys, THEME.teal, 2)
      p.guideX(-m.k0); p.guideX(m.k0)
      lc.label(ctx, '−k₀', p.X(-m.k0), box.y + 12, { align: 'center', color: THEME.inkSoft })
      lc.label(ctx, '+k₀', p.X(m.k0), box.y + 12, { align: 'center', color: THEME.inkSoft })
      lc.label(ctx, 'σk = 1/(2σx) = ' + m.sigK.toFixed(2), box.x + box.w, box.y - 6,
        { align: 'right', color: THEME.ink, font: THEME.fontLabel })
    }
  },

  onShareAppMessage() {
    return { title: '傅里叶空间实验室', path: '/pages/interactive/fourier-space-lab/fourier-space-lab' }
  },
})

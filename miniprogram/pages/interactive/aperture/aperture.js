// pages/interactive/aperture/aperture.js —— 口径场与波束宽度
// 物理模型（Balanis 4th, Ch.12 口径天线）：
//   矩形口径（一维线源，H 面切面）：
//     AF(θ) = ∫₋₁¹ E(x)·e^{j k x' sinθ} dx，x' = x·D/2 → 相位 = π(D/λ)·x·sinθ
//     均匀照明解析解 AF ∝ sinc(πD sinθ/λ)，HPBW ≈ 0.886 λ/D，SLL ≈ −13.26 dB
//   圆形口径（径向对称）：
//     AF(θ) = ∫₀¹ E(ρ)·J₀(π(D/λ)·ρ·sinθ)·ρ dρ
//     均匀照明解析解 AF ∝ 2J₁(u)/u（Airy），HPBW ≈ 1.028 λ/D，SLL ≈ −17.57 dB
//   口径（锥削）效率：线源 η = (∫E dx)²/(L∫E²dx)；圆口径 η = 2(∫Eρdρ)²/∫E²ρdρ
//   指向性：线源 D₀ = (2L/λ)·η；圆口径 D₀ = (πD/λ)²·η（rf.circAperGain）

const haptic = require('../../../utils/haptic')
const rf = require('../../../utils/rf-math')
const lc = require('../../../utils/lab-canvas')
const { THEME, alpha } = require('../../../utils/lab-theme')

const ILLUM_NAMES = { uniform: '均匀', cosine: '余弦', tapered: '抛物线锥削' }

// Bessel J₀（Numerical Recipes 有理近似，|误差|<1e-7）。
// rf-math 只提供 J₁（均匀圆口径用）；任意径向照明的积分核需要 J₀，故在此实现。
function besselJ0(x) {
  const ax = Math.abs(x)
  if (ax < 8) {
    const y = x * x
    const p1 = 57568490574.0 + y * (-13362590354.0 + y * (651619640.7 +
      y * (-11214424.18 + y * (77392.33017 + y * (-184.9052456)))))
    const p2 = 57568490411.0 + y * (1029532985.0 + y * (9494680.718 +
      y * (59272.64853 + y * (267.8532712 + y))))
    return p1 / p2
  }
  const z = 8 / ax, y = z * z, xx = ax - 0.785398164
  const p1 = 1.0 + y * (-0.1098628627e-2 + y * (0.2734510407e-4 +
    y * (-0.2073370639e-5 + y * 0.2093887211e-6)))
  const p2 = -0.1562499995e-1 + y * (0.1430488765e-3 + y * (-0.6911147651e-5 +
    y * (0.7621095161e-6 + y * (-0.934935152e-7))))
  return Math.sqrt(0.636619772 / ax) * (Math.cos(xx) * p1 - z * Math.sin(xx) * p2)
}

Page({
  data: {
    S: {
      shape: 'rect',    // rect | circ
      D: 8,             // 口径尺寸 (λ)
      tap: -10,         // 边缘锥削 dB（仅 tapered 模式生效）
      illum: 'uniform', // uniform | cosine | tapered
    },
    stats: null,
    illumName: ILLUM_NAMES.uniform,
  },

  onLoad() { this.update() },
  onReady() { this.update() },

  // ═══ 事件 ═══
  onD(e) { this.setData({ 'S.D': e.detail.value }, () => this.update()) },
  onTap(e) { this.setData({ 'S.tap': e.detail.value }, () => this.update()) },
  setShape(e) {
    const s = e.currentTarget.dataset.s
    if (s !== 'rect' && s !== 'circ') return
    haptic.light()
    this.setData({ 'S.shape': s }, () => this.update())
  },
  setIllum(e) {
    const illum = e.currentTarget.dataset.i
    if (!ILLUM_NAMES[illum]) return
    haptic.light()
    this.setData({ 'S.illum': illum, illumName: ILLUM_NAMES[illum] }, () => this.update())
  },

  // ═══ 照明函数 E(t)，t = |x|（矩形）或 ρ（圆形），t ∈ [0,1] ═══
  illumE(t, S) {
    switch (S.illum) {
      case 'cosine': return Math.cos(t * Math.PI / 2)
      case 'tapered': {
        const edge = Math.pow(10, S.tap / 20) // 边缘电平（线性）
        return 1 - (1 - edge) * t * t          // parabolic-on-pedestal
      }
      default: return 1.0
    }
  },

  // ═══ 远场方向图（数值积分，θ 均匀采样）═══
  // 矩形：E 为偶函数 → AF ∝ ∫₀¹ E(x)·cos(πD x sinθ) dx
  // 圆形：AF ∝ ∫₀¹ E(ρ)·J₀(πD ρ sinθ)·ρ dρ
  computePattern(S) {
    S = S || this.data.S
    const D = S.D
    const circ = S.shape === 'circ'
    const samples = 721   // 0.25° 角度步长
    const Nint = 240      // 积分采样（中点法）
    const dt = 1 / Nint
    const ts = [], Es = []
    for (let j = 0; j < Nint; j++) {
      const t = (j + 0.5) * dt
      ts.push(t)
      Es.push(this.illumE(t, S))
    }
    let af0 = 0 // θ=0 归一化因子
    for (let j = 0; j < Nint; j++) af0 += (circ ? Es[j] * ts[j] : Es[j]) * dt

    const thetas = [], dBs = []
    for (let i = 0; i < samples; i++) {
      const theta = -90 + 180 * i / (samples - 1)
      const u = Math.PI * D * Math.sin(theta * Math.PI / 180) // π(D/λ)sinθ
      let af = 0
      if (circ) {
        for (let j = 0; j < Nint; j++) af += Es[j] * besselJ0(u * ts[j]) * ts[j] * dt
      } else {
        for (let j = 0; j < Nint; j++) af += Es[j] * Math.cos(u * ts[j]) * dt
      }
      const norm = af0 > 0 ? Math.abs(af) / af0 : 0
      thetas.push(theta)
      dBs.push(norm > 1e-6 ? 20 * Math.log10(norm) : -120)
    }
    return { thetas, dBs }
  },

  // ═══ 统计 ═══
  computeStats(pat, S) {
    S = S || this.data.S
    pat = pat || this._pattern || this.computePattern(S)
    const { thetas, dBs } = pat
    const c = (thetas.length - 1) / 2 // θ=0 的下标

    // HPBW：-3 dB 交叉处线性插值
    const cross = (dir) => {
      for (let i = c; i + dir >= 0 && i + dir < dBs.length; i += dir) {
        const a = dBs[i], b = dBs[i + dir]
        if (a > -3 && b <= -3) {
          const f = (-3 - a) / (b - a)
          return thetas[i] + f * (thetas[i + dir] - thetas[i])
        }
      }
      return null
    }
    const thR = cross(1), thL = cross(-1)
    const hpbw = thR != null && thL != null ? thR - thL : null

    // 最大旁瓣：先找主瓣右侧第一零点（-3 dB 以下的首个极小值），再在其外侧取最大
    let nullIdx = null
    for (let i = c + 1; i < dBs.length - 1; i++) {
      if (dBs[i] < -3 && dBs[i + 1] > dBs[i]) { nullIdx = i; break }
    }
    let sll = null, sllTheta = null
    if (nullIdx != null) {
      for (let i = nullIdx + 1; i < dBs.length; i++) {
        if (sll == null || dBs[i] > sll) { sll = dBs[i]; sllTheta = thetas[i] }
      }
    }

    // 口径（锥削）效率
    const Nint = 240, dt = 1 / Nint
    let i1 = 0, i2 = 0 // ∫E·w dt、∫E²·w dt，w = ρ（圆）或 1（矩形半口径）
    for (let j = 0; j < Nint; j++) {
      const t = (j + 0.5) * dt
      const E = this.illumE(t, S)
      const wgt = S.shape === 'circ' ? t : 1
      i1 += E * wgt * dt
      i2 += E * E * wgt * dt
    }
    // 线源：η = (2·i1)²/(L·2·i2)，L=2 → i1²/i2；圆口径：η = 2·i1²/i2
    const eta = i2 > 0 ? (S.shape === 'circ' ? 2 : 1) * i1 * i1 / i2 : 1

    // 指向性：线源 D₀ = 2L/λ·η；圆口径 D₀ = (πD/λ)²·η（λ=1 m ⇔ f=C0）
    const dirLin = S.shape === 'circ' ? rf.circAperGain(S.D, rf.C0, eta) : 2 * S.D * eta
    const directivity = rf.linToDb(dirLin)

    this._marks = { thL, thR, sll, sllTheta }
    return {
      hpbw: hpbw != null ? hpbw.toFixed(2) + '°' : '—',
      sll: sll != null && sll > -100 ? sll.toFixed(1) + ' dB' : '—',
      efficiency: (eta * 100).toFixed(1) + '%',
      directivity: directivity.toFixed(1) + ' dBi',
      dirLabel: S.shape === 'circ' ? '指向性 D₀（圆口径）' : '指向性 D₀（一维线源）',
    }
  },

  // ═══ 更新 + 绘图 ═══
  update() {
    const S = this.data.S
    const pattern = this.computePattern(S)
    const stats = this.computeStats(pattern, S)
    this._pattern = pattern
    this.setData({ stats })
    this.drawPattern()
    this.drawIllum()
  },

  // ═══ 远场方向图 ═══
  drawPattern() {
    lc.mount(this, '#patternCanvas', (ctx, w, h) => {
      lc.clear(ctx, w, h)
      const pat = this._pattern
      if (!pat) return
      const S = this.data.S
      const box = { x: 46, y: 20, w: w - 62, h: h - 58 }
      const p = lc.plot(ctx, box, [-90, 90], [-60, 0])
      p.axes({
        xTicks: [-90, -60, -30, 0, 30, 60, 90],
        yTicks: [-60, -50, -40, -30, -20, -10, 0],
        xFmt: (v) => v + '°',
        xLabel: 'θ（°）',
        yLabel: '归一化 AF（dB）',
      })

      // -3 dB 半功率参考线
      p.guideY(-3, alpha(THEME.indigo, 0.55))
      lc.label(ctx, '−3 dB', box.x + box.w - 4, p.Y(-3) - 5, {
        align: 'right', color: THEME.indigo, font: THEME.fontTick,
      })

      const ys = pat.dBs.map((v) => Math.max(v, -60))
      p.area(pat.thetas, ys, THEME.accent, -60)
      p.line(pat.thetas, ys, THEME.accent, 2)

      const m = this._marks || {}
      if (m.thL != null && m.thR != null) {
        p.dot(m.thL, -3, THEME.indigo, 3.5)
        p.dot(m.thR, -3, THEME.indigo, 3.5)
        lc.label(ctx, 'HPBW ' + (m.thR - m.thL).toFixed(2) + '°', p.X(0), p.Y(-3) - 14, {
          align: 'center', color: THEME.ink, font: THEME.fontLabel,
        })
      }
      if (m.sll != null && m.sll > -58) {
        p.dot(m.sllTheta, m.sll, THEME.gold, 3.5)
        lc.label(ctx, 'SLL ' + m.sll.toFixed(1) + ' dB', p.X(m.sllTheta) + 8, p.Y(m.sll) - 8, {
          color: THEME.gold, font: THEME.fontTick,
        })
      }
      lc.legend(ctx, [{
        name: (S.shape === 'circ' ? '圆口径' : '矩形口径') + ' · ' + ILLUM_NAMES[S.illum] + '照明',
        color: THEME.accent,
      }], box.x + 4, box.y + 8)
    })
  },

  // ═══ 口径照明分布 ═══
  drawIllum() {
    lc.mount(this, '#illumCanvas', (ctx, w, h) => {
      lc.clear(ctx, w, h)
      const S = this.data.S
      const circ = S.shape === 'circ'
      const box = { x: 46, y: 20, w: w - 62, h: h - 58 }
      const p = lc.plot(ctx, box, circ ? [0, 1] : [-1, 1], [0, 1.08])
      p.axes({
        xTicks: circ ? [0, 0.25, 0.5, 0.75, 1] : [-1, -0.5, 0, 0.5, 1],
        yTicks: [0, 0.25, 0.5, 0.75, 1],
        xLabel: circ ? 'ρ = r/(D/2)（径向归一化）' : 'x/(D/2)（归一化）',
        yLabel: 'E（归一化幅度）',
      })

      const N = 120, xs = [], ys = []
      for (let i = 0; i <= N; i++) {
        const xv = circ ? i / N : -1 + 2 * i / N
        xs.push(xv)
        ys.push(this.illumE(Math.abs(xv), S))
      }
      p.area(xs, ys, THEME.teal, 0)
      p.line(xs, ys, THEME.teal, 2)

      // 边缘电平标注
      const eEdge = this.illumE(1, S)
      const edgeTxt = eEdge > 1e-4 ? (20 * Math.log10(eEdge)).toFixed(1) + ' dB' : '−∞'
      p.dot(1, eEdge, THEME.teal, 3.5)
      lc.label(ctx, '边缘电平 ' + edgeTxt, p.X(1) - 8, p.Y(eEdge) - 10, {
        align: 'right', color: THEME.teal, font: THEME.fontTick,
      })
      lc.legend(ctx, [{
        name: ILLUM_NAMES[S.illum] + '照明 E' + (circ ? '(ρ)' : '(x)'),
        color: THEME.teal,
      }], box.x + 4, box.y + 8)
    })
  },

  onShareAppMessage() {
    return { title: '口径衍射 · 照明分布与波束宽度', path: '/pages/interactive/aperture/aperture' }
  },
})

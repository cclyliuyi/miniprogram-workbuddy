// pages/interactive/broadband-matching/broadband-matching.js —— 宽带匹配实验
// 物理模型（教学一阶模型，全部解析、无魔法系数）：
//   天线：串联谐振 Z(f) = R[1 + jQ(x − 1/x)]，x = f/f0（Pozar Ch.6）
//     偶极子 Q 由 Schelkunoff 平均特性阻抗导出：Za = 120(ln(2L/a) − 1)，Q = πZa/(4R)
//       （把振子视作开路传输线：X = −Za·cot(βl)，在 βl=π/2 处取斜率即得）
//     折合振子 R = 4×73 Ω（4:1 阻抗阶跃变换不改变 Q）
//     双锥 R = Zc = 120·ln cot(θh/2)（无限双锥特性阻抗，Balanis Ch.9），锥线模型 Q = πZc/(4R) = π/4
//   L 匹配：f0 处解析设计 Qm = √(R大/R小 − 1)（rf.lMatch 同式），逐频点算元件阻抗 → Zin(f)
//   指数渐变线（L = λ0）：小反射理论 Γ ≈ ½ln(R/Z0)·e^{−jβL}·sinc(βL) + Γant·e^{−j2βL}（Pozar 式 5.75）
//   Bode–Fano 带宽上限（串联谐振负载）：FBW·ln(1/|Γm|) ≤ π/Q

const haptic = require('../../../utils/haptic')
const rf = require('../../../utils/rf-math')
const lc = require('../../../utils/lab-canvas')
const { THEME, alpha } = require('../../../utils/lab-theme')

const Z0 = 50
const RL_MIN = 10                                 // 匹配门限 RL ≥ 10 dB
const GAMMA_M = Math.pow(10, -RL_MIN / 20)        // ≈ 0.316
const R_DIPOLE = 73                               // 半波偶极子谐振电阻（Balanis）

const ANTS = [
  { id: 'thin', name: '细偶极子' },
  { id: 'thick', name: '粗偶极子' },
  { id: 'folded', name: '折合振子' },
  { id: 'bicone', name: '双锥' },
]
const MATCHES = [
  { id: 'none', name: '无匹配' },
  { id: 'l', name: 'L 匹配' },
  { id: 'taper', name: '指数渐变线' },
]
const SLEN_PRESET = { thin: 1000, thick: 60, folded: 700 }

Page({
  data: {
    S: { ant: 'thin', match: 'none', slen: 1000, cone: 30, spanPct: 55 },
    ants: ANTS,
    matches: MATCHES,
    stats: null,
  },

  onLoad() { this.update() },
  onReady() { this.update() },

  // ═══ 事件 ═══
  onSlen(e) { this.setData({ 'S.slen': e.detail.value }, () => this.update()) },
  onCone(e) { this.setData({ 'S.cone': e.detail.value }, () => this.update()) },
  onSpan(e) { this.setData({ 'S.spanPct': e.detail.value }, () => this.update()) },
  setAnt(e) {
    const a = e.currentTarget.dataset.a
    if (!ANTS.some((t) => t.id === a)) return
    haptic.light()
    const patch = { 'S.ant': a }
    if (SLEN_PRESET[a]) patch['S.slen'] = SLEN_PRESET[a]
    this.setData(patch, () => this.update())
  },
  setMatch(e) {
    const m = e.currentTarget.dataset.m
    if (!MATCHES.some((t) => t.id === m)) return
    haptic.light()
    this.setData({ 'S.match': m }, () => this.update())
  },

  // ═══ 物理 ═══
  // 天线在 f0 的谐振电阻 R 与品质因数 Q（由结构几何导出，无拼凑系数）
  antParams() {
    const S = this.data.S
    if (S.ant === 'bicone') {
      const th = S.cone * Math.PI / 180
      const zc = 120 * Math.log(1 / Math.tan(th / 2))   // 无限双锥特性阻抗
      return { R: zc, Q: Math.PI / 4 }                   // 锥线模型：Za=Zc=R → Q=π/4
    }
    // 偶极子族：细长比 slen = L/(2a) → 2L/a = 4·slen
    const za = 120 * (Math.log(4 * S.slen) - 1)          // Schelkunoff 平均特性阻抗
    const q = Math.PI * za / (4 * R_DIPOLE)              // 开路线模型在谐振点的斜率
    return { R: S.ant === 'folded' ? 4 * R_DIPOLE : R_DIPOLE, Q: q }
  },

  // 天线阻抗（串联谐振一阶模型）
  zant(x, ap) { return rf.cx(ap.R, ap.R * ap.Q * (x - 1 / x)) },

  // 端口反射系数（复数，参考 Z0=50Ω）
  gammaIn(x, ap) {
    const S = this.data.S
    const za = this.zant(x, ap)
    if (S.match === 'none') return rf.gammaFromZ(za, Z0)

    if (S.match === 'l') {
      let zin
      if (ap.R > Z0 * 1.02) {
        // R > Z0：天线侧并联 C（X=−R/(Qm·x)）+ 源侧串联 L（X=Qm·Z0·x）
        const qm = Math.sqrt(ap.R / Z0 - 1)
        const zc = rf.cx(0, -ap.R / (qm * x))
        const zp = rf.cDiv(rf.cMul(za, zc), rf.cAdd(za, zc))
        zin = rf.cAdd(zp, rf.cx(0, qm * Z0 * x))
      } else if (ap.R < Z0 * 0.98) {
        // R < Z0：天线侧串联 L + 源侧并联 C
        const qm = Math.sqrt(Z0 / ap.R - 1)
        const zs = rf.cAdd(za, rf.cx(0, qm * ap.R * x))
        const zc = rf.cx(0, -Z0 / (qm * x))
        zin = rf.cDiv(rf.cMul(zs, zc), rf.cAdd(zs, zc))
      } else zin = za
      return rf.gammaFromZ(zin, Z0)
    }

    // 指数渐变线（Z0 → R，长 L=λ0）：小反射理论叠加
    const bl = 2 * Math.PI * x
    const gTaper = rf.cMul(
      rf.cx(0.5 * Math.log(ap.R / Z0) * rf.sinc(bl)), rf.cExpJ(-bl))
    const gAnt = rf.gammaFromZ(za, ap.R)                 // 天线相对渐变线终端阻抗的失配
    const g = rf.cAdd(gTaper, rf.cMul(gAnt, rf.cExpJ(-2 * bl)))
    const m = rf.cAbs(g)
    return m > 0.999 ? rf.cMul(g, rf.cx(0.999 / m)) : g  // 小反射叠加限幅（无源）
  },

  // ═══ 扫频 + 读数 ═══
  update() {
    const ap = this.antParams()
    const S = this.data.S
    const lo = 1 - S.spanPct / 100, hi = 1 + S.spanPct / 100
    const pts = []
    for (let i = 0; i <= 240; i++) {
      const x = lo + (hi - lo) * i / 240
      const g = this.gammaIn(x, ap)
      const rl = -20 * Math.log10(Math.max(1e-4, rf.cAbs(g)))
      pts.push({ x, g, rl })
    }
    // 最长连续 RL≥10dB 区间（避免双谐振时把中间失配段算进带宽）
    let band = null, run = null
    const keep = () => { if (run && (!band || run[1] - run[0] > band[1] - band[0])) band = run }
    pts.forEach((p) => {
      if (p.rl >= RL_MIN) { if (run) run[1] = p.x; else run = [p.x, p.x] }
      else { keep(); run = null }
    })
    keep()
    const bw = band ? band[1] - band[0] : 0
    const peak = Math.max(...pts.map((p) => p.rl))
    // Bode–Fano：FBW ≤ π/(Q·ln(1/|Γm|))
    const bf = Math.PI / (ap.Q * Math.log(1 / GAMMA_M))

    this._pts = pts
    this._band = band
    this.setData({
      stats: {
        bw: bw > 0.005 ? (bw * 100).toFixed(1) + '%' : '<0.5%',
        peak: peak.toFixed(1) + ' dB',
        rq: Math.round(ap.R) + ' Ω · Q=' + (ap.Q < 10 ? ap.Q.toFixed(1) : Math.round(ap.Q)),
        bf: bf > 2 ? '>200%' : (bf * 100).toFixed(1) + '%',
      },
    })
    this.drawRL()
    this.drawSmith()
  },

  // ═══ 回波损耗图 ═══
  drawRL() {
    lc.mount(this, '#rlCanvas', (ctx, w, h) => {
      lc.clear(ctx, w, h)
      const pts = this._pts
      if (!pts) return
      const box = { x: 44, y: 14, w: w - 60, h: h - 52 }
      const p = lc.plot(ctx, box, [pts[0].x, pts[pts.length - 1].x], [0, 40])
      if (this._band) p.bandX(this._band[0], this._band[1], THEME.okSoft)
      p.axes({ yTicks: [0, 10, 20, 30, 40], xLabel: 'f / f₀', yLabel: 'RL (dB)' })
      p.guideY(RL_MIN, alpha(THEME.teal, 0.6))
      lc.label(ctx, 'RL = 10 dB 门限', box.x + 6, p.Y(RL_MIN) - 5, {
        color: THEME.teal, font: THEME.fontTick,
      })
      p.guideX(1)
      const xs = pts.map((q) => q.x), ys = pts.map((q) => Math.min(40, q.rl))
      p.area(xs, ys, THEME.accent, 0)
      p.line(xs, ys, THEME.accent, 2)
      const pk = pts.reduce((a, b) => (b.rl > a.rl ? b : a))
      p.dot(pk.x, Math.min(40, pk.rl), THEME.accent)
      lc.label(ctx, '回波损耗', p.X(pk.x), Math.max(box.y + 12, p.Y(Math.min(40, pk.rl)) - 10), {
        align: 'center', color: THEME.accent, font: THEME.fontLabel,
      })
      lc.label(ctx, 'f₀', p.X(1) + 4, box.y + 12, { color: THEME.muted, font: THEME.fontTick })
    })
  },

  // ═══ Smith 图（Γ 平面）═══
  drawSmith() {
    lc.mount(this, '#smithCanvas', (ctx, w, h) => {
      lc.clear(ctx, w, h)
      const pts = this._pts
      if (!pts) return
      const R = Math.min(w, h) * 0.40
      const cx0 = w / 2, cy0 = h / 2
      const gx = (g) => cx0 + g.re * R
      const gy = (g) => cy0 - g.im * R

      // 外圆（|Γ|=1）与实轴
      ctx.strokeStyle = THEME.axis; ctx.lineWidth = 1.2
      ctx.beginPath(); ctx.arc(cx0, cy0, R, 0, Math.PI * 2); ctx.stroke()
      ctx.strokeStyle = THEME.gridStrong; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(cx0 - R, cy0); ctx.lineTo(cx0 + R, cy0); ctx.stroke()

      // 等电阻圆 + 等电抗弧（裁剪到单位圆内）
      ctx.save()
      ctx.beginPath(); ctx.arc(cx0, cy0, R, 0, Math.PI * 2); ctx.clip()
      ctx.strokeStyle = THEME.gridStrong
      const RR = [0.2, 0.5, 1, 2, 5]
      RR.forEach((r) => {
        ctx.beginPath()
        ctx.arc(cx0 + R * r / (r + 1), cy0, R / (r + 1), 0, Math.PI * 2)
        ctx.stroke()
      })
      ;[0.5, 1, 2].forEach((xv) => {
        [1, -1].forEach((s) => {
          ctx.beginPath()
          ctx.arc(cx0 + R, cy0 - s * R / xv, R / xv, 0, Math.PI * 2)
          ctx.stroke()
        })
      })
      ctx.restore()

      // r 值标注（沿实轴）与 ±jx 标注（单位圆外沿）
      RR.forEach((r) => {
        lc.label(ctx, String(r), cx0 + R * (r - 1) / (r + 1), cy0 + 13, {
          align: 'center', color: THEME.muted, font: THEME.fontTick,
        })
      })
      ;[0.5, 1, 2].forEach((xv) => {
        [1, -1].forEach((s) => {
          const g = rf.gammaFromZ(rf.cx(0, s * xv), 1)   // z = ±jx 落在 |Γ|=1 上
          lc.label(ctx, (s > 0 ? '+' : '−') + xv + 'j', cx0 + g.re * R * 1.14, cy0 - g.im * R * 1.14 + 3, {
            align: 'center', color: THEME.muted, font: THEME.fontTick,
          })
        })
      })

      // 阻抗轨迹（低频 → 高频）
      ctx.strokeStyle = THEME.accent; ctx.lineWidth = 2
      ctx.lineJoin = 'round'; ctx.lineCap = 'round'
      ctx.beginPath()
      pts.forEach((p, i) => {
        const X = gx(p.g), Y = gy(p.g)
        if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y)
      })
      ctx.stroke()
      // 频率方向箭头
      const i1 = Math.floor(pts.length * 0.62)
      const i2 = Math.min(pts.length - 1, i1 + 5)
      lc.arrow(ctx, gx(pts[i1].g), gy(pts[i1].g), gx(pts[i2].g), gy(pts[i2].g), THEME.accent, 2)

      // 起点 / 终点 / 中心频点
      const p0 = pts[0], p1 = pts[pts.length - 1]
      const mid = pts[Math.floor(pts.length / 2)]
      lc.dot(ctx, gx(p0.g), gy(p0.g), THEME.inkSoft, 3)
      lc.label(ctx, p0.x.toFixed(2) + 'f₀', gx(p0.g) + 7, gy(p0.g) + 4, {
        color: THEME.inkSoft, font: THEME.fontTick,
      })
      lc.dot(ctx, gx(p1.g), gy(p1.g), THEME.inkSoft, 3)
      lc.label(ctx, p1.x.toFixed(2) + 'f₀', gx(p1.g) + 7, gy(p1.g) + 4, {
        color: THEME.inkSoft, font: THEME.fontTick,
      })
      lc.dot(ctx, gx(mid.g), gy(mid.g), THEME.teal, 4.5)
      lc.label(ctx, 'f₀', gx(mid.g) + 8, gy(mid.g) - 6, {
        color: THEME.teal, font: THEME.fontLabel,
      })
      // 匹配点（圆心，Γ=0）
      lc.label(ctx, '匹配点', cx0 + 5, cy0 - 6, { color: THEME.muted, font: THEME.fontTick })

      lc.legend(ctx, [
        { name: '阻抗轨迹（箭头 = 频率升高）', color: THEME.accent },
        { name: 'f₀', color: THEME.teal },
      ], 12, h - 12)
    })
  },

  onShareAppMessage() {
    return { title: '宽带匹配实验', path: '/pages/interactive/broadband-matching/broadband-matching' }
  },
})

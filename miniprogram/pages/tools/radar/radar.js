// pages/tools/radar/radar.js —— 雷达工具：雷达方程 / 多普勒 / PRF 模糊
// 物理全部来自 utils/rf-math（Skolnik/Pozar 标准公式）：
//   R_max = [Pt·G²·λ²·σ/((4π)³·S_min·L)]^(1/4)   Ae = G·λ²/4π
//   fd = 2·vr/λ（vr>0 = 接近雷达 → fd 为正）
//   Ru = c/(2·PRF)   ±va = λ·PRF/4
const haptic = require('../../../utils/haptic')
const rf = require('../../../utils/rf-math')
const lc = require('../../../utils/lab-canvas')
const { THEME } = require('../../../utils/lab-theme')

// R–σ 图参考目标（教学典型量级，m²）
const REF_TARGETS = [
  { name: '隐身机 0.005', sigma: 0.005, above: true },
  { name: '鸟 0.01', sigma: 0.01, above: false },
  { name: '无人机 0.1', sigma: 0.1, above: true },
  { name: '战机 3', sigma: 3, above: false },
  { name: '舰船 10⁴', sigma: 1e4, above: true },
]

Page({
  data: {
    radarTab: 0,

    // 雷达方程
    rPt: '100',      // 峰值功率
    rPtUnit: 0,      // 0=kW, 1=W
    rG: '35',        // 天线增益 dBi
    rFreq: '10',     // 频率
    rFreqUnit: 1,    // 0=MHz, 1=GHz
    rcs: '5',        // RCS m²
    smin: '-120',    // 最小可检测信号 dBm
    rLoss: '4',      // 系统损耗 dB
    rangeResult: null,

    // 多普勒
    dFreq: '10',     // 载频
    dFreqUnit: 1,
    dVel: '300',     // 目标径向速度 m/s（正=接近）
    dopplerResult: null,

    // 模糊
    prf: '2000',     // PRF Hz
    ambigResult: null,
  },

  onReady() { this.drawTab() },

  switchRadarTab(e) {
    haptic.light()
    this.setData({ radarTab: +e.currentTarget.dataset.i }, () => this.drawTab())
  },
  drawTab() {
    if (this.data.radarTab === 0) this.drawRange()
    else this.drawPrf()
  },

  // ═══ 参数读取（非法输入返回 null）═══
  readRadarParams() {
    const d = this.data
    const ptW = parseFloat(d.rPt) * (d.rPtUnit === 0 ? 1e3 : 1)
    const g = parseFloat(d.rG)
    const f = parseFloat(d.rFreq) * (d.rFreqUnit === 0 ? 1e6 : 1e9)
    const rcs = parseFloat(d.rcs)
    const sminDbm = parseFloat(d.smin)
    const loss = parseFloat(d.rLoss)
    if (!isFinite(ptW) || ptW <= 0 || !isFinite(g) || !isFinite(f) || f <= 0 ||
        !isFinite(rcs) || rcs <= 0 || !isFinite(sminDbm) || !isFinite(loss) || loss < 0) return null
    return { ptW, g, f, rcs, sminW: rf.dbmToW(sminDbm), loss }
  },
  readDopplerFreq() {
    const f = parseFloat(this.data.dFreq) * (this.data.dFreqUnit === 0 ? 1e6 : 1e9)
    return isFinite(f) && f > 0 ? f : null
  },

  // ═══ 雷达方程 ═══
  onRPtChange(e) { this.setRangeInput('rPt', e.detail.value) },
  onRGChange(e) { this.setRangeInput('rG', e.detail.value) },
  onRFreqChange(e) { this.setRangeInput('rFreq', e.detail.value) },
  onRcsChange(e) { this.setRangeInput('rcs', e.detail.value) },
  onSminChange(e) { this.setRangeInput('smin', e.detail.value) },
  onRLossChange(e) { this.setRangeInput('rLoss', e.detail.value) },
  setRangeInput(key, val) {
    const patch = { rangeResult: null } // 输入变化 → 旧结果作废
    patch[key] = val
    this.setData(patch, () => this.drawRange())
  },
  setRPtUnit(e) {
    haptic.light()
    this.setData({ rPtUnit: +e.currentTarget.dataset.u, rangeResult: null }, () => this.drawRange())
  },
  setRFreqUnit(e) {
    haptic.light()
    this.setData({ rFreqUnit: +e.currentTarget.dataset.u, rangeResult: null }, () => this.drawRange())
  },

  calcRange() {
    haptic.medium()
    const p = this.readRadarParams()
    if (!p) { wx.showToast({ title: '参数有误', icon: 'none' }); return }
    const rMax = rf.radarRmax(p.ptW, p.g, p.f, p.rcs, p.sminW, p.loss)
    this.setData({
      rangeResult: {
        rKm: (rMax / 1000).toFixed(1),
        wavelength: rf.fmtLen(rf.wavelength(p.f)),
        ae: rf.effectiveAperture(p.g, p.f).toFixed(2) + ' m²',
      },
    }, () => this.drawRange())
  },

  // ═══ 多普勒 ═══
  onDFreq(e) { this.setDopplerInput('dFreq', e.detail.value) },
  onDVel(e) { this.setDopplerInput('dVel', e.detail.value) },
  setDFreqUnit(e) {
    haptic.light()
    // 载频同时决定 va（λ）→ 两处结果一起作废
    this.setData({ dFreqUnit: +e.currentTarget.dataset.u, dopplerResult: null, ambigResult: null },
      () => this.drawPrf())
  },
  setDopplerInput(key, val) {
    const patch = { dopplerResult: null }
    if (key === 'dFreq') patch.ambigResult = null // 载频耦合到模糊卡片
    patch[key] = val
    this.setData(patch, () => this.drawPrf())
  },

  calcDoppler() {
    haptic.medium()
    const f = this.readDopplerFreq()
    const vr = parseFloat(this.data.dVel)
    if (f == null || !isFinite(vr)) { wx.showToast({ title: '参数有误', icon: 'none' }); return }
    const fd = rf.dopplerShift(f, vr) // 符号跟随 vr：接近为正
    const sign = fd > 0 ? '+' : fd < 0 ? '−' : ''
    this.setData({
      dopplerResult: {
        fd: sign + rf.fmtFreq(Math.abs(fd)),
        dir: fd > 0 ? '目标接近雷达 → 频移为正' : fd < 0 ? '目标远离雷达 → 频移为负' : '径向静止 → 无频移',
      },
    })
  },

  // ═══ 距离 / 速度模糊 ═══
  onPrf(e) {
    this.setData({ prf: e.detail.value, ambigResult: null }, () => this.drawPrf())
  },

  calcAmbiguity() {
    haptic.medium()
    const prf = parseFloat(this.data.prf)
    const f = this.readDopplerFreq()
    if (!isFinite(prf) || prf <= 0 || f == null) {
      wx.showToast({ title: '参数有误', icon: 'none' })
      return
    }
    this.setData({
      ambigResult: {
        ru: (rf.unambiguousRange(prf) / 1000).toFixed(2) + ' km',
        va: '±' + rf.unambiguousVel(f, prf).toFixed(1) + ' m/s',
      },
    })
  },

  // ═══ 图 1：R_max–σ log-log 曲线 ═══
  drawRange() {
    if (this.data.radarTab !== 0) return
    lc.mount(this, '#rangeCanvas', (ctx, w, h) => {
      lc.clear(ctx, w, h)
      const p = this.readRadarParams()
      if (!p) return
      // σ=1 m² 时的 R（km 取对数）；log-log 下 R(σ) 是斜率 1/4 的直线
      const lgK = Math.log10(rf.radarRmax(p.ptW, p.g, p.f, 1, p.sminW, p.loss) / 1000)
      const X0 = -4, X1 = 4
      const ymin = Math.floor(lgK + 0.25 * X0 - 0.3)
      const ymax = Math.ceil(lgK + 0.25 * X1 + 0.3)
      const box = { x: 48, y: 26, w: w - 64, h: h - 66 }
      const pl = lc.plot(ctx, box, [X0, X1], [ymin, ymax])
      const yTicks = []
      for (let t = ymin; t <= ymax; t++) yTicks.push(t)
      pl.axes({
        xTicks: [-4, -3, -2, -1, 0, 1, 2, 3, 4],
        yTicks,
        xFmt: (t) => this.pow10Label(t),
        yFmt: (t) => this.pow10Label(t),
        xLabel: 'RCS σ (m²，log)',
        yLabel: 'R_max (km，log)',
      })

      // 主曲线
      const xs = [X0, X1]
      const ys = [lgK + 0.25 * X0, lgK + 0.25 * X1]
      pl.line(xs, ys, THEME.accent, 2)

      // 参考目标（青绿点 + 直接文字标注）
      REF_TARGETS.forEach((t) => {
        const x = Math.log10(t.sigma)
        const y = lgK + 0.25 * x
        pl.dot(x, y, THEME.teal, 3.5)
        lc.label(ctx, t.name, pl.X(x), pl.Y(y) + (t.above ? -10 : 18), {
          align: 'center', color: THEME.teal, font: THEME.fontTick,
        })
      })

      // 当前工作点（赤陶）
      const xc = Math.log10(p.rcs)
      if (xc >= X0 && xc <= X1) {
        const yc = lgK + 0.25 * xc
        pl.guideX(xc)
        pl.guideY(yc)
        pl.dot(xc, yc, THEME.accent)
        const rNow = Math.pow(10, yc)
        lc.label(ctx, 'σ=' + p.rcs + ' m² → R≈' +
          (rNow >= 100 ? rNow.toFixed(0) : rNow.toFixed(1)) + ' km',
          box.x + box.w, box.y - 8, { align: 'right', color: THEME.ink, font: THEME.fontTitle })
      }
      lc.label(ctx, 'R ∝ σ^(1/4)：RCS 差 4 个数量级，距离才差 10 倍', box.x + 4, box.y + box.h - 8, {
        color: THEME.muted, font: THEME.fontTick,
      })
    })
  },

  // ═══ 图 2：PRF 权衡（Ru 下降 · va 上升）═══
  drawPrf() {
    if (this.data.radarTab !== 1) return
    lc.mount(this, '#prfCanvas', (ctx, w, h) => {
      lc.clear(ctx, w, h)
      const f = this.readDopplerFreq()
      if (f == null) return
      const lam = rf.wavelength(f)
      const X0 = 2, X1 = 5 // log10(PRF)：100 Hz .. 100 kHz
      // 两条对数曲线：log10 Ru(km) = lg(c/2000) − lgPRF；log10 va = lg(λ/4) + lgPRF
      const ruY = (x) => Math.log10(rf.C0 / 2000) - x
      const vaY = (x) => Math.log10(lam / 4) + x
      const ymin = Math.floor(Math.min(ruY(X1), vaY(X0)) - 0.2)
      const ymax = Math.ceil(Math.max(ruY(X0), vaY(X1)) + 0.2)
      const box = { x: 48, y: 26, w: w - 64, h: h - 66 }
      const pl = lc.plot(ctx, box, [X0, X1], [ymin, ymax])
      const yTicks = []
      for (let t = ymin; t <= ymax; t++) yTicks.push(t)
      pl.axes({
        xTicks: [2, 3, 4, 5],
        yTicks,
        xFmt: (t) => ['100', '1k', '10k', '100k'][t - 2] || '',
        yFmt: (t) => this.pow10Label(t),
        xLabel: 'PRF (Hz，log)',
        yLabel: 'Ru (km) · va (m/s)，log',
      })

      const N = 60
      const xs = [], ysRu = [], ysVa = []
      for (let i = 0; i <= N; i++) {
        const x = X0 + (X1 - X0) * i / N
        xs.push(x); ysRu.push(ruY(x)); ysVa.push(vaY(x))
      }
      pl.line(xs, ysRu, THEME.accent, 2)
      pl.line(xs, ysVa, THEME.teal, 2)
      lc.label(ctx, 'Ru = c/2PRF (km)', pl.X(2.15), pl.Y(ruY(2.15)) - 8, {
        color: THEME.accent, font: THEME.fontLabel,
      })
      lc.label(ctx, '±va = λ·PRF/4 (m/s)', pl.X(4.85), pl.Y(vaY(4.85)) - 8, {
        align: 'right', color: THEME.teal, font: THEME.fontLabel,
      })
      // 权衡区提示
      lc.label(ctx, '低 PRF：测距清晰', box.x + 6, box.y + box.h - 8, {
        color: THEME.muted, font: THEME.fontTick,
      })
      lc.label(ctx, '高 PRF：测速清晰', box.x + box.w - 6, box.y + 14, {
        align: 'right', color: THEME.muted, font: THEME.fontTick,
      })

      // 当前 PRF 工作点
      const prf = parseFloat(this.data.prf)
      if (isFinite(prf) && prf > 0) {
        const xp = Math.log10(prf)
        if (xp >= X0 && xp <= X1) {
          pl.guideX(xp)
          pl.dot(xp, ruY(xp), THEME.accent)
          pl.dot(xp, vaY(xp), THEME.teal)
          const ruKm = rf.unambiguousRange(prf) / 1000
          const va = rf.unambiguousVel(f, prf)
          lc.label(ctx, 'PRF=' + lc.fmtNum(prf) + ' Hz → Ru≈' +
            (ruKm >= 100 ? ruKm.toFixed(0) : ruKm.toFixed(1)) + ' km · va≈±' +
            va.toFixed(1) + ' m/s',
            box.x + box.w, box.y - 8, { align: 'right', color: THEME.ink, font: THEME.fontTitle })
        }
      }
    })
  },

  // 10^t 的刻度文字（-4..6 常用区间）
  pow10Label(t) {
    if (t >= 4) return '10' + this.sup(t)
    if (t >= 3) return '1k'
    if (t >= 0) return String(Math.pow(10, t))
    if (t >= -2) return String(Math.pow(10, t))
    return '10' + this.sup(t)
  },
  sup(n) {
    const map = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' }
    return String(n).split('').map((c) => map[c] || c).join('')
  },

  onShareAppMessage() {
    return { title: '雷达工具：雷达方程 · 多普勒 · PRF 模糊', path: '/pages/tools/radar/radar' }
  },
})

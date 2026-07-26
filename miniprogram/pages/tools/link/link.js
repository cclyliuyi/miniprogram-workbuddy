// pages/tools/link/link.js —— 通信链路计算：链路预算 / 菲涅尔区 / 无线电视距 / 噪声灵敏度
// 物理模型全部为真实公式（rf-math + 各 Tab 公式注脚卡）：
//   Friis(dB)：Pr = Pt + Gt + Gr − FSPL − L_sys；FSPL = 20·lg(4πd/λ)
//   菲涅尔：r₁ = √(λ·d₁·d₂/(d₁+d₂))；60% 净空为工程底线
//   视距：d = √(2kR·h_t) + √(2kR·h_r)（等效地球半径 kR，平滑地球近似）
//   噪声（IEEE 严格式）：Pn = k·(T + (F−1)·290)·B，F = 10^(NF/10)；Sens = Pn + SNR_min
const haptic = require('../../../utils/haptic')
const rf = require('../../../utils/rf-math')
const lc = require('../../../utils/lab-canvas')
const { THEME, alpha } = require('../../../utils/lab-theme')

const KB = 1.380649e-23   // 玻尔兹曼常数 J/K（SI 精确值）
const R_EARTH = 6371e3    // 地球半径 m
const T0 = 290            // IEEE 噪声系数参考温度 K
const K_OPTS = [
  { name: 'k=1.0 无折射', short: '1.0', k: 1 },
  { name: 'k=4/3 标准大气', short: '4/3', k: 4 / 3 },
  { name: 'k=0.7 恶劣折射', short: '0.7', k: 0.7 },
]
const fmtKm = (km) => rf.fmtLen(km * 1000)

Page({
  data: {
    tabs: ['链路预算', '菲涅尔区', '视距', '噪声灵敏度'],
    activeTab: 0,

    // === 链路预算 ===
    pt: '30', ptUnit: 0, gt: '6', freq: '2400', freqUnit: 1,
    distance: '1', gr: '6', sysLoss: '2', sensitivity: '-90',
    result: null,

    // === 菲涅尔区 ===
    frFreq: '2400', frFreqUnit: 1, frD1: '0.5', frD2: '0.5', frClear: '10',
    fresnelResult: null,

    // === 视距 ===
    losHt: '30', losHr: '2', losKIdx: 1,
    kOpts: K_OPTS.map((o) => o.name),
    losResult: null,

    // === 噪声灵敏度 ===
    nfBw: '1', nfBwUnit: 1, nfVal: '4', nfSnr: '10', nfTemp: '290',
    noiseResult: null,
  },

  onReady() { this.recalc() },

  // ═══ 事件（输入即算，杜绝陈旧结果）═══
  switchTab(e) {
    haptic.light()
    this.setData({ activeTab: +e.currentTarget.dataset.i || 0 }, () => this.recalc())
  },
  onField(e) {
    const f = e.currentTarget.dataset.f
    if (!f) return
    this.setData({ [f]: e.detail.value }, () => this.recalc())
  },
  setUnit(e) {
    haptic.light()
    const f = e.currentTarget.dataset.f
    if (!f) return
    this.setData({ [f]: +e.currentTarget.dataset.u || 0 }, () => this.recalc())
  },
  setLosK(e) {
    haptic.light()
    this.setData({ losKIdx: +e.currentTarget.dataset.i || 0 }, () => this.recalc())
  },

  recalc() {
    const t = this.data.activeTab
    if (t === 0) this.calcBudget()
    else if (t === 1) this.calcFresnel()
    else if (t === 2) this.calcLOS()
    else this.calcNoise()
  },

  // ══════ Tab1 链路预算 ══════
  calcBudget() {
    const D = this.data
    const ptRaw = parseFloat(D.pt)
    const ptDbm = D.ptUnit === 0 ? ptRaw : (ptRaw > 0 ? rf.wToDbm(ptRaw) : NaN)
    const gt = parseFloat(D.gt) || 0
    const gr = parseFloat(D.gr) || 0
    const lSys = parseFloat(D.sysLoss) || 0
    const f = parseFloat(D.freq) * (D.freqUnit === 0 ? 1e6 : 1e9)
    const dKm = parseFloat(D.distance)
    const sens = parseFloat(D.sensitivity)
    if (!isFinite(ptDbm) || !(f > 0) || !(dKm > 0) || !isFinite(sens)) {
      this.setData({ result: null }); this.drawBudget(null); return
    }
    const eirp = ptDbm + gt
    const fspl = rf.fsplDb(f, dKm * 1000)
    const pr = eirp + gr - fspl - lSys
    const margin = pr - sens
    // Pr(d) = sens 的距离：反解 FSPL_max = EIRP + Gr − L_sys − sens
    const dMaxM = rf.wavelength(f) / (4 * Math.PI) * Math.pow(10, (eirp + gr - lSys - sens) / 20)

    let verdict, vClass, mClass
    if (margin >= 10) {
      verdict = '✓ 链路余量充足，通信可靠'; vClass = 'ok'; mClass = 'tp-c-teal'
    } else if (margin >= 0) {
      verdict = '△ 余量 <10 dB 衰落裕度，建议增加裕度'; vClass = 'warn'; mClass = 'tp-c-gold'
    } else {
      verdict = '✗ 链路不可达：需提高功率/增益或缩短距离'; vClass = 'fail'; mClass = 'tp-c-danger'
    }
    this.setData({
      result: {
        eirp: eirp.toFixed(1), fspl: fspl.toFixed(1), pr: pr.toFixed(1),
        margin: margin.toFixed(1), dMax: fmtKm(dMaxM / 1000),
        verdict, vClass, mClass,
      },
    })
    this.drawBudget({ pr, sens, dKm, dMaxKm: dMaxM / 1000 })
  },

  drawBudget(m) {
    lc.mount(this, '#budgetCanvas', (ctx, w, h) => {
      lc.clear(ctx, w, h)
      if (!m) return this._empty(ctx, w, h)
      const box = { x: 56, y: 28, w: w - 72, h: h - 70 }
      const lD = Math.log10(m.dKm)
      const lMax = Math.log10(m.dMaxKm)
      let xLo = lD - 2, xHi = lD + 2
      if (lMax > xHi - 0.4 && lMax < xHi + 1.6) xHi = lMax + 0.4
      if (lMax < xLo + 0.4 && lMax > xLo - 1.6) xLo = lMax - 0.4
      const prAt = (lx) => m.pr - 20 * (lx - lD) // 对数轴上 FSPL 斜率 −20 dB/十倍距
      const yLo = Math.min(prAt(xHi), m.sens) - 10
      const yHi = Math.max(prAt(xLo), m.sens) + 12
      const p = lc.plot(ctx, box, [xLo, xHi], [yLo, yHi])
      // 可达（Pr>sens）/ 不可达 区带
      if (lMax > xLo) p.bandX(xLo, Math.min(lMax, xHi), THEME.okSoft)
      if (lMax < xHi) p.bandX(Math.max(lMax, xLo), xHi, THEME.dangerSoft)
      const xTicks = []
      for (let t = Math.ceil(xLo); t <= Math.floor(xHi); t++) xTicks.push(t)
      p.axes({
        xTicks, xFmt: (t) => fmtKm(Math.pow(10, t)),
        xLabel: '距离（对数轴）', yLabel: 'Pr (dBm)',
      })
      // 灵敏度门限（虚线）
      p.guideY(m.sens, alpha(THEME.indigo, 0.7))
      lc.label(ctx, '灵敏度 ' + m.sens.toFixed(0) + ' dBm', box.x + box.w - 6, p.Y(m.sens) - 6,
        { align: 'right', color: THEME.indigo })
      // Pr 曲线（对数轴上为直线）
      p.line([xLo, xHi], [prAt(xLo), prAt(xHi)], THEME.accent, 2)
      const xl = xLo + (xHi - xLo) * 0.06
      lc.label(ctx, 'Pr：−20 dB/十倍距', p.X(xl) + 4, p.clampY(p.Y(prAt(xl))) - 10,
        { color: THEME.accent })
      // 当前工作点
      p.dot(lD, m.pr, THEME.accent)
      lc.label(ctx, '当前 ' + fmtKm(m.dKm) + ' / ' + m.pr.toFixed(1) + ' dBm',
        p.X(lD) + 8, p.Y(m.pr) - 10, { color: THEME.ink, font: THEME.fontTitle })
      // 最大可达距离（Pr 与灵敏度交点）
      if (lMax > xLo && lMax < xHi) {
        p.dot(lMax, m.sens, THEME.gold)
        lc.label(ctx, '最大可达 ' + fmtKm(m.dMaxKm), p.X(lMax), p.Y(m.sens) + 18,
          { align: 'center', color: THEME.gold })
      }
    })
  },

  // ══════ Tab2 菲涅尔区 ══════
  calcFresnel() {
    const D = this.data
    const f = parseFloat(D.frFreq) * (D.frFreqUnit === 0 ? 1e6 : 1e9)
    const d1 = parseFloat(D.frD1)
    const d2 = parseFloat(D.frD2)
    const clr = parseFloat(D.frClear) // 障碍物顶端在视线下方的净空 m（负 = 高于视线）
    if (!(f > 0) || !(d1 > 0) || !(d2 > 0)) {
      this.setData({ fresnelResult: null }); this.drawFresnel(null); return
    }
    const wl = rf.wavelength(f)
    const d1m = d1 * 1000, d2m = d2 * 1000
    const r1 = Math.sqrt(wl * d1m * d2m / (d1m + d2m)) // 障碍物处第一菲涅尔半径
    const r60 = 0.6 * r1
    let verdict, vClass
    if (!isFinite(clr)) {
      verdict = '填写障碍物净空后给出遮挡判定'; vClass = 'warn'
    } else if (clr >= r60) {
      verdict = '✓ 净空 ≥ 0.6·r₁，满足工程底线，绕射损耗可忽略'; vClass = 'ok'
    } else if (clr >= 0) {
      verdict = '△ 障碍物侵入 60% 菲涅尔区，绕射损耗开始增大'; vClass = 'warn'
    } else {
      verdict = '✗ 障碍物高于视线，链路被遮挡（刃形绕射损耗 ≥6 dB）'; vClass = 'fail'
    }
    this.setData({
      fresnelResult: {
        r1: rf.fmtLen(r1), r60: rf.fmtLen(r60),
        totalD: (d1 + d2).toFixed(2) + ' km',
        verdict, vClass,
      },
    })
    this.drawFresnel({ wl, d1, d2, clr, r1 })
  },

  drawFresnel(m) {
    lc.mount(this, '#fresnelCanvas', (ctx, w, h) => {
      lc.clear(ctx, w, h)
      if (!m) return this._empty(ctx, w, h)
      const box = { x: 56, y: 26, w: w - 72, h: h - 64 }
      const Dkm = m.d1 + m.d2, Dm = Dkm * 1000
      const rMid = Math.sqrt(m.wl * Dm / 4) // 中点半径（最大）
      let ySpan = rMid * 1.45
      if (isFinite(m.clr)) ySpan = Math.max(ySpan, Math.abs(m.clr) * 1.25)
      const p = lc.plot(ctx, box, [0, Dkm], [-ySpan, ySpan])
      p.axes({ xLabel: '沿链路距离 (km)', yLabel: '相对视线 (m)' })
      // 第一菲涅尔椭圆 ±r(x) 与 60% 虚线
      const N = 120, xs = [], up = [], dn = [], u6 = [], d6 = []
      for (let i = 0; i <= N; i++) {
        const xk = Dkm * i / N, xm = xk * 1000
        const r = Math.sqrt(Math.max(0, m.wl * xm * (Dm - xm) / Dm))
        xs.push(xk); up.push(r); dn.push(-r); u6.push(0.6 * r); d6.push(-0.6 * r)
      }
      p.area(xs, up, THEME.accent, 0); p.area(xs, dn, THEME.accent, 0)
      p.line(xs, up, THEME.accent, 2); p.line(xs, dn, THEME.accent, 2)
      ctx.save(); ctx.setLineDash([5, 4])
      p.line(xs, u6, THEME.teal, 1.5); p.line(xs, d6, THEME.teal, 1.5)
      ctx.restore()
      // 视线 + 端点
      p.line([0, Dkm], [0, 0], THEME.inkSoft, 1)
      p.dot(0, 0, THEME.indigo); p.dot(Dkm, 0, THEME.indigo)
      lc.label(ctx, 'Tx', p.X(0) + 6, p.Y(0) - 10, { color: THEME.indigo })
      lc.label(ctx, 'Rx', p.X(Dkm) - 6, p.Y(0) - 10, { align: 'right', color: THEME.indigo })
      lc.label(ctx, '第一菲涅尔区 r₁', p.X(Dkm / 2), p.clampY(p.Y(rMid)) - 8,
        { align: 'center', color: THEME.accent })
      lc.label(ctx, '60% 净空底线', p.X(Dkm / 2), p.clampY(p.Y(-0.6 * rMid)) + 16,
        { align: 'center', color: THEME.teal })
      // 障碍物（位于 d₁，顶端在视线下方 clr 米）
      if (isFinite(m.clr)) {
        const xPix = p.X(Math.min(m.d1, Dkm))
        const topY = Math.max(box.y, p.Y(-m.clr))
        const col = m.clr >= 0.6 * m.r1 ? THEME.gold : THEME.danger
        ctx.fillStyle = alpha(col, 0.7)
        ctx.fillRect(xPix - 6, topY, 12, Math.max(0, box.y + box.h - topY))
        lc.label(ctx, '障碍物', xPix, topY - 6, { align: 'center', color: col })
      }
    })
  },

  // ══════ Tab3 无线电视距 ══════
  calcLOS() {
    const D = this.data
    const ht = parseFloat(D.losHt)
    const hr = parseFloat(D.losHr)
    const opt = K_OPTS[D.losKIdx] || K_OPTS[1]
    if (!(ht > 0) || !(hr > 0)) {
      this.setData({ losResult: null }); this.drawLOS(null); return
    }
    const kR2 = 2 * opt.k * R_EARTH
    const dHt = Math.sqrt(kR2 * ht) / 1000 // km
    const dHr = Math.sqrt(kR2 * hr) / 1000
    const dLOS = dHt + dHr
    this.setData({
      losResult: { dLOS: dLOS.toFixed(1), dHt: dHt.toFixed(1), dHr: dHr.toFixed(1) },
    })
    this.drawLOS({ ht, hr, k: opt.k, kShort: opt.short, dHt, dHr, dLOS })
  },

  drawLOS(m) {
    lc.mount(this, '#losCanvas', (ctx, w, h) => {
      lc.clear(ctx, w, h)
      if (!m) return this._empty(ctx, w, h)
      const box = { x: 60, y: 26, w: w - 76, h: h - 64 }
      const dTot = m.dLOS
      const pad = dTot * 0.05
      const hMax = Math.max(m.ht, m.hr)
      const kR2 = 2 * m.k * R_EARTH
      // 切线坐标系：射线 y=0，切点在 x=dHt；地面 y = −(s·1000)²/(2kR)
      const earth = (xk) => -Math.pow((xk - m.dHt) * 1000, 2) / kR2
      const yLo = Math.min(earth(-pad), earth(dTot + pad)) * 1.12
      const yHi = hMax * 0.5
      const p = lc.plot(ctx, box, [-pad, dTot + pad], [yLo, yHi])
      p.axes({ xLabel: '距离 (km)', yLabel: '相对切线高度 (m)' })
      // 等效地球表面（k·R 抛物线近似）
      const N = 120, xs = [], ys = []
      for (let i = 0; i <= N; i++) {
        const xk = -pad + (dTot + 2 * pad) * i / N
        xs.push(xk); ys.push(earth(xk))
      }
      p.area(xs, ys, THEME.gold, yLo)
      p.line(xs, ys, THEME.gold, 2)
      // 切线射线（塔顶—塔顶，切于地平点）
      p.line([0, dTot], [0, 0], THEME.accent, 2)
      p.guideX(m.dHt)
      p.dot(m.dHt, 0, THEME.accent, 3.5)
      // 双塔（地面 → 塔顶）
      ctx.strokeStyle = THEME.ink; ctx.lineWidth = 3; ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(p.X(0), p.clampY(p.Y(-m.ht))); ctx.lineTo(p.X(0), p.Y(0))
      ctx.moveTo(p.X(dTot), p.clampY(p.Y(-m.hr))); ctx.lineTo(p.X(dTot), p.Y(0))
      ctx.stroke()
      lc.label(ctx, 'h_t=' + m.ht + ' m', p.X(0) + 6, p.Y(0) - 8, { color: THEME.ink })
      lc.label(ctx, 'h_r=' + m.hr + ' m', p.X(dTot) - 6, p.Y(0) - 8, { align: 'right', color: THEME.ink })
      lc.label(ctx, '地平切点 ' + m.dHt.toFixed(1) + ' km', p.X(m.dHt), p.Y(0) + 16,
        { align: 'center', color: THEME.accent })
      lc.label(ctx, '等效地球 k·R（k=' + m.kShort + '）', box.x + box.w / 2, box.y + box.h - 10,
        { align: 'center', color: THEME.gold })
      lc.label(ctx, 'd_LOS = ' + m.dLOS.toFixed(1) + ' km', box.x + box.w, box.y - 8,
        { align: 'right', color: THEME.ink, font: THEME.fontTitle })
    })
  },

  // ══════ Tab4 噪声与灵敏度 ══════
  calcNoise() {
    const D = this.data
    const bw = parseFloat(D.nfBw) * (D.nfBwUnit === 0 ? 1e3 : 1e6)
    const nf = parseFloat(D.nfVal) || 0
    const snr = parseFloat(D.nfSnr)
    const T = parseFloat(D.nfTemp)
    if (!(bw > 0) || !(T > 0) || !isFinite(snr)) {
      this.setData({ noiseResult: null }); this.drawNoise(null); return
    }
    // IEEE 严格式：NF 参考 T0=290K，T 为天线/源噪声温度
    const F = Math.pow(10, nf / 10)
    const tSys = T + (F - 1) * T0
    const pnW = KB * tSys * bw
    const pnDbm = rf.wToDbm(pnW)
    const n0 = rf.wToDbm(KB * T * 1)          // 源噪声密度 dBm/Hz
    const bwTerm = 10 * Math.log10(bw)
    const nfEff = 10 * Math.log10(tSys / T)   // 接收机噪声抬升（T=290K 时 = NF）
    const sensDbm = pnDbm + snr
    this.setData({
      noiseResult: {
        n0: n0.toFixed(1), pn: pnDbm.toFixed(1), pnW: rf.fmtPow(pnW),
        nfEff: nfEff.toFixed(2),
        sens: sensDbm.toFixed(1), sensW: rf.fmtPow(rf.dbmToW(sensDbm)),
      },
    })
    this.drawNoise({ levels: [n0, n0 + bwTerm, n0 + bwTerm + nfEff, sensDbm] })
  },

  drawNoise(m) {
    lc.mount(this, '#noiseCanvas', (ctx, w, h) => {
      lc.clear(ctx, w, h)
      if (!m) return this._empty(ctx, w, h)
      const box = { x: 64, y: 26, w: w - 80, h: h - 66 }
      const lv = m.levels
      const yLo = Math.min.apply(null, lv) - 8
      const yHi = Math.max.apply(null, lv) + 10
      const p = lc.plot(ctx, box, [0, 4], [yLo, yHi])
      p.axes({ xTicks: [], yLabel: '功率 (dBm)' })
      const names = ['kT·1Hz', '+10lg B', '+NF 等效', '+SNR']
      const colors = [THEME.indigo, THEME.gold, THEME.accent, THEME.teal]
      for (let i = 0; i < 4; i++) {
        const xa = p.X(i + 0.18), xb = p.X(i + 0.82)
        const yCur = p.Y(lv[i])
        if (i === 0) {
          // 起点电平线（噪声密度地板）
          ctx.strokeStyle = colors[0]; ctx.lineWidth = 3; ctx.lineCap = 'round'
          ctx.beginPath(); ctx.moveTo(xa, yCur); ctx.lineTo(xb, yCur); ctx.stroke()
        } else {
          const yPrev = p.Y(lv[i - 1])
          ctx.fillStyle = alpha(colors[i], 0.8)
          ctx.fillRect(xa, Math.min(yCur, yPrev), xb - xa, Math.max(2, Math.abs(yCur - yPrev)))
          // 台阶连接虚线
          ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = THEME.gridStrong; ctx.lineWidth = 1
          ctx.beginPath(); ctx.moveTo(p.X(i - 0.18), yPrev); ctx.lineTo(xb, yPrev); ctx.stroke()
          ctx.restore()
          const dv = lv[i] - lv[i - 1]
          lc.label(ctx, (dv >= 0 ? '+' : '') + dv.toFixed(1) + ' dB', (xa + xb) / 2,
            (yCur + yPrev) / 2 + 4, { align: 'center', color: THEME.ink })
        }
        lc.label(ctx, lv[i].toFixed(1), (xa + xb) / 2, Math.max(box.y + 10, yCur - 6),
          { align: 'center', color: colors[i], font: THEME.fontTick })
        lc.label(ctx, names[i], (xa + xb) / 2, box.y + box.h + 16,
          { align: 'center', color: THEME.inkSoft, font: THEME.fontTick })
      }
      p.guideY(lv[3], alpha(THEME.teal, 0.7))
      lc.label(ctx, '灵敏度 ' + lv[3].toFixed(1) + ' dBm', box.x + box.w - 4, p.Y(lv[3]) - 6,
        { align: 'right', color: THEME.teal })
    })
  },

  _empty(ctx, w, h) {
    lc.label(ctx, '输入有效参数后自动出图', w / 2, h / 2,
      { align: 'center', color: THEME.muted, font: THEME.fontNote })
  },

  onShareAppMessage() {
    return { title: '通信链路计算：预算·菲涅尔·视距·灵敏度', path: '/pages/tools/link/link' }
  },
})

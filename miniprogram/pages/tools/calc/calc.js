// pages/tools/calc/calc.js —— RF 换算合集（六个换算 Tab，每个 Tab 一张实时图）
// 物理公式全部取自 utils/rf-math（Pozar / Balanis 标准公式，无魔法系数）：
//   dBm↔W：P(W)=10^((dBm−30)/10)；dBμV = dBm + 10·lg(50Ω) + 90 ≈ dBm + 107（50Ω）
//   λ = c/(f·√εr)；|Γ|=(s−1)/(s+1)；RL=−20lg|Γ|；ML=−10lg(1−|Γ|²)
//   δ = 1/√(πfμσ)；Ae = Gλ²/4π ↔ G = 4πAe/λ²；R_ff = 2D²/λ；R_nf = 0.62√(D³/λ)
const haptic = require('../../../utils/haptic')
const rf = require('../../../utils/rf-math')
const lc = require('../../../utils/lab-canvas')
const { THEME, alpha } = require('../../../utils/lab-theme')

// 50Ω 系统电压电平偏移：dBμV = dBm + 10·lg(50) + 90 ≈ dBm + 106.99
// 推导：V = √(P·R)，1 mW × 50 Ω → 223.6 mV = 106.99 dBμV
const DBUV_OFFSET = 90 + 10 * Math.log10(50)

// 常见导体电导率 σ (S/m)，20°C 手册值；颜色按 THEME.series 固定顺序
const MATERIALS = [
  { name: '银', sigma: 6.30e7 },
  { name: '铜', sigma: 5.96e7 },
  { name: '金', sigma: 4.10e7 },
  { name: '铝', sigma: 3.50e7 },
  { name: '黄铜', sigma: 1.50e7 },
]
const MEDIUM_ER = [1.0, 2.2, 4.4]

// 锚点 chips：随 dBm/W 输入模式切换
const DBM_CHIPS = ['-30', '0', '10', '20', '30'].map((v) => ({ v, t: v + ' dBm' }))
const W_CHIPS = ['0.1', '0.5', '1', '10', '100'].map((v) => ({ v, t: v + ' W' }))

Page({
  data: {
    tabs: ['dBm↔W', '频率↔波长', 'VSWR', '趋肤深度', '增益↔口径', '远场距离'],
    activeTab: 0,
    captions: [
      'P–dBm 对数关系：dB 轴上功率是一条直线',
      'λ / λ/2 / λ/4 长度标尺（当前介质）',
      '驻波包络 |V(z)|：Vmax/Vmin 就是 VSWR',
      '趋肤深度 δ–频率（log–log，五种导体）',
      'Ae–G 关系（当前频率下的对数直线）',
      '离天线距离分区：感应近场 / 辐射近场 / 远场',
    ],

    // dBm ↔ W
    dBmInput: '30',
    dBmMode: 0, // 0=dBm 输入，1=W 输入
    dBmChips: DBM_CHIPS,
    dBmResult: '',
    dBmExtra: '',

    // 频率 ↔ 波长
    freqInput: '2400',
    freqUnit: 0, // 0=MHz 1=GHz
    mediums: ['真空/空气', 'PTFE (εr=2.2)', 'FR4 (εr=4.4)'],
    medium: 0,
    wlResult: '',
    wlHalf: '',
    wlQuarter: '',

    // VSWR
    vswrInput: '1.5',
    vswrResult: null,
    vswrGrade: null,

    // 趋肤深度
    skinFreq: '1000',
    skinFreqUnit: 0, // 0=MHz 1=GHz
    materials: MATERIALS,
    material: 1, // 默认铜
    skinResult: '',

    // 增益 ↔ 有效口径（双向）
    gainMode: 0, // 0: G→Ae，1: Ae→G
    gainInput: '15',
    aeInput: '0.01',
    gainFreq: '10',
    gainFreqUnit: 1,
    gainResult: null,

    // 远场距离
    ffFreq: '10',
    ffFreqUnit: 1,
    ffD: '1',
    ffResult: null,
  },

  onLoad() { this.calcAll() },
  onReady() { this.draw() },

  switchTab(e) {
    const i = +e.currentTarget.dataset.index
    if (!(i >= 0 && i < this.data.tabs.length)) return
    haptic.light()
    this.setData({ activeTab: i }, () => this.draw())
  },

  // ══════ dBm ↔ W ══════
  onDBmInput(e) {
    this.setData({ dBmInput: e.detail.value }, () => { this.calcDBm(); this.draw() })
  },
  toggleDBm(e) {
    const m = +e.currentTarget.dataset.mode
    if (m !== 0 && m !== 1) return
    if (m === this.data.dBmMode) return
    haptic.light()
    // 切换单位时把当前值换算过去（结果不变），锚点 chips 同步换成对应单位
    let input = this.data.dBmInput
    const d = this._dbm
    if (d) input = m === 0 ? this._trim(d.dbm) : this._trim(d.w)
    this.setData({
      dBmMode: m, dBmInput: input,
      dBmChips: m === 0 ? DBM_CHIPS : W_CHIPS,
    }, () => { this.calcDBm(); this.draw() })
  },
  fillDBm(e) {
    const v = e.currentTarget.dataset.v
    if (v == null) return
    haptic.light()
    this.setData({ dBmInput: String(v) }, () => { this.calcDBm(); this.draw() })
  },
  calcDBm() {
    const val = parseFloat(this.data.dBmInput)
    const mode = this.data.dBmMode
    let dbm = NaN
    if (mode === 0) dbm = val
    else if (val > 0) dbm = rf.wToDbm(val)
    if (!isFinite(dbm)) {
      this._dbm = null
      this.setData({ dBmResult: '', dBmExtra: '' })
      return
    }
    const w = rf.dbmToW(dbm)
    this._dbm = { dbm, w }
    this.setData({
      dBmResult: mode === 0 ? rf.fmtPow(w) : dbm.toFixed(2) + ' dBm',
      dBmExtra: (dbm + DBUV_OFFSET).toFixed(1) + ' dBμV',
    })
  },

  // ══════ 频率 ↔ 波长 ══════
  onFreqInput(e) {
    this.setData({ freqInput: e.detail.value }, () => { this.calcWL(); this.draw() })
  },
  setFreqUnit(e) {
    const u = +e.currentTarget.dataset.unit
    if (u !== 0 && u !== 1) return
    haptic.light()
    this.setData({ freqUnit: u }, () => { this.calcWL(); this.draw() })
  },
  setMedium(e) {
    const i = +e.currentTarget.dataset.index
    if (!(i >= 0 && i < MEDIUM_ER.length)) return
    haptic.light()
    this.setData({ medium: i }, () => { this.calcWL(); this.draw() })
  },
  fillFreq(e) {
    const v = e.currentTarget.dataset.v
    const u = +e.currentTarget.dataset.unit
    if (v == null || (u !== 0 && u !== 1)) return
    haptic.light()
    this.setData({ freqInput: String(v), freqUnit: u }, () => { this.calcWL(); this.draw() })
  },
  calcWL() {
    const f = parseFloat(this.data.freqInput)
    if (!(f > 0)) {
      this._wl = null
      this.setData({ wlResult: '', wlHalf: '', wlQuarter: '' })
      return
    }
    const fHz = f * (this.data.freqUnit === 0 ? 1e6 : 1e9)
    const er = MEDIUM_ER[this.data.medium] || 1
    const wl = rf.wavelength(fHz) / Math.sqrt(er) // λ = c/(f·√εr)
    this._wl = { wl }
    this.setData({
      wlResult: rf.fmtLen(wl),
      wlHalf: rf.fmtLen(wl / 2),
      wlQuarter: rf.fmtLen(wl / 4),
    })
  },

  // ══════ VSWR ══════
  onVSWRInput(e) {
    this.setData({ vswrInput: e.detail.value }, () => { this.calcVSWR(); this.draw() })
  },
  fillVswr(e) {
    const v = e.currentTarget.dataset.v
    if (v == null) return
    haptic.light()
    this.setData({ vswrInput: String(v) }, () => { this.calcVSWR(); this.draw() })
  },
  calcVSWR() {
    const s = parseFloat(this.data.vswrInput)
    if (!(s >= 1)) {
      this._vswr = null
      this.setData({ vswrResult: null, vswrGrade: null })
      return
    }
    const g = rf.gammaFromVswr(s)
    this._vswr = { s, gamma: g }
    let grade
    if (s <= 1.2) grade = { text: '优秀 · 实验室级', cls: 'good' }
    else if (s <= 1.5) grade = { text: '良好 · 工程达标', cls: 'good' }
    else if (s <= 2.0) grade = { text: '可用 · 建议优化', cls: 'warn' }
    else grade = { text: '失配 · 需要调匹配', cls: 'bad' }
    this.setData({
      vswrResult: {
        gamma: g.toFixed(4),
        rl: g > 0 ? rf.rlFromGamma(g).toFixed(2) + ' dB' : '∞ dB（全匹配）',
        pref: (g * g * 100).toFixed(2) + ' %',
        mismatch: rf.mismatchLossDb(g).toFixed(2) + ' dB',
      },
      vswrGrade: grade,
    })
  },

  // ══════ 趋肤深度 ══════
  onSkinFreq(e) {
    this.setData({ skinFreq: e.detail.value }, () => { this.calcSkin(); this.draw() })
  },
  setSkinFreqUnit(e) {
    const u = +e.currentTarget.dataset.unit
    if (u !== 0 && u !== 1) return
    haptic.light()
    this.setData({ skinFreqUnit: u }, () => { this.calcSkin(); this.draw() })
  },
  setMaterial(e) {
    const i = +e.currentTarget.dataset.index
    if (!(i >= 0 && i < MATERIALS.length)) return
    haptic.light()
    this.setData({ material: i }, () => { this.calcSkin(); this.draw() })
  },
  calcSkin() {
    const f = parseFloat(this.data.skinFreq)
    const mi = MATERIALS[this.data.material] ? this.data.material : 1
    if (!(f > 0)) {
      this._skin = null
      this.setData({ skinResult: '' })
      return
    }
    const fHz = f * (this.data.skinFreqUnit === 0 ? 1e6 : 1e9)
    const delta = rf.skinDepth(fHz, MATERIALS[mi].sigma) // δ = 1/√(πfμ0σ)，非磁性 μ≈μ0
    this._skin = { fHz, delta, mi }
    this.setData({ skinResult: rf.fmtLen(delta) })
  },

  // ══════ 增益 ↔ 有效口径（双向）══════
  onGainInput(e) { this.setData({ gainInput: e.detail.value }, () => { this.calcGain(); this.draw() }) },
  onAeInput(e) { this.setData({ aeInput: e.detail.value }, () => { this.calcGain(); this.draw() }) },
  onGainFreq(e) { this.setData({ gainFreq: e.detail.value }, () => { this.calcGain(); this.draw() }) },
  setGainFreqUnit(e) {
    const u = +e.currentTarget.dataset.unit
    if (u !== 0 && u !== 1) return
    haptic.light()
    this.setData({ gainFreqUnit: u }, () => { this.calcGain(); this.draw() })
  },
  toggleGainMode(e) {
    const m = +e.currentTarget.dataset.mode
    if (m !== 0 && m !== 1) return
    if (m === this.data.gainMode) return
    haptic.light()
    // 把上一次结果带进新模式的输入框，两个方向保持一致
    const g = this._gain
    const patch = { gainMode: m }
    if (g) {
      if (m === 1) patch.aeInput = this._trim(g.ae)
      else patch.gainInput = this._trim(g.gDbi)
    }
    this.setData(patch, () => { this.calcGain(); this.draw() })
  },
  calcGain() {
    const f = parseFloat(this.data.gainFreq)
    if (!(f > 0)) { this._gain = null; this.setData({ gainResult: null }); return }
    const fHz = f * (this.data.gainFreqUnit === 0 ? 1e6 : 1e9)
    const wl = rf.wavelength(fHz)
    let gDbi, ae
    if (this.data.gainMode === 0) {
      gDbi = parseFloat(this.data.gainInput)
      if (!isFinite(gDbi)) { this._gain = null; this.setData({ gainResult: null }); return }
      ae = rf.effectiveAperture(gDbi, fHz) // Ae = Gλ²/4π
    } else {
      ae = parseFloat(this.data.aeInput)
      if (!(ae > 0)) { this._gain = null; this.setData({ gainResult: null }); return }
      gDbi = rf.linToDb(4 * Math.PI * ae / (wl * wl)) // G = 4πAe/λ²
    }
    const gLin = rf.dbToLin(gDbi)
    this._gain = { fHz, wl, gDbi, ae }
    this.setData({
      gainResult: {
        ae: this._fmtArea(ae),
        g: gDbi.toFixed(2) + ' dBi',
        gLin: gLin >= 100 ? gLin.toFixed(0) : String(+gLin.toPrecision(3)),
        wavelength: rf.fmtLen(wl),
      },
    })
  },

  // ══════ 远场距离（Fraunhofer）══════
  onFFFreq(e) { this.setData({ ffFreq: e.detail.value }, () => { this.calcFF(); this.draw() }) },
  onFFD(e) { this.setData({ ffD: e.detail.value }, () => { this.calcFF(); this.draw() }) },
  setFFFreqUnit(e) {
    const u = +e.currentTarget.dataset.unit
    if (u !== 0 && u !== 1) return
    haptic.light()
    this.setData({ ffFreqUnit: u }, () => { this.calcFF(); this.draw() })
  },
  calcFF() {
    const f = parseFloat(this.data.ffFreq)
    const D = parseFloat(this.data.ffD)
    if (!(f > 0) || !(D > 0)) { this._ff = null; this.setData({ ffResult: null }); return }
    const fHz = f * (this.data.ffFreqUnit === 0 ? 1e6 : 1e9)
    const wl = rf.wavelength(fHz)
    const rFF = 2 * D * D / wl                                   // Fraunhofer 边界
    const rNF = D > wl ? 0.62 * Math.sqrt(D * D * D / wl) : 0    // 电大天线才适用
    this._ff = { D, wl, rFF, rNF }
    this.setData({
      ffResult: {
        rFF: rf.fmtLen(rFF),
        rNF: rNF > 0 ? rf.fmtLen(rNF) : '—（D<λ 不适用）',
        wavelength: rf.fmtLen(wl),
        dOverLam: (D / wl).toFixed(1) + ' λ',
      },
    })
  },

  calcAll() {
    this.calcDBm(); this.calcWL(); this.calcVSWR()
    this.calcSkin(); this.calcGain(); this.calcFF()
  },

  // ══════ 绘图（lab-canvas，按当前 Tab 分发）══════
  draw() {
    lc.mount(this, '#calcCanvas', (ctx, w, h) => {
      lc.clear(ctx, w, h)
      const t = this.data.activeTab
      if (t === 1) this._drawWl(ctx, w, h)
      else if (t === 2) this._drawVswr(ctx, w, h)
      else if (t === 3) this._drawSkin(ctx, w, h)
      else if (t === 4) this._drawGain(ctx, w, h)
      else if (t === 5) this._drawFf(ctx, w, h)
      else this._drawDbm(ctx, w, h)
    })
  },

  // ── Tab 0：P(W) 随 dBm 变化（对数 y 轴上是直线）──
  _drawDbm(ctx, w, h) {
    const box = { x: 58, y: 26, w: w - 76, h: h - 68 }
    const p = lc.plot(ctx, box, [-40, 42], [-7.4, 1.6])
    p.axes({
      xTicks: [-40, -30, -20, -10, 0, 10, 20, 30, 40],
      yTicks: [-6, -3, 0],
      yFmt: (t) => (t === -6 ? '1 μW' : t === -3 ? '1 mW' : '1 W'),
      xLabel: '功率电平 (dBm)',
      yLabel: 'P（对数轴）',
    })
    // P(W) = 10^((dBm−30)/10) ⇒ log10P = (dBm−30)/10，直线
    p.line([-40, 42], [-7, 1.2], THEME.accent, 2)
    lc.label(ctx, '+10 dB → ×10', p.X(-16), p.Y(-4.6) - 10, { color: THEME.muted })
    p.guideY(-3, alpha(THEME.indigo, 0.5))
    lc.label(ctx, '0 dBm = 1 mW（原点）', p.X(-38), p.Y(-3) - 6, {
      color: THEME.indigo, font: THEME.fontTick,
    })
    const d = this._dbm
    if (!d) { this._hint(ctx, w, h); return }
    if (d.dbm >= -40 && d.dbm <= 42) {
      const yv = (d.dbm - 30) / 10
      p.guideX(d.dbm); p.guideY(yv)
      p.dot(d.dbm, yv, THEME.accent)
    }
    lc.label(ctx, d.dbm.toFixed(1) + ' dBm = ' + rf.fmtPow(d.w),
      box.x + box.w, box.y - 8, { align: 'right', color: THEME.ink, font: THEME.fontTitle })
  },

  // ── Tab 1：λ、λ/2、λ/4 长度标尺 ──
  _drawWl(ctx, w, h) {
    const d = this._wl
    if (!d) { this._hint(ctx, w, h); return }
    const box = { x: 64, y: 34, w: w - 84, h: h - 78 }
    const inCm = d.wl < 2
    const k = inCm ? 100 : 1
    const p = lc.plot(ctx, box, [0, d.wl * k * 1.12], [0, 1])
    p.axes({ yTicks: [], xLabel: '长度（' + (inCm ? 'cm' : 'm') + '）' })
    const rows = [
      { name: 'λ', v: d.wl, color: THEME.accent, fy: 0.18 },
      { name: 'λ/2', v: d.wl / 2, color: THEME.teal, fy: 0.5 },
      { name: 'λ/4', v: d.wl / 4, color: THEME.gold, fy: 0.82 },
    ]
    rows.forEach((r) => {
      const y = box.y + box.h * r.fy - 9
      ctx.fillStyle = alpha('#20201c', 0.05)
      ctx.fillRect(box.x, y, box.w, 18)
      lc.barH(ctx, box.x, y, Math.max(2, p.X(r.v * k) - box.x), 18, r.color)
      lc.label(ctx, r.name, box.x - 8, y + 13, {
        align: 'right', color: THEME.inkSoft, font: THEME.fontNote,
      })
      lc.label(ctx, rf.fmtLen(r.v),
        Math.min(p.X(r.v * k) + 6, box.x + box.w - 40), y + 13, {
          color: THEME.ink, font: THEME.fontLabel,
        })
    })
    // 直观参照：手机宽度 ≈ 7 cm
    if (inCm && d.wl * k * 1.12 > 7) {
      p.guideX(7, alpha(THEME.indigo, 0.55))
      lc.label(ctx, '手机宽 ≈7 cm', p.X(7) + 4, box.y + 10, {
        color: THEME.indigo, font: THEME.fontTick,
      })
    }
  },

  // ── Tab 2：驻波包络 |V(z)|/|V⁺| = √(1+|Γ|²+2|Γ|cos(2βz)) ──
  _drawVswr(ctx, w, h) {
    const d = this._vswr
    if (!d) { this._hint(ctx, w, h); return }
    const g = d.gamma
    const box = { x: 56, y: 28, w: w - 74, h: h - 70 }
    const p = lc.plot(ctx, box, [-1, 0], [0, 2.2])
    p.axes({
      xTicks: [-1, -0.75, -0.5, -0.25, 0],
      yTicks: [0, 0.5, 1, 1.5, 2],
      xLabel: '离负载距离 z/λ（负载在 0）',
      yLabel: '|V(z)| / |V⁺|',
    })
    const N = 240, xs = [], ys = []
    for (let i = 0; i <= N; i++) {
      const z = -1 + i / N
      xs.push(z)
      // β = 2π/λ ⇒ 2βz = 4π·(z/λ)；取 ∠Γ=0（负载处为波腹）
      ys.push(Math.sqrt(1 + g * g + 2 * g * Math.cos(4 * Math.PI * z)))
    }
    p.area(xs, ys, THEME.accent, 0)
    p.line(xs, ys, THEME.accent, 2)
    p.guideY(1 + g, alpha(THEME.teal, 0.8))
    p.guideY(Math.max(0.001, 1 - g), alpha(THEME.indigo, 0.8))
    lc.label(ctx, 'Vmax = 1+|Γ| = ' + (1 + g).toFixed(3), p.X(-0.985), p.Y(1 + g) - 7, {
      color: THEME.teal, font: THEME.fontLabel,
    })
    lc.label(ctx, 'Vmin = 1−|Γ| = ' + (1 - g).toFixed(3), p.X(-0.985), p.Y(1 - g) + 15, {
      color: THEME.indigo, font: THEME.fontLabel,
    })
    lc.label(ctx, 'VSWR = Vmax/Vmin = ' + d.s.toFixed(2),
      box.x + box.w, box.y - 8, { align: 'right', color: THEME.ink, font: THEME.fontTitle })
  },

  // ── Tab 3：δ–f 全景（log–log，5 种导体，当前点高亮）──
  _drawSkin(ctx, w, h) {
    const box = { x: 56, y: 26, w: w - 74, h: h - 88 }
    const p = lc.plot(ctx, box, [6, 11], [-1, 2.4])
    p.axes({
      xTicks: [6, 7, 8, 9, 10, 11],
      xFmt: (t) => (t < 9 ? Math.pow(10, t - 6) + 'M' : Math.pow(10, t - 9) + 'G'),
      yTicks: [-1, 0, 1, 2],
      yFmt: (t) => String(Math.pow(10, t)),
      xLabel: '频率（Hz，对数）',
      yLabel: 'δ（μm，对数）',
    })
    const si = MATERIALS[this.data.material] ? this.data.material : 1
    MATERIALS.forEach((m, i) => {
      const xs = [], ys = []
      for (let j = 0; j <= 60; j++) {
        const lg = 6 + 5 * j / 60
        xs.push(lg)
        ys.push(Math.log10(rf.skinDepth(Math.pow(10, lg), m.sigma) * 1e6))
      }
      const on = i === si
      p.line(xs, ys, on ? THEME.series[i] : alpha(THEME.series[i], 0.4), on ? 2.5 : 1.3)
    })
    lc.legend(ctx, MATERIALS.map((m, i) => ({ name: m.name, color: THEME.series[i] })),
      box.x, h - 14)
    lc.label(ctx, 'δ ∝ 1/√f：频率 ×100 → δ ÷10', box.x + box.w, box.y - 8, {
      align: 'right', color: THEME.inkSoft, font: THEME.fontLabel,
    })
    const d = this._skin
    if (d) {
      const lgf = Math.log10(d.fHz)
      if (lgf >= 6 && lgf <= 11) {
        const yv = Math.log10(d.delta * 1e6)
        p.guideX(lgf)
        p.dot(lgf, yv, THEME.series[si])
        lc.label(ctx, MATERIALS[si].name + '：δ = ' + rf.fmtLen(d.delta),
          p.X(lgf) + 8, p.Y(yv) - 10, { color: THEME.ink, font: THEME.fontTitle })
      }
    }
  },

  // ── Tab 4：Ae–G 对数直线（当前频率）──
  _drawGain(ctx, w, h) {
    const d = this._gain
    if (!d) { this._hint(ctx, w, h); return }
    const y0 = Math.log10(d.wl * d.wl / (4 * Math.PI)) // G=1（0 dBi）时的 Ae
    const box = { x: 62, y: 26, w: w - 80, h: h - 68 }
    const p = lc.plot(ctx, box, [0, 40], [y0 - 0.4, y0 + 4.4])
    const yTicks = []
    for (let t = Math.ceil(y0 - 0.4); t <= y0 + 4.4; t++) yTicks.push(t)
    p.axes({
      xTicks: [0, 10, 20, 30, 40],
      yTicks,
      yFmt: (t) => (t === 0 ? '1' : '1e' + t),
      xLabel: '增益 G (dBi)',
      yLabel: 'Ae (m²，对数)',
    })
    // log10(Ae) = G(dBi)/10 + log10(λ²/4π)
    p.line([0, 40], [y0, y0 + 4], THEME.accent, 2)
    lc.label(ctx, 'Ae = G·λ²/4π（λ = ' + rf.fmtLen(d.wl) + '）',
      p.X(1.5), p.Y(y0 + 3.7), { color: THEME.accent, font: THEME.fontLabel })
    if (d.gDbi >= 0 && d.gDbi <= 40) {
      p.guideX(d.gDbi); p.guideY(Math.log10(d.ae))
      p.dot(d.gDbi, Math.log10(d.ae), THEME.accent)
    }
    lc.label(ctx, 'G = ' + d.gDbi.toFixed(1) + ' dBi ↔ Ae = ' + this._fmtArea(d.ae),
      box.x + box.w, box.y - 8, { align: 'right', color: THEME.ink, font: THEME.fontTitle })
  },

  // ── Tab 5：距离分区图（对数距离轴上三段着色）──
  _drawFf(ctx, w, h) {
    const d = this._ff
    if (!d) { this._hint(ctx, w, h); return }
    const lgFF = Math.log10(d.rFF)
    const hasNf = d.rNF > 0
    const lgNF = hasNf ? Math.log10(d.rNF) : lgFF - 1.2
    const xmin = lgNF - 0.9, xmax = lgFF + 0.7
    const box = { x: 46, y: 48, w: w - 66, h: h - 104 }
    const p = lc.plot(ctx, box, [xmin, xmax], [0, 1])
    if (hasNf) p.bandX(xmin, lgNF, alpha(THEME.gold, 0.14))
    p.bandX(hasNf ? lgNF : xmin, lgFF, alpha(THEME.indigo, 0.12))
    p.bandX(lgFF, xmax, alpha(THEME.teal, 0.16))
    const xTicks = []
    for (let t = Math.ceil(xmin); t <= xmax; t++) xTicks.push(t)
    p.axes({
      xTicks,
      xFmt: (t) => rf.fmtLen(Math.pow(10, t)),
      yTicks: [],
      xLabel: '离天线距离 R（对数）',
    })
    if (hasNf) {
      p.guideX(lgNF, THEME.gold)
      lc.label(ctx, '0.62√(D³/λ) = ' + rf.fmtLen(d.rNF), p.X(lgNF), box.y - 24, {
        align: 'center', color: THEME.gold, font: THEME.fontLabel,
      })
    }
    p.guideX(lgFF, THEME.teal)
    lc.label(ctx, '2D²/λ = ' + rf.fmtLen(d.rFF), p.X(lgFF), box.y - 8, {
      align: 'center', color: THEME.teal, font: THEME.fontLabel,
    })
    const midY = box.y + box.h * 0.46
    if (hasNf) {
      lc.label(ctx, '感应近场', (p.X(xmin) + p.X(lgNF)) / 2, midY, {
        align: 'center', color: THEME.gold, font: THEME.fontLabel,
      })
    }
    lc.label(ctx, hasNf ? '辐射近场（Fresnel）' : '近场',
      (p.X(hasNf ? lgNF : xmin) + p.X(lgFF)) / 2, midY, {
        align: 'center', color: THEME.indigo, font: THEME.fontLabel,
      })
    lc.label(ctx, '远场（Fraunhofer）', (p.X(lgFF) + p.X(xmax)) / 2, midY, {
      align: 'center', color: THEME.teal, font: THEME.fontLabel,
    })
    lc.label(ctx, hasNf ? '另需 R ≫ D 且 R ≫ λ' : 'D < λ：0.62√(D³/λ) 不适用，另需 R ≫ λ',
      box.x + box.w, h - 8, { align: 'right', color: THEME.muted, font: THEME.fontTick })
  },

  _hint(ctx, w, h) {
    lc.label(ctx, '输入有效参数后自动出图', w / 2, h / 2, {
      align: 'center', color: THEME.muted, font: THEME.fontNote,
    })
  },

  // ══════ 格式化 ══════
  _trim(v) { return String(+v.toPrecision(6)) },
  _fmtArea(ae) {
    if (ae >= 1) return +ae.toPrecision(4) + ' m²'
    if (ae >= 1e-4) return +(ae * 1e4).toPrecision(4) + ' cm²'
    return +(ae * 1e6).toPrecision(4) + ' mm²'
  },

  onShareAppMessage() {
    return { title: 'RF 换算合集', path: '/pages/tools/calc/calc' }
  },
})

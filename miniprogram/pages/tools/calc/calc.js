// pages/tools/calc/calc.js —— 专用计算（RF换算合集）
const haptic = require('../../../utils/haptic')

const C = 299792458          // 光速 m/s
const MU0 = 4 * Math.PI * 1e-7 // 真空磁导率

// 常见导体电导率 σ (S/m)
const MATERIALS = [
  { name: '银',   sigma: 6.30e7 },
  { name: '铜',   sigma: 5.96e7 },
  { name: '金',   sigma: 4.10e7 },
  { name: '铝',   sigma: 3.50e7 },
  { name: '黄铜', sigma: 1.50e7 },
]

// 介质相对介电常数
const MEDIUM_ER = [1.0, 2.2, 4.4]

Page({
  data: {
    tabs: ['dBm↔W', '频率↔波长', 'VSWR', '趋肤深度', '增益↔口径', '远场距离'],
    activeTab: 0,

    // dBm
    dBmInput: '30',
    dBmMode: 0, // 0=dBm输入, 1=W输入
    dBmResult: '',
    dBmExtra: '',
    dBmExtraLabel: '',

    // 频率波长
    freqInput: '2400',
    freqUnit: 1, // 0=MHz, 1=GHz
    mediums: ['真空/空气', 'PTFE (εr=2.2)', 'FR4 (εr=4.4)'],
    medium: 0,
    wlResult: '',
    wlHalf: '',
    wlQuarter: '',

    // VSWR
    vswrInput: '1.5',
    vswrResult: null,

    // 趋肤深度
    skinFreq: '1000',
    skinFreqUnit: 1, // 0=MHz, 1=GHz
    materials: MATERIALS,
    material: 1, // 默认铜
    skinResult: '',

    // 增益↔有效口径
    gainInput: '15',     // 增益 dBi
    gainFreq: '10',      // 频率
    gainFreqUnit: 1,     // 0=MHz 1=GHz
    gainResult: null,

    // 远场距离
    ffFreq: '10',        // 频率
    ffFreqUnit: 1,       // 0=MHz 1=GHz
    ffD: '1',            // 天线最大尺寸 m
    ffResult: null,
  },

  onLoad() {
    this.calcAll()
  },

  switchTab(e) {
    haptic.light()
    this.setData({ activeTab: +e.currentTarget.dataset.index })
  },

  // ══════ dBm ↔ W ══════
  onDBmInput(e) {
    this.setData({ dBmInput: e.detail.value }, () => this.calcDBm())
  },
  toggleDBm(e) {
    haptic.light()
    this.setData({ dBmMode: +e.currentTarget.dataset.mode }, () => this.calcDBm())
  },
  calcDBm() {
    const val = parseFloat(this.data.dBmInput)
    if (isNaN(val)) { this.setData({ dBmResult: '', dBmExtra: '' }); return }
    const mode = this.data.dBmMode
    if (mode === 0) {
      // dBm → W
      const w = Math.pow(10, val / 10) / 1000
      this.setData({
        dBmResult: this.formatPower(w),
        dBmExtra: (val + 30).toFixed(1) + ' dBμV (50Ω)',
        dBmExtraLabel: '电压',
      })
    } else {
      // W → dBm
      if (val <= 0) { this.setData({ dBmResult: '', dBmExtra: '' }); return }
      const dBm = 10 * Math.log10(val * 1000)
      this.setData({
        dBmResult: dBm.toFixed(2) + ' dBm',
        dBmExtra: this.formatPower(val),
        dBmExtraLabel: '功率',
      })
    }
  },

  // ══════ 频率 ↔ 波长 ══════
  onFreqInput(e) {
    this.setData({ freqInput: e.detail.value }, () => this.calcWL())
  },
  setFreqUnit(e) {
    haptic.light()
    this.setData({ freqUnit: +e.currentTarget.dataset.unit }, () => this.calcWL())
  },
  setMedium(e) {
    haptic.light()
    this.setData({ medium: +e.currentTarget.dataset.index }, () => this.calcWL())
  },
  calcWL() {
    const f = parseFloat(this.data.freqInput)
    if (isNaN(f) || f <= 0) { this.setData({ wlResult: '', wlHalf: '', wlQuarter: '' }); return }
    const freqHz = f * (this.data.freqUnit === 0 ? 1e6 : 1e9)
    const er = MEDIUM_ER[this.data.medium]
    const v = C / Math.sqrt(er)
    const wl = v / freqHz
    this.setData({
      wlResult: this.formatLength(wl),
      wlHalf: this.formatLength(wl / 2),
      wlQuarter: this.formatLength(wl / 4),
    })
  },

  // ══════ VSWR ══════
  onVSWRInput(e) {
    this.setData({ vswrInput: e.detail.value }, () => this.calcVSWR())
  },
  calcVSWR() {
    const vswr = parseFloat(this.data.vswrInput)
    if (isNaN(vswr) || vswr < 1) { this.setData({ vswrResult: null }); return }
    const gamma = (vswr - 1) / (vswr + 1)
    const rl = -20 * Math.log10(gamma)
    const pref = gamma * gamma * 100
    const mismatch = -10 * Math.log10(1 - gamma * gamma)
    this.setData({
      vswrResult: {
        gamma: gamma.toFixed(4),
        rl: rl.toFixed(2),
        pref: pref.toFixed(2),
        mismatch: mismatch.toFixed(2),
      }
    })
  },

  // ══════ 趋肤深度 ══════
  onSkinFreq(e) {
    this.setData({ skinFreq: e.detail.value }, () => this.calcSkin())
  },
  setSkinFreqUnit(e) {
    haptic.light()
    this.setData({ skinFreqUnit: +e.currentTarget.dataset.unit }, () => this.calcSkin())
  },
  setMaterial(e) {
    haptic.light()
    this.setData({ material: +e.currentTarget.dataset.index }, () => this.calcSkin())
  },
  calcSkin() {
    const f = parseFloat(this.data.skinFreq)
    if (isNaN(f) || f <= 0) { this.setData({ skinResult: '' }); return }
    const freqHz = f * (this.data.skinFreqUnit === 0 ? 1e6 : 1e9)
    const sigma = MATERIALS[this.data.material].sigma
    const mu = MU0 // 非磁性材料 μ≈μ0
    const delta = Math.sqrt(2 / (2 * Math.PI * freqHz * mu * sigma))
    this.setData({ skinResult: this.formatLength(delta) })
  },

  // ══════ 增益 ↔ 有效口径 ══════
  onGainInput(e) { this.setData({ gainInput: e.detail.value }, () => this.calcGain()) },
  onGainFreq(e) { this.setData({ gainFreq: e.detail.value }, () => this.calcGain()) },
  setGainFreqUnit(e) {
    haptic.light()
    this.setData({ gainFreqUnit: +e.currentTarget.dataset.unit }, () => this.calcGain())
  },
  calcGain() {
    const g = parseFloat(this.data.gainInput)
    const f = parseFloat(this.data.gainFreq)
    if (isNaN(g) || isNaN(f) || f <= 0) { this.setData({ gainResult: null }); return }
    const freqHz = f * (this.data.gainFreqUnit === 0 ? 1e6 : 1e9)
    const wl = C / freqHz
    const gLin = Math.pow(10, g / 10)
    // Ae = G·λ²/(4π)
    const ae = gLin * wl * wl / (4 * Math.PI)
    // 反向：从口径算增益也同步给出参考
    this.setData({
      gainResult: {
        wavelength: this.formatLength(wl),
        ae: ae.toFixed(4) + ' m²',
        aeCm: (ae * 1e4).toFixed(2) + ' cm²',
        gLin: gLin.toFixed(0) + ' (线性)',
      }
    })
  },

  // ══════ 远场距离 (Fraunhofer) ══════
  onFFFreq(e) { this.setData({ ffFreq: e.detail.value }, () => this.calcFF()) },
  onFFD(e) { this.setData({ ffD: e.detail.value }, () => this.calcFF()) },
  setFFFreqUnit(e) {
    haptic.light()
    this.setData({ ffFreqUnit: +e.currentTarget.dataset.unit }, () => this.calcFF())
  },
  calcFF() {
    const f = parseFloat(this.data.ffFreq)
    const D = parseFloat(this.data.ffD)
    if (isNaN(f) || f <= 0 || isNaN(D) || D <= 0) { this.setData({ ffResult: null }); return }
    const freqHz = f * (this.data.ffFreqUnit === 0 ? 1e6 : 1e9)
    const wl = C / freqHz
    // R_ff = 2D²/λ（Fraunhofer 远场条件）
    const rFF = 2 * D * D / wl
    // 同时算感应近场边界 R_nf ≈ 0.62·√(D³/λ)
    const rNF = D > wl ? 0.62 * Math.sqrt(Math.pow(D, 3) / wl) : 0
    this.setData({
      ffResult: {
        rFF: rFF >= 1 ? rFF.toFixed(2) + ' m' : (rFF * 100).toFixed(1) + ' cm',
        rNF: rNF > 0 ? (rNF >= 1 ? rNF.toFixed(2) + ' m' : (rNF * 100).toFixed(1) + ' cm') : '—',
        wavelength: this.formatLength(wl),
        dOverLam: (D / wl).toFixed(1) + ' λ',
      }
    })
  },

  // ══════ 全部计算 ══════
  calcAll() {
    this.calcDBm()
    this.calcWL()
    this.calcVSWR()
    this.calcSkin()
    this.calcGain()
    this.calcFF()
  },

  // ══════ 格式化工具 ══════
  formatPower(w) {
    if (w >= 1) return w.toFixed(4) + ' W'
    if (w >= 1e-3) return (w * 1e3).toFixed(2) + ' mW'
    if (w >= 1e-6) return (w * 1e6).toFixed(2) + ' μW'
    return (w * 1e9).toFixed(2) + ' nW'
  },
  formatLength(m) {
    if (m >= 1) return m.toFixed(4) + ' m'
    if (m >= 1e-3) return (m * 1e3).toFixed(2) + ' mm'
    if (m >= 1e-6) return (m * 1e6).toFixed(2) + ' μm'
    return (m * 1e9).toFixed(2) + ' nm'
  },
})

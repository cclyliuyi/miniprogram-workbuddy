// pages/tools/link/link.js —— 通信链路计算
const haptic = require('../../../utils/haptic')
const { TOOLS_FORMULA_IDS } = require('../../../utils/cloud-images')

const C = 299792458   // 光速
const KB = 1.38e-23    // 玻尔兹曼常数 J/K
const R_EARTH = 6371000 // 地球半径 m

Page({
  data: {
    tabs: ['链路预算', '菲涅尔区', '视距', '噪声灵敏度'],
    activeTab: 0,

    // 公式渲染图
    formulaLOS: TOOLS_FORMULA_IDS.los,
    formulaNoise: TOOLS_FORMULA_IDS.noise,

    // === 链路预算 ===
    pt: '30',
    ptUnit: 0,
    gt: '6',
    freq: '2400',
    freqUnit: 1,
    distance: '1',
    gr: '6',
    sysLoss: '2',
    sensitivity: '-90',
    result: null,

    // === 菲涅尔区 ===
    frFreq: '2400',
    frFreqUnit: 1,
    frD1: '0.5',
    frD2: '0.5',
    fresnelResult: null,

    // === 视距 ===
    losHt: '30',
    losHr: '2',
    losK: 1.333,
    losResult: null,

    // === 噪声灵敏度 ===
    nfBw: '1',
    nfBwUnit: 1,  // 0=kHz 1=MHz
    nfVal: '4',
    nfSnr: '10',
    nfTemp: '290',
    noiseResult: null,
  },

  switchTab(e) {
    haptic.light()
    this.setData({ activeTab: +e.currentTarget.dataset.index })
  },

  // ══════ 链路预算 ══════
  onPtChange(e) { this.setData({ pt: e.detail.value }) },
  setPtUnit(e) { haptic.light(); this.setData({ ptUnit: +e.currentTarget.dataset.unit }) },
  onGtChange(e) { this.setData({ gt: e.detail.value }) },
  onFreqChange(e) { this.setData({ freq: e.detail.value }) },
  setFreqUnit(e) { haptic.light(); this.setData({ freqUnit: +e.currentTarget.dataset.unit }) },
  onDistChange(e) { this.setData({ distance: e.detail.value }) },
  onGrChange(e) { this.setData({ gr: e.detail.value }) },
  onLossChange(e) { this.setData({ sysLoss: e.detail.value }) },
  onSensChange(e) { this.setData({ sensitivity: e.detail.value }) },

  calculate() {
    haptic.medium()
    const pt_dBm = this.data.ptUnit === 0
      ? parseFloat(this.data.pt)
      : 10 * Math.log10(parseFloat(this.data.pt) * 1000)
    const gt = parseFloat(this.data.gt) || 0
    const f = parseFloat(this.data.freq) * (this.data.freqUnit === 0 ? 1e6 : 1e9)
    const d = parseFloat(this.data.distance) * 1000
    const gr = parseFloat(this.data.gr) || 0
    const lSys = parseFloat(this.data.sysLoss) || 0
    const sens = parseFloat(this.data.sensitivity)

    if (isNaN(pt_dBm) || isNaN(f) || f <= 0 || isNaN(d) || d <= 0) {
      wx.showToast({ title: '参数有误', icon: 'none' }); return
    }
    const eirp = pt_dBm + gt
    const wavelength = C / f
    const fspl = 20 * Math.log10(4 * Math.PI * d / wavelength)
    const pr = eirp + gr - fspl - lSys
    const margin = pr - sens

    let verdict, verdictClass, marginClass
    if (margin >= 10) {
      verdict = '✓ 链路余量充足，通信可靠'
      verdictClass = 'tl2-verdict-ok'; marginClass = 'tl2-margin-ok'
    } else if (margin >= 0) {
      verdict = '△ 余量偏小，建议增加裕度'
      verdictClass = 'tl2-verdict-warn'; marginClass = 'tl2-margin-warn'
    } else {
      verdict = '✗ 链路不可达，需提高功率/增益或缩短距离'
      verdictClass = 'tl2-verdict-fail'; marginClass = 'tl2-margin-fail'
    }

    this.setData({
      result: { eirp: eirp.toFixed(1), fspl: fspl.toFixed(1), pr: pr.toFixed(1), margin: margin.toFixed(1), marginClass, verdict, verdictClass }
    })
  },

  // ══════ 菲涅尔区 ══════
  onFrFreq(e) { this.setData({ frFreq: e.detail.value }) },
  setFrFreqUnit(e) { haptic.light(); this.setData({ frFreqUnit: +e.currentTarget.dataset.unit }) },
  onFrD1(e) { this.setData({ frD1: e.detail.value }) },
  onFrD2(e) { this.setData({ frD2: e.detail.value }) },

  calcFresnel() {
    haptic.medium()
    const f = parseFloat(this.data.frFreq) * (this.data.frFreqUnit === 0 ? 1e6 : 1e9)
    const d1 = parseFloat(this.data.frD1) * 1000 // km→m
    const d2 = parseFloat(this.data.frD2) * 1000
    if (isNaN(f) || f <= 0 || isNaN(d1) || d1 <= 0 || isNaN(d2) || d2 <= 0) {
      wx.showToast({ title: '参数有误', icon: 'none' }); return
    }
    const wl = C / f
    // r₁ = √(λ·d₁·d₂ / (d₁+d₂))
    const r1 = Math.sqrt(wl * d1 * d2 / (d1 + d2))
    const totalD = (d1 + d2) / 1000
    // 60% 净空是工程上的最低要求
    const r60 = 0.6 * r1

    this.setData({
      fresnelResult: {
        r1: this.fmtLen(r1),
        r60: this.fmtLen(r60),
        totalD: totalD.toFixed(2) + ' km',
      }
    })
  },

  // ══════ 视距 ══════
  onLosHt(e) { this.setData({ losHt: e.detail.value }) },
  onLosHr(e) { this.setData({ losHr: e.detail.value }) },
  setLosK(e) { haptic.light(); this.setData({ losK: +e.currentTarget.dataset.k }) },

  calcLOS() {
    haptic.medium()
    const ht = parseFloat(this.data.losHt)
    const hr = parseFloat(this.data.losHr)
    const k = this.data.losK
    if (isNaN(ht) || ht <= 0 || isNaN(hr) || hr <= 0) {
      wx.showToast({ title: '参数有误', icon: 'none' }); return
    }
    const ke = k * R_EARTH
    // d = √(2·k·R·h_t) + √(2·k·R·h_r)
    const dHt = Math.sqrt(2 * ke * ht) / 1000 // km
    const dHr = Math.sqrt(2 * ke * hr) / 1000
    const dLOS = dHt + dHr

    this.setData({
      losResult: {
        dLOS: dLOS.toFixed(1),
        dHt: dHt.toFixed(1),
        dHr: dHr.toFixed(1),
      }
    })
  },

  // ══════ 噪声与灵敏度 ══════
  onNfBw(e) { this.setData({ nfBw: e.detail.value }) },
  setNfBwUnit(e) { haptic.light(); this.setData({ nfBwUnit: +e.currentTarget.dataset.unit }) },
  onNfVal(e) { this.setData({ nfVal: e.detail.value }) },
  onNfSnr(e) { this.setData({ nfSnr: e.detail.value }) },
  onNfTemp(e) { this.setData({ nfTemp: e.detail.value }) },

  calcNoise() {
    haptic.medium()
    const bw = parseFloat(this.data.nfBw) * (this.data.nfBwUnit === 0 ? 1e3 : 1e6)
    const nf = parseFloat(this.data.nfVal) || 0
    const snr = parseFloat(this.data.nfSnr)
    const T = parseFloat(this.data.nfTemp) || 290
    if (isNaN(bw) || bw <= 0) {
      wx.showToast({ title: '参数有误', icon: 'none' }); return
    }
    // 热噪声功率 Pn = k·T·B (W)
    const pnW = KB * T * bw
    const pnDBm = 10 * Math.log10(pnW) + 30 // W → dBm
    // 加噪声系数
    const pnSysDBm = pnDBm + nf
    // 灵敏度 = 系统噪声 + 所需 SNR
    const sensDBm = pnSysDBm + snr
    const sensW = Math.pow(10, (sensDBm - 30) / 10)

    this.setData({
      noiseResult: {
        pn: pnSysDBm.toFixed(1),
        pnW: this.fmtP(pnW),
        sens: sensDBm.toFixed(1),
        sensW: this.fmtP(sensW),
      }
    })
  },

  // 格式化
  fmtLen(m) {
    if (m >= 1) return m.toFixed(2) + ' m'
    if (m >= 1e-2) return (m * 100).toFixed(1) + ' cm'
    return (m * 1000).toFixed(1) + ' mm'
  },
  fmtP(w) {
    if (w >= 1) return w.toFixed(4) + ' W'
    if (w >= 1e-3) return (w * 1e3).toFixed(2) + ' mW'
    if (w >= 1e-9) return (w * 1e9).toFixed(2) + ' nW'
    return (w * 1e12).toFixed(2) + ' pW'
  },
})

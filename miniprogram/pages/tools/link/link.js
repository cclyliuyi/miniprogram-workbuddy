// pages/tools/link/link.js —— 通信链路计算
const haptic = require('../../../utils/haptic')

const C = 299792458 // 光速

Page({
  data: {
    pt: '30',        // 发射功率
    ptUnit: 0,       // 0=dBm, 1=W
    gt: '6',         // 发射增益 dBi
    freq: '2400',    // 频率
    freqUnit: 1,     // 0=MHz, 1=GHz
    distance: '1',   // 距离 km
    gr: '6',         // 接收增益 dBi
    sysLoss: '2',    // 系统损耗 dB
    sensitivity: '-90', // 灵敏度 dBm
    result: null,
  },

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

    // 解析输入
    const pt_dBm = this.data.ptUnit === 0
      ? parseFloat(this.data.pt)
      : 10 * Math.log10(parseFloat(this.data.pt) * 1000)
    const gt = parseFloat(this.data.gt) || 0
    const f = parseFloat(this.data.freq) * (this.data.freqUnit === 0 ? 1e6 : 1e9)
    const d = parseFloat(this.data.distance) * 1000 // km → m
    const gr = parseFloat(this.data.gr) || 0
    const lSys = parseFloat(this.data.sysLoss) || 0
    const sens = parseFloat(this.data.sensitivity)

    if (isNaN(pt_dBm) || isNaN(f) || f <= 0 || isNaN(d) || d <= 0) {
      wx.showToast({ title: '参数有误', icon: 'none' })
      return
    }

    // EIRP = Pt + Gt
    const eirp = pt_dBm + gt

    // FSPL = 20log10(4πd/λ) = 20log10(d) + 20log10(f) + 20log10(4π/c)
    const wavelength = C / f
    const fspl = 20 * Math.log10(4 * Math.PI * d / wavelength)

    // 接收功率 Pr = EIRP + Gr - FSPL - Lsys
    const pr = eirp + gr - fspl - lSys

    // 链路余量 = Pr - Pmin
    const margin = pr - sens

    // 判定
    let verdict, verdictClass, marginClass
    if (margin >= 10) {
      verdict = '✓ 链路余量充足，通信可靠'
      verdictClass = 'tl2-verdict-ok'
      marginClass = 'tl2-margin-ok'
    } else if (margin >= 0) {
      verdict = '△ 余量偏小，建议增加裕度'
      verdictClass = 'tl2-verdict-warn'
      marginClass = 'tl2-margin-warn'
    } else {
      verdict = '✗ 链路不可达，需提高功率/增益或缩短距离'
      verdictClass = 'tl2-verdict-fail'
      marginClass = 'tl2-margin-fail'
    }

    this.setData({
      result: {
        eirp: eirp.toFixed(1),
        fspl: fspl.toFixed(1),
        pr: pr.toFixed(1),
        margin: margin.toFixed(1),
        marginClass,
        verdict,
        verdictClass,
      }
    })
  },
})

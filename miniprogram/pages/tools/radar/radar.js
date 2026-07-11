// pages/tools/radar/radar.js —— Radar 链路计算
const haptic = require('../../../utils/haptic')

const C = 299792458 // 光速

Page({
  data: {
    radarTab: 0,

    // 雷达方程
    rPt: '100',      // 峰值功率
    rPtUnit: 0,       // 0=kW, 1=W
    rG: '35',         // 天线增益 dBi
    rFreq: '10',      // 频率
    rFreqUnit: 1,     // 0=MHz, 1=GHz
    rcs: '5',         // RCS m²
    smin: '-120',     // 最小可检测信号 dBm
    rLoss: '4',       // 系统损耗 dB
    rangeResult: null,

    // 多普勒
    dFreq: '10',      // 载频
    dFreqUnit: 1,
    dVel: '300',      // 目标径向速度 m/s
    dopplerResult: '',

    // 模糊
    prf: '2000',      // PRF Hz
    ambigResult: null,
  },

  switchRadarTab(e) {
    haptic.light()
    this.setData({ radarTab: +e.currentTarget.dataset.i })
  },

  // 雷达方程输入
  onRPtChange(e) { this.setData({ rPt: e.detail.value }) },
  setRPtUnit(e) { haptic.light(); this.setData({ rPtUnit: +e.currentTarget.dataset.u }) },
  onRGChange(e) { this.setData({ rG: e.detail.value }) },
  onRFreqChange(e) { this.setData({ rFreq: e.detail.value }) },
  setRFreqUnit(e) { haptic.light(); this.setData({ rFreqUnit: +e.currentTarget.dataset.u }) },
  onRcsChange(e) { this.setData({ rcs: e.detail.value }) },
  onSminChange(e) { this.setData({ smin: e.detail.value }) },
  onRLossChange(e) { this.setData({ rLoss: e.detail.value }) },

  // 计算最大探测距离
  calcRange() {
    haptic.medium()
    const pt = parseFloat(this.data.rPt)
    if (isNaN(pt)) { wx.showToast({ title: '功率有误', icon: 'none' }); return }
    const ptW = this.data.rPtUnit === 0 ? pt * 1000 : pt
    const g = parseFloat(this.data.rG) || 0
    const gLin = Math.pow(10, g / 10)
    const f = parseFloat(this.data.rFreq) * (this.data.rFreqUnit === 0 ? 1e6 : 1e9)
    const rcs = parseFloat(this.data.rcs)
    const smin_dBm = parseFloat(this.data.smin)
    const sminW = Math.pow(10, (smin_dBm - 30) / 10) // dBm → W
    const loss = parseFloat(this.data.rLoss) || 0
    const lossLin = Math.pow(10, loss / 10)

    if (f <= 0 || rcs <= 0 || sminW <= 0) {
      wx.showToast({ title: '参数有误', icon: 'none' })
      return
    }

    const wavelength = C / f
    // R_max = [Pt * G² * λ² * σ / ((4π)³ * Smin * L)]^(1/4)
    const numerator = ptW * gLin * gLin * wavelength * wavelength * rcs
    const denominator = Math.pow(4 * Math.PI, 3) * sminW * lossLin
    const rMax = Math.pow(numerator / denominator, 0.25)

    // 等效孔径 Ae = Gλ²/(4π)
    const ae = gLin * wavelength * wavelength / (4 * Math.PI)

    this.setData({
      rangeResult: {
        rKm: (rMax / 1000).toFixed(1),
        wavelength: this.fmtLen(wavelength),
        ae: ae.toFixed(2) + ' m²',
      }
    })
  },

  // 多普勒输入
  onDFreq(e) { this.setData({ dFreq: e.detail.value }) },
  setDFreqUnit(e) { haptic.light(); this.setData({ dFreqUnit: +e.currentTarget.dataset.u }) },
  onDVel(e) { this.setData({ dVel: e.detail.value }) },

  calcDoppler() {
    haptic.medium()
    const f = parseFloat(this.data.dFreq) * (this.data.dFreqUnit === 0 ? 1e6 : 1e9)
    const vr = parseFloat(this.data.dVel)
    if (isNaN(f) || f <= 0 || isNaN(vr)) {
      wx.showToast({ title: '参数有误', icon: 'none' })
      return
    }
    // fd = 2·vr / λ = 2·vr·f / c
    const fd = 2 * vr * f / C
    this.setData({
      dopplerResult: this.fmtFreq(fd)
    })
  },

  // 模糊输入
  onPrf(e) { this.setData({ prf: e.detail.value }) },

  calcAmbiguity() {
    haptic.medium()
    const prf = parseFloat(this.data.prf)
    const f = parseFloat(this.data.dFreq) * (this.data.dFreqUnit === 0 ? 1e6 : 1e9)
    if (isNaN(prf) || prf <= 0 || isNaN(f) || f <= 0) {
      wx.showToast({ title: '参数有误', icon: 'none' })
      return
    }
    // 最大不模糊距离 Ru = c / (2·PRF)
    const ru = C / (2 * prf)
    // 最大不模糊速度 va = λ·PRF / 4
    const wavelength = C / f
    const va = wavelength * prf / 4

    this.setData({
      ambigResult: {
        ru: (ru / 1000).toFixed(2) + ' km',
        va: va.toFixed(1) + ' m/s',
      }
    })
  },

  // 格式化
  fmtLen(m) {
    if (m >= 1) return m.toFixed(3) + ' m'
    if (m >= 1e-2) return (m * 100).toFixed(1) + ' cm'
    return (m * 1000).toFixed(1) + ' mm'
  },
  fmtFreq(hz) {
    if (hz >= 1e6) return (hz / 1e6).toFixed(2) + ' MHz'
    if (hz >= 1e3) return (hz / 1e3).toFixed(2) + ' kHz'
    return hz.toFixed(2) + ' Hz'
  },
})

// pages/tools/index.js —— 常用工具首页
const haptic = require('../../utils/haptic')

Page({
  data: {},

  goCalc() {
    haptic.light()
    wx.navigateTo({ url: '/pages/tools/calc/calc' })
  },
  goArray() {
    haptic.light()
    wx.navigateTo({ url: '/pages/tools/array/array' })
  },
  goLink() {
    haptic.light()
    wx.navigateTo({ url: '/pages/tools/link/link' })
  },
  goRadar() {
    haptic.light()
    wx.navigateTo({ url: '/pages/tools/radar/radar' })
  },
  goMatch() {
    haptic.light()
    wx.navigateTo({ url: '/pages/tools/match/match' })
  },
  goSmith() {
    haptic.light()
    wx.navigateTo({ url: '/pages/tools/smith/smith' })
  },

  // ═══ 交互动画模块 ═══
  goFriis() {
    haptic.light()
    wx.navigateTo({ url: '/pages/interactive/friis/friis' })
  },
  goSynthesis() {
    haptic.light()
    wx.navigateTo({ url: '/pages/interactive/synthesis/synthesis' })
  },
  goSmithChart() {
    haptic.light()
    wx.navigateTo({ url: '/pages/interactive/smith-chart/smith-chart' })
  },
  goAperture() {
    haptic.light()
    wx.navigateTo({ url: '/pages/interactive/aperture/aperture' })
  },
  goTransmissionLine() {
    haptic.light()
    wx.navigateTo({ url: '/pages/interactive/transmission-line/transmission-line' })
  },

  // ═══ 第二批交互模块 ═══
  goPhasedArray() {
    haptic.light()
    wx.navigateTo({ url: '/pages/interactive/3d-lab/phased-array/phased-array' })
  },
  goPolarization() {
    haptic.light()
    wx.navigateTo({ url: '/pages/interactive/3d-lab/polarization/polarization' })
  },
  goMomentMethod() {
    haptic.light()
    wx.navigateTo({ url: '/pages/interactive/moment-method/moment-method' })
  },
  goBroadbandMatching() {
    haptic.light()
    wx.navigateTo({ url: '/pages/interactive/broadband-matching/broadband-matching' })
  },

  // ═══ 第三批交互模块 ═══
  goMiniaturization() {
    haptic.light()
    wx.navigateTo({ url: '/pages/interactive/miniaturization/miniaturization' })
  },
  goRadiationIntegral() {
    haptic.light()
    wx.navigateTo({ url: '/pages/interactive/radiation-integral/radiation-integral' })
  },
  goSmartArray() {
    haptic.light()
    wx.navigateTo({ url: '/pages/interactive/smart-array/smart-array' })
  },

  // ═══ 第四批：综合实验室 ═══
  goRadiation3D() {
    haptic.light()
    wx.navigateTo({ url: '/pages/interactive/radiation-3d/radiation-3d' })
  },
  goEnergyFlow() {
    haptic.light()
    wx.navigateTo({ url: '/pages/interactive/energy-flow-lab/energy-flow-lab' })
  },
  goFourierSpace() {
    haptic.light()
    wx.navigateTo({ url: '/pages/interactive/fourier-space-lab/fourier-space-lab' })
  },
  goPhaseCoherence() {
    haptic.light()
    wx.navigateTo({ url: '/pages/interactive/phase-coherence-lab/phase-coherence-lab' })
  },
  goBoundaryMode() {
    haptic.light()
    wx.navigateTo({ url: '/pages/interactive/boundary-mode-lab/boundary-mode-lab' })
  },
  goPolarReciprocity() {
    haptic.light()
    wx.navigateTo({ url: '/pages/interactive/polarization-reciprocity-lab/polarization-reciprocity-lab' })
  },

  // ═══ 第五批：3D 天线结构实验室 ═══
  goLoop3D() {
    haptic.light()
    wx.navigateTo({ url: '/pages/interactive/3d-lab/loop/loop' })
  },
  goTravelingWave3D() {
    haptic.light()
    wx.navigateTo({ url: '/pages/interactive/3d-lab/traveling-wave/traveling-wave' })
  },
  goHorn3D() {
    haptic.light()
    wx.navigateTo({ url: '/pages/interactive/3d-lab/horn/horn' })
  },
  goParabolic3D() {
    haptic.light()
    wx.navigateTo({ url: '/pages/interactive/3d-lab/parabolic/parabolic' })
  },
  goMicrostrip3D() {
    haptic.light()
    wx.navigateTo({ url: '/pages/interactive/3d-lab/microstrip/microstrip' })
  },
  goAnechoic3D() {
    haptic.light()
    wx.navigateTo({ url: '/pages/interactive/3d-lab/anechoic/anechoic' })
  },
  goFieldAnim3D() {
    haptic.light()
    wx.navigateTo({ url: '/pages/interactive/3d-lab/field-anim/field-anim' })
  },
  goArraySynth3D() {
    haptic.light()
    wx.navigateTo({ url: '/pages/interactive/3d-lab/array-synthesis/array-synthesis' })
  },

  onShareAppMessage() {
    return {
      title: '天线与电磁波工程师工具箱 · 换算/链路/阵列/圆图',
      path: '/pages/tools/index',
    };
  },

  onShareTimeline() {
    return {
      title: '天线与电磁波工程师工具箱',
    };
  },
})

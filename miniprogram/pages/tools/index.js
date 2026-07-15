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

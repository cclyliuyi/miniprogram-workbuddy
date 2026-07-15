// pages/interactive/index.js —— 交互模块入口
const haptic = require('../../utils/haptic')

Page({
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
})

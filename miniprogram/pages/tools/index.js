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
})

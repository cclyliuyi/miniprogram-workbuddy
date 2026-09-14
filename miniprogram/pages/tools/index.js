// pages/tools/index.js —— 常用工具首页（数据驱动 v2：分段锚点 + 最近使用 + 双列小卡）
const haptic = require('../../utils/haptic')

const RECENT_KEY = 'tools_recent_v1'
const RECENT_MAX = 6

// ── 工具注册表（分区 + 卡片元数据）──
const { SECTIONS } = require('../../utils/tool-registry')

Page({
  data: {
    sections: SECTIONS,
    segs: SECTIONS.map(s => ({ key: s.key, name: s.name })),
    recent: [],
  },

  onShow() {
    let recent = []
    try { recent = wx.getStorageSync(RECENT_KEY) || [] } catch (e) {}
    this.setData({ recent })
  },

  // ── 卡片点击：导航 + 记录最近使用 ──
  onCard(e) {
    haptic.light()
    const { url, key, name, icon, cls } = e.currentTarget.dataset
    let recent = []
    try { recent = wx.getStorageSync(RECENT_KEY) || [] } catch (err) {}
    recent = recent.filter(r => r.key !== key)
    recent.unshift({ key, name, icon, cls, url })
    recent = recent.slice(0, RECENT_MAX)
    try { wx.setStorageSync(RECENT_KEY, recent) } catch (err) {}
    wx.navigateTo({ url })
  },

  // ── 分段锚点导航 ──
  onSeg(e) {
    haptic.light()
    const key = e.currentTarget.dataset.key
    wx.pageScrollTo({ selector: '#sec-' + key, duration: 260, offsetTop: -44 })
  },

  clearRecent() {
    haptic.light()
    try { wx.removeStorageSync(RECENT_KEY) } catch (e) {}
    this.setData({ recent: [] })
  },

  onShareAppMessage() {
    return {
      title: '天线与电磁波工程师工具箱 · 换算/链路/阵列/圆图',
      path: '/pages/tools/index',
    };
  },

  onShareTimeline() {
    return { title: '天线与电磁波工程师工具箱' };
  },
})

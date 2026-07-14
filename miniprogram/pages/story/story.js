// pages/story/story.js —— 故事流（全屏左右滑浏览某月）
// 已升级为 tabBar 页面：onLoad 初始化，onShow 响应月份切换
const { getMonthPhotos } = require('../../utils/db');
const haptic = require('../../utils/haptic');

Page({
  data: {
    month: 7,
    monthLabel: '',
    list: [],
    current: 0,
    flipped: false,
  },

  onLoad(options) {
    // tabBar 页面：options 不带参数。月份从 globalData 读取。
    const app = getApp();
    let month = parseInt(options && options.month, 10);
    if (!month || month < 1 || month > 12) {
      month = (app && app.globalData && app.globalData.currentMonth) || (new Date().getMonth() + 1);
    }
    if (app && app.globalData) app.globalData.currentMonth = month;
    this._loadedMonth = month;
    this.setData({ month, monthLabel: month + '月' });
    this.loadMonth(month);
  },

  // tabBar 页面每次切换回来时触发：检测月份是否变化
  onShow() {
    const app = getApp();
    const gMonth = app && app.globalData && app.globalData.currentMonth;
    if (gMonth && gMonth !== this._loadedMonth) {
      // 月份变了（用户在日历/年视图切了月），重新加载
      this._loadedMonth = gMonth;
      this.setData({ month: gMonth, monthLabel: gMonth + '月' });
      this.loadMonth(gMonth);
    }
  },

  async loadMonth(month) {
    wx.showLoading({ title: '加载中' });
    try {
      const res = await getMonthPhotos(month);
      const list = (res.data || [])
        .map((p) => ({
          day: p.day,
          front: p.front && (p.front.preview || p.front.original) || '',
          back: p.back ? (p.back.preview || p.back.original || '') : '',
          label: month + '月' + p.day + '日',
        }))
        .sort((a, b) => a.day - b.day);
      this.setData({ list, current: 0, flipped: false });
    } catch (e) {
      console.error(e);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  onSwiperChange(e) {
    this.setData({ current: e.detail.current, flipped: false });
  },

  toggleFlip() {
    haptic.light();
    this.setData({ flipped: !this.data.flipped });
  },

  openCard() {
    const item = this.data.list[this.data.current];
    if (!item) return;
    wx.navigateTo({ url: `/pages/card/card?month=${this.data.month}&day=${item.day}` });
  },

  goYear() {
    wx.navigateTo({ url: '/pages/year/year' });
  },

  onShareAppMessage() {
    const item = this.data.list[this.data.current] || {};
    return {
      title: (item.label || '') + ' · 天线与电波传播每日一签',
      path: `/pages/day-detail/day-detail?month=${this.data.month}&day=${item.day}`,
      imageUrl: item.front,
    };
  },
});

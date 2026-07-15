// pages/method/method.js —— 方法论迁移卡片列表（tabBar 入口页）
const { CARDS } = require('./method-data');
const haptic = require('../../utils/haptic');

Page({
  data: {
    cards: [],
    readSet: [],
  },

  onLoad() {
    const cards = CARDS.map(c => ({
      ...c,
      imageSrc: `./images/${c.image}`,
      tagText: c.keywords.slice(0, 3).join(' / '),
    }));
    const readSet = wx.getStorageSync('method_read') || [];
    this.setData({ cards, readSet });
  },

  onShow() {
    const readSet = wx.getStorageSync('method_read') || [];
    this.setData({ readSet });
  },

  openCard(e) {
    const index = e.currentTarget.dataset.index;
    haptic.light();
    wx.navigateTo({
      url: `/pages/method-detail/detail?index=${index}`,
    });
  },
});

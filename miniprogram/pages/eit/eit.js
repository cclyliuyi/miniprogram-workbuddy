// pages/eit/eit.js —— 电磁信息论卡片列表（tabBar 入口页）
const { CARDS } = require('./eit-data');
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
      tagText: c.tags.join(' / '),
    }));
    const readSet = wx.getStorageSync('eit_read') || [];
    this.setData({ cards, readSet });
  },

  onShow() {
    const readSet = wx.getStorageSync('eit_read') || [];
    this.setData({ readSet });
  },

  openCard(e) {
    const index = e.currentTarget.dataset.index;
    haptic.light();
    wx.navigateTo({
      url: `/pages/eit-detail/detail?index=${index}`,
    });
  },
});

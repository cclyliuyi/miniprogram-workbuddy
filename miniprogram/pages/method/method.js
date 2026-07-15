// pages/method/method.js —— 方法论迁移卡片列表（tabBar 入口页）
// 图片策略：直接使用云存储 fileID（已上传至 cloud1-d3gsxamaw26beccb8）
const { CARDS } = require('./method-data');
const { METHOD_FILE_IDS } = require('../../utils/cloud-images');
const haptic = require('../../utils/haptic');

Page({
  data: {
    cards: [],
    readSet: [],
    loading: true,
  },

  onLoad() {
    const cards = CARDS.map(c => ({
      ...c,
      imageSrc: METHOD_FILE_IDS[c.id] || `/pages/method/images/${c.image}`,
      tagText: c.keywords.slice(0, 3).join(' / '),
    }));
    const readSet = wx.getStorageSync('method_read') || [];
    this.setData({ cards, readSet, loading: false });
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

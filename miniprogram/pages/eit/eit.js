// pages/eit/eit.js —— 电磁信息论卡片列表（tabBar 入口页）
// 图片策略：直接使用云存储 fileID（已上传至 cloud1-d3gsxamaw26beccb8）
const { CARDS } = require('./eit-data');
const { EIT_FILE_IDS } = require('../../utils/cloud-images');
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
      imageSrc: EIT_FILE_IDS[c.id] || `/pages/eit/images/${c.image}`,
      tagText: c.tags.join(' / '),
    }));
    const readSet = wx.getStorageSync('eit_read') || [];
    this.setData({ cards, readSet, loading: false });
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

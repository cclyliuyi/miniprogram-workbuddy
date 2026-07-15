// pages/eit-detail/detail.js —— 电磁信息论卡片详情（全屏滑动浏览）
// 图片策略：直接使用云存储 fileID（已上传至 cloud1-d3gsxamaw26beccb8）
// 公式策略：card 1~11 有渲染图，card 12 是概念流程图用文本显示
const { CARDS } = require('../eit/eit-data');
const { EIT_FILE_IDS, EIT_FORMULA_IDS } = require('../../utils/cloud-images');
const haptic = require('../../utils/haptic');

Page({
  data: {
    cards: [],
    currentIndex: 0,
    showInfo: true,
  },

  onLoad(options) {
    const index = parseInt(options.index, 10) || 0;

    const cards = CARDS.map(c => ({
      ...c,
      imageSrc: EIT_FILE_IDS[c.id] || `/pages/eit/images/${c.image}`,
      // 公式图：card 1~11 有渲染图，card 12 用文本
      formulaImage: EIT_FORMULA_IDS[c.id] || '',
    }));
    this.setData({ cards, currentIndex: index });
    this.markRead(index);
  },

  markRead(index) {
    const card = this.data.cards[index];
    if (!card) return;
    let readSet = wx.getStorageSync('eit_read') || [];
    if (readSet.indexOf(card.id) < 0) {
      readSet.push(card.id);
      wx.setStorageSync('eit_read', readSet);
    }
  },

  onSwiperChange(e) {
    const index = e.detail.current;
    this.setData({ currentIndex: index });
    this.markRead(index);
    haptic.light();
  },

  toggleInfo() {
    this.setData({ showInfo: !this.data.showInfo });
  },

  previewImage() {
    const card = this.data.cards[this.data.currentIndex];
    if (!card) return;
    try {
      wx.previewImage({
        current: card.imageSrc,
        urls: this.data.cards.map(c => c.imageSrc),
      });
    } catch (e) { /* 忽略 */ }
  },
});

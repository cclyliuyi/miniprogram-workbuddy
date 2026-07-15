// pages/eit-detail/detail.js —— 电磁信息论卡片详情（全屏滑动浏览）
const { CARDS } = require('../eit/eit-data');
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
      imageSrc: `/pages/eit/images/${c.image}`,
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
    wx.previewImage({
      current: card.imageSrc,
      urls: this.data.cards.map(c => c.imageSrc),
    });
  },
});

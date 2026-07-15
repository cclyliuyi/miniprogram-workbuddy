// pages/method-detail/detail.js —— 方法论迁移卡片详情（全屏滑动浏览）
const { CARDS } = require('../method/method-data');
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
      imageSrc: `/pages/method/images/${c.image}`,
      mappingList: c.mapping.map(m => ({ from: m[0], to: m[1] })),
      moduleList: Object.entries(c.modules).map(([k, v]) => ({ label: k, text: v })),
    }));
    this.setData({ cards, currentIndex: index });
    this.markRead(index);
  },

  markRead(index) {
    const card = this.data.cards[index];
    if (!card) return;
    let readSet = wx.getStorageSync('method_read') || [];
    if (readSet.indexOf(card.id) < 0) {
      readSet.push(card.id);
      wx.setStorageSync('method_read', readSet);
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
});

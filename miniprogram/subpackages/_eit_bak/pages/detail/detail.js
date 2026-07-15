// subpackages/eit/pages/detail/detail.js —— 电磁信息论卡片详情（全屏滑动浏览）
const { CARDS } = require('../../eit-data');
const haptic = require('../../../../utils/haptic');

Page({
  data: {
    cards: [],
    currentIndex: 0,
    showInfo: true,  // 是否显示文字叠加层（点图片切换）
  },

  onLoad(options) {
    const index = parseInt(options.index, 10) || 0;
    const cards = CARDS.map(c => ({
      ...c,
      imageSrc: `../../images/${c.image}`,
    }));
    this.setData({ cards, currentIndex: index });
    this.markRead(index);
  },

  // 标记已读
  markRead(index) {
    const card = this.data.cards[index];
    if (!card) return;
    let readSet = wx.getStorageSync('eit_read') || [];
    if (readSet.indexOf(card.id) < 0) {
      readSet.push(card.id);
      wx.setStorageSync('eit_read', readSet);
    }
  },

  // swiper 切换
  onSwiperChange(e) {
    const index = e.detail.current;
    this.setData({ currentIndex: index });
    this.markRead(index);
    haptic.light();
  },

  // 点击图片切换文字层
  toggleInfo() {
    this.setData({ showInfo: !this.data.showInfo });
  },

  // 全屏预览图片
  previewImage() {
    const card = this.data.cards[this.data.currentIndex];
    if (!card) return;
    wx.previewImage({
      current: card.imageSrc,
      urls: this.data.cards.map(c => c.imageSrc),
    });
  },
});

// subpackages/eit/pages/list/list.js —— 电磁信息论卡片列表
const { CARDS } = require('../../eit-data');
const haptic = require('../../../../utils/haptic');

Page({
  data: {
    cards: [],
    currentIndex: 0,
    readSet: [],
  },

  onLoad() {
    // 给每张卡片加上完整图片路径
    const cards = CARDS.map(c => ({
      ...c,
      imageSrc: `../../images/${c.image}`,
      tagText: c.tags.join(' / '),
    }));

    // 读取已读记录
    const readSet = wx.getStorageSync('eit_read') || [];

    this.setData({ cards, readSet });
  },

  onShow() {
    // 从详情页返回时刷新已读状态
    const readSet = wx.getStorageSync('eit_read') || [];
    this.setData({ readSet });
  },

  openCard(e) {
    const index = e.currentTarget.dataset.index;
    haptic.light();
    wx.navigateTo({
      url: `/subpackages/eit/pages/detail/detail?index=${index}`,
    });
  },
});

// pages/method-detail/detail.js —— 方法论迁移卡片详情（全屏滑动浏览）
// 图片策略：直接使用云存储 fileID（已上传至 cloud1-d3gsxamaw26beccb8）
// 公式策略：特定 module 标签附带公式渲染图
const { CARDS } = require('../method/method-data');
const { METHOD_FILE_IDS, METHOD_FORMULA_IDS } = require('../../utils/cloud-images');
const haptic = require('../../utils/haptic');

// module 标签 -> 公式图的映射
const MODULE_FORMULA_MAP = {
  '系统思维模型': METHOD_FORMULA_IDS.system,
  '通用形式': METHOD_FORMULA_IDS.optimize,
};

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
      imageSrc: METHOD_FILE_IDS[c.id],
      mappingList: c.mapping.map(m => ({ from: m[0], to: m[1] })),
      moduleList: Object.entries(c.modules).map(([k, v]) => ({
        label: k,
        text: v,
        formulaImage: MODULE_FORMULA_MAP[k] || '',
      })),
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

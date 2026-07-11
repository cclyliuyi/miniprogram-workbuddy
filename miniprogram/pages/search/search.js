// pages/search/search.js —— 知识点搜索页
// 按 topic / hook / body / tag 关键词检索 365 天知识卡片
const { CARDS } = require('../../utils/quotes');
const haptic = require('../../utils/haptic');

Page({
  data: {
    keyword: '',
    results: [],
    searching: false,
    hotTags: [],     // 热门标签快捷入口
  },

  onLoad() {
    // 提取所有 tag 去重，作为快捷入口
    const tagSet = {};
    CARDS.forEach(c => {
      if (c.tag) tagSet[c.tag] = (tagSet[c.tag] || 0) + 1;
    });
    const hotTags = Object.keys(tagSet)
      .sort((a, b) => tagSet[b] - tagSet[a])
      .slice(0, 10)
      .map(t => ({ tag: t, count: tagSet[t] }));
    this.setData({ hotTags });
  },

  onInput(e) {
    const kw = (e.detail.value || '').trim();
    if (!kw) {
      this.setData({ keyword: '', results: [], searching: false });
      return;
    }
    this.setData({ keyword: kw, searching: true });

    // 本地检索（365 条纯内存操作，毫秒级）
    const results = CARDS.filter(c =>
      (c.topic && c.topic.indexOf(kw) >= 0) ||
      (c.hook && c.hook.indexOf(kw) >= 0) ||
      (c.body && c.body.indexOf(kw) >= 0) ||
      (c.tag && c.tag.indexOf(kw) >= 0) ||
      (c.trivia && c.trivia.indexOf(kw) >= 0)
    ).map(c => {
      const m = parseInt(c.date.match(/(\d+)月/)[1], 10);
      const d = parseInt(c.date.match(/(\d+)日/)[1], 10);
      return {
        month: m,
        day: d,
        date: c.date,
        topic: c.topic,
        hook: c.hook,
        tag: c.tag || '',
        level: c.level || '',
      };
    });

    this.setData({ results, searching: false });
  },

  onClear() {
    haptic.light();
    this.setData({ keyword: '', results: [], searching: false });
  },

  // 点击热门标签快捷搜索
  onTagTap(e) {
    const tag = e.currentTarget.dataset.tag;
    haptic.light();
    // 模拟输入触发搜索
    this.onInput({ detail: { value: tag } });
  },

  openResult(e) {
    const { month, day } = e.currentTarget.dataset;
    haptic.light();
    wx.navigateTo({
      url: `/pages/day-detail/day-detail?month=${month}&day=${day}`,
    });
  },
});

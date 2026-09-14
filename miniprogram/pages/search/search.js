const { searchResources, findResource } = require('../../utils/resources');
const resourceFavs = require('../../utils/resource-favs');
// pages/search/search.js —— 知识点搜索页
// 按 topic / hook / body / tag 关键词检索 365 天知识卡片
const { CARDS } = require('../../utils/quotes');
const haptic = require('../../utils/haptic');

// 每页展示条数：宽泛关键词（如单字「场」可命中 300+ 条）分批渲染
const PAGE_SIZE = 50;

Page({
  data: {
    keyword: '',
    results: [],
    total: 0,        // 命中总数（results 是分批展示的子集）
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
    this._cancelPending();
    if (!kw) { this._doSearch(''); return; }
    // 防抖期间先亮加载态，避免每个击键都全量过滤 365 卡并 setData
    this.setData({ keyword: kw, searching: true });
    this._searchTimer = setTimeout(() => {
      this._searchTimer = null;
      this._doSearch(kw);
    }, 250);
  },

  _cancelPending() {
    if (this._searchTimer) {
      clearTimeout(this._searchTimer);
      this._searchTimer = null;
    }
  },

  // 核心搜索逻辑（防抖回调和标签点击共用）
  _doSearch(kw) {
    this._cancelPending();
    if (!kw) {
      this.setData({ keyword: '', results: [], searching: false, total: 0 });
      return;
    }

    // 本地检索（365 条纯内存操作，毫秒级）
    const hits = searchResources(kw).map(r => ({ id:r.id, month:r.month, day:r.day, topic:r.title, hook:r.desc, date:r.type, saved:r.month ? require('../../utils/progress').isFav(r.month,r.day) : resourceFavs.getIds().includes(r.id) }));

    this._allHits = hits;
    this._limit = PAGE_SIZE;
    this.setData({
      keyword: kw,
      searching: false,
      total: hits.length,
      results: hits.slice(0, this._limit),
    });
  },

  // 宽泛词命中过多时增量展开，避免一次渲染数百条
  showMore() {
    haptic.light();
    this._limit += PAGE_SIZE;
    this.setData({ results: this._allHits.slice(0, this._limit) });
  },

  onUnload() {
    this._cancelPending();
  },

  onClear() {
    haptic.light();
    this._cancelPending();
    this.setData({ keyword: '', results: [], total: 0, searching: false });
  },

  // 点击热门标签快捷搜索
  onTagTap(e) {
    const tag = e.currentTarget.dataset.tag;
    if (!tag) return;
    haptic.light();
    // 直接设置 keyword 并搜索，避免 onInput 的 DOM event 依赖
    this._doSearch(tag);
  },

  // 搜索结果点击 → 跳转日详情
  toggleResource(e) {
    const r = findResource(e.currentTarget.dataset.id);
    if (!r) return;
    if (r.month) {
      const progress = require('../../utils/progress');
      const saved = progress.toggleFav(r.month,r.day,{topic:r.title});
      wx.showToast({title:saved ? '已收藏' : '已取消',icon:'none'});
    } else {
      const saved = resourceFavs.toggle(r.id);
      wx.showToast({title:saved ? '已收藏' : '已取消',icon:'none'});
    }
    this._doSearch(this.data.keyword);
  },
  openResult(e) {
    const r = findResource(e.currentTarget.dataset.id);
    if (r) wx.navigateTo({url:r.url});
  },
});

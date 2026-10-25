// 洞见：原创文章列表
// 文章清单走 getArticle 云函数（普通用户可用）+ downloadFile 兜底；
// 本地缓存兜底离线可用。性能策略：缓存秒出 → 云端静默刷新 → 新文章正文预取。
const CACHE_KEY = 'insights_manifest_v1';
const PREFETCH_KEY = 'insights_prefetched_v1';
const { fetchManifestJSON, fetchArticleJSON, readArticleCache, writeArticleCache } = require('../../utils/cloud-json');

function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return String(iso || '');
  return `${m[1]} 年 ${+m[2]} 月 ${+m[3]} 日`;
}

Page({
  data: { articles: [], loading: true },

  onLoad() {
    this.loadArticles(true);
  },

  onShow() {
    if (this._loadedOnce) this.loadArticles(false);
    this._loadedOnce = true;
  },

  onPullDownRefresh() {
    this.loadArticles(true, () => wx.stopPullDownRefresh());
  },

  async loadArticles(force, done) {
    // 1) 缓存优先：有缓存立即渲染（秒开），无缓存才进入 loading 态
    const cached = wx.getStorageSync(CACHE_KEY);
    const hasCache = !!(cached && Array.isArray(cached.articles) && cached.articles.length);
    if (hasCache) this.applyArticles(cached.articles);
    else this.setData({ loading: true });

    // 2) 云端静默刷新：无论是否有缓存都尝试拉最新清单（云函数优先，普通用户可用）
    try {
      const manifest = await fetchManifestJSON();
      const articles = Array.isArray(manifest.articles) ? manifest.articles : [];
      if (!articles.length) throw new Error('empty manifest');
      wx.setStorageSync(CACHE_KEY, { articles, at: Date.now() });
      this.applyArticles(articles);
      this.prefetchNewArticles(articles);
    } catch (err) {
      // 云端失败：有缓存已展示；无缓存则显空态
      if (!hasCache) this.setData({ articles: [], loading: false });
    }
    if (done) done();
  },

  // 后台预取：把清单里还没有本地缓存的正文拉下来，阅读页即可秒开
  async prefetchNewArticles(articles) {
    try {
      const doneMap = wx.getStorageSync(PREFETCH_KEY) || {};
      const pending = articles.filter(a => a && a.id && !doneMap[a.id] && !readArticleCache(a.id));
      if (!pending.length) return;
      for (const a of pending) {
        try {
          const data = await fetchArticleJSON(a.id);
          writeArticleCache(a.id, data);
          doneMap[a.id] = Date.now();
        } catch (e) { /* 单篇失败不影响其余 */ }
      }
      wx.setStorageSync(PREFETCH_KEY, doneMap);
    } catch (e) { /* 预取失败静默 */ }
  },


  applyArticles(list) {
    const readMap = wx.getStorageSync('insights_read_v1') || {};
    const articles = list.map((a, index) => ({
      id: a.id,
      title: a.title,
      summary: a.summary || '',
      tags: Array.isArray(a.tags) ? a.tags.slice(0, 3) : [],
      readMinutes: a.readMinutes || Math.max(1, Math.round((a.charCount || 0) / 600)),
      dateText: formatDate(a.date),
      cover: a.coverFileID || '',
      featured: index === 0,
      isRead: !!readMap[a.id],
    }));
    this.setData({ articles, loading: false });
  },

  openArticle(e) {
    const item = this.data.articles[Number(e.currentTarget.dataset.index)];
    if (!item) return;
    wx.navigateTo({ url: `/pages/insight-detail/detail?id=${item.id}` });
  },

  onShareAppMessage() {
    const top = this.data.articles[0];
    return {
      title: '洞见 · 原创思考与长文',
      path: '/pages/insights/insights',
    };
  },

  onShareTimeline() {
    return { title: '洞见 · 原创思考与长文', query: '' };
  },
});

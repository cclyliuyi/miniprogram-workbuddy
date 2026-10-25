// 洞见 · 文章阅读页（通用渲染器）
// 数据源：云存储 insights/articles/<id>.json（管线生成），结构：
// {
//   id, title, subtitle, summary, date, dateText, tags, charCount, charCountText,
//   readMinutes,
//   hero: { kicker, title, subtitle, cover },          // 封面区（cover 为 cloud:// fileID）
//   theme: { bg, bgSoft, surface, ink, ink2, ink3, line,
//            accent, accentSoft, quoteBg, serif },      // 每篇独立配色
//   toc: [{ id, num, title }],
//   blocks: [ { t:'h2', text, num, anchor }, { t:'p', text },
//             { t:'image', fileID, caption, width, height },
//             { t:'quote', text }, { t:'hr' } ]
// }
// 渲染：页面级滚动（配合 pageScrollTo 锚点跳转与进度计算）
// 图片：优先使用云函数签发的链接，保留旧数据换链兜底；懒加载 + 点击预览 + 失败重试。
// JSON 优先走 getArticle 云函数，wx.cloud.downloadFile 作为兜底。
const ARTICLE_FILEID_PREFIX = 'cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/insights/articles/';
const { fetchArticleJSON, readArticleCache, writeArticleCache } = require('../../utils/cloud-json');
const haptic = require('../../utils/haptic');

// 默认主题（米色纸感，与小程序全局一致；管线会按文章 CSS 变量覆盖）
const DEFAULT_THEME = {
  bg: '#f3efe6', bgSoft: '#faf7f0', surface: '#fcfaf5',
  ink: '#2b2820', ink2: '#5a554a', ink3: '#928b7c',
  line: '#e7e0cf', accent: '#a36647',
  accentSoft: 'rgba(163,102,71,0.09)', quoteBg: '#f6f1e4', serif: true,
};

Page({
  data: {
    loading: true,
    loadError: '',
    article: null,
    theme: DEFAULT_THEME,
    blocks: [],
    toc: [],
    showToc: false,
    activeSection: -1,
    progress: 0,
  },

  onLoad(options = {}) {
    this.articleId = options.id || '';
    this._offsets = [];   // 各 h2 锚点的文档位置
    this._scrollTimer = null;
    this.loadArticle();
  },

  async loadArticle() {
    // 缓存优先：本地有缓成立即渲染（秒开），随后云端静默校验更新
    const cached = readArticleCache(this.articleId);
    if (cached && Array.isArray(cached.blocks) && cached.blocks.length) {
      this.applyArticle(cached);
      this.refreshArticleSilently();
    } else {
      this.setData({ loading: true, loadError: '' });
      try {
        // 云函数优先（普通用户可用），downloadFile 自动兜底
        const fresh = await fetchArticleJSON(this.articleId);
        writeArticleCache(this.articleId, fresh);
        this.applyArticle(fresh);
      } catch (err) {
        this.setData({ loading: false, loadError: (err && err.message) || '加载失败' });
      }
    }
  },

  // 云端静默校验：正文更新或旧缓存缺少有效图片授权时刷新 UI。
  async refreshArticleSilently() {
    try {
      const fresh = await fetchArticleJSON(this.articleId);
      const cachedArticle = readArticleCache(this.articleId);
      const needsMedia = fresh && fresh.mediaExpiresAt && (!cachedArticle || !cachedArticle.mediaExpiresAt || cachedArticle.mediaExpiresAt <= Date.now() + 60000);
      if (fresh && (!cachedArticle || fresh.builtAt !== cachedArticle.builtAt || needsMedia)) {
        writeArticleCache(this.articleId, fresh);
        this.applyArticle(fresh);
      }
    } catch (err) { /* 静默失败，继续用缓存 */ }
  },

  applyArticle(article) {
    try {
      if (!article || !Array.isArray(article.blocks)) throw new Error('文章数据格式错误');
      if (article.title) wx.setNavigationBarTitle({ title: article.title });
      this._allBlocks = this.prepareBlocks(article.blocks);
      // 首屏只渲染前 24 个块：348 块全量 setData 是 200KB+ 跨线程传输，
      // 会拖慢首帧；剩余块下一帧补齐，肉眼无感。
      const FIRST_WAVE = 24;
      const firstWave = this._allBlocks.slice(0, FIRST_WAVE);
      this._pendingBlocks = this._allBlocks.length - firstWave.length;
      this.setData({
        loading: false,
        loadError: '',
        article,
        theme: Object.assign({}, DEFAULT_THEME, article.theme || {}),
        blocks: firstWave,
        toc: Array.isArray(article.toc) ? article.toc : [],
      });
      if (this._pendingBlocks > 0) {
        wx.nextTick(() => {
          this.setData({ blocks: this._allBlocks });
          this._pendingBlocks = 0;
          // 全量数组就位后才能安全按索引写 src，先攒下的图片链接此时统一落位
          this.flushImageMap();
        });
      }
      // ⚠️ 必须传完整的 _allBlocks：读 this.data.blocks 只能拿到首屏前 24 块，
      //    第 2 张之后的插图会因没收集到 fileID 而永远显示"加载中"。
      this.resolveImages(this._allBlocks);
      this.markRead();
      // 等首屏渲染稳定后测锚点位置，供目录高亮
      setTimeout(() => this.measureOffsets(), 600);
    } catch (err) {
      this.setData({ loading: false, loadError: (err && err.message) || '加载失败' });
    }
  },

  // cloud:// fileID → 临时链接（封面 + 正文插图批量换取，结果攒一个 map 后统一应用）
  async resolveImages(allBlocks) {
    const article = this.data.article;
    const fileIds = [];
    const direct = {};
    if (article.hero && article.hero.cover) {
      if (/^https:\/\//.test(article.hero.cover)) this.setData({ 'article.hero.coverUrl': article.hero.cover });
      else if (!article.hero.coverUrl) fileIds.push(article.hero.cover);
    }
    allBlocks.forEach((b, i) => {
      if (b.t !== 'image' || !b.fileID || b.src) return;
      if (/^https:\/\//.test(b.fileID)) direct[`blocks[${i}].src`] = b.fileID;
      else fileIds.push(b.fileID);
    });
    if (Object.keys(direct).length) this.setData(direct);
    if (!fileIds.length) return;
    try {
      const unique = [...new Set(fileIds)];
      const files = [];
      for (let i = 0; i < unique.length; i += 50) {
        const batch = await wx.cloud.getTempFileURL({ fileList: unique.slice(i, i + 50) });
        files.push(...(batch.fileList || []));
      }
      const map = {};
      files.forEach(f => { if (!f.status && f.tempFileURL) map[f.fileID] = f.tempFileURL; });
      if (article.hero && article.hero.cover && map[article.hero.cover]) {
        this.setData({ 'article.hero.coverUrl': map[article.hero.cover] });
      }
      this._imageMap = map;
      // 全量 blocks 尚未 setData 完成时（首屏分波渲染中），先攒着，flushImageMap 统一落位
      if (this._pendingBlocks === 0) this.flushImageMap();
    } catch (err) {
      allBlocks.forEach((b, i) => {
        if (b.t === 'image' && !b.src) this.setData({ [`blocks[${i}].status`]: 'error' });
      });
    }
  },

  // 把换链结果一次性写回全部插图（合并为一次 setData，减少跨线程往返）
  flushImageMap() {
    const map = this._imageMap;
    if (!map) return;
    const updates = {};
    let touched = 0;
    this.data.blocks.forEach((b, i) => {
      if (b.t !== 'image' || b.src) return;
      if (/^https:\/\//.test(b.fileID)) {
        updates[`blocks[${i}].src`] = b.fileID;
        touched += 1;
      } else if (map[b.fileID]) {
        updates[`blocks[${i}].src`] = map[b.fileID];
        touched += 1;
      } else {
        updates[`blocks[${i}].status`] = 'error';
        touched += 1;
      }
    });
    this._imageMap = null;
    if (touched) this.setData(updates);
  },

  prepareBlocks(blocks) {
    return blocks.map((b, i) => {
      const out = Object.assign({ key: 'b' + i }, b);
      if (b.t === 'callout' && b.variant === 'level') {
        out.levelMarks = [1, 2, 3].map(n => ({ n, active: n <= b.level }));
      }
      if (b.t === 'image') {
        out.status = 'loading';
        out.index = i;
        // 按原图比例预撑高度，避免图片加载时页面跳动
        out.paddingTop = b.width && b.height ? (b.height / b.width * 100).toFixed(2) + '%' : '60%';
      }
      return out;
    });
  },

  onImageLoad(e) {
    this.setData({ [`blocks[${Number(e.currentTarget.dataset.index)}].status`]: 'ready' });
  },

  onImageError(e) {
    this.setData({ [`blocks[${Number(e.currentTarget.dataset.index)}].status`]: 'error' });
  },

  previewImage(e) {
    const block = this.data.blocks[Number(e.currentTarget.dataset.index)];
    if (!block || !block.src) return;
    haptic.light();
    wx.previewImage({ current: block.src, urls: [block.src] });
  },

  async retryImage(e) {
    const i = Number(e.currentTarget.dataset.index);
    const block = this.data.blocks[i];
    if (!block) return;
    this.setData({ [`blocks[${i}].status`]: 'loading' });
    if (this.data.article && this.data.article.mediaExpiresAt) {
      try {
        const fresh = await fetchArticleJSON(this.articleId);
        const images = new Map(fresh.blocks.filter(b => b.t === 'image' && b.src).map(b => [b.fileID, b.src]));
        if (!images.has(block.fileID)) throw new Error('图片链接不可用');
        const updates = { 'article.mediaExpiresAt': fresh.mediaExpiresAt };
        this.data.blocks.forEach((b, n) => {
          if (b.t === 'image' && images.has(b.fileID)) updates[`blocks[${n}].src`] = images.get(b.fileID);
        });
        if (fresh.hero && fresh.hero.coverUrl) updates['article.hero.coverUrl'] = fresh.hero.coverUrl;
        writeArticleCache(this.articleId, fresh);
        this.setData(updates);
      } catch (err) { this.setData({ [`blocks[${i}].status`]: 'error' }); }
      return;
    }
    if (/^https:\/\//.test(block.fileID)) {
      this.setData({ [`blocks[${i}].src`]: block.fileID + (block.fileID.includes('?') ? '&' : '?') + 'retry=' + Date.now() });
      return;
    }
    try {
      const res = await wx.cloud.getTempFileURL({ fileList: [block.fileID] });
      const file = res.fileList && res.fileList[0];
      if (!file || !file.tempFileURL || file.status) throw new Error('unavailable');
      this.setData({ [`blocks[${i}].src`]: file.tempFileURL });
    } catch (err) {
      this.setData({ [`blocks[${i}].status`]: 'error' });
    }
  },

  // ---- 目录 ----
  toggleToc() {
    haptic.light();
    this.setData({ showToc: !this.data.showToc });
  },

  jumpToSection(e) {
    const i = Number(e.currentTarget.dataset.index);
    const anchor = this.data.toc[i] && this.data.toc[i].id;
    if (!anchor) return;
    this.setData({ showToc: false });
    wx.pageScrollTo({
      selector: `#sec-${anchor}`,
      offsetTop: -80,           // 预留导航栏呼吸空间
      duration: 300,
    });
    haptic.light();
  },

  // 计算各 h2 的文档位置（渲染完成后调用一次），用于滚动高亮目录
  measureOffsets() {
    if (!this.data.toc.length) return;
    const query = wx.createSelectorQuery();
    this.data.toc.forEach(t => query.select(`#sec-${t.id}`).boundingClientRect());
    query.exec(rects => {
      if (!rects) return;
      wx.createSelectorQuery().selectViewport().scrollOffset().exec(vp => {
        const scrollTop = vp && vp[0] ? vp[0].scrollTop : 0;
        this._offsets = rects.map(r => r ? r.top + scrollTop : Infinity);
      });
    });
  },

  // ---- 阅读进度与目录高亮 ----
  onPageScroll(e) {
    if (this._scrollTimer) return;
    this._scrollTimer = setTimeout(() => { this._scrollTimer = null; }, 80);
    const scrollTop = e.scrollTop || 0;
    const query = wx.createSelectorQuery();
    query.select('.reader').boundingClientRect();
    query.selectViewport().boundingClientRect();
    query.exec(rects => {
      const page = rects && rects[0];
      if (!page) return;
      const viewport = rects[1];
      const total = page.height - (viewport ? viewport.height : 0);
      const progress = total > 0 ? Math.min(100, Math.max(0, Math.round(scrollTop / total * 100))) : 0;
      // 高亮当前章节
      let active = -1;
      for (let i = 0; i < this._offsets.length; i++) {
        if (scrollTop + 120 >= this._offsets[i]) active = i;
      }
      if (Math.abs(progress - this.data.progress) >= 1 || active !== this.data.activeSection) {
        this.setData({ progress, activeSection: active });
      }
    });
  },

  markRead() {
    const id = this.articleId;
    if (!id) return;
    const map = wx.getStorageSync('insights_read_v1') || {};
    if (!map[id]) {
      map[id] = Date.now();
      wx.setStorageSync('insights_read_v1', map);
    }
  },

  retryLoad() {
    this.loadArticle();
  },

  onShareAppMessage() {
    const { article } = this.data;
    return {
      title: article ? article.title : '洞见 · 原创文章',
      path: `/pages/insight-detail/detail?id=${this.articleId}`,
      imageUrl: (article && article.hero && article.hero.coverUrl) || '',
    };
  },

  onShareTimeline() {
    const { article } = this.data;
    return {
      title: article ? article.title : '洞见 · 原创文章',
      query: `id=${this.articleId}`,
      imageUrl: (article && article.hero && article.hero.coverUrl) || '',
    };
  },
});

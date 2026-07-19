// pages/favs/favs.js —— 我的收藏（卡片瀑布流）
const progress = require('../../utils/progress');
const { getDayPhoto } = require('../../utils/db');
const { CARDS } = require('../../utils/quotes');

// 复用 quotes.js 的卡片索引逻辑（和 day-detail 一致）
function pickCard(month, day) {
  const mDays = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const dayOfYear = mDays[month - 1] + day;
  const idx = (dayOfYear - 1) % CARDS.length;
  return { card: CARDS[idx], cardIdx: dayOfYear };
}

Page({
  data: {
    list: [],      // 渲染用列表：[{ month, day, topic, date, thumb, tag, hook }]
    loading: true,
    isEmpty: false,
  },

  onShow() {
    if (this.getTabBar && this.getTabBar()) {
      this.getTabBar().setData({ selected: 4 });
    }
    // 每次进入都刷新（收藏/取消后回来能看到最新状态）
    this.loadFavs();
  },

  onPullDownRefresh() {
    this.loadFavs().then(() => wx.stopPullDownRefresh());
  },

  async loadFavs() {
    this.setData({ loading: true, isEmpty: false });
    const favs = progress.getFavs(); // 已按 ts 倒序排列

    if (!favs.length) {
      this.setData({ list: [], isEmpty: true, loading: false });
      return;
    }

    // 并发拉取每张收藏的缩略图（限制并发 4 个，避免压垮云数据库）
    const items = favs.map((f) => ({
      month: f.month,
      day: f.day,
      topic: f.topic || '',
      date: f.date || `${f.month}月${f.day}日`,
      ts: f.ts || 0,
    }));

    // 附上知识卡片信息（同步，无网络）
    items.forEach((it) => {
      const { card, cardIdx } = pickCard(it.month, it.day);
      it.tag = card.tag || '';
      it.hook = card.hook || '';
      it.dayNum = cardIdx;
    });

    // 受限并发拉缩略图
    const results = await this.runPool(items, 4, async (it) => {
      try {
        const res = await getDayPhoto(it.month, it.day);
        const p = res.data && res.data[0];
        if (p && p.front) {
          it.thumb = p.front.thumb || p.front.preview || p.front.original || '';
        }
      } catch (e) { /* 缩略图非关键 */ }
      return it;
    });

    this.setData({ list: results, loading: false, isEmpty: results.length === 0 });
  },

  // 受限并发执行
  async runPool(items, limit, worker) {
    const results = new Array(items.length);
    let idx = 0;
    async function consume() {
      while (idx < items.length) {
        const cur = idx++;
        results[cur] = await worker(items[cur], cur);
      }
    }
    const pool = [];
    for (let i = 0; i < Math.min(limit, items.length); i++) pool.push(consume());
    await Promise.all(pool);
    return results;
  },

  openDay(e) {
    const { month, day } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/day-detail/day-detail?month=${month}&day=${day}&mode=favs`,
    });
  },

  // 取消收藏（列表内快捷操作）
  removeFav(e) {
    const { month, day, index } = e.currentTarget.dataset;
    const item = this.data.list[index];
    if (!item) return;

    wx.showModal({
      title: '取消收藏',
      content: `确定取消「${item.date}」的收藏吗？`,
      confirmColor: '#b06a4f',
      success: (res) => {
        if (!res.confirm) return;
        progress.toggleFav(month, day);
        // 直接从列表删除，无感更新
        const list = this.data.list.filter((_, i) => i !== index);
        this.setData({ list, isEmpty: list.length === 0 });
        wx.showToast({ title: '已取消', icon: 'none', duration: 800 });
      },
    });
  },
});

// pages/year/year.js —— 年视图（12 个月缩略拼图，跳月）
const { getDayPhoto } = require('../../utils/db');
const { daysInMonth } = require('../../utils/date');
const haptic = require('../../utils/haptic');

Page({
  data: {
    months: [],
    loading: true,
    year: 2027,
    previewMonth: null,   // 长按预览的月份
  },

  onShow() {
    if (!this.data.months.length) this.loadYear();
  },

  onPullDownRefresh() {
    this.loadYear().then(() => wx.stopPullDownRefresh());
  },

  async loadYear() {
    wx.showLoading({ title: '加载中' });
    try {
      const today = new Date().getDate();
      // 每个月取「今日」那张作代表图。
      // ⚠️ 不要 12 个并行：瞬时并发会压垮云数据库触发 timeout，改 4 个一组并发。
      const specs = [];
      for (let m = 1; m <= 12; m++) {
        const dim = daysInMonth(m);
        specs.push({ m, repDay: Math.min(today, dim) });
      }
      const months = await this.runPool(specs, 4, async (s) => {
        const res = await getDayPhoto(s.m, s.repDay);
        const p = res.data && res.data[0];
        return {
          month: s.m,
          label: s.m + '月',
          thumb: p && p.front ? p.front.thumb : '',
          hasPhoto: !!(p && p.front && p.front.thumb),
        };
      });
      this.setData({ months, loading: false });
    } catch (e) {
      console.error(e);
      wx.showToast({ title: '加载失败：' + (e.errMsg || e.message), icon: 'none', duration: 3000 });
      this.setData({ loading: false });
    } finally {
      wx.hideLoading();
    }
  },

  // 受限并发执行：最多 limit 个任务同时在跑，避免瞬并发压垮云数据库
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

  // 长按预览大图
  onLongPress(e) {
    const month = parseInt(e.currentTarget.dataset.month, 10);
    const item = this.data.months.find(m => m.month === month);
    if (!item || !item.hasPhoto) return;
    haptic.medium();
    this.setData({ previewMonth: item });
  },

  closePreview() {
    this.setData({ previewMonth: null });
  },

  // 从预览直接跳转到该月
  previewToMonth() {
    const m = this.data.previewMonth;
    if (!m) return;
    this.setData({ previewMonth: null });
    setTimeout(() => {
      this.openMonth({ currentTarget: { dataset: { month: m.month } } });
    }, 200);
  },

  openMonth(e) {
    const month = parseInt(e.currentTarget.dataset.month, 10);
    console.log('[year] openMonth →', month);
    if (!month || month < 1 || month > 12) return; // 防御非法值
    const app = getApp();
    if (app && app.globalData) {
      app.globalData.targetMonth = month;   // 供 calendar.onLoad 切换月视图
      app.globalData.currentMonth = month;  // 单一真相源：当前查看月份
    }
    // 用 reLaunch 而非 switchTab：
    // switchTab 跳到已是 tabBar 的日历页时，部分真机/基础库下 onShow 不一定触发，
    // 导致 calendar 的 this.data.month 没切过去、故事流跟着跳错月份。
    // reLaunch 会销毁并重建日历页，必然触发 onLoad，onLoad 已可靠读取 targetMonth 加载对应月份。
    wx.reLaunch({
      url: '/pages/calendar/calendar',
      fail(err) {
        console.error('[year] reLaunch 失败:', err);
        wx.switchTab({ url: '/pages/calendar/calendar' });
      },
    });
  },
});

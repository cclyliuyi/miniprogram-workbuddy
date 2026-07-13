// pages/calendar/calendar.js —— 月历网格主页 + 磨砂背景
const { WEEKDAYS, buildMonthGrid } = require('../../utils/date');
const { getMonthPhotos, getDayPhoto } = require('../../utils/db');
const progress = require('../../utils/progress');
const { CARDS } = require('../../utils/quotes');
const haptic = require('../../utils/haptic');

// ═══════════════════════════════════════════════════
// 月度描述：季节特征 + 知识主题
// theme：从 quotes.js 的 monthTheme 提取（电磁波知识主线）
// vibe：季节/文化意境文字
// ═══════════════════════════════════════════════════
const MONTH_VIBES = {
  1:  '新年伊始，万物静藏。在最冷的季节里，电磁波理论悄然萌芽。',
  2:  '立春将至，方向图与增益成为读懂天线的第二语言。',
  3:  '春风苏醒。偶极子与地面镜像，映照出万物复苏的对称之美。',
  4:  '清明谷雨。环天线在雨季前调谐，宽带匹配迎接户外季节。',
  5:  '初夏繁花。多个天线单元排成阵列，相位开始塑造方向。',
  6:  '仲夏蝉鸣。阵列综合与互耦计算，在最长的白昼里展开。',
  7:  '盛夏蝉声。口径辐射如喇叭张开，惠更斯原理照亮每一个波前。',
  8:  '立秋处暑。手机里的微带天线，陪伴每一趟盛夏旅途。',
  9:  '金秋九月。反射面如卫星天线对准天际，收割空间几何的馈赠。',
  10: '深秋霜降。相控阵不转头就能扫描天空，电子波束穿越冷冽空气。',
  11: '初冬寒意。接收与噪声测量，在最安静的季节里精雕每一个 dB。',
  12: '岁末隆冬。电波穿越电离层、雨衰与大气，完成一年中最远的旅程。',
};

// 从 CARDS 提取月度知识主题
const MONTH_THEMES = {};
CARDS.forEach(c => {
  if (c.monthTheme) {
    const m = parseInt(c.date.match(/(\d+)月/)[1]);
    if (!MONTH_THEMES[m]) MONTH_THEMES[m] = c.monthTheme;
  }
});

Page({
  data: {
    month: 7,
    monthLabel: '7月',
    weekdayLabels: WEEKDAYS,
    weeks: [],
    todayDay: 0,
    todayMonth: 7,
    year: 2027,
    // 磨砂背景：当月1号缩略图
    monthThumb: '',
    hasData: true,
    loadError: '',
    loading: true,          // 骨架屏开关
    skeletonRows: [0,1,2,3,4,5],  // 骨架占位行（最多6行）
    skeletonCells: [0,1,2,3,4,5,6], // 每行7格
    // ---- 打卡进度 ----
    streakCount: 0,         // 连续打卡天数
    readCount: 0,           // 已读总天数
    readPercent: 0,         // 进度百分比
    // ---- 月度描述 ----
    monthTheme: '',         // 当月电磁波知识主题
    monthVibe: '',          // 当月季节/文化描述
    showGoToday: false,     // 是否显示「回到今天」按钮
  },

  onLoad(options) {
    const now = new Date();
    const defMonth = now.getMonth() + 1;
    const day = now.getDate();
    let month = defMonth;
    if (options && options.month) month = parseInt(options.month, 10);
    // 年视图跳月：通过 globalData 传入（switchTab 无法带参）
    const app = getApp();
    if (app && app.globalData && app.globalData.targetMonth) {
      month = app.globalData.targetMonth;
      app.globalData.targetMonth = null;
    }
    this._reqToken = 0; // 初始化请求令牌
    this.setData({
      month,
      monthLabel: `${month}月`,
      todayDay: day,
      todayMonth: defMonth,
      monthTheme: MONTH_THEMES[month] || '',
      monthVibe: MONTH_VIBES[month] || '',
    });
    if (app && app.globalData) app.globalData.currentMonth = month; // 单一真相源：当前查看月份
    this.refreshProgress();
    this.loadMonth(month);
    this.loadMonthThumb(month);
    this.updateGoToday();
  },

  // 刷新打卡进度数据（从本地存储读取）
  refreshProgress() {
    const streak = progress.getStreak();
    const prog = progress.getProgress();
    this.setData({
      streakCount: streak.count,
      readCount: prog.read,
      readPercent: prog.percent,
    });
  },

  onShow() {
    // 刷新打卡进度（从 day-detail 回来时需要更新）
    this.refreshProgress();
    // 从年视图切回时，若带了目标月份则定位过去
    const app = getApp();
    console.log('[calendar] onShow, targetMonth =', app?.globalData?.targetMonth, '当前月=', this.data.month);
    if (app && app.globalData && app.globalData.targetMonth) {
      const month = app.globalData.targetMonth;
      app.globalData.targetMonth = null; // 消费后立即清掉
      if (month === this.data.month) return; // 已经在目标月，不重复加载
      this._reqToken = (this._reqToken || 0) + 1; // 作废可能的在途请求
      console.log('[calendar] onShow 切月到 →', month);
      this.setData({
        month, monthLabel: `${month}月`, monthThumb: '',
        monthTheme: MONTH_THEMES[month] || '',
        monthVibe: MONTH_VIBES[month] || '',
      });
      if (app && app.globalData) app.globalData.currentMonth = month; // 同步真相源
      this.loadMonth(month);
      this.loadMonthThumb(month);
    }
  },

  // 加载当月1号照片作为磨砂背景
  async loadMonthThumb(month) {
    const token = this._reqToken;
    try {
      const res = await getDayPhoto(month, 1);
      if (token !== this._reqToken) return; // 已切月，丢弃旧结果
      const p = res.data && res.data[0];
      if (p && p.front && p.front.thumb) {
        this.setData({ monthThumb: p.front.thumb });
      }
    } catch (e) {
      // 背景图非关键，静默失败
    }
  },

  async loadMonth(month) {
    const token = this._reqToken;
    try {
      const res = await getMonthPhotos(month);
      if (token !== this._reqToken) { return; } // 已切月，丢弃旧结果
      const list = res.data || [];

      if (list.length === 0) {
        console.warn('[calendar] month', month, '查询返回空！请检查数据库权限');
        console.warn('[calendar] 已设 limit(100)，若仍为空请确认数据库权限为「所有用户可读」');
      }

      const photosMap = {};
      list.forEach((p) => {
        photosMap[p.day] = {
          frontThumb: p.front && p.front.thumb ? p.front.thumb : '',
          backThumb: p.back && p.back.thumb ? p.back.thumb : '',
        };
      });
      const { weeks } = buildMonthGrid(month, photosMap, this.data.year);
      // 给每个已读的天加 isRead 标记
      weeks.forEach(week => {
        week.forEach(cell => {
          if (!cell.empty && progress.isRead(month, cell.day)) {
            cell.isRead = true;
          }
        });
      });
      this.setData({ weeks, monthLabel: `${month}月`, hasData: list.length > 0, loading: false });

      // 诊断：打印实际加载了多少天，方便排查"21号后空白"
      const daysWithData = Object.keys(photosMap).length;
      console.log(`[calendar] ${month}月: DB返回${list.length}条, 网格有图${daysWithData}天, 总天数${weeks.flat().filter(c => !c.empty).length}`);
    } catch (e) {
      if (token !== this._reqToken) { return; }
      console.error('[calendar] loadMonth FAIL:', e);
      this.setData({ loadError: (e.errMsg || e.message || '未知错误'), loading: false });
      wx.showToast({ title: '加载失败：' + this.data.loadError, icon: 'none', duration: 3000 });
    }
  },

  changeMonth(e) {
    const delta = parseInt(e.currentTarget.dataset.delta, 10);
    let month = this.data.month + delta;
    if (month < 1) month = 12;
    if (month > 12) month = 1;
    if (month === this.data.month) return;
    haptic.light();
    this._reqToken = (this._reqToken || 0) + 1; // 使上一轮的异步回包作废，避免 removedNode/脏渲染
    this.setData({
      month, monthThumb: '', loading: true,
      monthTheme: MONTH_THEMES[month] || '',
      monthVibe: MONTH_VIBES[month] || '',
    }); // 切月时清空旧背景+开骨架屏+更新描述
    const app = getApp();
    if (app && app.globalData) app.globalData.currentMonth = month; // 同步真相源
    this.loadMonth(month);
    this.loadMonthThumb(month);
    this.updateGoToday();
  },

  // 一键回到今天所在月份
  goToday() {
    const now = new Date();
    const month = now.getMonth() + 1;
    if (month === this.data.month) return;
    haptic.light();
    this._reqToken = (this._reqToken || 0) + 1;
    this.setData({
      month, monthLabel: `${month}月`, monthThumb: '', loading: true,
      monthTheme: MONTH_THEMES[month] || '',
      monthVibe: MONTH_VIBES[month] || '',
      showGoToday: false,
    });
    const app = getApp();
    if (app && app.globalData) app.globalData.currentMonth = month;
    this.loadMonth(month);
    this.loadMonthThumb(month);
  },

  // 更新「回到今天」按钮可见性
  updateGoToday() {
    const now = new Date();
    const todayMonth = now.getMonth() + 1;
    this.setData({ showGoToday: this.data.month !== todayMonth });
  },

  openDay(e) {
    const day = e.currentTarget.dataset.day;
    if (!day) return;
    haptic.light();
    wx.navigateTo({
      url: `/pages/day-detail/day-detail?month=${this.data.month}&day=${day}`,
    });
  },

  // 跳转到搜索页
  goSearch() {
    haptic.light();
    wx.navigateTo({ url: '/pages/search/search' });
  },

  goYear() {
    wx.switchTab({ url: '/pages/year/year' });
  },

  goStory() {
    const app = getApp();
    // 故事流现在是 tabBar 页面，用 switchTab 跳转。
    // 月份通过 globalData.currentMonth 传递（story.js 的 onLoad/onShow 会读取）。
    const month = (app && app.globalData && app.globalData.currentMonth) || this.data.month;
    if (app && app.globalData) app.globalData.currentMonth = month;
    console.log('[calendar] goStory →', month);
    wx.switchTab({ url: '/pages/story/story' });
  },

  onImgError(e) {
    const day = e.currentTarget.dataset.day;
    console.error('[calendar] 图片加载失败 day=', day, 'src=', e.detail && e.detail.errMsg);
    // COS 签名 URL 过期会导致 404/HTTP2 错误，重新拉取该天数据获取新签名
    this.refreshThumb(day);
  },

  // 单天缩略图刷新（签名过期兜底）
  // 防抖：同一天最多重试一次，避免 error → 新 URL → 又 error 的死循环
  async refreshThumb(day) {
    if (!day || (this._refreshingDays && this._refreshingDays[day])) return;
    if (!this._refreshingDays) this._refreshingDays = {};
    this._refreshingDays[day] = true;

    try {
      const res = await getDayPhoto(this.data.month, day);
      const p = res.data && res.data[0];
      if (!p || !p.front) return;
      const fileId = p.front.thumb || p.front.preview || '';
      if (!fileId) return;

      // 主动用 getTempFileURL 获取新鲜的 HTTPS 签名 URL
      // （数据库存的是 cloud:// fileID，小程序渲染时框架自动转签名 URL，
      //   但偶尔拿到过期签名 → 404。这里主动拿一个新的）
      let newThumb = fileId; // 默认用 fileID（框架重新渲染时会重新签名）
      if (fileId.indexOf('cloud://') === 0) {
        try {
          const tmp = await wx.cloud.getTempFileURL({ fileList: [fileId] });
          if (tmp && tmp.fileList && tmp.fileList[0] && tmp.fileList[0].tempFileURL) {
            newThumb = tmp.fileList[0].tempFileURL;
          }
        } catch (e) { /* getTempFileURL 失败则退回 fileID */ }
      }

      // 遍历 weeks 找到对应格子，更新缩略图
      const weeks = this.data.weeks.map(week =>
        week.map(cell => {
          if (!cell.empty && cell.day === day) {
            return Object.assign({}, cell, { thumb: newThumb });
          }
          return cell;
        })
      );
      this.setData({ weeks });
    } catch (err) {
      console.warn('[calendar] refreshThumb 失败 day=', day, err);
    } finally {
      // 5 秒后允许该天再次重试
      setTimeout(() => { delete this._refreshingDays[day]; }, 5000);
    }
  },

  // —— 月份左右滑动手势（和日详情翻页一致的手感）——
  onTouchStart(e) {
    const t = e.touches[0] || e.changedTouches[0]
    this._tx = t.clientX
    this._ty = t.clientY
    this._tt = Date.now()
  },

  onTouchEnd(e) {
    const t = e.changedTouches[0]
    if (!t || this._tx == null) return
    const dx = t.clientX - this._tx
    const dy = t.clientY - this._ty
    const dt = Date.now() - this._tt
    // 水平滑动 > 60px 且明显大于垂直滑动（避免误触纵向滚动），时长 < 600ms
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.8 && dt < 600) {
      this.changeMonth({ currentTarget: { dataset: { delta: dx < 0 ? 1 : -1 } } })
    }
  },
});

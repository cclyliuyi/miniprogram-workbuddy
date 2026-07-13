// app.js —— 全局初始化（云开发）
App({
  globalData: {
    // 替换为你的云开发环境 ID（微信开发者工具 → 云开发 → 环境设置）
    env: 'cloud1-d3gsxamaw26beccb8',
    db: null,
    targetMonth: null,   // 年视图跳月时暂存目标月份（供 calendar.onLoad 消费）
    currentMonth: null,  // 当前查看月份的单一真相源（故事流等直接读取）
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('当前基础库版本过低，请使用 2.2.3 或以上的基础库以使用云能力');
      return;
    }
    // 多端应用改造：SDK 无法自动推断身份，必须显式传 appid + envid（env 保留以兼容小程序运行时）
    wx.cloud.init({
      appid: 'wxd9967fc9c09f3b40', // 云环境所属小程序 AppID（非多端 AppID）
      env: this.globalData.env, // 小程序运行时使用
      envid: this.globalData.env, // 多端应用运行时使用
      traceUser: true,
    });
    this.globalData.db = wx.cloud.database();
    // 启动即后台预热云函数 getPhotos（不阻塞首屏），避免首次交互撞冷启动
    try { require('./utils/db').warmAll(); } catch (e) { /* 预热失败不影响首屏 */ }
  },
});

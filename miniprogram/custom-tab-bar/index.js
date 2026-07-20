// custom-tab-bar/index.js —— 毛玻璃底栏逻辑
const haptic = require('../utils/haptic')

Component({
  data: {
    selected: 0,
    ready: false,   // 防首次闪烁：渲染就绪后才显示
    list: [
      { pagePath: '/pages/calendar/calendar', text: '日历', icon: 'cal' },
      { pagePath: '/pages/eit/eit', text: '前沿', icon: 'eit' },
      { pagePath: '/pages/method/method', text: '方法论', icon: 'mtd' },
      { pagePath: '/pages/tools/index', text: '工具', icon: 'tool' },
      { pagePath: '/pages/favs/favs', text: '收藏', icon: 'fav' },
    ],
  },

  lifetimes: {
    attached() {
      // 延迟一帧标记 ready，让首帧渲染（含 backdrop-filter 合成层建立）
      // 在 opacity:0 状态下完成，避免用户看到合成层重建的闪烁
      setTimeout(() => {
        this.setData({ ready: true });
      }, 50);
    },
  },

  methods: {
    onTap(e) {
      const { index, path } = e.currentTarget.dataset
      if (this.data.selected === index) return
      haptic.light()
      this.setData({ selected: index })
      wx.switchTab({ url: path })
    },
  },
})

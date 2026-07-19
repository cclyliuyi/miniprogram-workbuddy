// custom-tab-bar/index.js —— 毛玻璃底栏逻辑
const haptic = require('../utils/haptic')

Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/calendar/calendar', text: '日历', icon: 'cal' },
      { pagePath: '/pages/eit/eit', text: '前沿', icon: 'eit' },
      { pagePath: '/pages/method/method', text: '方法论', icon: 'mtd' },
      { pagePath: '/pages/tools/index', text: '工具', icon: 'tool' },
      { pagePath: '/pages/favs/favs', text: '收藏', icon: 'fav' },
    ],
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

// pages/day-detail/day-detail.js —— 翻卡详情（swiper 全量模式 v6）
//
// v6：彻底放弃"3卡重置"模式，改用和故事流一样的全量 swiper。
//   - 普通模式：365 个 swiper-item（一天一个）
//   - 收藏模式：N 个 swiper-item（收藏的天）
//   - current 直接指向当天索引，滑动后自然更新，零跳动
//   - 图片懒加载 + 缓存命中后秒显，性能无忧
//
const { getDayPhoto } = require('../../utils/db')
const { daysInMonth } = require('../../utils/date')
const { CARDS } = require('../../utils/quotes')
const progress = require('../../utils/progress')
const haptic = require('../../utils/haptic')

// 按一年中的第几天取知识卡片
function pickCard(month, day) {
  const mDays = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
  const dayOfYear = mDays[month - 1] + day
  const idx = (dayOfYear - 1) % CARDS.length
  return { card: CARDS[idx], cardIdx: dayOfYear }
}

// 滑动后停留确认时长：停留满此时长才算「已读」，防止快速连滑刷打卡进度
const READ_CONFIRM_MS = 1500

Page({
  data: {
    month: 0,
    day: 0,
    label: '',
    flipped: false,
    loading: true,
    hasPrev: true,
    hasNext: true,
    // ---- 知识盲盒 ----
    card: null,
    cardIdx: 0,
    cardAnim: '',
    isFav: false,
    favAnimating: false,
    justChecked: false,
    // ---- swiper 全量列表 ----
    swiperList: [],     // [{ month, day, front, back, thumb, loaded }]
    swiperCurrent: 0,   // 当前显示的索引（直接对应当天，不重置）
    favsHint: '',
    // ---- 里程碑弹窗 ----
    showMilestone: false,
    milestoneCount: 0,
    milestoneTitle: '',
  },

  // _navList: [{month, day}, ...]  导航日期序列
  // _favsMode: 收藏模式

  onLoad(options) {
    const month = parseInt(options.month, 10)
    const requestedDay = parseInt(options.day, 10)
    const day = month === 2 && requestedDay === 29 ? 28 : requestedDay
    if (month === 2 && requestedDay === 29) wx.showToast({ title: '闰日复习：重温 2 月 28 日知识', icon: 'none' })

    this._favsMode = options.mode === 'favs'

    // 构建导航序列
    let navList
    if (this._favsMode) {
      const favs = progress.getFavs()
      navList = favs.map(f => ({ month: f.month, day: f.day }))
        .sort((a, b) => a.month !== b.month ? a.month - b.month : a.day - b.day)
    } else {
      navList = []
      for (let m = 1; m <= 12; m++) {
        const dim = daysInMonth(m)
        for (let d = 1; d <= dim; d++) {
          navList.push({ month: m, day: d })
        }
      }
    }

    if (!navList.length) {
      wx.switchTab({ url: '/pages/favs/favs' })
      return
    }
    // 找到当前天的索引
    let curIdx = navList.findIndex(f => f.month === month && f.day === day)
    if (curIdx < 0) curIdx = 0

    // 构建 swiper 全量列表（初始只有日期，图片懒加载）
    const swiperList = navList.map(item => ({
      key: `${item.month}-${item.day}`,
      month: item.month,
      day: item.day,
      front: '',
      back: '',
      thumb: '',
      loaded: false,
    }))

    // 当前天的知识盲盒（同步，无网络）
    const curNav = navList[curIdx]
    const { card, cardIdx } = pickCard(curNav.month, curNav.day)
    const fav = progress.isFav(curNav.month, curNav.day)
    const favsHint = this._favsMode ? `${curIdx + 1} / ${navList.length}` : ''

    this.setData({
      swiperList,
      swiperCurrent: curIdx,
      month: curNav.month,
      day: curNav.day,
      label: `${curNav.month}月${curNav.day}日`,
      card, cardIdx,
      isFav: fav,
      justChecked: false,
      favAnimating: false,
      favsHint,
      hasPrev: curIdx > 0,
      hasNext: curIdx < navList.length - 1,
      loading: false,
      cardAnim: 'kn-in',
    })

    this.updateCurrent(curIdx)


  },

  // 加载某个 slide 的图片数据（如果已加载则跳过）
  async loadSlide(idx) {
    const item = this.data.swiperList[idx]
    if (!item || item.loaded || item.status === 'loading') return
    this.setData({ [`swiperList[${idx}].status`]: 'loading' })

    try {
      const res = await getDayPhoto(item.month, item.day)
      if (this._disposed || !this.data.swiperList[idx] || this.data.swiperList[idx].key !== item.key) return
      const p = res.data && res.data[0]
      if (p) {
        this.setData({
          [`swiperList[${idx}].front`]: (p.front && (p.front.preview || p.front.original)) || '',
          [`swiperList[${idx}].back`]: p.back ? (p.back.preview || p.back.original || '') : '',
          [`swiperList[${idx}].thumb`]: (p.front && p.front.thumb) || '',
          [`swiperList[${idx}].loaded`]: true,
          [`swiperList[${idx}].status`]: 'ready',
        })
      } else {
        if (!this._disposed && this.data.swiperList[idx] && this.data.swiperList[idx].key === item.key) this.setData({ [`swiperList[${idx}].loaded`]: false, [`swiperList[${idx}].status`]: 'error' })
      }
    } catch (e) {
      if (!this._disposed && this.data.swiperList[idx] && this.data.swiperList[idx].key === item.key) this.setData({ [`swiperList[${idx}].loaded`]: false, [`swiperList[${idx}].status`]: 'error' })
    }
  },

  // swiper 滑动结束
  onSwiperChange(e) {
    const idx = e.detail.current
    this.updateCurrent(idx)
  },

  // 更新当前天信息（知识盲盒 + 收藏 + 图片懒加载；打卡经停留确认延迟触发）
  updateCurrent(idx) {
    const item = this.data.swiperList[idx]
    if (!item) return

    // 停留确认：重置计时器，停留满 READ_CONFIRM_MS 且未再滑动才打卡
    if (this._readTimer) clearTimeout(this._readTimer)
    this._readTimer = setTimeout(() => {
      this._readTimer = null
      if (this.data.swiperCurrent === idx) this.confirmRead(idx)
    }, READ_CONFIRM_MS)

    const { card, cardIdx } = pickCard(item.month, item.day)
    const fav = progress.isFav(item.month, item.day)
    const favsHint = this._favsMode ? `${idx + 1} / ${this.data.swiperList.length}` : ''

    this.setData({
      swiperCurrent: idx,
      month: item.month,
      day: item.day,
      label: `${item.month}月${item.day}日`,
      card, cardIdx,
      isFav: fav,
      justChecked: false,
      favAnimating: false,
      favsHint,
      hasPrev: idx > 0,
      hasNext: idx < this.data.swiperList.length - 1,
      flipped: false,
      cardAnim: 'kn-in',
    })

    setTimeout(() => { if (!this._disposed) this.setData({ cardAnim: '' }) }, 600)

    // 懒加载当前 + 前后各一张的图片
    this.loadSlide(idx)
    if (idx > 0) this.loadSlide(idx - 1)
    if (idx < this.data.swiperList.length - 1) this.loadSlide(idx + 1)
  },

  // 停留确认后真正打卡（写 storage + 里程碑）
  confirmRead(idx) {
    const item = this.data.swiperList[idx]
    if (!item) return
    const wasNew = progress.markRead(item.month, item.day)
    this.checkAndShowMilestone()
    if (!wasNew) return
    this.setData({ justChecked: true })
    haptic.heavy()
    setTimeout(() => {
      if (!this._disposed && this.data.swiperCurrent === idx) this.setData({ justChecked: false })
    }, 800)
  },

  retrySlide() { this.loadSlide(this.data.swiperCurrent) },
  onImageError(e) {
    const idx = Number(e.currentTarget.dataset.index)
    this.setData({ [`swiperList[${idx}].loaded`]: false, [`swiperList[${idx}].status`]: 'error' })
  },
  onShow() { if (this.data.swiperList.length) this.updateCurrent(this.data.swiperCurrent) },
  onHide() { clearTimeout(this._readTimer); this._readTimer = null },
  onUnload() {
    this._disposed = true
    clearTimeout(this._favTimer)
    if (this._readTimer) { clearTimeout(this._readTimer); this._readTimer = null }
  },

  // 检查是否命中打卡里程碑
  checkAndShowMilestone() {
    const streak = progress.getStreak()
    const hit = progress.checkMilestone(streak.count)
    if (hit) {
      const info = progress.getMilestoneInfo(hit)
      // 延迟弹出，让知识卡片入场动画先完成
      setTimeout(() => {
        if (this._disposed) return
        haptic.heavy()
        this.setData({
          showMilestone: true,
          milestoneCount: info.count,
          milestoneTitle: info.title,
        })
      }, 800)
    }
  },

  closeMilestone() {
    haptic.light()
    this.setData({ showMilestone: false })
  },

  // 收藏 / 取消收藏
  toggleFav() {
    const isNow = progress.toggleFav(this.data.month, this.data.day, {
      topic: this.data.card ? this.data.card.topic : '',
      date: this.data.label,
    })
    haptic.medium()
    clearTimeout(this._favTimer)
    this.setData({ isFav: isNow, favAnimating: isNow })
    if (isNow) this._favTimer = setTimeout(() => {
      if (!this._disposed) this.setData({ favAnimating: false })
      this._favTimer = null
    }, 480)
    wx.showToast({ title: isNow ? '已收藏' : '已取消', icon: 'none', duration: 1000 })

    if (this._favsMode && !isNow) {
      // 收藏模式取消后，从列表移除当前项
      const list = this.data.swiperList.filter(
        (_, i) => i !== this.data.swiperCurrent
      )
      if (list.length === 0) {
        wx.showToast({ title: '收藏已清空', icon: 'none' })
        setTimeout(() => wx.navigateBack(), 1000)
        return
      }
      const newIdx = Math.min(this.data.swiperCurrent, list.length - 1)
      this.setData({ swiperList: list, swiperCurrent: newIdx })
      this.updateCurrent(newIdx)
    }
  },

  // 按钮导航
  goPrev() {
    if (this.data.swiperCurrent > 0) {
      this.setData({ swiperCurrent: this.data.swiperCurrent - 1 })
    }
  },
  goNext() {
    if (this.data.swiperCurrent < this.data.swiperList.length - 1) {
      this.setData({ swiperCurrent: this.data.swiperCurrent + 1 })
    }
  },
  goAdjacent(e) {
    const delta = parseInt(e.currentTarget.dataset.delta, 10)
    haptic.light()
    if (delta < 0) this.goPrev()
    else this.goNext()
  },

  toggleFlip() {
    haptic.medium()
    this.setData({ flipped: !this.data.flipped })
  },
  onStageTap() {
    this.toggleFlip()
  },

  preview() {
    const cur = this.data.swiperList[this.data.swiperCurrent]
    if (!cur) return
    const urls = []
    if (cur.front) urls.push(cur.front)
    if (cur.back) urls.push(cur.back)
    if (urls.length) wx.previewImage({ current: urls[0], urls })
  },

  openCard() {
    const side = this.data.flipped ? 'back' : 'front'
    wx.navigateTo({ url: `/pages/card/card?month=${this.data.month}&day=${this.data.day}&side=${side}` })
  },

  onShareAppMessage() {
    const cur = this.data.swiperList[this.data.swiperCurrent]
    const card = this.data.card
    const title = card && card.hook
      ? `${card.hook}｜${this.data.label}`
      : `${this.data.label} · 天线与电波传播`
    return {
      title,
      path: `/pages/day-detail/day-detail?month=${this.data.month}&day=${this.data.day}`,
      imageUrl: cur ? cur.thumb : '',
    }
  },

  onShareTimeline() {
    const card = this.data.card
    const title = card && card.hook
      ? `${card.hook}｜${this.data.label}`
      : `${this.data.label} · 天线与电波传播`
    return {
      title,
      query: `month=${this.data.month}&day=${this.data.day}`,
    }
  },
})

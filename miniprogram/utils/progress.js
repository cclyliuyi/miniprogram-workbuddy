// utils/progress.js —— 学习进度管理（打卡 / 连续天数 / 收藏）
// 纯本地存储，无需后端。key 前缀防止和其他 storage 冲突。

const KEY_READ = 'em_readDays'      // 已读天数集合：{ "1-1": true, "1-2": true, ... }
const KEY_STREAK = 'em_streak'       // { count: 连续天数, lastDate: "2027-01-15" }
const KEY_FAVS = 'em_favs'           // 收藏列表：[{ month, day, topic, date }, ...]

// 日期 → dayOfYear（非闰年，和 quotes.js 的 pickCard 映射一致）
function toDayOfYear(month, day) {
  const mDays = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
  return mDays[month - 1] + day
}

// 今天的日期字符串（用于 streak 计算）
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

// 昨天的日期字符串（用于判断连续）
function yesterdayStr() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

/* ═══════ 打卡 ═══════ */

/**
 * 标记某天为已读（幂等，重复调用不会重复计数）
 * @returns {boolean} true = 首次打卡（新的一天）；false = 已经打过了
 */
function markRead(month, day) {
  const key = `${month}-${day}`
  const readDays = wx.getStorageSync(KEY_READ) || {}
  if (readDays[key]) return false // 已经读过

  readDays[key] = true
  wx.setStorageSync(KEY_READ, readDays)

  // 更新连续天数
  const streak = wx.getStorageSync(KEY_STREAK) || { count: 0, lastDate: '' }
  const today = todayStr()
  const yesterday = yesterdayStr()

  if (streak.lastDate === today) {
    // 今天已经打过卡了（可能读了多天），不增加 streak
  } else if (streak.lastDate === yesterday) {
    streak.count = streak.count + 1
  } else {
    streak.count = 1 // 断了，重新从1开始
  }
  streak.lastDate = today
  wx.setStorageSync(KEY_STREAK, streak)
  return true
}

/** 某天是否已读 */
function isRead(month, day) {
  const readDays = wx.getStorageSync(KEY_READ) || {}
  return !!readDays[`${month}-${day}`]
}

/** 已读总天数 */
function getReadCount() {
  const readDays = wx.getStorageSync(KEY_READ) || {}
  return Object.keys(readDays).length
}

/* ═══════ 连续天数 streak ═══════ */

/**
 * 获取连续打卡天数（含今日）
 * 注意：如果今天还没打卡，但昨天打了，streak 仍然显示到昨天的值
 * @returns {{ count: number, lastDate: string, todayChecked: boolean }}
 */
function getStreak() {
  const streak = wx.getStorageSync(KEY_STREAK) || { count: 0, lastDate: '' }
  const today = todayStr()
  const yesterday = yesterdayStr()

  // 判断"连续"是否还有效
  let count = streak.count
  if (streak.lastDate !== today && streak.lastDate !== yesterday) {
    // 最后一次打卡既不是今天也不是昨天 → 断了
    count = 0
  }

  return {
    count: count,
    lastDate: streak.lastDate,
    todayChecked: streak.lastDate === today,
  }
}

/* ═══════ 进度 ═══════ */

/**
 * 获取学习进度
 * @returns {{ read: number, total: number, percent: number }}
 */
function getProgress() {
  const read = getReadCount()
  const total = 365
  const percent = Math.round((read / total) * 100)
  return { read, total, percent }
}

/* ═══════ 收藏 ═══════ */

/**
 * 收藏 / 取消收藏（切换）
 * @param {number} month
 * @param {number} day
 * @param {object} meta 可选，附带信息 { topic, date }
 * @returns {boolean} true = 已收藏；false = 已取消
 */
function toggleFav(month, day, meta) {
  const favs = wx.getStorageSync(KEY_FAVS) || []
  const idx = favs.findIndex(f => f.month === month && f.day === day)
  if (idx >= 0) {
    favs.splice(idx, 1)
    wx.setStorageSync(KEY_FAVS, favs)
    return false
  }
  favs.unshift({
    month, day,
    topic: (meta && meta.topic) || '',
    date: (meta && meta.date) || `${month}月${day}日`,
    ts: Date.now(),
  })
  wx.setStorageSync(KEY_FAVS, favs)
  return true
}

/** 某天是否已收藏 */
function isFav(month, day) {
  const favs = wx.getStorageSync(KEY_FAVS) || []
  return favs.some(f => f.month === month && f.day === day)
}

/** 获取收藏列表 */
function getFavs() {
  return wx.getStorageSync(KEY_FAVS) || []
}

/* ═══════ 里程碑 ═══════ */
const MILESTONES = [3, 7, 14, 21, 30, 50, 100, 200, 365]
const MILESTONE_TITLES = {
  3:   '入门三日',
  7:   '一周坚持',
  14:  '半月有成',
  21:  '习惯养成',
  30:  '月度达人',
  50:  '半百之旅',
  100: '百日筑基',
  200: '双百精进',
  365: '全年通关',
}
const KEY_SHOWN = 'em_milestonesShown'  // 已弹过的里程碑记录

/** 检查 streak 是否命中里程碑（且本设备未弹过） */
function checkMilestone(streakCount) {
  if (!MILESTONES.includes(streakCount)) return null
  const shown = wx.getStorageSync(KEY_SHOWN) || []
  if (shown.includes(streakCount)) return null  // 已弹过
  shown.push(streakCount)
  wx.setStorageSync(KEY_SHOWN, shown)
  return streakCount
}

/** 获取里程碑信息 */
function getMilestoneInfo(count) {
  return {
    count,
    title: MILESTONE_TITLES[count] || '',
  }
}

module.exports = {
  markRead,
  isRead,
  getReadCount,
  getStreak,
  getProgress,
  toggleFav,
  isFav,
  getFavs,
  toDayOfYear,
  checkMilestone,
  getMilestoneInfo,
}

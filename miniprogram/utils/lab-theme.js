// utils/lab-theme.js —— 工具模块统一画布主题
// 与 app.wxss 暖纸编辑风同源："教科书插图"风格的浅色画布。
// 分类色板已通过色觉安全校验（dataviz 六项检查，surface #fbf9f4）。
// 注意：series[3] 与 series[4] 同时出现时必须配文字直接标注（CVD 边界带豁免条件）。

const THEME = {
  // ── 画布表面 ──
  bg: '#fbf9f4',          // 与 --card 一致；画布默认底色
  bgSoft: '#f3efe6',      // 与 --paper 一致；分区/嵌板底色

  // ── 墨色文字 ──
  ink: '#20201c',         // 标题/关键读数
  inkSoft: '#4c463c',     // 坐标刻度文字
  muted: '#9b9384',       // 单位/次要注释

  // ── 结构线 ──
  grid: 'rgba(32,32,28,0.07)',       // 网格（退后）
  gridStrong: 'rgba(32,32,28,0.13)', // 主网格/极坐标环
  axis: 'rgba(32,32,28,0.34)',       // 坐标轴线
  ring: '#fbf9f4',                   // 标记点外圈（与表面同色，2px 呼吸圈）

  // ── 分类系列（固定顺序，不得循环取色）──
  series: ['#b85c38', '#1f8a70', '#b07d1e', '#4a63a8', '#a04f7d'],
  // 语义别名（与系列同源，便于按意义取色）
  accent: '#b85c38',      // 主系列 · 赤陶
  teal: '#1f8a70',        // 第二系列 · 青绿
  gold: '#b07d1e',        // 第三系列 · 赭金
  indigo: '#4a63a8',      // 第四系列 · 靛蓝
  plum: '#a04f7d',        // 第五系列 · 梅紫

  // ── 状态（不作系列复用；danger 不在分类板中）──
  danger: '#b3403a',
  dangerSoft: 'rgba(179,64,58,0.10)',
  okSoft: 'rgba(31,138,112,0.10)',

  // ── 顺序渐变（单一赤陶色相，浅→深；热图用）──
  ramp: ['#f6ece3', '#eacdb7', '#dcae8d', '#cc8d66', '#b86a44', '#9c4f2f'],
  // 发散（靛蓝 ↔ 赤陶，中性米灰中点；相位/正负量用）
  divergeNeg: '#4a63a8',
  divergeMid: '#efe9dd',
  divergePos: '#b85c38',

  // ── 字体（canvas 2d 上下文用 px）──
  fontTick: '10px -apple-system, "PingFang SC", sans-serif',
  fontLabel: '11px -apple-system, "PingFang SC", sans-serif',
  fontNote: '12px -apple-system, "PingFang SC", sans-serif',
  fontTitle: '600 13px -apple-system, "PingFang SC", sans-serif',
}

// hex → rgba 字符串
function alpha(hex, a) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'
}

// 顺序渐变取色：t ∈ [0,1] → ramp 插值
function rampColor(t) {
  const stops = THEME.ramp
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(x))
  return mixHex(stops[i], stops[i + 1], x - i)
}

// 发散取色：t ∈ [-1,1] → 靛蓝…米灰…赤陶
function divergeColor(t) {
  const x = Math.max(-1, Math.min(1, t))
  if (x < 0) return mixHex(THEME.divergeMid, THEME.divergeNeg, -x)
  return mixHex(THEME.divergeMid, THEME.divergePos, x)
}

function mixHex(h1, h2, t) {
  const a = h1.replace('#', ''), b = h2.replace('#', '')
  const c = (i) => Math.round(
    parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t
  )
  const to2 = (v) => v.toString(16).padStart(2, '0')
  return '#' + to2(c(0)) + to2(c(2)) + to2(c(4))
}

module.exports = { THEME, alpha, rampColor, divergeColor, mixHex }

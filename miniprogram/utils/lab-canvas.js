// utils/lab-canvas.js —— 工具模块统一画布绘图库
// 所有工具页的 2D 图共用此库：同一套坐标轴、网格、折线、极坐标、标注规范，
// 保证"教科书插图"级的一致视觉。规范要点：
//   · 网格退后（浅）、轴线适中、数据线 2px、标记点带表面色呼吸圈
//   · 坐标轴必须有刻度 + 单位；系列必须直接文字标注（不只靠颜色）
//   · 文字一律用墨色系（ink/inkSoft/muted），颜色只落在标记上

const { THEME, alpha } = require('./lab-theme')

// ── 挂载：DPR 感知初始化，回调 (ctx, w, h, canvas) ──
function mount(page, selector, cb) {
  const q = wx.createSelectorQuery().in(page)
  q.select(selector).fields({ node: true, size: true }).exec((res) => {
    if (!res || !res[0] || !res[0].node) return
    const canvas = res[0].node
    const ctx = canvas.getContext('2d')
    const dpr = wx.getWindowInfo().pixelRatio || 2
    const w = res[0].width, h = res[0].height
    canvas.width = Math.max(1, Math.floor(w * dpr))
    canvas.height = Math.max(1, Math.floor(h * dpr))
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    cb(ctx, w, h, canvas)
  })
}

function clear(ctx, w, h, bg) {
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = bg || THEME.bg
  ctx.fillRect(0, 0, w, h)
}

// ── 刻度生成：返回 { ticks, min, max } 的"漂亮"刻度 ──
function niceTicks(min, max, count) {
  if (!(max > min)) max = min + 1
  const span = max - min
  const step0 = span / Math.max(1, count || 5)
  const mag = Math.pow(10, Math.floor(Math.log10(step0)))
  const norm = step0 / mag
  const step = (norm >= 7 ? 10 : norm >= 3 ? 5 : norm >= 1.5 ? 2 : 1) * mag
  const lo = Math.ceil(min / step) * step
  const ticks = []
  for (let v = lo; v <= max + step * 1e-6; v += step) ticks.push(+v.toPrecision(12))
  return ticks
}

// ── 直角坐标图 ──
// box: {x,y,w,h} 绘图区（像素）；xd/yd: [min,max] 数据域
function Plot(ctx, box, xd, yd) {
  this.ctx = ctx; this.box = box
  this.xmin = xd[0]; this.xmax = xd[1]
  this.ymin = yd[0]; this.ymax = yd[1]
}
Plot.prototype.X = function (v) {
  return this.box.x + (v - this.xmin) / (this.xmax - this.xmin) * this.box.w
}
Plot.prototype.Y = function (v) {
  return this.box.y + this.box.h - (v - this.ymin) / (this.ymax - this.ymin) * this.box.h
}
// 网格 + 轴 + 刻度文字。opts: {xTicks, yTicks, xFmt, yFmt, xLabel, yLabel}
Plot.prototype.axes = function (opts) {
  const o = opts || {}
  const ctx = this.ctx, b = this.box
  const xt = o.xTicks || niceTicks(this.xmin, this.xmax, 5)
  const yt = o.yTicks || niceTicks(this.ymin, this.ymax, 4)
  const xFmt = o.xFmt || ((v) => fmtNum(v))
  const yFmt = o.yFmt || ((v) => fmtNum(v))
  // 网格
  ctx.lineWidth = 1
  ctx.strokeStyle = THEME.grid
  ctx.beginPath()
  xt.forEach((v) => {
    const x = this.X(v)
    if (x < b.x - 0.5 || x > b.x + b.w + 0.5) return
    ctx.moveTo(x, b.y); ctx.lineTo(x, b.y + b.h)
  })
  yt.forEach((v) => {
    const y = this.Y(v)
    if (y < b.y - 0.5 || y > b.y + b.h + 0.5) return
    ctx.moveTo(b.x, y); ctx.lineTo(b.x + b.w, y)
  })
  ctx.stroke()
  // 轴线（左 + 下）
  ctx.strokeStyle = THEME.axis
  ctx.beginPath()
  ctx.moveTo(b.x, b.y); ctx.lineTo(b.x, b.y + b.h); ctx.lineTo(b.x + b.w, b.y + b.h)
  ctx.stroke()
  // 刻度文字
  ctx.fillStyle = THEME.inkSoft
  ctx.font = THEME.fontTick
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'
  xt.forEach((v) => {
    const x = this.X(v)
    if (x < b.x - 0.5 || x > b.x + b.w + 0.5) return
    ctx.fillText(xFmt(v), x, b.y + b.h + 5)
  })
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
  yt.forEach((v) => {
    const y = this.Y(v)
    if (y < b.y - 0.5 || y > b.y + b.h + 0.5) return
    ctx.fillText(yFmt(v), b.x - 6, y)
  })
  // 轴标题（含单位）
  ctx.fillStyle = THEME.muted
  ctx.font = THEME.fontLabel
  if (o.xLabel) {
    ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'
    ctx.fillText(o.xLabel, b.x + b.w, b.y + b.h + 32)
  }
  if (o.yLabel) {
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'
    ctx.fillText(o.yLabel, b.x, b.y - 6)
  }
  ctx.textBaseline = 'alphabetic'
}
// 折线。ys 里的 NaN/Infinity 自动断笔
Plot.prototype.line = function (xs, ys, color, width) {
  const ctx = this.ctx
  ctx.strokeStyle = color || THEME.accent
  ctx.lineWidth = width || 2
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'
  ctx.beginPath()
  let pen = false
  for (let i = 0; i < xs.length; i++) {
    const yv = ys[i]
    if (!isFinite(yv)) { pen = false; continue }
    const x = this.X(xs[i]), y = this.clampY(this.Y(yv))
    if (!pen) { ctx.moveTo(x, y); pen = true } else ctx.lineTo(x, y)
  }
  ctx.stroke()
}
// 面积（曲线到 y 基线的柔和填充）
Plot.prototype.area = function (xs, ys, color, baseY) {
  const ctx = this.ctx
  const y0 = this.clampY(this.Y(baseY == null ? this.ymin : baseY))
  ctx.fillStyle = alpha(color || THEME.accent, 0.10)
  ctx.beginPath()
  let started = false, lastX = null
  for (let i = 0; i < xs.length; i++) {
    if (!isFinite(ys[i])) continue
    const x = this.X(xs[i]), y = this.clampY(this.Y(ys[i]))
    if (!started) { ctx.moveTo(x, y0); ctx.lineTo(x, y); started = true } else ctx.lineTo(x, y)
    lastX = x
  }
  if (started) { ctx.lineTo(lastX, y0); ctx.closePath(); ctx.fill() }
}
Plot.prototype.clampY = function (y) {
  const b = this.box
  return Math.max(b.y - 0.5, Math.min(b.y + b.h + 0.5, y))
}
// 标记点：实心 + 表面色呼吸圈
Plot.prototype.dot = function (xv, yv, color, r) {
  dot(this.ctx, this.X(xv), this.Y(yv), color, r)
}
// 虚线参考线：vertical/horizontal
Plot.prototype.guideX = function (xv, color) {
  const ctx = this.ctx, b = this.box, x = this.X(xv)
  ctx.save()
  ctx.setLineDash([4, 4]); ctx.lineWidth = 1
  ctx.strokeStyle = color || THEME.gridStrong
  ctx.beginPath(); ctx.moveTo(x, b.y); ctx.lineTo(x, b.y + b.h); ctx.stroke()
  ctx.restore()
}
Plot.prototype.guideY = function (yv, color) {
  const ctx = this.ctx, b = this.box, y = this.Y(yv)
  ctx.save()
  ctx.setLineDash([4, 4]); ctx.lineWidth = 1
  ctx.strokeStyle = color || THEME.gridStrong
  ctx.beginPath(); ctx.moveTo(b.x, y); ctx.lineTo(b.x + b.w, y); ctx.stroke()
  ctx.restore()
}
// 区间着色（如栅瓣危险区）
Plot.prototype.bandX = function (x1, x2, fill) {
  const b = this.box
  const a = Math.max(b.x, Math.min(this.X(x1), this.X(x2)))
  const c = Math.min(b.x + b.w, Math.max(this.X(x1), this.X(x2)))
  if (c <= a) return
  this.ctx.fillStyle = fill || THEME.dangerSoft
  this.ctx.fillRect(a, b.y, c - a, b.h)
}

function plot(ctx, box, xd, yd) { return new Plot(ctx, box, xd, yd) }

// ── 极坐标（方向图）──
// 半圆/全圆 dB 网格。opts: {rings: [0,-10,-20,-30], full: bool, labelEvery}
function polarGrid(ctx, cx, cy, R, opts) {
  const o = opts || {}
  const rings = o.rings || [0, -10, -20, -30]
  const floor = rings[rings.length - 1]
  ctx.lineWidth = 1
  rings.forEach((db, i) => {
    const r = R * (1 - (0 - db) / (0 - floor))
    if (r <= 0) return
    ctx.strokeStyle = i === 0 ? THEME.axis : THEME.gridStrong
    ctx.beginPath()
    if (o.full) ctx.arc(cx, cy, r, 0, Math.PI * 2)
    else ctx.arc(cx, cy, r, Math.PI, Math.PI * 2)
    ctx.stroke()
    // dB 标注（右侧）
    ctx.fillStyle = THEME.muted; ctx.font = THEME.fontTick
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillText(db + '', cx + r + 3, cy - 1)
  })
  // 角度辐条
  const spokes = o.full ? 12 : 6
  ctx.strokeStyle = THEME.grid
  ctx.beginPath()
  for (let i = 0; i <= spokes; i++) {
    const a = (o.full ? 0 : Math.PI) + (Math.PI * (o.full ? 2 : 1)) * i / spokes
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + R * Math.cos(a), cy + R * Math.sin(a))
  }
  ctx.stroke()
  ctx.fillStyle = THEME.muted; ctx.font = THEME.fontTick
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  if (!o.full) {
    ctx.fillText('-90°', cx - R - 16, cy - 4)
    ctx.fillText('0°', cx, cy - R - 10)
    ctx.fillText('+90°', cx + R + 18, cy - 4)
  }
}
// 方向图曲线：patternDb(thetaRad) → dB（≤0），theta 从 -π/2..π/2 映射到上半圆
function polarCurveDb(ctx, cx, cy, R, patternDb, floorDb, color, fill) {
  const N = 181
  ctx.beginPath()
  for (let i = 0; i <= N; i++) {
    const th = -Math.PI / 2 + Math.PI * i / N // -90°..+90°
    let db = patternDb(th)
    if (!isFinite(db)) db = floorDb
    db = Math.max(floorDb, Math.min(0, db))
    const r = R * (1 - db / floorDb)
    const x = cx + r * Math.sin(th), y = cy - r * Math.cos(th) // 0° 朝上
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
  }
  if (fill) {
    ctx.lineTo(cx, cy); ctx.closePath()
    ctx.fillStyle = alpha(color, 0.10); ctx.fill()
    ctx.beginPath()
    for (let i = 0; i <= N; i++) {
      const th = -Math.PI / 2 + Math.PI * i / N
      let db = patternDb(th)
      if (!isFinite(db)) db = floorDb
      db = Math.max(floorDb, Math.min(0, db))
      const r = R * (1 - db / floorDb)
      const x = cx + r * Math.sin(th), y = cy - r * Math.cos(th)
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    }
  }
  ctx.strokeStyle = color || THEME.accent
  ctx.lineWidth = 2; ctx.lineJoin = 'round'
  ctx.stroke()
}

// ── 通用元素 ──
function dot(ctx, x, y, color, r) {
  const rr = r || 4.5
  ctx.beginPath(); ctx.arc(x, y, rr + 2, 0, Math.PI * 2)
  ctx.fillStyle = THEME.ring; ctx.fill()
  ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2)
  ctx.fillStyle = color || THEME.accent; ctx.fill()
}
function arrow(ctx, x1, y1, x2, y2, color, width) {
  const a = Math.atan2(y2 - y1, x2 - x1)
  const wd = width || 2
  const head = Math.max(7, wd * 3.2)
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = wd
  ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(x1, y1)
  ctx.lineTo(x2 - head * 0.6 * Math.cos(a), y2 - head * 0.6 * Math.sin(a)); ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - head * Math.cos(a - 0.42), y2 - head * Math.sin(a - 0.42))
  ctx.lineTo(x2 - head * Math.cos(a + 0.42), y2 - head * Math.sin(a + 0.42))
  ctx.closePath(); ctx.fill()
}
// 文字（带纸色描边光晕，压在线上也可读）。opts: {color, font, align, baseline, halo}
function label(ctx, text, x, y, opts) {
  const o = opts || {}
  ctx.font = o.font || THEME.fontLabel
  ctx.textAlign = o.align || 'left'
  ctx.textBaseline = o.baseline || 'alphabetic'
  if (o.halo !== false) {
    ctx.lineWidth = 3; ctx.strokeStyle = THEME.bg
    ctx.strokeText(text, x, y)
  }
  ctx.fillStyle = o.color || THEME.inkSoft
  ctx.fillText(text, x, y)
}
// 系列图例（内联横排）：items = [{name, color}]
function legend(ctx, items, x, y) {
  let cx = x
  ctx.font = THEME.fontLabel
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  items.forEach((it) => {
    ctx.fillStyle = it.color
    ctx.beginPath(); ctx.arc(cx + 4, y, 4, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = THEME.inkSoft
    ctx.fillText(it.name, cx + 12, y + 0.5)
    cx += 12 + ctx.measureText(it.name).width + 16
  })
  ctx.textBaseline = 'alphabetic'
}
// 热图：matrix[r][c] ∈ [0,1] → colorFn(t)。带 1px 表面缝隙
function heatmap(ctx, box, matrix, colorFn) {
  const rows = matrix.length, cols = matrix[0].length
  const cw = box.w / cols, ch = box.h / rows
  const gap = Math.min(1, cw * 0.08)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = colorFn(matrix[r][c])
      ctx.fillRect(box.x + c * cw + gap / 2, box.y + r * ch + gap / 2, cw - gap, ch - gap)
    }
  }
}
// 水平条（预算/分账图）：4px 圆头、基线对齐
function barH(ctx, x, y, wPx, hPx, color) {
  const r = Math.min(4, hPx / 2, Math.abs(wPx))
  ctx.fillStyle = color
  ctx.beginPath()
  const x2 = x + wPx
  ctx.moveTo(x, y)
  ctx.lineTo(x2 - r, y)
  ctx.arcTo(x2, y, x2, y + hPx / 2, r)
  ctx.arcTo(x2, y + hPx, x2 - r, y + hPx, r)
  ctx.lineTo(x, y + hPx)
  ctx.closePath(); ctx.fill()
}
function fmtNum(v) {
  if (v === 0) return '0'
  const a = Math.abs(v)
  if (a >= 1e6 || a < 1e-3) return v.toExponential(0)
  if (a >= 100) return String(Math.round(v))
  if (a >= 10) return String(+v.toFixed(1))
  return String(+v.toFixed(2))
}

module.exports = {
  mount, clear, niceTicks, plot,
  polarGrid, polarCurveDb,
  dot, arrow, label, legend, heatmap, barH, fmtNum,
  THEME, alpha,
}

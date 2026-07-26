// pages/tools/smith/smith.js —— 交互式 Smith 圆图
// 物理公式全部取自 utils/rf-math（页面内不重复实现）：
//   Γ = (z−1)/(z+1)   SWR = (1+|Γ|)/(1−|Γ|)   RL = −20lg|Γ|   ML = −10lg(1−|Γ|²)
// 圆图几何（Γ 平面）：
//   等电阻圆：圆心 (r/(1+r), 0)，半径 1/(1+r)；等电抗弧：圆心 (1, ±1/x)，半径 1/|x|
//   导纳圆系 = 阻抗圆系绕原点旋转 180°
//   波长环：Γ(l) = Γ_L·e^(−j2βl) → 向源移动 l，角度 θ = π − 4π·l/λ（顺时针）
const haptic = require('../../../utils/haptic')
const rf = require('../../../utils/rf-math')
const lc = require('../../../utils/lab-canvas')
const { THEME, alpha } = require('../../../utils/lab-theme')

const R_VALUES = [0.2, 0.5, 1, 2, 5]   // 等电阻/电导圆
const X_VALUES = [0.2, 0.5, 1, 2, 5]   // 等电抗/电纳弧（±）

Page({
  data: {
    zR: '1.0',      // 归一化电阻 r
    zX: '0',        // 归一化电抗 x
    z0: '50',       // 参考阻抗 Ω
    showY: false,   // 叠加导纳圆系
    res: null,      // 计算结果（null = 输入无效，隐藏结果区）
  },

  onLoad() { this.calc(false) },
  onReady() { this.draw() },

  // ═══ 输入（150ms 防抖重算；无效输入立即清结果）═══
  onZ0(e) { this.setData({ z0: e.detail.value }); this._debounce() },
  onZR(e) { this.setData({ zR: e.detail.value }); this._debounce() },
  onZX(e) { this.setData({ zX: e.detail.value }); this._debounce() },
  _debounce() {
    if (this._timer) clearTimeout(this._timer)
    this._timer = setTimeout(() => { this._timer = null; this.calc() }, 150)
  },

  // ═══ 预设 ═══
  setMatch() { haptic.light(); this.setData({ zR: '1', zX: '0' }, () => this.calc()) },
  setShort() { haptic.light(); this.setData({ zR: '0', zX: '0' }, () => this.calc()) },
  // 真开路：r 取大数，显示端识别为 ∞（|Γ|→1、SWR→∞）
  setOpen() { haptic.light(); this.setData({ zR: '1000000', zX: '0' }, () => this.calc()) },
  setExample() { haptic.light(); this.setData({ zR: '0.5', zX: '1' }, () => this.calc()) },

  onYMode(e) {
    haptic.light()
    const showY = e.currentTarget.dataset.y === '1'
    if (showY === this.data.showY) return
    this._staticKey = null // 静态圆系缓存失效
    this.setData({ showY }, () => this.draw())
  },

  // ═══ 计算 ═══
  calc(redraw) {
    if (this._timer) { clearTimeout(this._timer); this._timer = null }
    const r = parseFloat(this.data.zR)
    const x = parseFloat(this.data.zX) || 0
    const z0 = parseFloat(this.data.z0) || 50

    if (!isFinite(r) || r < 0) { // 无效输入：清过期结果与标记
      this._pt = null
      this.setData({ res: null })
      if (redraw !== false) this.draw()
      return
    }

    const g = rf.gammaFromZ(rf.cx(r, x), 1) // 归一化阻抗 → z0 = 1
    const gMag = rf.cAbs(g)
    const gDeg = rf.cArg(g) * 180 / Math.PI
    const nearFull = gMag >= 0.9999 // 视作全反射（短路/开路/纯电抗）
    const swr = nearFull ? Infinity : rf.vswrFromGamma(gMag)
    const rl = gMag > 1e-9 ? rf.rlFromGamma(gMag) : Infinity   // 匹配点 RL = ∞
    const ml = nearFull ? Infinity : rf.mismatchLossDb(gMag)   // 全反射 ML = ∞
    const q = r > 1e-9 ? Math.abs(x) / r : Infinity            // r = 0 → Q = ∞

    this._pt = { r, x, gRe: g.re, gIm: g.im, gMag, gDeg }

    const zBig = r >= 1e5
    this.setData({
      res: {
        gamma: gMag.toFixed(4),
        gammaDeg: gDeg.toFixed(1) + '°',
        swr: swr <= 99 ? swr.toFixed(2) : '∞',
        swrClass: swr < 1.5 ? 'tp-c-teal' : swr < 3 ? 'tp-c-gold' : 'tp-c-accent',
        rl: isFinite(rl) ? rl.toFixed(2) + ' dB' : '∞',
        ml: isFinite(ml) ? ml.toFixed(3) + ' dB' : '∞',
        q: isFinite(q) && q <= 999 ? q.toFixed(2) : (r <= 1e-9 && x === 0 ? '—' : '∞'),
        zStr: zBig ? 'Z → ∞（开路）'
          : 'Z = ' + (r * z0).toFixed(1) + (x < 0 ? ' − j' : ' + j') +
            Math.abs(x * z0).toFixed(1) + ' Ω',
        gStr: 'Γ = ' + g.re.toFixed(4) + (g.im < 0 ? ' − j' : ' + j') +
          Math.abs(g.im).toFixed(4),
      },
    })
    if (redraw !== false) this.draw()
  },

  // ═══ 触摸取点（canvas 触摸事件的 x/y 是 canvas 局部坐标）═══
  onChartTouch(e) {
    const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0])
    if (t) this._pick(t.x, t.y, false)
  },
  onChartTouchEnd(e) {
    const t = e.changedTouches && e.changedTouches[0]
    if (t) { haptic.light(); this._pick(t.x, t.y, true) }
  },
  _pick(px, py, final) {
    const geo = this._geo
    if (!geo) return
    const now = Date.now()
    if (!final && now - (this._lastPick || 0) < 60) return // 拖动节流
    this._lastPick = now

    let gRe = (px - geo.cx) / geo.R
    let gIm = -(py - geo.cy) / geo.R // canvas y 向下 → Γ 平面感性在上
    const mag = Math.hypot(gRe, gIm)
    if (mag > 1.25) return // 离圆图太远：忽略
    if (mag > 0.995) { gRe *= 0.995 / mag; gIm *= 0.995 / mag } // 贴边取 |Γ|≈1

    const z = rf.zFromGamma(rf.cx(gRe, gIm)) // z = (1+Γ)/(1−Γ)
    if (!isFinite(z.re) || !isFinite(z.im) || z.re < 0) return
    this.setData({ zR: z.re.toFixed(3), zX: z.im.toFixed(3) }, () => this.calc())
  },

  // ═══ 绘制 ═══
  draw() {
    if (this._cv) { this._paint(); return }
    lc.mount(this, '#smithChart', (ctx, w, h) => {
      this._cv = { ctx, w, h }
      this._paint()
    })
  },

  _paint() {
    const { ctx, w, h } = this._cv
    const cx = w / 2, cy = h / 2
    const R = Math.min(w, h) / 2 - 36
    this._geo = { cx, cy, R }

    lc.clear(ctx, w, h)
    const off = this._staticLayer(w, h)
    if (off) ctx.drawImage(off, 0, 0, w, h)
    else this._drawGrid(ctx, w, h)
    this._drawMarker(ctx)
  },

  // 静态圆系缓存到离屏 canvas（不支持时退化为直接绘制）
  _staticLayer(w, h) {
    if (typeof wx.createOffscreenCanvas !== 'function') return null
    const key = w + 'x' + h + ':' + (this.data.showY ? 'y' : 'z')
    if (this._static && this._staticKey === key) return this._static
    try {
      const dpr = wx.getWindowInfo().pixelRatio || 2
      const off = wx.createOffscreenCanvas({
        type: '2d',
        width: Math.max(1, Math.floor(w * dpr)),
        height: Math.max(1, Math.floor(h * dpr)),
      })
      const octx = off.getContext('2d')
      octx.setTransform(dpr, 0, 0, dpr, 0, 0)
      lc.clear(octx, w, h)
      this._drawGrid(octx, w, h)
      this._static = off
      this._staticKey = key
      return off
    } catch (err) { return null }
  },

  // ── 静态层：外圆 + 波长环 + 阻抗/导纳圆系 + 标签 ──
  _drawGrid(ctx, w, h) {
    const cx = w / 2, cy = h / 2
    const R = Math.min(w, h) / 2 - 36
    const showY = this.data.showY

    // 外圆 |Γ| = 1
    ctx.strokeStyle = THEME.axis
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke()

    // 波长刻度环：0 在短路点（左），向源顺时针，θ = π − 4πl
    ctx.strokeStyle = THEME.axis
    ctx.lineWidth = 1
    for (let k = 0; k < 10; k++) {
      const th = Math.PI - 4 * Math.PI * 0.05 * k
      const c = Math.cos(th), s = Math.sin(th)
      ctx.beginPath()
      ctx.moveTo(cx + R * c, cy - R * s)
      ctx.lineTo(cx + (R + 5) * c, cy - (R + 5) * s)
      ctx.stroke()
    }
    for (let k = 0; k < 5; k++) {
      const l = 0.1 * k
      const th = Math.PI - 4 * Math.PI * l
      lc.label(ctx, k === 0 ? '0λ' : l.toFixed(1) + 'λ',
        cx + (R + 17) * Math.cos(th), cy - (R + 17) * Math.sin(th) + 4,
        { align: 'center', color: THEME.muted, font: THEME.fontTick })
    }
    // 向源方向箭头（顺时针）
    const a1 = Math.PI - 4 * Math.PI * 0.028
    const a2 = Math.PI - 4 * Math.PI * 0.072
    lc.arrow(ctx,
      cx + (R + 12) * Math.cos(a1), cy - (R + 12) * Math.sin(a1),
      cx + (R + 12) * Math.cos(a2), cy - (R + 12) * Math.sin(a2),
      THEME.muted, 1.2)
    const am = Math.PI - 4 * Math.PI * 0.05
    lc.label(ctx, '向源', cx + (R + 32) * Math.cos(am), cy - (R + 32) * Math.sin(am),
      { align: 'center', color: THEME.muted, font: THEME.fontTick })

    // 等电阻圆
    ctx.lineWidth = 1
    ctx.strokeStyle = alpha(THEME.accent, 0.4)
    R_VALUES.forEach((r) => {
      ctx.beginPath()
      ctx.arc(cx + r / (1 + r) * R, cy, R / (1 + r), 0, Math.PI * 2)
      ctx.stroke()
    })

    // 等电抗弧（裁剪到单位圆内）
    ctx.strokeStyle = alpha(THEME.teal, 0.4)
    ctx.save()
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip()
    X_VALUES.forEach((x) => {
      const ar = R / x
      ctx.beginPath(); ctx.arc(cx + R, cy - ar, ar, 0, Math.PI * 2); ctx.stroke() // x>0 感性（上）
      ctx.beginPath(); ctx.arc(cx + R, cy + ar, ar, 0, Math.PI * 2); ctx.stroke() // x<0 容性（下）
    })
    ctx.restore()

    // 导纳圆系（阻抗圆系旋转 180°）
    if (showY) {
      ctx.strokeStyle = alpha(THEME.indigo, 0.38)
      R_VALUES.forEach((g) => { // 等电导圆：圆心 (−g/(1+g), 0)
        ctx.beginPath()
        ctx.arc(cx - g / (1 + g) * R, cy, R / (1 + g), 0, Math.PI * 2)
        ctx.stroke()
      })
      ctx.save()
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip()
      X_VALUES.forEach((b) => { // 等电纳弧：圆心 (−1, ±1/b)
        const ar = R / b
        ctx.beginPath(); ctx.arc(cx - R, cy - ar, ar, 0, Math.PI * 2); ctx.stroke()
        ctx.beginPath(); ctx.arc(cx - R, cy + ar, ar, 0, Math.PI * 2); ctx.stroke()
      })
      ctx.restore()
    }

    // 实轴
    ctx.strokeStyle = THEME.gridStrong
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke()

    // r 标签：圆与实轴交点 Γ = (r−1)/(r+1)，放在实轴下方错开
    R_VALUES.forEach((r) => {
      lc.label(ctx, 'r=' + r, cx + (r - 1) / (r + 1) * R, cy + 14,
        { align: 'center', color: THEME.accent, font: THEME.fontLabel })
    })
    // g 标签：交点 Γ = (1−g)/(1+g)，第二行避让 r 标签
    if (showY) {
      R_VALUES.forEach((g) => {
        lc.label(ctx, 'g=' + g, cx + (1 - g) / (1 + g) * R, cy + 28,
          { align: 'center', color: THEME.indigo, font: THEME.fontTick })
      })
    }
    // x 标签：z = jx 在外圆上 Γ = ((x²−1) + j·2x)/(x²+1)
    // Im(Γ) = +2x/(x²+1)：正电抗标签在上半圆（此前符号写反导致上下颠倒）
    X_VALUES.forEach((x) => {
      const gRe = (x * x - 1) / (x * x + 1)
      const gIm = 2 * x / (x * x + 1)
      const phi = Math.atan2(gIm, gRe)
      const rr = R - 15
      lc.label(ctx, 'x=' + x, cx + rr * Math.cos(phi), cy - rr * Math.sin(phi) + 4,
        { align: 'center', color: THEME.teal, font: THEME.fontLabel })
      lc.label(ctx, 'x=−' + x, cx + rr * Math.cos(-phi), cy - rr * Math.sin(-phi) + 4,
        { align: 'center', color: THEME.teal, font: THEME.fontLabel })
    })

    // 端点 / 区域 / 匹配点
    lc.label(ctx, '短路 r=0', cx - R + 8, cy - 8,
      { color: THEME.inkSoft, font: THEME.fontTick })
    lc.label(ctx, '开路 r=∞', cx + R - 8, cy - 8,
      { align: 'right', color: THEME.inkSoft, font: THEME.fontTick })
    lc.label(ctx, '感性区 x>0', cx - R * 0.5, cy - R * 0.62,
      { align: 'center', color: THEME.muted, font: THEME.fontTick })
    lc.label(ctx, '容性区 x<0', cx - R * 0.5, cy + R * 0.62,
      { align: 'center', color: THEME.muted, font: THEME.fontTick })
    ctx.fillStyle = alpha('#20201c', 0.55)
    ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI * 2); ctx.fill()
    lc.label(ctx, '匹配', cx + 6, cy - 6,
      { color: THEME.inkSoft, font: THEME.fontTick })

    // 图例
    const items = [
      { name: '等电阻圆 r', color: THEME.accent },
      { name: '等电抗弧 x', color: THEME.teal },
    ]
    if (showY) items.push({ name: '导纳圆 g·b', color: THEME.indigo })
    lc.legend(ctx, items, 12, h - 12)
  },

  // ── 动态层：等 SWR 圆 + 标记点 + 浮动读数 ──
  _drawMarker(ctx) {
    const pt = this._pt
    if (!pt || !this._geo) return
    const { cx, cy, R } = this._geo
    const gClamp = Math.min(pt.gMag, 1)
    const px = cx + (pt.gMag > 1 ? pt.gRe / pt.gMag : pt.gRe) * R
    const py = cy - (pt.gMag > 1 ? pt.gIm / pt.gMag : pt.gIm) * R

    // 等 SWR 圆（|Γ| 定值，虚线）
    if (pt.gMag > 1e-4) {
      ctx.save()
      ctx.setLineDash([4, 3])
      ctx.strokeStyle = alpha(THEME.accent, 0.55)
      ctx.lineWidth = 1.2
      ctx.beginPath(); ctx.arc(cx, cy, gClamp * R, 0, Math.PI * 2); ctx.stroke()
      ctx.restore()
    }
    // 圆心 → 标记连线 + 标记点
    ctx.strokeStyle = alpha(THEME.accent, 0.5)
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke()
    lc.dot(ctx, px, py, THEME.accent, 5)

    // 浮动读数（跟随标记，自动避让画布边缘）
    const zTxt = pt.r >= 1e5 ? 'z → ∞'
      : 'z=' + pt.r.toFixed(2) + (pt.x < 0 ? '−j' : '+j') + Math.abs(pt.x).toFixed(2)
    const gTxt = 'Γ=' + pt.gMag.toFixed(3) + '∠' + pt.gDeg.toFixed(1) + '°'
    const align = px > cx ? 'right' : 'left'
    const lx = px + (px > cx ? -10 : 10)
    const ly = py < cy ? py + 18 : py - 30
    lc.label(ctx, zTxt, lx, ly, { align, color: THEME.ink, font: THEME.fontTitle })
    lc.label(ctx, gTxt, lx, ly + 14, { align, color: THEME.inkSoft, font: THEME.fontLabel })
  },

  onShareAppMessage() {
    return { title: 'Smith 阻抗圆图 · 交互求解 Γ 与 SWR', path: '/pages/tools/smith/smith' }
  },
})

// pages/interactive/smith-chart/smith-chart.js —— 交互式 Smith 圆图
// 数学（全部来自 utils/rf-math 复数库）：
//   Γ = (z−1)/(z+1)；z = (1+Γ)/(1−Γ)；y = 1/z = (1−Γ)/(1+Γ)
//   等电阻圆：心 (r/(1+r), 0)，半径 1/(1+r)；等电抗弧：心 (1, ±1/x)，半径 1/|x|
//   等电导圆：心 (−g/(1+g), 0)，半径 1/(1+g)；等电纳弧：心 (−1, ±1/b)，半径 1/|b|
//   外环波长刻度（朝发生器）：Γ 相位角 = 180° − 720°·(ℓ/λ)，0λ 在短路点

const haptic = require('../../../utils/haptic')
const rf = require('../../../utils/rf-math')
const lc = require('../../../utils/lab-canvas')
const { THEME, alpha } = require('../../../utils/lab-theme')

const R_VALS = [0.2, 0.5, 1, 2, 5] // 等电阻 / 等电导圆族
const X_VALS = [0.2, 0.5, 1, 2, 5] // 等电抗 / 等电纳弧族

Page({
  data: {
    zR: '0.5',
    zX: '1.0',
    z0: '50',
    showY: false,
    res: null,
  },

  onLoad() { this.calcFromInput() },
  onReady() { this.calcFromInput() },

  // ═══ 输入 ═══
  onZR(e) { this.setData({ zR: e.detail.value }, () => this.calcFromInput()) },
  onZX(e) { this.setData({ zX: e.detail.value }, () => this.calcFromInput()) },
  onZ0(e) { this.setData({ z0: e.detail.value }, () => this.calcFromInput()) },

  setMatch() { haptic.light(); this.setData({ zR: '1', zX: '0' }, () => this.calcFromInput()) },
  setShort() { haptic.light(); this.setData({ zR: '0', zX: '0' }, () => this.calcFromInput()) },
  setOpen() {
    // 真开路：Γ = +1 直接赋值（z = ∞，不再用 r=10 冒充）
    haptic.light()
    this.setData({ zR: '∞', zX: '0' })
    this._applyGamma(rf.cx(1, 0))
  },
  setExample() { haptic.light(); this.setData({ zR: '0.5', zX: '1' }, () => this.calcFromInput()) },
  setExample2() { haptic.light(); this.setData({ zR: '0.8', zX: '-0.6' }, () => this.calcFromInput()) },
  toggleY() { haptic.light(); this.setData({ showY: !this.data.showY }, () => this.draw()) },

  calcFromInput() {
    const r = parseFloat(this.data.zR)
    const x = parseFloat(this.data.zX) || 0
    if (isNaN(r) || r < 0) {
      // 无效输入：清掉过期结果，图上不再显示旧标记
      this._g = null
      this.setData({ res: null })
      this.draw()
      return
    }
    this._applyGamma(rf.gammaFromZ(rf.cx(r, x), 1))
  },

  // 唯一计算路径：由 Γ 派生全部读数（触摸 / 输入 / 预设共用）
  _applyGamma(g, syncInputs) {
    this._g = g
    const z0 = parseFloat(this.data.z0) || 50
    const gMag = Math.min(rf.cAbs(g), 1)
    const gDeg = rf.cArg(g) * 180 / Math.PI
    const one = rf.cx(1, 0)
    const denZ = rf.cAbs(rf.cSub(one, g)) // |1−Γ| → 0 为开路
    const denY = rf.cAbs(rf.cAdd(one, g)) // |1+Γ| → 0 为短路
    const z = denZ < 1e-6 ? null : rf.zFromGamma(g)
    const y = denY < 1e-6 ? null : rf.cDiv(rf.cSub(one, g), rf.cAdd(one, g))
    const atUnit = gMag > 1 - 1e-9
    const res = {
      gamma: gMag.toFixed(4),
      gammaDeg: gDeg.toFixed(1),
      gammaC: g.re.toFixed(4) + (g.im >= 0 ? ' + j' : ' − j') + Math.abs(g.im).toFixed(4),
      swr: atUnit ? '∞' : rf.vswrFromGamma(gMag).toFixed(2),
      rl: gMag < 1e-9 ? '∞' : rf.rlFromGamma(gMag).toFixed(2) + ' dB',
      ml: atUnit ? '∞' : rf.mismatchLossDb(gMag).toFixed(3) + ' dB',
      q: (z && z.re > 1e-6) ? Math.abs(z.im / z.re).toFixed(2) : '—',
      zStr: z
        ? (z.re * z0).toFixed(1) + (z.im >= 0 ? ' + j' : ' − j') + Math.abs(z.im * z0).toFixed(1) + ' Ω'
        : '∞（开路）',
      yStr: y
        ? y.re.toFixed(3) + (y.im >= 0 ? ' + j' : ' − j') + Math.abs(y.im).toFixed(3)
        : '∞（短路）',
    }
    const patch = { res }
    if (syncInputs) {
      patch.zR = z ? String(+z.re.toFixed(3)) : '∞'
      patch.zX = z ? String(+z.im.toFixed(3)) : '0'
    }
    this.setData(patch)
    this.draw()
  },

  // ═══ 触摸交互（touchstart/touchmove 的坐标是 canvas 局部坐标）═══
  onCanvasTouch(e) { haptic.light(); this._touch(e) },
  onCanvasMove(e) {
    const now = Date.now()
    if (now - (this._lastMove || 0) < 16) return // ~60fps 节流
    this._lastMove = now
    this._touch(e)
  },
  _touch(e) {
    const meta = this._meta
    const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0])
    if (!meta || !t || t.x == null) return
    let gRe = (t.x - meta.cx) / meta.R
    let gIm = -(t.y - meta.cy) / meta.R // canvas y 向下，Smith 感性在上
    const m = Math.hypot(gRe, gIm)
    if (m > 1.08) return
    if (m > 1) { gRe /= m; gIm /= m } // 圆外一点点时吸附到 |Γ|=1
    this._applyGamma(rf.cx(gRe, gIm), true)
  },

  // ═══ 绘制 ═══
  draw() {
    lc.mount(this, '#smithCanvas', (ctx, w, h) => this._draw(ctx, w, h))
  },

  _draw(ctx, w, h) {
    lc.clear(ctx, w, h)
    const cx = w / 2, cy = h / 2
    const R = Math.min(w, h) / 2 - 30
    this._meta = { cx, cy, R }
    this._drawGrid(ctx, cx, cy, R)
    if (this.data.showY) this._drawAdmittanceGrid(ctx, cx, cy, R, w, h)
    this._drawScales(ctx, cx, cy, R, w)
    this._drawState(ctx, cx, cy, R)
    lc.label(ctx, '上半：感性 x>0', 8, 18, { color: THEME.muted, font: THEME.fontTick })
    lc.label(ctx, '下半：容性 x<0', 8, h - 8, { color: THEME.muted, font: THEME.fontTick })
  },

  // 静态阻抗网格
  _drawGrid(ctx, cx, cy, R) {
    // 外圆 |Γ|=1
    ctx.strokeStyle = THEME.axis
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke()
    // 实轴
    ctx.strokeStyle = THEME.gridStrong
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke()
    // 等电阻圆族
    ctx.strokeStyle = alpha(THEME.accent, 0.38)
    R_VALS.forEach((r) => {
      const c = r / (1 + r), rad = 1 / (1 + r)
      ctx.beginPath(); ctx.arc(cx + c * R, cy, rad * R, 0, Math.PI * 2); ctx.stroke()
    })
    // 等电抗弧族（clip 一次画完全部）
    ctx.save()
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip()
    ctx.strokeStyle = alpha(THEME.teal, 0.42)
    X_VALS.forEach((x) => {
      const ar = R / x
      ctx.beginPath(); ctx.arc(cx + R, cy - ar, ar, 0, Math.PI * 2); ctx.stroke()
      ctx.beginPath(); ctx.arc(cx + R, cy + ar, ar, 0, Math.PI * 2); ctx.stroke()
    })
    ctx.restore()
    // r 标签（10px，lc.label 自带纸色光晕可压线）
    R_VALS.forEach((r) => {
      const gx = (r - 1) / (r + 1)
      lc.label(ctx, 'r=' + r, cx + gx * R, cy + 13, {
        align: 'center', color: THEME.accent, font: THEME.fontTick,
      })
    })
    // x 标签（放在纯电抗点 Γ(jx) 内侧）
    X_VALS.forEach((x) => {
      const gRe = (x * x - 1) / (x * x + 1)
      const gIm = 2 * x / (x * x + 1)
      lc.label(ctx, 'x=' + x, cx + gRe * R * 0.87, cy - gIm * R * 0.87 + 3, {
        align: 'center', color: THEME.teal, font: THEME.fontTick,
      })
      lc.label(ctx, 'x=−' + x, cx + gRe * R * 0.87, cy + gIm * R * 0.87 + 3, {
        align: 'center', color: THEME.teal, font: THEME.fontTick,
      })
    })
    // 实轴特殊点 + 匹配点
    lc.label(ctx, '0 短路', cx - R + 6, cy - 7, { color: THEME.inkSoft, font: THEME.fontTick })
    lc.label(ctx, '∞ 开路', cx + R - 6, cy - 7, { align: 'right', color: THEME.inkSoft, font: THEME.fontTick })
    lc.dot(ctx, cx, cy, THEME.teal, 3)
    lc.label(ctx, '1 匹配', cx + 7, cy - 7, { color: THEME.teal, font: THEME.fontTick })
  },

  // 导纳网格（虚线镜像圆族，与结果区导纳读数呼应）
  _drawAdmittanceGrid(ctx, cx, cy, R, w, h) {
    ctx.save()
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip()
    ctx.setLineDash([4, 3])
    ctx.lineWidth = 1
    ctx.strokeStyle = alpha(THEME.indigo, 0.4)
    R_VALS.forEach((g) => {
      const c = g / (1 + g), rad = 1 / (1 + g)
      ctx.beginPath(); ctx.arc(cx - c * R, cy, rad * R, 0, Math.PI * 2); ctx.stroke()
    })
    X_VALS.forEach((b) => {
      const ar = R / b
      ctx.beginPath(); ctx.arc(cx - R, cy - ar, ar, 0, Math.PI * 2); ctx.stroke()
      ctx.beginPath(); ctx.arc(cx - R, cy + ar, ar, 0, Math.PI * 2); ctx.stroke()
    })
    ctx.restore()
    // g=1 圆顶点标注 + 说明
    lc.label(ctx, 'g=1', cx - 0.5 * R, cy - 0.5 * R - 4, {
      align: 'center', color: THEME.indigo, font: THEME.fontTick,
    })
    lc.label(ctx, '导纳网格 g/b（虚线）', w - 8, h - 8, {
      align: 'right', color: THEME.indigo, font: THEME.fontTick,
    })
  },

  // 外环刻度：波长环（朝发生器）+ ∠Γ 角度标注
  _drawScales(ctx, cx, cy, R, w) {
    ctx.strokeStyle = THEME.axis
    ctx.lineWidth = 1
    for (let i = 0; i < 50; i++) { // 0.01λ 一小格，0.05λ 一大格
      const a = Math.PI - 4 * Math.PI * (i / 100)
      const len = i % 5 === 0 ? 8 : 4
      ctx.beginPath()
      ctx.moveTo(cx + R * Math.cos(a), cy - R * Math.sin(a))
      ctx.lineTo(cx + (R + len) * Math.cos(a), cy - (R + len) * Math.sin(a))
      ctx.stroke()
    }
    for (let i = 0; i < 10; i++) { // 每 0.05λ 标数
      const t = i * 0.05
      const a = Math.PI - 4 * Math.PI * t
      lc.label(ctx, t.toFixed(2), cx + (R + 18) * Math.cos(a), cy - (R + 18) * Math.sin(a) + 3, {
        align: 'center', color: THEME.muted, font: THEME.fontTick,
      })
    }
    lc.label(ctx, '外环：ℓ/λ 朝发生器 ↻', w - 8, 18, {
      align: 'right', color: THEME.muted, font: THEME.fontTick,
    })
    // ∠Γ 角度刻度（内侧）
    lc.label(ctx, '0°', cx + R - 13, cy + 13, { align: 'right', color: THEME.muted, font: THEME.fontTick })
    lc.label(ctx, '90°', cx, cy - R + 15, { align: 'center', color: THEME.muted, font: THEME.fontTick })
    lc.label(ctx, '±180°', cx - R + 13, cy + 13, { color: THEME.muted, font: THEME.fontTick })
    lc.label(ctx, '−90°', cx, cy + R - 8, { align: 'center', color: THEME.muted, font: THEME.fontTick })
  },

  // 动态层：等 SWR 圆、∠Γ 弧、连线、标记点
  _drawState(ctx, cx, cy, R) {
    const g = this._g, res = this.data.res
    if (!g || !res) return
    const gMag = Math.min(rf.cAbs(g), 1)
    const ang = rf.cArg(g)
    const px = cx + g.re * R, py = cy - g.im * R
    // 等 SWR 圆（带数值标签）
    if (gMag > 0.004 && gMag < 0.9995) {
      ctx.save()
      ctx.setLineDash([5, 4])
      ctx.strokeStyle = alpha(THEME.accent, 0.65)
      ctx.lineWidth = 1.2
      ctx.beginPath(); ctx.arc(cx, cy, gMag * R, 0, Math.PI * 2); ctx.stroke()
      ctx.restore()
      lc.label(ctx, 'SWR=' + res.swr, cx, cy - gMag * R - 5, {
        align: 'center', color: THEME.accent, font: THEME.fontTick,
      })
    }
    // ∠Γ 弧：从正实轴起、带箭头和数值
    if (gMag > 0.1 && Math.abs(ang) > 0.12) {
      const ra = Math.min(30, gMag * R * 0.55)
      ctx.strokeStyle = alpha(THEME.gold, 0.9)
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.arc(cx, cy, ra, 0, -ang, ang > 0) // canvas 角 = −Smith 角
      ctx.stroke()
      const s = ang > 0 ? 1 : -1
      const a0 = ang - 0.3 * s
      lc.arrow(ctx,
        cx + ra * Math.cos(a0), cy - ra * Math.sin(a0),
        cx + ra * Math.cos(ang), cy - ra * Math.sin(ang),
        alpha(THEME.gold, 0.9), 1.4)
      const am = ang / 2
      lc.label(ctx, res.gammaDeg + '°', cx + (ra + 15) * Math.cos(am), cy - (ra + 15) * Math.sin(am) + 3, {
        align: 'center', color: THEME.gold, font: THEME.fontTick,
      })
    }
    // 圆心 → 标记连线
    ctx.strokeStyle = alpha(THEME.accent, 0.5)
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke()
    // 标记点 + |Γ| 直接标注
    lc.dot(ctx, px, py, THEME.accent, 5)
    const right = px > cx
    lc.label(ctx, '|Γ|=' + res.gamma, right ? px - 10 : px + 10, py - 9, {
      align: right ? 'right' : 'left', color: THEME.ink, font: THEME.fontLabel,
    })
  },

  onShareAppMessage() {
    return { title: '交互式 Smith 阻抗圆图', path: '/pages/interactive/smith-chart/smith-chart' }
  },
})

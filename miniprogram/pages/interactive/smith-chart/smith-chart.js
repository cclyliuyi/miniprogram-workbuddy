// pages/interactive/smith-chart/smith-chart.js —— 交互式 Smith 圆图
// Smith 圆图核心数学：
//   归一化阻抗 z = r + jx，反射系数 Γ = (z-1)/(z+1)
//   等电阻圆：圆心 (r/(1+r), 0)，半径 1/(1+r)
//   等电抗圆：圆心 (1, 1/x)，半径 1/|x|
//   等电导圆（导纳）：圆心 (-g/(1+g), 0)，半径 1/(1+g)
//   等电纳圆（导纳）：圆心 (-1, 1/b)，半径 1/|b|

const haptic = require('../../../utils/haptic')

Page({
  data: {
    zR: '0.5',
    zX: '1.0',
    z0: '50',
    freq: '',

    gamma: null,
    gammaDeg: null,
    gammaRe: null,
    gammaIm: null,
    swr: null,
    returnLoss: null,
    mismatchLoss: null,
    qValue: null,
    realImpedance: null,
    imagImpedance: null,
    zLdisplay: false,
    yG: null,
    yB: null,
  },

  onLoad() { this.calcFromInput() },
  onReady() { this.drawSmith() },

  // ═══ 输入 ═══
  onZR(e)   { this.setData({ zR: e.detail.value }, () => this.calcFromInput()) },
  onZX(e)   { this.setData({ zX: e.detail.value }, () => this.calcFromInput()) },
  onZ0(e)   { this.setData({ z0: e.detail.value }, () => this.calcFromInput()) },
  onFreq(e) { this.setData({ freq: e.detail.value }) },

  setMatch()   { haptic.light(); this.setData({ zR: '1', zX: '0' },   () => this.calcFromInput()) },
  setOpen()    { haptic.light(); this.setData({ zR: '10', zX: '0' },  () => this.calcFromInput()) },
  setShort()   { haptic.light(); this.setData({ zR: '0', zX: '0' },   () => this.calcFromInput()) },
  setExample() { haptic.light(); this.setData({ zR: '0.5', zX: '1' }, () => this.calcFromInput()) },
  setExample2(){ haptic.light(); this.setData({ zR: '0.8', zX: '-0.6' }, () => this.calcFromInput()) },

  // ═══ 计算核心 ═══
  calcFromInput() {
    const r = parseFloat(this.data.zR)
    const x = parseFloat(this.data.zX) || 0
    const z0 = parseFloat(this.data.z0) || 50

    if (isNaN(r) || r < 0) return

    // Γ = (z-1)/(z+1)
    const zRe = r - 1, zIm = x
    const dRe = r + 1, dIm = x
    const dMag2 = dRe * dRe + dIm * dIm
    const gRe = (zRe * dRe + zIm * dIm) / dMag2
    const gIm = (zIm * dRe - zRe * dIm) / dMag2
    const gMag = Math.sqrt(gRe * gRe + gIm * gIm)
    const gDeg = Math.atan2(gIm, gRe) * 180 / Math.PI

    const swr = gMag < 1 ? (1 + gMag) / (1 - gMag) : 999
    const rl = gMag > 1e-10 ? -20 * Math.log10(gMag) : 999
    const ml = gMag < 1 ? -10 * Math.log10(1 - gMag * gMag) : 0
    const q = r > 0 ? Math.abs(x / r) : 0

    // 导纳 Y = 1/Z
    const zMag2 = r * r + x * x
    const yG = zMag2 > 0 ? r / zMag2 : 0
    const yB = zMag2 > 0 ? -x / zMag2 : 0

    this.setData({
      gamma: gMag.toFixed(4),
      gammaDeg: gDeg.toFixed(1),
      gammaRe: gRe.toFixed(4),
      gammaIm: gIm.toFixed(4),
      swr: swr > 99 ? '∞' : swr.toFixed(2),
      returnLoss: rl > 99 ? '∞' : rl.toFixed(2),
      mismatchLoss: ml.toFixed(3),
      qValue: q.toFixed(2),
      realImpedance: (r * z0).toFixed(1),
      imagImpedance: (x * z0).toFixed(1),
      zLdisplay: true,
      yG: yG.toFixed(3),
      yB: yB.toFixed(3),
    })
    this.drawSmith()
  },

  // ═══ Canvas 交互 ═══
  onCanvasTap(e) { this._handleTouch(e) },
  onCanvasMove(e) {
    if (e.touches && e.touches.length > 0) this._handleTouch(e, true)
  },

  _handleTouch(e, isMove) {
    if (!isMove) haptic.light()
    if (!this._canvasMeta) return
    const { cx, cy, R } = this._canvasMeta
    // touch 坐标在 e.detail (tap) 或 e.touches[0] (move)
    let tx, ty
    if (e.detail && e.detail.x != null) { tx = e.detail.x; ty = e.detail.y }
    else if (e.touches && e.touches[0]) { tx = e.touches[0].x; ty = e.touches[0].y }
    else return

    const dx = tx - cx
    const dy = ty - cy
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist > R) return

    const gRe = dx / R
    const gIm = -dy / R // canvas y 向下，Smith 感性在上

    // Γ → z = (1+Γ)/(1-Γ)
    const numRe = 1 + gRe, numIm = gIm
    const denRe = 1 - gRe, denIm = -gIm
    const dMag2 = denRe * denRe + denIm * denIm
    const zR = (numRe * denRe + numIm * denIm) / dMag2
    const zX = (numIm * denRe - numRe * denIm) / dMag2

    if (zR < 0 || Math.abs(zR) > 50 || Math.abs(zX) > 50) return

    this.setData({ zR: zR.toFixed(3), zX: zX.toFixed(3) }, () => this.calcFromInput())
  },

  // ═══ 绘图 ═══
  drawSmith() {
    const query = wx.createSelectorQuery()
    query.select('#smithCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0]) return
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const dpr = wx.getWindowInfo().pixelRatio
        const w = res[0].width, h = res[0].height
        canvas.width = w * dpr
        canvas.height = h * dpr
        ctx.scale(dpr, dpr)
        this._draw(ctx, w, h)
      })
  },

  _draw(ctx, w, h) {
    const cx = w / 2
    const cy = h / 2
    const R = Math.min(w, h) / 2 - 20
    this._canvasMeta = { cx, cy, R, w, h }

    ctx.clearRect(0, 0, w, h)

    // 外圆
    ctx.strokeStyle = 'rgba(32,32,28,0.5)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, 2 * Math.PI)
    ctx.stroke()

    // 等电阻圆
    const rVals = [0.2, 0.5, 1, 2, 5]
    ctx.strokeStyle = 'rgba(176,106,79,0.3)'
    ctx.lineWidth = 0.6
    ctx.font = '8px sans-serif'
    ctx.textAlign = 'center'
    for (const r of rVals) {
      const cr = r / (1 + r)
      const rr = 1 / (1 + r)
      ctx.beginPath()
      ctx.arc(cx + cr * R, cy, rr * R, 0, 2 * Math.PI)
      ctx.stroke()
      ctx.fillStyle = 'rgba(176,106,79,0.5)'
      ctx.fillText('r=' + r, cx + cr * R, cy + 3)
    }

    // 等电抗圆弧（用 clip 裁剪到外圆内）
    const xVals = [0.2, 0.5, 1, 2, 5]
    ctx.strokeStyle = 'rgba(122,145,129,0.3)'
    for (const x of xVals) {
      const arcR = R / x
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, 2 * Math.PI)
      ctx.clip()
      // 感性（上）
      ctx.beginPath()
      ctx.arc(cx + R, cy - arcR, arcR, 0, 2 * Math.PI)
      ctx.stroke()
      // 容性（下）
      ctx.beginPath()
      ctx.arc(cx + R, cy + arcR, arcR, 0, 2 * Math.PI)
      ctx.stroke()
      ctx.restore()

      // 标注
      const gRe = (x * x - 1) / (x * x + 1)
      const gIm = 2 * x / (x * x + 1)
      const lx = cx + gRe * R
      const ly = cy - gIm * R // 感性在上
      ctx.fillStyle = 'rgba(122,145,129,0.6)'
      ctx.font = '8px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('x=' + x, lx - 4, ly - 3)
      ctx.fillText('x=-' + x, lx - 4, cy + gIm * R + 10)
    }

    // 实轴
    ctx.strokeStyle = 'rgba(32,32,28,0.25)'
    ctx.lineWidth = 0.6
    ctx.beginPath()
    ctx.moveTo(cx - R, cy)
    ctx.lineTo(cx + R, cy)
    ctx.stroke()

    // 实轴标注
    ctx.fillStyle = 'rgba(32,32,28,0.45)'
    ctx.font = '8px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('0', cx - R + 8, cy + 12)
    ctx.fillText('∞', cx + R - 8, cy + 12)
    ctx.fillText('1', cx, cy - 4)

    // 匹配点
    ctx.fillStyle = 'rgba(176,106,79,0.5)'
    ctx.beginPath()
    ctx.arc(cx, cy, 3, 0, 2 * Math.PI)
    ctx.fill()

    // 等驻波比圆（浅色背景圆）
    const r = parseFloat(this.data.zR)
    const x = parseFloat(this.data.zX) || 0
    if (!isNaN(r) && r >= 0) {
      const zRe = r - 1, zIm = x
      const dRe = r + 1, dIm = x
      const dMag2 = dRe * dRe + dIm * dIm
      const gRe = (zRe * dRe + zIm * dIm) / dMag2
      const gIm = (zIm * dRe - zRe * dIm) / dMag2
      const gMag = Math.sqrt(gRe * gRe + gIm * gIm)

      // 等驻波比圆（虚线）
      if (gMag < 0.999) {
        ctx.strokeStyle = 'rgba(176,106,79,0.35)'
        ctx.lineWidth = 0.8
        ctx.setLineDash([4, 3])
        ctx.beginPath()
        ctx.arc(cx, cy, gMag * R, 0, 2 * Math.PI)
        ctx.stroke()
        ctx.setLineDash([])
      }

      // 从圆心到标记的连线
      const px = cx + gRe * R
      const py = cy - gIm * R
      ctx.strokeStyle = 'rgba(176,106,79,0.45)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(px, py)
      ctx.stroke()

      // 标记点
      ctx.fillStyle = '#b06a4f'
      ctx.beginPath()
      ctx.arc(px, py, 6, 0, 2 * Math.PI)
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.stroke()

      // Γ 角度弧线标注
      if (gMag > 0.05) {
        const angle = Math.atan2(-gIm, gRe) // 注意 y 翻转
        ctx.strokeStyle = 'rgba(176,106,79,0.3)'
        ctx.lineWidth = 0.8
        ctx.beginPath()
        ctx.arc(cx, cy, 20, 0, -angle, angle < 0)
        ctx.stroke()
      }
    }

    // 提示
    ctx.fillStyle = 'rgba(155,147,132,0.45)'
    ctx.font = '9px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('感性区 (X>0)', 8, 16)
    ctx.fillText('容性区 (X<0)', 8, h - 8)
  },
})

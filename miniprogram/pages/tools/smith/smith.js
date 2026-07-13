// pages/tools/smith/smith.js —— 交互式 Smith 圆图
const haptic = require('../../../utils/haptic')

// Smith 圆图核心数学：
// 归一化阻抗 z = r + jx，反射系数 Γ = (z-1)/(z+1)
// 在 Smith 圆图 Γ 平面上：
//   等电阻圆：圆心 (r/(1+r), 0)，半径 1/(1+r)
//   等电抗圆：圆心 (1, 1/x)，半径 1/|x|
//   所有圆都通过 (1, 0) 即匹配点

Page({
  data: {
    // 输入归一化阻抗
    zR: '1.0',
    zX: '0',
    z0: '50',  // 参考阻抗 Ω

    // 结果
    gamma: null,       // Γ 幅度
    gammaDeg: null,    // Γ 角度°
    gammaRe: null,
    gammaIm: null,
    swr: null,         // 驻波比
    returnLoss: null,  // 回波损耗 dB
    mismatchLoss: null,// 失配损耗 dB
    qValue: null,      // Q 值 |X/R|
    absZ: null,        // |Z|
    realImpedance: null, // 实际阻抗 R = r·Z0
    imagImpedance: null, // 实际电抗 X = x·Z0

    // 交互标记
    markerX: 0,  // canvas 坐标
    markerY: 0,
    showMarker: true,

    canvasW: 0,
    canvasH: 0,
  },

  onLoad() {
    this.calcFromInput()
  },

  onReady() {
    this.drawSmith()
  },

  // ══════ 输入处理 ══════
  onZR(e) { this.setData({ zR: e.detail.value }, () => this.calcFromInput()) },
  onZX(e) { this.setData({ zX: e.detail.value }, () => this.calcFromInput()) },
  onZ0(e) { this.setData({ z0: e.detail.value }, () => this.calcFromInput()) },

  // 快速预设
  setMatch() {
    haptic.light()
    this.setData({ zR: '1', zX: '0' }, () => this.calcFromInput())
  },
  setOpen() {
    haptic.light()
    this.setData({ zR: '10', zX: '0' }, () => this.calcFromInput())
  },
  setShort() {
    haptic.light()
    this.setData({ zR: '0', zX: '0' }, () => this.calcFromInput())
  },
  setExample() {
    haptic.light()
    this.setData({ zR: '0.5', zX: '1' }, () => this.calcFromInput())
  },

  // 输入阻抗 → 算所有参数 → 重绘标记
  calcFromInput() {
    const r = parseFloat(this.data.zR)
    const x = parseFloat(this.data.zX) || 0
    const z0 = parseFloat(this.data.z0) || 50

    if (isNaN(r) || r < 0) return

    // Γ = (z - 1) / (z + 1)
    const zRe = r - 1
    const zIm = x
    // 分母 = z + 1
    const dRe = r + 1
    const dIm = x

    // 复数除法
    const dMag2 = dRe * dRe + dIm * dIm
    const gRe = (zRe * dRe + zIm * dIm) / dMag2
    const gIm = (zIm * dRe - zRe * dIm) / dMag2
    const gMag = Math.sqrt(gRe * gRe + gIm * gIm)
    const gDeg = Math.atan2(gIm, gRe) * 180 / Math.PI

    // SWR = (1 + |Γ|) / (1 - |Γ|)
    const swr = gMag < 1 ? (1 + gMag) / (1 - gMag) : 999

    // 回波损耗 RL = -20log|Γ|
    const rl = gMag > 1e-10 ? -20 * Math.log10(gMag) : 999

    // 失配损耗 ML = -10log(1 - |Γ|²)
    const ml = gMag < 1 ? -10 * Math.log10(1 - gMag * gMag) : 0

    // Q 值
    const q = r > 0 ? Math.abs(x / r) : 0

    this.setData({
      gamma: gMag.toFixed(4),
      gammaDeg: gDeg.toFixed(1),
      gammaRe: gRe.toFixed(4),
      gammaIm: gIm.toFixed(4),
      swr: swr > 99 ? '∞' : swr.toFixed(2),
      returnLoss: rl > 99 ? '∞' : rl.toFixed(2),
      mismatchLoss: ml.toFixed(3),
      qValue: q.toFixed(2),
      absZ: Math.sqrt(r * r + x * x).toFixed(3),
      realImpedance: (r * z0).toFixed(1),
      imagImpedance: (x * z0).toFixed(1),
    })

    // 重绘
    this.drawSmith()
  },

  // ══════ Canvas 交互 ══════
  onCanvasTap(e) {
    haptic.light()
    const touch = e.detail
    if (!touch || !this._canvasMeta) return

    const { cx, cy, R } = this._canvasMeta
    const dx = touch.x - cx
    const dy = touch.y - cy
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist > R) return // 超出圆图范围

    // canvas 坐标 → Γ 坐标（注意 y 轴翻转）
    const gRe = dx / R
    const gIm = -dy / R  // canvas y 向下，Smith 圆图感性在上

    // Γ → 归一化阻抗 z = (1 + Γ) / (1 - Γ)
    const numRe = 1 + gRe
    const numIm = gIm
    const denRe = 1 - gRe
    const denIm = -gIm
    const dMag2 = denRe * denRe + denIm * denIm
    const zR = (numRe * denRe + numIm * denIm) / dMag2
    const zX = (numIm * denRe - numRe * denIm) / dMag2

    if (zR < 0) return // 负电阻无意义

    // 限制到合理范围
    if (Math.abs(zR) > 50 || Math.abs(zX) > 50) return

    this.setData({
      zR: zR.toFixed(3),
      zX: zX.toFixed(3),
    }, () => this.calcFromInput())
  },

  // ══════ 绘制 Smith 圆图 ══════
  drawSmith() {
    const query = wx.createSelectorQuery()
    query.select('#smithChart')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0]) return
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const dpr = wx.getWindowInfo().pixelRatio
        const w = res[0].width
        const h = res[0].height
        canvas.width = w * dpr
        canvas.height = h * dpr
        ctx.scale(dpr, dpr)

        const cx = w / 2
        const cy = h / 2
        const R = Math.min(w, h) / 2 - 16

        // 保存元数据供触摸交互用
        this._canvasMeta = { cx, cy, R, w, h }
        this.setData({ canvasW: w, canvasH: h })

        // ═══ 清空 ═══
        ctx.clearRect(0, 0, w, h)

        // ═══ 外圆（|Γ| = 1）═══
        ctx.strokeStyle = 'rgba(32,32,28,0.5)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(cx, cy, R, 0, 2 * Math.PI)
        ctx.stroke()

        // ═══ 等电阻圆 ═══
        // 圆心 (r/(1+r)·R + cx, cy)，半径 R/(1+r)
        const rValues = [0, 0.2, 0.5, 1, 2, 5]
        ctx.strokeStyle = 'rgba(176,106,79,0.35)'
        ctx.lineWidth = 0.6
        for (const r of rValues) {
          if (r === 0) {
            // r=0 是外圆本身，跳过
            continue
          }
          const cr = r / (1 + r)
          const rr = 1 / (1 + r)
          ctx.beginPath()
          ctx.arc(cx + cr * R, cy, rr * R, 0, 2 * Math.PI)
          ctx.stroke()

          // 标注 r 值（在实轴上）
          ctx.fillStyle = 'rgba(176,106,79,0.7)'
          ctx.font = '9px sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText('r=' + r, cx + cr * R, cy + 3)
        }

        // ═══ 等电抗圆弧 ═══
        // 圆心 (cx + R, cy - R/x)，半径 R/|x|
        // 只画圆图内的部分弧
        const xValues = [0.2, 0.5, 1, 2, 5]
        ctx.strokeStyle = 'rgba(122,145,129,0.35)'
        ctx.lineWidth = 0.6
        for (const x of xValues) {
          // 上半部分（感性 x > 0）
          const arcR = R / x
          const arcCx = cx + R
          const arcCy = cy - arcR // 感性在上
          // 弧的起止角度
          // 圆心到 (1,0) 点的方向是 0°（右），弧范围是从切线到圆图边界
          ctx.beginPath()
          // 起点：实轴上的切点 (1, 0)
          // 在 Smith 圆图中，等电抗弧从匹配点出发，弯到外圆
          const startAngle = Math.atan2(0 - (arcCy - cy), 0) // 近似
          // 直接用 arc：从圆心画一个穿过 (1,0) 和外圆的弧
          // 实际上等电抗圆弧的端点在 |Γ|=1 圆上
          // 计算两个交点
          // 外圆方程：(x-cx)² + (y-cy)² = R²
          // 电抗圆方程：(x-arcCx)² + (y-arcCy)² = arcR²
          // 相减得线性方程，代入求解
          // 交点参数化：在外圆上，Γ = e^{jθ}
          // 电抗圆条件：imag{(1+Γ)/(1-Γ)} = x
          // 简化：对于 x > 0，弧从 θ₁ 到 θ₂
          // 更简单：直接用大弧度范围绘制，裁剪到外圆内

          // 方法：画完整电抗圆，用 clip 裁剪到外圆内
          ctx.save()
          ctx.beginPath()
          ctx.arc(cx, cy, R, 0, 2 * Math.PI)
          ctx.clip()

          ctx.beginPath()
          ctx.arc(arcCx, arcCy, arcR, 0, 2 * Math.PI)
          ctx.stroke()

          ctx.restore()

          // 标注 x 值（在外圆边缘）
          // x 值在外圆上的角度
          const labelAngle = Math.atan2(x, 0) // 不准确
          // 实际标注点：Γ 在外圆上，归一化阻抗 z = r+jx 在 r=0 时
          // z = jx → Γ = (jx-1)/(jx+1)
          // |Γ| = 1, arg(Γ) = ?
          const gRe = (x * x - 1) / (x * x + 1)
          const gIm = -2 * x / (x * x + 1) // 注意符号
          // 感性在上（canvas y 向下，所以 -gIm * R）
          const lx = cx + gRe * R
          const ly = cy - gIm * R // canvas y 翻转
          ctx.fillStyle = 'rgba(122,145,129,0.8)'
          ctx.font = '9px sans-serif'
          ctx.textAlign = 'center'
          // 偏移标注位置到弧外侧
          const offX = gRe > 0.3 ? 0 : -12
          ctx.fillText('x=' + x, lx + offX, ly - 4)
          // 负电抗标注
          const lx2 = cx + gRe * R
          const ly2 = cy + gIm * R
          ctx.fillText('x=-' + x, lx2 + offX, ly2 + 12)

          // 下半部分（容性 x < 0）—— 镜像
          ctx.save()
          ctx.beginPath()
          ctx.arc(cx, cy, R, 0, 2 * Math.PI)
          ctx.clip()
          ctx.beginPath()
          ctx.arc(cx + R, cy + arcR, arcR, 0, 2 * Math.PI)
          ctx.stroke()
          ctx.restore()
        }

        // ═══ 实轴 ═══
        ctx.strokeStyle = 'rgba(32,32,28,0.3)'
        ctx.lineWidth = 0.8
        ctx.beginPath()
        ctx.moveTo(cx - R, cy)
        ctx.lineTo(cx + R, cy)
        ctx.stroke()

        // 实轴标注
        ctx.fillStyle = 'rgba(32,32,28,0.5)'
        ctx.font = '8px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('0', cx - R + 6, cy + 12)     // Γ=-1 → r=0
        ctx.fillText('∞', cx + R - 6, cy + 12)     // Γ=+1 → r=∞
        ctx.fillText('1', cx, cy - 4)               // Γ=0 → r=1 匹配点

        // ═══ 匹配点 ═══
        ctx.fillStyle = 'rgba(176,106,79,0.6)'
        ctx.beginPath()
        ctx.arc(cx, cy, 3, 0, 2 * Math.PI)
        ctx.fill()

        // ═══ 标记当前阻抗点 ═══
        const r = parseFloat(this.data.zR)
        const x = parseFloat(this.data.zX) || 0
        if (!isNaN(r) && r >= 0) {
          // z → Γ
          const zRe = r - 1, zIm = x
          const dRe = r + 1, dIm = x
          const dMag2 = dRe * dRe + dIm * dIm
          const gRe = (zRe * dRe + zIm * dIm) / dMag2
          const gIm = (zIm * dRe - zRe * dIm) / dMag2

          const px = cx + gRe * R
          const py = cy - gIm * R // canvas y 翻转

          // 等 SWR 圆（虚线）
          if (gRe !== 0 || gIm !== 0) {
            const gMag = Math.sqrt(gRe * gRe + gIm * gIm)
            if (gMag < 0.999) {
              ctx.strokeStyle = 'rgba(176,106,79,0.4)'
              ctx.lineWidth = 0.8
              ctx.setLineDash([4, 3])
              ctx.beginPath()
              ctx.arc(cx, cy, gMag * R, 0, 2 * Math.PI)
              ctx.stroke()
              ctx.setLineDash([])
            }
          }

          // 从圆心到标记的连线
          ctx.strokeStyle = 'rgba(176,106,79,0.5)'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.lineTo(px, py)
          ctx.stroke()

          // 标记点（红色圆点）
          ctx.fillStyle = '#b06a4f'
          ctx.beginPath()
          ctx.arc(px, py, 5, 0, 2 * Math.PI)
          ctx.fill()
          ctx.strokeStyle = '#fff'
          ctx.lineWidth = 1.5
          ctx.stroke()

          this.setData({ markerX: px, markerY: py })
        }

        // ═══ 提示文字 ═══
        ctx.fillStyle = 'rgba(155,147,132,0.5)'
        ctx.font = '9px sans-serif'
        ctx.textAlign = 'left'
        ctx.fillText('感性区 (X>0)', 8, 16)
        ctx.textAlign = 'left'
        ctx.fillText('容性区 (X<0)', 8, h - 8)
      })
  },
})

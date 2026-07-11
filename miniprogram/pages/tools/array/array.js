// pages/tools/array/array.js —— 天线阵列方向图
const haptic = require('../../../utils/haptic')

Page({
  data: {
    N: 8,
    dLam: '0.5',
    theta0: '0',
    windows: ['均匀', '汉明', '汉宁', '布莱克曼'],
    winType: 0,
    hasResult: false,
    gratingWarning: false,
    metrics: {
      mainLobe: '0',
      hpbw: '—',
      sll: '—',
      directivity: '—',
    },
  },

  onNChange(e) { this.setData({ N: +e.detail.value || 1 }) },
  onDChange(e) { this.setData({ dLam: e.detail.value }) },
  onThetaChange(e) { this.setData({ theta0: e.detail.value }) },
  setWindow(e) {
    haptic.light()
    this.setData({ winType: +e.currentTarget.dataset.index })
  },

  calculate() {
    haptic.medium()
    const N = Math.max(1, Math.min(256, this.data.N))
    const d = parseFloat(this.data.dLam) || 0.5
    const theta0 = parseFloat(this.data.theta0) || 0
    const winType = this.data.winType

    // 生成窗函数加权
    const weights = this.getWindow(N, winType)

    // 计算阵列因子 -90° ~ +90°，步长 0.5°
    const angles = []
    const pattern = []
    const dpr = d * 2 * Math.PI // d/λ → d in radians
    const steerPhase = dpr * Math.sin(theta0 * Math.PI / 180)

    for (let i = -180; i <= 180; i += 0.5) {
      const theta = i * Math.PI / 180
      let af_re = 0, af_im = 0
      for (let n = 0; n < N; n++) {
        const phase = dpr * Math.sin(theta) * n - steerPhase * n
        af_re += weights[n] * Math.cos(phase)
        af_im += weights[n] * Math.sin(phase)
      }
      const mag = Math.sqrt(af_re * af_re + af_im * af_im)
      angles.push(i)
      pattern.push(mag)
    }

    // 归一化转 dB
    const maxVal = Math.max(...pattern)
    const patternDB = pattern.map(v => {
      const normalized = v / maxVal
      return normalized > 1e-10 ? 20 * Math.log10(normalized) : -100
    })

    // 计算指标
    const metrics = this.calcMetrics(angles, patternDB, N, d, weights)

    // 栅瓣警告
    const gratingWarning = d > 0.5 && Math.abs(theta0) > 20

    this.setData({
      hasResult: true,
      gratingWarning,
      metrics,
    }, () => {
      // 延迟绘制，等 canvas 渲染
      setTimeout(() => this.drawChart(angles, patternDB), 100)
    })
  },

  // 窗函数生成
  getWindow(N, type) {
    const w = []
    for (let n = 0; n < N; n++) {
      const x = N === 1 ? 0.5 : n / (N - 1)
      switch (type) {
        case 1: // Hamming
          w.push(0.54 - 0.46 * Math.cos(2 * Math.PI * x)); break
        case 2: // Hann
          w.push(0.5 - 0.5 * Math.cos(2 * Math.PI * x)); break
        case 3: // Blackman
          w.push(0.42 - 0.5 * Math.cos(2 * Math.PI * x) + 0.08 * Math.cos(4 * Math.PI * x)); break
        default: // Uniform
          w.push(1.0)
      }
    }
    return w
  },

  // 计算性能指标
  calcMetrics(angles, patternDB, N, d, weights) {
    // 主瓣指向（最大值）
    let maxIdx = 0
    for (let i = 0; i < patternDB.length; i++) {
      if (patternDB[i] > patternDB[maxIdx]) maxIdx = i
    }
    const mainLobe = angles[maxIdx]

    // HPBW（半功率波瓣宽度）
    const halfPowIdx = this.findHalfPower(patternDB, maxIdx)
    const hpbw = halfPowIdx ? (halfPowIdx.right - halfPowIdx.left).toFixed(1) : '—'

    // SLL（最大旁瓣电平）
    const sll = this.findSLL(patternDB, maxIdx).toFixed(1)

    // 方向性系数（近似）
    const sumWeightSq = weights.reduce((s, w) => s + w * w, 0)
    const sumWeight = weights.reduce((s, w) => s + w, 0)
    const directivity = (2 * d * sumWeight * sumWeight / sumWeightSq).toFixed(1)

    return {
      mainLobe: mainLobe.toFixed(0),
      hpbw,
      sll,
      directivity,
    }
  },

  // 找半功率点
  findHalfPower(patternDB, maxIdx) {
    const threshold = patternDB[maxIdx] - 3
    let left = maxIdx, right = maxIdx
    while (left > 0 && patternDB[left] > threshold) left--
    while (right < patternDB.length - 1 && patternDB[right] > threshold) right++
    if (left === 0 || right === patternDB.length - 1) return null
    return { left: left / 2 - 90, right: right / 2 - 90 } // 转回角度索引
  },

  // 找最大旁瓣
  findSLL(patternDB, maxIdx) {
    let sll = -100
    // 在主瓣两侧外找
    let left = maxIdx
    while (left > 0 && patternDB[left] > -60) left-- // 跳过主瓣左边谷
    for (let i = 0; i < left; i++) {
      if (patternDB[i] > sll) sll = patternDB[i]
    }
    let right = maxIdx
    while (right < patternDB.length - 1 && patternDB[right] > -60) right++
    for (let i = right; i < patternDB.length; i++) {
      if (patternDB[i] > sll) sll = patternDB[i]
    }
    return sll
  },

  // 绘制极坐标方向图
  drawChart(angles, patternDB) {
    const query = wx.createSelectorQuery()
    query.select('#polarChart')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res[0]) return
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const dpr = wx.getSystemInfoSync().pixelRatio
        const w = res[0].width
        const h = res[0].height
        canvas.width = w * dpr
        canvas.height = h * dpr
        ctx.scale(dpr, dpr)

        const cx = w / 2
        const cy = h / 2
        const radius = Math.min(w, h) / 2 - 40
        const minDB = -60

        // 背景圆
        ctx.fillStyle = 'rgba(32,32,28,0.02)'
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, 2 * Math.PI)
        ctx.fill()

        // 同心圆刻度（0, -10, -20, -30, -40, -50 dB）
        const dbRings = [0, -10, -20, -30, -40, -50]
        ctx.strokeStyle = 'rgba(32,32,28,0.08)'
        ctx.lineWidth = 0.5
        ctx.fillStyle = 'rgba(155,147,132,0.6)'
        ctx.font = '9px sans-serif'
        ctx.textAlign = 'center'
        for (const db of dbRings) {
          const r = radius * (1 - db / minDB)
          ctx.beginPath()
          ctx.arc(cx, cy, r, 0, 2 * Math.PI)
          ctx.stroke()
          ctx.fillText(db + 'dB', cx + r * 0.7, cy - 4)
        }

        // 角度线（-90, -60, -30, 0, 30, 60, 90）
        ctx.strokeStyle = 'rgba(32,32,28,0.06)'
        for (let a = -90; a <= 90; a += 30) {
          const rad = (a - 90) * Math.PI / 180 // 0°朝上
          const x = cx + radius * Math.cos(rad)
          const y = cy + radius * Math.sin(rad)
          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.lineTo(x, y)
          ctx.stroke()

          // 角度标签
          const lx = cx + (radius + 20) * Math.cos(rad)
          const ly = cy + (radius + 20) * Math.sin(rad)
          ctx.fillStyle = 'rgba(155,147,132,0.8)'
          ctx.font = '10px sans-serif'
          ctx.fillText(a + '°', lx, ly + 4)
        }

        // 方向图曲线
        ctx.strokeStyle = '#b06a4f'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        let started = false
        for (let i = 0; i < angles.length; i++) {
          const db = Math.max(patternDB[i], minDB)
          const r = radius * (1 - db / minDB)
          if (r > radius) continue
          const rad = (angles[i] - 90) * Math.PI / 180 // 0°朝上
          const x = cx + r * Math.cos(rad)
          const y = cy + r * Math.sin(rad)
          if (!started) { ctx.moveTo(x, y); started = true }
          else ctx.lineTo(x, y)
        }
        ctx.closePath()
        ctx.stroke()

        // 填充
        ctx.fillStyle = 'rgba(176,106,79,0.08)'
        ctx.fill()
      })
  },

  onChartTouch() {
    haptic.light()
  },
})

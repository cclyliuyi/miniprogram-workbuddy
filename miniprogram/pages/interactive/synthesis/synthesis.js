// pages/interactive/synthesis/synthesis.js —— 方向图综合与加权
// 核心：
//   阵因子 AF(θ) = Σ wₙ · e^{j 2π (d/λ)(n-m) sinθ}
//   m = (N-1)/2
//   归一化 dB: 20log10(|AF| / |AF|max)
//   加权方式：uniform / cosine / hamming / chebyshev
//   Dolph-Chebyshev：用切比雪夫多项式 T_n(x) 计算等旁瓣加权

const haptic = require('../../../utils/haptic')

Page({
  data: {
    S: {
      N: 12,
      d: 0.5,
      w: 'uniform',
      sll: -20, // dB (chebyshev)
    },
    stats: null,
  },

  onLoad() { this.update() },
  onReady() { this.update() },

  // ═══ 参数 ═══
  onN(e)   { this.setData({ 'S.N': e.detail.value }, () => this.update()) },
  onD(e)   { this.setData({ 'S.d': e.detail.value }, () => this.update()) },
  onSll(e) { this.setData({ 'S.sll': e.detail.value }, () => this.update()) },

  setUniform()   { haptic.light(); this.setData({ 'S.w': 'uniform' },   () => this.update()) },
  setCosine()    { haptic.light(); this.setData({ 'S.w': 'cosine' },    () => this.update()) },
  setHamming()   { haptic.light(); this.setData({ 'S.w': 'hamming' },   () => this.update()) },
  setChebyshev() { haptic.light(); this.setData({ 'S.w': 'chebyshev' }, () => this.update()) },

  // ═══ 计算权值 ═══
  computeWeights(S) {
    const N = Math.round(S.N)
    const m = (N - 1) / 2
    const w = new Array(N)

    switch (S.w) {
      case 'uniform':
        for (let n = 0; n < N; n++) w[n] = 1.0
        break
      case 'cosine':
        for (let n = 0; n < N; n++) w[n] = Math.cos(Math.PI * (n - m) / N)
        break
      case 'hamming':
        for (let n = 0; n < N; n++) w[n] = 0.54 + 0.46 * Math.cos(2 * Math.PI * (n - m) / N)
        break
      case 'chebyshev':
        const cheb = this.chebWeights(N, S.sll)
        for (let n = 0; n < N; n++) w[n] = cheb[n]
        break
    }
    return w
  },

  // Dolph-Chebyshev 加权
  // 旁瓣电平 sll_dB → 主旁瓣比 R = 10^(|sll|/20)
  // x0 = cosh(acosh(R) / (N-1))
  // 权值 = IFT[T_{N-1}(x0 cos(πn/N))] 的实部
  chebWeights(N, sll_dB) {
    const R = Math.pow(10, Math.abs(sll_dB) / 20)
    const Nm1 = N - 1
    // x0 = cosh(acosh(R)/(N-1))
    const acoshR = Math.log(R + Math.sqrt(R * R - 1))
    const x0 = Math.cosh(acoshR / Nm1)

    // 用频域采样法计算权值
    // w[n] = (1/N) Σ_{k=0}^{N-1} W[k] e^{j 2π kn/N}
    // W[k] = (-1)^k T_{N-1}(x0 cos(πk/N))
    const w = new Array(N)
    for (let n = 0; n < N; n++) {
      let re = 0
      for (let k = 0; k < N; k++) {
        const xk = x0 * Math.cos(Math.PI * k / N)
        const Tk = this.chebPoly(Nm1, xk)
        const phase = 2 * Math.PI * k * n / N
        const sign = k > Nm1 / 2 || (Nm1 % 2 === 1 && k === Math.round(Nm1 / 2)) ? Math.pow(-1, k) : Math.pow(-1, k)
        re += sign * Tk * Math.cos(phase)
      }
      w[n] = re / N
    }

    // 归一化使最大权值为 1
    let maxW = 0
    for (let i = 0; i < N; i++) if (Math.abs(w[i]) > maxW) maxW = Math.abs(w[i])
    if (maxW > 0) for (let i = 0; i < N; i++) w[i] /= maxW

    return w
  },

  // 切比雪夫多项式 T_n(x)
  // T_0 = 1, T_1 = x, T_{n+1} = 2x T_n - T_{n-1}
  chebPoly(n, x) {
    if (n <= 0) return 1
    if (n === 1) return x
    let Tnm2 = 1, Tnm1 = x
    for (let i = 2; i <= n; i++) {
      const Tn = 2 * x * Tnm1 - Tnm2
      Tnm2 = Tnm1
      Tnm1 = Tn
    }
    return Tnm1
  },

  // ═══ 阵因子计算 ═══
  // AF(θ) = Σ wₙ e^{j 2π (d/λ)(n-m) sinθ}
  // 返回归一化 dB 方向图
  computePattern(w, d, N) {
    const m = (N - 1) / 2
    const samples = 361 // 0.5° 步长
    const pattern = new Array(samples)

    let maxAF = 0
    for (let i = 0; i < samples; i++) {
      const theta = -90 + (i / (samples - 1)) * 180 // -90° ~ 90°
      const sinT = Math.sin(theta * Math.PI / 180)
      let re = 0, im = 0
      for (let n = 0; n < N; n++) {
        const phase = 2 * Math.PI * d * (n - m) * sinT
        re += w[n] * Math.cos(phase)
        im += w[n] * Math.sin(phase)
      }
      const mag = Math.sqrt(re * re + im * im)
      pattern[i] = { theta, mag }
      if (mag > maxAF) maxAF = mag
    }

    // 转 dB
    for (let i = 0; i < samples; i++) {
      const norm = maxAF > 0 ? pattern[i].mag / maxAF : 0
      pattern[i].dB = norm > 1e-10 ? 20 * Math.log10(norm) : -100
    }

    return { pattern, maxAF }
  },

  // ═══ 统计信息 ═══
  computeStats(pattern, w, N) {
    // HPBW
    const mainBeamIdx = pattern.findIndex(p => p.dB >= -3)
    let hpbw = 0
    if (mainBeamIdx >= 0) {
      // 找到主瓣 -3dB 点（正向和负向）
      const center = Math.floor(pattern.length / 2)
      let leftIdx = center, rightIdx = center
      for (let i = center; i >= 0; i--) {
        if (pattern[i].dB <= -3) { leftIdx = i; break }
      }
      for (let i = center; i < pattern.length; i++) {
        if (pattern[i].dB <= -3) { rightIdx = i; break }
      }
      hpbw = pattern[rightIdx].theta - pattern[leftIdx].theta
    }

    // 最大旁瓣
    const center = Math.floor(pattern.length / 2)
    let sllMax = -100
    // 搜索旁瓣：跳过主瓣区域 (±5° around boresight)
    for (let i = 0; i < pattern.length; i++) {
      if (Math.abs(i - center) > 10 && pattern[i].dB > sllMax) {
        sllMax = pattern[i].dB
      }
    }

    // 指向性 ≈ 2 * d * N (均匀加权时近似)
    let sumW2 = 0
    for (let i = 0; i < N; i++) sumW2 += w[i] * w[i]
    let sumW = 0
    for (let i = 0; i < N; i++) sumW += Math.abs(w[i])
    const directivity = sumW > 0 ? 20 * Math.log10(Math.abs(sumW) / Math.sqrt(sumW2)) : 0
    const efficiency = sumW2 > 0 ? (sumW * sumW) / (N * sumW2) : 1

    return {
      hpbw: hpbw.toFixed(1),
      sll: sllMax.toFixed(1),
      directivity: directivity.toFixed(1),
      efficiency: (efficiency * 100).toFixed(0) + '%',
    }
  },

  // ═══ 更新 + 绘图 ═══
  update() {
    const S = this.data.S
    const w = this.computeWeights(S)
    const N = Math.round(S.N)
    const { pattern } = this.computePattern(w, S.d, N)
    const stats = this.computeStats(pattern, w, N)
    this.setData({ stats })
    this._weights = w
    this._pattern = pattern
    this.drawPattern()
    this.drawWeights()
  },

  // ═══ 绘方向图 ═══
  drawPattern() {
    const query = wx.createSelectorQuery()
    query.select('#patternCanvas')
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
        this._drawPattern(ctx, w, h)
      })
  },

  _drawPattern(ctx, w, h) {
    ctx.clearRect(0, 0, w, h)
    const pattern = this._pattern
    if (!pattern) return

    const padL = 40, padR = 16, padT = 12, padB = 32
    const plotW = w - padL - padR
    const plotH = h - padT - padB

    // θ: -90° ~ +90°, dB: -60 ~ 0
    const dBMin = -60, dBMax = 0
    const x2px = (theta) => padL + ((theta + 90) / 180) * plotW
    const y2px = (dB) => padT + ((dBMax - dB) / (dBMax - dBMin)) * plotH

    // 网格
    ctx.strokeStyle = 'rgba(155,147,132,0.12)'
    ctx.lineWidth = 0.5
    ctx.fillStyle = 'rgba(155,147,132,0.6)'
    ctx.font = '9px sans-serif'
    // 垂直 (每 30°)
    ctx.textAlign = 'center'
    for (let th = -90; th <= 90; th += 30) {
      const px = x2px(th)
      ctx.beginPath()
      ctx.moveTo(px, padT)
      ctx.lineTo(px, padT + plotH)
      ctx.stroke()
      ctx.fillText(th + '°', px, padT + plotH + 14)
    }
    // 水平 (每 10 dB)
    ctx.textAlign = 'right'
    for (let dB = 0; dB >= dBMin; dB -= 10) {
      const py = y2px(dB)
      ctx.beginPath()
      ctx.moveTo(padL, py)
      ctx.lineTo(padL + plotW, py)
      ctx.stroke()
      ctx.fillText(dB + '', padL - 4, py + 3)
    }

    // 轴标注
    ctx.fillStyle = 'rgba(155,147,132,0.8)'
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('θ (deg)', padL + plotW / 2, h - 2)
    ctx.save()
    ctx.translate(10, padT + plotH / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText('AF (dB)', 0, 0)
    ctx.restore()

    // 画曲线
    ctx.strokeStyle = '#b06a4f'
    ctx.lineWidth = 1.8
    ctx.beginPath()
    for (let i = 0; i < pattern.length; i++) {
      const px = x2px(pattern[i].theta)
      const dB = Math.max(pattern[i].dB, dBMin)
      const py = y2px(dB)
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.stroke()

    // 填充
    ctx.lineTo(x2px(90), padT + plotH)
    ctx.lineTo(x2px(-90), padT + plotH)
    ctx.closePath()
    ctx.fillStyle = 'rgba(176,106,79,0.06)'
    ctx.fill()
  },

  // ═══ 绘加权柱状图 ═══
  drawWeights() {
    const query = wx.createSelectorQuery()
    query.select('#weightsCanvas')
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
        this._drawWeights(ctx, w, h)
      })
  },

  _drawWeights(ctx, w, h) {
    ctx.clearRect(0, 0, w, h)
    const weights = this._weights
    if (!weights) return

    const N = weights.length
    const padL = 24, padR = 24, padT = 12, padB = 28
    const plotW = w - padL - padR
    const plotH = h - padT - padB

    // 权值范围 0~1.1
    const wMax = 1.15
    const barW = plotW / N * 0.7
    const gap = plotW / N * 0.3

    // 基线
    const baselineY = padT + plotH
    ctx.strokeStyle = 'rgba(155,147,132,0.3)'
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.moveTo(padL, baselineY)
    ctx.lineTo(padL + plotW, baselineY)
    ctx.stroke()

    // 柱
    for (let i = 0; i < N; i++) {
      const x = padL + i * (plotW / N) + gap / 2
      const barH = (Math.abs(weights[i]) / wMax) * plotH
      const y = baselineY - barH
      ctx.fillStyle = weights[i] >= 0 ? 'rgba(176,106,79,0.7)' : 'rgba(122,145,129,0.7)'
      // 圆角矩形
      const r = Math.min(barW / 2, 3)
      ctx.beginPath()
      ctx.moveTo(x + r, y)
      ctx.lineTo(x + barW - r, y)
      ctx.quadraticCurveTo(x + barW, y, x + barW, y + r)
      ctx.lineTo(x + barW, baselineY)
      ctx.lineTo(x, baselineY)
      ctx.lineTo(x, y + r)
      ctx.quadraticCurveTo(x, y, x + r, y)
      ctx.closePath()
      ctx.fill()
    }

    // 阵元号标注
    ctx.fillStyle = 'rgba(155,147,132,0.5)'
    ctx.font = '8px sans-serif'
    ctx.textAlign = 'center'
    const labelStep = N > 16 ? Math.ceil(N / 8) : 1
    for (let i = 0; i < N; i += labelStep) {
      const x = padL + i * (plotW / N) + (plotW / N) / 2
      ctx.fillText((i + 1) + '', x, baselineY + 14)
    }

    // Y 轴标注
    ctx.textAlign = 'right'
    ctx.fillText('1.0', padL - 4, padT + 8)
    ctx.fillText('0', padL - 4, baselineY + 3)
  },
})

// pages/interactive/aperture/aperture.js —— 口径场与波束宽度
// 核心：
//   矩形口径：AF(u) ∝ sinc(u) = sin(πu)/(πu)，u = (D/λ)sinθ
//   圆形口径：AF(u) ∝ 2J₁(πu)/(πu) （Airy pattern）
//   照明分布 → 口径效率 → 增益

const haptic = require('../../../utils/haptic')

Page({
  data: {
    S: {
      shape: 'rect',  // rect | circ
      D: 8,           // 口径尺寸 (λ)
      tap: -10,       // 边缘锥削 dB (tapered mode)
      illum: 'uniform', // uniform | cosine | tapered
    },
    stats: null,
  },

  onLoad() { this.update() },
  onReady() { this.update() },

  // ═══ 参数 ═══
  onD(e)   { this.setData({ 'S.D': e.detail.value }, () => this.update()) },
  onTap(e) { this.setData({ 'S.tap': e.detail.value }, () => this.update()) },

  setRect()   { haptic.light(); this.setData({ 'S.shape': 'rect' }, () => this.update()) },
  setCirc()   { haptic.light(); this.setData({ 'S.shape': 'circ' }, () => this.update()) },
  setUniform(){ haptic.light(); this.setData({ 'S.illum': 'uniform' }, () => this.update()) },
  setCosine() { haptic.light(); this.setData({ 'S.illum': 'cosine' }, () => this.update()) },
  setTapered(){ haptic.light(); this.setData({ 'S.illum': 'tapered' }, () => this.update()) },

  // ═══ 照明函数 E(x) ═══
  // x: 归一化口径坐标 [-1, 1]
  illum(x, S) {
    const tapLin = Math.pow(10, S.tap / 20) // 边缘值
    switch (S.illum) {
      case 'uniform':
        return 1.0
      case 'cosine':
        return Math.cos(x * Math.PI / 2)
      case 'tapered':
        // 边缘锥削: (1 - (1-tapLin)*x²)
        return 1 - (1 - tapLin) * x * x
      default:
        return 1.0
    }
  },

  // ═══ 远场方向图 AF(θ) ═══
  // 数值积分法：AF(sinθ) = ∫ E(x) e^{j 2π (D/λ) x sinθ} dx
  // 比解析法更通用（可处理任意照明分布）
  computePattern(S) {
    const D = S.D
    const Nint = 200 // 积分采样数
    const samples = 361 // 角度采样
    const pattern = []
    let maxAF = 0

    for (let i = 0; i < samples; i++) {
      const theta = -90 + (i / (samples - 1)) * 180
      const sinT = Math.sin(theta * Math.PI / 180)

      // 数值积分
      let re = 0, im = 0
      for (let j = 0; j < Nint; j++) {
        const x = -1 + (2 * j / (Nint - 1)) // [-1, 1]
        const dx = 2 / (Nint - 1)
        const E = this.illum(x, S)
        const phase = 2 * Math.PI * D * x * sinT // u = D/λ * x * sinθ
        re += E * Math.cos(phase) * dx
        im += E * Math.sin(phase) * dx
      }
      const mag = Math.sqrt(re * re + im * im) / 2 // 归一化
      pattern.push({ theta, mag })
      if (mag > maxAF) maxAF = mag
    }

    // 归一化 dB
    for (let i = 0; i < samples; i++) {
      const norm = maxAF > 0 ? pattern[i].mag / maxAF : 0
      pattern[i].dB = norm > 1e-10 ? 20 * Math.log10(norm) : -100
    }

    return pattern
  },

  // ═══ 统计 ═══
  computeStats(pattern, S) {
    // HPBW
    const center = Math.floor(pattern.length / 2)
    let leftIdx = center, rightIdx = center
    for (let i = center; i >= 0; i--) {
      if (pattern[i].dB <= -3) { leftIdx = i; break }
    }
    for (let i = center; i < pattern.length; i++) {
      if (pattern[i].dB <= -3) { rightIdx = i; break }
    }
    const hpbw = pattern[rightIdx].theta - pattern[leftIdx].theta

    // 最大旁瓣（跳过主瓣 ±5°）
    let fsll = -100
    for (let i = 0; i < pattern.length; i++) {
      if (Math.abs(i - center) > 10 && pattern[i].dB > fsll) fsll = pattern[i].dB
    }

    // 口径效率 η = (∫|E|dx)² / (2∫|E|²dx)
    const Nint = 200
    let sumE = 0, sumE2 = 0
    for (let j = 0; j < Nint; j++) {
      const x = -1 + (2 * j / (Nint - 1))
      const dx = 2 / (Nint - 1)
      const E = this.illum(x, S)
      sumE += E * dx
      sumE2 += E * E * dx
    }
    const eta = sumE2 > 0 ? (sumE * sumE) / (2 * sumE2) : 1

    // 指向性 D ≈ 4π * η * (π D²/4) / λ² → 简化为 10log10(4π A_eff/λ²)
    // 对于线阵模型简化：D ≈ 2D/λ * η (一维口径)
    const directivity = 10 * Math.log10(2 * S.D * eta)

    return {
      hpbw: hpbw.toFixed(2),
      fsll: fsll.toFixed(1),
      efficiency: (eta * 100).toFixed(0) + '%',
      directivity: directivity.toFixed(1),
    }
  },

  // ═══ 更新 + 绘图 ═══
  update() {
    const S = this.data.S
    const pattern = this.computePattern(S)
    const stats = this.computeStats(pattern, S)
    this.setData({ stats })
    this._pattern = pattern
    this.drawPattern()
    this.drawIllum()
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
    const dBMin = -60, dBMax = 0

    const x2px = (theta) => padL + ((theta + 90) / 180) * plotW
    const y2px = (dB) => padT + ((dBMax - dB) / (dBMax - dBMin)) * plotH

    // 网格
    ctx.strokeStyle = 'rgba(155,147,132,0.12)'
    ctx.lineWidth = 0.5
    ctx.fillStyle = 'rgba(155,147,132,0.6)'
    ctx.font = '9px sans-serif'
    ctx.textAlign = 'center'
    for (let th = -90; th <= 90; th += 30) {
      const px = x2px(th)
      ctx.beginPath()
      ctx.moveTo(px, padT)
      ctx.lineTo(px, padT + plotH)
      ctx.stroke()
      ctx.fillText(th + '°', px, padT + plotH + 14)
    }
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

    // 曲线
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

  // ═══ 绘照明分布 ═══
  drawIllum() {
    const query = wx.createSelectorQuery()
    query.select('#illumCanvas')
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
        this._drawIllum(ctx, w, h)
      })
  },

  _drawIllum(ctx, w, h) {
    ctx.clearRect(0, 0, w, h)
    const S = this.data.S
    const padL = 40, padR = 16, padT = 12, padB = 32
    const plotW = w - padL - padR
    const plotH = h - padT - padB

    // x: [-1, 1], E: [0, 1.05]
    const x2px = (x) => padL + ((x + 1) / 2) * plotW
    const y2px = (E) => padT + ((1.05 - E) / 1.05) * plotH

    // 网格
    ctx.strokeStyle = 'rgba(155,147,132,0.12)'
    ctx.lineWidth = 0.5
    ctx.fillStyle = 'rgba(155,147,132,0.6)'
    ctx.font = '9px sans-serif'
    ctx.textAlign = 'center'
    for (let xv = -1; xv <= 1; xv += 0.5) {
      const px = x2px(xv)
      ctx.beginPath()
      ctx.moveTo(px, padT)
      ctx.lineTo(px, padT + plotH)
      ctx.stroke()
      ctx.fillText(xv.toFixed(1), px, padT + plotH + 14)
    }
    ctx.textAlign = 'right'
    for (let ev = 0; ev <= 1; ev += 0.25) {
      const py = y2px(ev)
      ctx.beginPath()
      ctx.moveTo(padL, py)
      ctx.lineTo(padL + plotW, py)
      ctx.stroke()
      ctx.fillText(ev.toFixed(2), padL - 4, py + 3)
    }

    // 标注
    ctx.fillStyle = 'rgba(155,147,132,0.8)'
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('x / (D/2)', padL + plotW / 2, h - 2)
    ctx.save()
    ctx.translate(10, padT + plotH / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText('E(x)', 0, 0)
    ctx.restore()

    // 曲线
    ctx.strokeStyle = '#7a9181'
    ctx.lineWidth = 2
    ctx.beginPath()
    const N = 100
    for (let i = 0; i <= N; i++) {
      const x = -1 + (2 * i / N)
      const E = this.illum(x, S)
      const px = x2px(x)
      const py = y2px(E)
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.stroke()

    // 填充
    ctx.lineTo(x2px(1), padT + plotH)
    ctx.lineTo(x2px(-1), padT + plotH)
    ctx.closePath()
    ctx.fillStyle = 'rgba(122,145,129,0.08)'
    ctx.fill()
  },
})

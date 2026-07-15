// pages/interactive/transmission-line/transmission-line.js —— 传输线驻波
// 核心数学：
//   Γ_L = (Z_L - Z₀) / (Z_L + Z₀)
//   V(z) = V⁺ (e^{-jβz} + Γ_L e^{jβz})   z 从负载向源测量
//   |V(z)| = |V⁺| |1 + Γ_L e^{j2βz}|     （z 负方向往源）
//   SWR = (1 + |Γ|) / (1 - |Γ|)
//   Z_in = Z₀ (Z_L + jZ₀tan(βl)) / (Z₀ + jZ_L tan(βl))
//   β = 2π/λ

const haptic = require('../../../utils/haptic')

Page({
  data: {
    S: {
      Z0: 50,
      length: 1,   // λ
      loadType: 'match', // short | open | match | custom
      ZLr: 50,     // Ω
      ZLi: 0,      // Ω
    },
    readout: null,
  },

  onLoad() { this.update() },
  onReady() { this.update() },

  // ═══ 负载类型 ═══
  setShort() { haptic.light(); this.setData({ 'S.loadType': 'short', 'S.ZLr': 0, 'S.ZLi': 0 }, () => this.update()) },
  setOpen()  { haptic.light(); this.setData({ 'S.loadType': 'open', 'S.ZLr': 9999, 'S.ZLi': 0 }, () => this.update()) },
  setMatch() { haptic.light(); this.setData({ 'S.loadType': 'match', 'S.ZLr': this.data.S.Z0, 'S.ZLi': 0 }, () => this.update()) },
  setCustom(){ haptic.light(); this.setData({ 'S.loadType': 'custom' }, () => this.update()) },

  // ═══ 参数 ═══
  onZ0(e) {
    const Z0 = e.detail.value
    const patch = { 'S.Z0': Z0 }
    if (this.data.S.loadType === 'match') patch['S.ZLr'] = Z0
    this.setData(patch, () => this.update())
  },
  onLength(e)  { this.setData({ 'S.length': e.detail.value }, () => this.update()) },
  onZLr(e)     { this.setData({ 'S.ZLr': parseFloat(e.detail.value) || 0 }, () => this.update()) },
  onZLi(e)     { this.setData({ 'S.ZLi': parseFloat(e.detail.value) || 0 }, () => this.update()) },

  // ═══ 获取负载阻抗 ═══
  getZL() {
    const S = this.data.S
    switch (S.loadType) {
      case 'short': return { r: 0, x: 0 }
      case 'open':  return { r: 1e7, x: 0 }  // 近似开路
      case 'match': return { r: S.Z0, x: 0 }
      case 'custom': return { r: S.ZLr, x: S.ZLi }
    }
  },

  // ═══ 复数运算 ═══
  cDiv(aRe, aIm, bRe, bIm) {
    const d = bRe * bRe + bIm * bIm
    return [(aRe * bRe + aIm * bIm) / d, (aIm * bRe - aRe * bIm) / d]
  },

  // ═══ 更新 ═══
  update() {
    const S = this.data.S
    const Z0 = S.Z0
    const ZL = this.getZL()

    // Γ_L = (Z_L - Z₀) / (Z_L + Z₀)
    const gRe_num_r = ZL.r - Z0, gRe_num_i = ZL.x
    const gRe_den_r = ZL.r + Z0, gRe_den_i = ZL.x
    const [gRe, gIm] = this.cDiv(gRe_num_r, gRe_num_i, gRe_den_r, gRe_den_i)
    const gMag = Math.sqrt(gRe * gRe + gIm * gIm)
    const gDeg = Math.atan2(gIm, gRe) * 180 / Math.PI

    const swr = gMag < 1 ? (1 + gMag) / (1 - gMag) : 999

    // Z_in = Z₀ (Z_L + jZ₀tan(βl)) / (Z₀ + jZ_L tan(βl))
    // βl = 2π * length (length 以 λ 为单位)
    const beta_l = 2 * Math.PI * S.length
    const tanBl = Math.tan(beta_l)

    // 分子: Z_L + jZ₀ tan(βl) = (ZL.r) + j(ZL.x + Z0 tanBl)
    const num_r = ZL.r, num_i = ZL.x + Z0 * tanBl
    // 分母: Z₀ + jZ_L tan(βl) = Z₀ + j(ZL.r + jZL.x) tanBl
    //     = Z₀ + jZL.r tanBl - ZL.x tanBl
    //     = (Z₀ - ZL.x tanBl) + j(ZL.r tanBl)
    const den_r = Z0 - ZL.x * tanBl, den_i = ZL.r * tanBl
    // Z₀ * 分子 / 分母
    const [zInRe_raw, zInIm_raw] = this.cDiv(num_r, num_i, den_r, den_i)
    const zInRe = Z0 * zInRe_raw
    const zInIm = Z0 * zInIm_raw

    // 计算驻波 V(z)
    const samples = 200
    const vWave = []
    const iWave = []
    // z 从 0(负载) 到 -length(源)，即 z/λ 从 0 到 -length
    // 用 d = z/λ (负载端 d=0, 源端 d=length)
    let vMax = 0, vMin = Infinity
    for (let k = 0; k < samples; k++) {
      const d_lambda = (k / (samples - 1)) * S.length // d/λ 从 0 到 length
      // |V(d)| = |1 + Γ e^{j2βd}| (V⁺ 归一化为 1)
      // 2βd = 4π d/λ
      const phase = 4 * Math.PI * d_lambda
      const vRe = 1 + gMag * Math.cos(gDeg * Math.PI / 180 + phase) * Math.cos(0)
      const vIm = gMag * Math.sin(gDeg * Math.PI / 180 + phase)
      // 更精确：
      // V(d) = V+ [e^{jβd} + Γ e^{-jβd}]
      // |V(d)|² = |1 + Γ e^{-j2βd}|² (以 V+ e^{jβd} 为参考)
      const gammaPhase = gDeg * Math.PI / 180
      const reV = 1 + gMag * Math.cos(gammaPhase - 2 * 2 * Math.PI * d_lambda)
      const imV = gMag * Math.sin(gammaPhase - 2 * 2 * Math.PI * d_lambda)
      const vmag = Math.sqrt(reV * reV + imV * imV)

      // |I(d)| = |1 - Γ e^{-j2βd}| (归一化，I = V/Z₀)
      const reI = 1 - gMag * Math.cos(gammaPhase - 4 * Math.PI * d_lambda)
      const imI = -gMag * Math.sin(gammaPhase - 4 * Math.PI * d_lambda)
      const imag = Math.sqrt(reI * reI + imI * imI)

      vWave.push({ d: d_lambda, mag: vmag })
      iWave.push({ d: d_lambda, mag: imag })
      if (vmag > vMax) vMax = vmag
      if (vmag < vMin) vMin = vmag
    }

    // 格式化 Z_in
    let zInStr
    if (Math.abs(zInRe) > 10000) zInStr = '∞'
    else if (Math.abs(zInIm) < 0.01) zInStr = zInRe.toFixed(1) + ' Ω'
    else zInStr = zInRe.toFixed(1) + ' + j' + zInIm.toFixed(1)

    const readout = {
      gamma: gMag.toFixed(4),
      gammaDeg: gDeg.toFixed(1),
      swr: swr > 99 ? '∞' : swr.toFixed(2),
      zIn: zInStr,
      vMax: vMax.toFixed(3),
      vMin: vMin < 0.001 ? '0' : vMin.toFixed(3),
      zLreal: ZL.r > 1000 ? '∞' : ZL.r.toFixed(1),
      zLimag: ZL.x.toFixed(1),
    }

    this.setData({ readout })
    this._vWave = vWave
    this._iWave = iWave
    this.drawV()
    this.drawI()
  },

  // ═══ 绘 V(z) ═══
  drawV() {
    const query = wx.createSelectorQuery()
    query.select('#vCanvas')
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
        this._drawWave(ctx, w, h, this._vWave, '#b06a4f', 'rgba(176,106,79,0.08)', 'V')
      })
  },

  // ═══ 绘 I(z) ═══
  drawI() {
    const query = wx.createSelectorQuery()
    query.select('#iCanvas')
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
        this._drawWave(ctx, w, h, this._iWave, '#7a9181', 'rgba(122,145,129,0.08)', 'I')
      })
  },

  _drawWave(ctx, w, h, wave, stroke, fill, label) {
    ctx.clearRect(0, 0, w, h)
    if (!wave) return

    const padL = 40, padR = 16, padT = 12, padB = 32
    const plotW = w - padL - padR
    const plotH = h - padT - padB

    // Y 范围 0 ~ 2.1 (最大可能的 |V| = 1 + |Γ|)
    const yMax = 2.1

    const x2px = (d) => padL + (d / this.data.S.length) * plotW
    const y2px = (mag) => padT + ((yMax - mag) / yMax) * plotH

    // 网格
    ctx.strokeStyle = 'rgba(155,147,132,0.12)'
    ctx.lineWidth = 0.5
    ctx.fillStyle = 'rgba(155,147,132,0.6)'
    ctx.font = '9px sans-serif'
    ctx.textAlign = 'center'
    for (let d = 0; d <= this.data.S.length; d += this.data.S.length > 0.5 ? 0.5 : 0.25) {
      const px = x2px(d)
      ctx.beginPath()
      ctx.moveTo(px, padT)
      ctx.lineTo(px, padT + plotH)
      ctx.stroke()
      ctx.fillText(d.toFixed(2), px, padT + plotH + 14)
    }
    // 水平网格
    ctx.textAlign = 'right'
    for (let mag = 0; mag <= 2; mag += 0.5) {
      const py = y2px(mag)
      ctx.beginPath()
      ctx.moveTo(padL, py)
      ctx.lineTo(padL + plotW, py)
      ctx.stroke()
      ctx.fillText(mag.toFixed(1), padL - 4, py + 3)
    }

    // 轴标注
    ctx.fillStyle = 'rgba(155,147,132,0.8)'
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('d / λ（负载 → 源）', padL + plotW / 2, h - 2)
    ctx.save()
    ctx.translate(10, padT + plotH / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText('|' + label + '(d)|', 0, 0)
    ctx.restore()

    // 填充
    ctx.beginPath()
    ctx.moveTo(x2px(wave[0].d), padT + plotH)
    for (let i = 0; i < wave.length; i++) {
      ctx.lineTo(x2px(wave[i].d), y2px(wave[i].mag))
    }
    ctx.lineTo(x2px(wave[wave.length - 1].d), padT + plotH)
    ctx.closePath()
    ctx.fillStyle = fill
    ctx.fill()

    // 曲线
    ctx.strokeStyle = stroke
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let i = 0; i < wave.length; i++) {
      const px = x2px(wave[i].d)
      const py = y2px(wave[i].mag)
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.stroke()

    // 1.0 参考线
    ctx.strokeStyle = 'rgba(155,147,132,0.25)'
    ctx.lineWidth = 0.5
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    const refY = y2px(1.0)
    ctx.moveTo(padL, refY)
    ctx.lineTo(padL + plotW, refY)
    ctx.stroke()
    ctx.setLineDash([])
  },
})

// pages/interactive/transmission-line/transmission-line.js —— 传输线驻波
// 物理公式全部来自 utils/rf-math（复数运算 / Γ / SWR）：
//   Γ_L = (Z_L − Z₀)/(Z_L + Z₀)（短路 Γ=−1、开路 Γ=+1 直接精确取值）
//   |V(d)| = |1 + Γe^{−j2βd}|、|I(d)| = |1 − Γe^{−j2βd}|（|V⁺|=1 归一，d 自负载向源）
//   Z_in = Z₀(1 + Γe^{−j2βl})/(1 − Γe^{−j2βl})，β = 2π/λ
//   波腹 d_max/λ = ∠Γ/4π (mod 1/2)，波节 d_min = d_max ± λ/4

const haptic = require('../../../utils/haptic')
const rf = require('../../../utils/rf-math')
const lc = require('../../../utils/lab-canvas')
const { THEME, alpha } = require('../../../utils/lab-theme')

Page({
  data: {
    S: {
      Z0: 50,
      length: 1,            // 线长（λ）
      loadType: 'match',    // short | open | match | custom
      ZLr: '75',            // 自定义负载电阻（字符串，允许输入过程态）
      ZLi: '-25',           // 自定义负载电抗（可为负 = 容性）
    },
    readout: null,
  },

  onLoad() { this.update() },
  onReady() { this.update() },
  onUnload() {
    if (this._timer) { clearTimeout(this._timer); this._timer = null }
  },

  // ═══ 负载类型（custom 数值独立保存，切换不再互相覆盖）═══
  setShort()  { haptic.light(); this.setData({ 'S.loadType': 'short' }, () => this.update()) },
  setOpen()   { haptic.light(); this.setData({ 'S.loadType': 'open' }, () => this.update()) },
  setMatch()  { haptic.light(); this.setData({ 'S.loadType': 'match' }, () => this.update()) },
  setCustom() { haptic.light(); this.setData({ 'S.loadType': 'custom' }, () => this.update()) },

  // ═══ 参数（slider bindchanging 实时 + 16ms 节流）═══
  onZ0(e)     { this._set('S.Z0', e.detail.value) },
  onLength(e) { this._set('S.length', e.detail.value) },
  onZLr(e)    { this._set('S.ZLr', e.detail.value) },
  onZLi(e)    { this._set('S.ZLi', e.detail.value) },

  _set(key, val) {
    this.setData({ [key]: val })
    if (this._timer) return
    this._timer = setTimeout(() => { this._timer = null; this.update() }, 16)
  },

  // ═══ 物理求解（Γ、Zin、驻波特征全部由此派生）═══
  _calc() {
    const S = this.data.S
    const Z0 = S.Z0

    // 反射系数：理想短路/开路/匹配直接精确取值，避免大数近似
    let g, zlStr
    if (S.loadType === 'short') { g = rf.cx(-1, 0); zlStr = '0 Ω（短路）' }
    else if (S.loadType === 'open') { g = rf.cx(1, 0); zlStr = '∞（开路）' }
    else if (S.loadType === 'match') { g = rf.cx(0, 0); zlStr = Z0 + ' Ω（= Z₀）' }
    else {
      const r = Math.max(0, parseFloat(S.ZLr) || 0)
      const x = parseFloat(S.ZLi) || 0
      g = rf.gammaFromZ(rf.cx(r, x), Z0)
      zlStr = this._fmtZ(r, x)
    }

    const gMag = rf.cAbs(g)
    const gPh = rf.cArg(g)                       // rad
    const swr = gMag < 1 - 1e-9 ? rf.vswrFromGamma(gMag) : Infinity

    // 源端输入阻抗：Zin = Z₀(1+Γin)/(1−Γin)，Γin = Γe^{−j2βl}，2βl = 4π·l/λ
    const gin = rf.cMul(g, rf.cExpJ(-4 * Math.PI * S.length))
    const den = rf.cSub(rf.cx(1, 0), gin)
    let zin = null
    if (rf.cAbs(den) > 1e-6) {
      zin = rf.cMul(rf.cx(Z0, 0), rf.cDiv(rf.cAdd(rf.cx(1, 0), gin), den))
      if (!isFinite(rf.cAbs(zin)) || rf.cAbs(zin) > 1e5) zin = null
    }

    // 首个波腹/波节位置（d/λ，自负载）：∠Γ − 2βd = 0 / π (mod 2π)
    let dMax = null, dMin = null
    if (gMag > 1e-3) {
      dMax = ((gPh / (4 * Math.PI)) % 0.5 + 0.5) % 0.5
      dMin = (dMax + 0.25) % 0.5
    }

    return { S, Z0, g, gMag, gPh, swr, zin, zlStr, dMax, dMin }
  },

  _fmtZ(re, im) {
    if (!isFinite(re) || !isFinite(im)) return '∞'
    if (Math.abs(im) < 0.05) return re.toFixed(1) + ' Ω'
    return re.toFixed(1) + (im < 0 ? ' − j' : ' + j') + Math.abs(im).toFixed(1) + ' Ω'
  },

  // ═══ 更新读数 + 重绘 ═══
  update() {
    const c = this._calc()
    const vMin = 1 - c.gMag
    this.setData({
      readout: {
        gamma: c.gMag.toFixed(3),
        gammaDeg: (c.gPh * 180 / Math.PI).toFixed(1),
        swr: isFinite(c.swr) ? c.swr.toFixed(2) : '∞',
        zIn: c.zin ? this._fmtZ(c.zin.re, c.zin.im) : '∞',
        vMax: (1 + c.gMag).toFixed(3),
        vMin: vMin < 5e-4 ? '0' : vMin.toFixed(3),
        dPos: c.dMax != null
          ? c.dMax.toFixed(3) + 'λ / ' + c.dMin.toFixed(3) + 'λ'
          : '—（匹配，无驻波）',
        zL: c.zlStr,
        quarter: Math.abs((c.S.length % 0.5) - 0.25) < 1e-3,
      },
    })
    this.draw()
  },

  // ═══ 绘图：单画布叠画 |V(d)|、|I(d)|（lab-canvas）═══
  draw() {
    lc.mount(this, '#waveCanvas', (ctx, w, h) => {
      lc.clear(ctx, w, h)
      const c = this._calc()
      const len = c.S.length
      const yMax = 2.15
      const box = { x: 46, y: 24, w: w - 64, h: h - 70 }
      const p = lc.plot(ctx, box, [0, len], [0, yMax])
      p.axes({
        yTicks: [0, 0.5, 1, 1.5, 2],
        xLabel: 'd / λ（负载 → 源）',
        yLabel: '|V|、|I|（|V⁺|=1 归一）',
      })

      // 驻波曲线：|V| 赤陶、|I| 青绿
      const N = 240
      const xs = [], vs = [], is = []
      for (let k = 0; k <= N; k++) {
        const d = len * k / N
        const ph = c.gPh - 4 * Math.PI * d       // ∠(Γe^{−j2βd})
        const re = c.gMag * Math.cos(ph), im = c.gMag * Math.sin(ph)
        xs.push(d)
        vs.push(Math.hypot(1 + re, im))
        is.push(Math.hypot(1 - re, im))
      }
      p.guideY(1)                                 // 行波参考 1.0
      p.line(xs, vs, THEME.accent, 2)
      p.line(xs, is, THEME.teal, 2)

      // 系列直接标注（右端，错开避免重叠）
      const xR = p.X(len) - 3
      lc.label(ctx, '|V(d)|', xR, p.Y(vs[N]) - 8,
        { align: 'right', color: THEME.accent, font: THEME.fontLabel })
      lc.label(ctx, '|I(d)|', xR, p.Y(is[N]) + 16,
        { align: 'right', color: THEME.teal, font: THEME.fontLabel })

      // 首个电压波腹 / 波节标记
      if (c.dMax != null && c.dMax <= len + 1e-9) {
        p.guideX(c.dMax, alpha(THEME.accent, 0.5))
        const right = c.dMax > len / 2
        lc.label(ctx, 'd_max=' + c.dMax.toFixed(3) + 'λ',
          p.X(c.dMax) + (right ? -4 : 4), box.y + 14,
          { align: right ? 'right' : 'left', color: THEME.accent, font: THEME.fontTick })
      }
      if (c.dMin != null && c.dMin <= len + 1e-9) {
        p.guideX(c.dMin, alpha(THEME.gold, 0.6))
        const right = c.dMin > len / 2
        lc.label(ctx, 'd_min=' + c.dMin.toFixed(3) + 'λ',
          p.X(c.dMin) + (right ? -4 : 4), box.y + 28,
          { align: right ? 'right' : 'left', color: THEME.gold, font: THEME.fontTick })
      }

      // 负载符号（左端）与方向标注
      this._loadGlyph(ctx, box.x + 16, box.y + box.h - 10, c.S.loadType)
      lc.label(ctx, '负载', box.x + 30, box.y + box.h - 12,
        { color: THEME.inkSoft, font: THEME.fontTick })
      lc.label(ctx, '源 →', p.X(len) - 3, box.y + box.h - 12,
        { align: 'right', color: THEME.muted, font: THEME.fontTick })
    })
  },

  // 简易负载符号：短路=接地、开路=断口、匹配/自定义=阻抗盒
  _loadGlyph(ctx, x, y, type) {
    ctx.strokeStyle = THEME.inkSoft
    ctx.lineWidth = 1.5
    ctx.lineCap = 'round'
    if (type === 'short') {
      ctx.beginPath(); ctx.moveTo(x, y - 18); ctx.lineTo(x, y - 10); ctx.stroke()
      const hw = [7, 4.5, 2]
      for (let i = 0; i < 3; i++) {
        ctx.beginPath()
        ctx.moveTo(x - hw[i], y - 9 + i * 3.5)
        ctx.lineTo(x + hw[i], y - 9 + i * 3.5)
        ctx.stroke()
      }
    } else if (type === 'open') {
      ctx.beginPath(); ctx.moveTo(x, y - 18); ctx.lineTo(x, y - 12); ctx.stroke()
      ctx.beginPath(); ctx.arc(x, y - 9.5, 1.7, 0, Math.PI * 2); ctx.stroke()
      ctx.beginPath(); ctx.arc(x, y - 3.5, 1.7, 0, Math.PI * 2); ctx.stroke()
    } else {
      ctx.strokeRect(x - 7, y - 16, 14, 12)
      ctx.beginPath(); ctx.moveTo(x, y - 18); ctx.lineTo(x, y - 16); ctx.stroke()
    }
  },

  onShareAppMessage() {
    return { title: '传输线驻波实验', path: '/pages/interactive/transmission-line/transmission-line' }
  },
})

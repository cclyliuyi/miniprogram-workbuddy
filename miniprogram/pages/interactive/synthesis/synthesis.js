// pages/interactive/synthesis/synthesis.js —— 线阵方向图综合（阵因子 · 加权窗）
// 物理（全部来自 utils/rf-math，无魔法系数）：
//   阵因子 AF(θ) = Σ wₙ e^{j2π(d/λ)(n−m)sinθ}，m=(N−1)/2，侧射阵（未加扫描相位）
//   窗权：uniform / cosine / hamming（对称约定，分母 N−1）
//   Dolph–Chebyshev：rf.chebyshevWeights（频域采样逆 DFT，已数值验证等纹波精确）
//   指向性 D₀ = 2/∫|AFₙ(θ)|²cosθ dθ（各向同性阵元，数值积分，任意 d/λ 有效）
//   锥削效率 ηₜ = (Σ|wₙ|)²/(N·Σwₙ²)

const haptic = require('../../../utils/haptic')
const rf = require('../../../utils/rf-math')
const lc = require('../../../utils/lab-canvas')
const { THEME, alpha } = require('../../../utils/lab-theme')

const W_LABELS = { uniform: '均匀', cosine: '余弦', hamming: '汉明', chebyshev: '切比雪夫' }
const SAMPLES = 721 // 0.25° 步长

Page({
  data: {
    S: { N: 12, d: 0.5, w: 'uniform', sll: -20 },
    wLabel: W_LABELS.uniform,
    stats: null,
  },

  onLoad() { this.update() },
  onReady() { this.update() },

  // ═══ 事件（slider：bindchanging 实时 + bindchange 收尾，共用处理器）═══
  onN(e) { this.setData({ 'S.N': e.detail.value }); this.updateThrottled() },
  onD(e) {
    const v = Math.round(e.detail.value * 100) / 100
    this.setData({ 'S.d': v })
    this.updateThrottled()
  },
  onSll(e) { this.setData({ 'S.sll': e.detail.value }); this.updateThrottled() },
  setWeight(e) {
    haptic.light()
    const w = e.currentTarget.dataset.w || 'uniform'
    this.setData({ 'S.w': w, wLabel: W_LABELS[w] }, () => this.update())
  },

  // ═══ 物理 ═══
  _calcWeights(S) {
    const N = Math.max(2, Math.round(S.N))
    if (S.w === 'chebyshev') return rf.chebyshevWeights(N, Math.abs(S.sll))
    return rf.taperWeights(N, S.w)
  },

  // 归一化方向图采样：[{theta(°), mag(0..1), dB}]
  _calcPattern(w, d) {
    const pat = new Array(SAMPLES)
    let maxM = 0
    for (let i = 0; i < SAMPLES; i++) {
      const theta = -90 + 180 * i / (SAMPLES - 1)
      const psi = 2 * Math.PI * d * Math.sin(theta * Math.PI / 180)
      const mag = rf.afWeighted(w, psi)
      pat[i] = { theta, mag }
      if (mag > maxM) maxM = mag
    }
    for (let i = 0; i < SAMPLES; i++) {
      const nrm = maxM > 0 ? pat[i].mag / maxM : 0
      pat[i].mag = nrm
      pat[i].dB = nrm > 1e-9 ? 20 * Math.log10(nrm) : -180
    }
    return pat
  },

  _calcStats(pat, w) {
    const N = w.length
    // 峰值（侧射阵在 θ=0）
    let pk = 0
    for (let i = 1; i < pat.length; i++) if (pat[i].mag > pat[pk].mag) pk = i
    // HPBW：从峰值向两侧找 −3dB 交点（线性内插）；找不到 → null（显示 —）
    const cross = (dir) => {
      for (let i = pk; i + dir >= 0 && i + dir < pat.length; i += dir) {
        const a = pat[i], b = pat[i + dir]
        if (a.dB >= -3 && b.dB < -3) {
          return a.theta + (b.theta - a.theta) * (a.dB + 3) / (a.dB - b.dB)
        }
      }
      return null
    }
    const thR = cross(1), thL = cross(-1)
    const hpbw = (thL != null && thR != null) ? thR - thL : null
    // SLL：先找主瓣两侧第一个局部极小（null），零点以外搜全局最大（与主瓣宽度无关）
    let sll = -Infinity, found = false
    let i = pk
    while (i < pat.length - 1 && pat[i + 1].mag <= pat[i].mag) i++
    if (i < pat.length - 1) {
      found = true
      for (let j = i; j < pat.length; j++) if (pat[j].dB > sll) sll = pat[j].dB
    }
    i = pk
    while (i > 0 && pat[i - 1].mag <= pat[i].mag) i--
    if (i > 0) {
      found = true
      for (let j = i; j >= 0; j--) if (pat[j].dB > sll) sll = pat[j].dB
    }
    if (!found) sll = null
    // 指向性：D₀ = 2/∫|AFₙ(θ)|²cosθ dθ（线阵绕轴对称，θ 自侧射向量起，梯形积分）
    let integ = 0
    for (let k = 0; k < pat.length - 1; k++) {
      const t1 = pat[k].theta * Math.PI / 180
      const t2 = pat[k + 1].theta * Math.PI / 180
      const f1 = pat[k].mag * pat[k].mag * Math.cos(t1)
      const f2 = pat[k + 1].mag * pat[k + 1].mag * Math.cos(t2)
      integ += 0.5 * (f1 + f2) * (t2 - t1)
    }
    const d0Db = integ > 0 ? 10 * Math.log10(2 / integ) : 0
    // 锥削（口径）效率
    let sw = 0, sw2 = 0
    for (let n = 0; n < N; n++) { sw += Math.abs(w[n]); sw2 += w[n] * w[n] }
    const eff = sw2 > 0 ? sw * sw / (N * sw2) : 1
    return { hpbw, thL, thR, sll, d0Db, eff }
  },

  // ═══ 更新（拖动节流 ~30fps）═══
  updateThrottled() {
    const now = Date.now()
    if (now - (this._lastUpd || 0) >= 33) {
      this._lastUpd = now
      this.update()
    } else {
      clearTimeout(this._updTimer)
      this._updTimer = setTimeout(() => { this._lastUpd = Date.now(); this.update() }, 40)
    }
  },

  update() {
    const S = this.data.S
    const w = this._calcWeights(S)
    const pat = this._calcPattern(w, S.d)
    const st = this._calcStats(pat, w)
    this._weights = w
    this._pattern = pat
    this._st = st
    this.setData({
      stats: {
        hpbw: st.hpbw == null ? '—' : st.hpbw.toFixed(1) + '°',
        sll: st.sll == null ? '—' : st.sll.toFixed(1) + ' dB',
        d0: st.d0Db.toFixed(1) + ' dBi',
        eff: (st.eff * 100).toFixed(0) + '%',
      },
    })
    this.draw()
  },

  // ═══ 绘制 ═══
  draw() {
    lc.mount(this, '#patternCanvas', (ctx, w, h) => this._drawPattern(ctx, w, h))
    lc.mount(this, '#weightsCanvas', (ctx, w, h) => this._drawWeights(ctx, w, h))
  },

  _drawPattern(ctx, w, h) {
    lc.clear(ctx, w, h)
    const pat = this._pattern, st = this._st, S = this.data.S
    if (!pat || !st) return
    const box = { x: 46, y: 20, w: w - 60, h: h - 58 }
    const p = lc.plot(ctx, box, [-90, 90], [-60, 0])
    // 栅瓣危险区（侧射阵：d ≥ λ 时栅瓣进入可见空间，判据 rf.gratingLobeLimit）
    const glLimit = rf.gratingLobeLimit(0)
    if (S.d >= glLimit - 1e-9) {
      const thg = Math.asin(Math.min(1, 1 / S.d)) * 180 / Math.PI
      p.bandX(Math.max(45, thg - 12), 90)
      p.bandX(-90, -Math.max(45, thg - 12))
    }
    p.axes({
      xTicks: [-90, -60, -30, 0, 30, 60, 90],
      xFmt: (v) => v + '°',
      yTicks: [-60, -50, -40, -30, -20, -10, 0],
      xLabel: 'θ（°，自阵法向）',
      yLabel: '归一化阵因子（dB）',
    })
    const xs = pat.map((q) => q.theta)
    const ys = pat.map((q) => Math.max(-60, q.dB))
    p.area(xs, ys, THEME.accent, -60)
    p.line(xs, ys, THEME.accent, 2)
    lc.label(ctx, 'AF(θ)', p.X(4), p.Y(-1) + 14, { color: THEME.accent, font: THEME.fontLabel })
    // −3 dB 参考线 + HPBW 竖参考线
    p.guideY(-3, alpha(THEME.gold, 0.9))
    lc.label(ctx, '−3 dB', box.x + box.w - 4, p.Y(-3) - 4, {
      align: 'right', color: THEME.gold, font: THEME.fontTick,
    })
    if (st.hpbw != null) {
      p.guideX(st.thL, alpha(THEME.gold, 0.7))
      p.guideX(st.thR, alpha(THEME.gold, 0.7))
      lc.label(ctx, 'HPBW ' + st.hpbw.toFixed(1) + '°', p.X(0), box.y + 12, {
        align: 'center', color: THEME.gold, font: THEME.fontLabel,
      })
    }
    // 实测最大旁瓣水平线
    if (st.sll != null && st.sll > -58) {
      p.guideY(st.sll, alpha(THEME.teal, 0.9))
      lc.label(ctx, 'SLL ' + st.sll.toFixed(1) + ' dB', box.x + 4, p.Y(st.sll) - 4, {
        color: THEME.teal, font: THEME.fontTick,
      })
    }
    // 栅瓣提示文字
    if (S.d >= glLimit - 1e-9) {
      lc.label(ctx, '栅瓣区（d ≥ λ）', box.x + box.w - 4, box.y + 26, {
        align: 'right', color: THEME.danger, font: THEME.fontLabel,
      })
    } else if (S.d > 0.5) {
      lc.label(ctx, 'd > λ/2：扫描时将出现栅瓣', box.x + box.w - 4, box.y + 26, {
        align: 'right', color: THEME.muted, font: THEME.fontTick,
      })
    }
  },

  _drawWeights(ctx, w, h) {
    lc.clear(ctx, w, h)
    const wts = this._weights
    if (!wts) return
    const N = wts.length
    let wMin = 0
    for (let n = 0; n < N; n++) if (wts[n] < wMin) wMin = wts[n]
    const hasNeg = wMin < -1e-6
    const yMin = hasNeg ? Math.min(-0.3, wMin * 1.15) : 0
    const box = { x: 46, y: 16, w: w - 60, h: h - 62 }
    const p = lc.plot(ctx, box, [0.5, N + 0.5], [yMin, 1.08])
    const step = N > 20 ? 4 : N > 10 ? 2 : 1
    const xTicks = []
    for (let n = 1; n <= N; n += step) xTicks.push(n)
    p.axes({
      xTicks,
      xFmt: (v) => String(v),
      yTicks: hasNeg ? [-1, -0.5, 0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1],
      xLabel: '阵元序号 n',
      yLabel: '权值 wₙ（归一化）',
    })
    const y0 = p.Y(0)
    const bw = Math.max(3, box.w / N * 0.55)
    for (let n = 0; n < N; n++) {
      const xc = p.X(n + 1)
      const yv = p.Y(wts[n])
      ctx.fillStyle = wts[n] >= 0 ? alpha(THEME.accent, 0.85) : alpha(THEME.indigo, 0.85)
      ctx.fillRect(xc - bw / 2, Math.min(y0, yv), bw, Math.max(1, Math.abs(yv - y0)))
    }
    // 零基线
    ctx.strokeStyle = THEME.axis
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(box.x, y0); ctx.lineTo(box.x + box.w, y0); ctx.stroke()
    // 图例（负权 = 反相馈电，仅靠颜色不够）
    const items = [{ name: '正权', color: THEME.accent }]
    if (hasNeg) items.push({ name: '负权（反相馈电）', color: THEME.indigo })
    lc.legend(ctx, items, box.x, h - 8)
  },

  onShareAppMessage() {
    return { title: '阵列综合 · 方向图加权实验', path: '/pages/interactive/synthesis/synthesis' }
  },
})

// pages/interactive/phase-coherence-lab/phase-coherence-lab.js —— 相位相干实验室
// 三种模式：相量叠加 / 阵列扫描 / 相位误差（Ruze）
// 物理模型（无魔法系数，公式见 utils/rf-math.js）：
//   AF(θ) = |Σ e^{j·i·(2π(d/λ)·sinθ + β)}|/N（均匀线阵，Balanis §6.3）
//   主瓣角 sinθ₀ = −β/(2π·d/λ)；HPBW ≈ 0.886λ/(N·d)；栅瓣判据 d/λ < 1/(1+|sinθ₀|)
//   Ruze：G/G₀ = exp(−δ_rms²)，δ 为口径相位误差 RMS（rad）

const haptic = require('../../../utils/haptic')
const rf = require('../../../utils/rf-math')
const lc = require('../../../utils/lab-canvas')
const { THEME, alpha, divergeColor } = require('../../../utils/lab-theme')

const MODE_INFO = {
  phasor: {
    label: '相量叠加：同相增强，反相相消',
    note: '把每个单元的贡献画成相量：相位差 β 越接近 0，链越直、合成越长；β 增大链卷曲，幅度按 |sin(Nβ/2)/(N·sin(β/2))| 下降。满相干参考圆的半径就是 N 个相量拉直时的最大长度。',
  },
  array: {
    label: '阵列扫描：渐进相位补偿路径差',
    note: '主瓣不是被机械转过去的：渐进相位 β 选择了相干方向 sinθ₀ = −β/(2π·d/λ)。当 |β| > 2π·d/λ 时主瓣移出实空间（不可见区）；d/λ 超过栅瓣判据会出现第二个"主瓣"。',
  },
  focus: {
    label: '相位误差破坏聚焦：Ruze 公式',
    note: '反射面/口径各单元存在 RMS 相位误差 δ 时，峰值增益按 G/G₀ = exp(−δ²) 下降（δ 以弧度计）。下方方向图直接对比理想口径与含误差口径——误差不改变主瓣方向，但抬高副瓣、压低峰值。',
  },
}

// 固定误差样本序列（确定性、可复现；运行时归一为零均值、单位 RMS。
// 这不是物理系数，只是一组样本——物理量是 δ_rms，由滑杆决定）
const ERR_RAW = [0.86, -0.32, 0.54, -0.95, 0.18, -0.61, 0.73, -0.08, 0.41, -0.77, 0.29, -0.5]
function normErrors(n) {
  if (n <= 1) return [0]
  const a = ERR_RAW.slice(0, n)
  const mean = a.reduce((s, x) => s + x, 0) / n
  const c = a.map((x) => x - mean)
  const rms = Math.sqrt(c.reduce((s, x) => s + x * x, 0) / n) || 1
  return c.map((x) => x / rms)
}

Page({
  data: {
    S: { mode: 'phasor', phase: 45, spacing: 55, count: 6, err: 30 },
    modeLabel: MODE_INFO.phasor.label,
    noteText: MODE_INFO.phasor.note,
    stats: [],
  },

  onLoad() { this.update() },
  onReady() { this.update() },

  // ═══ 事件 ═══
  onPhase(e) { this.setData({ 'S.phase': e.detail.value }, () => this.update()) },
  onSpacing(e) { this.setData({ 'S.spacing': e.detail.value }, () => this.update()) },
  onCount(e) { this.setData({ 'S.count': e.detail.value }, () => this.update()) },
  onErr(e) { this.setData({ 'S.err': e.detail.value }, () => this.update()) },
  setMode(e) {
    const m = e.currentTarget.dataset.m
    const info = MODE_INFO[m]
    if (!info) return
    haptic.light()
    this.setData({ 'S.mode': m, modeLabel: info.label, noteText: info.note }, () => this.update())
  },

  // ═══ 物理 ═══
  vals() {
    const S = this.data.S
    return {
      mode: S.mode,
      beta: S.phase * Math.PI / 180,   // 渐进相位（rad）
      d: S.spacing / 100,              // d/λ
      n: S.count,
      delta: S.err * Math.PI / 180,    // 相位误差 RMS（rad）
    }
  },

  // 含单元相位误差的阵因子（宽边口径，误差 = errs[i]·δ）
  _afErr(theta, v, errs) {
    let re = 0, im = 0
    for (let i = 0; i < v.n; i++) {
      const psi = 2 * Math.PI * v.d * i * Math.sin(theta) + errs[i] * v.delta
      re += Math.cos(psi); im += Math.sin(psi)
    }
    return Math.hypot(re, im) / v.n
  },

  // 主瓣角：sinθ₀ = −β/(2π·d/λ)，|·|>1 时主瓣不可见
  _steer(v) {
    const s = -v.beta / (2 * Math.PI * v.d)
    if (Math.abs(s) > 1) return { visible: false }
    return { visible: true, theta0: Math.asin(s) }
  },

  // 含误差口径的峰值增益比（数值扫描 θ）
  _gainWithErrors(v) {
    const errs = normErrors(v.n)
    let peak = 0
    for (let i = 0; i <= 240; i++) {
      const th = -Math.PI / 2 + Math.PI * i / 240
      const af = this._afErr(th, v, errs)
      if (af > peak) peak = af
    }
    return peak * peak
  },

  _db(a) { return 20 * Math.log10(Math.max(a, 1e-4)) },

  // ═══ 读数 ═══
  update() {
    const v = this.vals()
    const stats = []
    if (v.mode === 'phasor') {
      const mag = rf.afUniform(v.n, v.beta)
      stats.push({ label: '归一化幅度 |sin(Nβ/2)/(N·sinβ/2)|', value: mag.toFixed(3), cls: 'tp-c-accent' })
      stats.push({
        label: '相干损失 20·lg|AF|',
        value: mag > 1e-4 ? (20 * Math.log10(mag)).toFixed(1) + ' dB' : '< −80 dB',
        cls: 'tp-c-indigo',
      })
    } else if (v.mode === 'array') {
      const st = this._steer(v)
      stats.push({
        label: '预测主瓣角 θ₀',
        value: st.visible ? (st.theta0 * 180 / Math.PI).toFixed(1) + '°' : '不可见（移出实空间）',
        cls: st.visible ? 'tp-c-accent' : 'tp-c-danger',
      })
      stats.push({
        label: 'HPBW ≈ 0.886λ/(N·d)（宽边）',
        value: (rf.hpbwUniformApprox(v.n, v.d) * 180 / Math.PI).toFixed(1) + '°',
        cls: 'tp-c-teal',
      })
      const lim = rf.gratingLobeLimit(st.visible ? st.theta0 : Math.PI / 2)
      stats.push({
        label: '栅瓣判据 d/λ < ' + lim.toFixed(2),
        value: v.d < lim ? '满足（无栅瓣）' : '不满足（有栅瓣）',
        cls: v.d < lim ? 'tp-c-teal' : 'tp-c-danger',
      })
      stats.push({ label: '首副瓣电平（均匀加权，大 N）', value: '−13.3 dB', cls: 'tp-c-gold' })
    } else {
      const g = this._gainWithErrors(v)
      stats.push({ label: '相位误差 RMS δ', value: this.data.S.err + '°', cls: 'tp-c-indigo' })
      stats.push({ label: '峰值增益比（数值计算）', value: (g * 100).toFixed(1) + '%', cls: 'tp-c-accent' })
      stats.push({
        label: 'Ruze 预测 exp(−δ²)',
        value: (Math.exp(-v.delta * v.delta) * 100).toFixed(1) + '%',
        cls: 'tp-c-teal',
      })
      stats.push({
        label: '增益损失',
        value: (-10 * Math.log10(Math.max(g, 1e-6))).toFixed(2) + ' dB',
        cls: 'tp-c-gold',
      })
    }
    this.setData({ stats })
    this.draw()
  },

  // ═══ 绘制 ═══
  draw() {
    const v = this.vals()
    lc.mount(this, '#mainCanvas', (ctx, w, h) => {
      lc.clear(ctx, w, h)
      if (v.mode === 'phasor') this._drawPhasor(ctx, w, h, v)
      else if (v.mode === 'array') this._drawArray(ctx, w, h, v)
      else this._drawFocus(ctx, w, h, v)
    })
    lc.mount(this, '#patternCanvas', (ctx, w, h) => {
      lc.clear(ctx, w, h)
      this._drawPattern(ctx, w, h, v)
    })
  },

  // ── 模式 1：相量链（Re/Im 轴 + 满相干参考圆）──
  _drawPhasor(ctx, w, h, v) {
    const cx0 = w * 0.5, cy0 = h * 0.56
    const R = Math.min(w, h) * 0.4       // 满相干圆半径 = N·step（合成相量最大长度）
    // Re/Im 轴
    ctx.strokeStyle = THEME.axis; ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(cx0 - R - 16, cy0); ctx.lineTo(cx0 + R + 16, cy0)
    ctx.moveTo(cx0, cy0 - R - 14); ctx.lineTo(cx0, cy0 + R * 0.4)
    ctx.stroke()
    lc.label(ctx, 'Re', cx0 + R + 4, cy0 + 14, { color: THEME.muted, font: THEME.fontTick })
    lc.label(ctx, 'Im', cx0 + 6, cy0 - R - 4, { color: THEME.muted, font: THEME.fontTick })
    // 满相干参考圆（半径 = 相量拉直的总长）
    ctx.save()
    ctx.setLineDash([5, 4]); ctx.strokeStyle = THEME.gridStrong; ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(cx0, cy0, R, 0, Math.PI * 2); ctx.stroke()
    ctx.restore()
    lc.label(ctx, '满相干 |AF| = 1', cx0 - R * 0.98, cy0 - R * 0.74, {
      color: THEME.muted, font: THEME.fontTick,
    })
    // 相量链：每步长 R/N、每步转 β
    const step = R / v.n
    let x = cx0, y = cy0
    ctx.lineCap = 'round'
    for (let i = 0; i < v.n; i++) {
      const a = i * v.beta
      const nx = x + step * Math.cos(a), ny = y - step * Math.sin(a)
      ctx.strokeStyle = THEME.teal; ctx.lineWidth = 2.5
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(nx, ny); ctx.stroke()
      lc.dot(ctx, nx, ny, THEME.teal, 2.5)
      x = nx; y = ny
    }
    // 合成相量
    lc.arrow(ctx, cx0, cy0, x, y, THEME.accent, 3)
    const mag = Math.hypot(x - cx0, y - cy0) / R
    lc.label(ctx, '|AF| = ' + mag.toFixed(3), 14, 22, { color: THEME.ink, font: THEME.fontTitle })
    lc.legend(ctx, [
      { name: '单元相量（每步转 β）', color: THEME.teal },
      { name: '合成相量', color: THEME.accent },
    ], 14, h - 14)
  },

  // ── 模式 2：阵列波前（波纹间距 = λ，几何上可读出路径差）──
  _drawArray(ctx, w, h, v) {
    const baseY = h * 0.64, x0 = 54, x1 = w - 54
    const dx = v.n > 1 ? (x1 - x0) / (v.n - 1) : 0
    const lamPix = v.d > 0 ? dx / v.d : dx   // 像素波长：阵元间距 dx 对应 d/λ 个波长
    const st = this._steer(v)
    // 球面波前（弧间距 = λ）
    for (let i = 0; i < v.n; i++) {
      const px = x0 + i * dx
      for (let k = 1; k <= 3; k++) {
        const r = k * lamPix
        if (r > h * 1.1) break
        ctx.strokeStyle = alpha(THEME.indigo, Math.max(0.1, 0.36 - 0.09 * k))
        ctx.lineWidth = 1.2
        ctx.beginPath(); ctx.arc(px, baseY, r, -Math.PI * 0.88, -Math.PI * 0.12); ctx.stroke()
      }
    }
    // 阵元 + 相位箭头（角度 = i·β）
    for (let i = 0; i < v.n; i++) {
      const px = x0 + i * dx
      lc.dot(ctx, px, baseY, THEME.teal, 4)
      const a = i * v.beta
      lc.arrow(ctx, px, baseY + 30, px + 20 * Math.cos(a), baseY + 30 - 20 * Math.sin(a), THEME.gold, 1.8)
    }
    lc.label(ctx, '弧间距 = λ', x0 + 2, baseY - lamPix - 5, { color: THEME.indigo, font: THEME.fontTick })
    // 主瓣方向（由 sinθ₀ = −β/(2π·d/λ) 决定）
    const cxm = (x0 + x1) / 2
    if (st.visible) {
      const L = h * 0.5
      const tx = cxm + L * Math.sin(st.theta0), ty = baseY - 8 - L * Math.cos(st.theta0)
      lc.arrow(ctx, cxm, baseY - 8, tx, ty, THEME.accent, 2.5)
      lc.label(ctx, 'θ₀ ≈ ' + (st.theta0 * 180 / Math.PI).toFixed(1) + '°',
        Math.min(w - 74, Math.max(10, tx + 6)), Math.max(16, ty + 4),
        { color: THEME.accent, font: THEME.fontTitle })
    } else {
      lc.label(ctx, '主瓣移出实空间（|β| > 2π·d/λ）', cxm, 22, {
        align: 'center', color: THEME.danger, font: THEME.fontTitle,
      })
    }
    lc.legend(ctx, [
      { name: '波前·间距λ', color: THEME.indigo },
      { name: '相位 i·β', color: THEME.gold },
      { name: '主瓣', color: THEME.accent },
    ], 14, h - 14)
  },

  // ── 模式 3：相位误差聚焦（确定性误差分布 + Ruze 读数）──
  _drawFocus(ctx, w, h, v) {
    const fpx = w / 2, fpy = 38
    const baseY = h - 56, x0 = 50, x1 = w - 50
    const dx = v.n > 1 ? (x1 - x0) / (v.n - 1) : 0
    const errs = normErrors(v.n)
    const mA = Math.max(1e-9, errs.reduce((m, e) => Math.max(m, Math.abs(e)), 0) * v.delta)
    // 焦点
    lc.dot(ctx, fpx, fpy, THEME.gold, 6)
    lc.label(ctx, '焦点', fpx + 12, fpy + 4, { color: THEME.gold, font: THEME.fontLabel })
    // 射线：颜色 = 该单元相位误差（靛蓝负 ↔ 赤陶正）
    for (let i = 0; i < v.n; i++) {
      const px = x0 + i * dx
      const err = errs[i] * v.delta
      ctx.strokeStyle = v.delta < 1e-9 ? alpha(THEME.teal, 0.6) : divergeColor(err / mA)
      ctx.lineWidth = 1.6
      ctx.beginPath(); ctx.moveTo(px, baseY); ctx.lineTo(fpx, fpy); ctx.stroke()
    }
    // 口径单元 + 每单元误差（度）
    for (let i = 0; i < v.n; i++) {
      const px = x0 + i * dx
      lc.dot(ctx, px, baseY, THEME.teal, 4)
      if (v.n <= 8) {
        const errDeg = errs[i] * this.data.S.err
        lc.label(ctx, (errDeg >= 0 ? '+' : '') + errDeg.toFixed(0) + '°', px, baseY + 20, {
          align: 'center', color: THEME.inkSoft, font: THEME.fontTick,
        })
      }
    }
    const g = this._gainWithErrors(v)
    lc.label(ctx, 'G/G₀ = ' + (g * 100).toFixed(1) + '%（Ruze ' +
      (Math.exp(-v.delta * v.delta) * 100).toFixed(1) + '%）',
      w - 12, 22, { align: 'right', color: THEME.ink, font: THEME.fontTitle })
    lc.legend(ctx, [
      { name: '相位误差 +', color: THEME.accent },
      { name: '相位误差 −', color: THEME.indigo },
    ], 14, h - 12)
  },

  // ── 方向图（dB 轴 + θ 刻度；focus 模式双曲线对比）──
  _drawPattern(ctx, w, h, v) {
    const box = { x: 46, y: 16, w: w - 62, h: h - 56 }
    const p = lc.plot(ctx, box, [-90, 90], [-40, 0])
    p.axes({
      xTicks: [-90, -60, -30, 0, 30, 60, 90],
      yTicks: [0, -10, -20, -30, -40],
      xFmt: (t) => t + '°',
      xLabel: 'θ（°，宽边 = 0）',
      yLabel: '|AF|  dB',
    })
    const N = 240
    const xs = [], ysMain = [], ysRef = []
    const errs = v.mode === 'focus' ? normErrors(v.n) : null
    for (let i = 0; i <= N; i++) {
      const thDeg = -90 + 180 * i / N
      const th = thDeg * Math.PI / 180
      xs.push(thDeg)
      if (v.mode === 'focus') {
        ysRef.push(this._db(rf.afUniform(v.n, 2 * Math.PI * v.d * Math.sin(th))))
        ysMain.push(this._db(this._afErr(th, v, errs)))
      } else {
        ysMain.push(this._db(rf.afUniform(v.n, 2 * Math.PI * v.d * Math.sin(th) + v.beta)))
      }
    }
    if (v.mode === 'focus') {
      p.line(xs, ysRef, THEME.teal, 2)
      p.area(xs, ysMain, THEME.accent, -40)
      p.line(xs, ysMain, THEME.accent, 2)
      lc.legend(ctx, [
        { name: '理想（δ=0）', color: THEME.teal },
        { name: '含相位误差', color: THEME.accent },
      ], box.x + 6, box.y + 10)
    } else {
      p.area(xs, ysMain, THEME.accent, -40)
      p.line(xs, ysMain, THEME.accent, 2)
      const st = this._steer(v)
      if (st.visible) {
        const deg = st.theta0 * 180 / Math.PI
        p.guideX(deg, alpha(THEME.accent, 0.55))
        lc.label(ctx, 'θ₀≈' + deg.toFixed(1) + '°',
          Math.min(box.x + box.w - 60, Math.max(box.x + 4, p.X(deg) + 4)), box.y + 12,
          { color: THEME.accent, font: THEME.fontLabel })
      } else {
        lc.label(ctx, '主瓣移出实空间（|β| > 2π·d/λ）', box.x + box.w / 2, box.y + 12, {
          align: 'center', color: THEME.danger, font: THEME.fontLabel,
        })
      }
      // 均匀阵首副瓣参考线
      p.guideY(-13.3, alpha(THEME.gold, 0.6))
      lc.label(ctx, '首副瓣 −13.3 dB', box.x + box.w - 4, p.Y(-13.3) - 5, {
        align: 'right', color: THEME.gold, font: THEME.fontTick,
      })
    }
  },

  onShareAppMessage() {
    return { title: '相位相干实验室', path: '/pages/interactive/phase-coherence-lab/phase-coherence-lab' }
  },
})

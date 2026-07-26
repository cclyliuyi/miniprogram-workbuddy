// pages/interactive/energy-flow-lab/energy-flow-lab.js —— 电磁能流账本实验室
// 三种模式：端口功率分账 / 近场·远场能流 / 电小天线 Chu 极限
// 物理模型（全部真实公式，见 utils/rf-math.js）：
//   反射 = |Γ|² = 10^(−RL/10)；接受 = 1 − |Γ|²
//   辐射 = η · 接受；热损耗 = (1−η) · 接受   —— 严格能量守恒
//   Qmin = 1/(ka)³ + 1/ka（Chu–McLean 无耗下界）；FBW ≈ (s−1)/(Q√s)

const haptic = require('../../../utils/haptic')
const rf = require('../../../utils/rf-math')
const lc = require('../../../utils/lab-canvas')
const { THEME, alpha } = require('../../../utils/lab-theme')

const MODE_LABELS = {
  budget: '端口功率分账 · 匹配好 ≠ 效率高',
  field: '能流的两种形态：往返储能 与 净流出',
  small: 'Chu–McLean 极限：越小，Q 越高，带宽越窄',
}
const NOTE_TEXTS = {
  budget: '回波损耗 RL 只决定反射掉多少（|Γ|² = 10^(−RL/10)）；进入天线的功率还要按辐射效率 η 分给辐射和热损耗。四项严格守恒：反射 + 热损耗 + 辐射 = 100%。',
  field: '以 r = λ/2π（辐射球半径）为界：近区能量在场与源之间往返交换（无功，双向箭头），远区能量以 Poynting 矢量净流出（有功辐射，单向箭头）。储能与每周期辐射能之比就是品质因数 Q。',
  small: '电尺寸 ka 越小，Qmin = 1/(ka)³ + 1/ka 增长越快（近场储能占比越大），相对带宽 FBW ≈ (s−1)/(Q√s) 越窄。损耗会把 Q 拉低到 η·Qmin —— 用效率换带宽。',
}

Page({
  data: {
    S: { mode: 'budget', rl: 10, eta: 70, ka100: 50 },
    stats: null,
    modeLabel: MODE_LABELS.budget,
    noteText: NOTE_TEXTS.budget,
  },

  onLoad() { this.update() },
  onReady() { this.update() },

  // ═══ 事件 ═══
  onRl(e) { this.setData({ 'S.rl': e.detail.value }, () => this.update()) },
  onEta(e) { this.setData({ 'S.eta': e.detail.value }, () => this.update()) },
  onKa(e) { this.setData({ 'S.ka100': e.detail.value }, () => this.update()) },
  setMode(e) {
    haptic.light()
    const mode = e.currentTarget.dataset.m
    this.setData({
      'S.mode': mode,
      modeLabel: MODE_LABELS[mode],
      noteText: NOTE_TEXTS[mode],
    }, () => this.draw())
  },

  // ═══ 物理（无魔法系数）═══
  values() {
    const S = this.data.S
    const eta = S.eta / 100
    const ka = S.ka100 / 100
    const gamma2 = Math.pow(10, -S.rl / 10)   // |Γ|²
    const reflected = gamma2
    const accepted = 1 - gamma2
    const radiated = accepted * eta
    const heat = accepted * (1 - eta)
    const qMin = rf.chuQmin(ka)               // 无耗下界
    const q = Math.max(1, eta * qMin)         // 含损 Q ≈ η·Qmin
    const fbw = Math.min(1, rf.fbwFromQ(q, 2)) // VSWR≤2 相对带宽
    return { eta, ka, reflected, accepted, radiated, heat, qMin, q, fbw }
  },

  update() {
    const v = this.values()
    this.setData({
      stats: {
        reflected: (v.reflected * 100).toFixed(1) + '%',
        heat: (v.heat * 100).toFixed(1) + '%',
        radiated: (v.radiated * 100).toFixed(1) + '%',
        qfbw: 'Q≈' + (v.q >= 100 ? v.q.toFixed(0) : v.q.toFixed(1)) +
          ' · FBW≈' + (v.fbw * 100).toFixed(1) + '%',
      },
    })
    this.draw()
  },

  // ═══ 绘制 ═══
  draw() {
    lc.mount(this, '#mainCanvas', (ctx, w, h) => {
      lc.clear(ctx, w, h)
      const v = this.values()
      const mode = this.data.S.mode
      if (mode === 'budget') this._drawBudget(ctx, w, h, v)
      else if (mode === 'field') this._drawField(ctx, w, h, v)
      else this._drawSmall(ctx, w, h, v)
    })
  },

  // ── 模式 1：功率分账（真实守恒的预算条图）──
  _drawBudget(ctx, w, h, v) {
    const x0 = 96, x1 = w - 78
    const bw = x1 - x0
    const rows = [
      { name: '输入', frac: 1, color: THEME.inkSoft, y: 36 },
      { name: '反射', frac: v.reflected, color: THEME.gold, y: h * 0.34, note: '|Γ|²' },
      { name: '热损耗', frac: v.heat, color: THEME.accent, y: h * 0.55, note: '(1−η)·接受' },
      { name: '辐射', frac: v.radiated, color: THEME.teal, y: h * 0.76, note: 'η·接受' },
    ]
    // 输入 → 三路的引导线
    ctx.strokeStyle = THEME.grid
    ctx.lineWidth = 1
    rows.slice(1).forEach((r) => {
      ctx.beginPath()
      ctx.moveTo(x0 + 8, rows[0].y + 22)
      ctx.lineTo(x0 + 8, r.y + 9)
      ctx.stroke()
    })
    rows.forEach((r, i) => {
      // 行名（左）
      lc.label(ctx, r.name, x0 - 10, r.y + 13, {
        align: 'right', color: THEME.inkSoft, font: THEME.fontNote,
      })
      // 底槽 + 数据条（4px 圆头）
      ctx.fillStyle = alpha('#20201c', 0.05)
      ctx.fillRect(x0, r.y, bw, 18)
      lc.barH(ctx, x0, r.y, Math.max(2, bw * r.frac), 18, i === 0 ? alpha('#20201c', 0.35) : r.color)
      // 数值直接标注（右）
      const pct = (r.frac * 100).toFixed(1) + '%'
      lc.label(ctx, pct, x1 + 8, r.y + 13, {
        color: THEME.ink, font: THEME.fontTitle,
      })
      // 公式小注
      if (r.note) {
        lc.label(ctx, r.note, x0 + 4, r.y + 32, {
          color: THEME.muted, font: THEME.fontTick,
        })
      }
    })
    // 守恒校验行
    lc.label(ctx, '守恒校验：' + (v.reflected * 100).toFixed(1) + ' + ' +
      (v.heat * 100).toFixed(1) + ' + ' + (v.radiated * 100).toFixed(1) + ' = 100%',
      w / 2, h - 12, { align: 'center', color: THEME.muted, font: THEME.fontLabel })
  },

  // ── 模式 2：近场储能 vs 远场辐射 ──
  _drawField(ctx, w, h, v) {
    const cx = w * 0.5, cy = h * 0.46
    const rNear = Math.min(w, h) * 0.17      // 辐射球 r = λ/2π
    const rMax = Math.min(w, h) * 0.44

    // 近区底色
    ctx.fillStyle = alpha(THEME.indigo, 0.06)
    ctx.beginPath(); ctx.arc(cx, cy, rNear, 0, Math.PI * 2); ctx.fill()
    // 辐射球边界（虚线）
    ctx.save()
    ctx.setLineDash([5, 4])
    ctx.strokeStyle = alpha(THEME.indigo, 0.55)
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.arc(cx, cy, rNear, 0, Math.PI * 2); ctx.stroke()
    ctx.restore()
    // 等相位面（远区）
    ctx.strokeStyle = THEME.grid
    for (let r = rNear + 26; r <= rMax; r += 26) {
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
    }

    // 源（偶极子）
    ctx.strokeStyle = THEME.ink
    ctx.lineWidth = 3; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(cx, cy - 9); ctx.lineTo(cx, cy + 9); ctx.stroke()

    // 近区：双向往返箭头（无功储能），强度 ∝ Q 指示
    const qNorm = Math.min(1, Math.log10(Math.max(1, v.qMin)) / 3) // 0..1
    const nReact = 6
    for (let i = 0; i < nReact; i++) {
      const a = Math.PI * 2 * i / nReact + Math.PI / nReact
      const r1 = rNear * 0.42, r2 = rNear * 0.86
      const c = alpha(THEME.indigo, 0.35 + 0.5 * qNorm)
      lc.arrow(ctx, cx + r1 * Math.cos(a), cy + r1 * Math.sin(a),
        cx + r2 * Math.cos(a), cy + r2 * Math.sin(a), c, 1.5)
      lc.arrow(ctx, cx + r2 * Math.cos(a + 0.16), cy + r2 * Math.sin(a + 0.16),
        cx + r1 * Math.cos(a + 0.16), cy + r1 * Math.sin(a + 0.16), c, 1.5)
    }
    // 远区：单向外流箭头（有功辐射），长度 ∝ 辐射份额
    const nRad = 12
    for (let i = 0; i < nRad; i++) {
      const a = Math.PI * 2 * i / nRad
      const r1 = rNear + 12
      const r2 = r1 + 16 + (rMax - r1 - 16) * v.radiated
      lc.arrow(ctx, cx + r1 * Math.cos(a), cy + r1 * Math.sin(a),
        cx + r2 * Math.cos(a), cy + r2 * Math.sin(a),
        alpha(THEME.teal, 0.5 + 0.5 * v.radiated), 2)
    }

    // 标注
    lc.label(ctx, 'r = λ/2π', cx + rNear * 0.72, cy - rNear - 6, {
      color: THEME.indigo, font: THEME.fontLabel,
    })
    lc.legend(ctx, [
      { name: '近区储能（无功往返）', color: THEME.indigo },
      { name: '远区辐射（净流出 ' + (v.radiated * 100).toFixed(0) + '%）', color: THEME.teal },
    ], 14, h - 16)
    lc.label(ctx, '储能/每周期辐射 ≈ Q ≈ ' + (v.q >= 100 ? v.q.toFixed(0) : v.q.toFixed(1)),
      w - 14, 20, { align: 'right', color: THEME.inkSoft, font: THEME.fontLabel })
  },

  // ── 模式 3：Chu–McLean Q 极限（对数轴真曲线）──
  _drawSmall(ctx, w, h, v) {
    const box = { x: 52, y: 26, w: w - 70, h: h - 70 }
    const p = lc.plot(ctx, box, [0.1, 1.2], [0, 3])   // y = log10(Q) ∈ [1, 1000]
    p.axes({
      xTicks: [0.2, 0.4, 0.6, 0.8, 1.0, 1.2],
      yTicks: [0, 1, 2, 3],
      yFmt: (t) => ['1', '10', '100', '1000'][t] || '',
      xLabel: 'ka（电尺寸）',
      yLabel: 'Q（对数）',
    })

    const N = 160
    const xs = [], ysMin = [], ysEta = []
    for (let i = 0; i <= N; i++) {
      const ka = 0.1 + 1.1 * i / N
      xs.push(ka)
      ysMin.push(Math.log10(rf.chuQmin(ka)))
      ysEta.push(Math.log10(Math.max(1, v.eta * rf.chuQmin(ka))))
    }
    p.area(xs, ysMin, THEME.accent, 0)
    p.line(xs, ysMin, THEME.accent, 2)
    // 含损曲线（η·Qmin）虚线
    ctx.save(); ctx.setLineDash([5, 4])
    p.line(xs, ysEta, THEME.teal, 2)
    ctx.restore()

    // 当前点 + 参考虚线
    const qNow = rf.chuQmin(v.ka)
    p.guideX(v.ka)
    p.guideY(Math.log10(qNow))
    p.dot(v.ka, Math.log10(qNow), THEME.accent)

    lc.label(ctx, 'Qmin（无耗下界）', p.X(0.16), p.Y(Math.log10(rf.chuQmin(0.16))) - 10, {
      color: THEME.accent, font: THEME.fontLabel,
    })
    lc.label(ctx, 'η·Qmin（η=' + Math.round(v.eta * 100) + '%）',
      p.X(0.52), p.Y(Math.log10(Math.max(1, v.eta * rf.chuQmin(0.52)))) + 16, {
      color: THEME.teal, font: THEME.fontLabel,
    })
    lc.label(ctx, 'ka=' + v.ka.toFixed(2) + ' → Qmin≈' +
      (qNow >= 100 ? qNow.toFixed(0) : qNow.toFixed(1)) +
      ' · FBW≈' + (v.fbw * 100).toFixed(1) + '%',
      box.x + box.w, box.y - 8, { align: 'right', color: THEME.ink, font: THEME.fontTitle })
  },

  onShareAppMessage() {
    return { title: '电磁能流账本实验室', path: '/pages/interactive/energy-flow-lab/energy-flow-lab' }
  },
})

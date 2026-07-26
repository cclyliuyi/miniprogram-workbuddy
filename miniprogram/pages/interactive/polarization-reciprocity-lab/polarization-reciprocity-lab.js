// pages/interactive/polarization-reciprocity-lab/polarization-reciprocity-lab.js —— 极化与互易实验室
// 三种模式：极化椭圆 / 接收投影（时间平均 PLF）/ 收发互易（S21=S12 数值验证）
// 物理模型（真实公式，见 utils/rf-math.js；Balanis《Antenna Theory》4th §4.4、§2.12.2）：
//   瞬时场：Ex = E₁cos(ωt)，Ey = E₂cos(ωt+δ)，r = E₂/E₁
//   椭圆长短轴/倾角/轴比：rf.polarizationEllipse（sin2ε = 2r·sinδ/(1+r²)，AR = cotε）
//   旋向：波沿 +z（出屏）传播，sinδ>0 → 左旋 LH，sinδ<0 → 右旋 RH（IEEE 约定）
//   时间平均 PLF = ⟨(E·û)²⟩/⟨|E|²⟩ = (cos²ψ + r²sin²ψ + r·sin2ψ·cosδ)/(1+r²)
//   互易（线极化对）：C = cos²(ψA−ψB)，双向独立计算数值相等 → S21 = S12

const haptic = require('../../../utils/haptic')
const rf = require('../../../utils/rf-math')
const lc = require('../../../utils/lab-canvas')
const { THEME } = require('../../../utils/lab-theme')

const MODE_INFO = {
  ellipse: {
    label: '电场端点轨迹：幅度比 r 与相位差 δ 决定极化态',
    note: '线、圆、椭圆极化都来自两个正交分量的幅度比和相位差：δ=0/±180° 时无论 r 多大都是线极化；r=1 且 δ=±90° 才是圆极化；其余为椭圆极化。椭圆率角 ε 把三者放到同一把尺上：sin2ε = 2r·sinδ/(1+r²)，AR = cotε。',
  },
  match: {
    label: '接收投影：有意义的读数是时间平均 PLF',
    note: '线极化接收天线只"收下"电场在其取向 û 上的分量。瞬时投影随 ωt 摆动（画面上的青绿线段），有物理意义的是时间平均功率比 PLF = ⟨(E·û)²⟩/⟨|E|²⟩：线极化对线极化失配角 ψ 给出 cos²ψ；圆极化波被线极化天线接收恒为 1/2（−3 dB）。',
  },
  reciprocity: {
    label: '互易：A→B 与 B→A 耦合严格相等（S21 = S12）',
    note: '把两副线极化天线转到任意取向 ψA、ψB，正反两个方向的极化耦合都是 cos²(ψA−ψB)，数值完全相同——这是洛伦兹互易定理的体现：线性、各向同性介质中 S21 = S12，同一副天线的发射方向图与接收方向图也因此相同。',
  },
}

Page({
  data: {
    S: { mode: 'ellipse', ratio: 75, phase: 90, angle: 25, angleB: -20 },
    ratioTxt: '0.75',
    modeLabel: MODE_INFO.ellipse.label,
    noteText: MODE_INFO.ellipse.note,
    stats: null,
  },

  _t: 0,
  _timer: null,
  _cv: null,

  onLoad() { this.updateStats() },
  onReady() { this.updateStats() },
  onShow() { this._cv = null; this._startAnim() },
  onHide() { this._stopAnim() },
  onUnload() { this._stopAnim() },

  _startAnim() {
    if (this._timer) return
    this._timer = setInterval(() => { this._t += 0.06; this.draw() }, 50)
  },
  _stopAnim() { if (this._timer) { clearInterval(this._timer); this._timer = null } },

  // ═══ 事件 ═══
  onRatio(e) { this.setData({ 'S.ratio': e.detail.value }, () => this.updateStats()) },
  onPhase(e) { this.setData({ 'S.phase': e.detail.value }, () => this.updateStats()) },
  onAngle(e) { this.setData({ 'S.angle': e.detail.value }, () => this.updateStats()) },
  onAngleB(e) { this.setData({ 'S.angleB': e.detail.value }, () => this.updateStats()) },
  setMode(e) {
    haptic.light()
    const m = e.currentTarget.dataset.m
    if (!MODE_INFO[m]) return
    this.setData({
      'S.mode': m, modeLabel: MODE_INFO[m].label, noteText: MODE_INFO[m].note,
    }, () => this.updateStats())
  },

  // ═══ 物理（无魔法系数）═══
  vals() {
    const S = this.data.S
    return {
      ratio: S.ratio / 100,
      delta: S.phase * Math.PI / 180,
      psi: S.angle * Math.PI / 180,
      psiB: S.angleB * Math.PI / 180,
      deltaDeg: S.phase, psiDeg: S.angle, psiBDeg: S.angleB,
    }
  },

  _phys(v) {
    // 椭圆参数（Balanis §4.4）：长短轴、倾角 tan2τ = 2r·cosδ/(1−r²)、轴比
    const pe = rf.polarizationEllipse(1, v.ratio, v.delta)
    const epsDeg = Math.atan2(pe.minor, pe.major) * 180 / Math.PI // 椭圆率角 |ε| ∈ [0°,45°]
    let type = '椭圆极化'
    if (epsDeg < 3) type = '线极化'          // 判别阈值见公式注脚
    else if (epsDeg > 42) type = '圆极化'
    const lh = Math.sin(v.delta) > 0          // +z 出屏：sinδ>0 → LH（IEEE）
    const hand = type === '线极化' ? '—' : (lh ? '左旋 LH' : '右旋 RH')
    // 时间平均 PLF（线极化接收天线，取向 ψ）
    const r = v.ratio
    const cp = Math.cos(v.psi), sp = Math.sin(v.psi)
    const plf = (cp * cp + r * r * sp * sp + r * Math.sin(2 * v.psi) * Math.cos(v.delta)) / (1 + r * r)
    // 互易：双向耦合各自独立计算（数值必然相等 → S21=S12）
    const dAB = (v.psiDeg - v.psiBDeg) * Math.PI / 180
    const cAB = Math.pow(Math.cos(dAB), 2)
    const cBA = Math.pow(Math.cos(-dAB), 2)
    const dpsiDeg = Math.abs(v.psiDeg - v.psiBDeg)
    const dpsiFold = dpsiDeg > 90 ? 180 - dpsiDeg : dpsiDeg
    return {
      pe, epsDeg, type, hand, lh,
      tauDeg: pe.tilt * 180 / Math.PI,
      arDb: pe.arDb,
      plf: Math.min(1, Math.max(0, plf)),
      dpsiDeg, dpsiFold, cAB, cBA,
    }
  },

  _db(x) { return x > 1e-4 ? (10 * Math.log10(x)).toFixed(1) + ' dB' : '≤ −40 dB' },

  updateStats() {
    const v = this.vals()
    const d = this._phys(v)
    this.setData({
      ratioTxt: v.ratio.toFixed(2),
      stats: {
        type: d.type,
        hand: d.hand,
        ar: isFinite(d.arDb) ? d.arDb.toFixed(1) + ' dB' : '∞',
        tau: d.type === '圆极化' ? '—' : d.tauDeg.toFixed(1) + '°',
        plf: d.plf.toFixed(3) + '（' + this._db(d.plf) + '）',
        dpsi: d.dpsiDeg.toFixed(0) + '°',
        cAB: this._db(d.cAB),
        cBA: this._db(d.cBA),
      },
    })
    this.draw()
  },

  // ═══ 绘制 ═══
  draw() {
    if (this._cv) { this._render(this._cv.ctx, this._cv.w, this._cv.h); return }
    lc.mount(this, '#mainCanvas', (ctx, w, h) => {
      this._cv = { ctx, w, h }
      this._render(ctx, w, h)
    })
  },

  _render(ctx, w, h) {
    lc.clear(ctx, w, h)
    const v = this.vals()
    const d = this._phys(v)
    if (this.data.S.mode === 'reciprocity') this._drawRecip(ctx, w, h, v, d)
    else this._drawEllipse(ctx, w, h, v, d, this.data.S.mode === 'match')
  },

  // ── 模式 1/2：极化椭圆（等比坐标，含旋向与瞬时投影）──
  _drawEllipse(ctx, w, h, v, d, showMatch) {
    const L = Math.min(w - 116, h - 58)          // 等比方形绘图区：圆极化必须画成圆
    const box = { x: (w - L) / 2, y: 10, w: L, h: L }
    const p = lc.plot(ctx, box, [-1.8, 1.8], [-1.8, 1.8])
    p.axes({
      xTicks: [-1, 0, 1], yTicks: [-1, 0, 1],
      xLabel: 'Ex/E₁（归一化）', yLabel: 'Ey/E₁',
    })
    p.guideX(0); p.guideY(0)

    const pt = (t) => ({ x: Math.cos(t), y: v.ratio * Math.cos(t + v.delta) })

    // 长轴方向（倾角 τ，圆极化无定义）
    if (d.type !== '圆极化') {
      const mx = d.pe.major * Math.cos(d.pe.tilt), my = d.pe.major * Math.sin(d.pe.tilt)
      ctx.save(); ctx.setLineDash([4, 4]); ctx.lineWidth = 1; ctx.strokeStyle = THEME.gridStrong
      ctx.beginPath(); ctx.moveTo(p.X(-mx), p.Y(-my)); ctx.lineTo(p.X(mx), p.Y(my)); ctx.stroke()
      ctx.restore()
      lc.label(ctx, 'τ=' + d.tauDeg.toFixed(0) + '°', p.X(mx) + 4, p.Y(my) - 4, {
        color: THEME.muted, font: THEME.fontTick,
      })
    }

    // 端点轨迹（极化椭圆）
    const xs = [], ys = []
    for (let i = 0; i <= 180; i++) {
      const q = pt(Math.PI * 2 * i / 180); xs.push(q.x); ys.push(q.y)
    }
    p.line(xs, ys, THEME.accent, 2)

    // 旋向：沿时间方向的小箭头 + 文字标注
    if (d.type !== '线极化') {
      ;[0.8, 0.8 + Math.PI].forEach((t0) => {
        const a = pt(t0), b = pt(t0 + 0.26)
        lc.arrow(ctx, p.X(a.x), p.Y(a.y), p.X(b.x), p.Y(b.y), THEME.accent, 2)
      })
      lc.label(ctx, d.hand + (d.lh ? '（屏上顺时针）' : '（屏上逆时针）'),
        box.x + 2, box.y + 12, { color: THEME.inkSoft, font: THEME.fontLabel })
    }
    lc.label(ctx, 'AR=' + (isFinite(d.arDb) ? d.arDb.toFixed(1) + ' dB' : '∞'),
      box.x + box.w, box.y + 12, { align: 'right', color: THEME.ink, font: THEME.fontTitle })

    // 瞬时电场矢量 E(t)（动画）
    const q = pt(this._t)
    lc.arrow(ctx, p.X(0), p.Y(0), p.X(q.x), p.Y(q.y), THEME.gold, 2.5)

    const items = [{ name: '轨迹', color: THEME.accent }, { name: 'E(t)', color: THEME.gold }]
    if (showMatch) {
      // 接收天线取向 û
      const ux = Math.cos(v.psi), uy = Math.sin(v.psi)
      lc.arrow(ctx, p.X(-1.7 * ux), p.Y(-1.7 * uy), p.X(1.7 * ux), p.Y(1.7 * uy), THEME.indigo, 2)
      lc.label(ctx, 'ψ=' + v.psiDeg + '°', p.X(1.45 * ux) + 6, p.Y(1.45 * uy) - 6, {
        color: THEME.indigo, font: THEME.fontLabel,
      })
      // 瞬时投影（青绿，与赤陶轨迹区分）——仅作动画演示
      const s = q.x * ux + q.y * uy
      ctx.strokeStyle = THEME.teal; ctx.lineWidth = 4; ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(p.X(0), p.Y(0)); ctx.lineTo(p.X(s * ux), p.Y(s * uy)); ctx.stroke()
      lc.dot(ctx, p.X(s * ux), p.Y(s * uy), THEME.teal, 3.5)
      // 数字读数用时间平均 PLF
      lc.label(ctx, 'PLF=' + d.plf.toFixed(2) + '（时间平均）', box.x + box.w, box.y + 27, {
        align: 'right', color: THEME.teal, font: THEME.fontLabel,
      })
      items.push({ name: 'û 方向', color: THEME.indigo }, { name: '瞬时投影', color: THEME.teal })
    }
    lc.legend(ctx, items, 14, h - 10)
  },

  // ── 模式 3：收发互易（独立取向 + 双向耦合数值验证 + cos²Δψ 曲线）──
  _drawRecip(ctx, w, h, v, d) {
    const ay = h * 0.19
    const Ax = w * 0.24, Bx = w * 0.76
    // 双向链路箭头（金色）+ 各自独立计算的耦合读数
    lc.arrow(ctx, Ax + 42, ay - 9, Bx - 42, ay - 9, THEME.gold, 1.5)
    lc.arrow(ctx, Bx - 42, ay + 9, Ax + 42, ay + 9, THEME.gold, 1.5)
    const mid = (Ax + Bx) / 2
    lc.label(ctx, 'A→B  ' + this._db(d.cAB), mid, ay - 15, {
      align: 'center', color: THEME.ink, font: THEME.fontLabel,
    })
    lc.label(ctx, 'B→A  ' + this._db(d.cBA), mid, ay + 24, {
      align: 'center', color: THEME.ink, font: THEME.fontLabel,
    })
    // 两副线极化天线，取向角独立可调
    const ant = (cx, psi, color, name) => {
      const dx = 26 * Math.cos(psi), dy = 26 * Math.sin(psi)
      ctx.strokeStyle = color; ctx.lineWidth = 3.5; ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(cx - dx, ay + dy); ctx.lineTo(cx + dx, ay - dy); ctx.stroke()
      lc.dot(ctx, cx, ay, color, 3)
      lc.label(ctx, name, cx, ay + 40, { align: 'center', color, font: THEME.fontLabel })
    }
    ant(Ax, v.psi, THEME.indigo, 'A · ψA=' + v.psiDeg + '°')
    ant(Bx, v.psiB, THEME.teal, 'B · ψB=' + v.psiBDeg + '°')
    lc.label(ctx, '双向数值相等 → S21 = S12（洛伦兹互易）', w / 2, ay + 58, {
      align: 'center', color: THEME.muted, font: THEME.fontNote,
    })

    // 耦合曲线 C(Δψ) = cos²Δψ（随两个取向角实时变化）
    const box = { x: 56, y: h * 0.50, w: w - 76, h: h * 0.32 }
    const p = lc.plot(ctx, box, [0, 90], [0, 1])
    p.axes({
      xTicks: [0, 30, 60, 90], yTicks: [0, 0.5, 1],
      xLabel: 'Δψ（°）', yLabel: '极化耦合 C（线性）',
    })
    const xs = [], ys = []
    for (let i = 0; i <= 90; i++) { xs.push(i); ys.push(Math.pow(Math.cos(i * Math.PI / 180), 2)) }
    p.line(xs, ys, THEME.teal, 2)
    p.guideX(d.dpsiFold)
    p.dot(d.dpsiFold, d.cAB, THEME.teal)
    lc.label(ctx, 'C = cos²Δψ', p.X(14), p.Y(Math.pow(Math.cos(14 * Math.PI / 180), 2)) - 8, {
      color: THEME.teal, font: THEME.fontLabel,
    })
    lc.label(ctx, 'Δψ=' + d.dpsiFold.toFixed(0) + '° → C=' + d.cAB.toFixed(3),
      box.x + box.w, box.y - 6, { align: 'right', color: THEME.ink, font: THEME.fontTitle })
  },

  onShareAppMessage() {
    return { title: '极化与互易实验室', path: '/pages/interactive/polarization-reciprocity-lab/polarization-reciprocity-lab' }
  },
})

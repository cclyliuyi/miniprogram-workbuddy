// pages/interactive/radiation-integral/radiation-integral.js —— 辐射积分可视化
// 物理（Balanis Ch.4/12 线源，全部真实公式）：
//   空间因子 F(θ) = ∫ I(z′) e^{jkz′cosθ} dz′（z′ 以 λ 计，k = 2π/λ）
//   总方向图 = 元因子 |sinθ| × |F(θ)|（方向图乘积定理）
//   数值积分：复化梯形法（端点权 0.5），N = 180
//   驻波分布 I(z′) = sin(k(L/2 − |z′|))——真实偶极子驻波电流，随 L 变化
const haptic = require('../../../utils/haptic')
const lc = require('../../../utils/lab-canvas')
const { THEME, alpha, rampColor } = require('../../../utils/lab-theme')

const TAPER_LABELS = {
  uniform: '均匀',
  dipole: '驻波（偶极子）',
  tri: '三角',
  cos2: '余弦平方锥削',
}

Page({
  data: {
    S: { L100: 50, taper: 'dipole', theta: 90 },
    stats: null,
  },

  _animStep: 0,
  _animRunning: true,
  _timer: null,
  _pts: null,
  _pattern: null,
  _bwStr: '',
  _cache: null,

  onLoad() { this._cache = {}; this.update() },
  onReady() { this._cache = {}; this.update() },
  onShow() { this._startAnim() },
  onHide() { this._stopAnim() },
  onUnload() { this._stopAnim() },

  // ═══ 事件 ═══
  onLen(e) { this.setData({ 'S.L100': e.detail.value }, () => this.update()) },
  onTheta(e) { this.setData({ 'S.theta': e.detail.value }, () => this.update()) },
  setTaper(e) {
    const t = e.currentTarget.dataset.t
    if (!TAPER_LABELS[t]) return
    haptic.light()
    this.setData({ 'S.taper': t }, () => this.update())
  },
  toggleAnim() {
    haptic.light()
    this._animRunning = !this._animRunning
    this.drawIntegral()
  },

  // ═══ 动画：单向扫描，只重绘积分图（节点已缓存，不再每帧 query）═══
  _startAnim() {
    if (this._timer) return
    this._timer = setInterval(() => {
      if (!this._animRunning) return
      const n = this._pts ? this._pts.length : 121
      this._animStep = (this._animStep + 2) % n
      this.drawIntegral()
    }, 50)
  },
  _stopAnim() {
    if (this._timer) { clearInterval(this._timer); this._timer = null }
  },
  _mount(key, sel, cb) {
    const c = this._cache && this._cache[key]
    if (c) { cb(c.ctx, c.w, c.h); return }
    lc.mount(this, sel, (ctx, w, h) => {
      if (!this._cache) this._cache = {}
      this._cache[key] = { ctx, w, h }
      cb(ctx, w, h)
    })
  },

  // ═══ 物理 ═══
  L() { return this.data.S.L100 / 100 },
  // 电流分布 I(z′)，z′ 以 λ 计；驻波分布可为负（相位反转段）
  amp(z) {
    const S = this.data.S
    const half = this.L() / 2
    if (Math.abs(z) > half + 1e-12) return 0
    const u = half > 0 ? Math.abs(z) / half : 0
    if (S.taper === 'uniform') return 1
    if (S.taper === 'tri') return 1 - u
    if (S.taper === 'cos2') return 0.5 + 0.5 * Math.cos(Math.PI * u) // = cos²(πu/2)
    return Math.sin(2 * Math.PI * (half - Math.abs(z)))              // sin(k(L/2−|z′|))，k=2π/λ
  },
  // 总方向图幅度 = |sinθ| × |F(θ)|，复化梯形法 N=180
  field(thetaDeg) {
    const th = thetaDeg * Math.PI / 180
    const Lam = this.L()
    const N = 180, dz = Lam / N
    let re = 0, im = 0
    for (let i = 0; i <= N; i++) {
      const z = -Lam / 2 + i * dz
      const a = this.amp(z)
      const ph = 2 * Math.PI * z * Math.cos(th)
      const w = (i === 0 || i === N) ? 0.5 : 1
      re += w * a * Math.cos(ph) * dz
      im += w * a * Math.sin(ph) * dz
    }
    return Math.abs(Math.sin(th)) * Math.hypot(re, im)
  },
  // 累积部分和（Cornu 螺线采样，供复平面动画）
  sampleIntegral(thetaDeg, nSteps) {
    const th = thetaDeg * Math.PI / 180
    const Lam = this.L()
    const N = nSteps, dz = Lam / N
    const pts = []
    let re = 0, im = 0
    for (let i = 0; i <= N; i++) {
      const z = -Lam / 2 + i * dz
      const a = this.amp(z)
      const ph = 2 * Math.PI * z * Math.cos(th)
      re += a * Math.cos(ph) * dz
      im += a * Math.sin(ph) * dz
      pts.push({ z, amp: a, re, im, mag: Math.hypot(re, im) })
    }
    return pts
  },

  // ═══ 更新 ═══
  update() {
    const S = this.data.S
    // 方向图采样：θ ∈ [0°,180°]，步距 0.5°
    const raw = []
    let peak = 1e-12, iPk = 0
    for (let i = 0; i <= 360; i++) {
      const v = this.field(i / 2)
      raw.push(v)
      if (v > peak) { peak = v; iPk = i }
    }
    const p = raw.map((v) => v / peak)
    this._pattern = p

    // HPBW：从全局峰值向两侧找 1/√2 交点
    const half = Math.SQRT1_2
    let l = iPk, r = iPk
    while (l > 0 && p[l] > half) l--
    while (r < p.length - 1 && p[r] > half) r++
    this._bwStr = ((r - l) * 0.5).toFixed(1) + '°'

    // SLL：先找第一零点（幅度开始回升处），零点外取最大；无旁瓣显示 —
    const nl = this._firstNull(p, iPk, -1)
    const nr = this._firstNull(p, iPk, 1)
    let sll = -1
    if (nl >= 0) for (let i = 0; i <= nl; i++) sll = Math.max(sll, p[i])
    if (nr >= 0) for (let i = nr; i < p.length; i++) sll = Math.max(sll, p[i])
    const sllStr = sll > 1e-4 ? (20 * Math.log10(sll)).toFixed(1) + ' dB' : '—'

    // θ 方向场强：相对方向图峰值归一化的 dB（有明确参考基准）
    const rel = 20 * Math.log10(Math.max(this.field(S.theta), 1e-9) / peak)
    const fieldStr = rel <= -60 ? '≤ −60 dB' : rel.toFixed(1) + ' dB'

    this._pts = this.sampleIntegral(S.theta, 120)
    const intVal = this._pts[this._pts.length - 1].mag.toFixed(3)

    this.setData({ stats: { bw: this._bwStr, sll: sllStr, field: fieldStr, intVal } })
    this.drawSource()
    this.drawIntegral()
    this.drawPattern()
  },
  // 第一零点：越过主瓣后（<0.5）幅度首次回升处
  _firstNull(p, iPk, dir) {
    for (let i = iPk + dir; i + dir >= 0 && i + dir < p.length; i += dir) {
      if (p[i] < 0.5 && p[i + dir] > p[i] + 1e-9) return i
    }
    return -1
  },

  // ═══ 图 1：电流分布 ═══
  drawSource() {
    this._mount('src', '#sourceCanvas', (ctx, w, h) => {
      lc.clear(ctx, w, h)
      const S = this.data.S
      const half = this.L() / 2
      const M = 200
      const xs = [], ys = []
      let maxA = 1e-9
      for (let i = 0; i <= M; i++) {
        const z = -half + 2 * half * i / M
        const a = this.amp(z)
        xs.push(z); ys.push(a)
        maxA = Math.max(maxA, Math.abs(a))
      }
      const yn = ys.map((v) => v / maxA)
      const signed = yn.some((v) => v < -1e-6)
      const box = { x: 52, y: 20, w: w - 70, h: h - 58 }
      const p = lc.plot(ctx, box, [-half, half], [signed ? -1 : 0, 1])
      p.axes({
        xTicks: [-half, -half / 2, 0, half / 2, half],
        xFmt: (v) => String(+v.toFixed(2)),
        yTicks: signed ? [-1, -0.5, 0, 0.5, 1] : [0, 0.5, 1],
        xLabel: 'z′（λ）',
        yLabel: 'I/Imax',
      })
      if (signed) p.guideY(0)
      p.area(xs, yn, THEME.accent, 0)
      p.line(xs, yn, THEME.accent, 2)
      lc.label(ctx, TAPER_LABELS[S.taper] || '', box.x + box.w - 4, box.y + 14, {
        align: 'right', color: THEME.accent, font: THEME.fontTitle,
      })
    })
  },

  // ═══ 图 2：复平面积分路径（真实累积和矢量）═══
  drawIntegral() {
    this._mount('intg', '#integralCanvas', (ctx, w, h) => {
      lc.clear(ctx, w, h)
      const S = this.data.S
      const pts = this._pts || (this._pts = this.sampleIntegral(S.theta, 120))
      const n = pts.length
      let m = 0.04
      for (const q of pts) m = Math.max(m, Math.abs(q.re), Math.abs(q.im))
      m *= 1.15
      const s = Math.min(w - 104, h - 72)
      const box = { x: (w - s) / 2, y: 14, w: s, h: s }
      const p = lc.plot(ctx, box, [-m, m], [-m, m])
      p.axes({ xLabel: 'Re', yLabel: 'Im' })
      p.guideX(0); p.guideY(0)

      // 完整 Cornu 螺线示廓（浅）
      p.line(pts.map((q) => q.re), pts.map((q) => q.im), alpha(THEME.ink, 0.16), 1.5)

      // 已累加采样点：点色 = 沿源位置 z′（∝ 相位 kz′cosθ），单向渐变
      const vis = Math.min(n - 1, this._animStep)
      for (let i = 0; i <= vis; i++) {
        const q = pts[i]
        ctx.fillStyle = rampColor(i / (n - 1))
        ctx.beginPath()
        ctx.arc(p.X(q.re), p.Y(q.im), 2 + Math.abs(q.amp) * 3, 0, Math.PI * 2)
        ctx.fill()
      }
      // 真实合成矢量：原点 → 当前累积和
      const cur = pts[vis]
      if (Math.hypot(cur.re, cur.im) > m * 0.01) {
        lc.arrow(ctx, p.X(0), p.Y(0), p.X(cur.re), p.Y(cur.im), THEME.accent, 2)
      }
      ctx.strokeStyle = THEME.gold; ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(p.X(cur.re), p.Y(cur.im), 6, 0, Math.PI * 2); ctx.stroke()

      // 完整积分终点
      const fin = pts[n - 1]
      p.dot(fin.re, fin.im, THEME.teal, 3.5)
      lc.label(ctx, '|F(θ)| = ' + fin.mag.toFixed(3), box.x + box.w, box.y - 4, {
        align: 'right', color: THEME.ink, font: THEME.fontTitle,
      })
      lc.label(ctx, 'θ = ' + S.theta + '°，cosθ = ' + Math.cos(S.theta * Math.PI / 180).toFixed(2),
        box.x + box.w - 4, box.y + 16, { align: 'right', color: THEME.inkSoft, font: THEME.fontLabel })

      // 色条图例：点色 = 源位置
      const ly = box.y + box.h + 34
      lc.label(ctx, '−L/2', 12, ly, { font: THEME.fontTick, color: THEME.inkSoft })
      for (let i = 0; i < 30; i++) {
        ctx.fillStyle = rampColor(i / 29)
        ctx.fillRect(44 + i * 2.6, ly - 8, 2.7, 8)
      }
      lc.label(ctx, '+L/2 · 点色 = 源位置 z′', 126, ly, { font: THEME.fontTick, color: THEME.inkSoft })

      // 播放/暂停角标
      ctx.fillStyle = alpha(THEME.ink, 0.4)
      if (this._animRunning) {
        ctx.fillRect(w - 28, 12, 4, 12); ctx.fillRect(w - 21, 12, 4, 12)
      } else {
        ctx.beginPath()
        ctx.moveTo(w - 28, 12); ctx.lineTo(w - 17, 18); ctx.lineTo(w - 28, 24)
        ctx.closePath(); ctx.fill()
      }
    })
  },

  // ═══ 图 3：远场方向图（极坐标 dB 环，角度轴 = θ−90°）═══
  drawPattern() {
    this._mount('pat', '#patternCanvas', (ctx, w, h) => {
      lc.clear(ctx, w, h)
      const S = this.data.S
      const p = this._pattern
      if (!p) return
      const cx = w / 2, cy = h - 28
      const R = Math.max(30, Math.min(w / 2 - 46, h - 66))
      lc.polarGrid(ctx, cx, cy, R, { rings: [0, -10, -20, -30] })
      const floor = -30
      const patDb = (th) => {
        const deg = th * 180 / Math.PI + 90
        const idx = Math.max(0, Math.min(360, Math.round(deg * 2)))
        return 20 * Math.log10(Math.max(p[idx], 1e-6))
      }
      lc.polarCurveDb(ctx, cx, cy, R, patDb, floor, THEME.accent, true)

      // 当前观测角标记（显示角 = θ−90°，0° = 宽边）
      const thd = (S.theta - 90) * Math.PI / 180
      const db = Math.max(floor, Math.min(0, 20 * Math.log10(Math.max(p[S.theta * 2], 1e-6))))
      const rr = R * (1 - db / floor)
      const mx = cx + rr * Math.sin(thd), my = cy - rr * Math.cos(thd)
      ctx.save()
      ctx.setLineDash([4, 4]); ctx.strokeStyle = THEME.gold; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(cx, cy)
      ctx.lineTo(cx + R * Math.sin(thd), cy - R * Math.cos(thd)); ctx.stroke()
      ctx.restore()
      lc.dot(ctx, mx, my, THEME.gold, 4)
      lc.label(ctx, 'θ = ' + S.theta + '°', mx, my - 10, { align: 'center', color: THEME.gold })

      lc.label(ctx, 'HPBW ≈ ' + this._bwStr, 12, 20, { color: THEME.ink, font: THEME.fontTitle })
      lc.label(ctx, '0 dB = 方向图峰值', 12, 36, { color: THEME.muted, font: THEME.fontTick })
      lc.legend(ctx, [{ name: '|sinθ|·|F(θ)|', color: THEME.accent }], 12, h - 12)
    })
  },

  onShareAppMessage() {
    return { title: '辐射积分可视化', path: '/pages/interactive/radiation-integral/radiation-integral' }
  },
})

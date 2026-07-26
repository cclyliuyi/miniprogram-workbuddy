// pages/interactive/moment-method/moment-method.js —— 矩量法实验室（真实求解）
// 物理模型（无魔法系数，长度以 λ 归一，k=2π）：
//   Hallén 积分方程：∫ I(z′) e^{−jkR}/(4πR) dz′ = (−j/η₀)[C₁cos kz + C₂sin kz + 特解]
//     · 馈电特解 (V₀/2)sin k|z−z_f|（δ-gap）；平面波特解 E₀/k（E∥导线）
//   脉冲基 + 点匹配 → 复数矩阵 [Z]{I}={b}，高斯消元真解；
//   C₁、C₂ 由两端电流为零（线性外推）确定；Z_in = V₀/I(z_f)
//   远场：F(θ) = |sinθ · Σ Iₙ e^{jk zₙ cosθ}|（θ 从偶极子轴量起）
//   条件数：κ₁ = ‖Z‖₁·‖Z⁻¹‖₁（由完整逆矩阵计算，非元素比值）

const haptic = require('../../../utils/haptic')
const rf = require('../../../utils/rf-math')
const lc = require('../../../utils/lab-canvas')
const { THEME, alpha, rampColor } = require('../../../utils/lab-theme')

const { cx, cMul, cDiv, cAbs, ETA0 } = rf
const K = 2 * Math.PI // 波数（λ=1 归一）

const MODE_LABELS = {
  center: '中心 δ-gap 馈电 · Z_in = V₀/I(0)',
  offset: '偏心馈电（z_f ≈ +L/4）· 馈点避开电流最大处，Z_in 升高',
  wave: '平面波接收（E∥导线，1 V/m）· 谐振长度感应电流最大',
}

Page({
  data: {
    S: { N: 17, L: 0.5, a: 0.005, mode: 'center' },
    stats: null,
    modeLabel: MODE_LABELS.center,
    kernelWarn: false,
  },

  onLoad() { this.update() },
  onReady() { this.update() },

  // ═══ 事件 ═══
  onN(e) {
    let v = Math.round(e.detail.value)
    if (v % 2 === 0) v += 1                      // 保证奇数：馈电段落在几何中心
    v = Math.max(7, Math.min(35, v))
    this.setData({ 'S.N': v }, () => this.update())
  },
  onL(e) {
    const v = Math.round(e.detail.value * 100) / 100
    this.setData({ 'S.L': v }, () => this.update())
  },
  onA(e) {
    const v = Math.round(e.detail.value * 1000) / 1000
    this.setData({ 'S.a': v }, () => this.update())
  },
  setMode(e) {
    haptic.light()
    const mode = e.currentTarget.dataset.m
    if (!MODE_LABELS[mode]) return
    this.setData({ 'S.mode': mode, modeLabel: MODE_LABELS[mode] }, () => this.update())
  },

  // ═══ Hallén 核：P(s) = ∫_seg e^{−jkR}/(4πR) dz′，R=√((s−u)²+a²) ═══
  // 1/R 奇异部分用 asinh 闭式，(e^{−jkR}−1)/R 光滑部分中点数值积分
  _kernel(s, dz, a, nsub) {
    const u1 = s - dz / 2, u2 = s + dz / 2
    const sing = Math.asinh(u2 / a) - Math.asinh(u1 / a)
    let re = 0, im = 0
    for (let q = 0; q < nsub; q++) {
      const u = u1 + (q + 0.5) * (dz / nsub)
      const R = Math.sqrt(u * u + a * a)
      const kR = K * R
      re += (Math.cos(kR) - 1) / R
      im -= Math.sin(kR) / R
    }
    const w = dz / nsub
    return cx((sing + re * w) / (4 * Math.PI), (im * w) / (4 * Math.PI))
  },

  // 复数高斯消元（列主元、多右端），Bs: 右端列数组，原地返回解
  _gauss(A0, Bs) {
    const N = A0.length
    const A = A0.map((r) => r.map((v) => cx(v.re, v.im)))
    const X = Bs.map((b) => b.map((v) => cx(v.re, v.im)))
    for (let k = 0; k < N; k++) {
      let p = k
      for (let i = k + 1; i < N; i++) if (cAbs(A[i][k]) > cAbs(A[p][k])) p = i
      if (p !== k) {
        const t = A[p]; A[p] = A[k]; A[k] = t
        X.forEach((b) => { const s = b[p]; b[p] = b[k]; b[k] = s })
      }
      for (let i = k + 1; i < N; i++) {
        const f = cDiv(A[i][k], A[k][k])
        for (let j = k; j < N; j++) {
          const t = cMul(f, A[k][j])
          A[i][j] = cx(A[i][j].re - t.re, A[i][j].im - t.im)
        }
        X.forEach((b) => {
          const t = cMul(f, b[k])
          b[i] = cx(b[i].re - t.re, b[i].im - t.im)
        })
      }
    }
    X.forEach((b) => {
      for (let i = N - 1; i >= 0; i--) {
        let s = b[i]
        for (let j = i + 1; j < N; j++) {
          const t = cMul(A[i][j], b[j])
          s = cx(s.re - t.re, s.im - t.im)
        }
        b[i] = cDiv(s, A[i][i])
      }
    })
    return X
  },

  // ═══ 求解：真实 MoM（矩阵、电流、Z_in、κ₁ 全部来自同一求解）═══
  solve() {
    const S = this.data.S
    const N = S.N
    const dz = S.L / N
    const z = []
    for (let i = 0; i < N; i++) z.push(-S.L / 2 + (i + 0.5) * dz)

    // Toeplitz 核表：P(|m−n|Δz)，近段加密积分
    const tab = []
    for (let m = 0; m <= N; m++) tab.push(this._kernel(m * dz, dz, S.a, m <= 2 ? 32 : 8))
    const Z = []
    for (let m = 0; m < N; m++) {
      Z[m] = []
      for (let n = 0; n < N; n++) Z[m][n] = tab[Math.abs(m - n)]
    }

    // 右端：齐次基 cos(kz)、sin(kz) + 激励特解
    const feed = S.mode === 'offset'
      ? (N - 1) / 2 + Math.round(N / 4)
      : (N - 1) / 2
    const zf = z[feed]
    const b1 = [], b2 = [], bp = []
    for (let m = 0; m < N; m++) {
      b1.push(cx(0, -Math.cos(K * z[m]) / ETA0))
      b2.push(cx(0, -Math.sin(K * z[m]) / ETA0))
      bp.push(S.mode === 'wave'
        ? cx(0, -(1 / K) / ETA0)                                  // E₀=1 V/m 平面波
        : cx(0, -0.5 * Math.sin(K * Math.abs(z[m] - zf)) / ETA0)) // V₀=1 V δ-gap
    }
    // 单位阵右端 → 完整逆矩阵（用于 κ₁）
    const eye = []
    for (let c = 0; c < N; c++) {
      const col = []
      for (let r = 0; r < N; r++) col.push(cx(r === c ? 1 : 0, 0))
      eye.push(col)
    }
    const sols = this._gauss(Z, [b1, b2, bp].concat(eye))
    const u1 = sols[0], u2 = sols[1], up = sols[2]
    const inv = sols.slice(3)

    // 端点条件 I(±L/2)=0（线性外推）→ 2×2 解 C₁、C₂
    const extL = (v) => cx(1.5 * v[0].re - 0.5 * v[1].re, 1.5 * v[0].im - 0.5 * v[1].im)
    const extR = (v) => cx(1.5 * v[N - 1].re - 0.5 * v[N - 2].re, 1.5 * v[N - 1].im - 0.5 * v[N - 2].im)
    const a11 = extL(u1), a12 = extL(u2), a21 = extR(u1), a22 = extR(u2)
    const r1 = extL(up), r2 = extR(up)
    const det = cx(cMul(a11, a22).re - cMul(a12, a21).re, cMul(a11, a22).im - cMul(a12, a21).im)
    const C1 = cDiv(cx(cMul(a12, r2).re - cMul(r1, a22).re, cMul(a12, r2).im - cMul(r1, a22).im), det)
    const C2 = cDiv(cx(cMul(r1, a21).re - cMul(a11, r2).re, cMul(r1, a21).im - cMul(a11, r2).im), det)
    const I = []
    for (let i = 0; i < N; i++) {
      const t1 = cMul(C1, u1[i]), t2 = cMul(C2, u2[i])
      I.push(cx(t1.re + t2.re + up[i].re, t1.im + t2.im + up[i].im))
    }

    // κ₁ = ‖Z‖₁‖Z⁻¹‖₁（1-范数 = 最大列绝对和）
    const colNorm = (get) => {
      let mx = 0
      for (let c = 0; c < N; c++) {
        let s = 0
        for (let r = 0; r < N; r++) s += cAbs(get(r, c))
        if (s > mx) mx = s
      }
      return mx
    }
    const cond = colNorm((r, c) => Z[r][c]) * colNorm((r, c) => inv[c][r])

    const zin = S.mode === 'wave' ? null : cDiv(cx(1, 0), I[feed])
    return { z, I, Z: Z, dz, feed, zf, zin, cond }
  },

  // 远场 F(θ)：θ 从偶极子轴量起，复电流叠加
  far(theta, sol) {
    let re = 0, im = 0
    const ct = Math.cos(theta)
    for (let i = 0; i < sol.I.length; i++) {
      const ph = K * sol.z[i] * ct
      const c = Math.cos(ph), s = Math.sin(ph)
      re += sol.I[i].re * c - sol.I[i].im * s
      im += sol.I[i].re * s + sol.I[i].im * c
    }
    return Math.abs(Math.sin(theta)) * Math.hypot(re, im)
  },

  pattern(sol) {
    const arr = []
    let m = 0, mi = 0
    for (let i = 0; i <= 360; i++) {
      const v = this.far(i / 360 * Math.PI, sol)
      arr.push(v)
      if (v > m) { m = v; mi = i }
    }
    const db = arr.map((v) => 20 * Math.log10((v / (m || 1)) + 1e-9))
    // HPBW：从主瓣峰向两侧找 −3 dB 点，0.5°/样点
    let l = mi, r = mi
    while (l > 0 && db[l] > -3) l--
    while (r < db.length - 1 && db[r] > -3) r++
    return { db, mi, hpbw: (r - l) * 0.5 }
  },

  // ═══ 更新 ═══
  update() {
    const sol = this.solve()
    const p = this.pattern(sol)
    const iFeedMa = cAbs(sol.I[sol.feed]) * 1000
    let iMax = 0
    sol.I.forEach((c) => { const v = cAbs(c); if (v > iMax) iMax = v })

    this.setData({
      stats: {
        zin: sol.zin
          ? sol.zin.re.toFixed(1) + (sol.zin.im >= 0 ? ' + j' : ' − j') + Math.abs(sol.zin.im).toFixed(1) + ' Ω'
          : '—（接收模式）',
        cond: sol.cond >= 1000 ? sol.cond.toExponential(1) : sol.cond.toFixed(1),
        ifeed: (this.data.S.mode === 'wave' ? iMax * 1000 : iFeedMa).toFixed(2) + ' mA',
        ifeedLabel: this.data.S.mode === 'wave' ? '最大感应电流（1 V/m）' : '馈点电流 |I(z_f)|',
        hpbw: p.hpbw.toFixed(1) + '°',
      },
      kernelWarn: sol.dz < this.data.S.a,
    })
    this._sol = sol
    this._pat = p
    this.drawCurrent()
    this.drawMatrix()
    this.drawPattern()
  },

  // ═══ 图 1：分段电流分布（真解）═══
  drawCurrent() {
    lc.mount(this, '#curCanvas', (ctx, w, h) => {
      lc.clear(ctx, w, h)
      const sol = this._sol
      const S = this.data.S
      const ys = sol.I.map((c) => cAbs(c) * 1000)
      let yMax = 0
      ys.forEach((v) => { if (v > yMax) yMax = v })
      yMax = yMax > 0 ? yMax * 1.15 : 1

      const box = { x: 46, y: 18, w: w - 62, h: h - 54 }
      const p = lc.plot(ctx, box, [-S.L / 2, S.L / 2], [0, yMax])
      p.axes({
        xTicks: lc.niceTicks(-S.L / 2, S.L / 2, 6),
        xLabel: 'z / λ',
        yLabel: '|I(z)| mA',
      })
      p.area(sol.z, ys, THEME.accent, 0)
      p.line(sol.z, ys, THEME.accent, 2)
      sol.I.forEach((c, i) => {
        lc.dot(ctx, p.X(sol.z[i]), p.Y(ys[i]), THEME.accent, 2.5)
      })

      if (S.mode === 'wave') {
        lc.arrow(ctx, box.x + 14, box.y + 10, box.x + 54, box.y + 10, THEME.indigo, 2)
        lc.label(ctx, '入射平面波 E ∥ 导线', box.x + 60, box.y + 14, {
          color: THEME.indigo, font: THEME.fontLabel,
        })
      } else {
        p.guideX(sol.zf, alpha(THEME.teal, 0.7))
        lc.dot(ctx, p.X(sol.zf), p.Y(cAbs(sol.I[sol.feed]) * 1000), THEME.teal, 4)
        lc.label(ctx, '馈点 z_f=' + sol.zf.toFixed(2) + 'λ', p.X(sol.zf) + 7,
          p.Y(cAbs(sol.I[sol.feed]) * 1000) - 8, { color: THEME.teal, font: THEME.fontLabel })
      }
      lc.label(ctx, 'N=' + S.N + ' 段 · Δz=' + sol.dz.toFixed(3) + 'λ',
        box.x + box.w, box.y - 4, { align: 'right', color: THEME.muted, font: THEME.fontTick })
    })
  },

  // ═══ 图 2：|Zmn| 矩阵热图（暖色单调色序 + colorbar）═══
  drawMatrix() {
    lc.mount(this, '#matCanvas', (ctx, w, h) => {
      lc.clear(ctx, w, h)
      const sol = this._sol
      const N = sol.Z.length
      let vMax = 0, vMin = Infinity
      const M = []
      for (let i = 0; i < N; i++) {
        M[i] = []
        for (let j = 0; j < N; j++) {
          const v = cAbs(sol.Z[i][j])
          M[i][j] = v
          if (v > vMax) vMax = v
          if (v < vMin) vMin = v
        }
      }
      const side = Math.min(w - 44, h - 58)
      const box = { x: 30, y: 16, w: side, h: side }
      lc.heatmap(ctx, box, M.map((row) => row.map((v) => v / vMax)), rampColor)

      ctx.strokeStyle = THEME.axis
      ctx.lineWidth = 1
      ctx.strokeRect(box.x, box.y, box.w, box.h)
      // 轴标注：n 列（源段）、m 行（匹配点），角标 1..N
      lc.label(ctx, 'n →', box.x + box.w / 2 - 8, box.y + box.h + 12, { color: THEME.muted, font: THEME.fontTick })
      lc.label(ctx, '1', box.x, box.y + box.h + 12, { color: THEME.muted, font: THEME.fontTick })
      lc.label(ctx, String(N), box.x + box.w - 10, box.y + box.h + 12, { color: THEME.muted, font: THEME.fontTick })
      lc.label(ctx, 'm', box.x - 12, box.y + box.h / 2, { color: THEME.muted, font: THEME.fontTick, align: 'center' })
      lc.label(ctx, '1', box.x - 12, box.y + 8, { color: THEME.muted, font: THEME.fontTick, align: 'center' })
      lc.label(ctx, String(N), box.x - 12, box.y + box.h - 2, { color: THEME.muted, font: THEME.fontTick, align: 'center' })

      // 迷你 colorbar（rampColor 采样）+ min/max 数值
      const cbY = box.y + box.h + 22, cbW = box.w, cbH = 8
      for (let s = 0; s < 40; s++) {
        ctx.fillStyle = rampColor(s / 39)
        ctx.fillRect(box.x + s * cbW / 40, cbY, cbW / 40 + 0.5, cbH)
      }
      ctx.strokeStyle = THEME.gridStrong
      ctx.strokeRect(box.x, cbY, cbW, cbH)
      lc.label(ctx, lc.fmtNum(vMin), box.x, cbY + cbH + 11, { color: THEME.inkSoft, font: THEME.fontTick })
      lc.label(ctx, lc.fmtNum(vMax), box.x + cbW, cbY + cbH + 11, { align: 'right', color: THEME.inkSoft, font: THEME.fontTick })
      lc.label(ctx, '|Zmn|', box.x + cbW / 2, cbY + cbH + 11, { align: 'center', color: THEME.muted, font: THEME.fontTick })
    })
  },

  // ═══ 图 3：远场方向图（全圆极坐标，dB 环 + 角度标注）═══
  drawPattern() {
    lc.mount(this, '#patCanvas', (ctx, w, h) => {
      lc.clear(ctx, w, h)
      const p = this._pat
      const cxp = w / 2, cyp = h / 2 + 4
      const R = Math.min(w, h) * 0.35
      const FLOOR = -30

      lc.polarGrid(ctx, cxp, cyp, R, { rings: [0, -10, -20, -30], full: true })
      // 角度标注（θ 从偶极子轴量起，轴竖直）
      lc.label(ctx, 'θ=0°', cxp, cyp - R - 8, { align: 'center', color: THEME.muted, font: THEME.fontTick })
      lc.label(ctx, '90°', cxp + R + 16, cyp + 12, { align: 'center', color: THEME.muted, font: THEME.fontTick })
      lc.label(ctx, '180°', cxp, cyp + R + 14, { align: 'center', color: THEME.muted, font: THEME.fontTick })
      lc.label(ctx, '90°', cxp - R - 16, cyp + 12, { align: 'center', color: THEME.muted, font: THEME.fontTick })

      // 偶极子轴示意（竖直短线）
      ctx.strokeStyle = THEME.ink
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(cxp, cyp - 9)
      ctx.lineTo(cxp, cyp + 9)
      ctx.stroke()

      // 全圆曲线：θ∈[0,π] 直接取，θ∈(π,2π) 用 F(2π−θ)（φ 旋转对称）
      ctx.beginPath()
      for (let i = 0; i <= 720; i++) {
        const thDeg = i / 2
        const idx = thDeg <= 180 ? Math.round(thDeg * 2) : Math.round((360 - thDeg) * 2)
        const db = Math.max(FLOOR, Math.min(0, p.db[idx]))
        const r = R * (1 - db / FLOOR)
        const th = thDeg * Math.PI / 180
        const x = cxp + r * Math.sin(th), y = cyp - r * Math.cos(th)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.fillStyle = alpha(THEME.accent, 0.10)
      ctx.fill()
      ctx.strokeStyle = THEME.accent
      ctx.lineWidth = 2
      ctx.lineJoin = 'round'
      ctx.stroke()

      lc.label(ctx, '归一化 dB · 外环 0 dB', 8, h - 8, { color: THEME.muted, font: THEME.fontTick })
      lc.label(ctx, 'HPBW ' + p.hpbw.toFixed(1) + '°', w - 8, 14, {
        align: 'right', color: THEME.ink, font: THEME.fontLabel,
      })
    })
  },

  onShareAppMessage() {
    return { title: '矩量法实验室：细线偶极子真实求解', path: '/pages/interactive/moment-method/moment-method' }
  },
})

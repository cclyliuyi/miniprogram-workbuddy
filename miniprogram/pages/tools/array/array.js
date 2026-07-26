// pages/tools/array/array.js —— 天线阵列方向图实验室
// 物理模型（无魔法系数，公式见 utils/rf-math.js）：
//   AF(θ) = Σ wₙ·exp[jn·kd(sinθ−sinθ₀)]，kd = 2πd/λ（Balanis 6-10）
//   D₀ ≈ 2(d/λ)(Σw)²/Σw²（广边线阵近似，显示为 10·lg D₀ dBi）
//   栅瓣判据：d/λ ≥ 1/(1+|sinθ₀|)（Balanis 6-89），栅瓣角 sinθg = sinθ₀ ± m·λ/d
const haptic = require('../../../utils/haptic')
const rf = require('../../../utils/rf-math')
const lc = require('../../../utils/lab-canvas')
const { THEME, alpha } = require('../../../utils/lab-theme')

const D2R = Math.PI / 180
const FLOOR_DB = -40   // 极坐标图动态范围
const STEP = 0.25      // 角度采样步长（°），只算可见区 −90°~+90°

Page({
  data: {
    N: 8,
    dLam100: 50,      // d/λ × 100（滑杆整数）
    theta0: 0,        // 扫描角（°）
    windows: ['均匀', '汉明', '汉宁', '布莱克曼', '切比雪夫 −30dB'],
    winIdx: 0,
    dStr: '0.50',
    caption: '',
    metrics: null,
    gratingText: '',
    // 偶极子尺寸速查
    dipoleFreq: '433',
    dipoleFreqUnit: 0,
    dipoleResult: null,
  },

  onLoad() { this.calcDipole(); this.update() },
  onReady() { this.update() },

  // ═══ 事件（滑杆实时重算重绘）═══
  onN(e) {
    const v = Math.round(+e.detail.value)
    this.setData({ N: isFinite(v) ? Math.max(2, Math.min(32, v)) : 8 }, () => this.update())
  },
  onD(e) {
    const v = Math.round(+e.detail.value)
    this.setData({ dLam100: isFinite(v) ? Math.max(10, Math.min(150, v)) : 50 }, () => this.update())
  },
  onTheta(e) {
    const v = Math.round(+e.detail.value)
    this.setData({ theta0: isFinite(v) ? Math.max(-60, Math.min(60, v)) : 0 }, () => this.update())
  },
  setWindow(e) {
    haptic.light()
    this.setData({ winIdx: +e.currentTarget.dataset.i || 0 }, () => this.update())
  },

  // ═══ 窗函数权重 ═══
  getWindow(N, idx) {
    if (idx === 4) return rf.chebyshevWeights(N, 30)       // Dolph–Chebyshev，SLL=−30dB
    if (idx === 1) return rf.taperWeights(N, 'hamming')    // 0.54 − 0.46cos
    if (idx === 0) return rf.taperWeights(N)               // 均匀
    const w = []
    for (let n = 0; n < N; n++) {
      const t = N === 1 ? 0.5 : n / (N - 1)
      const v = idx === 2
        ? 0.5 - 0.5 * Math.cos(2 * Math.PI * t)            // Hann
        : 0.42 - 0.5 * Math.cos(2 * Math.PI * t) + 0.08 * Math.cos(4 * Math.PI * t) // Blackman
      w.push(Math.max(1e-4, v)) // 端点为 0 的窗钳到极小值，防 Σw=0
    }
    return w
  },

  // ═══ 计算 + 刷新 ═══
  update() {
    const N = Math.max(2, Math.min(32, Math.round(this.data.N)))
    const d = this.data.dLam100 / 100
    const th0deg = this.data.theta0
    const th0 = th0deg * D2R
    const w = this.getWindow(N, this.data.winIdx)
    const kd = 2 * Math.PI * d
    const sin0 = Math.sin(th0)

    // 只在可见区 −90°~+90° 采样（±180° 的镜像瓣不是旁瓣）
    const angs = [], amp = []
    for (let a = -90; a <= 90 + 1e-9; a += STEP) {
      angs.push(a)
      amp.push(rf.afWeighted(w, kd * (Math.sin(a * D2R) - sin0)))
    }
    const maxAmp = Math.max.apply(null, amp)
    const pdb = amp.map((v) => (v / maxAmp > 1e-6 ? 20 * Math.log10(v / maxAmp) : -120))
    this._af = { w, kd, sin0, maxAmp }

    // 主瓣指向（等幅栅瓣并存时取最接近 θ₀ 的峰）
    let maxIdx = 0
    for (let i = 1; i < pdb.length; i++) {
      if (pdb[i] > pdb[maxIdx] + 1e-9) maxIdx = i
      else if (Math.abs(pdb[i] - pdb[maxIdx]) <= 1e-9 &&
        Math.abs(angs[i] - th0deg) < Math.abs(angs[maxIdx] - th0deg)) maxIdx = i
    }

    // HPBW：主瓣两侧线性插值求精确 −3dB 交点
    const hp = this.halfPower(angs, pdb, maxIdx)

    // SLL：先用局部极小值定位主瓣边界，再在其外找最大旁瓣
    const sl = this.sidelobe(angs, pdb, maxIdx)

    // 方向性（广边近似）：D₀ = 2(d/λ)(Σw)²/Σw² → dBi
    let sw = 0, sw2 = 0
    for (let n = 0; n < N; n++) { sw += w[n]; sw2 += w[n] * w[n] }
    const d0 = 2 * d * sw * sw / sw2
    const dirDbi = 10 * Math.log10(d0)

    // 栅瓣判据 d/λ ≥ 1/(1+|sinθ₀|)，栅瓣角 sinθg = sinθ₀ ± 1/(d/λ)
    const gLimit = rf.gratingLobeLimit(th0)
    const grating = d >= gLimit - 1e-9
    let gDeg = null
    for (const m of [-1, 1]) {
      const sg = sin0 + m / d
      if (Math.abs(sg) <= 1) {
        const cand = Math.asin(sg) / D2R
        if (gDeg === null || Math.abs(cand) < Math.abs(gDeg)) gDeg = cand
      }
    }
    const gratingText = grating
      ? 'd/λ = ' + d.toFixed(2) + ' ≥ 1/(1+|sinθ₀|) = ' + gLimit.toFixed(2) +
        '，可见区出现栅瓣' + (gDeg !== null ? '（约 ' + gDeg.toFixed(0) + '°）' : '')
      : ''

    this._geo = {
      th0deg,
      hpbwL: hp ? hp.left : null, hpbwR: hp ? hp.right : null,
      hpbwStr: hp ? (hp.right - hp.left).toFixed(1) : null,
      sllDb: sl ? sl.db : null, sllAng: sl ? sl.ang : null,
      gDeg: grating ? gDeg : null,
    }
    this.setData({
      dStr: d.toFixed(2),
      caption: this.data.windows[this.data.winIdx] + '加权 · N=' + N +
        ' · d=' + d.toFixed(2) + 'λ · θ₀=' + th0deg + '°',
      metrics: {
        mainLobe: angs[maxIdx].toFixed(1) + '°',
        hpbw: hp ? (hp.right - hp.left).toFixed(1) + '°' : '波束过宽',
        sll: sl ? sl.db.toFixed(1) + ' dB' : '—（可见区无旁瓣）',
        dir: dirDbi.toFixed(1) + ' dBi',
      },
      gratingText,
    })
    this.draw()
  },

  // −3dB 交点（主瓣两侧线性插值）；触边返回 null
  halfPower(angs, pdb, maxIdx) {
    const thr = pdb[maxIdx] - 3
    let i = maxIdx
    while (i > 0 && pdb[i] > thr) i--
    if (pdb[i] > thr) return null
    const left = angs[i] + (angs[i + 1] - angs[i]) * (thr - pdb[i]) / (pdb[i + 1] - pdb[i])
    let j = maxIdx
    while (j < pdb.length - 1 && pdb[j] > thr) j++
    if (pdb[j] > thr) return null
    const right = angs[j] - (angs[j] - angs[j - 1]) * (thr - pdb[j]) / (pdb[j - 1] - pdb[j])
    return { left, right }
  },

  // 主瓣边界 = 两侧第一个局部极小值；其外的最大值即最大旁瓣
  sidelobe(angs, pdb, maxIdx) {
    let iL = maxIdx
    while (iL > 0 && pdb[iL - 1] < pdb[iL]) iL--
    let iR = maxIdx
    while (iR < pdb.length - 1 && pdb[iR + 1] < pdb[iR]) iR++
    // 某一侧走到可见区边界仍未见极小值 → 该侧无旁瓣（边界值不算旁瓣）
    let db = -Infinity, idx = -1
    if (iL > 0) for (let i = 0; i <= iL; i++) if (pdb[i] > db) { db = pdb[i]; idx = i }
    if (iR < pdb.length - 1) for (let i = iR; i < pdb.length; i++) if (pdb[i] > db) { db = pdb[i]; idx = i }
    if (idx < 0 || db <= -100) return null
    return { db, ang: angs[idx] }
  },

  // 任意角度的归一化 dB（供极坐标曲线取样）
  afDb(th) {
    const a = this._af
    if (!a) return FLOOR_DB
    const v = rf.afWeighted(a.w, a.kd * (Math.sin(th) - a.sin0)) / a.maxAmp
    return v > 1e-6 ? 20 * Math.log10(v) : -120
  },

  // ═══ 绘制：上半圆极坐标方向图 + HPBW 扇形 + SLL/栅瓣标记 ═══
  draw() {
    lc.mount(this, '#afCanvas', (ctx, w, h) => {
      lc.clear(ctx, w, h)
      const g = this._geo
      if (!g) return
      const R = Math.min(w / 2 - 46, h - 78)
      const cx = w / 2
      const cy = Math.min(h - 26, (h + R) / 2 + 26)

      lc.polarGrid(ctx, cx, cy, R, { rings: [0, -10, -20, -30, FLOOR_DB] })

      // HPBW 扇形阴影 + −3dB 交点
      if (g.hpbwL !== null) {
        const a1 = g.hpbwL * D2R - Math.PI / 2
        const a2 = g.hpbwR * D2R - Math.PI / 2
        ctx.fillStyle = alpha(THEME.teal, 0.10)
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a1, a2); ctx.closePath(); ctx.fill()
        const r3 = R * (1 - 3 / -FLOOR_DB)
        const pts = [g.hpbwL, g.hpbwR]
        pts.forEach((deg) => {
          const t = deg * D2R
          lc.dot(ctx, cx + r3 * Math.sin(t), cy - r3 * Math.cos(t), THEME.teal, 3.5)
        })
        const mid = (g.hpbwL + g.hpbwR) / 2 * D2R
        lc.label(ctx, 'HPBW ' + g.hpbwStr + '°',
          cx + (R + 14) * Math.sin(mid), cy - (R + 14) * Math.cos(mid) - 4,
          { align: 'center', color: THEME.teal, font: THEME.fontLabel })
      }

      // 扫描角 θ₀ 虚线
      ctx.save()
      ctx.setLineDash([4, 4]); ctx.lineWidth = 1; ctx.strokeStyle = THEME.gridStrong
      const t0 = g.th0deg * D2R
      ctx.beginPath(); ctx.moveTo(cx, cy)
      ctx.lineTo(cx + R * Math.sin(t0), cy - R * Math.cos(t0)); ctx.stroke()
      ctx.restore()

      // 方向图曲线（阵因子）
      lc.polarCurveDb(ctx, cx, cy, R, (th) => this.afDb(th), FLOOR_DB, THEME.accent, true)

      // 最大旁瓣标记
      if (g.sllAng !== null) {
        const db = Math.max(g.sllDb, FLOOR_DB)
        const rs = R * (1 - db / FLOOR_DB)
        const ts = g.sllAng * D2R
        const x = cx + rs * Math.sin(ts), y = cy - rs * Math.cos(ts)
        lc.dot(ctx, x, y, THEME.gold, 3.5)
        lc.label(ctx, 'SLL ' + g.sllDb.toFixed(1) + ' dB', x + (ts >= 0 ? 8 : -8), y - 8,
          { align: ts >= 0 ? 'left' : 'right', color: THEME.gold, font: THEME.fontLabel })
      }

      // 栅瓣位置标记（可见区内）
      if (g.gDeg !== null && Math.abs(g.gDeg) <= 90) {
        const tg = g.gDeg * D2R
        lc.label(ctx, '栅瓣', cx + (R * 0.6) * Math.sin(tg) + (tg >= 0 ? 10 : -10),
          cy - (R * 0.6) * Math.cos(tg),
          { align: tg >= 0 ? 'left' : 'right', color: THEME.danger, font: THEME.fontLabel })
      }

      // 系列标注 + 刻度说明
      lc.label(ctx, '|AF| 归一化 (dB)', 12, 20, { color: THEME.accent, font: THEME.fontLabel })
      lc.label(ctx, 'θ₀ = ' + g.th0deg + '°（虚线）', w - 12, 20,
        { align: 'right', color: THEME.inkSoft, font: THEME.fontLabel })
    })
  },

  // ═══ 偶极子/单极子尺寸速查（实时）═══
  onDipoleFreq(e) { this.setData({ dipoleFreq: e.detail.value }, () => this.calcDipole()) },
  setDipoleUnit(e) {
    haptic.light()
    this.setData({ dipoleFreqUnit: +e.currentTarget.dataset.u || 0 }, () => this.calcDipole())
  },
  calcDipole() {
    const f = parseFloat(this.data.dipoleFreq)
    if (!isFinite(f) || f <= 0) { this.setData({ dipoleResult: null }); return }
    const wl = rf.wavelength(f * (this.data.dipoleFreqUnit === 0 ? 1e6 : 1e9))
    this.setData({
      dipoleResult: {
        halfDipole: rf.fmtLen(wl / 2),
        quarterMono: rf.fmtLen(wl / 4),
        fullLoop: rf.fmtLen(wl),
      },
    })
  },

  onShareAppMessage() {
    return { title: '天线阵列方向图实验室', path: '/pages/tools/array/array' }
  },
})

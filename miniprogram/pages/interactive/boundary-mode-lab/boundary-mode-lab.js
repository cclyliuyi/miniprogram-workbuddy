// pages/interactive/boundary-mode-lab/boundary-mode-lab.js —— 边界模式格林函数实验室
// 四种模式：边界条件 / 模式筛选 / 格林函数（镜像源）/ 对称性约束
// 物理模型（无魔法系数）：
//   TM_mn：Ez ∝ sin(mπx/a)·sin(nπy/b)，四壁 Ez=0（PEC）；f_c=(c/2)√((m/a)²+(n/b)²)
//   腔内点源：一阶镜像源（4 壁反号 + 4 角同号）近似满足壁面 Ez=0，
//   幅度按 2D 波 1/√r 渐近衰减（H₀⁽²⁾(kr) 大宗量），k = 2π/λ，图中取 λ = a/4
//   对称性：sin(mπ(1−u)) = (−1)^(m+1)·sin(mπu) → 偶 m 的镜像平均恒为零

const haptic = require('../../../utils/haptic')
const lc = require('../../../utils/lab-canvas')
const { THEME, alpha, divergeColor } = require('../../../utils/lab-theme')

const LAM_OVER_A = 0.25                       // λ/a（格林函数模式的波长，标注于公式卡）
const KNORM = 2 * Math.PI / LAM_OVER_A        // 归一化波数 k·a = 8π

const MODE_INFO = {
  boundary: {
    label: '边界条件：四壁 Ez = 0，场被边界筛选',
    note: '金属壁上切向电场必须为零（n×E=0）。图示为方形域最低 TM 模的 Ez：四条红边全部是 Ez=0 的节线——不满足边界条件的场根本不被允许存在。',
  },
  mode: {
    label: '模式筛选：边界决定允许的本征形态',
    note: '模式是边界筛选出来的允许波形，不是随手画出的花纹。m、n 决定内部节线数量与截止频率；TM 模要求 m,n ≥ 1。虚线即 Ez=0 的节线。',
  },
  green: {
    label: '格林函数：点源 + 镜像源满足边界',
    note: '腔内点源的响应必须满足壁面 Ez=0——这正是前两个模式教的边界约束。做法：对四壁各加一个反号镜像、四角加同号镜像（一阶近似）。辐射积分和矩量法都在做这种点源响应叠加。',
  },
  symmetry: {
    label: '对称性：先预测，再计算',
    note: '把模式与它的镜像做平均：奇 m 模式关于中线偶对称，完整保留；偶 m 模式反对称，与镜面约束矛盾，平均后场恒为零——这不是画布出了问题，是对称性禁止了它。',
  },
}

const FORMULAS = {
  boundary: {
    lines: [
      'PEC 边界：n×E = 0 → 壁面上 Ez = 0',
      '最低允许模（TM₁₁ 型）：Ez ∝ sin(πx/a)·sin(πy/b)',
    ],
    cond: '适用条件：理想导体（PEC）矩形域，所画标量为 TM 模纵向分量 Ez。四条边都是节线。',
  },
  mode: {
    lines: [
      'Ez = E₀·sin(mπx/a)·sin(nπy/b)（TM_mn，m,n ≥ 1）',
      'f_c = (c/2)·√((m/a)² + (n/b)²)；方形域 f_c/f_c11 = √((m²+n²)/2)',
    ],
    cond: '适用条件：理想导体矩形波导/谐振腔 TM 模的横截面 Ez 分布；图示域取 a = b（方形）。',
  },
  green: {
    lines: [
      'G ≈ Σᵢ sᵢ·cos(k·rᵢ − ωt)/√rᵢ，sᵢ = ±1（点源 + 一阶镜像）',
      '2D 自由空间 G = (−j/4)·H₀⁽²⁾(kr)，|G| ∝ 1/√(kr)（kr ≫ 1）；k = 2π/λ，取 λ = a/4',
    ],
    cond: '适用条件：一阶镜像（4 壁反号 + 4 角同号）只近似满足壁面 Ez=0；精确解需无穷镜像格阵或模式展开 G = Σ ψ_mn(r)·ψ_mn(r\')/(k²−k_mn²)。',
  },
  symmetry: {
    lines: [
      '镜像平均：[f(x) + f(a−x)]/2，f = sin(mπx/a)·sin(nπy/b)',
      'sin(mπ(a−x)/a) = (−1)^(m+1)·sin(mπx/a) → 偶 m 时平均恒为零',
    ],
    cond: '结论：偶 m 模式关于 x=a/2 反对称，与镜面（偶）对称约束矛盾而被禁止；奇 m 模式完整保留。',
  },
}

Page({
  data: {
    S: { mode: 'boundary', m: 1, n: 1, source: 34 },
    modeLabel: MODE_INFO.boundary.label,
    noteText: MODE_INFO.boundary.note,
    formula: FORMULAS.boundary,
    stats: [],
  },

  _tau: 0,
  _timer: null,

  onLoad() { this.update() },
  onReady() { this.update() },
  onShow() { if (this.data.S.mode === 'green') this._startAnim() },
  onHide() { this._stopAnim() },
  onUnload() { this._stopAnim() },

  // 动画定时器只在 green 模式运行（其余模式为静场，不空转）
  _startAnim() {
    if (this._timer) return
    this._timer = setInterval(() => { this._tau += 0.3; this.draw() }, 80)
  },
  _stopAnim() { if (this._timer) { clearInterval(this._timer); this._timer = null } },

  // ═══ 事件 ═══
  onM(e) { this.setData({ 'S.m': e.detail.value }, () => this.update()) },
  onN(e) { this.setData({ 'S.n': e.detail.value }, () => this.update()) },
  onSource(e) { this.setData({ 'S.source': e.detail.value }, () => this.update()) },
  setMode(e) {
    const m = e.currentTarget.dataset.m
    const info = MODE_INFO[m]
    if (!info) return
    haptic.light()
    if (m === 'green') this._startAnim(); else this._stopAnim()
    this.setData({
      'S.mode': m, modeLabel: info.label, noteText: info.note, formula: FORMULAS[m],
    }, () => this.update())
  },

  // ═══ 读数 ═══
  update() {
    const S = this.data.S
    const stats = []
    if (S.mode === 'mode') {
      const ratio = Math.sqrt((S.m * S.m + S.n * S.n) / 2)
      stats.push({ label: '截止频率（方形域 a = b）', value: ratio.toFixed(3) + ' × f_c,11', cls: 'tp-c-teal' })
      stats.push({ label: '内部节线', value: (S.m - 1) + ' 条竖 · ' + (S.n - 1) + ' 条横', cls: 'tp-c-indigo' })
    } else if (S.mode === 'symmetry') {
      const even = S.m % 2 === 0
      stats.push({
        label: '镜面对称判定（关于 x = a/2）',
        value: even ? '偶 m：被禁止（Ez ≡ 0）' : '奇 m：偶对称，保留',
        cls: even ? 'tp-c-danger' : 'tp-c-teal',
      })
    } else if (S.mode === 'green') {
      stats.push({ label: '波数（取 λ = a/4）', value: 'k·a = 8π ≈ 25.1', cls: 'tp-c-indigo' })
      stats.push({ label: '镜像源（一阶）', value: '4 壁（反号）+ 4 角（同号）', cls: 'tp-c-accent' })
    }
    this.setData({ stats })
    this.draw()
  },

  // ═══ 场函数（u, q ∈ [0,1]，q 从下边起）═══
  // 点源 + 一阶镜像：Dirichlet（Ez=0）壁 → 壁镜像反号、角镜像同号
  _imageSources(sx, sy) {
    const xs = [[sx, 1], [-sx, -1], [2 - sx, -1]]
    const ys = [[sy, 1], [-sy, -1], [2 - sy, -1]]
    const out = []
    xs.forEach((a) => ys.forEach((b) => out.push({ x: a[0], y: b[0], s: a[1] * b[1] })))
    return out
  },

  _fieldFn(S) {
    if (S.mode === 'boundary') {
      return (u, q) => Math.sin(Math.PI * u) * Math.sin(Math.PI * q)
    }
    if (S.mode === 'mode') {
      return (u, q) => Math.sin(S.m * Math.PI * u) * Math.sin(S.n * Math.PI * q)
    }
    if (S.mode === 'green') {
      const srcs = this._imageSources(S.source / 100, 0.5)
      const tau = this._tau
      return (u, q) => {
        let sum = 0
        for (let i = 0; i < srcs.length; i++) {
          const s = srcs[i]
          const r = Math.hypot(u - s.x, q - s.y) + 0.02  // 数值软化，避免 r=0 奇点
          sum += s.s * Math.cos(KNORM * r - tau) / Math.sqrt(r)
        }
        return sum * 0.28   // 显示尺度（只影响色彩饱和度，非物理量）
      }
    }
    // symmetry：模式与其镜像的平均
    return (u, q) => {
      const f = (x) => Math.sin(S.m * Math.PI * x)
      return (f(u) + f(1 - u)) / 2 * Math.sin(S.n * Math.PI * q)
    }
  },

  // ═══ 绘制 ═══
  draw() {
    lc.mount(this, '#fieldCanvas', (ctx, w, h) => {
      lc.clear(ctx, w, h)
      const S = this.data.S
      // 方形场域（a = b）+ 右侧色标
      const side = Math.min(w - 108, h - 56)
      const box = { x: 40, y: 24, w: side, h: side }
      const fn = this._fieldFn(S)
      // 采样 → 发散色热图（靛蓝负 ↔ 赤陶正，零点米灰）
      const NC = 36
      const matrix = []
      for (let j = 0; j < NC; j++) {
        const row = []
        for (let i = 0; i < NC; i++) {
          const u = (i + 0.5) / NC
          const q = 1 - (j + 0.5) / NC      // 画布 y 向下，物理 y/b 向上
          const val = Math.max(-1, Math.min(1, fn(u, q)))
          row.push((val + 1) / 2)
        }
        matrix.push(row)
      }
      lc.heatmap(ctx, box, matrix, (t) => divergeColor(2 * t - 1))
      // 域边界
      ctx.strokeStyle = THEME.axis; ctx.lineWidth = 1
      ctx.strokeRect(box.x, box.y, box.w, box.h)
      // 坐标标注（归一化 x/a、y/b）
      lc.label(ctx, '0', box.x, box.y + box.h + 13, { align: 'center', font: THEME.fontTick })
      lc.label(ctx, '1', box.x + box.w, box.y + box.h + 13, { align: 'center', font: THEME.fontTick })
      lc.label(ctx, 'x/a', box.x + box.w / 2, box.y + box.h + 26, { align: 'center', color: THEME.muted })
      lc.label(ctx, '1', box.x - 8, box.y + 9, { align: 'right', font: THEME.fontTick })
      lc.label(ctx, 'y/b', box.x - 8, box.y + box.h / 2 + 3, { align: 'right', color: THEME.muted })
      lc.label(ctx, '0', box.x - 8, box.y + box.h, { align: 'right', font: THEME.fontTick })
      // 色标
      this._colorbar(ctx, box.x + box.w + 20, box.y, 13, box.h)
      // 模式覆盖层
      if (S.mode === 'boundary') this._overBoundary(ctx, box)
      else if (S.mode === 'mode') this._overMode(ctx, box, S)
      else if (S.mode === 'green') this._overGreen(ctx, box, S)
      else this._overSymmetry(ctx, box, S)
    })
  },

  // 正负双极色标（与热图同一 divergeColor）
  _colorbar(ctx, x, y, w, h) {
    const steps = 48
    for (let i = 0; i < steps; i++) {
      ctx.fillStyle = divergeColor(1 - 2 * i / (steps - 1))
      ctx.fillRect(x, y + h * i / steps, w, h / steps + 1)
    }
    ctx.strokeStyle = THEME.axis; ctx.lineWidth = 1
    ctx.strokeRect(x, y, w, h)
    lc.label(ctx, '+Ez', x + w / 2, y - 6, { align: 'center', font: THEME.fontTick })
    lc.label(ctx, '0', x + w + 4, y + h / 2 + 3, { font: THEME.fontTick })
    lc.label(ctx, '−Ez', x + w / 2, y + h + 12, { align: 'center', font: THEME.fontTick })
  },

  _overBoundary(ctx, box) {
    // 四条 PEC 壁全部标红（四边都是 Ez=0 节线）
    ctx.strokeStyle = THEME.danger; ctx.lineWidth = 3
    ctx.strokeRect(box.x, box.y, box.w, box.h)
    lc.label(ctx, 'PEC 四壁：Ez = 0', box.x + 8, box.y + 18, {
      color: THEME.danger, font: THEME.fontTitle,
    })
    lc.label(ctx, '所示场：Ez（TM₁₁ 型最低模）', box.x + 8, box.y + 34, { color: THEME.inkSoft })
  },

  _overMode(ctx, box, S) {
    // 节线（Ez = 0）：竖 x = k/m，横 y = k/n
    ctx.save()
    ctx.setLineDash([4, 4]); ctx.strokeStyle = alpha('#20201c', 0.4); ctx.lineWidth = 1
    ctx.beginPath()
    for (let k = 1; k < S.m; k++) {
      const x = box.x + box.w * k / S.m
      ctx.moveTo(x, box.y); ctx.lineTo(x, box.y + box.h)
    }
    for (let k = 1; k < S.n; k++) {
      const y = box.y + box.h * (1 - k / S.n)
      ctx.moveTo(box.x, y); ctx.lineTo(box.x + box.w, y)
    }
    ctx.stroke()
    ctx.restore()
    lc.label(ctx, 'Ez · TM(' + S.m + ',' + S.n + ')，虚线 = 节线', box.x + 8, box.y + 18, {
      color: THEME.ink, font: THEME.fontTitle,
    })
  },

  _overGreen(ctx, box, S) {
    const px = box.x + (S.source / 100) * box.w
    const py = box.y + 0.5 * box.h
    lc.dot(ctx, px, py, THEME.gold, 5)
    lc.label(ctx, '点源', px + 10, py + 4, { color: THEME.gold, font: THEME.fontLabel })
    lc.label(ctx, '壁外镜像源已加入 → 壁面 Ez ≈ 0', box.x + 8, box.y + 18, {
      color: THEME.inkSoft, font: THEME.fontLabel,
    })
  },

  _overSymmetry(ctx, box, S) {
    // 镜面
    ctx.save()
    ctx.setLineDash([6, 6]); ctx.strokeStyle = THEME.gold; ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(box.x + box.w / 2, box.y); ctx.lineTo(box.x + box.w / 2, box.y + box.h)
    ctx.stroke()
    ctx.restore()
    lc.label(ctx, '镜面 x = a/2', box.x + box.w / 2 + 8, box.y + 16, {
      color: THEME.gold, font: THEME.fontLabel,
    })
    if (S.m % 2 === 0) {
      lc.label(ctx, '偶 m：与镜面对称矛盾 → Ez ≡ 0（被禁止）',
        box.x + box.w / 2, box.y + box.h / 2, {
        align: 'center', color: THEME.danger, font: THEME.fontTitle,
      })
    }
  },

  onShareAppMessage() {
    return { title: '边界模式格林函数实验室', path: '/pages/interactive/boundary-mode-lab/boundary-mode-lab' }
  },
})

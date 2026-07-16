// pages/interactive/polarization-reciprocity-lab/polarization-reciprocity-lab.js —— 极化与互易实验室
// 3种模式：极化椭圆 / 接收投影 / 收发互易
// 电场端点：{x: cos(t), y: ratio·cos(t+δ)}

const haptic = require('../../../utils/haptic')

const MODE_INFO = {
  ellipse: { label: '电场端点轨迹：幅度比 + 相位差', note: '线、圆、椭圆极化都来自两个正交分量的幅度和相位差。' },
  match: { label: '接收投影：极化失配就是矢量投影损耗', note: '接收损耗可以先看成电场矢量投影问题。投影到接收天线方向才有功率。' },
  reciprocity: { label: '互易：同一极化基下收发角色可以交换', note: '互易性让收发模型可交换，但不代表任何极化都能互相接收。' },
}

Page({
  data: {
    S: { mode: 'ellipse', ratio: 75, phase: 90, angle: 25 },
    modeLabel: MODE_INFO.ellipse.label,
    noteText: MODE_INFO.ellipse.note,
    stats: null,
  },

  _t: 0,
  _timer: null,

  onLoad() { this.updateStats(); this.draw() },
  onReady() { this.updateStats(); this.draw() },
  onShow() { this._startAnim() },
  onHide() { this._stopAnim() },
  onUnload() { this._stopAnim() },

  _startAnim() {
    if (this._timer) return
    this._timer = setInterval(() => {
      this._t += 0.08
      this.draw()
    }, 50)
  },
  _stopAnim() { if (this._timer) { clearInterval(this._timer); this._timer = null } },

  // ═══ 事件 ═══
  onRatio(e) { this.setData({ 'S.ratio': e.detail.value }, () => { this.updateStats(); this.draw() }) },
  onPhase(e) { this.setData({ 'S.phase': e.detail.value }, () => { this.updateStats(); this.draw() }) },
  onAngle(e) { this.setData({ 'S.angle': e.detail.value }, () => { this.updateStats(); this.draw() }) },
  setEllipse() { haptic.light(); this._setMode('ellipse') },
  setMatch() { haptic.light(); this._setMode('match') },
  setReciprocity() { haptic.light(); this._setMode('reciprocity') },
  _setMode(m) {
    this.setData({ 'S.mode': m, modeLabel: MODE_INFO[m].label, noteText: MODE_INFO[m].note }, () => this.draw())
  },

  // ═══ 物理 ═══
  vals() {
    const S = this.data.S
    return {
      ratio: S.ratio / 100,
      delta: S.phase * Math.PI / 180,
      deltaDeg: S.phase,
      angle: S.angle * Math.PI / 180,
      angleDeg: S.angle,
    }
  },

  fieldPoint(v, t, scale) {
    return {
      x: scale * Math.cos(t),
      y: scale * v.ratio * Math.cos(t + v.delta),
    }
  },

  updateStats() {
    const v = this.vals()
    // 极化类型判断
    let type
    const circularity = Math.abs(v.ratio - 1) + Math.abs(Math.abs(v.deltaDeg) - 90) / 90
    if (v.ratio < 0.05 || v.ratio > 20) type = '线极化'
    else if (circularity < 0.25) type = '圆极化'
    else type = '椭圆极化'

    // 投影比例
    const p = this.fieldPoint(v, this._t, 100)
    const ux = Math.cos(v.angle), uy = Math.sin(v.angle)
    const proj = Math.abs(p.x * ux + p.y * uy) / Math.max(1, Math.hypot(p.x, p.y))

    this.setData({ stats: { type, proj: proj.toFixed(2) } })
  },

  // ═══ Canvas ═══
  _queryCanvas(callback) {
    const q = wx.createSelectorQuery().in(this)
    q.select('#mainCanvas').fields({ node: true, size: true }).exec((res) => {
      if (res && res[0] && res[0].node) {
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const dpr = wx.getWindowInfo().pixelRatio
        const w = res[0].width
        const h = res[0].height
        canvas.width = Math.max(1, Math.floor(w * dpr))
        canvas.height = Math.max(1, Math.floor(h * dpr))
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        callback(ctx, w, h)
      }
    })
  },

  _arrow(ctx, x1, y1, x2, y2, color, width) {
    const a = Math.atan2(y2 - y1, x2 - x1)
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width || 2
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x2, y2)
    ctx.lineTo(x2 - 10 * Math.cos(a - 0.45), y2 - 10 * Math.sin(a - 0.45))
    ctx.lineTo(x2 - 10 * Math.cos(a + 0.45), y2 - 10 * Math.sin(a + 0.45))
    ctx.closePath(); ctx.fill()
  },

  draw() {
    this._queryCanvas((ctx, w, h) => {
      const S = this.data.S
      const v = this.vals()
      ctx.fillStyle = '#090d16'; ctx.fillRect(0, 0, w, h)

      const cx = w / 2, cy = h / 2, sc = Math.min(w, h) * 0.3

      if (S.mode === 'ellipse' || S.mode === 'match') {
        // 坐标轴
        this._arrow(ctx, cx - sc - 30, cy, cx + sc + 30, cy, '#253044', 1)
        this._arrow(ctx, cx, cy + sc + 30, cx, cy - sc - 30, '#253044', 1)

        // 极化椭圆
        ctx.beginPath()
        for (let i = 0; i <= 360; i++) {
          const p = this.fieldPoint(v, i * Math.PI * 2 / 360, sc)
          const x = cx + p.x, y = cy - p.y
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
        }
        ctx.strokeStyle = '#65e4b1'; ctx.lineWidth = 3; ctx.stroke()

        // 当前电场矢量
        const p = this.fieldPoint(v, this._t, sc)
        this._arrow(ctx, cx, cy, cx + p.x, cy - p.y, '#ffd166', 4)

        ctx.fillStyle = '#7ca0ff'; ctx.font = '12px sans-serif'; ctx.textAlign = 'left'
        ctx.fillText('Ex', cx + sc + 10, cy + 4)
        ctx.fillText('Ey', cx + 4, cy - sc - 10)

        if (S.mode === 'match') {
          // 接收天线方向线
          const ux = Math.cos(v.angle), uy = Math.sin(v.angle)
          this._arrow(ctx, cx - ux * (sc + 20), cy + uy * (sc + 20), cx + ux * (sc + 20), cy - uy * (sc + 20), '#7ca0ff', 3)
          // 投影
          const proj = p.x * ux + p.y * uy
          this._arrow(ctx, cx, cy, cx + ux * proj, cy - uy * proj, '#65e4b1', 5)
        }
      } else if (S.mode === 'reciprocity') {
        const a = { x: cx - 80, y: cy }, b = { x: cx + 80, y: cy }
        // 天线框
        ctx.fillStyle = 'rgba(13,20,34,0.96)'; ctx.strokeStyle = '#253044'; ctx.lineWidth = 1
        ctx.fillRect(a.x - 35, a.y - 55, 70, 110); ctx.strokeRect(a.x - 35, a.y - 55, 70, 110)
        ctx.fillRect(b.x - 35, b.y - 55, 70, 110); ctx.strokeRect(b.x - 35, b.y - 55, 70, 110)

        const ux = Math.cos(v.angle), uy = Math.sin(v.angle)
        this._arrow(ctx, a.x - ux * 36, a.y + uy * 36, a.x + ux * 36, a.y - uy * 36, '#7ca0ff', 4)
        this._arrow(ctx, b.x - ux * 36, b.y + uy * 36, b.x + ux * 36, b.y - uy * 36, '#65e4b1', 4)
        this._arrow(ctx, a.x + 44, a.y - 20, b.x - 44, b.y - 20, '#ffd166', 3)
        this._arrow(ctx, b.x - 44, b.y + 20, a.x + 44, a.y + 20, '#ffd166', 3)

        ctx.fillStyle = '#7ca0ff'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'
        ctx.fillText('发射', a.x, a.y + 78)
        ctx.fillStyle = '#65e4b1'
        ctx.fillText('接收', b.x, b.y + 78)
      }
    })
  },

  onShareAppMessage() {
    return { title: '极化与互易实验室', path: '/pages/interactive/polarization-reciprocity-lab/polarization-reciprocity-lab' }
  },
})

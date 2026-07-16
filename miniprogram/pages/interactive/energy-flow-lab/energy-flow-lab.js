// pages/interactive/energy-flow-lab/energy-flow-lab.js —— 电磁能流账本实验室
// 3种模式：端口功率分账 / Poynting矢量近场远场 / 电小天线Chu Q
// 统一模型：匹配→反射→接受功率→热损耗+储能+辐射

const haptic = require('../../../utils/haptic')

const MODE_LABELS = {
  budget: '端口功率分账：匹配好不等于效率高',
  field: 'Poynting 矢量：能量在场中流动',
  small: '电小天线：空间局域化带来高储能',
}
const NOTE_TEXTS = {
  budget: '匹配只解决反射问题；效率还要看损耗和近场储能。接受功率 = 1 − 反射；辐射 = 接受 − 损耗 − 储能。',
  field: '近场箭头可以往返交换（无功功率），远场箭头表示净功率离开天线。Poynting 定理保证能量守恒。',
  small: '电尺寸 ka 越小，能量越容易被困在近场储能中，带宽和效率都会受限。Qmin ≈ 1/(ka)³ + 1/(ka)。',
}

Page({
  data: {
    S: { mode: 'budget', match: 70, loss: 18, ka: 42 },
    stats: null,
    modeLabel: MODE_LABELS.budget,
    noteText: NOTE_TEXTS.budget,
  },

  onLoad() { this.update() },
  onReady() { this.update() },

  // ═══ 事件 ═══
  onMatch(e) { this.setData({ 'S.match': e.detail.value }, () => this.update()) },
  onLoss(e) { this.setData({ 'S.loss': e.detail.value }, () => this.update()) },
  onKa(e) { this.setData({ 'S.ka': e.detail.value }, () => this.update()) },
  setBudget() { haptic.light(); this.setData({ 'S.mode': 'budget', modeLabel: MODE_LABELS.budget, noteText: NOTE_TEXTS.budget }, () => this.draw()) },
  setField() { haptic.light(); this.setData({ 'S.mode': 'field', modeLabel: MODE_LABELS.field, noteText: NOTE_TEXTS.field }, () => this.draw()) },
  setSmall() { haptic.light(); this.setData({ 'S.mode': 'small', modeLabel: MODE_LABELS.small, noteText: NOTE_TEXTS.small }, () => this.draw()) },

  // ═══ 物理 ═══
  values() {
    const S = this.data.S
    const match = S.match / 100
    const loss = S.loss / 100
    const ka = S.ka / 100
    const reflected = (1 - match) * 0.42
    const accepted = 1 - reflected
    const heat = accepted * loss * 0.72
    const stored = accepted * Math.min(0.58, 0.18 / Math.max(0.08, ka))
    const radiated = Math.max(0.04, accepted - heat - stored)
    return { match, loss, ka, reflected, accepted, heat, stored, radiated }
  },

  update() {
    const v = this.values()
    this.setData({
      stats: {
        reflected: Math.round(v.reflected * 100) + '%',
        heat: Math.round(v.heat * 100) + '%',
        stored: Math.round(v.stored * 100) + '%',
        radiated: Math.round(v.radiated * 100) + '%',
      }
    })
    this.draw()
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
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width
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
      const v = this.values()
      ctx.fillStyle = '#080d14'; ctx.fillRect(0, 0, w, h)

      if (S.mode === 'budget') this._drawBudget(ctx, w, h, v)
      else if (S.mode === 'field') this._drawField(ctx, w, h, v)
      else this._drawSmall(ctx, w, h, v)
    })
  },

  _drawBudget(ctx, w, h, v) {
    // 节点位置
    const nodes = [
      { name: '输入功率', x: 60, y: h * 0.42, color: '#edf3ff' },
      { name: '反射', x: w * 0.5, y: h * 0.16, color: '#ff7a90' },
      { name: '热损耗', x: w * 0.5, y: h * 0.34, color: '#ffd166' },
      { name: '近场储能', x: w * 0.5, y: h * 0.54, color: '#7ca0ff' },
      { name: '远场辐射', x: w * 0.5, y: h * 0.74, color: '#65e4b1' },
    ]
    nodes.forEach(n => {
      ctx.fillStyle = 'rgba(13,20,34,0.95)'
      ctx.strokeStyle = n.color; ctx.lineWidth = 1.5
      ctx.beginPath()
      // roundRect 兼容
      const rx = n.x - 40, ry = n.y - 20, rw = 100, rh = 40, rr = 8
      ctx.moveTo(rx + rr, ry)
      ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, rr)
      ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, rr)
      ctx.arcTo(rx, ry + rh, rx, ry, rr)
      ctx.arcTo(rx, ry, rx + rw, ry, rr)
      ctx.closePath(); ctx.fill(); ctx.stroke()
      ctx.fillStyle = n.color; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'
      ctx.fillText(n.name, n.x, n.y + 4)
    })
    // 箭头
    const src = nodes[0]
    this._arrow(ctx, src.x + 50, src.y, nodes[1].x - 40, nodes[1].y, '#ff7a90', 2 + v.reflected * 10)
    this._arrow(ctx, src.x + 50, src.y, nodes[2].x - 40, nodes[2].y, '#ffd166', 2 + v.heat * 10)
    this._arrow(ctx, src.x + 50, src.y, nodes[3].x - 40, nodes[3].y, '#7ca0ff', 2 + v.stored * 10)
    this._arrow(ctx, src.x + 50, src.y, nodes[4].x - 40, nodes[4].y, '#65e4b1', 2 + v.radiated * 10)

    // 百分比标签
    ctx.font = '11px sans-serif'; ctx.textAlign = 'center'
    ctx.fillStyle = '#ffb0bd'; ctx.fillText('反射 ' + Math.round(v.reflected * 100) + '%', w * 0.28, h * 0.12)
    ctx.fillStyle = '#ffe29b'; ctx.fillText('损耗 ' + Math.round(v.heat * 100) + '%', w * 0.28, h * 0.30)
    ctx.fillStyle = '#aebfff'; ctx.fillText('储能 ' + Math.round(v.stored * 100) + '%', w * 0.28, h * 0.50)
    ctx.fillStyle = '#b8ffe6'; ctx.fillText('辐射 ' + Math.round(v.radiated * 100) + '%', w * 0.28, h * 0.70)
  },

  _drawField(ctx, w, h, v) {
    const cx = w * 0.5, cy = h * 0.45
    // 源
    ctx.fillStyle = '#ffd166'
    ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fill()

    // 同心环
    for (let r = 45; r <= 180; r += 35) {
      ctx.strokeStyle = r < 95 ? 'rgba(124,160,255,0.4)' : 'rgba(101,228,177,0.32)'
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
    }

    // Poynting 矢量箭头
    for (let i = 0; i < 20; i++) {
      const a = i * Math.PI * 2 / 20
      const r1 = 55 + 14 * Math.sin(i)
      const r2 = r1 + 38 + 60 * v.radiated
      const color = i % 3 === 0 ? '#7ca0ff' : '#65e4b1'
      this._arrow(ctx,
        cx + r1 * Math.cos(a), cy + r1 * Math.sin(a),
        cx + r2 * Math.cos(a), cy + r2 * Math.sin(a),
        color, 1.5 + v.radiated * 3)
    }

    ctx.fillStyle = '#aebfff'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'
    ctx.fillText('近区：储能往返交换（无功）', cx, h - 30)
    ctx.fillStyle = '#b8ffe6'
    ctx.fillText('远区：净功率外流（有功辐射）', cx, h - 14)
  },

  _drawSmall(ctx, w, h, v) {
    const x0 = 40, y0 = h - 40, pw = w - 80, ph = h - 80

    // 坐标轴
    ctx.strokeStyle = '#253044'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.rect(x0, y0 - ph, pw, ph); ctx.stroke()

    // Chu Q 曲线
    ctx.beginPath()
    for (let i = 0; i <= 200; i++) {
      const ka = 0.08 + 1.12 * i / 200
      const q = Math.min(12, 1 / Math.pow(ka, 3) + 1 / ka)
      const x = x0 + pw * i / 200
      const y = y0 - ph * q / 12
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 3; ctx.stroke()

    // 当前 ka 标记
    const qNow = Math.min(12, 1 / Math.pow(v.ka, 3) + 1 / v.ka)
    const px = x0 + pw * (v.ka - 0.08) / 1.12
    const py = y0 - ph * qNow / 12
    ctx.fillStyle = '#65e4b1'
    ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2); ctx.fill()

    // 虚线
    ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(255,255,255,0.3)'
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, y0); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(x0, py); ctx.lineTo(px, py); ctx.stroke()
    ctx.setLineDash([])

    ctx.fillStyle = '#9aa8bd'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left'
    ctx.fillText('ka →', x0 + pw - 30, y0 + 18)
    ctx.fillText('Q ↑', x0 - 4, y0 - ph - 6)
    ctx.fillStyle = '#ffd166'; ctx.font = '13px sans-serif'
    ctx.fillText('当前 Q ≈ ' + qNow.toFixed(1), x0, y0 - ph - 20)
  },

  onShareAppMessage() {
    return { title: '电磁能流账本实验室', path: '/pages/interactive/energy-flow-lab/energy-flow-lab' }
  },
})

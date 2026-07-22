// pages/tools/index.js —— 常用工具首页（数据驱动 v2：分段锚点 + 最近使用 + 双列小卡）
const haptic = require('../../utils/haptic')

const RECENT_KEY = 'tools_recent_v1'
const RECENT_MAX = 6

// ── 工具注册表（分区 + 卡片元数据）──
const SECTIONS = [
  {
    key: 'calc', name: '专用计算', en: 'CALCULATORS', compact: false,
    items: [
      { key: 'calc',  icon: 'RF', cls: 'tl-icon-calc',  name: '专用计算',     desc: 'dBm↔W · 波长 · VSWR · 趋肤深度', url: '/pages/tools/calc/calc' },
      { key: 'array', icon: '⬡', cls: 'tl-icon-array', name: '天线阵列',     desc: '方向图 · 阵列因子 · 波束扫描',   url: '/pages/tools/array/array' },
      { key: 'link',  icon: '📶', cls: 'tl-icon-link',  name: '通信链路',     desc: '弗里斯方程 · 路径损耗 · 链路预算', url: '/pages/tools/link/link' },
      { key: 'radar', icon: '⊙', cls: 'tl-icon-radar', name: 'Radar 链路',   desc: '雷达方程 · RCS · 多普勒频移',   url: '/pages/tools/radar/radar' },
      { key: 'match', icon: 'Z₀', cls: 'tl-icon-match', name: '传输线 & 匹配', desc: '微带线 · λ/4 变换器 · L 型匹配', url: '/pages/tools/match/match' },
      { key: 'smith', icon: '◎', cls: 'tl-icon-smith', name: 'Smith 圆图',   desc: '交互式阻抗图 · Γ/SWR/回波损耗', url: '/pages/tools/smith/smith' },
    ],
  },
  {
    key: 'iv', name: '交互动画', en: 'INTERACTIVE', compact: false,
    items: [
      { key: 'friis',     icon: '📡', cls: 'tl-icon-link',  name: '链路预算',   desc: 'Friis 单程 + 雷达双程 · Pr vs 距离',   url: '/pages/interactive/friis/friis' },
      { key: 'synth',     icon: '⊞', cls: 'tl-icon-array', name: '阵列综合',   desc: '均匀/余弦/汉明/切比雪夫加权',          url: '/pages/interactive/synthesis/synthesis' },
      { key: 'smithc',    icon: '◎', cls: 'tl-icon-smith', name: '阻抗圆图',   desc: '点击图面 · 实时求解 Γ / SWR / ZL',   url: '/pages/interactive/smith-chart/smith-chart' },
      { key: 'aperture',  icon: '▭', cls: 'tl-icon-array', name: '口径衍射',   desc: '矩形/圆形口径 · 照明分布 · 远场',     url: '/pages/interactive/aperture/aperture' },
      { key: 'tline',     icon: '∿', cls: 'tl-icon-link',  name: '传输线驻波', desc: 'V(z)/I(z) 分布 · Γ · SWR',           url: '/pages/interactive/transmission-line/transmission-line' },
      { key: 'pa',        icon: '⊟', cls: 'tl-icon-array', name: '相控阵扫描', desc: '波束指向 · 渐进相移 · 栅瓣检测',     url: '/pages/interactive/3d-lab/phased-array/phased-array' },
      { key: 'pol',       icon: '◯', cls: 'tl-icon-smith', name: '极化椭圆',   desc: 'Ex/Ey 分量 · 线/圆/椭圆 · 行波',     url: '/pages/interactive/3d-lab/polarization/polarization' },
      { key: 'mom',       icon: 'Z', cls: 'tl-icon-link',  name: '矩量法',     desc: '细线电流 · 阻抗矩阵热图 · 远场',     url: '/pages/interactive/moment-method/moment-method' },
      { key: 'bbm',       icon: '∿', cls: 'tl-icon-smith', name: '宽带匹配',   desc: '回波损耗曲线 · Smith 轨迹 · 带宽',   url: '/pages/interactive/broadband-matching/broadband-matching' },
      { key: 'mini',      icon: 'ka', cls: 'tl-icon-calc', name: '电小天线',   desc: 'Chu Q 下界 · 辐射电阻 · 效率',       url: '/pages/interactive/miniaturization/miniaturization' },
      { key: 'radint',    icon: '∫', cls: 'tl-icon-array', name: '辐射积分',   desc: '电流分布 → 积分路径 → 远场',         url: '/pages/interactive/radiation-integral/radiation-integral' },
      { key: 'smart',     icon: '∇', cls: 'tl-icon-radar', name: '智能天线',   desc: 'MVDR 零陷 · 目标增强 · 干扰抑制',    url: '/pages/interactive/smart-array/smart-array' },
    ],
  },
  {
    key: 'lab', name: '综合实验室', en: 'UNIFIED & 3D LABS', compact: true,
    items: [
      { key: 'r3d',    icon: '◈', cls: 'tl-icon-radar', name: '辐射方向图 3D', desc: '三维方向图 · 方向性 / HPBW',  url: '/pages/interactive/radiation-3d/radiation-3d' },
      { key: 'energy', icon: '∇·S', cls: 'tl-icon-calc', name: '能流账本',     desc: '端口分账 · Poynting 矢量',     url: '/pages/interactive/energy-flow-lab/energy-flow-lab' },
      { key: 'fourier', icon: 'F{·}', cls: 'tl-icon-array', name: '傅里叶空间', desc: '时频 · 口径 · 不确定性对偶',  url: '/pages/interactive/fourier-space-lab/fourier-space-lab' },
      { key: 'phase',  icon: '∠', cls: 'tl-icon-link',  name: '相位相干',     desc: '相量叠加 · 等光程聚焦',        url: '/pages/interactive/phase-coherence-lab/phase-coherence-lab' },
      { key: 'bound',  icon: '∂n', cls: 'tl-icon-smith', name: '边界模式',     desc: '边界条件 · 本征模式 · 格林函数', url: '/pages/interactive/boundary-mode-lab/boundary-mode-lab' },
      { key: 'polrec', icon: '⇄', cls: 'tl-icon-radar', name: '极化互易',     desc: '极化椭圆 · 收发互易',          url: '/pages/interactive/polarization-reciprocity-lab/polarization-reciprocity-lab' },
      { key: 'loop3d', icon: '◯', cls: 'tl-icon-radar', name: '小环天线',     desc: '磁偶极子 · sin²θ',   is3d: true, url: '/pages/interactive/3d-lab/loop/loop' },
      { key: 'tw3d',   icon: '→', cls: 'tl-icon-radar', name: '行波天线',     desc: '传播电流 · 端射波束', is3d: true, url: '/pages/interactive/3d-lab/traveling-wave/traveling-wave' },
      { key: 'horn3d', icon: '◁', cls: 'tl-icon-radar', name: '喇叭天线',     desc: '口径相位 · 增益估计', is3d: true, url: '/pages/interactive/3d-lab/horn/horn' },
      { key: 'dish3d', icon: '⌒', cls: 'tl-icon-radar', name: '抛物面反射器', desc: '射线追踪 · 离焦',     is3d: true, url: '/pages/interactive/3d-lab/parabolic/parabolic' },
      { key: 'ms3d',   icon: '▤', cls: 'tl-icon-radar', name: '微带贴片',     desc: '一阶尺寸 · S11',      is3d: true, url: '/pages/interactive/3d-lab/microstrip/microstrip' },
      { key: 'ch3d',   icon: '⊟', cls: 'tl-icon-radar', name: '微波暗室',     desc: '转台扫描 · 方向图采集', is3d: true, url: '/pages/interactive/3d-lab/anechoic/anechoic' },
      { key: 'dip3d',  icon: '≈', cls: 'tl-icon-radar', name: '偶极子辐射',   desc: '近场 → 远场过渡',     is3d: true, url: '/pages/interactive/3d-lab/field-anim/field-anim' },
      { key: 'as3d',   icon: 'Σ', cls: 'tl-icon-array', name: '方向图综合',   desc: 'Chebyshev · Taylor',  is3d: true, url: '/pages/interactive/3d-lab/array-synthesis/array-synthesis' },
    ],
  },
]

Page({
  data: {
    sections: SECTIONS,
    segs: SECTIONS.map(s => ({ key: s.key, name: s.name })),
    recent: [],
  },

  onShow() {
    let recent = []
    try { recent = wx.getStorageSync(RECENT_KEY) || [] } catch (e) {}
    this.setData({ recent })
  },

  // ── 卡片点击：导航 + 记录最近使用 ──
  onCard(e) {
    haptic.light()
    const { url, key, name, icon, cls } = e.currentTarget.dataset
    let recent = []
    try { recent = wx.getStorageSync(RECENT_KEY) || [] } catch (err) {}
    recent = recent.filter(r => r.key !== key)
    recent.unshift({ key, name, icon, cls, url })
    recent = recent.slice(0, RECENT_MAX)
    try { wx.setStorageSync(RECENT_KEY, recent) } catch (err) {}
    wx.navigateTo({ url })
  },

  // ── 分段锚点导航 ──
  onSeg(e) {
    haptic.light()
    const key = e.currentTarget.dataset.key
    wx.pageScrollTo({ selector: '#sec-' + key, duration: 260, offsetTop: -44 })
  },

  clearRecent() {
    haptic.light()
    try { wx.removeStorageSync(RECENT_KEY) } catch (e) {}
    this.setData({ recent: [] })
  },

  onShareAppMessage() {
    return {
      title: '天线与电磁波工程师工具箱 · 换算/链路/阵列/圆图',
      path: '/pages/tools/index',
    };
  },

  onShareTimeline() {
    return { title: '天线与电磁波工程师工具箱' };
  },
})

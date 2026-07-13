// pages/tools/match/match.js —— 传输线 & 阻抗匹配
const haptic = require('../../../utils/haptic')

const C = 299792458 // 光速 m/s

Page({
  data: {
    tabs: ['微带线', 'λ/4 变换器', 'L 型匹配', '波导截止'],
    activeTab: 0,

    // === Tab1 微带线特征阻抗 (Hammerstad-Jensen) ===
    msW: '3.0',     // 线宽 mm
    msH: '1.6',     // 介质厚度 mm
    msT: '0.035',   // 铜厚 mm
    msEr: '4.4',    // 介电常数 (FR4)
    msResult: null,

    // === Tab2 λ/4 阻抗变换器 ===
    qZin: '50',     // 源端阻抗 Ω
    qZl: '100',     // 负载阻抗 Ω
    qFreq: '2400',  // 频率 MHz
    qEr: '4.4',     // 介质 εr（算微带线波长）
    qResult: null,

    // === Tab3 L 型匹配网络 ===
    lRs: '50',      // 源电阻 Ω
    lRl: '100',     // 负载电阻 Ω
    lFreq: '2400',  // MHz
    lType: 0,       // 0=串联L并联C(高通) 1=串联C并联L(低通) 2=自动
    lResult: null,

    // === Tab4 波导截止频率 ===
    wgA: '22.86',   // 宽边 mm (WR-90 标准波导)
    wgB: '10.16',   // 窄边 mm
    wgEr: '1',      // 介质 εr (空气=1)
    wgResult: null,
  },

  switchTab(e) {
    haptic.light()
    this.setData({ activeTab: +e.currentTarget.dataset.index })
  },

  // ══════ Tab1: 微带线特征阻抗 (Hammerstad-Jensen) ══════
  onMsW(e) { this.setData({ msW: e.detail.value }) },
  onMsH(e) { this.setData({ msH: e.detail.value }) },
  onMsT(e) { this.setData({ msT: e.detail.value }) },
  onMsEr(e) { this.setData({ msEr: e.detail.value }) },

  calcMicrostrip() {
    haptic.medium()
    const W = parseFloat(this.data.msW) * 1e-3  // mm → m
    const H = parseFloat(this.data.msH) * 1e-3
    const T = parseFloat(this.data.msT) * 1e-3
    const er = parseFloat(this.data.msEr)

    if (isNaN(W) || W <= 0 || isNaN(H) || H <= 0 || isNaN(er) || er <= 0) {
      wx.showToast({ title: '参数有误', icon: 'none' }); return
    }

    // 有效宽度修正（铜厚效应）
    const Weff = W + (T > 0 ? (1.25 * T / Math.PI) * (1 + Math.log(2 * H / T)) : 0)
    const u = Weff / H

    // εeff (Hammerstad-Jensen 准静态公式)
    // εeff = (εr+1)/2 + (εr-1)/2 · F(u) · [1 + 12/u^b]
    // 简化标准式：
    const epsTerm = (er + 1) / 2 + (er - 1) / 2 / Math.sqrt(1 + 12 / u)
    // 铜厚修正 (Wheeler)
    const dEr_dlnu = (er - 1) / 2 * (1 / Math.sqrt(1 + 12 / u)) * (6 / (u * u)) / Math.pow(1 + 12 / u, 0.5)
    const frT = T > 0 ? (dEr_dlnu * 0.02 * Math.pow((Weff - W) / T, 2)) : 0
    const erEff = epsTerm - frT

    // Z₀ (Hammerstad-Jensen)
    let z0
    const fU = 6 + (2 * Math.PI - 6) * Math.exp(-Math.pow(30.666 / u, 0.7528))
    const z0Air = (60 / Math.sqrt(erEff)) * Math.log(fU / u + Math.sqrt(1 + 4 / (u * u)))
    z0 = z0Air

    // 真空阻抗按 εeff 缩放（已含在公式内）
    // 实际微带线 Z₀ 已正确

    // 有效介电常数对应的等效波长
    // λg = λ0 / √εeff
    // 这里只给出 Z₀ 和 εeff，频率相关参数在 λ/4 Tab 算

    // 特征阻抗容差提示
    let zHint
    if (z0 < 20) zHint = '低阻抗线（宽线），适合功率分配'
    else if (z0 > 120) zHint = '高阻抗线（细线），适合 RF 扼流'
    else if (Math.abs(z0 - 50) < 3) zHint = '≈ 50Ω 标准匹配线'
    else zHint = '常规微带线'

    this.setData({
      msResult: {
        z0: z0.toFixed(1),
        erEff: erEff.toFixed(3),
        wOverH: u.toFixed(2),
        hint: zHint,
      }
    })
  },

  // ══════ Tab2: λ/4 阻抗变换器 ══════
  onQZin(e) { this.setData({ qZin: e.detail.value }) },
  onQZl(e) { this.setData({ qZl: e.detail.value }) },
  onQFreq(e) { this.setData({ qFreq: e.detail.value }) },
  onQEr(e) { this.setData({ qEr: e.detail.value }) },

  calcQuarter() {
    haptic.medium()
    const zin = parseFloat(this.data.qZin)
    const zl = parseFloat(this.data.qZl)
    const f = parseFloat(this.data.qFreq) * 1e6 // MHz → Hz
    const er = parseFloat(this.data.qEr)

    if (isNaN(zin) || zin <= 0 || isNaN(zl) || zl <= 0 || isNaN(f) || f <= 0 || isNaN(er) || er <= 0) {
      wx.showToast({ title: '参数有误', icon: 'none' }); return
    }

    // λ/4 变换器特征阻抗
    const z0Q = Math.sqrt(zin * zl)

    // 自由空间波长
    const lambda0 = C / f

    // 如果是微带线，需要 εeff（这里用简化近似）
    // 给一个 εeff 近似（假设 W/H 已知则用 Tab1 的结果更准）
    // 这里用体 εr 作为上限，实际 εeff 介于 (er+1)/2 和 er 之间
    // 为了实用，取 εeff ≈ er 算自由空间 λ/4，并提示微带需修正
    const lambda0_q = lambda0 / 4

    // 带宽估计（基于 Zin/ZL 比值）
    // λ/4 变换器带宽由失配比决定
    // Γ₀ = |ZL-Zin|/(ZL+Zin)
    const gamma0 = Math.abs(zl - zin) / (zl + zin)
    // 对于单节变换器，当 Γ < 0.1 时的相对带宽约 0.3-0.5
    // 这里用经验估计
    const bwHint = gamma0 < 0.05 ? '宽带 (>40%)' : gamma0 < 0.2 ? '中等带宽 (20-40%)' : '窄带 (<20%)，建议多节'

    this.setData({
      qResult: {
        z0Q: z0Q.toFixed(1),
        lambda0Q: this.fmtLen(lambda0_q),
        lambda0: this.fmtLen(lambda0),
        gamma0: gamma0.toFixed(3),
        bwHint,
        // 微带 λ/4 需考虑 εeff，给出粗略值
        msHint: '微带线长度 = λ₀/(4√ε_eff)，ε_eff 从微带线 Tab 获取',
      }
    })
  },

  // ══════ Tab3: L 型匹配网络 ══════
  onLRs(e) { this.setData({ lRs: e.detail.value }) },
  onLRl(e) { this.setData({ lRl: e.detail.value }) },
  onLFreq(e) { this.setData({ lFreq: e.detail.value }) },
  setLType(e) { haptic.light(); this.setData({ lType: +e.currentTarget.dataset.t }) },

  calcLMatch() {
    haptic.medium()
    const rs = parseFloat(this.data.lRs)
    const rl = parseFloat(this.data.lRl)
    const f = parseFloat(this.data.lFreq) * 1e6 // MHz → Hz

    if (isNaN(rs) || rs <= 0 || isNaN(rl) || rl <= 0 || isNaN(f) || f <= 0) {
      wx.showToast({ title: '参数有误', icon: 'none' }); return
    }

    // L 型匹配网络：假设源和负载都是纯阻
    // 选择高阻端和低阻端
    const rHigh = Math.max(rs, rl)
    const rLow = Math.min(rs, rl)
    const Q = Math.sqrt(rHigh / rLow - 1)

    // 串联电抗 Xs 和并联电抗 Xp
    // 两种拓扑：
    //   低通型：串联电感 + 并联电容（对低频旁路）
    //   高通型：串联电容 + 并联电感
    const Xs = Q * rLow    // 串联臂电抗
    const Xp = rHigh / Q   // 并联臂电抗

    // 计算元件值
    const omega = 2 * Math.PI * f

    // 低通型：串联 L + 并联 C
    const L_series = Xs / omega          // H
    const C_shunt = 1 / (omega * Xp)     // F

    // 高通型：串联 C + 并联 L
    const C_series = 1 / (omega * Xs)    // F
    const L_shunt = Xp / omega           // H

    // 判断源在串联侧还是并联侧
    // 默认：串联臂接源端，并联臂接负载端（最常见）
    // 如果 R_source < R_load，则反接

    const topologyNote = rs < rl
      ? '串联臂接负载，并联臂接源（源为高阻）'
      : '串联臂接源，并联臂接负载（源为低阻）'

    this.setData({
      lResult: {
        q: Q.toFixed(2),
        xs: Xs.toFixed(1),
        xp: Xp.toFixed(1),
        lSeries: this.fmtH(L_series),
        cShunt: this.fmtF(C_shunt),
        cSeries: this.fmtF(C_series),
        lShunt: this.fmtH(L_shunt),
        topologyNote,
      }
    })
  },

  // ══════ Tab4: 波导截止频率 ══════
  onWgA(e) { this.setData({ wgA: e.detail.value }) },
  onWgB(e) { this.setData({ wgB: e.detail.value }) },
  onWgEr(e) { this.setData({ wgEr: e.detail.value }) },

  calcWaveguide() {
    haptic.medium()
    const a = parseFloat(this.data.wgA) * 1e-3  // mm → m
    const b = parseFloat(this.data.wgB) * 1e-3
    const er = parseFloat(this.data.wgEr) || 1

    if (isNaN(a) || a <= 0 || isNaN(b) || b <= 0) {
      wx.showToast({ title: '参数有误', icon: 'none' }); return
    }

    // 截止频率 TE_mn = c / (2π√εr) · √((mπ/a)² + (nπ/b)²)
    // TE10 主模：f_c = c / (2a√εr)
    const fc10 = C / (2 * a * Math.sqrt(er))
    // TE20
    const fc20 = C / (a * Math.sqrt(er))
    // TE01
    const fc01 = C / (2 * b * Math.sqrt(er))
    // TE11
    const fc11 = C / (2 * Math.sqrt(er)) * Math.sqrt(1/(a*a) + 1/(b*b))

    // 单模工作范围 (TE10 到 TE20/TE01 中较小者)
    const fUpper = Math.min(fc20, fc01)
    const bwRatio = (fUpper - fc10) / fc10 * 100

    // 标准工作频率（TE10 典型工作在 1.25~1.9 倍 fc）
    const fLowRec = 1.25 * fc10
    const fHighRec = 1.9 * fc10

    let bandName = ''
    // 标准 WR 波导命名
    if (Math.abs(a - 22.86e-3) < 0.5e-3) bandName = 'WR-90 (X 波段, 8.2-12.5 GHz)'
    else if (Math.abs(a - 15.799e-3) < 0.5e-3) bandName = 'WR-112 (C/X)'
    else if (Math.abs(a - 7.112e-3) < 0.3e-3) bandName = 'WR-112 (Ku 波段)'
    else if (Math.abs(a - 4.775e-3) < 0.2e-3) bandName = 'WR-187 (K 波段)'
    else if (Math.abs(a - 3.0988e-3) < 0.2e-3) bandName = 'WR-28 (Ka 波段)'
    else if (Math.abs(a - 86.36e-3) < 1e-3) bandName = 'WR-975 (S 波段)'

    this.setData({
      wgResult: {
        fc10: (fc10 / 1e9).toFixed(3),
        fc20: (fc20 / 1e9).toFixed(3),
        fc01: (fc01 / 1e9).toFixed(3),
        fc11: (fc11 / 1e9).toFixed(3),
        bwRatio: bwRatio.toFixed(0),
        fLowRec: (fLowRec / 1e9).toFixed(2),
        fHighRec: (fHighRec / 1e9).toFixed(2),
        bandName,
      }
    })
  },

  // ══════ 格式化 ══════
  fmtLen(m) {
    if (m >= 1) return m.toFixed(2) + ' m'
    if (m >= 1e-2) return (m * 100).toFixed(2) + ' cm'
    if (m >= 1e-3) return (m * 1000).toFixed(2) + ' mm'
    return (m * 1e6).toFixed(1) + ' μm'
  },
  fmtH(h) {
    // 电感 H → nH/μH
    if (h >= 1e-6) return (h * 1e6).toFixed(2) + ' μH'
    return (h * 1e9).toFixed(2) + ' nH'
  },
  fmtF(f) {
    // 电容 F → pF/nF
    if (f >= 1e-9) return (f * 1e9).toFixed(2) + ' nF'
    return (f * 1e12).toFixed(2) + ' pF'
  },
})

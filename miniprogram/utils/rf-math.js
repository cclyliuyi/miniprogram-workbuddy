// utils/rf-math.js —— 工具模块统一物理公式库（经核对的教科书公式）
// 参考：Balanis《Antenna Theory》4th、Pozar《Microwave Engineering》4th。
// 约定：频率一律 Hz、长度一律 m、功率线性值一律 W、角度一律 rad（除非函数名注明）。
// 页面里的一切物理计算应从这里取，禁止在页面内拼魔法系数。

// ── 物理常数 ──
const C0 = 299792458            // 真空光速 m/s
const MU0 = 4 * Math.PI * 1e-7  // 真空磁导率 H/m
const EPS0 = 8.8541878128e-12   // 真空介电常数 F/m
const ETA0 = 376.730313668      // 自由空间波阻抗 Ω

// ── dB / 功率换算 ──
const dbToLin = (db) => Math.pow(10, db / 10)          // 功率 dB → 线性
const linToDb = (x) => 10 * Math.log10(x)              // 线性 → 功率 dB
const dbmToW = (dbm) => Math.pow(10, (dbm - 30) / 10)
const wToDbm = (w) => 10 * Math.log10(w) + 30

// ── 波长 / 波数 ──
const wavelength = (fHz) => C0 / fHz
const waveNumber = (fHz) => 2 * Math.PI * fHz / C0

// ── 反射系数 · VSWR · 回波损耗 ──
const vswrFromGamma = (g) => (1 + g) / (1 - g)            // g=|Γ|<1
const gammaFromVswr = (s) => (s - 1) / (s + 1)
const rlFromGamma = (g) => -20 * Math.log10(g)            // RL(dB)>0
const gammaFromRl = (rlDb) => Math.pow(10, -rlDb / 20)
const mismatchLossDb = (g) => -10 * Math.log10(1 - g * g) // 失配损耗

// ── 复数运算（{re, im}）──
const cx = (re, im) => ({ re, im: im || 0 })
const cAdd = (a, b) => cx(a.re + b.re, a.im + b.im)
const cSub = (a, b) => cx(a.re - b.re, a.im - b.im)
const cMul = (a, b) => cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re)
const cDiv = (a, b) => {
  const d = b.re * b.re + b.im * b.im
  return cx((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d)
}
const cAbs = (a) => Math.hypot(a.re, a.im)
const cArg = (a) => Math.atan2(a.im, a.re)
const cExpJ = (phi) => cx(Math.cos(phi), Math.sin(phi))

// 复负载反射系数：Γ = (ZL − Z0)/(ZL + Z0)，Z0 实
const gammaFromZ = (zl, z0) => cDiv(cSub(zl, cx(z0)), cAdd(zl, cx(z0)))
// 由 Γ 反解归一化阻抗：z = (1+Γ)/(1−Γ)
const zFromGamma = (g) => cDiv(cAdd(cx(1), g), cSub(cx(1), g))

// ── 传输线（无耗）──
// 输入阻抗：Zin = Z0 (ZL + jZ0·tanβl)/(Z0 + jZL·tanβl)
function zinLossless(z0, zl, betaL) {
  const t = Math.tan(betaL)
  if (!isFinite(t)) return cDiv(cMul(cx(z0 * z0), cx(1)), zl) // βl=π/2: Zin=Z0²/ZL
  const num = cAdd(zl, cx(0, z0 * t))
  const den = cAdd(cx(z0), cMul(cx(0, t), zl))
  return cMul(cx(z0), cDiv(num, den))
}
// λ/4 变换器特征阻抗：Z1 = √(Z0·RL)
const quarterWaveZ = (z0, rl) => Math.sqrt(z0 * rl)

// L 型匹配（纯电阻两端）：Q = √(R大/R小 − 1)
// 串联支路 |Xs| = Q·R小，并联支路 |Xp| = R大/Q
function lMatch(rSmall, rLarge) {
  const q = Math.sqrt(rLarge / rSmall - 1)
  return { q, xSeries: q * rSmall, xParallel: rLarge / q }
}

// ── 链路 / 雷达 ──
// 自由空间路径损耗 FSPL(dB) = 20lg(4πd/λ)
const fsplDb = (fHz, dM) => 20 * Math.log10(4 * Math.PI * dM / wavelength(fHz))
// Friis：Pr(dBm) = Pt + Gt + Gr − FSPL
const friisPrDbm = (ptDbm, gtDbi, grDbi, fHz, dM) =>
  ptDbm + gtDbi + grDbi - fsplDb(fHz, dM)
// 雷达方程：Rmax = [Pt G² λ² σ / ((4π)³ Smin L)]^¼（单基地，G 收发同用）
function radarRmax(ptW, gDbi, fHz, rcsM2, sminW, lossDb) {
  const g = dbToLin(gDbi), lam = wavelength(fHz), L = dbToLin(lossDb || 0)
  return Math.pow(ptW * g * g * lam * lam * rcsM2 /
    (Math.pow(4 * Math.PI, 3) * sminW * L), 0.25)
}
// 雷达接收功率（双程）：Pr = Pt G² λ² σ / ((4π)³ R⁴ L)
function radarPrW(ptW, gDbi, fHz, rcsM2, rM, lossDb) {
  const g = dbToLin(gDbi), lam = wavelength(fHz), L = dbToLin(lossDb || 0)
  return ptW * g * g * lam * lam * rcsM2 / (Math.pow(4 * Math.PI, 3) * Math.pow(rM, 4) * L)
}
// 多普勒频移（单基地）：fd = 2·vr/λ
const dopplerShift = (fHz, vrMs) => 2 * vrMs * fHz / C0
// 最大不模糊距离 / 速度：Ru = c/(2·PRF)，|v|max = λ·PRF/4（±折叠各一半）
const unambiguousRange = (prf) => C0 / (2 * prf)
const unambiguousVel = (fHz, prf) => wavelength(fHz) * prf / 4
// 等效口径：Ae = Gλ²/4π
const effectiveAperture = (gDbi, fHz) =>
  dbToLin(gDbi) * Math.pow(wavelength(fHz), 2) / (4 * Math.PI)

// ── 材料 / 表面 ──
// 趋肤深度：δ = 1/√(π f μ σ)
const skinDepth = (fHz, sigma, muR) =>
  1 / Math.sqrt(Math.PI * fHz * MU0 * (muR || 1) * sigma)

// ── 电小天线（Chu–McLean）──
// 无耗单模下界：Qmin = 1/(ka)³ + 1/(ka)（McLean 1996）
const chuQmin = (ka) => 1 / Math.pow(ka, 3) + 1 / ka
// 由 Q 估计相对带宽（VSWR≤s）：FBW ≈ (s−1)/(Q√s)
const fbwFromQ = (q, s) => (s - 1) / (q * Math.sqrt(s || 2))
// 短偶极子辐射电阻（全长 l ≪ λ，三角形电流）：Rr = 20π²(l/λ)²
const shortDipoleRr = (lOverLambda) => 20 * Math.PI * Math.PI * lOverLambda * lOverLambda
// 电小圆环辐射电阻（面积 A，N 匝）：Rr = 320π⁴ N² (A/λ²)²
const smallLoopRr = (aOverLambda2, n) =>
  320 * Math.pow(Math.PI, 4) * (n || 1) * (n || 1) * aOverLambda2 * aOverLambda2

// ── 阵列 ──
// 均匀直线阵归一化阵因子（幅度）：|AF| = |sin(Nψ/2)/(N·sin(ψ/2))|
// ψ = kd·sinθ + β（θ 为偏离法向角，β 为渐进相移）
function afUniform(nEl, psi) {
  const half = psi / 2
  const s = Math.sin(half)
  if (Math.abs(s) < 1e-9) return 1
  return Math.abs(Math.sin(nEl * half) / (nEl * s))
}
// 任意实权重阵因子（幅度，对称权重）：|Σ w_n e^{jnψ}| / Σw
function afWeighted(weights, psi) {
  let re = 0, im = 0, sum = 0
  for (let n = 0; n < weights.length; n++) {
    re += weights[n] * Math.cos(n * psi)
    im += weights[n] * Math.sin(n * psi)
    sum += weights[n]
  }
  return Math.hypot(re, im) / sum
}
// 扫描角 θ0 所需渐进相移：β = −kd·sinθ0
const scanPhase = (kd, theta0) => -kd * Math.sin(theta0)
// 不出栅瓣的最大间距：d/λ < 1/(1+|sinθ0|)
const gratingLobeLimit = (theta0) => 1 / (1 + Math.abs(Math.sin(theta0)))
// 均匀线阵半功率波束宽度（宽边、大 N 近似）：HPBW ≈ 0.886·λ/(N·d)（rad）
const hpbwUniformApprox = (nEl, dLambda) => 0.886 / (nEl * dLambda)

// Dolph–Chebyshev 权重：N 元，副瓣电平 sllDb（正数，如 25 表示 −25 dB）
// 方法：以 ψ_k = 2πk/N 采样切比雪夫方向图 T_{N−1}(x0·cos(ψ/2))，做逆 DFT。
function chebyshevWeights(nEl, sllDb) {
  const m = nEl - 1
  const R = Math.pow(10, sllDb / 20)
  const x0 = Math.cosh(Math.acosh(R) / m)
  const T = (x) => {
    if (Math.abs(x) <= 1) return Math.cos(m * Math.acos(x))
    const s = x < -1 && m % 2 ? -1 : 1
    return s * Math.cosh(m * Math.acosh(Math.abs(x)))
  }
  const w = []
  for (let n = 0; n < nEl; n++) {
    let acc = 0
    for (let k = 0; k < nEl; k++) {
      const psi = 2 * Math.PI * k / nEl
      acc += T(x0 * Math.cos(psi / 2)) * Math.cos(n * psi - m * psi / 2)
    }
    w.push(acc / nEl)
  }
  const peak = Math.max(...w.map(Math.abs))
  return w.map((v) => v / peak)
}
// 常用窗权重：uniform / cosine / hamming
function taperWeights(nEl, kind) {
  const w = []
  for (let n = 0; n < nEl; n++) {
    const t = nEl === 1 ? 0 : n / (nEl - 1)
    if (kind === 'cosine') w.push(Math.sin(Math.PI * t) || Math.sin(Math.PI * (t + 1e-9)))
    else if (kind === 'hamming') w.push(0.54 - 0.46 * Math.cos(2 * Math.PI * t))
    else w.push(1)
  }
  if (kind === 'cosine') { // cos 窗端点为 0，避免全零
    for (let n = 0; n < nEl; n++) w[n] = Math.max(w[n], 1e-4)
  }
  return w
}

// ── 口径 ──
// 均匀圆口径（直径 D）远场：F(θ) = 2·J1(u)/u，u = πD·sinθ/λ
// 均匀矩形口径（宽 a）：F(θ) = sinc(u)，u = πa·sinθ/λ
const sinc = (x) => (Math.abs(x) < 1e-9 ? 1 : Math.sin(x) / x)
// 圆口径增益（口径效率 eta）：G = eta·(πD/λ)²
const circAperGain = (dM, fHz, eta) =>
  (eta == null ? 1 : eta) * Math.pow(Math.PI * dM / wavelength(fHz), 2)
// 圆口径 HPBW ≈ 1.02·λ/D（rad，均匀照射）；首零点 1.22·λ/D
const circAperHpbw = (dM, fHz) => 1.02 * wavelength(fHz) / dM
// Bessel J1（Numerical Recipes 有理近似，|误差|<1e-7）
function besselJ1(x) {
  const ax = Math.abs(x)
  let ans
  if (ax < 8) {
    const y = x * x
    const p1 = x * (72362614232.0 + y * (-7895059235.0 + y * (242396853.1 +
      y * (-2972611.439 + y * (15704.48260 + y * (-30.16036606))))))
    const p2 = 144725228442.0 + y * (2300535178.0 + y * (18583304.74 +
      y * (99447.43394 + y * (376.9991397 + y))))
    ans = p1 / p2
  } else {
    const z = 8 / ax, y = z * z, xx = ax - 2.356194491
    const p1 = 1.0 + y * (0.183105e-2 + y * (-0.3516396496e-4 +
      y * (0.2457520174e-5 + y * (-0.240337019e-6))))
    const p2 = 0.04687499995 + y * (-0.2002690873e-3 + y * (0.8449199096e-5 +
      y * (-0.88228987e-6 + y * 0.105787412e-6)))
    ans = Math.sqrt(0.636619772 / ax) * (Math.cos(xx) * p1 - z * Math.sin(xx) * p2)
    if (x < 0) ans = -ans
  }
  return ans
}

// ── 微带线（Hammerstad，Pozar 4th §3.8）──
// 分析：给定 W/h、εr → (εeff, Z0)
function microstripAnalyze(wOverH, er) {
  const u = wOverH
  const ee = (er + 1) / 2 + (er - 1) / 2 / Math.sqrt(1 + 12 / u)
  let z0
  if (u <= 1) {
    const eeNarrow = (er + 1) / 2 + (er - 1) / 2 * (1 / Math.sqrt(1 + 12 / u) + 0.04 * (1 - u) * (1 - u))
    z0 = 60 / Math.sqrt(eeNarrow) * Math.log(8 / u + u / 4)
    return { epsEff: eeNarrow, z0 }
  }
  z0 = 120 * Math.PI / (Math.sqrt(ee) * (u + 1.393 + 0.667 * Math.log(u + 1.444)))
  return { epsEff: ee, z0 }
}
// 综合：给定 Z0、εr → W/h（Wheeler–Hammerstad）
function microstripSynthesize(z0, er) {
  const A = z0 / 60 * Math.sqrt((er + 1) / 2) + (er - 1) / (er + 1) * (0.23 + 0.11 / er)
  const wOverH_A = 8 * Math.exp(A) / (Math.exp(2 * A) - 2)
  if (wOverH_A < 2) return wOverH_A
  const B = 377 * Math.PI / (2 * z0 * Math.sqrt(er))
  return 2 / Math.PI * (B - 1 - Math.log(2 * B - 1) +
    (er - 1) / (2 * er) * (Math.log(B - 1) + 0.39 - 0.61 / er))
}
// 微带波导波长：λg = λ0/√εeff
const guidedLambda = (fHz, epsEff) => wavelength(fHz) / Math.sqrt(epsEff)

// ── 矩形微带贴片一阶设计（Balanis 4th §14.2）──
// 输入 f(Hz)、εr、基板厚 h(m) → { W, L, epsEff, dL }
function patchDesign(fHz, er, hM) {
  const W = C0 / (2 * fHz) * Math.sqrt(2 / (er + 1))
  const ee = (er + 1) / 2 + (er - 1) / 2 / Math.sqrt(1 + 12 * hM / W)
  const dL = 0.412 * hM * (ee + 0.3) * (W / hM + 0.264) /
    ((ee - 0.258) * (W / hM + 0.8))
  const L = C0 / (2 * fHz * Math.sqrt(ee)) - 2 * dL
  return { W, L, epsEff: ee, dL }
}

// ── 喇叭 / 反射面 ──
// 口径天线增益（效率 eta）：G = eta·4πA/λ²
const apertureGain = (areaM2, fHz, eta) =>
  (eta == null ? 0.6 : eta) * 4 * Math.PI * areaM2 / Math.pow(wavelength(fHz), 2)

// ── 极化 ──
// 轴比（dB）：AR = 20lg(长轴/短轴)，圆极化 AR=0dB，线极化 AR→∞
// 由 Ex/Ey 幅度比 r 与相位差 δ 求椭圆长短轴（Balanis §4.4）
function polarizationEllipse(exAmp, eyAmp, deltaRad) {
  const a = exAmp * exAmp, b = eyAmp * eyAmp
  const term = Math.sqrt((a - b) * (a - b) + 4 * a * b * Math.cos(deltaRad) * Math.cos(deltaRad))
  const major = Math.sqrt(0.5 * (a + b + term))
  const minor = Math.sqrt(Math.max(0, 0.5 * (a + b - term)))
  // 长轴倾角：tan2τ = 2ExEy·cosδ/(Ex²−Ey²)
  const tilt = 0.5 * Math.atan2(2 * exAmp * eyAmp * Math.cos(deltaRad), a - b)
  const arDb = minor < 1e-12 ? Infinity : 20 * Math.log10(major / minor)
  return { major, minor, tilt, arDb }
}

// ── 单位格式化 ──
function fmtFreq(hz) {
  if (hz >= 1e9) return trim(hz / 1e9) + ' GHz'
  if (hz >= 1e6) return trim(hz / 1e6) + ' MHz'
  if (hz >= 1e3) return trim(hz / 1e3) + ' kHz'
  return trim(hz) + ' Hz'
}
function fmtLen(m) {
  if (m >= 1e3) return trim(m / 1e3) + ' km'
  if (m >= 1) return trim(m) + ' m'
  if (m >= 1e-2) return trim(m * 100) + ' cm'
  if (m >= 1e-3) return trim(m * 1e3) + ' mm'
  return trim(m * 1e6) + ' μm'
}
function fmtPow(w) {
  if (w >= 1e3) return trim(w / 1e3) + ' kW'
  if (w >= 1) return trim(w) + ' W'
  if (w >= 1e-3) return trim(w * 1e3) + ' mW'
  if (w >= 1e-6) return trim(w * 1e6) + ' μW'
  if (w >= 1e-9) return trim(w * 1e9) + ' nW'
  return w.toExponential(2) + ' W'
}
function trim(v) {
  const a = Math.abs(v)
  const s = a >= 100 ? v.toFixed(1) : a >= 10 ? v.toFixed(2) : v.toFixed(3)
  return s.replace(/\.?0+$/, '')
}

module.exports = {
  C0, MU0, EPS0, ETA0,
  dbToLin, linToDb, dbmToW, wToDbm,
  wavelength, waveNumber,
  vswrFromGamma, gammaFromVswr, rlFromGamma, gammaFromRl, mismatchLossDb,
  cx, cAdd, cSub, cMul, cDiv, cAbs, cArg, cExpJ, gammaFromZ, zFromGamma,
  zinLossless, quarterWaveZ, lMatch,
  fsplDb, friisPrDbm, radarRmax, radarPrW,
  dopplerShift, unambiguousRange, unambiguousVel, effectiveAperture,
  skinDepth,
  chuQmin, fbwFromQ, shortDipoleRr, smallLoopRr,
  afUniform, afWeighted, scanPhase, gratingLobeLimit, hpbwUniformApprox,
  chebyshevWeights, taperWeights,
  sinc, circAperGain, circAperHpbw, besselJ1,
  microstripAnalyze, microstripSynthesize, guidedLambda, patchDesign,
  apertureGain, polarizationEllipse,
  fmtFreq, fmtLen, fmtPow,
}

# 交互模块移植可行性评估报告

> 源项目：`D:\Claude\数字教材\AntennasAndPropagation\web\public\modules\`
> 目标项目：天线与电磁波知识日历（微信小程序）

## 一、源项目概况

数字教材共有 **27 个可交互模块**，全部以独立 HTML 文件形式存在于 `public/modules/` 目录，通过 Next.js 的 `<ModuleFrame>` 组件以 iframe 嵌入。

### 技术栈分布

| 技术栈 | 数量 | 占比 | 说明 |
|--------|------|------|------|
| **纯 Canvas2D** | 16 个 | 59% | 用 `<canvas>` + `getContext('2d')` 绘制，无 3D 依赖 |
| **Three.js 3D** | 10 个 | 37% | 用 WebGL + Three.js 渲染三维场景，含 OrbitControls 交互 |
| **特殊依赖** | 1 个 | 4% | calculator 依赖 Pyodide（Python WASM），无法直接移植 |

### 三条移植路线

| 路线 | 方案 | 适用范围 | 体验 | 工作量 |
|------|------|----------|------|--------|
| **A. 原生重写** | 用小程序 Canvas 2D API 重写 | 16 个 Canvas2D 模块 | 最佳 | 中 |
| **B. web-view 嵌入** | HTML 原样部署到 HTTPS 服务器，用 `<web-view>` 加载 | 10 个 Three.js 3D 模块 | 一般（有割裂感） | 小 |
| **C. 降维重写** | 将 3D 模块简化为 2D 极坐标/截面图重写 | phased-array, polarization 等 | 良好 | 大 |

## 二、逐模块可行性分析

### 第一梯队：低难度 Canvas2D（推荐首批移植）

这 5 个模块的移植难度最低——纯数学计算 + Canvas2D 绘图，代码逻辑可直接翻译为小程序的 `canvas.getContext('2d')` API。

| # | 模块 | 文件 | 功能 | 源码行数 | 移植要点 |
|---|------|------|------|----------|----------|
| 1 | **friis** | friis.html | Friis传输/雷达方程链路预算 | ~280行 | 滑块参数 + Canvas绘曲线图，数学逻辑 `pr = pt + gt + gr + 20log10(λ/4πR)` 可直接复制 |
| 2 | **synthesis** | synthesis.html | 方向图综合与加权（均匀/余弦/二项式/切比雪夫） | ~250行 | 按钮切换加权类型 + Canvas绘极坐标方向图 |
| 3 | **aperture** | aperture.html | 口径场分布与波束宽度 | ~320行 | 滑块调口径尺寸 + Canvas绘方向图和口径分布 |
| 4 | **smith-chart** | smith-chart.html | Smith 阻抗圆图 | ~450行 | Canvas 绘等阻/等抗圆弧 + 频率扫描点标记 |
| 5 | **transmission-line** | transmission-line.html | 传输线电压/驻波分布 | ~240行 | 滑块调频率/负载 + Canvas 绘驻波包络 |

**预估工作量**：每个约 1-2 天（含 wxml 控件 + canvas 绑定 + 触摸交互适配）

### 第二梯队：中等难度 Canvas2D

| # | 模块 | 功能 | 难点 |
|---|------|------|------|
| 6 | moment-method | 矩量法矩阵求解 | 需实现矩阵求逆（或用数值库），绘制电流分布 |
| 7 | broadband-matching | 宽带匹配 + Smith轨迹 | 与 smith-chart 联动，多频点扫描 |
| 8 | miniaturization | 小型化 Chu Q 下界 | 多参数耦合 + 对数坐标 |
| 9 | radiation-integral | 辐射积分与源分布 | 数值积分（Simpson）+ 极坐标远场 |
| 10 | smart-array | 自适应零陷波束形成 | MVDR/Capon 算法 + 矩阵求逆 |

### 第三梯队：高难度 Canvas2D（跨章节综合实验室）

| # | 模块 | 功能 | 难点 |
|---|------|------|------|
| 11 | energy-flow-lab | 电磁能流账本 | 多面板联动：端口匹配+近场储能+远场辐射 |
| 12 | fourier-space-lab | 傅里叶空间实验室 | 4 种傅里叶对偶（时频/口径方向图/阵列栅瓣/不确定性） |
| 13 | phase-coherence-lab | 相位相干实验室 | 相量叠加 + 阵列扫描 + 等光程聚焦 |
| 14 | boundary-mode-lab | 边界模式格林函数 | 边界条件 + 模式筛选 + 点源叠加 + 对称约束 |
| 15 | polarization-reciprocity-lab | 极化与互易 | 电场矢量轨迹 + 接收投影 + 收发互易 |

### Three.js 3D 模块（需 web-view 或降维）

| # | 模块 | 功能 | 可否降维 |
|---|------|------|----------|
| 16 | **phased-array** | 相控阵 3D 波束扫描 | 可降为 2D 极坐标方向图 |
| 17 | **polarization** | 极化椭圆 3D | 可降为 2D 椭圆 + 电场矢量旋转 |
| 18 | index (辐射方向图) | 3D 方向图渲染器 | 核心功能就是 3D，降维损失大 |
| 19 | field-anim | GLSL 着色器偶极子场动画 | 使用自定义 GLSL 着色器，无法降维 |
| 20 | anechoic | 虚拟暗室 3D | 核心是 3D 场景，降维损失大 |
| 21 | horn | 喇叭天线 3D | 可降为 2D 口径截面 |
| 22 | loop | 环形天线 3D | 可降为 2D 极坐标方向图 |
| 23 | microstrip | 微带贴片 3D | 可降为 2D 尺寸计算器（已有类似工具页） |
| 24 | parabolic | 抛物面 3D 射线追踪 | 可降为 2D 截面射线图 |
| 25 | traveling-wave | 行波天线 3D | 可降为 2D 电流+方向图 |
| 26 | array-synthesis | 阵列综合 3D | 可降为 2D（与 synthesis 合并） |

### 不可移植

| # | 模块 | 原因 | 替代方案 |
|---|------|------|----------|
| 27 | calculator | 依赖 Pyodide（浏览器内 Python WASM） | 用 JS 重写计算公式（方向性、辐射电阻等纯数学） |

## 三、小程序适配关键点

### 1. Canvas API 差异

Web 端 Canvas2D 与小程序 Canvas 2D API 的主要区别：

| Web 端 | 小程序端 | 备注 |
|--------|----------|------|
| `document.getElementById('canvas')` | `wx.createSelectorQuery().select('#canvas')` | 异步获取节点 |
| `canvas.getContext('2d')` | `canvas.getContext('2d')` | 基本一致 |
| `canvas.width = 800` | 需通过 `dpr` 手动设 | 小程序需 `canvas.width = res[0].width * dpr` |
| `requestAnimationFrame` | `canvas.requestAnimationFrame()` | 小程序专用 |
| DOM 事件 (`addEventListener`) | `bindtouchstart/move/end` | 改用 WXML 事件绑定 |
| `<input type="range">` | `<slider>` | 小程序原生 slider 组件 |
| `<button>` | `<button>` 或 `<view bindtap>` | 基本一致 |

### 2. 触摸交互适配

Web 端的鼠标交互需改为触摸事件：

```javascript
// Web 端
canvas.addEventListener('mousemove', e => { /* 拖动逻辑 */ });

// 小程序端
// WXML: <canvas bindtouchstart="onTouchStart" bindtouchmove="onTouchMove" bindtouchend="onTouchEnd" />
// JS:
onTouchMove(e) {
  const touch = e.touches[0];
  // e.touches[0].x / .y 已是 canvas 内坐标
}
```

### 3. 横屏支持

小程序支持页面级横屏，在 `page.json` 中配置：
```json
{ "pageOrientation": "landscape" }
```
或在 JS 中动态切换：
```javascript
wx.setPageOrientation({ value: 'landscape' });
```

### 4. 分包管理

每个交互模块约 8-25KB 源码 + canvas 绘图代码，建议：
- 每个模块独立分包（root: `pages/interactive/xxx`）
- 主包只放交互入口列表页（tabBar）
- 预加载规则按需配置

## 四、推荐实施计划

### 第一期（2-3 周）：原生重写 5 个核心模块

选择标准：**低难度 + 高教学价值 + 与现有工具页互补**

1. **friis** — 链路预算（你已有 link 工具页，这个更完整：含雷达双程模式）
2. **synthesis** — 方向图综合（阵列加权可视化，教学价值高）
3. **smith-chart** — Smith 圆图（你已有 smith 工具页，可大幅升级）
4. **aperture** — 口径场波束（补充口径天线知识）
5. **transmission-line** — 传输线驻波（补充传输线理论）

### 第二期（3-4 周）：中难度模块 + 3D 降维

6. phased-array（降维为 2D 极坐标方向图）
7. polarization（降维为 2D 椭圆动画）
8. moment-method（矩量法）
9. broadband-matching（匹配 + Smith 轨迹）

### 第三期（视需求）：web-view 嵌入 3D

- 需先配置 HTTPS 业务域名 + ICP 备案
- 将 3D HTML 文件部署到服务器
- 用 `<web-view>` 加载

## 五、技术风险与限制

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 小程序 Canvas 2D 性能 | 复杂动画可能卡顿 | 用 `type="2d"` 新版 Canvas，控制重绘频率 |
| 小程序包体限制 | 主包 2MB、总 20MB | 每个交互模块独立分包 |
| Three.js 无法直接运行 | 3D 模块受限于 web-view | 优先降维或用 web-view |
| 触摸精度 | 手机触摸不如鼠标精确 | 增大滑块/按钮触控区域 |
| 计算性能 | 矩阵求逆等计算密集 | 用 Worker 或预计算查找表 |

## 六、结论

**总体可行性：高。** 27 个模块中，16 个可以原生重写（占 59%），体验优于 Web 端。建议分三期实施，第一期先做 5 个低难度高价值模块，验证可行性后再逐步扩展。

你的小程序已有"工具"tabBar（含 calc/link/smith 等），新增"交互"tabBar 可以形成互补：工具页是快速计算，交互页是深度可视化探索。

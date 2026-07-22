# 深空暖金实验室 · 批量推广 + calc 工具样板

> 2026-07-21 · horn 样板 → 全部 3D 页 + 工具页「深入浅出」样板

## 一、批量推广（已完成 · 10 个 3D 页 + 1 个公共模块）

### 新增公共模块

| 文件 | 内容 |
|------|------|
| `pages/interactive/3d-lab/lab3d-stage.js` | COL 色板 / buildStage（天穹+极坐标地面+光环）/ buildLights（三灯）/ clearGroup（几何+材质销毁）/ saveHome / resetView / scheduleIdle / 触摸三件套 / throttle / ready / clearTimers |

`loop.wxss` 追加公共舞台样式（canvas-wrap 深空渐变、hint 淡出、骨架屏），**10 页经 import 链全部继承**；`horn.wxss` 回归纯引用；`horn.js` 重构为调用模块（消灭自己那份拷贝）。

### 每页落地的改造（10/10 页）

| 页面 | 舞台 | 相机一次 | 双击复位 | 闲置自转 | 骨架屏 | slider 节流+暖色 | 2D 色系 | 备注 |
|------|------|---------|---------|---------|--------|-----------------|---------|------|
| horn（样板重构） | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 改用公共模块 |
| loop | ✅ -1.0 | ✅ 原本就在 init | ✅ | ✅ | ✅ | ✅ ×3 | ✅ | 环 metalness 0.65→0.45 |
| traveling-wave | ✅ -0.85 | ✅ 修相机拽回 | ✅ | ✅ | ✅ | ✅ ×3 | ✅ | |
| parabolic | ✅ -3.4 ×1.8 | ✅ 修相机拽回 | ✅ | ✅ | ✅ | ✅ ×3 | ✅ | 盘面 metalness 0.76→0.45 |
| microstrip | ✅ -0.14 | ✅ 修相机拽回 | ✅ | ✅ | ✅ | ✅ ×4 | ✅ | 场线色系统一 |
| polarization | ✅ -0.55 | ✅ 原本就在 init | ✅ | ✅ | ✅ | ✅ ×3 | ✅ | |
| array-synthesis | ✅ -2（替换 GridHelper） | ✅ | ✅ | ✅ | ✅ | ✅ ×3 | ✅ | |
| phased-array | ✅ -1.4（替换 GridHelper） | ✅ | ✅ | ✅ | ✅ | ✅ ×3 | ✅ | |
| anechoic | ✅ 仅穹顶（暗室自带地板） | ✅ | ✅ | ✅ | ✅ | ✅ ×2 | 原本就是暖纸风 ✓ | 保留 PointLight 侧补 |
| field-anim | 保留 shader 自带氛围 | —（无轨道） | — | — | ✅ | ✅ ×2 | — | 顺手删掉失效的"拖动旋转"提示 |
| radiation-3d | ✅ 仅穹顶+自有网格改暖金 | ✅ | ✅ | 手动开关（已有） | ✅ | ✅ ×2 | — | 修 onShow 不恢复 bug |

### 顺手修的原 bug（累计 6 个）

1. horn：波前 8 环共享材质 → 呼吸动画从未生效
2. horn/全页：onHide 后渲染循环不恢复
3. horn/traveling-wave/parabolic/microstrip：拖 slider 相机被拽回初始位
4. radiation-3d：onShow 仅在 rotate 时恢复动画
5. field-anim：提示"单指拖动旋转视角"但页面根本没有手势（空 handler）
6. 9 页 clearGroup 只 dispose geometry 不 dispose material（GPU 泄漏）

### 验证

- 12 个改动 JS 文件 `node --check` 全过
- 10 页 showHint/glReady 数据与 WXML 绑定一致（field-anim 无 hint 为刻意）
- 待真机过目：各页场景氛围、地面位置（各页 groundY 按模型尺度单独设定）

## 二、工具页「深入浅出」样板（calc 专用计算）

新增三种教学组件（`calc.wxss`，可直接复用到其余 5 页）：

| 组件 | 说明 | 示例 |
|------|------|------|
| `.tc-chips` 锚点 | 一键填入典型值，学数量级 | 433/915/2.4G/5.8G；VSWR 1.1~3.0 |
| `.tc-insight` 直觉卡 | 鼠尾草绿渐变卡，一句话物理直觉 + 工程经验 | "VSWR 1.5 只反射 4% —— 工程够用" |
| `.tc-grade` 质量分级 | 结果语义化：优/良/可用/失配（绿/金/赤陶） | VSWR 实时评级 |

六个面板全部配齐直觉文案；dBm/频率/VSWR 三个面板配锚点 chips。

### 待推广（其余 5 个工具页）

array / link / radar / match / smith 都是输入框驱动（无 slider），建议确认 calc 样板后按同配方批量：锚点 + 直觉卡 + 分级。

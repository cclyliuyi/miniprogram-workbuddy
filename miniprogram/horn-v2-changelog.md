# horn 样板页改造 · Before / After

> 深空暖金实验室方向 · 2026-07-21
> 改动文件：`pages/interactive/3d-lab/horn/horn.js`（重写）、`horn.wxml`（骨架屏/提示/slider）、`horn.wxss`（horn 专属覆盖）
> 未改动：共享的 `loop.wxss`（其余 6 页仍在用）、`orbit-controls.js`

## 场景质感（P0）

| # | Before | After |
|---|--------|-------|
| 1 | 平涂 `#2a2e3a` 死蓝灰底 | 深空渐变天穹（球壳顶点色，视线后方 `#454b63` 高斯光晕带 → 边缘 `#161a26`） |
| 2 | 物体悬浮虚空 | 暖金极坐标地面（5 圈 + 12 辐条）+ 3 层加色混合接触光环 |
| 3 | metalness 0.78 无 envMap → 发闷发灰 | metalness 0.45 + 微暖自发光托底 + 四棱线高光勾边 |
| 4 | 三灯全暖色、无层次 | 主光暖白 1.15 / 轮廓暖金 0.85 / 底部青蓝补光 0.45 |
| 5 | 口径相位 = 900 颗粒点云 | PlaneBufferGeometry 连续 vertexColors 色面（同相位公式） |
| 6 | 波前白线单层、共享 material（呼吸动画实际互相覆盖，是个 bug） | 每环独立 material，暖金加色混合 + 纵深衰减 0.50→0.18，呼吸动画真正生效 |

## 交互与性能（P1）

| # | Before | After |
|---|--------|-------|
| 7 | slider 只有 `bindchange`（松手才变） | `bindchanging` 55ms 节流实时重建 + 松手精修，拖动丝滑 |
| 8 | **拖 slider 会把相机拽回初始位**（layout3d 每次重设 camera） | 相机只初始化一次，用户视角不被打断 |
| 9 | 手势提示常驻 | 2.4s 自动淡出（opacity transition） |
| 10 | 无视角复位 | 双击画布复位（阻尼动画回 home 视角 + 轻震动反馈） |
| 11 | 无展示模式 | 闲置 3s auto-rotate 缓慢自转，触摸即停 |
| 12 | WebGL 初始化白屏 200~500ms | 深空渐变骨架屏（暖金转环 + 提示文字） |
| 13 | slider 微信默认绿色 | 暖金 activeColor + 赤陶 block |
| 14 | 2D 图 `#0a0c16` 深蓝黑 + 亮蓝绿 | `#1c2130` 与 3D 同系，曲线降饱和 `#6c88e8/#3ec9a7` + 曲线下淡填充 |
| 15 | onHide 停动画后**回来不再转**（原 bug） | onShow 自动恢复渲染循环 + 闲置计时 |

## 顺手修的 3 个原 bug

1. **波前共享材质**：8 环共用一个 material，`forEach` 里逐环设 opacity 实际全部被最后一环覆盖——呼吸动画从未真正工作过
2. **onHide 后画面冻结**：原代码 stopAnim 后无恢复路径
3. **拖 slider 相机被拽回**：layout3d 无条件 `camera.position.set`

## 批量推广提示（后续 9 页）

- `buildStage()`（天穹+地面+光环）与 `buildLights()` 是自包含的，可直接抽到 `3d-lab/lab3d-stage.js` 供其余页面复用
- 交互三件套（双击复位/闲置自转/提示淡出）依赖 `controls._targetSpherical`，推广时一并抽公共 mixin
- `field-anim` 背景色 `0x05070f` 与其余 9 页不一致，批量时统一

## 验证清单（真机/模拟器过目）

- [ ] 首次进入有骨架屏，随后深空场景淡入
- [ ] 拖动 slider 数值实时变化、几何实时重建、**相机不动**
- [ ] 双击画布视角阻尼复位
- [ ] 静置 3s 后场景缓慢自转，触摸即停
- [ ] 2.4s 后底部提示淡出
- [ ] 2D 方向图 E/H 面曲线正常、有淡填充

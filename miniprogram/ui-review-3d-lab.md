# 小程序前端 UI 评审 · 3D 实验室专项

> 评审范围：工具模块首页 `pages/tools/index` + 10 个 3D 实验室（`pages/interactive/3d-lab/*`、`radiation-3d`）
> 评审方式：静态代码走查（wechatide 不可用，未做模拟器截图）

## 0. 总体评价

先说好的——这个小程序的设计底子**远超平均水平**：

- 设计系统 token 化（`--paper/--ink/--accent`），暖色纸感编辑风统一
- 有完整暗色模式、`prefers-reduced-motion` / `reduced-transparency` 无障碍降级
- 动画体系规范（spring 曲线、rise/pop 进场、时长分级）
- 3D 用 three.js + OrbitControls 且开了 damping，分包与 preloadRule 策略合理

**问题集中在：3D 场景"质感"与全局暖纸风脱节，以及工具首页信息密度过低。**

## 1. 3D 实验室核心问题（用户痛点）

| # | 问题 | 证据（代码位置） | 影响 |
|---|------|------------------|------|
| 1 | **平涂死蓝灰底，无地面/网格/阴影**，物体悬浮虚空 | `setClearColor(0x2a2e3a)` ×9 页；horn.js 无地面元素 | 廉价感最大来源，"积木悬浮" |
| 2 | **金属无环境反射**：metalness 0.78 但无 envMap（threejs-miniprogram r108 不支持 PMREM） | horn.js `MeshStandardMaterial` | 铜壁发闷发灰 |
| 3 | **口径相位用 Points 点云**（size 0.014，30×30 颗粒） | horn.js layout3d | 颗粒感强，不连续 |
| 4 | **三套色系打架**：全局暖纸米白 → 3D 画布冷蓝灰 → 2D 图 `#0a0c16` 亮蓝绿 | loop.wxss / horn.js drawPattern | 页面内"跳戏" |
| 5 | **几何重建未节流**：slider 每次 change 全量 clearGroup+rebuild | horn.js onA/onR/onTap → layout3d | 拖动卡顿、低端机掉帧 |
| 6 | **背景色不统一**：field-anim 用 `0x05070f`，其余 `0x2a2e3a` | 9 份 grep | 维护随意 |
| 7 | **10 个实验室场景代码各写一份**（352~613 行/个），灯光/相机/renderer/dispose 重复 10 次 | 3d-lab/* | 重复造轮子，改一处要改十处 |
| 8 | 手势提示常驻；无视角复位、无 auto-rotate 展示模式 | horn.wxml lab3d-hint | 交互细节糙 |
| 9 | slider 用微信默认样式（绿色），与暖纸风不搭 | horn.wxml slider 无定制色 | 细节跳色 |
| 10 | WebGL 初始化无 loading 态（initThree 异步 200~500ms 白屏） | horn.js initThree | 首屏体验断点 |

## 2. 工具首页问题

| # | 问题 | 说明 |
|---|------|------|
| 1 | **26 张卡片单列瀑布**，一屏仅 ~2.5 张，找"微波暗室"要滚 6~7 屏 | 信息密度过低 |
| 2 | **图标语义混乱**：6 种色板复用，8 个 3D 实验室全用 `tl-icon-radar`；emoji（📶）与几何字符（⬡◁⌒▤）混排，iOS/Android 渲染不一致 | 视觉降噪 |
| 3 | 分区标题层级弱，无吸顶锚点/分段控制 | 导航成本高 |
| 4 | 无"最近使用/收藏置顶"（数据已有 progress.js/favs） | 复访效率低 |
| 5 | `custom-tab-bar/` 目录存在但 app.json 未启用 `"custom": true` | 死代码或半拉子工程 |

## 3. 优化方案（分层）

### P0 · 3D 场景质感（先做，收益最大）

技术约束：threejs-miniprogram 是 **r108**，无 PMREM/envMap/后处理。提升靠**构图+灯光+材质+色彩**，不靠 shader。

1. **场景氛围统一改造**（抽公共模块 `lab3d-stage.js`）：
   - 背景：径向渐变（中心 `#454b63` → 边缘 `#161a26`，用大球壳 BackSide 或 scene.background 渐变贴图）
   - 地面：PolarGridHelper 改暖金色低透明度 + 径向渐变"光环"plane 做接触影
   - 可探索 r108 的 shadowMap（basic PCF）——真机验证性能后决定
2. **色彩对接设计系统**：暖铜主体 `#d49858→#e9bd82` 双调、暖金高光 `#f6d9a8`、数据色青蓝降饱和（`#4f6fd8/#3ec9a7`）；2D 图底色从 `#0a0c16` 改为与 3D 底同系 `#1c2130`
3. **材质策略**：无 envMap 时 metalness 降到 0.35~0.5 + 三灯（主光暖白/轮廓光暖金/底部补光青蓝）伪造反射层次；边缘加 LineLoop 描边（已有雏形，加粗提亮）
4. **点云 → 连续色面**：PlaneGeometry 30×30 vertexColors 平滑着色
5. **波前发光感**：多层圆环 + AdditiveBlending + 透明度纵深衰减（WebGL 线宽锁 1px，用 TubeGeometry 细管或多层叠加）

### P1 · 3D 页交互与性能

6. 参数重建节流：`bindchanging` + 60~80ms 防抖，或仅 `bindchange`（松手）重建；波前/相机动画与几何重建解耦
7. 手势提示 2.4s 淡出；双击复位视角；停止交互 3s 后 auto-rotate（可关）
8. slider 定制：`activeColor` 赤陶→暖金、`block-color` 暖金
9. WebGL loading 骨架（复用 `.skeleton`）
10. 全屏沉浸模式（二期）：画布双击进入全屏，参数面板收进浮层抽屉

### P2 · 工具首页信息架构

11. 顶部 sticky 分段控制：计算 / 交互动画 / 3D 实验室（或横向滚动 chip）
12. 3D 实验室 8 卡改**双列小卡网格**，专用计算保留单列大卡
13. 图标统一：弃 emoji，改统一线性图标（自绘 view/iconfont）；3D 系列加"3D"角标
14. "最近使用"置顶（复用 progress.js）

### P3 · 工程治理

15. 抽 `lab3d-stage.js` 公共场景模块（renderer/相机/三灯/地面/dispose 模板）——10 页共用
16. 清理 `custom-tab-bar/` 死代码（或正式启用）
17. 统一 9 处 `setClearColor` 与 field-anim 的 `0x05070f`

## 4. 推荐路线

**先改一个样板页（建议 horn 喇叭天线）**：P0 全套 + P1 的 6/7/8/9 → 真机确认风格与性能 → 抽公共模块批量推广到其余 9 页 → 最后做工具首页 P2。

理由：3D 场景风格是"方向性决策"，一次改 10 页风险大；单页样板成本最低，风格锁定后批量是机械劳动。

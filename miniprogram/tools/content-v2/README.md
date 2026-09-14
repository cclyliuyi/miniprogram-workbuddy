# 前沿与方法论：手机图解新版

已接入当前小程序，2026-09-14。

## 内容切分

前沿共 18 张，先建立物理直觉，再进入信息视角。

| 阶段 | 卡片 | 内容 |
| --- | --- | --- |
| 口径与观测 | 01–04 | 场与端口信号、空间分辨、有效口径、相位分布 |
| 传播与散射 | 05–09 | 传播算子、多径、富散射与空间自由度、散射收益的条件、近场距离线索 |
| 模式与自由度 | 10–14 | 模式分解、奇异值、自由度与阵元数、角谱、密集采样 |
| 从场到信息 | 15–18 | 噪声与可用模式、容量、功率分配、连续口径与联合建模 |

方法论共 16 张，围绕电子信息专业已有能力组织，不以软件开发流程作为主线。

| 阶段 | 卡片 | 内容 |
| --- | --- | --- |
| 重新认识专业能力 | 01–04 | 经验转译、问题定义、上下文筛选、模型适用条件 |
| 测量与反馈 | 05–08 | 独立核验、误差定位、闭环修正、过程证据 |
| 约束与实验 | 09–12 | 实际权限、多目标权衡、对照实验、失败检查项 |
| 在真实工作中迁移 | 13–16 | 小工作流、专业知识资料、人的判断、真实任务实践 |

每张详情包含一张完整大图、一个核心问题、两段解释、适用条件或误区、一个练习以及参考来源。正文采用 32rpx 字号，图片不再被文字面板遮盖；点击图片可放大，左右滑动或底部按钮可以换卡。目录按四个阶段分组，使用大标题和完整比例缩略图。

## 科学表述与来源

富散射（rich scattering）强调丰富传播分量形成可区分空间响应，能为 MIMO 提供更多空间复用自由度；它与强调电波多次散射过程的多重散射是不同概念。实际自由度仍受收发口径、角度分布和空间相关性约束，有限信噪比下还要看模式强弱。第 7 张已据此重新绘图，第 8 张衔接解释容量收益的条件。图中的场形、箭头和器件均是概念示意，不是数值仿真。模式个数、形状或颜色不应作为定量结论；角谱图中的扇形表示方向范围。

电磁内容区分几何口径与有效口径、端口数与自由度、模式独立性与模式强度、频谱效率与容量。近场、散射丰富或采样更密均有适用条件。连续口径的 2026 年教程明确标注为预印本。

方法论中的“信噪比”“闭环”“边界”等是迁移思维的教学类比，不把自然语言系统当作满足同一物理方程的对象。练习和专业经验到 AI 工作的映射为原创教学组织；下列资料用于核验相关研究与实践原则。

- [MIT 电磁学与应用课程讲义](https://ocw.mit.edu/courses/6-013-electromagnetics-and-applications-spring-2009/d3be4ea78b036a6362230fb41780cf54_MIT6_013S09_notes.pdf)：天线、口径与场。
- [Poon、Brodersen、Tse，2005](https://doi.org/10.1109/TIT.2004.840892)：用信号空间研究多天线信道自由度。
- [Tse 与 Viswanath，《无线通信基础》第 7 章](https://web.stanford.edu/~dntse/Chapters_PDF/Fundamentals_Wireless_Communication_chapter7.pdf)：富散射、阵列分辨能力、信道秩与空间复用。
- [电磁信息论综述，2022](https://arxiv.org/abs/2212.02882)：连续场建模、自由度与互信息。
- [复杂空间 MIMO 电磁信息论模型，2023](https://arxiv.org/abs/2301.05536)：多重散射、模式分解与传播响应。
- [连续口径视角教程，2026 预印本](https://arxiv.org/abs/2605.12910)：连续口径系统的电磁与信息建模。
- [Anthropic：Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)：工作流、自主程度与反馈。
- [Anthropic：Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)：任务上下文的组织。
- [Anthropic：Writing tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents)：工具设计与评估。
- [NIST AI 600-1](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence)：生成式 AI 风险管理与核验。

各卡片的来源映射保存在运行时数据和 `sources.json` 中。

## 图片与维护

- `originals/`：34 张最终采用的原始 PNG。逐个 SHA-256 对比，与内置图像工具输出一致。
- `webp/`：完整原图的 WebP 编码版本，没有裁切、拼接、SVG、后期叠字或其他图形修改。总计约 3.82 MiB，平均约 115 KiB。
- `generated-manifest.json`：采用图片与工具原始输出的对应关系。
- `prompts.json`：主题与重绘提示词。第 16 张方法论因第一版标签太小，整张重新生成；采用最终大字版本。
- `cards.json`：文字编辑源；`build.js` 补充阶段说明、迁移解释、公式条件和参考来源并写入运行时。
- `uploaded.json`：34 张新图在当前云环境中的 fileID。使用独立 `content-v2-20260914/` 路径，旧云图片未删除或覆盖。
- 工具调用使用内置图像生成服务。该接口不暴露底层模型版本参数，因此不能独立确认其具体型号是否为用户称呼的 image 2.5。

图片原件位于 `tools/`，该目录已被小程序打包规则排除。小程序直接加载云端图片，不把这些原图打入主包。新内容使用 `v2-eXX` / `v2-mXX` 稳定 ID；新阅读进度使用独立版本键，旧阅读记录保留。

## 验证

- `node tools/content-v2/verify.js`：图片与文字完整性、阶段分组、深链接、翻页边界、已读记录、图片重试与卸载保护。
- `node tools/regression-test.js`：现有 10 项回归检查通过，包含日历收藏返回值与存储一致性。
- `node tools/content-v2/verify-devtools.js`：在微信开发者工具实际加载全部 18 + 16 张图片；验证列表点击、详情正文滚动、按钮翻页及滑动至最后一张。
- `verification/`：实际小程序截图，覆盖两组目录、首张、正文与末张。

本次修改已完成本地项目接入和云端图片上传，没有发布新的小程序正式版本。真机体验仍以微信客户端预览为准。

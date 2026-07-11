# 快速上线指南（照片日历小程序 · 完整版）

本目录是一个**可直接在微信开发者工具中运行的微信小程序脚手架**（云开发版，含完整版功能）。

## 一、前置准备
1. 注册微信小程序账号：https://mp.weixin.qq.com → 拿到 **AppID**。
2. 安装[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)。
3. 安装 Node.js（≥16）。

## 二、导入并配置
1. 微信开发者工具 → 导入项目 → 选择本 `miniprogram` 目录 → 填 AppID。
2. 顶部点「云开发」→ 开通 → 创建环境 → 复制**环境 ID**。
3. 打开 `app.js`，把 `globalData.env` 的 `'your-cloud-env-id'` 改成你的环境 ID。
4. 云开发控制台 → 数据库 → 新建集合 `calendar_photos`。

## 三、把 730 张照片灌进云开发
在 `miniprogram/tools` 目录下执行：

```bash
npm init -y
npm i sharp @cloudbase/node-sdk

# 1) 生成缩略图 + 预览图 + manifest.json
node preprocess.js

# 2) 上传到云存储并写库（填入你的云环境密钥）
TCB_ENV=你的环境ID TCB_SECRET_ID=xxx TCB_SECRET_KEY=xxx node upload.js
```

> 说明：`preprocess.js` 读取 **miniprogram 上一级目录**里的 `X月X日正面/反面.png`（即你的 730 张原图），生成 `thumb/`、`preview/` 与 `manifest.json`；`upload.js` 把三档图上传到云存储（`calendar/` 前缀）并写入 `calendar_photos` 集合。

## 四、运行与上线
1. 编译预览 → 真机调试（重点测 iOS / Android 中低端机）。
2. 性能要点：首屏只拉当月缩略图；年视图一次拉全量但仅渲染 12 张代表图；翻卡用 CSS 3D（Skyline 更顺）；日签卡用 Canvas 2D。
3. 提交审核前准备：隐私保护指引、账号用途说明；不要在无场景页申请相册/位置权限（保存相册权限仅在「日签卡」页触发，合规）。
4. 审核通过即发布。

## 五、目录结构（完整版）
```
miniprogram/
├── app.js / app.json / app.wxss       # 全局配置 + 云开发初始化 + tabBar(日历/年视图)
├── project.config.json / sitemap.json
├── utils/
│   ├── date.js      # 文件名解析 / 月历网格 / 当月天数
│   ├── db.js        # 云查询：按月、按天、拉全量(分页)
│   ├── auth.js      # 登录封装
│   └── quotes.js    # 日签文案库
├── pages/
│   ├── calendar/    # 【tab】月历网格主页 + 历史上的今天 banner + 入口
│   ├── year/        # 【tab】年视图（12 月缩略拼图，点月跳日历）
│   ├── day-detail/  # 翻卡详情（正面↔反面双图 + 大图 + 日签卡入口）
│   ├── story/       # 故事流（全屏左右滑某月，可翻正/反面）
│   └── card/        # 日签分享卡（canvas 合成 + 存相册 + 分享）
└── tools/           # 图片预处理 + 上传云开发脚本
```

## 六、功能一览
- **月历网格**：7 列标准日历，每天格显示正面缩略图，今天高亮。
- **历史上的今天**：主页顶部 banner 自动定位当天照片，点开即看。
- **年视图**：12 个月缩略拼图（按"同一日期跨月"对角线排布），点月跳到对应日历。
- **故事流**：全屏左右滑浏览某月，点击翻正/反面，可一键生成日签卡。
- **翻卡详情**：正面↔反面双图翻转 + 查看大图。
- **日签卡**：canvas 合成"照片 + 日期 + 文案"长图，保存相册 / 分享好友 / 朋友圈。
- **分享**：各页均实现 `onShareAppMessage` / `onShareTimeline`，形成裂变回流。

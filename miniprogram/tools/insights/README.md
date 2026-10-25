# 洞见：文章发布指南

从未排版原稿开始制作文章时，使用[洞见文章制作与发布工作流](WORKFLOW.md)。以下是构建和上传的具体操作说明。

文章内容与小程序代码分开存放。小程序从云存储读取 `insights/manifest.json`，再按文章 ID 读取 `insights/articles/<id>.json`，图片位于 `insights/images/<id>/`。

## 每次发布文章

在项目根目录打开 PowerShell，先转换 HTML（不会上传）：

```powershell
node tools/insights/build.js "D:/文章目录/文章.html" --id my-article --date 2026-10-21 --tags 原创,人工智能
```

- 新文章使用新的 ID；修改旧文章继续用原 ID。
- 日期填写文章发布日期，列表按日期倒序排列。
- 输入使用当前“精致阅读版”HTML 模板；支持正文、章节、图片、引用、加粗、列表、表格、公式与常见卡片。HTML 中脚本不会执行，网页动画与 SVG 图示不会自动迁移。
- 内嵌图片会提取为独立文件，首张插图同时作封面。建议使用内嵌图片；HTTPS 外链的可访问性和小程序域名配置需单独确认。
- `dist/manifest.json` 是全量文章目录。请保留本地 `dist`，不要为发布一篇新文而清空它。换电脑或多人发布时，先取得云端最新清单并保存到本地，避免覆盖其他文章条目。

转换完成后检查 `dist/articles/<id>.json` 的标题、日期、正文与 `dist/manifest.json` 的文章列表。

## 上传方式一：云开发控制台（无需运行小程序自动化）

打开微信开发者工具 → 云开发 → 选中本项目环境 `cloud1-d3gsxamaw26beccb8` → 存储，按顺序上传：

1. `dist/images/<id>/` 内全部文件 → `insights/images/<id>/`。
2. `dist/articles/<id>.json` → `insights/articles/<id>.json`。
3. **最后**将 `dist/manifest.json` 覆盖到 `insights/manifest.json`。

路径必须保持一致，不要把本地 `dist` 这一层目录一起上传。清单最后上传，避免用户先看到目录却打不开文章。当前环境通过 `getArticle` 云函数向普通读者提供已发布内容，存储可以保持私有；上传写入权限仅授予管理方。部署和真机验证见[文章读取网关](GATEWAY.md)。

## 上传方式二：本机脚本

现有脚本依赖本机微信开发者工具的自动化连接与当前登录身份。打开本项目并开启自动化端口 9420 后运行：

```powershell
node tools/insights/upload.js my-article
```

脚本依次上传图片、正文、清单；通过内容哈希识别修改过的文件，失败可重跑。它不会提交或发布小程序代码。自动化工具依赖目前采用本机既有安装路径，换电脑需调整 `upload.js` 中的依赖路径。若当前身份没有写权限，请使用控制台管理员上传，不要为了脚本开放所有人的写权限。

## 读者何时能看到更新

进入“洞见”会请求云端清单；从文章返回也会后台刷新，下拉可以主动刷新。正文在打开时请求。已有网络或 CDN 缓存时可能有延迟；插图文件名带内容哈希，改图会产生新地址。

本次阅读器新增了列表、卡片等块类型，**需要先将新版小程序代码发布一次**，再发布使用新结构的文章 JSON。旧版客户端不会显示新增块类型。之后继续使用已有块类型新增文章、修改文字和配图，只更新云存储即可；增加新的交互或排版组件仍需要更新小程序。

## 本地验证

```powershell
node tools/insights/content-test.js
node tools/template-compile-test.js
```

本地构建和检查不等于线上发布。上传后请在真机确认列表、正文、图片与目录均可读取。

## 查看正文层级预览

```powershell
node tools/insights/preview.js causal-emergence
```

用浏览器打开生成的 `preview.html`，可检查金色关键词、重点底纹、章节中英文标识、步骤编号、等级圆点和旁注卡片。该文件使用当前文章 JSON 和阅读页 WXSS 生成，便于审核内容层级；它不是微信运行环境，真机仍需验证。

注意：`strong.hl`、`strong.gold-t` 等强调必须在构建时从 HTML 保留进文章 JSON。只改阅读页样式无法还原旧 JSON 已丢失的标记；旧文章也需要重新构建并上传正文 JSON。

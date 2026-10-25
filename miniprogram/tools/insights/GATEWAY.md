# 洞见文章读取网关

## 读取方式

小程序调用 `getArticle`，由云函数读取私有云存储中的 JSON，并给封面和插图签发一小时有效的 HTTPS 链接。普通读者无需直接读取私有文件。

```js
wx.cloud.callFunction({ name: 'getArticle', data: { action: 'manifest' } })
wx.cloud.callFunction({ name: 'getArticle', data: { action: 'article', id: 'computing-paradigms-ai' } })
```

返回格式为 `{ ok: true, data }`；失败为 `{ ok: false, error }`。文章必须出现在 `insights/manifest.json` 中；图片签名只允许该文章对应的 `insights/images/<id>/` 目录。网关不提供上传、修改、删除功能，也不读取未发布文章或备份。

方法论另有只读动作 `{ action: 'method-images' }`，仅签发当前已发布的 `content-v2-20260914/method/m01.webp` 至 `m16.webp`，返回 `{ ok: true, data: { images, mediaExpiresAt } }`。`images` 为原始 fileID 到 HTTPS 链接的映射，不接受调用方提供任意文件路径。

## 后续体验版复测及方法论修复（2026-10-25）

- 用户重新上传体验版后，确认另一部手机已能加载洞见文章；此前正式客户端是否接入网关的疑点，已通过新体验版复测推进。此确认不等于原正式版已更新。
- 用户反馈方法论配图仍失败。其目录和正文直接使用私有 `cloud://` fileID，旧重试还调用读者身份的 `getTempFileURL`，没有经过文章网关。
- 已增加 `method-images` 动作并实际部署 `getArticle`，控制台测试返回 `ok: true` 和签名图片链接。请求 ID：`bd0dbb1b-ad3a-4049-8421-e1739254df24`，运行时间 195 ms。
- 使用返回的 `m03.webp` 链接通过普通 HTTP 请求下载，返回 HTTP 200、`image/webp`、125710 bytes。没有向该请求附加微信登录身份。未逐张下载全部 16 张，也未完成普通手机端验证；手工转录的 m01 链接请求曾返回 403，不以该转录结果判断源文件是否缺失。
- 本地目录缩略图、正文大图和失败重试统一使用 `utils/learning-images.js` 获取网关链接；目录与正文共享缓存和进行中的请求，临近过期时续取，卸载后不再写入页面。
- `node tools/content-v2/method-images-test.js` 通过，覆盖 16 张图、路径限制、部分缺图、模拟无存储权限读者、目录/正文、过期、重试、预览、深链接、阅读进度与卸载保护。洞见的两项 gateway 回归、10 项 `regression-test.js` 及 WXML/WXSS 编译检查通过。
- 自动化端口 9420 本次未就绪，没有声称完成开发工具中的全图原生加载测试。没有重新上传/发布客户端，需要用户上传本地最新代码到体验版，再由此前失败的手机验证方法论图片。

## 本次部署记录（2026-10-25）

- 环境：`cloud1-d3gsxamaw26beccb8`。
- `getArticle` 已通过微信开发者工具 CLI 部署并安装云端依赖，状态为 Active。
- 没有升级套餐，没有更改存储安全规则，没有上传或发布小程序客户端版本。
- 云开发控制台线上测试 `action: manifest` 成功，返回两篇文章及签名封面链接。请求 ID：`7f49c036-80ed-4d29-86ab-73f1eb72776c`，运行时间 881 ms。
- 线上测试 `action: article, id: computing-paradigms-ai` 成功，返回文章 JSON 及签名封面链接。请求 ID：`6c02e57b-90e2-4991-bf67-b046a379c144`，运行时间 1390 ms。
- 本地回归通过：`gateway-test.js`、`gateway-client-test.js`、`content-test.js`、`template-compile-test.js`。覆盖发布清单限制、图片签名、普通读者无存储权限的模拟场景、缓存过期和图片重试，以及内容和模板编译。
- 用户随后用此前失败的手机复测，仍报 `Internal Server Error: empty download url`。普通账号问题尚未确认解决。
- 只读检查云函数权限：所有函数共用 `auth != null && auth.loginType != 'ANONYMOUS'`，没有发现针对 `getArticle` 的单独拒绝规则。近期日志查询没有返回可用记录（包括已知控制台测试），不能据此推断手机没有调用函数。
- 历史记录 `.workbuddy/memory/2026-10-25.md` 将客户端网关接入记为本次故障排查后的改造，并将重新提交审核列为待办。结合正式版复测失败，首要怀疑是线上仍运行接入前的客户端；尚未取得正式版代码包逐项核实。

## 客户端生效边界

本地列表和正文已经使用 `utils/cloud-json.js` 优先调用网关。若已发布客户端也包含这些调用，本次云函数部署可以立即被该版本使用；若已发布版仍直接下载私有文件，需发布一次包含网关调用的客户端。

本次另外补充了本地图片授权链接过期后的缓存刷新和重试逻辑。这些客户端改动尚未上传，需要后续发布小程序版本才会在正式版生效。

普通账号验证：重新进入洞见并下拉刷新，打开两篇文章，检查封面和正文插图，再打开分享的文章链接。若仍报 `empty download url`，优先核对正式版是否实际包含 `getArticle` 调用以及所用云环境，不要因此开放全库写权限。

## 重新部署

在项目根目录执行：

```powershell
& 'D:/Program Files (x86)/Tencent/微信web开发者工具/cli.bat' cloud functions deploy --env cloud1-d3gsxamaw26beccb8 --names getArticle --remote-npm-install --project 'D:/WorkBuddy/03_images_final/miniprogram'
```

首次创建时若报告 Creating，先查询函数状态；Active 后再部署代码。云函数源码更新和文章内容更新均不自动发布小程序客户端。

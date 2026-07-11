# 后端导出（替代微信云开发）

把 730 张日期图转成「静态托管」资源，供 Flutter 独立版使用。无需服务器，成本极低。

## 步骤

```bash
cd mobile-build/backend
npm i sharp
# 本地先验证（URL 用相对路径 ./assets）
node export-manifest.js
# 托管后重跑（换成你的 CDN 地址）
BASE_URL=https://your-cdn.example.com/calendar node export-manifest.js
```

产出：
- `output/manifest.json`：与小程序 `calendar_photos` 结构对齐（`{month, day, front:{thumb,preview,original}, back:{...}}`），Flutter 直接消费。
- `output/assets/`：三档 WebP/PNG，整目录上传到任意静态托管即可。

## 托管建议（任选）

| 方案 | 适合 | 备注 |
|---|---|---|
| Cloudflare R2 + 自定义域 | 全球快、免流量费 | 推荐 |
| 阿里云 OSS / 腾讯云 COS + CDN | 国内快 | 需备案域名 |
| GitHub Pages | 免费、省事 | 单仓库 ≤1GB，原图可只放预览档 |
| Netlify / Vercel | 免费静态 | 适合演示 |

> 原图 1.8GB 不必全量进 CDN；月历网格只用 `thumb`（~60KB×730≈44MB），翻卡用 `preview`（~200KB×730≈146MB），`original` 可仅在「查看大图」时按需从对象存储拉。

## 数据结构（manifest.json 示例）

```json
{
  "version": 1,
  "baseUrl": "https://cdn.example.com/calendar",
  "photos": [
    {
      "month": 7, "day": 6,
      "front": { "thumb": "https://cdn.example.com/calendar/assets/0706_f_thumb.webp",
                 "preview": "https://cdn.example.com/calendar/assets/0706_f_preview.webp",
                 "original": "https://cdn.example.com/calendar/assets/0706_f_original.png" },
      "back":  { "thumb": "https://cdn.example.com/calendar/assets/0706_b_thumb.webp",
                 "preview": "https://cdn.example.com/calendar/assets/0706_b_preview.webp",
                 "original": "https://cdn.example.com/calendar/assets/0706_b_original.png" }
    }
  ]
}
```

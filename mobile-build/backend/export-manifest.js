#!/usr/bin/env node
/**
 * export-manifest.js —— 把 730 张日期图导出为「静态后端」资源
 * 用途：为 Flutter 独立版（或非微信环境）准备数据，替代微信云开发。
 *
 * 输入：脚本上级目录（即 03_images_final）里的 `X月X日正面.png` / `X月X日反面.png`
 * 输出（写到 backend/output/）：
 *   manifest.json              —— 日期 → 图片 URL 映射（CDN 模板化）
 *   assets/thumb/*.webp        —— 400px 缩略图（月历网格用，<60KB）
 *   assets/preview/*.webp      —— 1080px 预览图（翻卡/大图用，<200KB）
 *   assets/original/*.png      —— 原图（仅大图按需，可改托管对象存储）
 *
 * 用法：
 *   npm i sharp
 *   BASE_URL=https://your-cdn.example.com/calendar node export-manifest.js
 * （BASE_URL 缺省为相对路径 ./assets，便于本地先验证）
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..', '..'); // 03_images_final
const OUT = path.join(__dirname, 'output');
const ASSETS = path.join(OUT, 'assets');
const BASE_URL = process.env.BASE_URL || './assets';

const RE = /^(\d{1,2})月(\d{1,2})日(正面|反面)\.png$/;
const sideKey = (s) => (s === '正面' ? 'front' : 'back');

function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); }

async function main() {
  ensureDir(ASSETS);
  const files = fs.readdirSync(ROOT).filter((f) => RE.test(f));
  if (!files.length) {
    console.error('未在', ROOT, '找到 `X月X日正面/反面.png`');
    process.exit(1);
  }
  const byDay = {};
  for (const f of files) {
    const m = f.match(RE);
    const month = +m[1], day = +m[2], side = sideKey(m[3]);
    const src = path.join(ROOT, f);
    const key = `${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
    const base = path.join(ASSETS, key + (side === 'front' ? '_f' : '_b'));
    await sharp(src).resize(400).webp({ quality: 78 }).toFile(base + '_thumb.webp');
    await sharp(src).resize(1080).webp({ quality: 82 }).toFile(base + '_preview.webp');
    fs.copyFileSync(src, base + '_original.png');
    byDay[month] = byDay[month] || {};
    byDay[month][day] = byDay[month][day] || {};
    byDay[month][day][side] = {
      thumb: `${BASE_URL}/${path.basename(base)}_thumb.webp`,
      preview: `${BASE_URL}/${path.basename(base)}_preview.webp`,
      original: `${BASE_URL}/${path.basename(base)}_original.png`,
    };
    console.log('processed', f);
  }
  const photos = [];
  for (const month of Object.keys(byDay).sort((a, b) => a - b)) {
    for (const day of Object.keys(byDay[month]).sort((a, b) => a - b)) {
      photos.push({ month: +month, day: +day, front: byDay[month][day].front, back: byDay[month][day].back });
    }
  }
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ version: 1, baseUrl: BASE_URL, photos }, null, 2));
  console.log(`\n完成：${photos.length} 天，manifest 写入 ${path.join(OUT, 'manifest.json')}`);
  console.log(`下一步：把 ${ASSETS} 整个目录上传到任意静态托管（CDN/OSS/R2/GitHub Pages），并把 BASE_URL 设为该地址后重跑本脚本。`);
}
main().catch((e) => { console.error(e); process.exit(1); });

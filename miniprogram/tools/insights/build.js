#!/usr/bin/env node
/**
 * 洞见 · 文章发布管线
 * ====================
 * 用法：
 *   node tools/insights/build.js <文章.html> [--id xxx] [--date YYYY-MM-DD] [--tags 标签1,标签2]
 *
 * 输入：按"精致阅读版"模板产出的单文件 HTML（图片内嵌 base64 或外链均可）
 * 输出（写入 tools/insights/dist/）：
 *   dist/articles/<id>.json          文章结构化数据（blocks + theme + hero + toc）
 *   dist/images/<id>/img_NNN.webp    从 HTML 提取的插图
 *   dist/manifest.json               列表页清单（追加/更新）
 *
 * 发布两步（手动或脚本均可）：
 *   1. 云存储建目录 insights/images/<id>/，上传 dist/images/<id>/ 下全部图片
 *   2. 上传 dist/articles/<id>.json → insights/articles/<id>.json
 *      上传 dist/manifest.json    → insights/manifest.json
 *   可运行 node tools/insights/upload.js <id> 上传。
 */

const fs = require('fs');
const path = require('path');
const { parseContent } = require('./parse-content');

const CLOUD_PREFIX = 'cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/insights';
const DIST = process.env.INSIGHTS_DIST || path.join(__dirname, 'dist');

// ---------- CLI ----------
const args = process.argv.slice(2);
const htmlPath = args.find(a => !a.startsWith('--'));
if (!htmlPath) {
  console.error('用法: node tools/insights/build.js <文章.html> [--id xxx] [--date YYYY-MM-DD] [--tags a,b]');
  process.exit(1);
}
function opt(name) {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : undefined;
}

// ---------- HTML 读取与工具 ----------
let html = fs.readFileSync(htmlPath, 'utf8');
if (/<svg\b[^>]*(?:role="img"|aria-label=)/i.test(html)) {
  const converted = require('child_process').spawnSync(process.execPath, [path.join(__dirname,'rasterize-charts.js')], { input:html, encoding:'utf8', maxBuffer:64*1024*1024, windowsHide:true });
  if (converted.status !== 0) throw new Error(converted.stderr || 'SVG 图表转换失败');
  html = converted.stdout;
}

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ldquo;/g, '\u201c')
    .replace(/&rdquo;/g, '\u201d')
    .replace(/&mdash;/g, '\u2014')
    .replace(/&middot;/g, '\u00b7');
}
const clean = s => decodeEntities((s || '').replace(/<[^>]+>/g, '')).trim();

// ---------- 提取 <head> 元信息 ----------
const metaTitle = clean((html.match(/<title>([^<]*)<\/title>/) || [])[1]);
const ogDesc = clean((html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/) || [])[1]);
const metaDesc = clean((html.match(/<meta\s+name="description"\s+content="([^"]*)"/) || [])[1]);

// ---------- 提取主题配色（:root 与 light 主题的 CSS 变量） ----------
function pickVar(block, name, fallback) {
  const m = block.match(new RegExp('--' + name + '\\s*:\\s*([^;]+);'));
  return m ? m[1].trim() : fallback;
}
const rootBlock = (html.match(/:root\s*\{([\s\S]*?)\}/) || [])[1] || '';
const lightBlock = (html.match(/\[data-theme="light"\]\s*\{([\s\S]*?)\}/) || [])[1] || '';
const theme = {
  bg: pickVar(lightBlock, 'bg', '#f3efe6'),
  bgSoft: pickVar(lightBlock, 'bg-soft', '#faf7f0'),
  surface: pickVar(lightBlock, 'surface', '#fcfaf5'),
  ink: pickVar(lightBlock, 'ink', '#2b2820'),
  ink2: pickVar(lightBlock, 'ink-2', '#5a554a'),
  ink3: pickVar(lightBlock, 'ink-3', '#928b7c'),
  line: pickVar(lightBlock, 'line', '#e7e0cf'),
  accent: pickVar(rootBlock, 'gold', '#a36647'),
  accentSoft: pickVar(rootBlock, 'gold-soft', 'rgba(163,102,71,0.09)'),
  quoteBg: pickVar(lightBlock, 'quote-bg', '#f6f1e4'),
  serif: /serif/.test(pickVar(rootBlock, 'serif', 'serif')),
};

// ---------- 提取正文 body ----------
const bodyStart = html.indexOf('<body');
const bodyEnd = html.lastIndexOf('</body>');
let body = html.slice(bodyStart + 5, bodyEnd);
// 去掉 script / style / 顶部工具栏 / 目录导航 / canvas 动画
body = body
  .replace(/<script[\s\S]*?<\/script>/g, '')
  .replace(/<style[\s\S]*?<\/style>/g, '')
  .replace(/<header[\s\S]*?<\/header>/g, '')
  .replace(/<nav[\s\S]*?<\/nav>/g, '')
  .replace(/<canvas[\s\S]*?<\/canvas>/g, '');

// ---------- 图片：base64 落盘 → cloud fileID ----------
const imageDir = path.join(DIST, 'images');
fs.mkdirSync(imageDir, { recursive: true });

const articleId = (opt('id') || slugify(metaTitle || path.basename(htmlPath, '.html'))).toLowerCase();
if (!/^[a-z0-9\u4e00-\u9fa5][a-z0-9\u4e00-\u9fa5_-]{0,79}$/.test(articleId)) throw new Error('文章 ID 只能包含字母、数字、中文、下划线和短横线');
const artImageDir = path.join(imageDir, articleId);
fs.rmSync(artImageDir, { recursive: true, force: true });
fs.mkdirSync(artImageDir, { recursive: true });

let imgCounter = 0;
const imgInfo = new Map(); // 原 dataURI/base64 前缀 -> { fileID, width, height }
body = body.replace(/<img\s[^>]*src="data:image\/(webp|png|jpeg|jpg|gif);base64,([^"]+)"[^>]*>/g, (m0, fmt, b64) => {
  imgCounter += 1;
  const ext = fmt === 'jpeg' ? 'jpg' : fmt;
  const hash = require('crypto').createHash('sha256').update(Buffer.from(b64, 'base64')).digest('hex').slice(0, 12);
  const name = `img_${String(imgCounter).padStart(3, '0')}_${hash}.${ext}`;
  fs.writeFileSync(path.join(artImageDir, name), Buffer.from(b64, 'base64'));
  // 宽高（若写了属性）
  const w = Number((m0.match(/width="(\d+)"/) || [])[1]) || null;
  const h = Number((m0.match(/height="(\d+)"/) || [])[1]) || null;
  imgInfo.set(m0, {
    fileID: `${CLOUD_PREFIX}/images/${articleId}/${name}`,
    width: w, height: h,
  });
  return `__IMG_${imgCounter - 1}__`;
});
// 外链图片：保留外链（云存储上线后可替换为下载→上传流程）
body = body.replace(/<img\s[^>]*src="(https?:\/\/[^"]+)"[^>]*>/g, (m0, url) => {
  imgCounter += 1;
  imgInfo.set(m0, { fileID: url, width: null, height: null });
  return `__IMG_${imgCounter - 1}__`;
});

// ---------- 解析正文 → blocks ----------
const { blocks, toc, hero, skippedSvg } = parseContent(body, [...imgInfo.values()]);

// ---------- 文案与统计 ----------
const fullText = blocks.map(b => b.text || (b.items || []).map(x => x.text).join('') || (b.rows || []).flatMap(r => r.cells.map(c => c.text)).join('')).join('');
const charCount = fullText.replace(/\s/g, '').length;
const readMinutes = Math.max(1, Math.round(charCount / 450));

const title = (hero && hero.title) || metaTitle || articleId;
const summary = ogDesc || metaDesc || (blocks.find(b => b.t === 'p') || {}).text || '';
const date = opt('date') || new Date().toISOString().slice(0, 10);
const tags = (opt('tags') || '原创').split(',').map(s => s.trim()).filter(Boolean);

// ---------- 写出文章 JSON ----------
const articleJson = {
  id: articleId,
  title,
  subtitle: (hero && hero.subtitle) || '',
  summary,
  date,
  tags,
  charCount,
  charCountText: `约 ${Math.round(charCount / 1000)}k 字`,
  readMinutes,
  hero: hero || { kicker: '', title, subtitle: '', cover: '' },
  theme,
  toc,
  blocks,
  version: 2,
  builtAt: new Date().toISOString(),
};
// 首张配图用作封面，正文仍保留完整插图。
if (!articleJson.hero.cover) articleJson.hero.cover = (blocks.find(b => b.t === 'image') || {}).fileID || '';
// dateText 由管线直接算好，端上免解析
articleJson.dateText = formatCnDate(date);

const artDistDir = path.join(DIST, 'articles');
fs.mkdirSync(artDistDir, { recursive: true });
const artJsonPath = path.join(artDistDir, `${articleId}.json`);
fs.writeFileSync(artJsonPath, JSON.stringify(articleJson));

// ---------- 更新 manifest ----------
const manifestPath = path.join(DIST, 'manifest.json');
let manifest = { articles: [] };
if (fs.existsSync(manifestPath)) {
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch (e) { throw new Error('清单损坏，停止构建以免丢失已有文章'); }
}
const entry = {
  id: articleId, title, summary, date, tags, charCount, readMinutes,
  coverFileID: (articleJson.hero && articleJson.hero.cover) || '',
};
manifest.articles = manifest.articles.filter(a => a.id !== articleId);
manifest.articles.push(entry);
manifest.articles.sort((a, b) => (a.date < b.date ? 1 : -1));
fs.writeFileSync(manifestPath, JSON.stringify(manifest));

// ---------- 报告 ----------
console.log('=== 洞见发布管线 ===');
console.log('文章 ID :', articleId);
console.log('标题    :', title);
console.log('日期    :', date, '| 标签:', tags.join('、'));
console.log('篇幅    :', charCount, '字 / 约', readMinutes, '分钟');
console.log('blocks  :', blocks.length,
  '(p:' + blocks.filter(b => b.t === 'p').length,
  ' h2:' + blocks.filter(b => b.t === 'h2').length,
  ' 图:' + blocks.filter(b => b.t === 'image').length,
  ' 引:' + blocks.filter(b => b.t === 'quote').length + ')');
console.log('图片    :', imgCounter, '张 →', path.relative(process.cwd(), artImageDir));
if (skippedSvg) console.log('⚠ 跳过内联 SVG 装饰:', skippedSvg, '处');
console.log('产物    :');
console.log('  ', path.relative(process.cwd(), artJsonPath));
console.log('  ', path.relative(process.cwd(), manifestPath));
console.log('');
console.log('发布步骤：');
console.log(' 1. 云存储 insights/images/' + articleId + '/ 上传图片目录');
console.log(' 2. 云存储 insights/articles/' + articleId + '.json 上传文章 JSON');
console.log(' 3. 云存储 insights/manifest.json 上传清单（覆盖旧文件）');
console.log(' 4. 小程序下拉刷新列表即可看到新文章（无需发版）');

// ---------- helpers ----------
function slugify(s) {
  return String(s).toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'article';
}
function formatCnDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[1]} 年 ${+m[2]} 月 ${+m[3]} 日` : iso;
}

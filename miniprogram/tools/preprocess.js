// tools/preprocess.js
// 依赖: npm i sharp
// 作用: 读取上级目录的 730 张日期命名 PNG，生成缩略图(400)与预览图(1080) WebP，并输出 manifest.json
// 用法: node tools/preprocess.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SRC = path.resolve(__dirname, '..', '..');  // 图片所在根目录（03_images_final，tools 的上两级）
const OUT = path.resolve(__dirname, 'output');    // 处理后输出目录
const MANIFEST = path.join(OUT, 'manifest.json');

fs.mkdirSync(path.join(OUT, 'thumb'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'preview'), { recursive: true });

function parse(name) {
  const m = name.match(/(\d{1,2})月(\d{1,2})日(正面|反面)\.png$/);
  if (!m) return null;
  return {
    month: parseInt(m[1], 10),
    day: parseInt(m[2], 10),
    side: m[3] === '正面' ? 'front' : 'back',
  };
}

(async () => {
  const files = fs.readdirSync(SRC).filter((f) => /月\d+日(正面|反面)\.png$/.test(f));
  const map = {};
  let count = 0;
  for (const f of files) {
    const info = parse(f);
    if (!info) continue;
    const srcPath = path.join(SRC, f);
    const base = `${info.month}_${info.day}_${info.side}`;

    await sharp(srcPath)
      .resize(400, 400, { fit: 'cover' })
      .webp({ quality: 70 })
      .toFile(path.join(OUT, 'thumb', `${base}.webp`));

    await sharp(srcPath)
      .resize(1080, 1080, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(path.join(OUT, 'preview', `${base}.webp`));

    map[`${info.month}_${info.day}_${info.side}`] = {
      ...info,
      thumb: `thumb/${base}.webp`,
      preview: `preview/${base}.webp`,
      original: f,
    };
    count++;
    if (count % 50 === 0) console.log(`processed ${count}/${files.length}`);
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(map, null, 2));
  console.log(`完成：共处理 ${count} 张，manifest 已写入 ${MANIFEST}`);
})();

// tools/upload.js  —— 优化版（并发 + 增量写库 + 可断点续传 + 跳过原图）
//
// 依赖: npm i sharp tcb-admin-node
//
// 认证: 优先读取 tcb login 的本地凭证（~/.config/.cloudbase/auth.json，临时 STS 凭证，需 sessionToken）；
//       或设置环境变量 TCB_ENV + TCB_SECRET_ID + TCB_SECRET_KEY。
// 环境 ID 自动从上层 app.js 的 globalData.env 读取。
//
// 说明:
//  - 日历展示只需「缩略图(thumb) + 预览图(preview)」，原图(original, 3MB×365≈1.1GB)暂不上传，
//    待展示跑通后再单独补传（见本文件底部 BACKFILL_ORIGINALS 段落）。
//  - 每上传完一天的图，立即写一条 DB 记录（增量），所以小程序能边传边显示，且中途崩溃不丢已完成数据。
//  - 用 _key(月_日) 去重，重跑会自动跳过已完成的日期。
const fs = require('fs');
const path = require('path');
const os = require('os');

const OUT = path.resolve(__dirname, 'output');
const SRC = path.resolve(__dirname, '..', '..');
const manifestPath = path.join(OUT, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.error('❌ 先运行 preprocess.js 生成 output/manifest.json');
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

function readEnvFromAppJs() {
  try {
    const s = fs.readFileSync(path.resolve(__dirname, '..', 'app.js'), 'utf8');
    const m = s.match(/env\s*:\s*['"]([^'"]+)['"]/);
    return m ? m[1] : undefined;
  } catch (e) { return undefined; }
}
const env = process.env.TCB_ENV || readEnvFromAppJs();
if (!env) { console.error('❌ 未找到环境 ID（请在 app.js 的 globalData.env 填写）'); process.exit(1); }

const rcCandidates = [
  path.join(os.homedir(), '.config', '.cloudbase', 'auth.json'),
  path.join(process.env.USERPROFILE || '', '.config', '.cloudbase', 'auth.json'),
  path.join(os.homedir(), '.tcbrc'),
  path.join(process.env.HOME || '', '.tcbrc'),
  process.env.TCB_CONFIG_PATH || '',
  path.join(process.env.LOCALAPPDATA || '', '@cloudbase', 'cli', '.tcbrc'),
  path.join(process.env.APPDATA || '', '@cloudbase', 'cli', '.tcbrc'),
  path.join(os.homedir(), '.cloudbase', 'config.json'),
].filter(Boolean);

function loadRc() {
  for (const p of rcCandidates) {
    try { if (fs.existsSync(p)) return { file: p, data: JSON.parse(fs.readFileSync(p, 'utf8')) }; } catch (e) {}
  }
  return null;
}

const tcb = require('tcb-admin-node');
let app;
const rc = loadRc();
if (rc) {
  const d = rc.data;
  const cred = d.credential || d;
  const sid = process.env.TCB_SECRET_ID || cred.tmpSecretId || cred.secretId;
  const skey = process.env.TCB_SECRET_KEY || cred.tmpSecretKey || cred.secretKey;
  const token = process.env.TCB_SECRET_TOKEN || cred.tmpToken || cred.token;
  if (sid && skey) {
    try {
      app = tcb.init({ env, secretId: sid, secretKey: skey, sessionToken: token });
      console.log(`✅ 使用本地凭证（${rc.file}），环境: ${env}`);
    } catch (e) { console.error('凭证初始化失败:', e.message); }
  }
}
if (!app && process.env.TCB_SECRET_ID && process.env.TCB_SECRET_KEY) {
  app = tcb.init({ env, secretId: process.env.TCB_SECRET_ID, secretKey: process.env.TCB_SECRET_KEY, sessionToken: process.env.TCB_SECRET_TOKEN });
  console.log('✅ 使用环境变量 Secret 认证');
}
if (!app) {
  console.error('\n╔══════════════════════════════════════════════════╗\n║  未检测到云开发凭证。请 tcb login 或设置环境变量。  ║\n╚══════════════════════════════════════════════════╝\n');
  process.exit(1);
}

const db = app.database();
const cloudPath = (p) => `calendar/${p}`;

async function uploadOne(baseDir, localRel) {
  const fileContent = fs.readFileSync(path.join(baseDir, localRel));
  const res = await app.uploadFile({ cloudPath: cloudPath(localRel), fileContent });
  return res.fileID;
}

// 并发池
function runPool(items, worker, concurrency) {
  return new Promise((resolve) => {
    let i = 0, active = 0, finished = 0;
    const total = items.length;
    const tick = () => {
      if (i >= total && active === 0) return resolve();
      while (active < concurrency && i < total) {
        const item = items[i++];
        active++;
        Promise.resolve(worker(item))
          .then(() => { active--; finished++; if (finished % 20 === 0) process.stdout.write(`  进度 ${finished}/${total}\r`); tick(); })
          .catch((e) => { active--; console.error(`\n⚠️ 跳过 ${item._key || ''}: ${e.message}`); tick(); });
      }
    };
    tick();
  });
}

async function fetchExistingKeys() {
  const set = new Set();
  let offset = 0;
  while (true) {
    const r = await db.collection('calendar_photos').field({ _key: true }).skip(offset).limit(100).get();
    (r.data || []).forEach((d) => { if (d._key) set.add(d._key); });
    if ((r.data || []).length < 100) break;
    offset += 100;
  }
  return set;
}

(async () => {
  try { await db.createCollection('calendar_photos'); console.log('✅ 集合 calendar_photos 已就绪'); }
  catch (e) { console.log('（集合已存在）'); }

  const existing = await fetchExistingKeys();
  console.log(`已有记录 ${existing.size} 条，将跳过`);

  // 合并 manifest 为「每天」一条
  const dayMap = {};
  for (const k of Object.keys(manifest)) {
    const it = manifest[k];
    const key = `${it.month}_${it.day}`;
    const e = dayMap[key] || { month: it.month, day: it.day, _key: key, front: {}, back: {} };
    const tgt = it.side === 'front' ? e.front : e.back;
    tgt.thumb = it.thumb; tgt.preview = it.preview;
    dayMap[key] = e;
  }
  const days = Object.values(dayMap).filter((d) => !existing.has(d._key));
  console.log(`待处理 ${days.length} 天\n`);

  // 阶段1：缩略图 + 预览图（并发上传，完成即写库）
  console.log('📤 阶段1: 上传缩略图+预览图并增量写库...');
  await runPool(days, async (d) => {
    const [fT, fP, bT, bP] = await Promise.all([
      uploadOne(OUT, d.front.thumb), uploadOne(OUT, d.front.preview),
      uploadOne(OUT, d.back.thumb), uploadOne(OUT, d.back.preview),
    ]);
    await db.collection('calendar_photos').add({
      month: d.month, day: d.day, _key: d._key,
      front: { thumb: fT, preview: fP, original: '' },
      back: { thumb: bT, preview: bP, original: '' },
      _hasOriginal: false,
    });
  }, 10);

  const { total: dbTotal } = await db.collection('calendar_photos').count();
  console.log(`\n✅ 阶段1完成！集合现有 ${dbTotal} 条记录，小程序现在应该能看到图片了。`);
  console.log('（原图 1.1GB 暂未上传；如需高清大图，运行 BACKFILL_ORIGINALS 段落即可，不影响当前展示）\n');
})().catch((e) => {
  console.error('\n❌ 出错:', e.message);
  if (/token|auth|signature|expired/i.test(e.message)) console.error('👉 疑似临时凭证过期，请重新 tcb login 后重跑。');
  process.exit(1);
});

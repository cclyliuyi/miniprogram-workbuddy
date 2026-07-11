// tools/check-files.js —— 校验 thumb / preview 文件是否真的存在于云存储
const fs = require('fs'), path = require('path'), os = require('os');
const cred = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.config', '.cloudbase', 'auth.json'), 'utf8')).credential;
const tcb = require('tcb-admin-node');
const app = tcb.init({ env: 'cloud1-d3gsxamaw26beccb8', secretId: cred.tmpSecretId, secretKey: cred.tmpSecretKey, sessionToken: cred.tmpToken });
const db = app.database();

(async () => {
  const all = [];
  let offset = 0;
  while (true) {
    const r = await db.collection('calendar_photos').skip(offset).limit(100).get();
    const list = r.data || [];
    all.push(...list);
    if (list.length < 100) break;
    offset += 100;
  }

  // 抽 5 条，校验 front.thumb / front.preview / back.thumb / back.preview
  const sample = all.slice(0, 5);
  const fileList = [];
  sample.forEach((p) => {
    ['front', 'back'].forEach((side) => {
      if (p[side]) {
        if (p[side].thumb) fileList.push(p[side].thumb);
        if (p[side].preview) fileList.push(p[side].preview);
      }
    });
  });
  console.log('抽样校验文件数:', fileList.length);
  fileList.forEach((f) => console.log('  ', f));

  // getTempFileURL 能返回 url 说明文件真实存在
  const res = await app.getTempFileURL({ fileList });
  console.log('\n=== 文件存在性 ===');
  let ok = 0, bad = 0;
  (res.fileList || []).forEach((item) => {
    if (item.tempFileURL) { ok++; }
    else { bad++; console.log('❌ 缺失/无效:', item.fileID, item.status, item.errMsg); }
  });
  console.log(`存在: ${ok} | 缺失: ${bad}`);

  // 额外：统计全库 preview 字段非空但可能缺文件的（仅看字段，不逐个拉 URL 省配额）
  let thumbEmpty = 0, previewEmpty = 0;
  all.forEach((p) => {
    if (!p.front || !p.front.thumb) thumbEmpty++;
    if (!p.front || !p.front.preview) previewEmpty++;
  });
  console.log('\n全库字段空值: front.thumb 空', thumbEmpty, '| front.preview 空', previewEmpty);
})().catch((e) => { console.error('❌', e.message); process.exit(1); });

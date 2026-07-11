// tools/dedupe.js —— 清理 calendar_photos 重复记录（按 _key 去重，优先保留含原图的）
const fs = require('fs'), path = require('path'), os = require('os');
const cred = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.config', '.cloudbase', 'auth.json'), 'utf8')).credential;
const tcb = require('tcb-admin-node');
const app = tcb.init({ env: 'cloud1-d3gsxamaw26beccb8', secretId: cred.tmpSecretId, secretKey: cred.tmpSecretKey, sessionToken: cred.tmpToken });
const db = app.database();

const hasOrig = (d) => !!(d.front && d.front.original) || !!(d.back && d.back.original);

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
  console.log('总记录:', all.length, '| 含 original 的记录:', all.filter(hasOrig).length);

  const groups = {};
  all.forEach((d) => { const k = d._key || ('n_' + d._id); (groups[k] = groups[k] || []).push(d); });

  const toDelete = [];
  let kept = 0;
  Object.keys(groups).forEach((k) => {
    const arr = groups[k];
    if (arr.length === 1) { kept++; return; }
    arr.sort((a, b) => (hasOrig(b) ? 1 : 0) - (hasOrig(a) ? 1 : 0)); // 含原图优先
    kept++;
    arr.slice(1).forEach((x) => toDelete.push(x._id));
  });
  console.log('需保留:', kept, '| 需删除重复:', toDelete.length);

  for (let i = 0; i < toDelete.length; i += 20) {
    const batch = toDelete.slice(i, i + 20);
    await Promise.all(batch.map((id) => db.collection('calendar_photos').doc(id).remove()));
    console.log('  已删', Math.min(i + 20, toDelete.length), '/', toDelete.length);
  }
  const c = await db.collection('calendar_photos').count();
  console.log('✅ 清理后记录数:', c.total);
})().catch((e) => { console.error('❌', e.message); process.exit(1); });

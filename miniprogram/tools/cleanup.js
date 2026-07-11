// tools/cleanup.js —— 删除旧版「无 _key」的重复记录，保留带 _key 的 365 条干净数据
// 安全策略：只删 _key 不存在的记录；批处理 20/批；删除后打印最终计数与一致性校验。
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
  const junk = all.filter((d) => !d._key);
  const good = all.filter((d) => !!d._key);
  console.log(`清理前：总 ${all.length} | 好(含_key) ${good.length} | 垃圾(无_key) ${junk.length}`);

  let done = 0;
  for (let i = 0; i < junk.length; i += 20) {
    const batch = junk.slice(i, i + 20);
    await Promise.all(batch.map((d) => db.collection('calendar_photos').doc(d._id).remove()));
    done += batch.length;
    process.stdout.write(`  已删 ${done}/${junk.length}\r`);
  }
  console.log('');

  const c = await db.collection('calendar_photos').count();
  const after = [];
  let o = 0;
  while (true) {
    const r = await db.collection('calendar_photos').skip(o).limit(100).get();
    const list = r.data || [];
    after.push(...list);
    if (list.length < 100) break;
    o += 100;
  }
  // 一致性校验：每个 (month,day) 应唯一
  const md = {};
  after.forEach((d) => { const k = `${d.month}_${d.day}`; (md[k] = md[k] || []).push(d); });
  const dupDates = Object.keys(md).filter((k) => md[k].length > 1);
  const missingKey = after.filter((d) => !d._key);
  console.log(`\n✅ 清理后：集合记录 ${c.total} 条 | 唯一日期 ${Object.keys(md).length}/365 | 仍重复日期 ${dupDates.length} | 仍缺_key ${missingKey.length}`);
  if (c.total === 365 && dupDates.length === 0 && missingKey.length === 0) {
    console.log('🎉 数据已干净：365 天每日唯一、全部带 _key，小程序可正常展示。');
  } else {
    console.log('⚠️ 清理未达预期，请检查。');
  }
})().catch((e) => { console.error('❌', e.message); process.exit(1); });

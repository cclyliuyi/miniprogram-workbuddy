// tools/inspect.js —— 只读检查 calendar_photos 集合结构（不删不改）
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
  const withKey = all.filter((d) => !!d._key);
  const withoutKey = all.filter((d) => !d._key);
  console.log('总记录:', all.length);
  console.log('  含 _key:', withKey.length, '| 不含 _key:', withoutKey.length);

  // 按 (month,day) 分组，看是否每个日期只有一条干净记录
  const byMD = {};
  all.forEach((d) => { const k = `${d.month}_${d.day}`; (byMD[k] = byMD[k] || []).push(d); });
  const dupMD = Object.keys(byMD).filter((k) => byMD[k].length > 1);
  console.log('按 (month,day) 有重复的日期数:', dupMD.length, '/ 总日期', Object.keys(byMD).length);

  console.log('\n--- 抽样：含 _key 的一条 ---');
  console.log(JSON.stringify(withKey[0], null, 2).slice(0, 600));
  console.log('\n--- 抽样：不含 _key 的一条 ---');
  console.log(JSON.stringify(withoutKey[0], null, 2).slice(0, 600));

  // 干净目标：每个 (month,day) 保留含 _key 的那条
  const toDelete = [];
  dupMD.forEach((k) => {
    const arr = byMD[k];
    const good = arr.filter((d) => !!d._key);
    const junk = arr.filter((d) => !d._key);
    // 若 junk 里也有 _key（异常），保留第一个 _key，其余全删
    const keep = good[0] || arr[0];
    arr.forEach((d) => { if (d !== keep) toDelete.push(d._id); });
  });
  // 额外：任何独立的不含 _key 的记录也删（理论上已包含在 dupMD）
  withoutKey.forEach((d) => { if (!toDelete.includes(d._id)) toDelete.push(d._id); });
  console.log('\n清理计划：删除', toDelete.length, '条，保留', all.length - toDelete.length, '条');
})().catch((e) => { console.error('❌', e.message); process.exit(1); });

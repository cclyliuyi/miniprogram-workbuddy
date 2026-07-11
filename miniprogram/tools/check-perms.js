// tools/check-perms.js —— 诊断：集合是否存在、权限是否可读、数据是否完整
const fs = require('fs'), path = require('path'), os = require('os');
const cred = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.config', '.cloudbase', 'auth.json'), 'utf8')).credential;
const tcb = require('tcb-admin-node');
const app = tcb.init({ env: 'cloud1-d3gsxamaw26beccb8', secretId: cred.tmpSecretId, secretKey: cred.tmpSecretKey, sessionToken: cred.tmpToken });
const db = app.database();

(async () => {
  // 1. 集合存在 + 计数
  try {
    const count = await db.collection('calendar_photos').count();
    console.log('✅ 集合 calendar_photos 存在，记录数:', count.total);
  } catch (e) {
    console.log('❌ 集合查询失败:', e.message);
    return;
  }

  // 2. 抽样一条，验证 fileID 结构
  const sample = await db.collection('calendar_photos').limit(1).get();
  const rec = sample.data[0];
  if (!rec) { console.log('❌ 集合为空！'); return; }
  console.log('\n📋 抽样记录:');
  console.log('  _key:', rec._key);
  console.log('  month/day:', rec.month, '/', rec.day);
  console.log('  front.thumb:', (rec.front && rec.front.thumb) || 'MISSING');
  console.log('  back.thumb:', (rec.back && rec.back.thumb) || 'MISSING');

  // 3. 检查 fileID 是否以 cloud:// 开头（小程序可直接使用）
  const fid = rec.front ? rec.front.thumb : '';
  const validFid = fid && fid.startsWith('cloud://');
  console.log('  fileID 格式有效(cloud://):', validFid);

  // 4. 列出所有月份分布
  const all = [];
  let offset = 0;
  while (true) {
    const r = await db.collection('calendar_photos').skip(offset).limit(100).get();
    const list = r.data || [];
    all.push(...list);
    if (list.length < 100) break;
    offset += 100;
  }

  const months = {};
  all.forEach((p) => { months[p.month] = (months[p.month] || 0) + 1; });
  console.log('\n📅 月份数据分布:');
  Object.keys(months).sort((a,b)=>a-b).forEach((m) => {
    const hasThumb = all.filter((p) => p.month == parseInt(m)).filter((p) => p.front && p.front.thumb).length;
    console.log(`  ${m}月: ${months[m]}条 (${hasThumb}条有thumb)`);
  });

  // 5. 关键诊断：小程序端能否读取？
  console.log('\n⚠️  小程序端读取 checklist:');
  console.log('  ① app.js wx.cloud.init({env:"' + 'cloud1-d3gsxamaw26beccb8' + '"}) ✅');
  console.log('  ② 云开发控制台 → 数据库 → calendar_photos → 权限规则');
  console.log('     → 必须设为「所有用户可读，仅创建者可写」或「所有用户可读写」');
  console.log('     → 如果是默认的「仅创建者可读写」，小程序端会查到空结果！');
  console.log('');
  console.log('🔧 请立即去云开发控制台检查/修改权限：');
  console.log('   微信开发者工具 → 云开发 → 数据库 → calendar_photos → 权限设置');
})().catch((e) => { console.error('❌', e.message); process.exit(1); });

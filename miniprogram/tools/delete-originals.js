// tools/delete-originals.js
// 批量删除云存储 calendar/ 根目录的 730 张原图
// 小程序只用 calendar/thumb/ 和 calendar/preview/，原图从未引用
const path = require('path');
const os = require('os');
const fs = require('fs');

const ENV = 'cloud1-d3gsxamaw26beccb8';

const rcCandidates = [
  path.join(os.homedir(), '.config', '.cloudbase', 'auth.json'),
  path.join(process.env.USERPROFILE || '', '.config', '.cloudbase', 'auth.json'),
].filter(Boolean);

function loadRc() {
  for (const p of rcCandidates) {
    try { if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) {}
  }
  return null;
}

const tcb = require('tcb-admin-node');
const rc = loadRc();
if (!rc) { console.error('未找到凭证'); process.exit(1); }
const cred = rc.credential || rc;
const app = tcb.init({
  env: ENV,
  secretId: cred.tmpSecretId || cred.secretId,
  secretKey: cred.tmpSecretKey || cred.secretKey,
  sessionToken: cred.tmpToken || cred.token,
});

// 生成 365 天 × 正反面 = 730 个文件名
const files = [];
const monthNames = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
for (let m = 1; m <= 12; m++) {
  // 每月天数简化处理
  const days = new Date(2024, m, 0).getDate(); // 2024是闰年，2月有29天
  for (let d = 1; d <= days; d++) {
    files.push(`calendar/${monthNames[m-1]}${d}日正面.png`);
    files.push(`calendar/${monthNames[m-1]}${d}日反面.png`);
  }
}
console.log(`共 ${files.length} 个文件待删除\n`);

(async () => {
  let ok = 0, fail = 0;
  // 分批删除，每批 50 个
  const BATCH = 50;
  for (let i = 0; i < files.length; i += BATCH) {
    const batch = files.slice(i, i + BATCH);
    try {
      // tcb-admin-node 的 deleteFile 接受 fileID 列表，需要完整 cloud:// 路径
      const fileIDs = batch.map(f => `cloud://${ENV}.636c-${ENV}-1312580783/${f}`);
      const res = await app.deleteFile({ fileList: fileIDs });
      const deleted = (res.deleteList || res.fileList || []).filter(r => r.code === 'SUCCESS' || r.Status === 'success' || !r.code).length;
      ok += deleted;
      fail += batch.length - deleted;
      process.stdout.write(`进度: ${Math.min(i + BATCH, files.length)}/${files.length} (成功 ${ok}, 失败 ${fail})\r`);
    } catch (e) {
      console.error(`\n批次 ${i} 出错: ${e.message}`);
      fail += batch.length;
    }
  }
  console.log(`\n\n完成！成功删除 ${ok} 个，失败 ${fail} 个`);
})();

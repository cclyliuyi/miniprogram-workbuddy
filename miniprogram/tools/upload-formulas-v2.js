// tools/upload-formulas-v2.js
// 上传所有公式图（EIT + 方法论 + 工具页）到云存储
const fs = require('fs');
const path = require('path');
const os = require('os');

const ENV = 'cloud1-d3gsxamaw26beccb8';

const rcCandidates = [
  path.join(os.homedir(), '.config', '.cloudbase', 'auth.json'),
  path.join(process.env.USERPROFILE || '', '.config', '.cloudbase', 'auth.json'),
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
  const sid = cred.tmpSecretId || cred.secretId;
  const skey = cred.tmpSecretKey || cred.secretKey;
  const token = cred.tmpToken || cred.token;
  if (sid && skey) {
    app = tcb.init({ env: ENV, secretId: sid, secretKey: skey, sessionToken: token });
    console.log(`OK 凭证来源: ${rc.file}`);
  }
}
if (!app) { console.error('FAIL 未找到凭证'); process.exit(1); }

// 上传文件清单
const BASE = path.resolve(__dirname, '..', 'pages');
const files = [];

// EIT 公式（重新上传全部 11 张，覆盖旧版）
for (let i = 1; i <= 11; i++) {
  const id = String(i).padStart(2, '0');
  files.push({
    localPath: path.join(BASE, 'eit', 'images', 'formula', `f_eit_${id}.png`),
    cloudPath: `eit/formula/f_eit_${id}.png`,
  });
}
// 方法论公式（新命名 f_m_system / f_m_optimize）
files.push({
  localPath: path.join(BASE, 'method', 'images', 'formula', 'f_m_system.png'),
  cloudPath: 'method/formula/f_m_system.png',
});
files.push({
  localPath: path.join(BASE, 'method', 'images', 'formula', 'f_m_optimize.png'),
  cloudPath: 'method/formula/f_m_optimize.png',
});
// 工具页公式（新增）
['skin', 'ae', 'farfield', 'los', 'noise'].forEach(key => {
  files.push({
    localPath: path.join(BASE, 'tools', 'images', 'formula', `f_tools_${key}.png`),
    cloudPath: `tools/formula/f_tools_${key}.png`,
  });
});

(async () => {
  console.log(`\n上传 ${files.length} 张公式图片...\n`);
  let ok = 0;
  for (let i = 0; i < files.length; i++) {
    const item = files[i];
    try {
      const fileContent = fs.readFileSync(item.localPath);
      await app.uploadFile({ cloudPath: item.cloudPath, fileContent });
      ok++;
      console.log(`[${i + 1}/${files.length}] OK ${item.cloudPath}`);
    } catch (e) {
      console.error(`[${i + 1}/${files.length}] FAIL ${item.cloudPath}: ${e.message}`);
    }
  }
  console.log(`\n成功 ${ok}/${files.length}`);
})();

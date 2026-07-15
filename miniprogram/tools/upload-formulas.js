// tools/upload-formulas.js
// 上传公式渲染图片到云存储
const fs = require('fs');
const path = require('path');
const os = require('os');

const ENV = 'cloud1-d3gsxamaw26beccb8';

// ---------- 凭证加载 ----------
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

// ---------- 上传文件清单 ----------
const formulaDir = path.resolve(__dirname, '..', 'pages', 'eit', 'images', 'formula');
const methodFormulaDir = path.resolve(__dirname, '..', 'pages', 'method', 'images', 'formula');

const files = [];
// EIT 公式
for (let i = 1; i <= 11; i++) {
  const id = String(i).padStart(2, '0');
  files.push({
    localPath: path.join(formulaDir, `f_eit_${id}.png`),
    cloudPath: `eit/formula/f_eit_${id}.png`,
  });
}
// Method 公式
files.push({ localPath: path.join(methodFormulaDir, 'f_m1_system.png'), cloudPath: 'method/formula/f_m1_system.png' });
files.push({ localPath: path.join(methodFormulaDir, 'f_m4_optimize.png'), cloudPath: 'method/formula/f_m4_optimize.png' });

// ---------- 上传 ----------
(async () => {
  console.log(`\n上传 ${files.length} 张公式图片...\n`);
  const results = [];
  for (let i = 0; i < files.length; i++) {
    const item = files[i];
    try {
      const fileContent = fs.readFileSync(item.localPath);
      const res = await app.uploadFile({ cloudPath: item.cloudPath, fileContent });
      results.push({ cloudPath: item.cloudPath, fileID: res.fileID });
      console.log(`[${i + 1}/${files.length}] OK ${item.cloudPath}`);
    } catch (e) {
      console.error(`[${i + 1}/${files.length}] FAIL ${item.cloudPath}: ${e.message}`);
    }
  }
  console.log(`\n成功 ${results.filter(r => r.fileID).length}/${files.length}`);
  // 输出 JSON
  console.log('\nfileIDs:');
  console.log(JSON.stringify(results, null, 2));
})();

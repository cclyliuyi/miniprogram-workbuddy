// tools/upload-eit-method.js
// 上传 EIT（12张）+ 方法论（12张）WebP 图片到云存储
// 复用 tools/upload.js 相同的凭证机制（~/.config/.cloudbase/auth.json）
// 上传完成后生成 fileID 映射表，供小程序读取

const fs = require('fs');
const path = require('path');
const os = require('os');

const ENV = 'cloud1-d3gsxamaw26beccb8';

// ---------- 凭证加载（和 upload.js 完全一致） ----------
const rcCandidates = [
  path.join(os.homedir(), '.config', '.cloudbase', 'auth.json'),
  path.join(process.env.USERPROFILE || '', '.config', '.cloudbase', 'auth.json'),
  path.join(os.homedir(), '.tcbrc'),
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
    app = tcb.init({ env: ENV, secretId: sid, secretKey: skey, sessionToken: token });
    console.log(`OK 凭证来源: ${rc.file}, 环境: ${ENV}`);
  }
}
if (!app) {
  console.error('FAIL 未找到云开发凭证，请先 tcb login');
  process.exit(1);
}

// ---------- 待上传文件清单 ----------
const eitImages = Array.from({ length: 12 }, (_, i) => ({
  localPath: path.resolve(__dirname, '..', 'pages', 'eit', 'images', `eit_${String(i + 1).padStart(2, '0')}.webp`),
  cloudPath: `eit/eit_${String(i + 1).padStart(2, '0')}.webp`,
  module: 'eit',
  id: i + 1,
}));

const methodImages = Array.from({ length: 12 }, (_, i) => ({
  localPath: path.resolve(__dirname, '..', 'pages', 'method', 'images', `m_${String(i + 1).padStart(2, '0')}.webp`),
  cloudPath: `method/m_${String(i + 1).padStart(2, '0')}.webp`,
  module: 'method',
  id: i + 1,
}));

const allImages = [...eitImages, ...methodImages];

// ---------- 上传 ----------
(async () => {
  console.log(`\n开始上传 ${allImages.length} 张图片...\n`);

  const results = [];
  for (let i = 0; i < allImages.length; i++) {
    const item = allImages[i];
    try {
      const fileContent = fs.readFileSync(item.localPath);
      const res = await app.uploadFile({ cloudPath: item.cloudPath, fileContent });
      const fileID = res.fileID;
      results.push({ module: item.module, id: item.id, cloudPath: item.cloudPath, fileID });
      console.log(`[${i + 1}/${allImages.length}] OK ${item.module} #${item.id} -> ${fileID}`);
    } catch (e) {
      console.error(`[${i + 1}/${allImages.length}] FAIL ${item.module} #${item.id}: ${e.message}`);
      results.push({ module: item.module, id: item.id, cloudPath: item.cloudPath, fileID: '', error: e.message });
    }
  }

  // 输出 JSON 映射表
  const outputPath = path.resolve(__dirname, 'eit-method-fileIDs.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n========================================`);
  console.log(`完成！成功 ${results.filter(r => r.fileID).length}/${results.length} 张`);
  console.log(`映射表已保存: ${outputPath}`);
  console.log(`========================================\n`);

  // 打印 JSON 供复制
  console.log('fileID 映射表 JSON:');
  console.log(JSON.stringify(results.filter(r => r.fileID), null, 2));
})().catch((e) => {
  console.error('出错:', e.message);
  process.exit(1);
});

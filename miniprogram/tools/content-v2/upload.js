// Preserve generated originals; only encode complete images for mobile delivery.
const fs = require('fs');
const path = require('path');
const os = require('os');
const sharp = require('sharp');
const tcb = require('tcb-admin-node');
const root = __dirname;
async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'generated-manifest.json'), 'utf8'));
  const output = path.join(root, 'uploaded.json');
  const uploaded = fs.existsSync(output) ? JSON.parse(fs.readFileSync(output, 'utf8')) : [];
  const auth = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.config/.cloudbase/auth.json'), 'utf8'));
  const c = auth.credential || auth;
  const app = tcb.init({ env: 'cloud1-d3gsxamaw26beccb8', secretId: c.tmpSecretId || c.secretId, secretKey: c.tmpSecretKey || c.secretKey, sessionToken: c.tmpToken || c.token });
  fs.mkdirSync(path.join(root, 'originals'), { recursive: true });
  fs.mkdirSync(path.join(root, 'webp'), { recursive: true });
  for (const item of manifest) {
    const original = path.join(root, 'originals', item.key + '.png');
    if (!fs.existsSync(original)) fs.copyFileSync(item.source, original);
    if (uploaded.some(x => x.key === item.key)) continue;
    const webp = path.join(root, 'webp', item.key + '.webp');
    await sharp(original).webp({ quality: 88 }).toFile(webp);
    const cloudPath = `content-v2-20260914/${item.module}/${item.key}.webp`;
    const result = await app.uploadFile({ cloudPath, fileContent: fs.readFileSync(webp) });
    if (!result.fileID) throw new Error('Upload did not return fileID: ' + item.key);
    uploaded.push({ key: item.key, module: item.module, fileID: result.fileID, bytes: fs.statSync(webp).size });
    fs.writeFileSync(output, JSON.stringify(uploaded, null, 2));
    console.log(item.key + ' uploaded (' + fs.statSync(webp).size + ' bytes)');
  }
  console.log('Total uploaded: ' + uploaded.length);
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });

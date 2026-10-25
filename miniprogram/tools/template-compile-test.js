// Local WeChat compilers; no upload or signing credentials required.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const assert = require('assert');
const root = path.resolve(__dirname, '..');
const bin = process.env.WECHAT_COMPILER_DIR || 'D:/Program Files (x86)/Tencent/微信web开发者工具/resources/app.asar.unpacked/node_modules/wcc-exec';
const config = require('../app.json');
const pages = [...config.pages, ...(config.subPackages || config.subpackages || []).flatMap(s => s.pages.map(p => s.root + '/' + p))];
const styles = new Set();
function collect(file) {
  if (styles.has(file)) return;
  assert(fs.existsSync(path.join(root, file)), 'Missing WXSS import: ' + file);
  styles.add(file);
  const source = fs.readFileSync(path.join(root, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of source.matchAll(/@import\s+["']([^"']+)["']/g)) {
    collect(path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1])));
  }
}
collect('app.wxss');
pages.forEach(p => collect(p + '.wxss'));
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'wx-template-check-'));
for (const [name, files] of [['wcsc', [...styles]], ['wcc', pages.map(p => p + '.wxml')]]) {
  const exe = path.join(bin, name + '.exe');
  assert(fs.existsSync(exe), 'Set WECHAT_COMPILER_DIR to the installed WeChat compiler directory');
  const result = spawnSync(exe, [...files, '-o', path.join(out, name + '.js')], { cwd: root, encoding: 'utf8', windowsHide: true });
  assert.strictEqual(result.status, 0, result.stderr || result.stdout || String(result.error));
}
console.log(`PASS ${pages.length} page templates and ${styles.size} stylesheets: imports exist; WeChat WXML/WXSS compilation passed`);

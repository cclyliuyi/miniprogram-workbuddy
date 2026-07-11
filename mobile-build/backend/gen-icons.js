// gen-icons.js —— 生成多端应用所需的占位图标/闪屏（纯色 + 文字，可改）
// 运行：NODE_PATH=D:/WorkBuddy/03_images_final/miniprogram/tools/node_modules node gen-icons.js
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'android-assets');
const LABEL = 'EM'; // 占位文字，可改成你的缩写

function svg(w, h, label) {
  const fs2 = Math.min(w, h) * 0.3;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
      `<rect width="100%" height="100%" fill="#0C447C"/>` +
      `<text x="50%" y="50%" font-family="sans-serif" font-weight="700" font-size="${fs2}" ` +
      `fill="#ffffff" text-anchor="middle" dominant-baseline="central">${label}</text>` +
    `</svg>`
  );
}

async function gen() {
  fs.mkdirSync(path.join(OUT, 'icons'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'splash'), { recursive: true });

  // 图标：hdpi/xhdpi/xxhdpi/xxxhdpi（正方形）
  const icons = [['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]];
  for (const [name, s] of icons) {
    await sharp(svg(s, s, LABEL)).png().toFile(path.join(OUT, 'icons', `${name}.png`));
    console.log('icon', name, s + 'x' + s);
  }

  // 闪屏：hdpi/xhdpi/xxhdpi（竖屏）
  const splash = [['hdpi', 480, 800], ['xhdpi', 720, 1280], ['xxhdpi', 1080, 1920]];
  for (const [name, w, h] of splash) {
    await sharp(svg(w, h, LABEL)).png().toFile(path.join(OUT, 'splash', `${name}.png`));
    console.log('splash', name, w + 'x' + h);
  }

  console.log(
    '\n完成。下载多端工具后会 scaffold 出 miniapp/android/nativeResources/，' +
    '把 android-assets/icons 与 splash 下对应尺寸图按工具生成的子目录结构放进去，' +
    '并在 app.miniapp.json 回填 icons/splashscreen 的相对路径即可。'
  );
}

gen().catch((e) => { console.error(e); process.exit(1); });

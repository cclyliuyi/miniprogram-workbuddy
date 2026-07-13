// pages/card/card.js —— 日签分享卡（纯图 + 一句电磁波主题文案）
// 月份主题色方案 + 保存到相册权限修复
const { getDayPhoto } = require('../../utils/db');
const { QUOTES, CARDS } = require('../../utils/quotes');
const haptic = require('../../utils/haptic');

// ═══════════════════════════════════════════════════
// 月份主题色方案：春夏秋冬四季调色
// 每个季节一组配色：底色 / 胶带色 / 装饰线色 / 文字色
// ═══════════════════════════════════════════════════
const SEASON_THEMES = {
  // 1-3月 · 冬末初春：清新冷调（雾蓝灰 + 浅松石）
  winter: {
    bg: '#edf0ec',        // 雾蓝灰底
    tape: 'rgba(122, 152, 168, 0.55)',   // 雾蓝胶带
    tapeStroke: 'rgba(122, 152, 168, 0.3)',
    accent: '#6b8e9b',    // 松石灰（装饰线）
    ink: '#3a4a52',       // 深青灰文字
    stampBg: 'rgba(245, 248, 245, 0.92)',
  },
  // 4-6月 · 春末夏初：明亮清新（嫩绿 + 樱粉）
  spring: {
    bg: '#f0f0e8',        // 嫩绿米白
    tape: 'rgba(122, 145, 129, 0.55)',   // 鼠尾草绿胶带
    tapeStroke: 'rgba(122, 145, 129, 0.3)',
    accent: '#7a9181',    // 鼠尾草绿
    ink: '#3d4a3f',       // 墨绿文字
    stampBg: 'rgba(248, 250, 245, 0.92)',
  },
  // 7-9月 · 盛夏初秋：明亮暖色（赤陶 + 暖金）
  summer: {
    bg: '#f3efe6',        // 暖纸色（原配色）
    tape: 'rgba(176, 106, 79, 0.55)',    // 赤陶胶带
    tapeStroke: 'rgba(176, 106, 79, 0.3)',
    accent: '#b06a4f',    // 赤陶
    ink: '#4c463c',       // 深棕文字
    stampBg: 'rgba(251, 249, 244, 0.92)',
  },
  // 10-12月 · 秋末冬季：深沉暖调（琥珀棕 + 酒红）
  autumn: {
    bg: '#f0ebe1',        // 暖驼底
    tape: 'rgba(168, 122, 80, 0.55)',    // 琥珀棕胶带
    tapeStroke: 'rgba(168, 122, 80, 0.3)',
    accent: '#a87a50',    // 琥珀棕
    ink: '#52392a',       // 深咖文字
    stampBg: 'rgba(250, 247, 242, 0.92)',
  },
};

// 按月份获取季节主题色
function getSeasonTheme(month) {
  if (month >= 1 && month <= 3) return SEASON_THEMES.winter;
  if (month >= 4 && month <= 6) return SEASON_THEMES.spring;
  if (month >= 7 && month <= 9) return SEASON_THEMES.summer;
  return SEASON_THEMES.autumn;
}

Page({
  data: {
    month: 0,
    day: 0,
    side: 'front',
    label: '',
    face: '',
    quote: '',
    hook: '',
    tag: '',
    cardPath: '',
    drawing: true,
    showMomentGuide: false,
  },

  onLoad(options) {
    const month = parseInt(options.month, 10);
    const day = parseInt(options.day, 10);
    const side = options.side === 'back' ? 'back' : 'front';
    this.setData({ month, day, side, label: `${month}月${day}日` });
    this.loadDay(month, day, side);
  },

  async loadDay(month, day, side) {
    let face = '';
    try {
      // 加超时保护：云函数偶发 timeout（全量 swiper 构建后负载增大）
      const res = await this.withTimeout(
        getDayPhoto(month, day),
        8000
      );
      const p = res.data && res.data[0];
      if (p) {
        const frontUrl = p.front ? (p.front.preview || p.front.original || '') : '';
        const backUrl = p.back ? (p.back.preview || p.back.original || '') : '';
        face = side === 'back' ? backUrl : frontUrl;
      }
    } catch (e) {
      console.error('[card] loadDay 失败:', e);
      // 不立刻 toast，继续尝试绘制（quote 不依赖图片）
    }

    // ⚠️ 关键：canvas.createImage 无法加载 cloud:// fileID，必须转成 HTTPS 临时 URL
    if (face && face.indexOf('cloud://') === 0) {
      try {
        const tmp = await this.withTimeout(
          wx.cloud.getTempFileURL({ fileList: [face] }),
          8000
        );
        const info = tmp.fileList && tmp.fileList[0];
        if (info && info.tempFileURL) face = info.tempFileURL;
      } catch (e) {
        console.error('[card] getTempFileURL FAIL:', e);
      }
    }
    this.setData({ face });

    // 修正：与 day-detail.js 的 pickCard 保持一致（dayOfYear-1），避免日签卡文案和详情页错位
    const idx = (this.dayOfYear(month, day) - 1) % QUOTES.length;
    const quote = QUOTES[idx];
    const cardData = CARDS[idx] || {};
    this.setData({ quote, hook: cardData.hook || '', tag: cardData.tag || '' });

    // 有图片才绘制卡片；没图片直接报错提示
    if (face) {
      setTimeout(() => this.drawCard(), 350);
    } else {
      this.setData({ drawing: false });
      wx.showToast({ title: '图片加载超时，请重试', icon: 'none', duration: 2000 });
    }
  },

  // 超时包装：防止云函数/网络调用挂起不返回
  withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), ms)
      ),
    ]);
  },

  dayOfYear(month, day) {
    const cum = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    return cum[month - 1] + day;
  },

  drawCard() {
    const q = wx.createSelectorQuery();
    q.select('#cardCanvas').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0] || !res[0].node) {
        this.setData({ drawing: false });
        return;
      }
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const dpr = wx.getWindowInfo().pixelRatio || 2;

      // 获取当月季节主题色
      const theme = getSeasonTheme(this.data.month);

      // 9:16 朋友圈竖版（逻辑像素，导出 ×dpr 高清）
      const W = 270;
      const H = 480;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.scale(dpr, dpr);

      // ① 底色：按月份季节切换
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, W, H);

      const padX = 16;

      // ①b 顶部知识标签（图片上方）
      ctx.fillStyle = theme.accent;
      ctx.font = '600 11px sans-serif';
      ctx.textAlign = 'left';
      const tagText = this.data.tag || '电磁波';
      ctx.fillText(tagText, padX, 20);

      const img = canvas.createImage();
      img.onload = () => {
        // ② 照片区：上方占 62%，留白相框感
        const photoH = H * 0.62;
        const photoW = W - padX * 2;
        const photoY = 32;

        // 圆角照片
        this.drawRoundImg(ctx, img, padX, photoY, photoW, photoH, 8);

        // ③ 顶部胶带装饰（季节色）
        const tapeX = W / 2 - 40;
        const tapeY = photoY - 8;
        ctx.save();
        ctx.translate(tapeX + 40, tapeY + 8);
        ctx.rotate(-0.06);
        ctx.fillStyle = theme.tape;
        this.roundRect(ctx, -40, -8, 80, 18, 2);
        ctx.strokeStyle = theme.tapeStroke;
        ctx.setLineDash([3, 2]);
        ctx.lineWidth = 1;
        ctx.strokeRect(-40, -8, 80, 18);
        ctx.restore();
        ctx.setLineDash([]);

        // ④ 日期戳：左下手账体感（大号日 + 小号月份）
        const stampX = padX + 8;
        const stampY = photoY + photoH - 12;
        ctx.fillStyle = theme.stampBg;
        this.roundRect(ctx, stampX, stampY - 40, 50, 48, 6);
        ctx.fillStyle = theme.ink;
        ctx.font = 'bold 26px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(this.data.day), stampX + 25, stampY - 10);
        ctx.font = '11px sans-serif';
        ctx.fillStyle = theme.accent;
        ctx.fillText(this.data.month + '月', stampX + 25, stampY + 4);
        ctx.textAlign = 'left';

        // ⑤ 底部文案区：hook 副标题 + 金句
        const textTop = photoY + photoH + 16;

        // hook 副标题（加粗，第一行）
        ctx.fillStyle = theme.ink;
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'left';
        const hookText = this.data.hook || '';
        if (hookText) {
          this.wrapText(ctx, hookText, padX, textTop + 14, W - padX * 2, 18);
        }

        // 装饰竖线
        const quoteY = hookText ? textTop + 42 : textTop + 2;
        ctx.fillStyle = theme.accent;
        ctx.fillRect(padX, quoteY, 3, 36);

        // 金句（legacy）
        ctx.fillStyle = theme.ink;
        ctx.globalAlpha = 0.75;
        ctx.font = '400 12px sans-serif';
        this.wrapText(ctx, this.data.quote, padX + 12, quoteY + 14, W - padX * 2 - 24, 18);
        ctx.globalAlpha = 1;

        // ⑥ 底部品牌水印
        ctx.fillStyle = theme.accent;
        ctx.globalAlpha = 0.7;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('天线与电波传播 · 每日一签', W / 2, H - 16);
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';

        // 导出：Canvas 2D API 下必须显式指定画布区域和目标尺寸
        // 用 jpg 格式 + 0.92 质量，兼容性远好于 png 临时文件
        wx.canvasToTempFilePath({
          canvas,
          x: 0,
          y: 0,
          width: W,
          height: H,
          destWidth: W * dpr,
          destHeight: H * dpr,
          fileType: 'jpg',
          quality: 0.92,
          success: (r) => {
            console.log('[card] canvasToTempFilePath OK:', r.tempFilePath);
            this.setData({ cardPath: r.tempFilePath, drawing: false });
          },
          fail: (err) => {
            console.error('[card] canvasToTempFilePath FAIL:', err);
            this.setData({ drawing: false });
            wx.showToast({ title: '卡片生成失败，请重试', icon: 'none' });
          },
        });
      };
      img.onerror = () => this.setData({ drawing: false });
      img.src = this.data.face;
    });
  },

  // 圆角图片绘制（contain 模式：完整保留原图比例不裁切，只切圆角）
  // 图片等比缩放进画框，不裁掉任何内容；留白处自然填充背景色
  drawRoundImg(ctx, img, x, y, w, h, r) {
    ctx.save();
    // 先建圆角裁剪区域
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.clip();

    const iw = img.width, ih = img.height;
    // contain：按较短的边缩放，保证整张图都在框内（不裁切）
    const scale = Math.min(w / iw, h / ih);
    const dw = iw * scale;   // 缩放后实际绘制宽
    const dh = ih * scale;   // 缩放后实际绘制高
    // 居中放置
    const dx = x + (w - dw) / 2;
    const dy = y + (h - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  },

  // 圆角矩形辅助
  roundRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  },

  wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    let line = '';
    for (let i = 0; i < text.length; i++) {
      const test = line + text[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, y);
        line = text[i];
        y += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, y);
  },

  // 保存到相册：完整权限处理流程
  // ① 先检查 scope.writePhotosAlbum 授权状态
  // ② 未授权 → 自动请求（调 saveImageToPhotosAlbum 会触发系统弹窗）
  // ③ 被明确拒绝 → 引导用户到 openSetting 重新授权
  // ④ 授权正常 → 直接保存
  async save() {
    if (!this.data.cardPath) {
      wx.showToast({ title: '卡片生成中…', icon: 'none' });
      return;
    }

    try {
      // Step 1：检查是否已有相册写入权限
      const setting = await wx.getSetting();
      const auth = setting.authSetting['scope.writePhotosAlbum'];

      if (auth === false) {
        // 用户曾明确拒绝过 → 需要引导去设置页
        this.guideToSetting();
        return;
      }

      // Step 2：有权限或未被问过 → 直接尝试保存
      // 如果之前没授权过，saveImageToPhotosAlbum 会自动弹出系统授权弹窗
      await this.doSave();
    } catch (e) {
      console.error('[card] save 检查权限失败:', e);
      // 兜底：直接尝试保存
      this.doSave();
    }
  },

  // 实际执行保存：先 getImageInfo 转成系统认可的本地路径，再存相册
  // canvas 导出的 http://tmp/ 路径在部分 iOS 机型上 saveImageToPhotosAlbum 不认
  doSave() {
    const cardPath = this.data.cardPath;
    if (!cardPath) {
      wx.showToast({ title: '卡片未就绪', icon: 'none' });
      return Promise.resolve(false);
    }

    wx.showLoading({ title: '保存中…', mask: true });

    return new Promise((resolve) => {
      // Step 1：getImageInfo 把临时文件落到本地缓存，得到系统认可的 wxfile:// 路径
      wx.getImageInfo({
        src: cardPath,
        success: (info) => {
          const localPath = info.path;
          console.log('[card] getImageInfo OK, path =', localPath);
          this._saveToAlbum(localPath, resolve);
        },
        fail: (err) => {
          console.warn('[card] getImageInfo FAIL（直接用原路径兜底）:', err);
          // getImageInfo 失败 → 直接用原路径尝试（兜底）
          this._saveToAlbum(cardPath, resolve);
        },
      });
    });
  },

  // 真正调 saveImageToPhotosAlbum + 完整错误分流
  _saveToAlbum(filePath, resolve) {
    wx.saveImageToPhotosAlbum({
      filePath,
      success: () => {
        wx.hideLoading();
        haptic.medium();
        wx.showToast({ title: '已保存到相册', icon: 'success' });
        resolve(true);
      },
      fail: (e) => {
        wx.hideLoading();
        const msg = (e.errMsg || '').toLowerCase();
        console.error('[card] saveImageToPhotosAlbum FAIL:', e.errMsg);

        // 三种拒绝场景
        if (msg.indexOf('auth deny') > -1 || msg.indexOf('auth') > -1 || msg.indexOf('authorize') > -1) {
          // 用户拒绝过相册权限
          this.guideToSetting();
        } else if (msg.indexOf('cancel') > -1) {
          // 用户在授权弹窗里点了取消
          wx.showToast({ title: '需要相册权限才能保存', icon: 'none' });
        } else if (msg.indexOf('invalid') > -1 || msg.indexOf('file') > -1) {
          // 文件路径问题
          console.error('[card] 文件路径异常，cardPath =', this.data.cardPath);
          wx.showModal({
            title: '保存失败',
            content: '图片文件异常（' + e.errMsg.substring(0, 50) + '）。\n请尝试重新打开日签卡再保存。',
            showCancel: false,
          });
        } else {
          // 其他未知错误 → 用 showModal 显示完整信息（toast 会截断）
          wx.showModal({
            title: '保存失败',
            content: e.errMsg || '未知错误',
            showCancel: false,
          });
        }
        resolve(false);
      },
    });
  },

  // 引导用户去设置页开启权限
  guideToSetting() {
    wx.showModal({
      title: '需要相册权限',
      content: '保存日签卡需要"保存到相册"权限。\n点击「去设置」→ 找到「保存到相册」→ 开启权限。',
      confirmText: '去设置',
      cancelText: '算了',
      success: (res) => {
        if (res.confirm) {
          wx.openSetting({
            success: (s) => {
              // 用户从设置页回来后，检查是否已授权
              if (s.authSetting && s.authSetting['scope.writePhotosAlbum']) {
                // 已授权，自动重试保存
                this.doSave();
              }
            },
            fail: () => {
              wx.showToast({ title: '请在设置中手动开启权限', icon: 'none' });
            },
          });
        }
      },
    });
  },

  // 朋友圈分享引导
  shareMoment() {
    haptic.medium();
    this.setData({ showMomentGuide: true });
  },

  closeGuide() {
    haptic.light();
    this.setData({ showMomentGuide: false });
  },

  onShareAppMessage() {
    return {
      title: this.data.hook || this.data.quote || '天线与电波传播 · 每日一签',
      path: `/pages/day-detail/day-detail?month=${this.data.month}&day=${this.data.day}`,
      imageUrl: this.data.cardPath || this.data.face,
    };
  },

  onShareTimeline() {
    return {
      title: this.data.hook || '天线与电波传播 · 每日一签',
      query: `month=${this.data.month}&day=${this.data.day}`,
      imageUrl: this.data.cardPath || this.data.face,
    };
  },
});

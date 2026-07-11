// utils/haptic.js —— 触觉反馈封装
// 微信小程序 wx.vibrateShort 的 type 参数仅支持 light/medium/heavy（基础库 2.13.0+）
// 降级：低版本不支持 type 参数时自动退化为普通短振动

function vibrate(type) {
  try {
    wx.vibrateShort({ type });
  } catch (e) {
    // 低版本兜底：不带 type 的短振动
    try { wx.vibrateShort(); } catch (_) {}
  }
}

function light()  { vibrate('light'); }
function medium() { vibrate('medium'); }
function heavy()  { vibrate('heavy'); }

module.exports = { light, medium, heavy, vibrate };

// utils/auth.js —— 登录封装（云开发下可匿名访问，这里仅做 wx.login 示例）

function login() {
  return new Promise((resolve, reject) => {
    wx.login({
      success: (res) => resolve(res.code),
      fail: reject,
    });
  });
}

module.exports = { login };

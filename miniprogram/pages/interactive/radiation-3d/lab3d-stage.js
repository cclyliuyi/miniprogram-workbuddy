// 分包适配层：公共舞台来自当前分包的同步副本，Three.js 从当前分包加载。
const stage = require('./pkg-utils/lab3d-stage');
module.exports = Object.assign({}, stage, {
  initThree(page, selector, opts) {
    if (typeof opts === 'function') opts = { onReady: opts };
    return stage.initThree(page, selector, Object.assign({}, opts, {
      createScopedThreejs: canvas => require('threejs-miniprogram').createScopedThreejs(canvas),
    }));
  },
});

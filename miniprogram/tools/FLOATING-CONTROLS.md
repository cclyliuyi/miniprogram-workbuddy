# 悬浮调参

覆盖工具注册表中「专用计算」「交互动画」的 12 个含滑块页面。纯输入框页面保持原交互。

- 底栏每组最多两个滑块，原位置保留完整参数。
- `fd-anchor` 到达底栏顶部时取消悬浮，向上返回则恢复；拖动期间锁住状态，结束后重新测量。
- 悬浮栏全部使用 `cover-view` 原生覆盖层，包括文字、分组按钮、滑块轨道和滑块手柄；不在覆盖层内嵌普通 `view` 或 `slider`。触摸坐标按原滑块的 min/max/step 映射，转发给同一个 changing/change 处理函数。原位置仍保留原生 slider。
- 原始滑块是唯一维护来源。`build-floating-controls.js` 从原始 WXML 生成镜像，保留数据绑定、条件、禁用态及 changing/change 回调。修改滑块后运行此脚本。
- 画布、参数、正文共用原生页面滚动，不使用嵌套 `scroll-view`，不在悬浮切换时改变滚动区高度。画布始终留在原节点，图间只保留正常间距。图表祖先容器不能有入场位移动画，避免原生画布与普通卡片位置不同步。
- `onPageScroll` 触发归位判断，「全部参数」使用 `wx.pageScrollTo` 定位。
- 公共控制逻辑在 `utils/lab-canvas.js` 中维护，随原有画布模块同步到分包；不再单独依赖 `floating-controls.js`，避免增量加载时新模块未注册导致整个页面无法初始化。

修改后运行：

```powershell
node tools/build-floating-controls.js
node tools/sync-subpackage-utils.js
node tools/floating-controls-test.js
node tools/template-compile-test.js
node tools/package-layout-test.js
```

编译测试使用本机微信开发者工具的 WXML / WXSS 编译器；其他安装路径通过 `WECHAT_COMPILER_DIR` 指定。

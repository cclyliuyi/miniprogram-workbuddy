# 分包公共代码维护

仅供分包使用的公共源文件仍统一维护在 `utils/`：rf-math、lab-canvas、lab-theme、lab3d-stage、lab3d-visual、lab3d-plots。
这六个源文件通过 project.config.json 的 packOptions.ignore 排除上传；每个使用它们的分包只携带所需的 pkg-utils 副本，及其传递依赖。

修改源文件后执行：

```sh
node tools/sync-subpackage-utils.js
node tools/package-layout-test.js
node tools/lab3d-visual-test.js
node tools/regression-test.js
```

不要直接编辑 pkg-utils 里的生成文件。同步脚本幂等；检查模式发现旧副本或错误引用会失败。

2026-09-14 验证：
- 147 个运行时 JS 文件无缺失引用、无引用打包排除文件、无跨兄弟分包引用。
- 3D 几何/颜色/交互、暗室扫描、辐射方向图、10 项业务回归通过。
- 微信开发者工具实际加载：辐射方向图、暗室、小环、工程计算、Friis 正常，无捕获异常。
- miniprogram-ci.checkCodeQuality 在按 packOptions.ignore 和 cloudfunctionRoot 过滤的临时打包目录上检查，11 项全部通过。
- 主包 968328 bytes，3D 实验室分包 936037 bytes，辐射方向图分包 683317 bytes。
- 本次只进行本地检查，没有调用 upload 或 preview。

质量扫描记录：tools/output/package-quality.json。

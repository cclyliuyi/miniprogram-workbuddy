# Flutter 独立版日历 App（Phase B 脚手架）

> 路线 B：真正独立的 Android + iOS App，后端用「静态 `manifest.json` + CDN」，不依赖微信。
> 当前为**垂直切片骨架**（数据层 + 月历网格页），可编译、可跑通首屏，后续补齐翻卡/年视图/故事流/日签卡。

## 架构

```
lib/
├── main.dart                    # 入口，MaterialApp
├── models/photo.dart            # DayPhoto / PhotoSide 数据模型
├── data/calendar_repository.dart # 拉 manifest.json + 按月索引（O(1) 取当月）
└── pages/month_grid_page.dart   # 月历网格（7 列，每天格显示正面缩略图，今天高亮）
```

数据来源：`CalendarRepository(manifestUrl)` 拉取 `manifest.json`（由 `../backend/export-manifest.js` 生成）。图片用 `cached_network_image` 缓存，契合「离线优先 + 省流量」。

## 运行

```bash
cd mobile-build/flutter-calendar
flutter pub get
# 把 backend/output/assets 传到 CDN 后，修改 lib/data/calendar_repository.dart 里的
# manifestUrl 为你托管的地址，例如：
#   final repo = CalendarRepository('https://your-cdn.example.com/calendar/manifest.json');
flutter run          # 接安卓真机/模拟器
flutter build apk    # 出 Android 包
flutter build ios    # 出 iOS 包（需 macOS + Xcode）
```

## 待补齐（与小程序对齐）

- [ ] 翻卡详情 `day-detail`（正面↔反面双图翻转，用 `PhotoView` + `Transform`）
- [ ] 年视图 `year`（12 月缩略拼图）
- [ ] 故事流 `story`（全屏左右滑某月）
- [ ] 日签分享卡 `card`（截图合成 + 存相册，`share_plus`）
- [ ] 历史上的今天 banner（首屏定位当天）
- [ ] 图标 / 闪屏 / 隐私协议（Google Play / App Store 上架必需）

## 依赖（pubspec.yaml）

- `flutter` / `cupertino_icons`
- `http`：拉 manifest
- `cached_network_image`：图片缓存（离线优先）
- `photo_view`：大图查看/翻卡
- `share_plus`：日签卡分享
- `intl`：日期格式化

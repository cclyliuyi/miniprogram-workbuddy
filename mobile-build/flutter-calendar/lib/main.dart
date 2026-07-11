import 'package:flutter/material.dart';
import 'data/calendar_repository.dart';
import 'pages/month_grid_page.dart';

void main() {
  // TODO(Phase B): 把 manifestUrl 换成你在 CDN 上托管的 manifest.json 地址
  // 本地验证时可用 `http://<电脑IP>:8080/manifest.json`，或先用 backend/output 起一个静态服务
  const manifestUrl = String.fromEnvironment(
    'MANIFEST_URL',
    defaultValue: 'https://your-cdn.example.com/calendar/manifest.json',
  );
  runApp(PhotoCalendarApp(manifestUrl: manifestUrl));
}

class PhotoCalendarApp extends StatelessWidget {
  final String manifestUrl;
  const PhotoCalendarApp({super.key, required this.manifestUrl});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '天线与电磁波知识日历',
      theme: ThemeData(
        primaryColor: const Color(0xFF0C447C),
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0C447C)),
        useMaterial3: true,
      ),
      home: MonthGridPage(repository: CalendarRepository(manifestUrl)),
    );
  }
}

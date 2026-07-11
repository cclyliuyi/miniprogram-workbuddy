import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/photo.dart';

/// 数据层：拉取静态 manifest.json（由 backend/export-manifest.js 生成），
/// 并按月份建索引，O(1) 取当月，契合「离线优先 + 省流量」。
class CalendarRepository {
  final String manifestUrl;
  const CalendarRepository(this.manifestUrl);

  Future<List<DayPhoto>> loadManifest() async {
    final res = await http.get(Uri.parse(manifestUrl));
    if (res.statusCode != 200) {
      throw Exception('manifest 加载失败: ${res.statusCode}');
    }
    final json = jsonDecode(res.body) as Map<String, dynamic>;
    final list = (json['photos'] as List).cast<Map<String, dynamic>>();
    return list.map((e) => DayPhoto.fromJson(e)).toList();
  }

  /// 按月份 → 日 建索引，便于日历网格直接查某天。
  Map<int, Map<int, DayPhoto>> indexByMonth(List<DayPhoto> all) {
    final map = <int, Map<int, DayPhoto>>{};
    for (final p in all) {
      map.putIfAbsent(p.month, () => {})[p.day] = p;
    }
    return map;
  }
}

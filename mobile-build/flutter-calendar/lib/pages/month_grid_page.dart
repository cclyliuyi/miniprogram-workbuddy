import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../data/calendar_repository.dart';
import '../models/photo.dart';

/// 月历网格主页（垂直切片）：7 列标准日历，每天格显示正面缩略图，今天高亮。
/// TODO(Phase B): 点格跳翻卡详情；加「年视图」tab；历史上的今天 banner。
class MonthGridPage extends StatefulWidget {
  final CalendarRepository repository;
  const MonthGridPage({super.key, required this.repository});

  @override
  State<MonthGridPage> createState() => _MonthGridPageState();
}

class _MonthGridPageState extends State<MonthGridPage> {
  Map<int, Map<int, DayPhoto>> _index = {};
  int _month = DateTime.now().month;
  int _today = DateTime.now().day;
  bool _loading = true;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final all = await widget.repository.loadManifest();
      _index = widget.repository.indexByMonth(all);
    } catch (e) {
      _error = e.toString();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<List<int?>> _buildGrid(int month) {
    final daysInMonth = DateTime(2027, month + 1, 0).day;
    final firstWeekday = DateTime(2027, month, 1).weekday % 7; // 0=周日
    final cells = <int?>[];
    cells.addAll(List.filled(firstWeekday, null));
    for (var d = 1; d <= daysInMonth; d++) cells.add(d);
    while (cells.length % 7 != 0) cells.add(null);
    final rows = <List<int?>>[];
    for (var i = 0; i < cells.length; i += 7) {
      rows.add(cells.sublist(i, i + 7));
    }
    return rows;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('$_month 月')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error.isNotEmpty
              ? Center(child: Text('加载失败：$_error'))
              : ListView(
                  children: [
                    const Padding(
                      padding: EdgeInsets.all(8),
                      child: Row(
                        children: const [
                          Text('日'), Text('一'), Text('二'), Text('三'),
                          Text('四'), Text('五'), Text('六'),
                        ],
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                      ),
                    ),
                    ..._buildGrid(_month).map((week) => Row(
                          children: week.map((day) => _DayCell(
                                day: day,
                                isToday: day == _today && _month == DateTime.now().month,
                                photo: day != null ? _index[_month]?[day] : null,
                              )).toList(),
                        )),
                  ],
                ),
    );
  }
}

class _DayCell extends StatelessWidget {
  final int? day;
  final bool isToday;
  final DayPhoto? photo;
  const _DayCell({this.day, this.isToday = false, this.photo});

  @override
  Widget build(BuildContext context) {
    if (day == null) return const SizedBox.expand();
    final thumb = photo?.front.thumb;
    return AspectRatio(
      aspectRatio: 1,
      child: Container(
        margin: const EdgeInsets.all(2),
        decoration: BoxDecoration(
          border: isToday ? Border.all(color: const Color(0xFF0C447C), width: 2) : null,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Column(
          children: [
            Expanded(
              child: thumb != null
                  ? ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: CachedNetworkImage(
                        imageUrl: thumb,
                        fit: BoxFit.cover,
                        placeholder: (_, __) => const Center(child: CircularProgressIndicator(strokeWidth: 2)),
                        errorWidget: (_, __, ___) => const Icon(Icons.image_not_supported),
                      ),
                    )
                  : const Icon(Icons.image_not_supported, size: 20),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Text('$day', style: const TextStyle(fontSize: 11)),
            ),
          ],
        ),
      ),
    );
  }
}

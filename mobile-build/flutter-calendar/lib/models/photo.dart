class PhotoSide {
  final String thumb;
  final String preview;
  final String original;

  const PhotoSide({
    required this.thumb,
    required this.preview,
    required this.original,
  });

  factory PhotoSide.fromJson(Map<String, dynamic> j) => PhotoSide(
        thumb: j['thumb'] as String,
        preview: j['preview'] as String,
        original: j['original'] as String,
      );
}

class DayPhoto {
  final int month;
  final int day;
  final PhotoSide front;
  final PhotoSide back;

  const DayPhoto({
    required this.month,
    required this.day,
    required this.front,
    required this.back,
  });

  factory DayPhoto.fromJson(Map<String, dynamic> j) => DayPhoto(
        month: j['month'] as int,
        day: j['day'] as int,
        front: PhotoSide.fromJson(j['front']),
        back: PhotoSide.fromJson(j['back']),
      );
}

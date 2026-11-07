/// Modelos da API do Kesh TV. Links relativos (logo?…, stream?…) viram absolutos com a base `api`.
library;

String _str(Map<String, dynamic> o, String k) => o[k]?.toString() ?? '';
int _int(Map<String, dynamic> o, String k) => (o[k] as num?)?.toInt() ?? 0;
DateTime? _time(String s) => DateTime.tryParse(s)?.toLocal();
String abs(String api, String u) => u.isEmpty ? '' : (u.startsWith('http') ? u : api + u);

class User {
  final String id, name, email;
  User(this.id, this.name, this.email);
  factory User.fromJson(Map<String, dynamic> o) => User(_str(o, 'id'), _str(o, 'name'), _str(o, 'email'));
}

class Programme {
  final String title, desc;
  final DateTime? start, stop;
  Programme(this.title, this.start, this.stop, this.desc);
  static Programme? fromJson(Map<String, dynamic>? o) =>
      o == null ? null : Programme(_str(o, 'title'), _time(_str(o, 'start')), _time(_str(o, 'stop')), _str(o, 'desc'));

  /// Fração já exibida (0–1).
  double progress([DateTime? now]) {
    final s = start, e = stop;
    if (s == null || e == null || !e.isAfter(s)) return 0;
    final n = now ?? DateTime.now();
    return (n.difference(s).inSeconds / e.difference(s).inSeconds).clamp(0.0, 1.0);
  }
}

class Channel {
  final String id, name, group, kind, playlistId, logo;
  final int? number;
  final bool favorite;
  final Programme? now, next;
  final double progress;
  Channel({
    required this.id, required this.name, required this.group, required this.kind, required this.playlistId,
    required this.logo, this.number, this.favorite = false, this.now, this.next, this.progress = 0,
  });
  factory Channel.fromJson(String api, Map<String, dynamic> o) => Channel(
        id: _str(o, 'id'), name: _str(o, 'name'), group: _str(o, 'group'), kind: _str(o, 'kind'),
        playlistId: _str(o, 'playlistId'), logo: abs(api, _str(o, 'logo')), number: (o['number'] as num?)?.toInt(),
        favorite: o['favorite'] == true, now: Programme.fromJson(o['now']), next: Programme.fromJson(o['next']),
        progress: (o['progress'] as num?)?.toDouble() ?? 0,
      );
}

class Group {
  final String name;
  final int count;
  Group(this.name, this.count);
}

class Series {
  final String playlistId, name, group, logo;
  final int episodes, seasons;
  Series(this.playlistId, this.name, this.group, this.logo, this.episodes, this.seasons);
}

class Episode {
  final Channel channel;
  final int season, episode;
  Episode(this.channel, this.season, this.episode);
}

class Source {
  final String type, via, url;
  Source(this.type, this.via, this.url);
}

class PlayInfo {
  final Channel channel;
  final List<Source> sources;
  final String original;
  final int resume;
  PlayInfo(this.channel, this.sources, this.original, this.resume);
}

class Page<T> {
  final List<T> items;
  final bool hasMore;
  Page(this.items, this.hasMore);
}

List<Map<String, dynamic>> _list(dynamic v) => (v as List? ?? const []).cast<Map<String, dynamic>>();

class Parse {
  static Page<Channel> channels(String api, Map<String, dynamic> o) =>
      Page(_list(o['channels']).map((c) => Channel.fromJson(api, c)).toList(), o['hasMore'] == true);
  static List<Group> groups(Map<String, dynamic> o) => _list(o['groups']).map((g) => Group(_str(g, 'name'), _int(g, 'count'))).toList();
  static Page<Series> series(String api, Map<String, dynamic> o) => Page(
        _list(o['series'])
            .map((s) => Series(_str(s, 'playlistId'), _str(s, 'name'), _str(s, 'group'), abs(api, _str(s, 'logo')), _int(s, 'episodes'), _int(s, 'seasons')))
            .toList(),
        o['hasMore'] == true,
      );
  static List<Episode> episodes(String api, Map<String, dynamic> o) =>
      _list(o['episodes']).map((e) => Episode(Channel.fromJson(api, e), _int(e, 'season'), _int(e, 'episode'))).toList();
  static PlayInfo play(String api, Map<String, dynamic> o) => PlayInfo(
        Channel.fromJson(api, o['channel']),
        _list(o['sources']).map((s) => Source(_str(s, 'type'), _str(s, 'via'), abs(api, _str(s, 'url')))).toList(),
        _str(o, 'original'),
        _int(o, 'resume'),
      );
}

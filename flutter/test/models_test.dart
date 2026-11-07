import 'package:flutter_test/flutter_test.dart';
import 'package:kesh_tv/models.dart';

void main() {
  const api = 'https://x/kesh-tv/api/';
  test('canal com logo relativo e programa atual', () {
    final c = Channel.fromJson(api, {
      'id': '1', 'name': 'Jornal', 'group': 'Notícias', 'kind': 'live', 'playlistId': 'p', 'logo': 'logo?u=a', 'number': 3,
      'now': {'title': 'Agora', 'start': '2026-01-01T10:00:00Z', 'stop': '2026-01-01T11:00:00Z'},
    });
    expect(c.logo, '${api}logo?u=a');
    expect(c.number, 3);
    expect(c.now!.progress(DateTime.utc(2026, 1, 1, 10, 30)), closeTo(0.5, 0.001));
  });
  test('play com fontes', () {
    final p = Parse.play(api, {
      'channel': {'id': '1', 'name': 'F', 'kind': 'movie'},
      'sources': [{'type': 'hls', 'via': 'proxy', 'url': 'stream?x'}],
      'original': 'http://a/b.mkv', 'resume': 42,
    });
    expect(p.sources.single.url, '${api}stream?x');
    expect(p.resume, 42);
  });
}

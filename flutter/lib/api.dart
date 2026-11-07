import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import 'models.dart';

class ApiError implements Exception {
  final int status; // 0 = sem conexão
  final String message;
  ApiError(this.status, this.message);
  @override
  String toString() => message;
}

/// Cliente da API do Kesh TV (`<servidor>/api/…`), com o token de login no cabeçalho.
class Api {
  final String api;
  final String? Function() token;
  Api(String server, this.token) : api = '${server.replaceAll(RegExp(r'/+$'), '')}/api/';

  Future<Map<String, dynamic>> _call(String method, String path, [Map<String, dynamic>? body]) async {
    final req = http.Request(method, Uri.parse(api + path))..headers['Accept'] = 'application/json';
    final t = token();
    if (t != null) req.headers['Authorization'] = 'Bearer $t';
    if (body != null) {
      req.headers['Content-Type'] = 'application/json';
      req.body = jsonEncode(body);
    }
    http.Response res;
    try {
      res = await http.Response.fromStream(await req.send().timeout(const Duration(seconds: 30)));
    } on SocketException {
      throw ApiError(0, 'Sem conexão com o servidor');
    } on http.ClientException {
      throw ApiError(0, 'Sem conexão com o servidor');
    }
    Map<String, dynamic> json = {};
    try {
      json = jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
    } catch (_) {}
    if (res.statusCode >= 400) throw ApiError(res.statusCode, json['error']?.toString() ?? 'Erro ${res.statusCode}');
    return json;
  }

  String _q(Map<String, Object?> p) => p.entries
      .where((e) => e.value != null && e.value.toString().isNotEmpty)
      .map((e) => '${e.key}=${Uri.encodeQueryComponent(e.value.toString())}')
      .join('&');

  Future<(String, User)> login(String email, String password) async {
    final r = await _call('POST', 'auth/login', {'email': email, 'password': password});
    return (r['token'] as String, User.fromJson(r['user']));
  }

  Future<User> me() async => User.fromJson((await _call('GET', 'auth/me'))['user']);
  Future<List<Group>> groups(String kind) async => Parse.groups(await _call('GET', 'groups?${_q({'kind': kind})}'));
  Future<Page<Channel>> channels({String? kind, String? group, String? query, int offset = 0}) async =>
      Parse.channels(api, await _call('GET', 'channels?${_q({'kind': kind, 'group': group, 'q': query, 'offset': offset, 'limit': 60})}'));
  Future<Page<Series>> series({String? group, String? query, int offset = 0}) async =>
      Parse.series(api, await _call('GET', 'series?${_q({'group': group, 'q': query, 'offset': offset, 'limit': 60})}'));
  Future<List<Episode>> episodes(String playlistId, String name) async =>
      Parse.episodes(api, await _call('GET', 'series/episodes?${_q({'playlist': playlistId, 'name': name})}'));
  Future<PlayInfo> play(String id) async => Parse.play(api, await _call('GET', 'channels/$id/play'));
  Future<(String?, String?)> around(String id) async {
    final r = await _call('GET', 'channels/$id/around');
    String? s(Object? v) => (v == null || v.toString().isEmpty) ? null : v.toString();
    return (s(r['prev']), s(r['next']));
  }

  Future<void> watched(String id) => _call('POST', 'channels/$id/watch', {});
  Future<void> progress(String id, double position, double duration) =>
      _call('PUT', 'channels/$id/progress', {'position': position, 'duration': duration});
  Future<List<Channel>> favorites() async => Parse.channels(api, await _call('GET', 'favorites')).items;
  Future<void> setFavorite(String id, bool on) => _call(on ? 'POST' : 'DELETE', 'favorites/$id', on ? {} : null);
  Future<List<Channel>> history() async => Parse.channels(api, await _call('GET', 'history')).items;
}

import 'package:shared_preferences/shared_preferences.dart';

/// Servidor padrão; no build dá para trocar com `--dart-define=KESH_SERVER=...`.
const defaultServer = String.fromEnvironment('KESH_SERVER', defaultValue: 'https://central-apps-hub.com.br/kesh-tv/');

/// Token de login e endereço do servidor guardados no aparelho.
class Store {
  final SharedPreferences _p;
  Store._(this._p);
  static Future<Store> open() async => Store._(await SharedPreferences.getInstance());

  String? get token => _p.getString('token');
  set token(String? v) => v == null ? _p.remove('token') : _p.setString('token', v);
  String get server => _p.getString('server') ?? defaultServer;
  set server(String v) => _p.setString('server', v);
}

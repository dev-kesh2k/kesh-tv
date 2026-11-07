import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'api.dart';
import 'home_screen.dart';
import 'login_screen.dart';
import 'player_screen.dart';
import 'store.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(KeshApp(store: await Store.open()));
}

class KeshApp extends StatefulWidget {
  final Store store;
  const KeshApp({super.key, required this.store});
  @override
  State<KeshApp> createState() => _KeshAppState();
}

class _KeshAppState extends State<KeshApp> {
  void _logout() => setState(() => widget.store.token = null);

  @override
  Widget build(BuildContext context) {
    final store = widget.store;
    final logged = store.token != null;
    return MaterialApp(
      title: 'Kesh TV',
      debugShowCheckedModeBanner: false,
      theme: keshTheme(),
      // Controle remoto: OK/Enter ativa o item em foco.
      shortcuts: {...WidgetsApp.defaultShortcuts, const SingleActivator(LogicalKeyboardKey.select): const ActivateIntent()},
      home: logged
          ? Builder(builder: (context) {
              final api = Api(store.server, () => store.token);
              void push(Widget w) => Navigator.of(context).push(MaterialPageRoute(builder: (_) => w));
              return HomeScreen(
                api: api,
                onOpen: (c) => push(PlayerScreen(api: api, id: c.id)),
                onSeries: (s) => push(Scaffold(body: Center(child: Text(s.name)))),
                onFavorites: () {},
                onAccount: _logout,
                onUnauthorized: _logout,
              );
            })
          : LoginScreen(store: store, onLogged: () => setState(() {})),
    );
  }
}

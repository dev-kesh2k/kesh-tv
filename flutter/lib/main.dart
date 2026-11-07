import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'api.dart';
import 'login_screen.dart';
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
          ? HomePlaceholder(api: Api(store.server, () => store.token), onLogout: _logout)
          : LoginScreen(store: store, onLogged: () => setState(() {})),
    );
  }
}

class HomePlaceholder extends StatelessWidget {
  final Api api;
  final VoidCallback onLogout;
  const HomePlaceholder({super.key, required this.api, required this.onLogout});
  @override
  Widget build(BuildContext context) => Scaffold(body: Center(child: TextButton(onPressed: onLogout, child: const Text('Sair'))));
}

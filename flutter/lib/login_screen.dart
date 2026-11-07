import 'package:flutter/material.dart';

import 'api.dart';
import 'store.dart';
import 'theme.dart';

class LoginScreen extends StatefulWidget {
  final Store store;
  final VoidCallback onLogged;
  const LoginScreen({super.key, required this.store, required this.onLogged});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _pass = TextEditingController();
  late final _server = TextEditingController(text: widget.store.server);
  String _error = '';
  bool _busy = false;

  Future<void> _enter() async {
    setState(() { _busy = true; _error = ''; });
    try {
      final (token, _) = await Api(_server.text.trim(), () => null).login(_email.text.trim(), _pass.text);
      widget.store.server = _server.text.trim();
      widget.store.token = token;
      widget.onLogged();
    } on ApiError catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        body: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: AutofillGroup(
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Text('Kesh TV', style: condensed.copyWith(fontSize: 40, color: Kesh.paper)),
                  const SizedBox(height: 24),
                  TextField(controller: _email, autofocus: true, keyboardType: TextInputType.emailAddress, autofillHints: const [AutofillHints.email], decoration: const InputDecoration(labelText: 'E-mail'), textInputAction: TextInputAction.next),
                  const SizedBox(height: 12),
                  TextField(controller: _pass, obscureText: true, autofillHints: const [AutofillHints.password], decoration: const InputDecoration(labelText: 'Senha'), onSubmitted: (_) => _enter()),
                  const SizedBox(height: 12),
                  TextField(controller: _server, keyboardType: TextInputType.url, decoration: const InputDecoration(labelText: 'Servidor')),
                  if (_error.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_error, style: const TextStyle(color: Kesh.tally))),
                  const SizedBox(height: 20),
                  FilledButton(onPressed: _busy ? null : _enter, style: FilledButton.styleFrom(padding: const EdgeInsets.all(16)), child: Text(_busy ? 'Entrando…' : 'Entrar')),
                ]),
              ),
            ),
          ),
        ),
      );
}

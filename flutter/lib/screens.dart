import 'package:flutter/material.dart';

import 'api.dart';
import 'models.dart';
import 'store.dart';
import 'theme.dart';
import 'widgets.dart';

/// Cabeçalho das telas internas: voltar + título.
PreferredSizeWidget header(String title) => AppBar(
      backgroundColor: Kesh.ink,
      foregroundColor: Kesh.paper,
      title: Text(title, style: condensed.copyWith(fontSize: 24), maxLines: 1, overflow: TextOverflow.ellipsis),
    );

/// Espera um Future e mostra carregando / erro / conteúdo.
Widget loader<T>(Future<T> future, Widget Function(T) done) => FutureBuilder<T>(
      future: future,
      builder: (_, s) {
        if (s.hasError) return Padding(padding: const EdgeInsets.all(16), child: Text(s.error.toString()));
        if (!s.hasData) return const Center(child: CircularProgressIndicator(color: Kesh.signal));
        return done(s.data as T);
      },
    );

class SeriesScreen extends StatefulWidget {
  final Api api;
  final Series series;
  final void Function(Channel) onOpen;
  const SeriesScreen({super.key, required this.api, required this.series, required this.onOpen});
  @override
  State<SeriesScreen> createState() => _SeriesScreenState();
}

class _SeriesScreenState extends State<SeriesScreen> {
  late final _future = widget.api.episodes(widget.series.playlistId, widget.series.name);
  int? _season;

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: header(widget.series.name),
        body: loader(_future, (List<Episode> list) {
          if (list.isEmpty) return const Padding(padding: EdgeInsets.all(16), child: Text('Nenhum episódio encontrado.'));
          final seasons = list.map((e) => e.season).toSet().toList()..sort();
          // Abre na temporada do último episódio começado, senão na primeira.
          final season = _season ?? list.lastWhere((e) => e.channel.progress > 0, orElse: () => list.first).season;
          final shown = seasons.length == 1 ? list : list.where((e) => e.season == season).toList();
          return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (seasons.length > 1)
              SizedBox(
                height: 64,
                child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6), children: [
                  for (final s in seasons)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: Tap(
                        onTap: () => setState(() => _season = s),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(color: s == season ? Kesh.signal : Kesh.panel, borderRadius: BorderRadius.circular(6)),
                          child: Text(s == 0 ? 'Extras' : 'Temporada $s', style: TextStyle(color: s == season ? Kesh.ink : Kesh.paper)),
                        ),
                      ),
                    ),
                ]),
              ),
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.all(12),
                itemCount: shown.length,
                separatorBuilder: (_, __) => const Divider(height: 1, color: Kesh.line),
                itemBuilder: (_, i) {
                  final e = shown[i];
                  return Tap(
                    autofocus: i == 0,
                    onTap: () => widget.onOpen(e.channel),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
                      child: Row(children: [
                        SizedBox(width: 48, child: Text(e.episode > 0 ? 'E${e.episode}' : '•', style: condensed.copyWith(color: Kesh.signal, fontSize: 17))),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(e.channel.name, maxLines: 2, overflow: TextOverflow.ellipsis),
                            if (e.channel.progress > 0) Padding(padding: const EdgeInsets.only(top: 6), child: Bar(e.channel.progress)),
                          ]),
                        ),
                      ]),
                    ),
                  );
                },
              ),
            ),
          ]);
        }),
      );
}

/// Favoritos e "vistos por último" numa lista só.
class FavoritesScreen extends StatelessWidget {
  final Api api;
  final void Function(Channel) onOpen;
  const FavoritesScreen({super.key, required this.api, required this.onOpen});

  Future<(List<Channel>, List<Channel>)> _load() async {
    final favs = await api.favorites();
    final hist = await api.history().catchError((_) => <Channel>[]);
    return (favs, hist.take(20).toList());
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: header('Favoritos'),
        body: loader(_load(), ((List<Channel>, List<Channel>) r) {
          final (favs, hist) = r;
          if (favs.isEmpty && hist.isEmpty) {
            return const Padding(padding: EdgeInsets.all(16), child: Text('Nada por aqui ainda. Toque no coração de um canal para guardá-lo.'));
          }
          return ListView(padding: const EdgeInsets.symmetric(horizontal: 8), children: [
            for (final (i, c) in favs.indexed) GuideRow(c, autofocus: i == 0, onTap: () => onOpen(c)),
            if (hist.isNotEmpty) Padding(padding: const EdgeInsets.fromLTRB(12, 20, 12, 4), child: Text('Vistos por último', style: condensed.copyWith(color: Kesh.signal, fontSize: 18))),
            for (final c in hist) GuideRow(c, onTap: () => onOpen(c)),
          ]);
        }),
      );
}

class AccountScreen extends StatelessWidget {
  final Api api;
  final Store store;
  final VoidCallback onLogout;
  const AccountScreen({super.key, required this.api, required this.store, required this.onLogout});

  Widget _info(String label, String value) => Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(color: Kesh.signal, fontSize: 12)),
          Text(value, style: const TextStyle(fontSize: 16)),
        ]),
      );

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: header('Conta'),
        body: Padding(
          padding: const EdgeInsets.all(16),
          child: FutureBuilder<User>(
            future: api.me(),
            builder: (_, s) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              _info('Nome', s.data?.name ?? '…'),
              _info('E-mail', s.data?.email ?? '…'),
              _info('Servidor', store.server),
              _info('Versão', 'Flutter 1.0.0'),
              const SizedBox(height: 8),
              FilledButton(
                autofocus: true,
                style: FilledButton.styleFrom(backgroundColor: Kesh.tally, foregroundColor: Kesh.paper),
                onPressed: () {
                  Navigator.of(context).pop();
                  onLogout();
                },
                child: const Text('Sair da conta'),
              ),
            ]),
          ),
        ),
      );
}

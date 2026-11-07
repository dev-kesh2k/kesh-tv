import 'dart:async';

import 'package:flutter/material.dart';

import 'api.dart';
import 'models.dart';
import 'theme.dart';
import 'widgets.dart';

/// Tela principal: abas Ao vivo / Filmes / Séries, grupos em fileira e a lista (grade de programação ou pôsteres).
class HomeScreen extends StatefulWidget {
  final Api api;
  final void Function(Channel) onOpen;
  final void Function(Series) onSeries;
  final VoidCallback onFavorites, onAccount, onUnauthorized;
  const HomeScreen({super.key, required this.api, required this.onOpen, required this.onSeries, required this.onFavorites, required this.onAccount, required this.onUnauthorized});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  static const _tabs = {'live': 'Ao vivo', 'movie': 'Filmes', 'series': 'Séries'};
  String _kind = 'live';
  String? _group;
  String _query = '';
  List<Group> _groups = [];
  List<Channel> _channels = [];
  List<Series> _series = [];
  bool _hasMore = false, _loading = false;
  String _error = '';
  Timer? _debounce;
  int _req = 0;

  bool get _showSeries => _kind == 'series' && _query.isEmpty;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _guard(Future<void> Function() f) async {
    try {
      await f();
    } on ApiError catch (e) {
      if (e.status == 401) return widget.onUnauthorized();
      if (mounted) setState(() => _error = e.message);
    }
  }

  void _reload() {
    _channels = [];
    _series = [];
    _error = '';
    _guard(() async {
      final g = await widget.api.groups(_kind);
      if (mounted) setState(() => _groups = g);
    });
    _load(0);
  }

  Future<void> _load(int offset) async {
    final req = ++_req;
    setState(() => _loading = true);
    await _guard(() async {
      final q = _query.isEmpty ? null : _query;
      if (_showSeries) {
        final p = await widget.api.series(group: _group, query: q, offset: offset);
        if (req == _req && mounted) setState(() { _series = [..._series, ...p.items]; _hasMore = p.hasMore; });
      } else {
        final p = await widget.api.channels(kind: q == null ? _kind : null, group: q == null ? _group : null, query: q, offset: offset);
        if (req == _req && mounted) setState(() { _channels = [..._channels, ...p.items]; _hasMore = p.hasMore; });
      }
    });
    if (req == _req && mounted) setState(() => _loading = false);
  }

  void _more(int index, int total) {
    if (index >= total - 8 && _hasMore && !_loading) WidgetsBinding.instance.addPostFrameCallback((_) => _load(total));
  }

  Widget _chip(String label, bool on, VoidCallback onTap) => Padding(
        padding: const EdgeInsets.only(right: 8),
        child: Tap(
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(color: on ? Kesh.signal : Kesh.panel, borderRadius: BorderRadius.circular(6)),
            child: Text(label, style: TextStyle(color: on ? Kesh.ink : Kesh.paper)),
          ),
        ),
      );

  Widget _list() {
    if (_error.isNotEmpty) return Center(child: Text(_error));
    if (_loading && _channels.isEmpty && _series.isEmpty) return const Center(child: CircularProgressIndicator(color: Kesh.signal));
    const grid = SliverGridDelegateWithMaxCrossAxisExtent(maxCrossAxisExtent: 150, childAspectRatio: 0.55);
    if (_showSeries) {
      if (_series.isEmpty) return const Center(child: Text('Nada encontrado.'));
      return GridView.builder(
        padding: const EdgeInsets.all(12),
        gridDelegate: grid,
        itemCount: _series.length,
        itemBuilder: (_, i) {
          _more(i, _series.length);
          final s = _series[i];
          return Poster(logo: s.logo, title: s.name, subtitle: s.seasons > 1 ? '${s.seasons} temporadas, ${s.episodes} episódios' : '${s.episodes} episódios', onTap: () => widget.onSeries(s));
        },
      );
    }
    if (_channels.isEmpty) return const Center(child: Text('Nada encontrado.'));
    if (_kind == 'live' && _query.isEmpty) {
      return ListView.separated(
        padding: const EdgeInsets.symmetric(horizontal: 8),
        itemCount: _channels.length,
        separatorBuilder: (_, __) => const Divider(height: 1, color: Kesh.line),
        itemBuilder: (_, i) {
          _more(i, _channels.length);
          return GuideRow(_channels[i], autofocus: i == 0, onTap: () => widget.onOpen(_channels[i]));
        },
      );
    }
    return GridView.builder(
      padding: const EdgeInsets.all(12),
      gridDelegate: grid,
      itemCount: _channels.length,
      itemBuilder: (_, i) {
        _more(i, _channels.length);
        final c = _channels[i];
        return Poster(logo: c.logo, title: c.name, subtitle: groupLabel(c.group, c.kind), progress: c.progress, onTap: () => widget.onOpen(c));
      },
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        body: SafeArea(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 4, 0),
              child: Row(children: [
                Expanded(child: Text('Kesh TV', style: condensed.copyWith(fontSize: 28, color: Kesh.paper))),
                IconButton(onPressed: widget.onFavorites, tooltip: 'Favoritos', icon: const Icon(Icons.favorite_border)),
                IconButton(onPressed: widget.onAccount, tooltip: 'Conta', icon: const Icon(Icons.account_circle_outlined)),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
              child: TextField(
                decoration: const InputDecoration(hintText: 'Buscar canal, filme ou série', isDense: true),
                onChanged: (v) {
                  _debounce?.cancel();
                  _debounce = Timer(const Duration(milliseconds: 400), () => setState(() { _query = v.trim(); _channels = []; _series = []; _load(0); }));
                },
              ),
            ),
            if (_query.isEmpty) ...[
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 8, 8, 0),
                child: Row(
                  children: _tabs.entries
                      .map((t) => Tap(
                            onTap: () => setState(() { _kind = t.key; _group = null; _reload(); }),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text(t.value, style: condensed.copyWith(fontSize: 22, color: t.key == _kind ? Kesh.paper : Kesh.muted)),
                                Container(height: 3, width: 32, color: t.key == _kind ? Kesh.signal : Colors.transparent),
                              ]),
                            ),
                          ))
                      .toList(),
                ),
              ),
              const Divider(height: 1, color: Kesh.line),
              SizedBox(
                height: 68,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  children: [
                    _chip('Todos', _group == null, () => setState(() { _group = null; _reload(); })),
                    for (final g in _groups) _chip('${groupLabel(g.name, _kind)}  ${g.count}', _group == g.name, () => setState(() { _group = g.name; _reload(); })),
                  ],
                ),
              ),
            ],
            Expanded(child: _list()),
          ]),
        ),
      );
}

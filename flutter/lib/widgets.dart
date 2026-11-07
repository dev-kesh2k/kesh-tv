import 'package:flutter/material.dart';

import 'models.dart';
import 'theme.dart';

String hhmm(DateTime? t) => t == null ? '' : '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

// Palavras que não identificam o canal ("Canal 24H Animes" → "24H Animes").
final _generic = RegExp(r'^(canal|canais|tv|hd|fhd|uhd|sd|4k|br|o|a|de|do|da)$', caseSensitive: false);
String monogram(String name) {
  final w = name.split(RegExp(r'[^\p{L}\p{N}]+', unicode: true)).where((s) => s.isNotEmpty && !_generic.hasMatch(s)).toList();
  if (w.isEmpty) return '';
  final m = w.length == 1 ? (w[0].length > 2 ? w[0].substring(0, 2) : w[0]) : '${w[0][0]}${w[1][0]}';
  return m.toUpperCase();
}

/// Nome do grupo sem repetir o tipo ("Filmes | Ação" → "Ação").
String groupLabel(String name, String kind) {
  if (name.isEmpty) return 'Sem grupo';
  final words = const {'live': 'canais|tv|ao vivo', 'movie': 'filmes?|movies?|vod', 'series': r's[ée]ries?'}[kind];
  if (words == null) return name;
  final s = name.replaceFirst(RegExp('^\\s*($words)\\s*[|:\\-–•]\\s*', caseSensitive: false), '').trim();
  return s.isEmpty ? name : s;
}

/// Área clicável com anel âmbar quando recebe o foco do controle remoto.
class Tap extends StatefulWidget {
  final Widget child;
  final VoidCallback onTap;
  final bool autofocus;
  const Tap({super.key, required this.child, required this.onTap, this.autofocus = false});
  @override
  State<Tap> createState() => _TapState();
}

class _TapState extends State<Tap> {
  bool _focused = false;
  @override
  Widget build(BuildContext context) => InkWell(
        autofocus: widget.autofocus,
        onTap: widget.onTap,
        onFocusChange: (f) {
          setState(() => _focused = f);
          // Mantém o item focado visível ao navegar com as setas.
          if (f) Scrollable.ensureVisible(context, alignment: 0.5, duration: const Duration(milliseconds: 150));
        },
        borderRadius: BorderRadius.circular(6),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(6),
            border: Border.all(color: _focused ? Kesh.signal : Colors.transparent, width: 3),
          ),
          child: widget.child,
        ),
      );
}

/// Logo do canal; sem logo, o nome (ou iniciais em espaço pequeno) sobre fundo liso.
class Logo extends StatelessWidget {
  final String url, name;
  final bool cover, compact;
  const Logo(this.url, this.name, {super.key, this.cover = false, this.compact = false});

  Widget _fallback() => Center(
        child: Padding(
          padding: const EdgeInsets.all(6),
          child: Text(compact ? monogram(name) : name, textAlign: TextAlign.center, maxLines: 3, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600)),
        ),
      );

  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(6),
        child: ColoredBox(
          color: Kesh.line.withOpacity(0.6),
          child: url.isEmpty
              ? _fallback()
              : Padding(
                  padding: EdgeInsets.all(cover ? 0 : 8),
                  child: Image.network(url, fit: cover ? BoxFit.cover : BoxFit.contain, width: double.infinity, height: double.infinity, errorBuilder: (_, __, ___) => _fallback()),
                ),
        ),
      );
}

/// Barra fina de progresso (programa no ar ou quanto já foi assistido).
class Bar extends StatelessWidget {
  final double value;
  const Bar(this.value, {super.key});
  @override
  Widget build(BuildContext context) => LinearProgressIndicator(value: value.clamp(0, 1), minHeight: 3, color: Kesh.signal, backgroundColor: Kesh.line);
}

/// Linha da grade de programação: número, logo, nome e o que está no ar.
class GuideRow extends StatelessWidget {
  final Channel c;
  final VoidCallback onTap;
  final bool autofocus;
  const GuideRow(this.c, {super.key, required this.onTap, this.autofocus = false});
  @override
  Widget build(BuildContext context) {
    final now = c.now;
    return Tap(
      onTap: onTap,
      autofocus: autofocus,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        child: Row(children: [
          SizedBox(width: 40, child: Text(c.number?.toString() ?? '', textAlign: TextAlign.end, style: const TextStyle(color: Kesh.muted, fontSize: 17))),
          const SizedBox(width: 12),
          SizedBox(width: 76, child: AspectRatio(aspectRatio: 16 / 9, child: Logo(c.logo, c.name, compact: true))),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(c.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: condensed.copyWith(fontSize: 19, color: Kesh.paper)),
              if (now != null) ...[
                Text(now.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Kesh.muted)),
                const SizedBox(height: 4),
                Row(children: [Expanded(child: Bar(now.progress())), Text('  até ${hhmm(now.stop)}', style: const TextStyle(color: Kesh.muted, fontSize: 12))]),
              ] else
                Text(groupLabel(c.group, c.kind), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Kesh.muted)),
            ]),
          ),
          if (c.favorite) const Padding(padding: EdgeInsets.only(left: 8), child: Icon(Icons.favorite, color: Kesh.signal, size: 18)),
        ]),
      ),
    );
  }
}

/// Pôster (filmes, séries) com o título solto embaixo.
class Poster extends StatelessWidget {
  final String logo, title, subtitle;
  final double progress;
  final VoidCallback onTap;
  const Poster({super.key, required this.logo, required this.title, required this.subtitle, this.progress = 0, required this.onTap});
  @override
  Widget build(BuildContext context) => Tap(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(4),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(
              child: Stack(fit: StackFit.expand, children: [
                Logo(logo, title, cover: true),
                if (progress > 0) Align(alignment: Alignment.bottomCenter, child: Bar(progress)),
              ]),
            ),
            const SizedBox(height: 6),
            Text(title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14)),
            if (subtitle.isNotEmpty) Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Kesh.muted, fontSize: 12)),
          ]),
        ),
      );
}

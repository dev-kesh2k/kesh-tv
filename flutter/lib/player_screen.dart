import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:video_player/video_player.dart';

import 'api.dart';
import 'models.dart';
import 'theme.dart';
import 'widgets.dart';

/// Tela acesa enquanto o player está aberto (FLAG_KEEP_SCREEN_ON no MainActivity).
const _screen = MethodChannel('kesh_tv/screen');
void _keepOn(bool on) => _screen.invokeMethod('keepOn', on).ignore();

const _ua = 'VLC/3.0.20 LibVLC/3.0.20';

/// Fontes em ordem: o link original direto no aparelho (o ExoPlayer toca TS, MKV…), depois as do servidor.
List<(String, bool)> candidates(PlayInfo p) {
  final hls = RegExp(r'\.m3u8?(\?|$)');
  final out = <(String, bool)>[(p.original, hls.hasMatch(p.original))];
  for (final s in p.sources) {
    if (s.via == 'proxy' && s.type != 'convert' && !out.any((o) => o.$1 == s.url)) out.add((s.url, s.type == 'hls'));
  }
  return out.where((o) => o.$1.isNotEmpty).toList();
}

class PlayerScreen extends StatefulWidget {
  final Api api;
  final String id;
  const PlayerScreen({super.key, required this.api, required this.id});
  @override
  State<PlayerScreen> createState() => _PlayerScreenState();
}

class _PlayerScreenState extends State<PlayerScreen> {
  late String _id = widget.id;
  PlayInfo? _info;
  VideoPlayerController? _ctl;
  String _error = '';
  String? _prev, _next;
  bool _osd = true;
  Timer? _osdTimer, _progress;
  final _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    _keepOn(true);
    _open();
  }

  @override
  void dispose() {
    _keepOn(false);
    _osdTimer?.cancel();
    _progress?.cancel();
    _saveProgress();
    _ctl?.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _showOsd() {
    setState(() => _osd = true);
    _osdTimer?.cancel();
    _osdTimer = Timer(const Duration(seconds: 5), () => mounted ? setState(() => _osd = false) : null);
  }

  Future<void> _open() async {
    setState(() { _error = ''; _info = null; });
    try {
      final p = await widget.api.play(_id);
      if (!mounted) return;
      setState(() => _info = p);
      _showOsd();
      await _tryAll(candidates(p), p.resume);
      widget.api.watched(_id).ignore();
      final (prev, next) = await widget.api.around(_id);
      if (mounted) setState(() { _prev = prev; _next = next; });
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _tryAll(List<(String, bool)> list, int resume) async {
    for (final (url, hls) in list) {
      final ctl = VideoPlayerController.networkUrl(Uri.parse(url), httpHeaders: const {'User-Agent': _ua}, formatHint: hls ? VideoFormat.hls : null);
      try {
        await ctl.initialize().timeout(const Duration(seconds: 25));
        if (resume > 0) await ctl.seekTo(Duration(seconds: resume));
        await ctl.play();
        final old = _ctl;
        if (!mounted) return ctl.dispose();
        setState(() => _ctl = ctl);
        old?.dispose();
        _progress?.cancel();
        if (_info?.channel.kind != 'live') _progress = Timer.periodic(const Duration(seconds: 15), (_) => _saveProgress());
        return;
      } catch (_) {
        await ctl.dispose();
      }
    }
    if (mounted) setState(() => _error = 'Não foi possível abrir este canal. Ele pode estar fora do ar no provedor.');
  }

  void _saveProgress() {
    final v = _ctl?.value;
    if (v == null || _info?.channel.kind == 'live' || v.duration.inSeconds <= 0 || v.position.inSeconds < 2) return;
    widget.api.progress(_id, v.position.inMilliseconds / 1000, v.duration.inMilliseconds / 1000).ignore();
  }

  void _go(String? target) {
    if (target == null) return;
    _saveProgress();
    _id = target;
    _open();
  }

  KeyEventResult _key(FocusNode _, KeyEvent e) {
    if (e is! KeyDownEvent) return KeyEventResult.ignored;
    final live = _info?.channel.kind == 'live';
    final k = e.logicalKey;
    if (live && (k == LogicalKeyboardKey.arrowUp || k == LogicalKeyboardKey.channelUp)) { _go(_prev); return KeyEventResult.handled; }
    if (live && (k == LogicalKeyboardKey.arrowDown || k == LogicalKeyboardKey.channelDown)) { _go(_next); return KeyEventResult.handled; }
    final ctl = _ctl;
    if (!live && ctl != null && (k == LogicalKeyboardKey.arrowLeft || k == LogicalKeyboardKey.arrowRight)) {
      ctl.seekTo(ctl.value.position + Duration(seconds: k == LogicalKeyboardKey.arrowLeft ? -10 : 30));
      _showOsd();
      return KeyEventResult.handled;
    }
    if (ctl != null && (k == LogicalKeyboardKey.select || k == LogicalKeyboardKey.enter || k == LogicalKeyboardKey.mediaPlayPause)) {
      ctl.value.isPlaying ? ctl.pause() : ctl.play();
      _showOsd();
      return KeyEventResult.handled;
    }
    _showOsd();
    return KeyEventResult.ignored;
  }

  @override
  Widget build(BuildContext context) {
    final c = _info?.channel;
    final ctl = _ctl;
    return Scaffold(
      backgroundColor: Colors.black,
      body: Focus(
        focusNode: _focus,
        autofocus: true,
        onKeyEvent: _key,
        child: GestureDetector(
          onTap: _showOsd,
          child: Stack(fit: StackFit.expand, children: [
            if (ctl != null && ctl.value.isInitialized)
              Center(child: AspectRatio(aspectRatio: ctl.value.aspectRatio, child: VideoPlayer(ctl)))
            else if (_error.isEmpty)
              const Center(child: CircularProgressIndicator(color: Kesh.signal)),
            if (c != null)
              AnimatedOpacity(
                opacity: _osd ? 1 : 0,
                duration: const Duration(milliseconds: 250),
                child: Align(
                  alignment: Alignment.topCenter,
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.fromLTRB(24, 40, 24, 32),
                    decoration: const BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xD9000000), Colors.transparent])),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                      if (c.kind == 'live')
                        Container(color: Kesh.tally, padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2), child: const Text('Ao vivo', style: TextStyle(color: Colors.white))),
                      Text(c.name, style: condensed.copyWith(fontSize: 30, color: Kesh.paper)),
                      if (c.now != null) Text('Agora: ${c.now!.title}, até ${hhmm(c.now!.stop)}', style: const TextStyle(color: Kesh.paper)),
                      if (c.next != null) Text('A seguir: ${hhmm(c.next!.start)} ${c.next!.title}', style: const TextStyle(color: Kesh.muted)),
                    ]),
                  ),
                ),
              ),
            if (ctl != null && c != null && c.kind != 'live' && _osd)
              Align(
                alignment: Alignment.bottomCenter,
                child: Padding(padding: const EdgeInsets.all(24), child: VideoProgressIndicator(ctl, allowScrubbing: true, colors: const VideoProgressColors(playedColor: Kesh.signal))),
              ),
            if (_error.isNotEmpty)
              Center(
                child: Container(
                  constraints: const BoxConstraints(maxWidth: 420),
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(color: Kesh.panel, borderRadius: BorderRadius.circular(6)),
                  child: Text(_error),
                ),
              ),
          ]),
        ),
      ),
    );
  }
}

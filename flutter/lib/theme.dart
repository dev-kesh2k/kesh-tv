import 'package:flutter/material.dart';

/// Paleta do Kesh TV: tinta, papel, sinal (âmbar) e tally (vermelho do "no ar").
class Kesh {
  static const ink = Color(0xFF0F1724);
  static const panel = Color(0xFF1A2333);
  static const paper = Color(0xFFECE7DC);
  static const muted = Color(0xFF8A93A3);
  static const signal = Color(0xFFF2B705);
  static const tally = Color(0xFFE0412F);
}

/// Títulos em fonte condensada (a do próprio Android).
const condensed = TextStyle(fontFamily: 'sans-serif-condensed', fontWeight: FontWeight.w700);

ThemeData keshTheme() {
  final base = ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    scaffoldBackgroundColor: Kesh.ink,
    colorScheme: const ColorScheme.dark(primary: Kesh.signal, onPrimary: Kesh.ink, surface: Kesh.ink, onSurface: Kesh.paper, error: Kesh.tally),
    // Anel âmbar no foco para quem usa controle remoto.
    focusColor: Kesh.signal.withOpacity(0.25),
  );
  return base.copyWith(
    inputDecorationTheme: const InputDecorationTheme(
      filled: true,
      fillColor: Kesh.panel,
      border: OutlineInputBorder(borderSide: BorderSide.none),
      focusedBorder: OutlineInputBorder(borderSide: BorderSide(color: Kesh.signal, width: 2)),
    ),
  );
}

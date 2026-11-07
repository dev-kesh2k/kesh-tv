package br.com.centralappshub.keshtv.kotlin

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/** Mesma identidade do site: azul-tinta, texto de papel, âmbar do controle, vermelho só no "ao vivo". */
object Kesh {
  val Ink = Color(0xFF0F1724)
  val Panel = Color(0xFF172133)
  val Line = Color(0xFF26324A)
  val Paper = Color(0xFFECE7DC)
  val Fog = Color(0xFF8C96A8)
  val Signal = Color(0xFFF2B705)
  val Tally = Color(0xFFE0412F)
}

// Títulos estreitos (Roboto Condensed do sistema), como nos guias de programação impressos.
val Condensed = FontFamily(android.graphics.Typeface.create("sans-serif-condensed", android.graphics.Typeface.BOLD))

@Composable
fun KeshTheme(content: @Composable () -> Unit) {
  MaterialTheme(
    colorScheme = darkColorScheme(
      primary = Kesh.Signal, onPrimary = Kesh.Ink,
      background = Kesh.Ink, onBackground = Kesh.Paper,
      surface = Kesh.Ink, onSurface = Kesh.Paper,
      surfaceVariant = Kesh.Panel, onSurfaceVariant = Kesh.Fog,
      outline = Kesh.Line, error = Kesh.Tally,
    ),
    typography = Typography(
      headlineLarge = TextStyle(fontFamily = Condensed, fontWeight = FontWeight.Bold, fontSize = 32.sp),
      titleLarge = TextStyle(fontFamily = Condensed, fontWeight = FontWeight.Bold, fontSize = 22.sp),
      titleMedium = TextStyle(fontFamily = Condensed, fontWeight = FontWeight.Bold, fontSize = 18.sp),
      bodyMedium = TextStyle(fontSize = 15.sp),
      bodySmall = TextStyle(fontSize = 13.sp, color = Kesh.Fog),
    ),
    content = content,
  )
}

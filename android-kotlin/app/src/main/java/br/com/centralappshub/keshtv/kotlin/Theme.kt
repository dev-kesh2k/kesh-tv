package br.com.centralappshub.keshtv.kotlin

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/** Identidade do site (papel, âmbar do controle, vermelho do "ao vivo") sobre grafite neutro:
 *  azul-marinho vira azul berrante no modo de imagem das TVs, cinza neutro não. */
object Kesh {
  val Ink = Color(0xFF0C0D10)
  val Panel = Color(0xFF17191E)
  val Raise = Color(0xFF262A32)
  val Line = Color(0xFF2A2D35)
  val Paper = Color(0xFFECE7DC)
  val Fog = Color(0xFF9EA3AD)
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
  ) {
    // Surface define a cor padrão do texto (papel); sem ela o Compose usa preto.
    Surface(color = Kesh.Ink, contentColor = Kesh.Paper, content = content)
  }
}

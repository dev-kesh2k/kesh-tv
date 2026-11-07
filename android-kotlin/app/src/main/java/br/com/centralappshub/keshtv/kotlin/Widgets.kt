package br.com.centralappshub.keshtv.kotlin

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private val hm = SimpleDateFormat("HH:mm", Locale("pt", "BR"))
fun hhmm(ms: Long): String = hm.format(Date(ms))

// Palavras que não identificam o canal ("Canal 24H Animes" → "24H Animes").
private val generic = Regex("^(canal|canais|tv|hd|fhd|uhd|sd|4k|br|o|a|de|do|da)$", RegexOption.IGNORE_CASE)
fun monogram(name: String): String {
  val w = name.split(Regex("[^\\p{L}\\p{N}]+")).filter { it.isNotEmpty() && !generic.matches(it) }
  return when { w.isEmpty() -> ""; w.size == 1 -> w[0].take(2); else -> "${w[0][0]}${w[1][0]}" }.uppercase()
}

/** Logo do canal; sem logo, o nome (ou iniciais em espaço pequeno) sobre fundo liso. */
@Composable
fun Logo(url: String, name: String, modifier: Modifier, cover: Boolean = false, compact: Boolean = false) {
  var failed by remember(url) { mutableStateOf(url.isEmpty()) }
  Box(modifier.clip(RoundedCornerShape(6.dp)).background(Kesh.Line.copy(alpha = 0.6f)), contentAlignment = Alignment.Center) {
    if (failed) {
      Text(
        if (compact) monogram(name) else name, style = MaterialTheme.typography.titleMedium, color = Kesh.Paper,
        textAlign = TextAlign.Center, maxLines = 3, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(6.dp),
      )
    } else {
      AsyncImage(
        model = url, contentDescription = null, onError = { failed = true },
        contentScale = if (cover) ContentScale.Crop else ContentScale.Fit,
        modifier = if (cover) Modifier.matchParentSizeCompat() else Modifier.padding(8.dp),
      )
    }
  }
}

@Composable private fun Modifier.matchParentSizeCompat() = this.fillMaxWidth().aspectRatio(3f / 4f)

/** Barra fina de progresso (programa no ar ou quanto já foi assistido). */
@Composable
fun Bar(value: Double, modifier: Modifier = Modifier) {
  Box(modifier.height(3.dp).background(Kesh.Line)) {
    Box(Modifier.fillMaxWidth(value.toFloat().coerceIn(0f, 1f)).height(3.dp).background(Kesh.Signal))
  }
}

/** Linha da grade de programação: número, logo, nome e o que está no ar. */
@Composable
fun GuideRow(c: Channel, onClick: () -> Unit) {
  Row(
    Modifier.fillMaxWidth().focusRing().clickable(onClick = onClick).padding(horizontal = 8.dp, vertical = 8.dp),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    Text(c.number?.toString() ?: "", color = Kesh.Fog, fontSize = 17.sp, textAlign = TextAlign.End, modifier = Modifier.width(40.dp))
    Spacer(Modifier.width(12.dp))
    Logo(c.logo, c.name, Modifier.width(76.dp).aspectRatio(16f / 9f), compact = true)
    Spacer(Modifier.width(12.dp))
    Column(Modifier.weight(1f)) {
      Text(c.name, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
      val now = c.now
      if (now != null) {
        Text(now.title, style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 4.dp)) {
          Bar(now.progress(), Modifier.weight(1f))
          Text("  até ${hhmm(now.stop)}", style = MaterialTheme.typography.bodySmall)
        }
      } else {
        Text(c.group, style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
      }
    }
    if (c.favorite) Icon(Icons.Filled.Favorite, "Favorito", tint = Kesh.Signal, modifier = Modifier.padding(start = 8.dp).width(18.dp))
  }
}

/** Pôster (filmes, séries) com o título solto embaixo. */
@Composable
fun Poster(logo: String, title: String, subtitle: String, progress: Double = 0.0, onClick: () -> Unit) {
  Column(Modifier.focusRing().clickable(onClick = onClick).padding(4.dp)) {
    Box {
      Logo(logo, title, Modifier.fillMaxWidth().aspectRatio(3f / 4f), cover = true)
      if (progress > 0) Bar(progress, Modifier.fillMaxWidth().align(Alignment.BottomCenter))
    }
    Text(title, style = MaterialTheme.typography.bodyMedium, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 6.dp))
    if (subtitle.isNotEmpty()) Text(subtitle, style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
  }
}

/** Nome do grupo sem repetir o tipo ("Filmes | Ação" → "Ação"). */
fun groupLabel(name: String, kind: String): String {
  if (name.isEmpty()) return "Sem grupo"
  val words = mapOf("live" to "canais|tv|ao vivo", "movie" to "filmes?|movies?|vod", "series" to "s[ée]ries?")[kind] ?: return name
  return name.replace(Regex("^\\s*($words)\\s*[|:\\-–•]\\s*", RegexOption.IGNORE_CASE), "").trim().ifEmpty { name }
}

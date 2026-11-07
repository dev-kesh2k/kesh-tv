package br.com.centralappshub.keshtv.kotlin

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.size
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
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

/** Linha da grade de programação: número, logo, nome e o que está no ar. Em foco: fundo claro e barra âmbar. */
@Composable
fun GuideRow(c: Channel, onFocus: (Channel) -> Unit = {}, onClick: () -> Unit) {
  var focused by remember { mutableStateOf(false) }
  Row(
    Modifier.fillMaxWidth().padding(vertical = 3.dp)
      .onFocusChanged { focused = it.isFocused; if (it.isFocused) onFocus(c) }
      .tvClick(onClick)
      .background(if (focused) Kesh.Raise else Kesh.Panel, RoundedCornerShape(10.dp))
      .height(IntrinsicSize.Min),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    Box(Modifier.width(5.dp).fillMaxHeight().background(if (focused) Kesh.Signal else Color.Transparent, RoundedCornerShape(topStart = 10.dp, bottomStart = 10.dp)))
    Text(c.number?.toString() ?: "", color = if (focused) Kesh.Signal else Kesh.Fog, fontSize = 18.sp, fontFamily = Condensed, textAlign = TextAlign.End, modifier = Modifier.width(44.dp))
    Spacer(Modifier.width(14.dp))
    Logo(c.logo, c.name, Modifier.padding(vertical = 8.dp).width(84.dp).aspectRatio(16f / 9f), compact = true)
    Spacer(Modifier.width(16.dp))
    Column(Modifier.weight(1f).padding(vertical = 10.dp, horizontal = 0.dp)) {
      Text(c.name, style = MaterialTheme.typography.titleMedium, color = if (focused) Kesh.Paper else Kesh.Paper.copy(alpha = 0.92f), maxLines = 1, overflow = TextOverflow.Ellipsis)
      val now = c.now
      if (now != null) {
        Text(now.title, style = MaterialTheme.typography.bodyMedium, color = Kesh.Fog, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Bar(now.progress(), Modifier.padding(top = 6.dp).fillMaxWidth(0.6f))
      } else {
        Text(groupLabel(c.group, c.kind), style = MaterialTheme.typography.bodyMedium, color = Kesh.Fog, maxLines = 1, overflow = TextOverflow.Ellipsis)
      }
    }
    if (c.favorite) Icon(Icons.Filled.Favorite, "Favorito", tint = Kesh.Signal, modifier = Modifier.padding(horizontal = 14.dp).size(18.dp))
    else Spacer(Modifier.width(14.dp))
  }
}

/** Painel ao lado da lista (TV): o canal em foco em destaque, com agora/a seguir. */
@Composable
fun ChannelDetails(c: Channel?, modifier: Modifier) {
  Column(modifier.background(Kesh.Panel, RoundedCornerShape(14.dp)).padding(24.dp)) {
    if (c == null) return@Column
    Logo(c.logo, c.name, Modifier.fillMaxWidth().height(140.dp))
    Text(c.name, style = MaterialTheme.typography.headlineSmall, fontFamily = Condensed, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 18.dp))
    Text(listOfNotNull(c.number?.let { "Canal $it" }, groupLabel(c.group, c.kind)).joinToString(" · "), style = MaterialTheme.typography.bodyMedium, color = Kesh.Fog)
    val now = c.now
    if (now != null) {
      Text("AGORA  ${hhmm(now.start)} – ${hhmm(now.stop)}", color = Kesh.Signal, fontSize = 13.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp, modifier = Modifier.padding(top = 20.dp))
      Text(now.title, style = MaterialTheme.typography.titleLarge, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 4.dp))
      Bar(now.progress(), Modifier.padding(top = 10.dp).fillMaxWidth())
      if (now.desc.isNotEmpty()) Text(now.desc, style = MaterialTheme.typography.bodyMedium, color = Kesh.Fog, maxLines = 4, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 12.dp))
      c.next?.let { nx ->
        Text("A SEGUIR  ${hhmm(nx.start)}", color = Kesh.Fog, fontSize = 13.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp, modifier = Modifier.padding(top = 18.dp))
        Text(nx.title, style = MaterialTheme.typography.bodyLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
      }
    } else {
      Text("Sem guia de programação para este canal.", style = MaterialTheme.typography.bodyMedium, color = Kesh.Fog, modifier = Modifier.padding(top = 20.dp))
    }
    Spacer(Modifier.weight(1f))
    Text("OK para assistir", style = MaterialTheme.typography.bodySmall, color = Kesh.Fog)
  }
}

/** Pôster (filmes, séries) com o título solto embaixo. */
@Composable
fun Poster(logo: String, title: String, subtitle: String, progress: Double = 0.0, onClick: () -> Unit) {
  Column(Modifier.padding(6.dp).focusRing(RoundedCornerShape(8.dp), scale = 1.06f).clickable(onClick = onClick).padding(4.dp)) {
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

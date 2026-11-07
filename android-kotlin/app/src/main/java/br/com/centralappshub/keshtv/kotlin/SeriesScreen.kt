package br.com.centralappshub.keshtv.kotlin

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.background

/** Cabeçalho das telas internas: voltar + título. */
@Composable
fun ScreenHeader(title: String, onBack: () -> Unit) {
  Row(Modifier.fillMaxWidth().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
    IconButton(onClick = onBack, modifier = Modifier.focusRing()) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Voltar") }
    Text(title, style = MaterialTheme.typography.headlineSmall, fontFamily = Condensed, maxLines = 1, overflow = TextOverflow.Ellipsis)
  }
}

@Composable
fun SeriesScreen(api: Api, playlistId: String, name: String, onOpen: (String) -> Unit, onBack: () -> Unit) {
  var episodes by remember { mutableStateOf<List<Episode>?>(null) }
  var error by remember { mutableStateOf("") }
  var season by remember { mutableIntStateOf(-1) }

  LaunchedEffect(playlistId, name) {
    try {
      val list = api.episodes(playlistId, name)
      episodes = list
      // Abre na temporada do último episódio começado, senão na primeira.
      season = (list.lastOrNull { it.channel.progress > 0 } ?: list.firstOrNull())?.season ?: 0
    } catch (e: ApiError) { error = e.message ?: "Erro" }
  }

  Column(Modifier.fillMaxSize()) {
    ScreenHeader(name, onBack)
    val list = episodes
    when {
      error.isNotEmpty() -> Text(error, Modifier.padding(16.dp))
      list == null -> Box(Modifier.fillMaxSize(), Alignment.Center) { CircularProgressIndicator(color = Kesh.Signal) }
      list.isEmpty() -> Text("Nenhum episódio encontrado.", Modifier.padding(16.dp))
      else -> {
        val seasons = list.map { it.season }.distinct().sorted()
        if (seasons.size > 1) {
          LazyRow(contentPadding = PaddingValues(horizontal = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(seasons) { s ->
              val on = s == season
              Text(
                if (s == 0) "Extras" else "Temporada $s",
                color = if (on) Kesh.Ink else Kesh.Paper,
                modifier = Modifier.focusRing().background(if (on) Kesh.Signal else Kesh.Panel, RoundedCornerShape(6.dp)).clickable { season = s }.padding(horizontal = 14.dp, vertical = 10.dp),
              )
            }
          }
        }
        LazyColumn(contentPadding = PaddingValues(12.dp)) {
          items(list.filter { it.season == season || seasons.size == 1 }) { e ->
            Row(Modifier.fillMaxWidth().focusRing().clickable { onOpen(e.channel.id) }.padding(vertical = 12.dp, horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically) {
              Text(if (e.episode > 0) "E${e.episode}" else "•", fontFamily = Condensed, color = Kesh.Signal, modifier = Modifier.width(48.dp))
              Column(Modifier.weight(1f)) {
                Text(e.channel.name, maxLines = 2, overflow = TextOverflow.Ellipsis)
                if (e.channel.progress > 0) Bar(e.channel.progress, Modifier.padding(top = 6.dp))
              }
            }
            HorizontalDivider(color = Color.White.copy(alpha = 0.08f))
          }
        }
      }
    }
  }
}

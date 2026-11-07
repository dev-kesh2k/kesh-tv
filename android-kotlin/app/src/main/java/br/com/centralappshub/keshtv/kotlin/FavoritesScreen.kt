package br.com.centralappshub.keshtv.kotlin

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/** Lista de canais vinda da API (Favoritos ou Recentes). */
@Composable
fun ChannelListScreen(title: String, empty: String, load: suspend () -> List<Channel>, onOpen: (Channel) -> Unit) {
  var list by remember { mutableStateOf<List<Channel>?>(null) }
  var error by remember { mutableStateOf("") }
  LaunchedEffect(Unit) {
    try { list = load() } catch (e: ApiError) { error = e.message ?: "Erro" }
  }
  Column(Modifier.fillMaxSize()) {
    Text(title, style = MaterialTheme.typography.headlineSmall, fontFamily = Condensed, modifier = Modifier.padding(20.dp, 16.dp, 20.dp, 8.dp))
    val items = list
    when {
      error.isNotEmpty() -> Text(error, color = Kesh.Tally, modifier = Modifier.padding(20.dp))
      items == null -> Box(Modifier.fillMaxSize(), Alignment.Center) { CircularProgressIndicator(color = Kesh.Signal) }
      items.isEmpty() -> Text(empty, style = MaterialTheme.typography.bodyMedium, color = Kesh.Fog, modifier = Modifier.padding(20.dp))
      else -> LazyColumn(contentPadding = PaddingValues(horizontal = 8.dp)) {
        items(items, key = { it.id }) { c ->
          GuideRow(c) { onOpen(c) }
          HorizontalDivider(color = Kesh.Line)
        }
      }
    }
  }
}

@Composable
fun FavoritesScreen(api: Api, onOpen: (Channel) -> Unit) =
  ChannelListScreen("Favoritos", "Nada por aqui ainda. Marque o coração de um canal no player para guardá-lo.", { api.favorites() }, onOpen)

@Composable
fun RecentScreen(api: Api, onOpen: (Channel) -> Unit) =
  ChannelListScreen("Recentes", "Nenhum canal assistido ainda.", { api.history() }, onOpen)

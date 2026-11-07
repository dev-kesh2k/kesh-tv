package br.com.centralappshub.keshtv.kotlin

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
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
  val listState = rememberLazyListState()
  Column(Modifier.fillMaxSize()) {
    Text(title, style = MaterialTheme.typography.headlineSmall, fontFamily = Condensed, modifier = Modifier.padding(sideMargin(), 12.dp, sideMargin(), 8.dp))
    val items = list
    when {
      error.isNotEmpty() -> Text(error, color = Kesh.Tally, modifier = Modifier.padding(horizontal = sideMargin(), vertical = 12.dp))
      items == null -> Box(Modifier.fillMaxSize(), Alignment.Center) { CircularProgressIndicator(color = Kesh.Signal) }
      items.isEmpty() -> Text(empty, style = MaterialTheme.typography.bodyMedium, color = Kesh.Fog, modifier = Modifier.padding(horizontal = sideMargin(), vertical = 12.dp))
      else -> LazyColumn(Modifier.fillMaxWidth(if (isTv()) 0.65f else 1f), state = listState, contentPadding = PaddingValues(start = sideMargin(), end = sideMargin(), bottom = 24.dp)) {
        itemsIndexed(items, key = { _, c -> c.id }) { i, c -> GuideRow(c, Modifier.keepVisible(listState, i)) { onOpen(c) } }
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

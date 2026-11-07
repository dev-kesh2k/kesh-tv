package br.com.centralappshub.keshtv.kotlin

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
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

/** Favoritos e "continuar assistindo" (histórico) numa lista só. */
@Composable
fun FavoritesScreen(api: Api, onOpen: (Channel) -> Unit, onBack: () -> Unit) {
  var favorites by remember { mutableStateOf<List<Channel>?>(null) }
  var history by remember { mutableStateOf<List<Channel>>(emptyList()) }
  var error by remember { mutableStateOf("") }

  LaunchedEffect(Unit) {
    try {
      favorites = api.favorites()
      history = runCatching { api.history() }.getOrDefault(emptyList())
    } catch (e: ApiError) { error = e.message ?: "Erro" }
  }

  Column(Modifier.fillMaxSize()) {
    ScreenHeader("Favoritos", onBack)
    val favs = favorites
    when {
      error.isNotEmpty() -> Text(error, Modifier.padding(16.dp))
      favs == null -> Box(Modifier.fillMaxSize(), Alignment.Center) { CircularProgressIndicator(color = Kesh.Signal) }
      favs.isEmpty() && history.isEmpty() -> Text("Nada por aqui ainda. Toque no coração de um canal para guardá-lo.", Modifier.padding(16.dp))
      else -> LazyColumn(contentPadding = PaddingValues(horizontal = 8.dp)) {
        items(favs, key = { "f" + it.id }) { c -> GuideRow(c) { onOpen(c) } }
        if (history.isNotEmpty()) {
          item { Text("Vistos por último", style = MaterialTheme.typography.titleMedium, fontFamily = Condensed, color = Kesh.Signal, modifier = Modifier.padding(12.dp, 20.dp, 12.dp, 4.dp)) }
          items(history.take(20), key = { "h" + it.id }) { c -> GuideRow(c) { onOpen(c) } }
        }
      }
    }
  }
}

package br.com.centralappshub.keshtv.kotlin

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** Listas M3U da conta: contagens, situação e botão de atualizar. Adicionar/editar fica no site. */
@Composable
fun PlaylistsScreen(api: Api) {
  var list by remember { mutableStateOf<List<Playlist>?>(null) }
  var error by remember { mutableStateOf("") }
  var reload by remember { mutableIntStateOf(0) }
  val scope = rememberCoroutineScope()

  LaunchedEffect(reload) {
    try {
      list = api.playlists(); error = ""
      // Enquanto alguma lista sincroniza, acompanha o progresso.
      while (list?.any { it.status == "syncing" || it.status == "pending" } == true) { delay(3000); list = api.playlists() }
    } catch (e: ApiError) { error = e.message ?: "Erro" }
  }

  Column(Modifier.fillMaxSize()) {
    Text("Listas", style = MaterialTheme.typography.headlineSmall, fontFamily = Condensed, modifier = Modifier.padding(20.dp, 16.dp, 20.dp, 0.dp))
    Text("Para adicionar ou editar listas, use o site do Kesh TV.", style = MaterialTheme.typography.bodySmall, color = Kesh.Fog, modifier = Modifier.padding(20.dp, 4.dp, 20.dp, 8.dp))
    val items = list
    when {
      error.isNotEmpty() -> Text(error, color = Kesh.Tally, modifier = Modifier.padding(20.dp))
      items == null -> Box(Modifier.fillMaxSize(), Alignment.Center) { CircularProgressIndicator(color = Kesh.Signal) }
      items.isEmpty() -> Text("Nenhuma lista cadastrada.", color = Kesh.Fog, modifier = Modifier.padding(20.dp))
      else -> LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        items(items, key = { it.id }) { pl ->
          Row(
            Modifier.fillMaxWidth().background(Kesh.Panel, RoundedCornerShape(8.dp)).padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
          ) {
            Column(Modifier.weight(1f)) {
              Text(pl.name, style = MaterialTheme.typography.titleMedium)
              Text("${pl.live} canais · ${pl.movies} filmes · ${pl.series} episódios de séries", style = MaterialTheme.typography.bodySmall)
              val status = when (pl.status) {
                "syncing", "pending" -> if (pl.progress > 0) "Atualizando… ${pl.progress} itens lidos" else "Atualizando…"
                "error" -> "Erro: ${pl.error}"
                else -> if (pl.epgCount > 0) "Em dia · guia com ${pl.epgCount} programas" else "Em dia"
              }
              Text(status, style = MaterialTheme.typography.bodySmall, color = if (pl.status == "error") Kesh.Tally else Kesh.Signal, modifier = Modifier.padding(top = 4.dp))
            }
            if (pl.hasUrl) Button(
              onClick = { scope.launch { runCatching { api.refreshPlaylist(pl.id) }; reload++ } },
              enabled = pl.status != "syncing",
              colors = ButtonDefaults.buttonColors(containerColor = Kesh.Line, contentColor = Kesh.Paper),
              modifier = Modifier.focusRing(),
            ) { Text("Atualizar") }
          }
        }
      }
    }
  }
}

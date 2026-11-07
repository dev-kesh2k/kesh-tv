package br.com.centralappshub.keshtv.kotlin

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.itemsIndexed
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

private val KINDS = listOf("live" to "Ao vivo", "movie" to "Filmes", "series" to "Séries")
private const val ALL = "__all"

@Composable
fun HomeScreen(api: Api, onOpen: (Channel) -> Unit, onSeries: (Series) -> Unit, onUnauthorized: () -> Unit) {
  var kind by remember { mutableStateOf("live") }
  var group by remember { mutableStateOf(ALL) }
  var query by remember { mutableStateOf("") }
  var groups by remember { mutableStateOf<List<Group>>(emptyList()) }
  val channels = remember { mutableStateListOf<Channel>() }
  val series = remember { mutableStateListOf<Series>() }
  var hasMore by remember { mutableStateOf(false) }
  var loading by remember { mutableStateOf(true) }
  var error by remember { mutableStateOf("") }
  var reloadKey by remember { mutableStateOf(0) }

  suspend fun guard(block: suspend () -> Unit) {
    try { block(); error = "" } catch (e: ApiError) { if (e.status == 401) onUnauthorized() else error = e.message ?: "Erro" }
  }
  suspend fun load(offset: Int) {
    loading = true
    guard {
      val q = query.trim().ifEmpty { null }
      val g = group.takeIf { it != ALL }
      if (kind == "series" && q == null) {
        val page = api.series(g, null, offset)
        if (offset == 0) series.clear()
        series.addAll(page.items); hasMore = page.hasMore
      } else {
        val page = api.channels(if (q == null) kind else null, if (q == null) g else null, q, offset)
        if (offset == 0) channels.clear()
        channels.addAll(page.items); hasMore = page.hasMore
      }
    }
    loading = false
  }

  LaunchedEffect(kind) { group = ALL; guard { groups = api.groups(kind) } }
  // Busca com atraso para não consultar a cada letra.
  LaunchedEffect(kind, group, query, reloadKey) {
    if (query.isNotEmpty()) delay(400)
    channels.clear(); series.clear()
    load(0)
  }

  Column(Modifier.fillMaxSize().background(Kesh.Ink)) {
    OutlinedTextField(
      query, { query = it }, singleLine = true, placeholder = { Text("Buscar canal, filme ou série") },
      modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp).focusRing(),
    )
    if (query.isEmpty()) {
      // Abas sublinhadas Ao vivo / Filmes / Séries.
      Row(Modifier.padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(20.dp)) {
        KINDS.forEach { (k, label) ->
          Column(Modifier.focusRing().clickable { kind = k }.padding(horizontal = 4.dp, vertical = 6.dp)) {
            Text(label, style = MaterialTheme.typography.titleLarge, color = if (kind == k) Kesh.Paper else Kesh.Fog)
            Box(Modifier.padding(top = 4.dp).width(40.dp).height(3.dp).background(if (kind == k) Kesh.Signal else Color.Transparent))
          }
        }
      }
      HorizontalDivider(color = Kesh.Line)
      // Grupos em fileira de botões.
      LazyRow(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        item { Chip("Todos", group == ALL) { group = ALL } }
        items(groups) { g -> Chip("${groupLabel(g.name, kind)}  ${g.count}", group == g.name) { group = g.name } }
      }
    }
    if (error.isNotEmpty()) Text(error, color = Kesh.Tally, modifier = Modifier.padding(16.dp).clickable { reloadKey++ })

    val showSeries = kind == "series" && query.isEmpty()
    Box(Modifier.weight(1f)) {
      when {
        showSeries -> LazyVerticalGrid(GridCells.Adaptive(130.dp), contentPadding = PaddingValues(12.dp)) {
          itemsIndexed(series) { i, s ->
            if (i == series.size - 6 && hasMore && !loading) LaunchedEffect(series.size) { load(series.size) }
            Poster(s.logo, s.name, if (s.seasons > 1) "${s.seasons} temporadas, ${s.episodes} episódios" else "${s.episodes} episódios") { onSeries(s) }
          }
        }
        kind == "live" && query.isEmpty() -> LazyColumn(contentPadding = PaddingValues(horizontal = 8.dp)) {
          itemsIndexed(channels) { i, c ->
            if (i == channels.size - 10 && hasMore && !loading) LaunchedEffect(channels.size) { load(channels.size) }
            GuideRow(c) { onOpen(c) }
            HorizontalDivider(color = Kesh.Line)
          }
        }
        else -> LazyVerticalGrid(GridCells.Adaptive(130.dp), contentPadding = PaddingValues(12.dp)) {
          itemsIndexed(channels) { i, c ->
            if (i == channels.size - 6 && hasMore && !loading) LaunchedEffect(channels.size) { load(channels.size) }
            Poster(c.logo, c.name, groupLabel(c.group, c.kind), c.progress) { onOpen(c) }
          }
        }
      }
      if (loading && channels.isEmpty() && series.isEmpty()) CircularProgressIndicator(Modifier.align(Alignment.Center), color = Kesh.Signal)
      if (!loading && error.isEmpty() && channels.isEmpty() && series.isEmpty())
        Text(if (query.isEmpty()) "Nada neste grupo. Adicione listas pelo site, em Listas." else "Nada encontrado para \"$query\".", style = MaterialTheme.typography.bodySmall, modifier = Modifier.align(Alignment.Center).padding(24.dp))
    }
  }
}

@Composable
private fun Chip(label: String, selected: Boolean, onClick: () -> Unit) {
  Box(
    Modifier.focusRing().background(if (selected) Kesh.Signal else Kesh.Panel, RoundedCornerShape(6.dp)).clickable(onClick = onClick).padding(horizontal = 14.dp, vertical = 10.dp),
  ) { Text(label, color = if (selected) Kesh.Ink else Kesh.Paper, fontSize = 15.sp) }
}

package br.com.centralappshub.keshtv.kotlin

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.Icon
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
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

  var searching by remember { mutableStateOf(false) }
  var focusedChannel by remember { mutableStateOf<Channel?>(null) }
  val searchFocus = remember { FocusRequester() }
  // Voltar com a busca aberta fecha a busca (em vez de sair da tela).
  BackHandler(enabled = searching) { searching = false; query = "" }
  LaunchedEffect(searching) { if (searching) runCatching { searchFocus.requestFocus() } }
  val tv = isTv()
  val side = sideMargin()

  Column(Modifier.fillMaxSize().background(Kesh.Ink)) {
    if (searching) {
      OutlinedTextField(
        query, { query = it }, singleLine = true, placeholder = { Text("Buscar canal, filme ou série") },
        leadingIcon = { Icon(Icons.Outlined.Search, null) },
        modifier = Modifier.fillMaxWidth().padding(horizontal = side, vertical = 8.dp).focusRequester(searchFocus),
      )
    } else {
      // Ao vivo / Filmes / Séries e o botão de busca na mesma linha.
      Row(Modifier.fillMaxWidth().padding(horizontal = side, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        KINDS.forEach { (k, label) -> Pill(label, kind == k, big = true) { kind = k } }
        Spacer(Modifier.weight(1f))
        Pill("Buscar", false, icon = Icons.Outlined.Search) { searching = true }
      }
      // Grupos em fileira de botões.
      LazyRow(contentPadding = PaddingValues(horizontal = side, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        item { Pill("Todos", group == ALL) { group = ALL } }
        items(groups) { g -> Pill("${groupLabel(g.name, kind)}  ${g.count}", group == g.name) { group = g.name } }
      }
    }
    if (error.isNotEmpty()) Text(error, color = Kesh.Tally, modifier = Modifier.padding(horizontal = side, vertical = 8.dp).clickable { reloadKey++ })

    val showSeries = kind == "series" && query.isEmpty()
    Box(Modifier.weight(1f)) {
      val gridCells = GridCells.Adaptive(if (tv) 150.dp else 120.dp)
      val listPad = PaddingValues(start = side, end = side, top = 4.dp, bottom = 24.dp)
      when {
        showSeries -> LazyVerticalGrid(gridCells, contentPadding = listPad) {
          itemsIndexed(series) { i, s ->
            if (i == series.size - 6 && hasMore && !loading) LaunchedEffect(series.size) { load(series.size) }
            Poster(s.logo, s.name, if (s.seasons > 1) "${s.seasons} temporadas" else "${s.episodes} episódios") { onSeries(s) }
          }
        }
        kind == "live" && query.isEmpty() -> Row(Modifier.fillMaxSize().padding(start = side, end = side, bottom = 20.dp)) {
          LazyColumn(Modifier.weight(if (tv) 0.6f else 1f), contentPadding = PaddingValues(top = 4.dp, bottom = 24.dp)) {
            itemsIndexed(channels, key = { _, c -> c.id }) { i, c ->
              if (i == channels.size - 10 && hasMore && !loading) LaunchedEffect(channels.size) { load(channels.size) }
              GuideRow(c, onFocus = { focusedChannel = it }) { onOpen(c) }
            }
          }
          if (tv && channels.isNotEmpty()) {
            Spacer(Modifier.width(24.dp))
            ChannelDetails(focusedChannel ?: channels.first(), Modifier.weight(0.4f).fillMaxHeight().padding(top = 7.dp))
          }
        }
        else -> LazyVerticalGrid(gridCells, contentPadding = listPad) {
          itemsIndexed(channels) { i, c ->
            if (i == channels.size - 6 && hasMore && !loading) LaunchedEffect(channels.size) { load(channels.size) }
            Poster(c.logo, c.name, groupLabel(c.group, c.kind), c.progress) { onOpen(c) }
          }
        }
      }
      if (loading && channels.isEmpty() && series.isEmpty()) CircularProgressIndicator(Modifier.align(Alignment.Center), color = Kesh.Signal)
      if (!loading && error.isEmpty() && channels.isEmpty() && series.isEmpty())
        Text(if (query.isEmpty()) "Nada neste grupo. Adicione listas pelo site, em Listas." else "Nada encontrado para \"$query\".", style = MaterialTheme.typography.bodyMedium, color = Kesh.Fog, modifier = Modifier.align(Alignment.Center).padding(24.dp))
    }
  }
}

/** Botão em pílula (tipos, grupos, busca): selecionado em âmbar; em foco, fundo claro. */
@Composable
private fun Pill(label: String, selected: Boolean, big: Boolean = false, icon: ImageVector? = null, onClick: () -> Unit) {
  var focused by remember { mutableStateOf(false) }
  val bg = when { focused -> Kesh.Paper; selected -> Kesh.Signal; else -> Kesh.Panel }
  val fg = if (focused || selected) Kesh.Ink else Kesh.Paper
  Row(
    Modifier.onFocusChanged { focused = it.isFocused }.tvClick(onClick)
      .background(bg, RoundedCornerShape(50)).padding(horizontal = if (big) 22.dp else 16.dp, vertical = if (big) 10.dp else 8.dp),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    if (icon != null) Icon(icon, null, tint = fg, modifier = Modifier.padding(end = 8.dp).size(20.dp))
    Text(label, color = fg, fontSize = if (big) 18.sp else 15.sp, fontWeight = if (big || selected) FontWeight.Bold else FontWeight.Medium)
  }
}

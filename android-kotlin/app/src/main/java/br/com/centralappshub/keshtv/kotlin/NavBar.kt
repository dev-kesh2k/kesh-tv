package br.com.centralappshub.keshtv.kotlin

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.PlaylistPlay
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.LiveTv
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Abas principais, as mesmas do menu do site. */
enum class Tab(val route: String, val label: String, val icon: ImageVector) {
  Canais("home", "Canais", Icons.Outlined.LiveTv),
  Favoritos("favorites", "Favoritos", Icons.Outlined.FavoriteBorder),
  Recentes("recent", "Recentes", Icons.Outlined.History),
  Listas("playlists", "Listas", Icons.AutoMirrored.Outlined.PlaylistPlay),
  Conta("account", "Conta", Icons.Outlined.Person),
}

/** Tela com a barra de abas no topo (na TV o controle chega nela subindo com a seta). */
@Composable
fun TabShell(current: Tab, onTab: (Tab) -> Unit, content: @Composable () -> Unit) {
  // Abre com o foco na aba atual (senão a busca pega o foco e o teclado sobe sozinho).
  val focus = remember { FocusRequester() }
  LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }
  val side = sideMargin()
  Column(Modifier.fillMaxSize().background(Kesh.Ink)) {
    Row(Modifier.fillMaxWidth().padding(start = side, end = side, top = 20.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
      Text("Kesh", color = Kesh.Paper, fontFamily = Condensed, fontSize = 26.sp)
      Text("TV", color = Kesh.Signal, fontFamily = Condensed, fontSize = 26.sp, modifier = Modifier.padding(start = 6.dp, end = 32.dp))
      Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Tab.entries.forEach { t -> TabItem(t, t == current, if (t == current) Modifier.focusRequester(focus) else Modifier) { if (t != current) onTab(t) } }
      }
    }
    Box(Modifier.weight(1f)) { content() }
  }
}

/** Aba em forma de pílula: a selecionada em âmbar; a focada ganha fundo claro. */
@Composable
private fun TabItem(t: Tab, selected: Boolean, modifier: Modifier, onClick: () -> Unit) {
  var focused by remember { mutableStateOf(false) }
  val bg = when { focused -> Kesh.Paper; selected -> Kesh.Raise; else -> Color.Transparent }
  val fg = when { focused -> Kesh.Ink; selected -> Kesh.Signal; else -> Kesh.Fog }
  Row(
    modifier.onFocusChanged { focused = it.isFocused }.tvClick(onClick)
      .background(bg, RoundedCornerShape(50)).padding(horizontal = 18.dp, vertical = 9.dp),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    Icon(t.icon, null, tint = fg, modifier = Modifier.size(22.dp))
    Text(t.label, color = fg, fontSize = 17.sp, fontWeight = FontWeight.Medium, modifier = Modifier.padding(start = 8.dp))
  }
}

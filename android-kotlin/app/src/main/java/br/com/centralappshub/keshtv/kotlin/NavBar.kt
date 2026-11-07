package br.com.centralappshub.keshtv.kotlin

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.PlaylistPlay
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.LiveTv
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
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
  Column(Modifier.fillMaxSize().background(Kesh.Ink)) {
    Row(Modifier.fillMaxWidth().padding(start = 20.dp, end = 12.dp, top = 10.dp), verticalAlignment = Alignment.CenterVertically) {
      Text("Kesh TV", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(end = 24.dp))
      Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Tab.entries.forEach { t -> TabItem(t, t == current, if (t == current) Modifier.focusRequester(focus) else Modifier) { if (t != current) onTab(t) } }
      }
    }
    HorizontalDivider(color = Kesh.Line)
    Box(Modifier.weight(1f)) { content() }
  }
}

@Composable
private fun TabItem(t: Tab, selected: Boolean, modifier: Modifier, onClick: () -> Unit) {
  val color = if (selected) Kesh.Paper else Kesh.Fog
  Column(
    modifier.focusRing().clickable(onClick = onClick).padding(horizontal = 14.dp, vertical = 6.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
  ) {
    Icon(t.icon, null, tint = color, modifier = Modifier.size(26.dp))
    Text(t.label, color = color, fontSize = 14.sp, modifier = Modifier.padding(top = 2.dp))
    Box(Modifier.padding(top = 4.dp).width(48.dp).height(3.dp).background(if (selected) Kesh.Signal else Color.Transparent))
  }
}

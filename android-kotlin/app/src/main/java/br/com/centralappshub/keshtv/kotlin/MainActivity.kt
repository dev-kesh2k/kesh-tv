package br.com.centralappshub.keshtv.kotlin

import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController

/** Kesh TV nativo (Kotlin + Jetpack Compose): conversa com a API do Kesh TV e toca com o Media3. */
class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val store = Store(this)
    setContent { KeshTheme { KeshApp(store) } }
  }

  // Não fica em segundo plano: saiu do app (Home, outro app, TV em espera) = fecha e para o player.
  // Ao abrir de novo começa do zero, na aba Canais.
  override fun onStop() {
    super.onStop()
    if (!isChangingConfigurations) finishAndRemoveTask()
  }
}

/** Telas: login → abas Canais / Favoritos / Recentes / Listas / Conta → série → player. */
@Composable
fun KeshApp(store: Store) {
  var token by remember { mutableStateOf(store.token) }
  if (token == null) {
    LoginScreen(store) { token = it }
    return
  }
  val api = remember(token) { Api(store.server) { store.token } }
  val logout = { store.token = null; token = null }
  val nav = rememberNavController()
  // Trocar de aba não empilha telas: "voltar" em qualquer aba leva para Canais e de lá sai do app.
  val goTab: (Tab) -> Unit = { t ->
    nav.navigate(t.route) { popUpTo(Tab.Canais.route) { saveState = true }; launchSingleTop = true; restoreState = true }
  }
  Box(Modifier.fillMaxSize().background(Kesh.Ink)) {
    NavHost(nav, startDestination = Tab.Canais.route) {
      composable(Tab.Canais.route) {
        TabShell(Tab.Canais, goTab) {
          HomeScreen(
            api,
            onOpen = { c -> nav.navigate("player/${c.id}") },
            onSeries = { s -> nav.navigate("series/${s.playlistId}/${Uri.encode(s.name)}") },
            onUnauthorized = logout,
          )
        }
      }
      composable(Tab.Favoritos.route) { TabShell(Tab.Favoritos, goTab) { FavoritesScreen(api, onOpen = { c -> nav.navigate("player/${c.id}") }) } }
      composable(Tab.Recentes.route) { TabShell(Tab.Recentes, goTab) { RecentScreen(api, onOpen = { c -> nav.navigate("player/${c.id}") }) } }
      composable(Tab.Listas.route) { TabShell(Tab.Listas, goTab) { PlaylistsScreen(api) } }
      composable(Tab.Conta.route) { TabShell(Tab.Conta, goTab) { AccountScreen(api, store, onLogout = logout) } }
      composable("series/{pl}/{name}") { e ->
        SeriesScreen(api, e.arguments!!.getString("pl")!!, Uri.decode(e.arguments!!.getString("name")!!), onOpen = { nav.navigate("player/$it") }, onBack = { nav.popBackStack() })
      }
      composable("player/{id}") { e -> PlayerScreen(api, e.arguments!!.getString("id")!!, onBack = { nav.popBackStack() }) }
    }
  }
}

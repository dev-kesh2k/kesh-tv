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
}

/** Telas: login → canais (abas e grupos) → série → player; favoritos e conta. */
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
  Box(Modifier.fillMaxSize().background(Kesh.Ink)) {
    NavHost(nav, startDestination = "home") {
      composable("home") {
        HomeScreen(
          api,
          onOpen = { c -> nav.navigate("player/${c.id}") },
          onSeries = { s -> nav.navigate("series/${s.playlistId}/${Uri.encode(s.name)}") },
          onFavorites = { nav.navigate("favorites") },
          onAccount = { nav.navigate("account") },
          onUnauthorized = logout,
        )
      }
      composable("series/{pl}/{name}") { e ->
        SeriesScreen(api, e.arguments!!.getString("pl")!!, Uri.decode(e.arguments!!.getString("name")!!), onOpen = { nav.navigate("player/$it") }, onBack = { nav.popBackStack() })
      }
      composable("player/{id}") { e -> PlayerScreen(api, e.arguments!!.getString("id")!!, onBack = { nav.popBackStack() }) }
      composable("favorites") { FavoritesScreen(api, onOpen = { c -> nav.navigate("player/${c.id}") }, onBack = { nav.popBackStack() }) }
      composable("account") { AccountScreen(api, store, onLogout = logout, onBack = { nav.popBackStack() }) }
    }
  }
}

package br.com.centralappshub.keshtv.kotlin

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun AccountScreen(api: Api, store: Store, onLogout: () -> Unit, onBack: () -> Unit) {
  var user by remember { mutableStateOf<User?>(null) }
  LaunchedEffect(Unit) { user = runCatching { api.me() }.getOrNull() }

  Column(Modifier.fillMaxSize()) {
    ScreenHeader("Conta", onBack)
    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
      Info("Nome", user?.name ?: "…")
      Info("E-mail", user?.email ?: "…")
      Info("Servidor", store.server)
      Info("Versão", "Kotlin ${BuildConfig.VERSION_NAME}")
      Button(
        onClick = onLogout,
        colors = ButtonDefaults.buttonColors(containerColor = Kesh.Tally, contentColor = Kesh.Paper),
        modifier = Modifier.focusRing().padding(top = 8.dp),
      ) { Text("Sair da conta") }
    }
  }
}

@Composable
private fun Info(label: String, value: String) {
  Column {
    Text(label, style = MaterialTheme.typography.bodySmall, color = Kesh.Signal)
    Text(value, style = MaterialTheme.typography.bodyLarge)
  }
}

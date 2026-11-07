package br.com.centralappshub.keshtv.kotlin

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch

@Composable
fun LoginScreen(store: Store, onLogged: (String) -> Unit) {
  var server by remember { mutableStateOf(store.server) }
  var email by remember { mutableStateOf("") }
  var password by remember { mutableStateOf("") }
  var error by remember { mutableStateOf("") }
  var busy by remember { mutableStateOf(false) }
  val scope = rememberCoroutineScope()

  Column(
    Modifier.fillMaxSize().background(Kesh.Ink).verticalScroll(rememberScrollState()).padding(horizontal = 28.dp, vertical = 48.dp),
    verticalArrangement = Arrangement.Center,
  ) {
    Column(Modifier.widthIn(max = 420.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
      Text("Kesh TV", style = MaterialTheme.typography.titleLarge)
      Text("Entre para ver seus canais", style = MaterialTheme.typography.headlineLarge, modifier = Modifier.padding(top = 24.dp, bottom = 8.dp))
      OutlinedTextField(email, { email = it }, label = { Text("E-mail") }, singleLine = true, modifier = Modifier.fillMaxWidth().focusRing(),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email))
      OutlinedTextField(password, { password = it }, label = { Text("Senha") }, singleLine = true, modifier = Modifier.fillMaxWidth().focusRing(),
        visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password))
      OutlinedTextField(server, { server = it }, label = { Text("Servidor") }, singleLine = true, modifier = Modifier.fillMaxWidth().focusRing(),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri))
      if (error.isNotEmpty()) Text(error, color = Kesh.Tally)
      Button(
        enabled = !busy && email.isNotBlank() && password.isNotBlank(),
        shape = RoundedCornerShape(6.dp),
        modifier = Modifier.fillMaxWidth().height(52.dp).focusRing(),
        onClick = {
          busy = true
          error = ""
          scope.launch {
            try {
              val (token, _) = Api(server) { null }.login(email.trim(), password)
              store.server = server.trim()
              store.token = token
              onLogged(token)
            } catch (e: ApiError) {
              error = e.message ?: "Não foi possível entrar"
            } finally {
              busy = false
            }
          }
        },
      ) { Text(if (busy) "Entrando…" else "Entrar") }
    }
  }
}

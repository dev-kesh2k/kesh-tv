package br.com.centralappshub.keshtv.kotlin

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.ui.Modifier

/** Kesh TV nativo (Kotlin + Jetpack Compose): conversa com a API do Kesh TV e toca com o Media3. */
class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContent {
      KeshTheme {
        Box(Modifier.fillMaxSize().background(Kesh.Ink)) { Text("Kesh TV") }
      }
    }
  }
}

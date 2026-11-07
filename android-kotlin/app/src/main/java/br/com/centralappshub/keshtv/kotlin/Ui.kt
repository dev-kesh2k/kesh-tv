package br.com.centralappshub.keshtv.kotlin

import android.content.res.Configuration
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** Contorno âmbar (e leve aumento, se `scale` > 1) no item em foco do controle remoto. */
fun Modifier.focusRing(shape: Shape = RoundedCornerShape(8.dp), scale: Float = 1f): Modifier = composed {
  var focused by remember { mutableStateOf(false) }
  val s by animateFloatAsState(if (focused) scale else 1f, label = "focus")
  this.graphicsLayer { scaleX = s; scaleY = s }
    .onFocusChanged { focused = it.isFocused }
    .border(if (focused) 3.dp else 0.dp, if (focused) Kesh.Signal else Color.Transparent, shape)
}

/** Rodando numa TV (Android TV / Google TV)? */
@Composable
fun isTv(): Boolean = (LocalConfiguration.current.uiMode and Configuration.UI_MODE_TYPE_MASK) == Configuration.UI_MODE_TYPE_TELEVISION

/** Margem lateral: na TV fica longe da borda (área segura contra overscan). */
@Composable
fun sideMargin(): Dp = if (isTv()) 48.dp else 16.dp

/** Clique sem o realce cinza padrão (na TV o foco já é mostrado pelo próprio item). */
fun Modifier.tvClick(onClick: () -> Unit): Modifier = composed {
  clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, onClick = onClick)
}

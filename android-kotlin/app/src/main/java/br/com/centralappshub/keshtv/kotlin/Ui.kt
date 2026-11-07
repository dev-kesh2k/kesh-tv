package br.com.centralappshub.keshtv.kotlin

import androidx.compose.foundation.border
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.dp

/** Contorno âmbar no item em foco (controle remoto da TV / teclado), como no site. */
fun Modifier.focusRing(shape: Shape = RoundedCornerShape(6.dp)): Modifier = composed {
  var focused by remember { mutableStateOf(false) }
  this.onFocusChanged { focused = it.isFocused }.border(if (focused) 3.dp else 0.dp, if (focused) Kesh.Signal else Color.Transparent, shape)
}

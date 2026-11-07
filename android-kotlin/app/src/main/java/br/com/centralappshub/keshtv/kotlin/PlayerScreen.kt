package br.com.centralappshub.keshtv.kotlin

import android.app.Activity
import android.view.KeyEvent
import android.view.WindowManager
import androidx.activity.compose.BackHandler
import androidx.annotation.OptIn
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.foundation.focusable
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.nativeKeyCode
import androidx.compose.ui.input.key.key
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.ui.PlayerView
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private const val UA = "VLC/3.0.20 LibVLC/3.0.20"

/** Fontes em ordem: o link original direto no aparelho (Media3 toca http, TS, MKV…), depois as do servidor. */
private fun candidates(info: PlayInfo): List<Pair<String, String>> {
  val direct = info.original to (if (Regex("\\.m3u8?(\\?|$)").containsMatchIn(info.original)) "hls" else "file")
  val proxied = info.sources.filter { it.via == "proxy" && it.type != "convert" }.map { it.url to it.type }
  return (listOf(direct) + proxied).distinctBy { it.first }
}

@OptIn(UnstableApi::class)
@Composable
fun PlayerScreen(api: Api, id: String, onBack: () -> Unit) {
  val context = LocalContext.current
  val scope = rememberCoroutineScope()
  var currentId by remember { mutableStateOf(id) }
  var info by remember { mutableStateOf<PlayInfo?>(null) }
  var error by remember { mutableStateOf("") }
  var tries by remember { mutableStateOf<List<Pair<String, String>>>(emptyList()) }
  var index by remember { mutableIntStateOf(0) }
  var osd by remember { mutableIntStateOf(0) } // muda para mostrar o painel de novo
  var around by remember { mutableStateOf<Pair<String?, String?>>(null to null) }

  val player = remember {
    val http = DefaultHttpDataSource.Factory().setUserAgent(UA).setAllowCrossProtocolRedirects(true).setConnectTimeoutMs(15_000).setReadTimeoutMs(30_000)
    ExoPlayer.Builder(context).setMediaSourceFactory(DefaultMediaSourceFactory(context).setDataSourceFactory(http)).build().apply { playWhenReady = true }
  }

  fun playAt(i: Int, resume: Int = 0) {
    val (url, type) = tries.getOrNull(i) ?: return run { error = "Não foi possível abrir este canal. Ele pode estar fora do ar no provedor." }
    val item = MediaItem.Builder().setUri(url).apply { if (type == "hls") setMimeType(MimeTypes.APPLICATION_M3U8) }.build()
    player.setMediaItem(item)
    player.prepare()
    if (resume > 0) player.seekTo(resume * 1000L)
  }

  // Tela acesa enquanto o player está aberto.
  DisposableEffect(Unit) {
    val window = (context as Activity).window
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    val listener = object : Player.Listener {
      override fun onPlayerError(e: PlaybackException) {
        index += 1
        playAt(index)
      }
    }
    player.addListener(listener)
    onDispose {
      window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
      player.removeListener(listener)
      player.release()
    }
  }

  LaunchedEffect(currentId) {
    error = ""
    try {
      val p = api.play(currentId)
      info = p
      tries = candidates(p)
      index = 0
      playAt(0, p.resume)
      osd++
      api.watched(currentId)
      around = api.around(currentId)
    } catch (e: ApiError) {
      error = e.message ?: "Erro"
    }
  }

  // Progresso de filmes e episódios a cada 15 s.
  LaunchedEffect(currentId, info) {
    val live = info?.channel?.kind == "live"
    while (!live && info != null) {
      delay(15_000)
      val pos = player.currentPosition / 1000.0
      val dur = player.duration.takeIf { it > 0 }?.div(1000.0) ?: 0.0
      if (pos > 1 && dur > 0) runCatching { api.progress(currentId, pos, dur) }
    }
  }

  var showOsd by remember { mutableStateOf(true) }
  LaunchedEffect(osd) { showOsd = true; delay(5000); showOsd = false }

  val focus = remember { FocusRequester() }
  LaunchedEffect(Unit) { focus.requestFocus() }
  BackHandler(onBack = onBack)
  val go = { target: String? -> if (target != null) currentId = target }

  Box(
    Modifier.fillMaxSize().background(Color.Black).focusRequester(focus).focusable().onPreviewKeyEvent { e ->
      if (e.type != KeyEventType.KeyDown) return@onPreviewKeyEvent false
      when (e.key.nativeKeyCode) {
        KeyEvent.KEYCODE_CHANNEL_UP, KeyEvent.KEYCODE_DPAD_UP -> if (info?.channel?.kind == "live") { go(around.first); true } else false
        KeyEvent.KEYCODE_CHANNEL_DOWN, KeyEvent.KEYCODE_DPAD_DOWN -> if (info?.channel?.kind == "live") { go(around.second); true } else false
        else -> { osd++; false }
      }
    },
  ) {
    AndroidView(factory = { PlayerView(it).apply { this.player = player; setShowBuffering(PlayerView.SHOW_BUFFERING_ALWAYS); isFocusable = false; descendantFocusability = android.view.ViewGroup.FOCUS_BLOCK_DESCENDANTS } }, modifier = Modifier.fillMaxSize())

    val c = info?.channel
    AnimatedVisibility(visible = showOsd && c != null, enter = fadeIn(), exit = fadeOut(), modifier = Modifier.align(Alignment.TopStart)) {
      Column(
        Modifier.fillMaxWidth().background(Brush.verticalGradient(listOf(Color.Black.copy(alpha = 0.85f), Color.Transparent))).padding(24.dp),
      ) {
        if (c?.kind == "live") Text(" Ao vivo ", color = Color.White, modifier = Modifier.background(Kesh.Tally, RoundedCornerShape(3.dp)))
        Text(c?.name ?: "", style = MaterialTheme.typography.headlineLarge, color = Kesh.Paper)
        c?.now?.let { Text("Agora: ${it.title}, até ${hhmm(it.stop)}", color = Kesh.Paper) }
        c?.next?.let { Text("A seguir: ${hhmm(it.start)} ${it.title}", style = MaterialTheme.typography.bodySmall) }
      }
    }
    if (error.isNotEmpty()) {
      Text(error, color = Kesh.Paper, modifier = Modifier.align(Alignment.Center).widthIn(max = 420.dp).background(Kesh.Panel, RoundedCornerShape(6.dp)).padding(20.dp))
    }
  }
}

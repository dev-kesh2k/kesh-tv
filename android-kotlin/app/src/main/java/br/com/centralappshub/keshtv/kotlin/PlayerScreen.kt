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
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Forward30
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Replay10
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.SkipPrevious
import androidx.compose.material.icons.outlined.AspectRatio
import androidx.compose.material.icons.outlined.Audiotrack
import androidx.compose.material.icons.outlined.ClosedCaption
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.SwapHoriz
import androidx.compose.material3.Icon
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.media3.common.C
import androidx.media3.common.TrackGroup
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.ui.AspectRatioFrameLayout
import java.util.Locale
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

  // Painel de controles (OK abre): None = só o vídeo.
  var panel by remember { mutableStateOf(Panel.None) }
  var touch by remember { mutableIntStateOf(0) } // qualquer tecla com o painel aberto adia o sumiço
  var resize by remember { mutableIntStateOf(AspectRatioFrameLayout.RESIZE_MODE_FIT) }
  var favorite by remember(info) { mutableStateOf(info?.channel?.favorite == true) }
  LaunchedEffect(panel, touch) { if (panel == Panel.Controls) { delay(8000); panel = Panel.None } }

  val focus = remember { FocusRequester() }
  LaunchedEffect(panel) { if (panel == Panel.None) runCatching { focus.requestFocus() } }
  BackHandler(onBack = onBack)
  BackHandler(enabled = panel != Panel.None) { panel = if (panel == Panel.Controls) Panel.None else Panel.Controls }
  val go = { target: String? -> if (target != null) currentId = target }
  val live = info?.channel?.kind == "live"
  fun seek(ms: Long) { player.seekTo((player.currentPosition + ms).coerceAtLeast(0)); osd++ }

  Box(
    Modifier.fillMaxSize().background(Color.Black).focusRequester(focus).focusable().onPreviewKeyEvent { e ->
      val code = e.key.nativeKeyCode
      val ok = code == KeyEvent.KEYCODE_DPAD_CENTER || code == KeyEvent.KEYCODE_ENTER || code == KeyEvent.KEYCODE_NUMPAD_ENTER
      // OK abre o painel ao SOLTAR a tecla: abrindo no aperto, o soltar cairia no botão Pausar já focado.
      if (ok && panel == Panel.None) { if (e.type == KeyEventType.KeyUp) panel = Panel.Controls; return@onPreviewKeyEvent true }
      if (e.type != KeyEventType.KeyDown) return@onPreviewKeyEvent false
      if (code == KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE) { if (player.isPlaying) player.pause() else player.play(); osd++; return@onPreviewKeyEvent true }
      if (panel != Panel.None) { touch++; return@onPreviewKeyEvent false } // painel aberto: setas navegam nos botões
      when (code) {
        KeyEvent.KEYCODE_MENU -> { panel = Panel.Controls; true }
        KeyEvent.KEYCODE_CHANNEL_UP, KeyEvent.KEYCODE_DPAD_UP -> if (live) { go(around.first); true } else { panel = Panel.Controls; true }
        KeyEvent.KEYCODE_CHANNEL_DOWN, KeyEvent.KEYCODE_DPAD_DOWN -> if (live) { go(around.second); true } else { panel = Panel.Controls; true }
        KeyEvent.KEYCODE_DPAD_LEFT, KeyEvent.KEYCODE_MEDIA_REWIND -> if (!live) { seek(-10_000); true } else { osd++; true }
        KeyEvent.KEYCODE_DPAD_RIGHT, KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> if (!live) { seek(30_000); true } else { osd++; true }
        else -> { osd++; false }
      }
    },
  ) {
    AndroidView(
      factory = { PlayerView(it).apply { this.player = player; useController = false; setShowBuffering(PlayerView.SHOW_BUFFERING_ALWAYS); isFocusable = false; descendantFocusability = android.view.ViewGroup.FOCUS_BLOCK_DESCENDANTS } },
      update = { it.resizeMode = resize },
      modifier = Modifier.fillMaxSize(),
    )

    val c = info?.channel
    AnimatedVisibility(visible = (showOsd || panel != Panel.None) && c != null, enter = fadeIn(), exit = fadeOut(), modifier = Modifier.align(Alignment.TopStart)) {
      Column(
        Modifier.fillMaxWidth().background(Brush.verticalGradient(listOf(Color.Black.copy(alpha = 0.85f), Color.Transparent))).padding(horizontal = 48.dp, vertical = 28.dp),
      ) {
        if (c?.kind == "live") Text(" AO VIVO ", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp, modifier = Modifier.background(Kesh.Tally, RoundedCornerShape(3.dp)))
        Text(c?.name ?: "", style = MaterialTheme.typography.headlineLarge, color = Kesh.Paper)
        c?.now?.let { Text("Agora: ${it.title}, até ${hhmm(it.stop)}", color = Kesh.Paper, fontSize = 17.sp) }
        c?.next?.let { Text("A seguir: ${hhmm(it.start)} ${it.title}", color = Kesh.Fog, fontSize = 15.sp) }
      }
    }

    if (panel != Panel.None && c != null) {
      Column(
        Modifier.align(Alignment.BottomCenter).fillMaxWidth()
          .background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.9f))))
          .padding(start = 48.dp, end = 48.dp, top = 60.dp, bottom = 32.dp),
      ) {
        when (panel) {
          Panel.Controls -> Controls(
            player = player, live = live, favorite = favorite, hasPrev = around.first != null, hasNext = around.second != null,
            onSeek = ::seek,
            onPrev = { go(around.first) }, onNext = { go(around.second) },
            onFavorite = { val on = !favorite; favorite = on; scope.launch { runCatching { api.setFavorite(currentId, on) } } },
            onAudio = { panel = Panel.Audio }, onSubs = { panel = Panel.Subs }, onFormat = { panel = Panel.Format },
            onSource = { index += 1; playAt(index); panel = Panel.None },
          )
          Panel.Audio -> OptionList("Áudio", trackOptions(player, C.TRACK_TYPE_AUDIO, false)) { opt -> selectTrack(player, C.TRACK_TYPE_AUDIO, opt); panel = Panel.Controls }
          Panel.Subs -> OptionList("Legendas", trackOptions(player, C.TRACK_TYPE_TEXT, true)) { opt -> selectTrack(player, C.TRACK_TYPE_TEXT, opt); panel = Panel.Controls }
          Panel.Format -> OptionList("Formato da tela", FORMATS.map { (mode, label) -> TrackOpt(label, null, mode, resize == mode) }) { opt -> resize = opt.index; panel = Panel.Controls }
          Panel.None -> {}
        }
      }
    }
    if (error.isNotEmpty()) {
      Text(error, color = Kesh.Paper, modifier = Modifier.align(Alignment.Center).widthIn(max = 420.dp).background(Kesh.Panel, RoundedCornerShape(6.dp)).padding(20.dp))
    }
  }
}

private enum class Panel { None, Controls, Audio, Subs, Format }

@OptIn(UnstableApi::class)
private val FORMATS = listOf(
  AspectRatioFrameLayout.RESIZE_MODE_FIT to "Original (com bordas)",
  AspectRatioFrameLayout.RESIZE_MODE_ZOOM to "Preencher (corta as bordas)",
  AspectRatioFrameLayout.RESIZE_MODE_FILL to "Esticar",
)

/** Linha de botões do player + barra de tempo (filmes/episódios). */
@Composable
private fun Controls(
  player: ExoPlayer, live: Boolean, favorite: Boolean, hasPrev: Boolean, hasNext: Boolean,
  onSeek: (Long) -> Unit, onPrev: () -> Unit, onNext: () -> Unit, onFavorite: () -> Unit,
  onAudio: () -> Unit, onSubs: () -> Unit, onFormat: () -> Unit, onSource: () -> Unit,
) {
  var playing by remember { mutableStateOf(player.isPlaying) }
  var pos by remember { mutableStateOf(0L) }
  var dur by remember { mutableStateOf(0L) }
  LaunchedEffect(Unit) { while (true) { playing = player.playWhenReady; pos = player.currentPosition; dur = player.duration.coerceAtLeast(0); delay(500) } }
  val first = remember { FocusRequester() }
  LaunchedEffect(Unit) { runCatching { first.requestFocus() } }

  if (!live && dur > 0) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = 18.dp)) {
      Text(clock(pos), color = Kesh.Paper, fontSize = 15.sp)
      Bar(pos.toDouble() / dur, Modifier.weight(1f).padding(horizontal = 16.dp))
      Text(clock(dur), color = Kesh.Fog, fontSize = 15.sp)
    }
  }
  Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
    if (live && hasPrev) CtrlButton(Icons.Filled.SkipPrevious, "Canal anterior", onClick = onPrev)
    if (!live) CtrlButton(Icons.Filled.Replay10, "−10 s") { onSeek(-10_000) }
    CtrlButton(if (playing) Icons.Filled.Pause else Icons.Filled.PlayArrow, if (playing) "Pausar" else "Continuar", Modifier.focusRequester(first)) {
      if (player.playWhenReady) player.pause() else player.play(); playing = player.playWhenReady
    }
    if (!live) CtrlButton(Icons.Filled.Forward30, "+30 s") { onSeek(30_000) }
    if (live && hasNext) CtrlButton(Icons.Filled.SkipNext, "Próximo canal", onClick = onNext)
    Spacer(Modifier.weight(1f))
    CtrlButton(if (favorite) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder, if (favorite) "Favorito" else "Favoritar", onClick = onFavorite)
    CtrlButton(Icons.Outlined.Audiotrack, "Áudio", onClick = onAudio)
    CtrlButton(Icons.Outlined.ClosedCaption, "Legendas", onClick = onSubs)
    CtrlButton(Icons.Outlined.AspectRatio, "Tela", onClick = onFormat)
    CtrlButton(Icons.Outlined.SwapHoriz, "Outra fonte", onClick = onSource)
  }
  Text("OK escolhe · Voltar fecha" + if (live) " · ▲▼ trocam de canal com o painel fechado" else " · ◀▶ voltam/avançam com o painel fechado",
    color = Kesh.Fog, fontSize = 13.sp, modifier = Modifier.padding(top = 14.dp))
}

/** Botão do player: ícone com rótulo; em foco, fundo claro. */
@Composable
private fun CtrlButton(icon: ImageVector, label: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
  var focused by remember { mutableStateOf(false) }
  val fg = if (focused) Kesh.Ink else Kesh.Paper
  Column(
    modifier.onFocusChanged { focused = it.isFocused }.tvClick(onClick)
      .background(if (focused) Kesh.Paper else Color.White.copy(alpha = 0.12f), RoundedCornerShape(12.dp))
      .padding(horizontal = 16.dp, vertical = 10.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
  ) {
    Icon(icon, null, tint = fg, modifier = Modifier.size(30.dp))
    Text(label, color = fg, fontSize = 13.sp, fontWeight = FontWeight.Medium, modifier = Modifier.padding(top = 4.dp))
  }
}

/** Opção de faixa (áudio/legenda) ou de formato. `group == null` + índice -1 = desligar. */
private data class TrackOpt(val label: String, val group: TrackGroup?, val index: Int, val selected: Boolean)

@Composable
private fun OptionList(title: String, options: List<TrackOpt>, onPick: (TrackOpt) -> Unit) {
  val first = remember { FocusRequester() }
  LaunchedEffect(Unit) { runCatching { first.requestFocus() } }
  Text(title, style = MaterialTheme.typography.titleLarge, color = Kesh.Paper, modifier = Modifier.padding(bottom = 12.dp))
  if (options.isEmpty()) {
    Text("Este vídeo não tem outras opções.", color = Kesh.Fog, fontSize = 16.sp)
    Box(Modifier.size(1.dp).focusRequester(first).focusable())
    return
  }
  val start = options.indexOfFirst { it.selected }.coerceAtLeast(0)
  LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
    itemsIndexed(options) { i, o ->
      var focused by remember { mutableStateOf(false) }
      Row(
        (if (i == start) Modifier.focusRequester(first) else Modifier).onFocusChanged { focused = it.isFocused }.tvClick { onPick(o) }
          .background(when { focused -> Kesh.Paper; o.selected -> Kesh.Signal; else -> Color.White.copy(alpha = 0.12f) }, RoundedCornerShape(50))
          .padding(horizontal = 20.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
      ) {
        if (o.selected) Icon(Icons.Filled.Check, null, tint = if (focused || o.selected) Kesh.Ink else Kesh.Paper, modifier = Modifier.padding(end = 6.dp).size(20.dp))
        Text(o.label, color = if (focused || o.selected) Kesh.Ink else Kesh.Paper, fontSize = 16.sp, fontWeight = FontWeight.Medium)
      }
    }
  }
}

@OptIn(UnstableApi::class)
private fun trackOptions(player: ExoPlayer, type: Int, withOff: Boolean): List<TrackOpt> {
  val groups = player.currentTracks.groups.filter { it.type == type }
  val anySelected = groups.any { it.isSelected }
  val list = groups.flatMap { g ->
    (0 until g.length).filter { g.isTrackSupported(it) }.map { i ->
      val f = g.getTrackFormat(i)
      val lang = f.language?.takeIf { it != "und" }?.let { Locale(it).getDisplayLanguage(Locale("pt", "BR")).replaceFirstChar(Char::uppercase) }
      val extra = if (type == C.TRACK_TYPE_AUDIO && f.channelCount > 2) " ${f.channelCount - 1}.1" else ""
      TrackOpt((f.label ?: lang ?: "Faixa ${i + 1}") + extra, g.mediaTrackGroup, i, g.isTrackSelected(i))
    }
  }
  if (list.isEmpty()) return emptyList()
  return if (withOff) listOf(TrackOpt("Desligadas", null, -1, !anySelected)) + list else list
}

@OptIn(UnstableApi::class)
private fun selectTrack(player: ExoPlayer, type: Int, opt: TrackOpt) {
  val b = player.trackSelectionParameters.buildUpon()
  player.trackSelectionParameters = if (opt.group == null) b.setTrackTypeDisabled(type, true).build()
  else b.setTrackTypeDisabled(type, false).setOverrideForType(TrackSelectionOverride(opt.group, opt.index)).build()
}

private fun clock(ms: Long): String {
  val t = ms / 1000; val h = t / 3600; val m = (t % 3600) / 60; val s = t % 60
  return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%02d:%02d".format(m, s)
}

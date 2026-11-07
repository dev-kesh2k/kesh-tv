package br.com.centralappshub.keshtv.kotlin

import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant

data class User(val id: String, val name: String, val email: String)
data class Programme(val title: String, val start: Long, val stop: Long, val desc: String = "") {
  /** Fração já exibida (0–1). */
  fun progress(now: Long = System.currentTimeMillis()) = if (stop > start) ((now - start).toDouble() / (stop - start)).coerceIn(0.0, 1.0) else 0.0
}
data class Channel(
  val id: String, val name: String, val group: String, val kind: String, val playlistId: String,
  val number: Int?, val logo: String, val favorite: Boolean, val now: Programme?, val next: Programme?,
  val progress: Double = 0.0, val position: Int = 0,
)
data class Group(val name: String, val count: Int)
data class Series(val playlistId: String, val name: String, val group: String, val logo: String, val episodes: Int, val seasons: Int)
data class Episode(val channel: Channel, val season: Int, val episode: Int)
data class Source(val type: String, val via: String, val url: String)
data class PlayInfo(val channel: Channel, val sources: List<Source>, val original: String, val resume: Int)
data class Playlist(
  val id: String, val name: String, val hasUrl: Boolean, val live: Int, val movies: Int, val series: Int,
  val status: String, val error: String, val progress: Int, val epgCount: Int,
)
data class Page<T>(val items: List<T>, val hasMore: Boolean)

/** Leitura das respostas da API (JSON → modelos). Links relativos (logo?…, stream?…) viram absolutos com `api`. */
object Parse {
  private fun JSONObject.str(k: String) = if (has(k) && !isNull(k)) getString(k) else ""
  private fun time(s: String) = runCatching { Instant.parse(s).toEpochMilli() }.getOrDefault(0L)
  private fun abs(api: String, u: String) = when { u.isEmpty() -> ""; u.startsWith("http") -> u; else -> api + u }
  private inline fun <T> JSONArray.list(f: (JSONObject) -> T) = (0 until length()).map { f(getJSONObject(it)) }

  fun programme(o: JSONObject?) = o?.let { Programme(it.str("title"), time(it.str("start")), time(it.str("stop")), it.str("desc")) }
  fun user(o: JSONObject) = User(o.str("id"), o.str("name"), o.str("email"))
  fun channel(api: String, o: JSONObject) = Channel(
    id = o.str("id"), name = o.str("name"), group = o.str("group"), kind = o.str("kind"), playlistId = o.str("playlistId"),
    number = if (o.has("number")) o.getInt("number") else null, logo = abs(api, o.str("logo")), favorite = o.optBoolean("favorite"),
    now = programme(o.optJSONObject("now")), next = programme(o.optJSONObject("next")),
    progress = o.optDouble("progress", 0.0).let { if (it.isNaN()) 0.0 else it }, position = o.optInt("position", 0),
  )
  fun channels(api: String, o: JSONObject) = Page(o.getJSONArray("channels").list { channel(api, it) }, o.optBoolean("hasMore"))
  fun groups(o: JSONObject) = o.getJSONArray("groups").list { Group(it.str("name"), it.optInt("count")) }
  fun series(api: String, o: JSONObject) = Page(
    o.getJSONArray("series").list { Series(it.str("playlistId"), it.str("name"), it.str("group"), abs(api, it.str("logo")), it.optInt("episodes"), it.optInt("seasons")) },
    o.optBoolean("hasMore"),
  )
  fun episodes(api: String, o: JSONObject) = o.getJSONArray("episodes").list { Episode(channel(api, it), it.optInt("season"), it.optInt("episode")) }
  fun play(api: String, o: JSONObject) = PlayInfo(
    channel = channel(api, o.getJSONObject("channel")),
    sources = o.getJSONArray("sources").list { Source(it.str("type"), it.str("via"), abs(api, it.str("url"))) },
    original = o.str("original"), resume = o.optInt("resume", 0),
  )
  fun playlists(o: JSONObject) = o.getJSONArray("playlists").list {
    Playlist(it.str("id"), it.str("name"), it.str("url").isNotEmpty(), it.optInt("liveCount"), it.optInt("movieCount"), it.optInt("seriesCount"),
      it.str("status"), it.str("error"), it.optInt("syncProgress"), it.optInt("epgCount"))
  }
  fun guide(o: JSONObject) = o.getJSONArray("programmes").list { programme(it)!! }
}

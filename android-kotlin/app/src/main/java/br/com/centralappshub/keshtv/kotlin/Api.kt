package br.com.centralappshub.keshtv.kotlin

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

class ApiError(val status: Int, message: String) : Exception(message)

/** Cliente da API do Kesh TV (`<servidor>/api/…`), com o token de login no cabeçalho. */
class Api(server: String, private val token: () -> String?) {
  val api: String = server.trimEnd('/') + "/api/"

  private suspend fun call(method: String, path: String, body: JSONObject? = null): JSONObject = withContext(Dispatchers.IO) {
    val conn = (URL(api + path).openConnection() as HttpURLConnection).apply {
      requestMethod = method
      connectTimeout = 15_000
      readTimeout = 60_000
      setRequestProperty("Accept", "application/json")
      token()?.let { setRequestProperty("Authorization", "Bearer $it") }
      if (body != null) {
        doOutput = true
        setRequestProperty("Content-Type", "application/json")
        outputStream.use { it.write(body.toString().toByteArray()) }
      }
    }
    try {
      val code = conn.responseCode
      val text = (if (code < 400) conn.inputStream else conn.errorStream)?.bufferedReader()?.use { it.readText() } ?: ""
      val json = runCatching { JSONObject(text) }.getOrDefault(JSONObject())
      if (code >= 400) throw ApiError(code, json.optString("error", "Erro $code"))
      json
    } catch (e: IOException) {
      throw ApiError(0, "Sem conexão com o servidor")
    } finally {
      conn.disconnect()
    }
  }

  private fun q(vararg p: Pair<String, Any?>) = p.filter { it.second != null && it.second.toString().isNotEmpty() }
    .joinToString("&") { "${it.first}=${URLEncoder.encode(it.second.toString(), "UTF-8")}" }

  suspend fun login(email: String, password: String): Pair<String, User> {
    val r = call("POST", "auth/login", JSONObject().put("email", email).put("password", password))
    return r.getString("token") to Parse.user(r.getJSONObject("user"))
  }
  suspend fun me() = Parse.user(call("GET", "auth/me").getJSONObject("user"))
  suspend fun groups(kind: String) = Parse.groups(call("GET", "groups?" + q("kind" to kind)))
  suspend fun channels(kind: String?, group: String?, query: String?, offset: Int) =
    Parse.channels(api, call("GET", "channels?" + q("kind" to kind, "group" to group, "q" to query, "offset" to offset, "limit" to 60)))
  suspend fun series(group: String?, query: String?, offset: Int) =
    Parse.series(api, call("GET", "series?" + q("group" to group, "q" to query, "offset" to offset, "limit" to 60)))
  suspend fun episodes(playlistId: String, name: String) = Parse.episodes(api, call("GET", "series/episodes?" + q("playlist" to playlistId, "name" to name)))
  suspend fun play(id: String) = Parse.play(api, call("GET", "channels/$id/play"))
  suspend fun around(id: String): Pair<String?, String?> = call("GET", "channels/$id/around").let { it.optString("prev").ifEmpty { null } to it.optString("next").ifEmpty { null } }
  suspend fun guide(id: String) = Parse.guide(call("GET", "channels/$id/epg"))
  suspend fun watched(id: String) { call("POST", "channels/$id/watch", JSONObject()) }
  suspend fun progress(id: String, position: Double, duration: Double) {
    call("PUT", "channels/$id/progress", JSONObject().put("position", position).put("duration", duration))
  }
  suspend fun favorites() = Parse.channels(api, call("GET", "favorites")).items
  suspend fun setFavorite(id: String, on: Boolean) { call(if (on) "POST" else "DELETE", "favorites/$id", if (on) JSONObject() else null) }
  suspend fun history() = Parse.channels(api, call("GET", "history")).items
}

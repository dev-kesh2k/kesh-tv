package br.com.centralappshub.keshtv.kotlin

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ParseTest {
  private val api = "https://exemplo/kesh-tv/api/"

  @Test fun canalComGuiaENumero() {
    val o = JSONObject("""{"channels":[{"id":"1","name":"Globo SP","group":"Abertos","kind":"live","playlistId":"p","number":7,
      "logo":"logo?u=abc","favorite":true,"now":{"title":"Jornal","start":"2026-11-07T20:00:00.000Z","stop":"2026-11-07T21:00:00.000Z"}}],"hasMore":true}""")
    val page = Parse.channels(api, o)
    val c = page.items[0]
    assertTrue(page.hasMore)
    assertEquals(7, c.number)
    assertEquals("https://exemplo/kesh-tv/api/logo?u=abc", c.logo)
    assertEquals("Jornal", c.now?.title)
    assertEquals(0.5, c.now!!.progress(c.now!!.start + 30 * 60_000), 0.001)
    assertNull(c.next)
  }

  @Test fun fontesDoPlayerFicamAbsolutas() {
    val o = JSONObject("""{"channel":{"id":"1","name":"Filme","kind":"movie","playlistId":"p"},"original":"http://srv/m.mkv","resume":120,
      "sources":[{"type":"file","via":"proxy","url":"stream?u=x"},{"type":"convert","via":"proxy","url":"u=x&s=y"}]}""")
    val p = Parse.play(api, o)
    assertEquals(120, p.resume)
    assertEquals("https://exemplo/kesh-tv/api/stream?u=x", p.sources[0].url)
    assertEquals("http://srv/m.mkv", p.original)
  }

  @Test fun seriesEEpisodios() {
    val s = Parse.series(api, JSONObject("""{"series":[{"playlistId":"p","name":"Lost","group":"Séries","logo":"","episodes":10,"seasons":2}],"hasMore":false}"""))
    assertEquals(2, s.items[0].seasons)
    val e = Parse.episodes(api, JSONObject("""{"episodes":[{"id":"e1","name":"Lost S01E02","kind":"series","playlistId":"p","season":1,"episode":2}]}"""))
    assertEquals(2, e[0].episode)
  }
}

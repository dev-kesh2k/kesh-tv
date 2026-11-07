package br.com.centralappshub.keshtv.kotlin

import android.content.Context

/** Login e servidor guardados no aparelho. */
class Store(context: Context) {
  private val prefs = context.getSharedPreferences("kesh-tv", Context.MODE_PRIVATE)
  var token: String?
    get() = prefs.getString("token", null)
    set(v) = prefs.edit().putString("token", v).apply()
  var server: String
    get() = prefs.getString("server", null) ?: BuildConfig.SERVER_URL
    set(v) = prefs.edit().putString("server", v).apply()
}

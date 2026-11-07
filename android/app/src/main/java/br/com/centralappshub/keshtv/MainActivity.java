package br.com.centralappshub.keshtv;

import android.app.Activity;
import android.app.UiModeManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** Kesh TV para Android: abre o app web publicado num WebView. */
public class MainActivity extends Activity {
  private WebView web;

  /** TV de verdade: modo de interface TV ou aparelho sem toque com recurso leanback (boxes, Fire TV). */
  private boolean isTv() {
    UiModeManager ui = (UiModeManager) getSystemService(Context.UI_MODE_SERVICE);
    if (ui != null && ui.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION) return true;
    PackageManager pm = getPackageManager();
    return pm.hasSystemFeature(PackageManager.FEATURE_LEANBACK) || !pm.hasSystemFeature(PackageManager.FEATURE_TOUCHSCREEN);
  }

  /** Ponte para o site (window.KeshNative): plataforma e versão do app. */
  public class Bridge {
    @JavascriptInterface public boolean isTv() { return MainActivity.this.isTv(); }
    @JavascriptInterface public String version() { return BuildConfig.VERSION_NAME; }
  }

  @Override
  protected void onCreate(Bundle state) {
    super.onCreate(state);
    web = new WebView(this);
    setContentView(web);
    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setMediaPlaybackRequiresUserGesture(false);
    // O site reconhece o app pelo user agent e pela ponte (liga o modo TV sozinho na TV).
    s.setUserAgentString(s.getUserAgentString() + " KeshTV-Android/" + BuildConfig.VERSION_NAME + (isTv() ? " (TV)" : ""));
    web.addJavascriptInterface(new Bridge(), "KeshNative");
    web.setWebViewClient(new WebViewClient());
    if (state != null) web.restoreState(state);
    else web.loadUrl(BuildConfig.START_URL);
  }

  @Override
  protected void onSaveInstanceState(Bundle out) {
    super.onSaveInstanceState(out);
    web.saveState(out);
  }

  @Override
  public void onBackPressed() {
    if (web.canGoBack()) web.goBack();
    else super.onBackPressed();
  }
}

package br.com.centralappshub.keshtv;

import android.app.Activity;
import android.app.UiModeManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.widget.FrameLayout;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** Kesh TV para Android: abre o app web publicado num WebView. */
public class MainActivity extends Activity {
  private WebView web;
  private FrameLayout root;
  // Tela cheia do vídeo (botão do player): a view do vídeo cobre o WebView.
  private View fullView;
  private WebChromeClient.CustomViewCallback fullCallback;

  @SuppressWarnings("deprecation")
  private void immersive(boolean on) {
    int flags = on
      ? View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
      : View.SYSTEM_UI_FLAG_LAYOUT_STABLE;
    getWindow().getDecorView().setSystemUiVisibility(flags);
  }

  private void exitFullscreen() {
    if (fullView == null) return;
    root.removeView(fullView);
    fullView = null;
    if (fullCallback != null) fullCallback.onCustomViewHidden();
    fullCallback = null;
    immersive(isTv());
  }

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
    /** Tela acesa enquanto o vídeo toca (o site chama ao tocar/pausar). */
    @JavascriptInterface public void keepScreenOn(final boolean on) {
      runOnUiThread(() -> {
        if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
      });
    }
  }

  @Override
  protected void onCreate(Bundle state) {
    super.onCreate(state);
    web = new WebView(this);
    root = new FrameLayout(this);
    root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    setContentView(root);
    immersive(isTv());
    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setMediaPlaybackRequiresUserGesture(false);
    // Respeita o <meta viewport> do site (no modo TV a página usa 1280 px e o WebView amplia até a tela).
    s.setUseWideViewPort(true);
    s.setLoadWithOverviewMode(true);
    // Tamanho de letra do sistema não deforma o layout (o modo TV já escala tudo).
    s.setTextZoom(100);
    // O site reconhece o app pelo user agent e pela ponte (liga o modo TV sozinho na TV).
    s.setUserAgentString(s.getUserAgentString() + " KeshTV-Android/" + BuildConfig.VERSION_NAME + (isTv() ? " (TV)" : ""));
    web.addJavascriptInterface(new Bridge(), "KeshNative");
    web.setWebViewClient(new WebViewClient());
    web.setWebChromeClient(new WebChromeClient() {
      @Override public void onShowCustomView(View view, CustomViewCallback callback) {
        if (fullView != null) { callback.onCustomViewHidden(); return; }
        fullView = view;
        fullCallback = callback;
        root.addView(view, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        immersive(true);
      }
      @Override public void onHideCustomView() { exitFullscreen(); }
    });
    if (state != null) web.restoreState(state);
    else web.loadUrl(BuildConfig.START_URL);
  }

  @Override
  protected void onSaveInstanceState(Bundle out) {
    super.onSaveInstanceState(out);
    web.saveState(out);
  }

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    if (hasFocus) immersive(fullView != null || isTv());
  }

  @Override
  public void onBackPressed() {
    if (fullView != null) exitFullscreen();
    else if (web.canGoBack()) web.goBack();
    else super.onBackPressed();
  }
}

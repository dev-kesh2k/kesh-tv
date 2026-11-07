package br.com.centralappshub.keshtv.kesh_tv

import android.view.WindowManager
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
  override fun configureFlutterEngine(engine: FlutterEngine) {
    super.configureFlutterEngine(engine)
    // Mantém a tela acesa durante o vídeo (sem isso a TV entra no descanso de tela).
    MethodChannel(engine.dartExecutor.binaryMessenger, "kesh_tv/screen").setMethodCallHandler { call, result ->
      if (call.method == "keepOn") {
        if (call.arguments == true) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        result.success(null)
      } else result.notImplemented()
    }
  }
}

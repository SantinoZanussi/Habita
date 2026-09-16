package ar.com.habita.habita

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val ENLACES_CHANNEL = "ar.com.habita/enlaces"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "habita_general",
                "Avisos de Habita",
                NotificationManager.IMPORTANCE_DEFAULT,
            ).apply {
                description = "Pagos, accesos, reservas y novedades del complejo"
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, ENLACES_CHANNEL).setMethodCallHandler { call, result ->
            if (call.method == "abrirUrl") {
                val url = call.argument<String>("url")
                if (!url.isNullOrBlank()) {
                    try {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        }
                        startActivity(intent)
                        result.success(true)
                    } catch (e: Exception) {
                        result.error("ERROR_ABRIR_URL", e.localizedMessage, null)
                    }
                } else {
                    result.error("URL_INVALIDA", "La URL no puede ser vacía", null)
                }
            } else {
                result.notImplemented()
            }
        }
    }
}

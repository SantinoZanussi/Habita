package ar.com.habita.habita

import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
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
}

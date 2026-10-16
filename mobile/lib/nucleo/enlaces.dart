import 'package:flutter/services.dart';
import 'enlaces_plataforma.dart'
    if (dart.library.js_interop) 'enlaces_web.dart'
    as plataforma;

/// Utilidad para interactuar con enlaces externos y el portapapeles sin
/// dependencias externas, utilizando canales de plataforma nativos.
class LanzadorEnlaces {
  static const MethodChannel _canal = MethodChannel('ar.com.habita/enlaces');

  /// Abre una URL en el navegador externo o la aplicación asociada en el sistema.
  /// Retorna `true` si la acción se ejecutó con éxito, o `false` en caso de fallo.
  static Future<bool> abrirUrl(String url) async {
    final enlace = url.trim();
    if (enlace.isEmpty) return false;
    if (plataforma.esWeb) return plataforma.abrir(enlace);
    try {
      final exito = await _canal.invokeMethod<bool>('abrirUrl', {
        'url': enlace,
      });
      return exito ?? false;
    } catch (_) {
      return false;
    }
  }

  /// Copia el enlace recibido al portapapeles del dispositivo.
  static Future<void> copiarAlPortapapeles(String url) async {
    final enlace = url.trim();
    if (enlace.isNotEmpty) {
      await Clipboard.setData(ClipboardData(text: enlace));
    }
  }
}

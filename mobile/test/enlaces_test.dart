import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:habita/nucleo/enlaces.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const canal = MethodChannel('ar.com.habita/enlaces');

  group('LanzadorEnlaces', () {
    test('abrirUrl devuelve false con URL vacía o en blanco', () async {
      expect(await LanzadorEnlaces.abrirUrl(''), isFalse);
      expect(await LanzadorEnlaces.abrirUrl('   '), isFalse);
    });

    test('abrirUrl invoca canal nativo y devuelve true si el intent tiene éxito', () async {
      String? urlRecibida;
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(canal, (call) async {
        if (call.method == 'abrirUrl') {
          urlRecibida = (call.arguments as Map)['url'] as String?;
          return true;
        }
        return null;
      });

      final resultado = await LanzadorEnlaces.abrirUrl(
        'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=test-123',
      );

      expect(resultado, isTrue);
      expect(
        urlRecibida,
        'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=test-123',
      );

      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(canal, null);
    });

    test('abrirUrl captura excepciones del canal nativo y devuelve false', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(canal, (call) async {
        throw PlatformException(code: 'ERROR_ABRIR_URL', message: 'No browser');
      });

      final resultado = await LanzadorEnlaces.abrirUrl('https://example.com');
      expect(resultado, isFalse);

      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(canal, null);
    });

    test('copiarAlPortapapeles almacena el texto correctamente', () async {
      String? portapapelesTexto;
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(SystemChannels.platform, (call) async {
        if (call.method == 'Clipboard.setData') {
          portapapelesTexto = (call.arguments as Map)['text'] as String?;
          return null;
        } else if (call.method == 'Clipboard.getData') {
          return {'text': portapapelesTexto};
        }
        return null;
      });

      await LanzadorEnlaces.copiarAlPortapapeles('https://mpago.la/demo');
      expect(portapapelesTexto, 'https://mpago.la/demo');

      final datos = await Clipboard.getData('text/plain');
      expect(datos?.text, 'https://mpago.la/demo');

      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(SystemChannels.platform, null);
    });
  });
}

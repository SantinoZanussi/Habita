import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:habita/nucleo/enlaces.dart';
import 'package:habita/nucleo/tema/tema.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const canal = MethodChannel('ar.com.habita/enlaces');

  testWidgets('Diálogo de pago con Mercado Pago permite abrir y copiar enlace', (
    tester,
  ) async {
    String? enlaceAbierto;
    String? copiadoEnPortapapeles;

    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(canal, (call) async {
      if (call.method == 'abrirUrl') {
        enlaceAbierto = (call.arguments as Map)['url'] as String?;
        return true;
      }
      return null;
    });

    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'Clipboard.setData') {
        copiadoEnPortapapeles = (call.arguments as Map)['text'] as String?;
      }
      return null;
    });

    const urlTest = 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=test-456';

    await tester.pumpWidget(
      MaterialApp(
        theme: HabitaTema.claro,
        home: Scaffold(
          body: Builder(
            builder: (context) => ElevatedButton(
              onPressed: () {
                showDialog<void>(
                  context: context,
                  builder: (dialogContext) => AlertDialog(
                    title: const Text('Pago con Mercado Pago'),
                    content: const SelectableText(urlTest),
                    actions: [
                      OutlinedButton(
                        onPressed: () => LanzadorEnlaces.copiarAlPortapapeles(urlTest),
                        child: const Text('Copiar enlace'),
                      ),
                      FilledButton(
                        onPressed: () => LanzadorEnlaces.abrirUrl(urlTest),
                        child: const Text('Abrir enlace'),
                      ),
                      TextButton(
                        onPressed: () => Navigator.pop(dialogContext),
                        child: const Text('Cerrar'),
                      ),
                    ],
                  ),
                );
              },
              child: const Text('Mostrar diálogo'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Mostrar diálogo'));
    await tester.pumpAndSettle();

    expect(find.text('Pago con Mercado Pago'), findsOneWidget);
    expect(find.text(urlTest), findsOneWidget);
    expect(find.text('Copiar enlace'), findsOneWidget);
    expect(find.text('Abrir enlace'), findsOneWidget);

    // Probar abrir enlace
    await tester.tap(find.text('Abrir enlace'));
    await tester.pump();
    expect(enlaceAbierto, urlTest);

    // Probar copiar enlace
    await tester.tap(find.text('Copiar enlace'));
    await tester.pump();
    expect(copiadoEnPortapapeles, urlTest);

    // Probar cerrar
    await tester.tap(find.text('Cerrar'));
    await tester.pumpAndSettle();
    expect(find.text('Pago con Mercado Pago'), findsNothing);

    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(canal, null);
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, null);
  });
}

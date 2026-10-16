import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:habita/presentacion/pago_expensas.dart';

void main() {
  testWidgets('el diálogo real de expensas copia el enlace del backend', (tester) async {
    String? copiado;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'Clipboard.setData') copiado = call.arguments['text'] as String;
      return null;
    });
    addTearDown(() => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, null));
    const enlace = 'https://www.mercadopago.com.ar/checkout/test';
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: PagoExpensas(
      crearPreferencia: () async => {'urlPago': enlace, 'simulado': false},
      pagarDemo: (_) async {}, confirmarDemo: (_) async => false, actualizar: () async {},
    ))));
    await tester.tap(find.text('Pagar saldo con Mercado Pago'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Copiar enlace'));
    await tester.pumpAndSettle();
    expect(copiado, enlace);
    await tester.tap(find.text('Volver a mi cuenta'));
    await tester.pumpAndSettle();
    expect(find.text('Continuar con Mercado Pago'), findsNothing);
  });
}

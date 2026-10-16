import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:habita/presentacion/pago_expensas.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const canal = MethodChannel('ar.com.habita/enlaces');
  const url = 'https://www.mercadopago.com.ar/checkout/test';

  testWidgets('no duplica preferencias y abre el checkout sin acreditar', (
    tester,
  ) async {
    var solicitudes = 0, aperturas = 0, acreditaciones = 0;
    final respuesta = Completer<Map<String, dynamic>>();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(canal, (call) async {
          expect(call.method, 'abrirUrl');
          expect(call.arguments['url'], url);
          aperturas++;
          return true;
        });
    addTearDown(
      () => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(canal, null),
    );
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: PagoExpensas(
            crearPreferencia: () {
              solicitudes++;
              return respuesta.future;
            },
            pagarDemo: (_) async {
              acreditaciones++;
            },
            confirmarDemo: (_) async => true,
            actualizar: () async {},
          ),
        ),
      ),
    );
    await tester.tap(find.text('Pagar saldo con Mercado Pago'));
    await tester.pump();
    await tester.tap(find.text('Preparando pago…'));
    expect(solicitudes, 1);
    respuesta.complete({
      'urlPago': url,
      'simulado': false,
      'montoFormateado': r'$ 100,00',
    });
    await tester.pumpAndSettle();
    expect(find.text('Abrir Mercado Pago'), findsOneWidget);
    await tester.tap(find.text('Abrir Mercado Pago'));
    await tester.pumpAndSettle();
    expect(aperturas, 1);
    expect(acreditaciones, 0);
  });

  testWidgets('si Android no abre el enlace permite copiarlo', (tester) async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(canal, (_) async => false);
    addTearDown(
      () => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(canal, null),
    );
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: PagoExpensas(
            crearPreferencia: () async => {'urlPago': url, 'simulado': false},
            pagarDemo: (_) async {},
            confirmarDemo: (_) async => false,
            actualizar: () async {},
          ),
        ),
      ),
    );
    await tester.tap(find.text('Pagar saldo con Mercado Pago'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Abrir Mercado Pago'));
    await tester.pumpAndSettle();
    expect(
      find.textContaining('No pudimos abrir el navegador'),
      findsOneWidget,
    );
    expect(find.text('Copiar enlace'), findsOneWidget);
  });

  testWidgets('cancelar la demo no acredita ni simula un pago', (tester) async {
    var pagos = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: PagoExpensas(
            crearPreferencia: () async => {
              'simulado': true,
              'preferenciaId': 'sim-test',
            },
            pagarDemo: (_) async {
              pagos++;
            },
            confirmarDemo: (_) async => false,
            actualizar: () async {},
          ),
        ),
      ),
    );
    await tester.tap(find.text('Pagar saldo con Mercado Pago'));
    await tester.pumpAndSettle();
    expect(pagos, 0);
    expect(find.text('Pagar saldo con Mercado Pago'), findsOneWidget);
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:habita/presentacion/confirmar_pago_demo.dart';

void main() {
  for (final confirmar in [false, true]) {
    testWidgets(
      'pago demo: ${confirmar ? 'confirma explícitamente' : 'permite cancelar'}',
      (tester) async {
        bool? resultado;
        await tester.pumpWidget(
          MaterialApp(
            home: Builder(
              builder: (context) {
                return Scaffold(
                  body: TextButton(
                    onPressed: () async {
                      resultado = await confirmarPagoDemo(context);
                    },
                    child: const Text('Abrir'),
                  ),
                );
              },
            ),
          ),
        );
        await tester.tap(find.text('Abrir'));
        await tester.pumpAndSettle();
        expect(find.text('Pago de demostración'), findsOneWidget);
        expect(
          find.textContaining('No se realizará ningún cobro'),
          findsOneWidget,
        );
        expect(resultado, isNull);
        await tester.tap(find.text(confirmar ? 'Simular pago' : 'Cancelar'));
        await tester.pumpAndSettle();
        expect(resultado, confirmar);
      },
    );
  }
  testWidgets('cerrar el diálogo nunca confirma un pago', (tester) async {
    bool? resultado;
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) {
            return Scaffold(
              body: TextButton(
                onPressed: () async {
                  resultado = await confirmarPagoDemo(context);
                },
                child: const Text('Abrir'),
              ),
            );
          },
        ),
      ),
    );
    await tester.tap(find.text('Abrir'));
    await tester.pumpAndSettle();
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(resultado, false);
  });
}

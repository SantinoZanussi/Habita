import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:habita/nucleo/tema/tema.dart';
import 'package:habita/presentacion/login.dart';

void main() {
  testWidgets('la pantalla de acceso muestra marca, perfiles y formulario', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(theme: HabitaTema.claro, home: const LoginScreen()),
    );

    expect(find.text('Todo tu complejo,\nen una sola app.'), findsOneWidget);
    expect(find.text('Residente'), findsOneWidget);
    expect(find.text('Guardia'), findsOneWidget);
    expect(find.text('Obra'), findsOneWidget);
    expect(find.byType(TextField), findsNWidgets(2));
    expect(find.text('Ingresar'), findsOneWidget);
  });
}

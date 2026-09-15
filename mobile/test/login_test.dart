import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:habita/presentacion/login.dart';

void main() {
  testWidgets('Login online sin credenciales demo y con logo sin tinte', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(home: LoginScreen(usarEmuladores: false)),
    );
    final campos = tester
        .widgetList<TextField>(find.byType(TextField))
        .toList();
    expect(campos.every((campo) => campo.controller!.text.isEmpty), isTrue);
    expect(find.byType(ChoiceChip), findsNothing);
    final logo = tester.widget<Image>(find.byType(Image));
    expect(logo.color, isNull);
    expect(logo.width, 72);
    await tester.ensureVisible(find.text('Ingresar'));
    await tester.tap(find.text('Ingresar'));
    await tester.pump();
    expect(find.text('Completá tu correo y contraseña.'), findsOneWidget);
  });

  testWidgets('Los perfiles demo siguen disponibles solo en emulador', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(home: LoginScreen(usarEmuladores: true)),
    );
    expect(find.byType(ChoiceChip), findsNWidgets(3));
  });
}

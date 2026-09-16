import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:habita/presentacion/login.dart';

void main() {
  testWidgets('Permite mostrar y volver a ocultar la contraseña', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(home: LoginScreen(usarEmuladores: false)),
    );
    final campo = find.byType(TextField).last;
    await tester.enterText(campo, 'contraseña de prueba');
    expect(tester.widget<TextField>(campo).obscureText, isTrue);
    await tester.ensureVisible(find.byTooltip('Mostrar contraseña'));
    await tester.tap(find.byTooltip('Mostrar contraseña'));
    await tester.pump();
    expect(tester.widget<TextField>(campo).obscureText, isFalse);
    await tester.tap(find.byTooltip('Ocultar contraseña'));
    await tester.pump();
    expect(tester.widget<TextField>(campo).obscureText, isTrue);
  });

  testWidgets('Recuperación valida correo y evita envíos simultáneos', (
    tester,
  ) async {
    final auth = _AuthPrueba();
    final pendiente = Completer<void>();
    auth.respuesta = pendiente.future;
    await tester.pumpWidget(
      MaterialApp(home: LoginScreen(usarEmuladores: false, auth: auth)),
    );
    final recuperar = find.text('Olvidé mi contraseña');
    await tester.ensureVisible(recuperar);
    await tester.tap(recuperar);
    await tester.pump();
    expect(auth.correos, isEmpty);
    expect(
      find.text('Ingresá un correo válido para recuperar tu contraseña.'),
      findsOneWidget,
    );
    await tester.enterText(
      find.byType(TextField).first,
      ' vecino@example.com ',
    );
    await tester.ensureVisible(recuperar);
    await tester.tap(recuperar);
    await tester.pump();
    expect(auth.correos, ['vecino@example.com']);
    expect(
      tester
          .widget<TextButton>(
            find.widgetWithText(TextButton, 'Olvidé mi contraseña'),
          )
          .onPressed,
      isNull,
    );
    expect(
      tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
      isNull,
    );
    pendiente.complete();
    await tester.pumpAndSettle();
    expect(
      find.textContaining('Si el correo tiene una cuenta'),
      findsOneWidget,
    );
  });

  for (final codigo in ['user-not-found', 'network-request-failed']) {
    testWidgets('Recuperación maneja $codigo', (tester) async {
      final auth = _AuthPrueba()..error = FirebaseAuthException(code: codigo);
      await tester.pumpWidget(
        MaterialApp(home: LoginScreen(usarEmuladores: false, auth: auth)),
      );
      await tester.enterText(
        find.byType(TextField).first,
        'vecino@example.com',
      );
      await tester.ensureVisible(find.text('Olvidé mi contraseña'));
      await tester.tap(find.text('Olvidé mi contraseña'));
      await tester.pumpAndSettle();
      expect(
        find.textContaining(
          codigo == 'user-not-found'
              ? 'Si el correo tiene una cuenta'
              : 'No hay conexión.',
        ),
        findsOneWidget,
      );
      expect(
        tester
            .widget<TextButton>(
              find.widgetWithText(TextButton, 'Olvidé mi contraseña'),
            )
            .onPressed,
        isNotNull,
      );
    });
  }

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

class _AuthPrueba extends Fake implements FirebaseAuth {
  final correos = <String>[];
  Future<void>? respuesta;
  FirebaseAuthException? error;

  @override
  Future<void> sendPasswordResetEmail({
    required String email,
    ActionCodeSettings? actionCodeSettings,
  }) async {
    correos.add(email);
    if (error != null) throw error!;
    await respuesta;
  }
}

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import 'nucleo/firebase_config.dart';
import 'nucleo/tema/tema.dart';
import 'presentacion/guardia_shell.dart';
import 'presentacion/login.dart';
import 'presentacion/obra_shell.dart';
import 'presentacion/residente_shell.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: HabitaFirebase.opciones);
  const usarEmuladores = bool.fromEnvironment(
    'USE_FIREBASE_EMULATORS',
    defaultValue: true,
  );
  if (usarEmuladores) {
    final host = kIsWeb ? '127.0.0.1' : '10.0.2.2';
    await FirebaseAuth.instance.useAuthEmulator(host, 9099);
    FirebaseFirestore.instance.useFirestoreEmulator(host, 8080);
    await FirebaseStorage.instance.useStorageEmulator(host, 9199);
  }
  runApp(const HabitaApp());
}

class HabitaApp extends StatelessWidget {
  const HabitaApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Habita',
    debugShowCheckedModeBanner: false,
    theme: HabitaTema.claro,
    home: const SesionGate(),
  );
}

class SesionGate extends StatelessWidget {
  const SesionGate({super.key});
  @override
  Widget build(BuildContext context) => StreamBuilder<User?>(
    stream: FirebaseAuth.instance.authStateChanges(),
    builder: (context, sesion) {
      if (sesion.connectionState == ConnectionState.waiting) {
        return const Scaffold(body: Center(child: CircularProgressIndicator()));
      }
      if (sesion.data == null) return const LoginScreen();
      return FutureBuilder<IdTokenResult>(
        future: sesion.data!.getIdTokenResult(true),
        builder: (context, token) {
          if (!token.hasData) {
            return const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            );
          }
          final claims = token.data!.claims;
          return switch (claims?['rol']) {
            'residente' => ResidenteShell(
              complejoId: claims?['complejoId'] as String,
              unidadId: claims?['unidadId'] as String,
            ),
            'guardia' => GuardiaShell(
              complejoId: claims?['complejoId'] as String,
            ),
            'responsable_obra' => ObraShell(
              complejoId: claims?['complejoId'] as String,
              obraIds: List<String>.from(
                claims?['obraIds'] as List? ?? const [],
              ),
            ),
            _ => const RolNoDisponible(),
          };
        },
      );
    },
  );
}

class RolNoDisponible extends StatelessWidget {
  const RolNoDisponible({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
    body: Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Image.asset('assets/brand/habita-isotipo.png', width: 82),
            const SizedBox(height: 20),
            const Text(
              'Este rol usa el panel web',
              style: TextStyle(
                fontFamily: 'Sora',
                fontSize: 22,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Ingresá con una cuenta de residente, guardia o responsable de obra.',
            ),
            const SizedBox(height: 18),
            FilledButton(
              onPressed: FirebaseAuth.instance.signOut,
              child: const Text('Cerrar sesión'),
            ),
          ],
        ),
      ),
    ),
  );
}

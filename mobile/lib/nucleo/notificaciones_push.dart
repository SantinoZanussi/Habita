import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import 'firebase_config.dart';

final mensajeroHabita = GlobalKey<ScaffoldMessengerState>();

@pragma('vm:entry-point')
Future<void> manejarPushEnSegundoPlano(RemoteMessage mensaje) async {
  if (Firebase.apps.isEmpty) {
    await Firebase.initializeApp(options: HabitaFirebase.opciones);
  }
}

/// Registra el dispositivo en FCM y mantiene el token sincronizado en el
/// perfil autenticado. Solo se inicia contra Firebase real: FCM no tiene
/// emulador y no debe intentar registrar la configuración demo.
class NotificacionesPush {
  NotificacionesPush._();
  static final instancia = NotificacionesPush._();

  final _mensajeria = FirebaseMessaging.instance;
  StreamSubscription<User?>? _sesion;
  StreamSubscription<String>? _renovacion;
  StreamSubscription<RemoteMessage>? _primerPlano;
  StreamSubscription<RemoteMessage>? _apertura;
  String? _uidRegistrado;

  Future<void> inicializar() async {
    if (kIsWeb) return;

    await _mensajeria.setAutoInitEnabled(true);
    _primerPlano = FirebaseMessaging.onMessage.listen(_mostrarEnPrimerPlano);
    _apertura = FirebaseMessaging.onMessageOpenedApp.listen(_mostrarAlAbrir);
    _sesion = FirebaseAuth.instance.userChanges().listen(
      (usuario) => unawaited(_manejarSesion(usuario)),
    );

    final inicial = await _mensajeria.getInitialMessage();
    if (inicial != null) _mostrarAlAbrir(inicial);
  }

  Future<void> _manejarSesion(User? usuario) async {
    if (usuario == null) {
      _uidRegistrado = null;
      await _renovacion?.cancel();
      _renovacion = null;
      return;
    }
    if (usuario.uid != _uidRegistrado) await _registrar(usuario);
  }

  Future<void> _registrar(User usuario) async {
    try {
      final permiso = await _mensajeria.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      if (permiso.authorizationStatus == AuthorizationStatus.denied) return;

      final token = await _mensajeria.getToken();
      if (token == null || token.isEmpty) return;
      await _guardar(usuario.uid, token);
      _uidRegistrado = usuario.uid;

      await _renovacion?.cancel();
      _renovacion = _mensajeria.onTokenRefresh.listen(
        (nuevo) => unawaited(_guardar(usuario.uid, nuevo)),
      );
    } on FirebaseException catch (error) {
      debugPrint('No se pudo registrar FCM (${error.code}).');
    } catch (error) {
      debugPrint('No se pudo registrar FCM: $error');
    }
  }

  Future<void> _guardar(String uid, String token) =>
      FirebaseFirestore.instance.collection('usuarios').doc(uid).update({
        'tokenFcm': token,
        'actualizadoEn': FieldValue.serverTimestamp(),
      });

  void _mostrarEnPrimerPlano(RemoteMessage mensaje) {
    final titulo = mensaje.notification?.title ?? 'Habita';
    final cuerpo = mensaje.notification?.body ?? '';
    final texto = cuerpo.isEmpty ? titulo : '$titulo\n$cuerpo';
    mensajeroHabita.currentState
      ?..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(texto)));
  }

  void _mostrarAlAbrir(RemoteMessage mensaje) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final titulo = mensaje.notification?.title ?? 'Notificación de Habita';
      mensajeroHabita.currentState?.showSnackBar(
        SnackBar(content: Text(titulo)),
      );
    });
  }

  Future<void> cerrar() async {
    await _sesion?.cancel();
    await _renovacion?.cancel();
    await _primerPlano?.cancel();
    await _apertura?.cancel();
  }
}

import 'dart:async';
import 'dart:convert';
import 'dart:io' show Platform;

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

class ErrorApi implements Exception {
  ErrorApi(this.mensaje, {this.codigo});
  final String mensaje;
  final String? codigo;
  @override
  String toString() => mensaje;
}

class HabitaApi {
  HabitaApi({
    FirebaseAuth? auth,
    this.client,
    this.tiempoEspera = const Duration(seconds: 75),
  }) : _auth = auth ?? FirebaseAuth.instance;
  final FirebaseAuth _auth;
  final http.Client? client;
  final Duration tiempoEspera;

  String get baseUrl {
    const definida = String.fromEnvironment('API_BASE_URL');
    if (definida.isNotEmpty) return definida;
    const emuladores = bool.fromEnvironment(
      'USE_FIREBASE_EMULATORS',
      defaultValue: !kReleaseMode,
    );
    if (!emuladores) return 'https://habita-api-goiburu.onrender.com/api';
    if (kIsWeb) return 'http://127.0.0.1:8787/api';
    const host = String.fromEnvironment('API_HOST');
    if (host.isNotEmpty) return 'http://$host:8787/api';
    return Platform.isAndroid
        ? 'http://10.0.2.2:8787/api'
        : 'http://127.0.0.1:8787/api';
  }

  Future<Map<String, dynamic>> get(String ruta) => _enviar('GET', ruta);
  Future<Map<String, dynamic>> post(
    String ruta, [
    Map<String, dynamic>? cuerpo,
  ]) => _enviar('POST', ruta, cuerpo);
  Future<Map<String, dynamic>> patch(
    String ruta, [
    Map<String, dynamic>? cuerpo,
  ]) => _enviar('PATCH', ruta, cuerpo);
  Future<Map<String, dynamic>> delete(String ruta) => _enviar('DELETE', ruta);

  Future<Map<String, dynamic>> _enviar(
    String metodo,
    String ruta, [
    Map<String, dynamic>? cuerpo,
  ]) async {
    final usuario = _auth.currentUser;
    if (usuario == null) {
      throw ErrorApi(
        'Tu sesión terminó. Volvé a ingresar.',
        codigo: 'NO_AUTENTICADO',
      );
    }
    String? token;
    try {
      token = await usuario.getIdToken().timeout(const Duration(seconds: 15));
    } catch (_) {
      throw ErrorApi(
        'No pudimos validar tu sesión. Revisá tu conexión y volvé a ingresar si el problema continúa.',
        codigo: 'SESION_NO_VALIDADA',
      );
    }
    if (token == null || token.isEmpty) {
      throw ErrorApi(
        'Tu sesión terminó. Volvé a ingresar.',
        codigo: 'NO_AUTENTICADO',
      );
    }
    http.Response respuesta;
    final cliente = client ?? http.Client();
    try {
      final uri = Uri.parse('$baseUrl$ruta');
      final headers = <String, String>{
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      };
      final peticion = http.Request(metodo, uri)..headers.addAll(headers);
      if (metodo == 'POST' || metodo == 'PATCH') {
        peticion.body = jsonEncode(cuerpo ?? {});
      }
      respuesta = await cliente
          .send(peticion)
          .then(http.Response.fromStream)
          .timeout(tiempoEspera);
    } on TimeoutException {
      throw ErrorApi(
        metodo == 'GET'
            ? 'El servidor está tardando en responder. Esperá unos instantes y volvé a consultar.'
            : 'No recibimos la confirmación del servidor. Revisá si la operación aparece antes de repetirla.',
        codigo: 'TIEMPO_AGOTADO',
      );
    } catch (_) {
      throw ErrorApi(
        metodo == 'GET'
            ? 'No pudimos conectar. Revisá tu conexión e intentá nuevamente.'
            : 'Se interrumpió la conexión. Revisá si la operación aparece antes de repetirla.',
        codigo: 'SIN_CONEXION',
      );
    } finally {
      if (client == null) cliente.close();
    }
    if ([502, 503, 504].contains(respuesta.statusCode)) {
      throw ErrorApi(
        metodo == 'GET'
            ? 'El servidor no está disponible por el momento. Volvé a consultar en unos instantes.'
            : 'El servidor no pudo confirmar la operación. Revisá su estado antes de repetirla.',
        codigo: 'SERVIDOR_NO_DISPONIBLE',
      );
    }
    Map<String, dynamic> json;
    try {
      json =
          (jsonDecode(respuesta.body.isEmpty ? '{}' : respuesta.body)
              as Map<String, dynamic>);
    } catch (_) {
      throw ErrorApi(
        'El servidor devolvió una respuesta inválida. Intentá nuevamente.',
        codigo: 'RESPUESTA_INVALIDA',
      );
    }
    if (respuesta.statusCode < 200 || respuesta.statusCode >= 300) {
      final error = json['error'] is Map<String, dynamic>
          ? json['error'] as Map<String, dynamic>
          : null;
      throw ErrorApi(
        error?['mensaje'] is String
            ? error!['mensaje'] as String
            : 'La operación no se pudo completar.',
        codigo: error?['codigo'] is String ? error!['codigo'] as String : null,
      );
    }
    return json;
  }
}

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
  HabitaApi({FirebaseAuth? auth}) : _auth = auth ?? FirebaseAuth.instance;
  final FirebaseAuth _auth;

  String get baseUrl {
    const definida = String.fromEnvironment('API_BASE_URL');
    if (definida.isNotEmpty) return definida;
    if (kIsWeb) return 'http://127.0.0.1:8787/api';
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
    final token = await usuario.getIdToken();
    http.Response respuesta;
    try {
      final uri = Uri.parse('$baseUrl$ruta');
      final headers = <String, String>{
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      };
      respuesta = switch (metodo) {
        'GET' =>
          await http
              .get(uri, headers: headers)
              .timeout(const Duration(seconds: 12)),
        'PATCH' =>
          await http
              .patch(uri, headers: headers, body: jsonEncode(cuerpo ?? {}))
              .timeout(const Duration(seconds: 12)),
        _ =>
          await http
              .post(uri, headers: headers, body: jsonEncode(cuerpo ?? {}))
              .timeout(const Duration(seconds: 12)),
      };
    } catch (_) {
      throw ErrorApi(
        'No pudimos conectar. Revisá tu conexión e intentá nuevamente.',
        codigo: 'SIN_CONEXION',
      );
    }
    final json =
        jsonDecode(respuesta.body.isEmpty ? '{}' : respuesta.body)
            as Map<String, dynamic>;
    if (respuesta.statusCode < 200 || respuesta.statusCode >= 300) {
      final error = json['error'] as Map<String, dynamic>?;
      throw ErrorApi(
        error?['mensaje'] as String? ?? 'La operación no se pudo completar.',
        codigo: error?['codigo'] as String?,
      );
    }
    return json;
  }
}

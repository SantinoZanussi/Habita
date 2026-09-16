import 'dart:async';
import 'dart:convert';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:habita/nucleo/api.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  test(
    'API envía sesión Firebase y cuerpo de reserva sin reintentos',
    () async {
      var llamadas = 0;
      final cliente = MockClient((peticion) async {
        llamadas++;
        expect(peticion.headers['Authorization'], 'Bearer token-de-prueba');
        expect(peticion.method, 'POST');
        expect(jsonDecode(peticion.body), {'asistentes': 3});
        return http.Response('{"estado":"confirmada"}', 201);
      });
      final api = HabitaApi(auth: _Auth(), client: cliente);
      expect(api.tiempoEspera, const Duration(seconds: 75));
      expect(await api.post('/reservas', {'asistentes': 3}), {
        'estado': 'confirmada',
      });
      expect(llamadas, 1);
      cliente.close();
    },
  );

  test(
    'Timeout de escritura no repite y pide comprobar el resultado',
    () async {
      var llamadas = 0;
      final pendiente = Completer<http.Response>();
      final cliente = MockClient((peticion) {
        llamadas++;
        return pendiente.future;
      });
      final api = HabitaApi(
        auth: _Auth(),
        client: cliente,
        tiempoEspera: const Duration(milliseconds: 10),
      );
      await expectLater(
        api.post('/reservas'),
        throwsA(
          isA<ErrorApi>()
              .having((e) => e.codigo, 'código', 'TIEMPO_AGOTADO')
              .having(
                (e) => e.mensaje,
                'mensaje',
                contains('antes de repetirla'),
              ),
        ),
      );
      expect(llamadas, 1);
      pendiente.complete(http.Response('{}', 201));
      cliente.close();
    },
  );

  test('Arranque de Render con HTML 503 muestra error comprensible', () async {
    final cliente = MockClient(
      (_) async => http.Response('<html>Unavailable</html>', 503),
    );
    await expectLater(
      HabitaApi(auth: _Auth(), client: cliente).get('/estado'),
      throwsA(
        isA<ErrorApi>().having(
          (e) => e.codigo,
          'código',
          'SERVIDOR_NO_DISPONIBLE',
        ),
      ),
    );
    cliente.close();
  });

  test('Sin token Firebase no se envía ninguna petición', () async {
    var llamadas = 0;
    final cliente = MockClient((_) async {
      llamadas++;
      return http.Response('{}', 200);
    });
    await expectLater(
      HabitaApi(auth: _Auth(token: null), client: cliente).get('/estado'),
      throwsA(
        isA<ErrorApi>().having((e) => e.codigo, 'código', 'NO_AUTENTICADO'),
      ),
    );
    expect(llamadas, 0);
    cliente.close();
  });
}

class _Auth extends Fake implements FirebaseAuth {
  _Auth({String? token = 'token-de-prueba'}) : currentUser = _Usuario(token);
  @override
  final User currentUser;
}

class _Usuario extends Fake implements User {
  _Usuario(this.token);
  final String? token;
  @override
  Future<String?> getIdToken([bool forceRefresh = false]) async => token;
}

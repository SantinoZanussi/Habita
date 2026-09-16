// Dobles de prueba del SDK: nunca se usan para lecturas reales.
// ignore_for_file: subtype_of_sealed_class

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:habita/nucleo/api.dart';
import 'package:habita/presentacion/residente_shell.dart';

void main() {
  test(
    'Avisos consultan el complejo y limitan destinatarios a todos o unidad',
    () {
      final db = _FirestorePrueba();
      final consulta = avisosResidente('torre', '3a', firestore: db);
      expect(db.rutas, ['complejos/torre/notificaciones']);
      final filtros = (consulta as _Consulta).llamadas.where(
        (i) => i.memberName == #where,
      );
      final json = (filtros.single.positionalArguments.single as Filter)
          .toJson()
          .toString();
      expect(json, contains('OR'));
      expect(json, contains('destinatarios'));
      expect(json, contains('todos'));
      expect(json, contains('3a'));
      expect(json, contains('array-contains'));
      final orden = consulta.llamadas.singleWhere(
        (i) => i.memberName == #orderBy,
      );
      expect(orden.positionalArguments, ['enviadaEn']);
      expect(orden.namedArguments[#descending], isTrue);
    },
  );

  testWidgets('Reserva envía asistentes elegidos y duración al backend', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final db = _FirestorePrueba();
    final api = _ApiPrueba();
    await tester.pumpWidget(
      MaterialApp(
        home: AmenitiesScreen(
          complejoId: 'torre',
          unidadId: '3a',
          firestore: db,
          api: api,
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Agregar asistente'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Reservar'));
    await tester.tap(find.text('Reservar'));
    await tester.pumpAndSettle();
    expect(api.ruta, '/complejos/torre/amenities/sum/reservas');
    expect(api.cuerpo!['asistentes'], 2);
    expect(api.cuerpo!['unidadId'], '3a');
    final desde = DateTime.parse(api.cuerpo!['desde'] as String);
    final hasta = DateTime.parse(api.cuerpo!['hasta'] as String);
    expect(desde.isAfter(DateTime.now()), isTrue);
    expect(desde.isUtc, isTrue);
    expect(desde.toLocal().hour, 10);
    expect(hasta.difference(desde), const Duration(hours: 2));
    expect(find.text('Reserva confirmada.'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Cancelación permite volver sin escribir y confirmar después', (
    tester,
  ) async {
    final db = _FirestorePrueba(conReserva: true);
    final api = _ApiPrueba();
    await tester.pumpWidget(
      MaterialApp(
        home: AmenitiesScreen(
          complejoId: 'torre',
          unidadId: '3a',
          firestore: db,
          api: api,
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Cancelar reserva'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cancelar reserva'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Volver'));
    await tester.pumpAndSettle();
    expect(api.eliminada, isNull);
    await tester.ensureVisible(find.text('Cancelar reserva'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cancelar reserva'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Cancelar reserva'));
    await tester.pumpAndSettle();
    expect(api.eliminada, '/complejos/torre/amenities/reservas/reserva1');
    expect(find.text('Reserva cancelada.'), findsOneWidget);
  });
}

class _ApiPrueba extends Fake implements HabitaApi {
  String? ruta;
  String? eliminada;
  Map<String, dynamic>? cuerpo;
  @override
  Future<Map<String, dynamic>> post(
    String ruta, [
    Map<String, dynamic>? cuerpo,
  ]) async {
    this.ruta = ruta;
    this.cuerpo = cuerpo;
    return {'estado': 'confirmada'};
  }

  @override
  Future<Map<String, dynamic>> delete(String ruta) async {
    eliminada = ruta;
    return {'estado': 'cancelada'};
  }
}

class _FirestorePrueba extends Fake implements FirebaseFirestore {
  _FirestorePrueba({this.conReserva = false});
  final bool conReserva;
  final rutas = <String>[];
  final consultas = <String, _Consulta>{};
  @override
  CollectionReference<Map<String, dynamic>> collection(String path) {
    rutas.add(path);
    return consultas.putIfAbsent(
      path,
      () => _Consulta(
        path.endsWith('/amenities')
            ? [
                _Documento('sum', {'nombre': 'SUM', 'capacidad': 10}),
              ]
            : path.endsWith('/reservas') && conReserva
            ? [
                _Documento('reserva1', {
                  'amenityId': 'sum',
                  'unidadId': '3a',
                  'asistentes': 1,
                  'estado': 'confirmada',
                  'desde': Timestamp.fromDate(
                    DateTime.now().add(const Duration(days: 2)),
                  ),
                  'hasta': Timestamp.fromDate(
                    DateTime.now().add(const Duration(days: 2, hours: 2)),
                  ),
                }),
              ]
            : [],
      ),
    );
  }
}

class _Consulta extends Fake
    implements CollectionReference<Map<String, dynamic>> {
  _Consulta(List<QueryDocumentSnapshot<Map<String, dynamic>>> docs)
    : flujo = Stream.value(_Resultado(docs)).asBroadcastStream();
  final Stream<QuerySnapshot<Map<String, dynamic>>> flujo;
  final llamadas = <Invocation>[];
  @override
  dynamic noSuchMethod(Invocation invocation) {
    llamadas.add(invocation);
    if (invocation.memberName == #snapshots) return flujo;
    if ([#where, #orderBy, #limit].contains(invocation.memberName)) return this;
    return super.noSuchMethod(invocation);
  }
}

class _Resultado extends Fake implements QuerySnapshot<Map<String, dynamic>> {
  _Resultado(this.docs);
  @override
  final List<QueryDocumentSnapshot<Map<String, dynamic>>> docs;
}

class _Documento extends Fake
    implements QueryDocumentSnapshot<Map<String, dynamic>> {
  _Documento(this.id, this.datos);
  @override
  final String id;
  final Map<String, dynamic> datos;
  @override
  Map<String, dynamic> data() => datos;
}

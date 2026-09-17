import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../nucleo/tema/tokens.dart';
import 'widgets.dart';

String fechaComunidad(dynamic valor) {
  final fecha = valor is Timestamp
      ? valor.toDate()
      : DateTime.tryParse('$valor');
  return fecha == null
      ? 'Sin fecha informada'
      : DateFormat('dd/MM/yyyy HH:mm').format(fecha);
}

class MiUnidadScreen extends StatelessWidget {
  const MiUnidadScreen({
    super.key,
    required this.complejoId,
    required this.unidadId,
  });
  final String complejoId, unidadId;
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Mi unidad')),
    body: StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .doc('complejos/$complejoId/unidades/$unidadId')
          .snapshots(),
      builder: (context, snap) {
        if (snap.hasError) {
          return const ErrorCarga(mensaje: 'No pudimos consultar tu unidad.');
        }
        if (!snap.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final d = snap.data!.data();
        if (d == null) {
          return const ErrorCarga(
            mensaje:
                'Tu unidad todavía no está disponible. Contactá a la administración.',
          );
        }
        return ListView(
          padding: const EdgeInsets.all(18),
          children: [
            HabitaCard(
              color: HabitaColores.superficieSuave,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.home_work_outlined, size: 40),
                  const SizedBox(height: 16),
                  Text(
                    d['identificador']?.toString() ?? unidadId,
                    style: HabitaTipografia.titulo1,
                  ),
                  const Text('La información de tu hogar, siempre a mano.'),
                ],
              ),
            ),
            const SizedBox(height: 16),
            HabitaCard(
              child: Column(
                children: [
                  _Dato(
                    'Estado',
                    d['estado']?.toString().replaceAll('_', ' ') ??
                        'Sin informar',
                  ),
                  _Dato(
                    'Habitantes registrados',
                    d['habitantes']?.toString() ?? 'Sin informar',
                  ),
                  _Dato(
                    'Superficie',
                    d['superficie'] == null
                        ? 'Sin informar'
                        : '${d['superficie']} m²',
                  ),
                  _Dato(
                    'Coeficiente',
                    d['coeficiente'] == null
                        ? 'Sin informar'
                        : '${d['coeficiente']}%',
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            HabitaCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Vehículos autorizados',
                    style: HabitaTipografia.titulo3,
                  ),
                  const SizedBox(height: 12),
                  if ((d['patentesAutorizadas'] as List? ?? []).isEmpty)
                    const Text('No hay patentes registradas.'),
                  Wrap(
                    spacing: 8,
                    children: (d['patentesAutorizadas'] as List? ?? [])
                        .map(
                          (p) => Chip(
                            avatar: const Icon(Icons.directions_car_outlined),
                            label: Text('$p'),
                          ),
                        )
                        .toList(),
                  ),
                ],
              ),
            ),
            const Padding(
              padding: EdgeInsets.all(12),
              child: Text(
                'Para corregir los datos o autorizar otro vehículo, contactá a la administración.',
              ),
            ),
          ],
        );
      },
    ),
  );
}

class _Dato extends StatelessWidget {
  const _Dato(this.titulo, this.valor);
  final String titulo, valor;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 10),
    child: Row(
      children: [
        Expanded(child: Text(titulo)),
        const SizedBox(width: 12),
        Flexible(child: Text(valor, style: HabitaTipografia.etiqueta)),
      ],
    ),
  );
}

class MisPagosScreen extends StatelessWidget {
  const MisPagosScreen({
    super.key,
    required this.complejoId,
    required this.unidadId,
  });
  final String complejoId, unidadId;
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Mis pagos')),
    body: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .collection('complejos/$complejoId/pagos')
          .where('unidadId', isEqualTo: unidadId)
          .snapshots(),
      builder: (context, snap) {
        if (snap.hasError) {
          return const ErrorCarga(mensaje: 'No pudimos cargar los pagos.');
        }
        if (!snap.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final docs = [...snap.data!.docs]
          ..sort(
            (a, b) =>
                ((b.data()['creadoEn'] as Timestamp?)?.millisecondsSinceEpoch ??
                        0)
                    .compareTo(
                      (a.data()['creadoEn'] as Timestamp?)
                              ?.millisecondsSinceEpoch ??
                          0,
                    ),
          );
        return ListView(
          padding: const EdgeInsets.all(18),
          children: [
            const Text(
              'Tu historial de pagos',
              style: HabitaTipografia.titulo2,
            ),
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Text(
                'Movimientos registrados por la administración y Mercado Pago.',
              ),
            ),
            if (docs.isEmpty)
              const HabitaCard(
                child: Text('Todavía no hay pagos registrados para tu unidad.'),
              ),
            ...docs.map((doc) {
              final d = doc.data();
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: HabitaCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        pesos(d['monto'] as num? ?? 0),
                        style: HabitaTipografia.cifraChica,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Período ${d['periodoId'] ?? 'Sin período'} · ${d['medio'] ?? 'Sin medio'}',
                      ),
                      Text(fechaComunidad(d['fechaPago'] ?? d['creadoEn'])),
                      const SizedBox(height: 10),
                      EstadoChip(
                        d['simulado'] == true
                            ? 'Pago de demostración'
                            : '${d['estado'] ?? 'Registrado'}',
                        tipo: d['simulado'] == true ? 'aviso' : 'exito',
                      ),
                      ExpansionTile(
                        tilePadding: EdgeInsets.zero,
                        title: const Text('Detalle del registro'),
                        children: [
                          SelectableText('Referencia Habita: ${doc.id}'),
                          if (d['imputacion'] is Map) ...[
                            _Dato(
                              'A capital',
                              pesos(d['imputacion']['aCapital'] as num? ?? 0),
                            ),
                            _Dato(
                              'A intereses',
                              pesos(d['imputacion']['aIntereses'] as num? ?? 0),
                            ),
                            _Dato(
                              'A saldo futuro',
                              pesos(
                                d['imputacion']['aSaldoFuturo'] as num? ?? 0,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
              );
            }),
          ],
        );
      },
    ),
  );
}

class ObrasComunidadScreen extends StatelessWidget {
  const ObrasComunidadScreen({super.key, required this.complejoId});
  final String complejoId;
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Obras del complejo')),
    body: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .collection('complejos/$complejoId/obras')
          .where('tipo', isEqualTo: 'comun')
          .snapshots(),
      builder: (context, snap) {
        if (snap.hasError) {
          return const ErrorCarga(mensaje: 'No pudimos cargar las obras.');
        }
        if (!snap.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        return ListView(
          padding: const EdgeInsets.all(18),
          children: [
            const Text(
              'Así mejora tu complejo',
              style: HabitaTipografia.titulo2,
            ),
            const SizedBox(height: 16),
            if (snap.data!.docs.isEmpty)
              const HabitaCard(child: Text('No hay obras comunes publicadas.')),
            ...snap.data!.docs.map((doc) {
              final d = doc.data();
              final avance = (d['avanceFisicoPorcentaje'] as num? ?? 0).clamp(
                0,
                100,
              );
              return Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: HabitaCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${d['nombre'] ?? 'Obra común'}',
                        style: HabitaTipografia.titulo3,
                      ),
                      const SizedBox(height: 8),
                      EstadoChip(
                        '${d['estado'] ?? 'Sin estado'}'.replaceAll('_', ' '),
                      ),
                      const SizedBox(height: 18),
                      LinearProgressIndicator(
                        value: avance / 100,
                        minHeight: 8,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      const SizedBox(height: 8),
                      Text('${avance.toStringAsFixed(0)}% de avance informado'),
                      _Dato(
                        'Presupuesto',
                        pesos(d['presupuestoAprobado'] as num? ?? 0),
                      ),
                      _Dato(
                        'Finalización estimada',
                        fechaComunidad(d['fechaFinEstimada']),
                      ),
                    ],
                  ),
                ),
              );
            }),
          ],
        );
      },
    ),
  );
}

class AyudaComunidadScreen extends StatelessWidget {
  const AyudaComunidadScreen({super.key, required this.crearReclamo});
  final VoidCallback crearReclamo;
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Ayuda y convivencia')),
    body: ListView(
      padding: const EdgeInsets.all(18),
      children: [
        const Text('Estamos para orientarte', style: HabitaTipografia.titulo2),
        const SizedBox(height: 16),
        ...const {
          '¿Cómo reservo un espacio?':
              'Entrá a Reservas, elegí fecha, horario y asistentes. Algunos espacios requieren aprobación; consultá su estado en Mis reservas.',
          '¿Cómo cancelo una reserva?':
              'En Mis reservas, abrí la reserva futura y tocá Cancelar reserva. Confirmá la acción para liberar los lugares.',
          '¿Dónde veo un pago?':
              'En Mis pagos aparecen los movimientos registrados. Si un pago todavía no figura, conservá su comprobante y consultá a la administración antes de repetirlo.',
          '¿Cómo autorizo una visita?':
              'En Accesos creá una autorización con nombre y documento. La visita debe presentar el QR en la garita y llevar su identificación.',
          '¿Cómo informo un problema?':
              'Creá un reclamo con ubicación y descripción del problema. Podés seguir su estado desde Mis reclamos. No uses este canal para emergencias que requieran atención inmediata.',
          'Buenas prácticas para espacios comunes':
              'Respetá el horario, dejá el espacio limpio y avisá si no vas a usarlo. Consultá las reglas particulares de tu complejo con la administración.',
        }.entries.map(
          (e) => Card(
            child: ExpansionTile(
              title: Text(e.key),
              childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 18),
              children: [Text(e.value)],
            ),
          ),
        ),
        const SizedBox(height: 16),
        FilledButton.icon(
          onPressed: crearReclamo,
          icon: const Icon(Icons.edit_note),
          label: const Text('Crear un reclamo'),
        ),
      ],
    ),
  );
}

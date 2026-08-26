import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../nucleo/api.dart';
import '../nucleo/tema/tokens.dart';
import 'widgets.dart';

class ObraShell extends StatelessWidget {
  const ObraShell({super.key, required this.complejoId, required this.obraIds});
  final String complejoId;
  final List<String> obraIds;
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Mis obras'),
      actions: [
        IconButton(
          onPressed: FirebaseAuth.instance.signOut,
          icon: const Icon(Icons.logout_rounded),
        ),
      ],
    ),
    body: obraIds.isEmpty
        ? const ErrorCarga(mensaje: 'No tenés una obra asignada.')
        : StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
            stream: FirebaseFirestore.instance
                .collection('complejos/$complejoId/obras')
                .where(FieldPath.documentId, whereIn: obraIds.take(30).toList())
                .snapshots(),
            builder: (context, snap) {
              if (snap.hasError) {
                return const ErrorCarga(
                  mensaje: 'No pudimos cargar tus obras.',
                );
              }
              if (!snap.hasData) {
                return const Center(child: CircularProgressIndicator());
              }
              return ListView(
                padding: const EdgeInsets.all(18),
                children: snap.data!.docs
                    .map(
                      (obra) => _ObraCard(complejoId: complejoId, obra: obra),
                    )
                    .toList(),
              );
            },
          ),
  );
}

class _ObraCard extends StatelessWidget {
  const _ObraCard({required this.complejoId, required this.obra});
  final String complejoId;
  final QueryDocumentSnapshot<Map<String, dynamic>> obra;
  @override
  Widget build(BuildContext context) {
    final datos = obra.data();
    final avance = (datos['avanceFisicoPorcentaje'] as num? ?? 0).toDouble();
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: HabitaCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    datos['nombre'] as String? ?? '',
                    style: HabitaTipografia.titulo3,
                  ),
                ),
                EstadoChip(
                  datos['estado']?.toString() ?? 'activa',
                  tipo: 'aviso',
                ),
              ],
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Text(
                  '${avance.toStringAsFixed(0)}%',
                  style: HabitaTipografia.cifra,
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: LinearProgressIndicator(
                    value: avance / 100,
                    minHeight: 9,
                    borderRadius: BorderRadius.circular(99),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            const Text('Partidas', style: HabitaTipografia.etiqueta),
            const SizedBox(height: 8),
            StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
              stream: obra.reference.collection('partidas').snapshots(),
              builder: (context, snap) {
                if (!snap.hasData) return const LinearProgressIndicator();
                return Column(
                  children: snap.data!.docs.map((partida) {
                    final p = partida.data();
                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(p['nombre']?.toString() ?? ''),
                      subtitle: Text(
                        '${p['avancePorcentaje'] ?? 0}% · ${p['esCritica'] == true ? 'Partida crítica' : 'Holgura ${p['holgura'] ?? 0} días'}',
                      ),
                      trailing: FilledButton.tonal(
                        onPressed: () => _cargar(context, partida),
                        child: const Text('Avance'),
                      ),
                    );
                  }).toList(),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _cargar(
    BuildContext context,
    QueryDocumentSnapshot<Map<String, dynamic>> partida,
  ) async {
    final porcentaje = TextEditingController(
      text: '${partida.data()['avancePorcentaje'] ?? 0}',
    );
    final nota = TextEditingController();
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (dialogContext) => Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          20,
          20,
          MediaQuery.viewInsetsOf(dialogContext).bottom + 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              partida.data()['nombre']?.toString() ?? 'Cargar avance',
              style: HabitaTipografia.titulo2,
            ),
            const SizedBox(height: 14),
            TextField(
              controller: porcentaje,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Avance acumulado (%)',
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: nota,
              decoration: const InputDecoration(labelText: 'Observación'),
            ),
            const SizedBox(height: 14),
            FilledButton(
              onPressed: () async {
                try {
                  final uid = FirebaseAuth.instance.currentUser!.uid;
                  await HabitaApi()
                      .post('/complejos/$complejoId/obras/${obra.id}/avances', {
                        'partidaId': partida.id,
                        'porcentaje': num.parse(porcentaje.text),
                        'observacion': nota.text,
                        'timestampCliente': DateTime.now().toIso8601String(),
                        'idempotencyKey':
                            '$uid-${DateTime.now().microsecondsSinceEpoch}',
                      });
                  if (!dialogContext.mounted) return;
                  Navigator.pop(dialogContext);
                  mostrarExito(
                    context,
                    'Avance registrado y cronograma recalculado.',
                  );
                } catch (e) {
                  if (dialogContext.mounted) mostrarError(dialogContext, e);
                }
              },
              child: const Text('Guardar avance'),
            ),
          ],
        ),
      ),
    );
  }
}

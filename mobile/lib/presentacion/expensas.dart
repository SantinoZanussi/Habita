import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../nucleo/api.dart';
import '../nucleo/tema/tokens.dart';
import 'confirmar_pago_demo.dart';
import 'pago_expensas.dart';
import 'widgets.dart';

/// Consulta contable única para inicio y expensas. Firestore sólo invalida la
/// consulta: el cliente no recalcula deuda, mora ni saldos.
class CuentaExpensas extends StatefulWidget {
  const CuentaExpensas({
    super.key,
    required this.complejoId,
    required this.unidadId,
    required this.builder,
  });
  final String complejoId;
  final String unidadId;
  final Widget Function(Map<String, dynamic>, Future<void> Function()) builder;
  @override
  State<CuentaExpensas> createState() => _CuentaExpensasState();
}

class _CuentaExpensasState extends State<CuentaExpensas>
    with WidgetsBindingObserver {
  StreamSubscription<DocumentSnapshot<Map<String, dynamic>>>? _cambios;
  Map<String, dynamic>? _cuenta;
  Object? _error;
  int _solicitud = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _suscribir();
  }

  void _suscribir() {
    _cambios = FirebaseFirestore.instance
        .doc('complejos/${widget.complejoId}')
        .snapshots()
        .listen(
          (_) => _actualizar(),
          onError: (Object error) {
            if (mounted) setState(() => _error = error);
          },
        );
  }

  @override
  void didUpdateWidget(CuentaExpensas oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.complejoId != widget.complejoId ||
        oldWidget.unidadId != widget.unidadId) {
      _cambios?.cancel();
      _cuenta = null;
      _suscribir();
    }
  }

  Future<void> _actualizar() async {
    final solicitud = ++_solicitud;
    try {
      final cuenta = await HabitaApi().get(
        '/complejos/${widget.complejoId}/expensas/cuenta/${widget.unidadId}',
      );
      if (!mounted || solicitud != _solicitud) return;
      setState(() {
        _cuenta = cuenta;
        _error = null;
      });
    } catch (error) {
      if (mounted && solicitud == _solicitud) setState(() => _error = error);
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _actualizar();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _cambios?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return ErrorCarga(mensaje: _error.toString(), reintentar: _actualizar);
    }
    if (_cuenta == null) {
      return const Center(child: CircularProgressIndicator());
    }
    return widget.builder(_cuenta!, _actualizar);
  }
}

class ResumenCuentaExpensas extends StatelessWidget {
  const ResumenCuentaExpensas({
    super.key,
    required this.complejoId,
    required this.unidadId,
    required this.onTap,
  });
  final String complejoId;
  final String unidadId;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => CuentaExpensas(
    complejoId: complejoId,
    unidadId: unidadId,
    builder: (cuenta, actualizar) => HabitaCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Saldo de expensas', style: HabitaTipografia.etiqueta),
          Text(
            pesos(cuenta['totalAdeudado'] as num? ?? 0),
            style: HabitaTipografia.cifra,
          ),
          Text(
            cuenta['alDia'] == true
                ? 'Tu cuenta está al día.'
                : 'Incluye deuda anterior e intereses calculados al consultar.',
          ),
          TextButton(onPressed: onTap, child: const Text('Ver mi cuenta')),
        ],
      ),
    ),
  );
}

class ExpensasScreen extends StatelessWidget {
  const ExpensasScreen({
    super.key,
    required this.complejoId,
    required this.unidadId,
  });
  final String complejoId;
  final String unidadId;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Mis expensas')),
    body: CuentaExpensas(
      complejoId: complejoId,
      unidadId: unidadId,
      builder: (cuenta, actualizar) => RefreshIndicator(
        onRefresh: actualizar,
        child: ListView(
          padding: const EdgeInsets.all(18),
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            HabitaCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Saldo total pendiente',
                    style: HabitaTipografia.etiqueta,
                  ),
                  Text(
                    pesos(cuenta['totalAdeudado'] as num? ?? 0),
                    style: HabitaTipografia.cifra,
                  ),
                  Text(
                    'Capital: ${pesos(cuenta['saldoPendiente'] as num? ?? 0)}',
                  ),
                  Text(
                    'Intereses: ${pesos(cuenta['interesesAcumulados'] as num? ?? 0)}',
                  ),
                  Text(
                    'Saldo a favor: ${pesos(cuenta['saldoAFavor'] as num? ?? 0)}',
                  ),
                  const SizedBox(height: 12),
                  if (cuenta['alDia'] != true)
                    PagoExpensas(
                      crearPreferencia: () => HabitaApi().post(
                        '/complejos/$complejoId/expensas/pagar',
                      ),
                      pagarDemo: (id) async {
                        await HabitaApi().post(
                          '/complejos/$complejoId/expensas/pagos/simular',
                          {'pagoId': id},
                        );
                      },
                      confirmarDemo: confirmarPagoDemo,
                      actualizar: actualizar,
                    )
                  else
                    const Text('Tu cuenta está al día.'),
                  TextButton(
                    onPressed: actualizar,
                    child: const Text('Actualizar cuenta'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            const Text('Liquidaciones', style: HabitaTipografia.titulo3),
            const Text(
              'El saldo pendiente se actualiza con los pagos. El importe original es histórico.',
            ),
            for (final l
                in (cuenta['liquidaciones'] as List? ?? []).whereType<Map>())
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: HabitaCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${l['etiqueta']}',
                        style: HabitaTipografia.etiqueta,
                      ),
                      EstadoChip(
                        l['pagado'] == true ? 'Pagada' : 'Pendiente',
                        tipo: l['pagado'] == true ? 'exito' : 'aviso',
                      ),
                      Text(
                        'Pendiente: ${pesos(l['saldoPendiente'] as num? ?? 0)}',
                        style: HabitaTipografia.cifraChica,
                      ),
                      Text(
                        'Importe original: ${pesos(l['totalAPagar'] as num? ?? 0)}',
                      ),
                      Text(
                        'Intereses actuales: ${pesos(l['interesesPendientes'] as num? ?? 0)}',
                      ),
                      ExpansionTile(
                        tilePadding: EdgeInsets.zero,
                        title: const Text('¿Qué incluye esta expensa?'),
                        children: [
                          Text(
                            'Ordinarios: ${pesos(l['montoOrdinario'] as num? ?? 0)}',
                          ),
                          Text(
                            'Extraordinarios: ${pesos(l['montoExtraordinario'] as num? ?? 0)}',
                          ),
                          Text(
                            'Fondo de reserva: ${pesos(l['fondoReserva'] as num? ?? 0)}',
                          ),
                          Text(
                            'Crédito aplicado: ${pesos(l['creditoAplicado'] as num? ?? 0)}',
                          ),
                          for (final g in [
                            ...(l['detalleOrdinario'] as List? ?? []),
                            ...(l['detalleExtraordinario'] as List? ?? []),
                          ].whereType<Map>())
                            ListTile(
                              title: Text('${g['concepto'] ?? 'Gasto'}'),
                              trailing: Text(
                                pesos(g['montoCentavos'] as num? ?? 0),
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            if ((cuenta['liquidaciones'] as List? ?? []).isEmpty)
              const Text('Todavía no hay liquidaciones publicadas.'),
          ],
        ),
      ),
    ),
  );
}

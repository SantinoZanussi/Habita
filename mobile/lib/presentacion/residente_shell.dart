import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../nucleo/api.dart';
import '../nucleo/tema/tokens.dart';
import 'widgets.dart';
import 'reservas_widgets.dart';
import 'comunidad.dart';
import 'confirmar_pago_demo.dart';

class ResidenteShell extends StatefulWidget {
  const ResidenteShell({
    super.key,
    required this.complejoId,
    required this.unidadId,
  });
  final String complejoId;
  final String unidadId;
  @override
  State<ResidenteShell> createState() => _ResidenteShellState();
}

class _ResidenteShellState extends State<ResidenteShell> {
  int _indice = 0;
  @override
  Widget build(BuildContext context) {
    final pantallas = [
      InicioResidente(
        complejoId: widget.complejoId,
        unidadId: widget.unidadId,
        irA: (i) => setState(() => _indice = i),
      ),
      ExpensasScreen(complejoId: widget.complejoId, unidadId: widget.unidadId),
      AccesosResidenteScreen(
        complejoId: widget.complejoId,
        unidadId: widget.unidadId,
      ),
      MasResidenteScreen(
        complejoId: widget.complejoId,
        unidadId: widget.unidadId,
      ),
    ];
    return Scaffold(
      body: IndexedStack(index: _indice, children: pantallas),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _indice,
        onDestinationSelected: (i) => setState(() => _indice = i),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home_rounded),
            label: 'Inicio',
          ),
          NavigationDestination(
            icon: Icon(Icons.receipt_long_outlined),
            selectedIcon: Icon(Icons.receipt_long_rounded),
            label: 'Expensas',
          ),
          NavigationDestination(
            icon: Icon(Icons.door_front_door_outlined),
            selectedIcon: Icon(Icons.door_front_door_rounded),
            label: 'Accesos',
          ),
          NavigationDestination(
            icon: Icon(Icons.grid_view_outlined),
            selectedIcon: Icon(Icons.grid_view_rounded),
            label: 'Más',
          ),
        ],
      ),
    );
  }
}

class InicioResidente extends StatelessWidget {
  const InicioResidente({
    super.key,
    required this.complejoId,
    required this.unidadId,
    required this.irA,
  });
  final String complejoId;
  final String unidadId;
  final ValueChanged<int> irA;
  @override
  Widget build(
    BuildContext context,
  ) => StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
    stream: FirebaseFirestore.instance.doc('complejos/$complejoId').snapshots(),
    builder: (context, complejoSnap) {
      final complejo = complejoSnap.data?.data() ?? const <String, dynamic>{};
      final nombre =
          FirebaseAuth.instance.currentUser?.displayName?.split(' ').first ??
          'Vecino';
      return CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Container(
              padding: const EdgeInsets.fromLTRB(20, 54, 20, 28),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    Color(0xFF0C2440),
                    Color(0xFF14527A),
                    Color(0xFF168D96),
                  ],
                ),
                borderRadius: BorderRadius.only(
                  bottomLeft: Radius.circular(28),
                  bottomRight: Radius.circular(28),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Hola, $nombre 👋',
                              style: HabitaTipografia.titulo2.copyWith(
                                color: Colors.white,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              complejo['nombre'] as String? ?? 'Tu complejo',
                              style: HabitaTipografia.cuerpoChico.copyWith(
                                color: const Color(0xFFCFE4EE),
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton.filledTonal(
                        tooltip: 'Ver notificaciones',
                        onPressed: () => Navigator.push(
                          context,
                          MaterialPageRoute<void>(
                            builder: (_) => _NotificacionesPantalla(
                              complejoId: complejoId,
                              unidadId: unidadId,
                            ),
                          ),
                        ),
                        icon: const Icon(Icons.notifications_none_rounded),
                        style: IconButton.styleFrom(
                          backgroundColor: Colors.white.withValues(alpha: .12),
                          foregroundColor: Colors.white,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 22),
                  _ProximoVencimiento(
                    complejoId: complejoId,
                    unidadId: unidadId,
                    onTap: () => irA(1),
                  ),
                ],
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(18, 22, 18, 30),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                const Text('Accesos rápidos', style: HabitaTipografia.titulo3),
                const SizedBox(height: 14),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _Accion(
                      icono: Icons.door_front_door_outlined,
                      texto: 'Abrir puerta',
                      onTap: () => irA(2),
                    ),
                    _Accion(
                      icono: Icons.calendar_month_outlined,
                      texto: 'Reservas',
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => AmenitiesScreen(
                            complejoId: complejoId,
                            unidadId: unidadId,
                          ),
                        ),
                      ),
                    ),
                    _Accion(
                      icono: Icons.person_add_alt_outlined,
                      texto: 'Visitas',
                      onTap: () => irA(2),
                    ),
                    _Accion(
                      icono: Icons.campaign_outlined,
                      texto: 'Reclamos',
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => ReclamosResidenteScreen(
                            complejoId: complejoId,
                            unidadId: unidadId,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 26),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Novedades', style: HabitaTipografia.titulo3),
                    TextButton(
                      onPressed: () => Navigator.push(
                        context,
                        MaterialPageRoute<void>(
                          builder: (_) => _NotificacionesPantalla(
                            complejoId: complejoId,
                            unidadId: unidadId,
                          ),
                        ),
                      ),
                      child: const Text('Ver todas'),
                    ),
                  ],
                ),
                _Novedades(complejoId: complejoId, unidadId: unidadId),
                if (complejo['modulosActivos']?['obras'] == true) ...[
                  const SizedBox(height: 24),
                  const Text(
                    'Obras del complejo',
                    style: HabitaTipografia.titulo3,
                  ),
                  const SizedBox(height: 12),
                  _ObraResumen(complejoId: complejoId),
                ],
              ]),
            ),
          ),
        ],
      );
    },
  );
}

class _ProximoVencimiento extends StatelessWidget {
  const _ProximoVencimiento({
    required this.complejoId,
    required this.unidadId,
    required this.onTap,
  });
  final String complejoId;
  final String unidadId;
  final VoidCallback onTap;
  @override
  Widget build(
    BuildContext context,
  ) => StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
    stream: FirebaseFirestore.instance
        .collection('complejos/$complejoId/periodos')
        .where('estado', isEqualTo: 'cerrado')
        .snapshots(),
    builder: (context, periodos) {
      if (!periodos.hasData || periodos.data!.docs.isEmpty) {
        return const HabitaCard(
          child: Text('Todavía no hay una expensa publicada.'),
        );
      }
      final documentos = [...periodos.data!.docs]
        ..sort((a, b) => b.id.compareTo(a.id));
      final periodo = documentos.first;
      return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
        stream: periodo.reference
            .collection('detalle')
            .doc(unidadId)
            .snapshots(),
        builder: (context, detalle) {
          final datos = detalle.data?.data();
          return HabitaCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Próximo vencimiento',
                  style: HabitaTipografia.etiqueta,
                ),
                const SizedBox(height: 12),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Expensa ${periodo.data()['etiqueta'] ?? periodo.id}',
                            style: HabitaTipografia.cuerpoChico,
                          ),
                          const SizedBox(height: 4),
                          Text(
                            pesos(datos?['saldoPendiente'] as num? ?? 0),
                            style: HabitaTipografia.cifra,
                          ),
                        ],
                      ),
                    ),
                    FilledButton(
                      onPressed: datos == null || datos['pagado'] == true
                          ? null
                          : onTap,
                      child: Text(
                        datos?['pagado'] == true ? 'Pagada' : 'Pagar',
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 9),
                Text(
                  datos?['pagado'] == true
                      ? 'Tu cuenta está al día.'
                      : 'Vence el ${_fecha(periodo.data()['vencimiento'])}',
                  style: HabitaTipografia.micro.copyWith(
                    color: HabitaColores.textoSuave,
                  ),
                ),
              ],
            ),
          );
        },
      );
    },
  );
}

class _Accion extends StatelessWidget {
  const _Accion({
    required this.icono,
    required this.texto,
    required this.onTap,
  });
  final IconData icono;
  final String texto;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    borderRadius: BorderRadius.circular(14),
    child: SizedBox(
      width: 74,
      child: Column(
        children: [
          Container(
            width: 54,
            height: 54,
            decoration: BoxDecoration(
              color: HabitaColores.superficie,
              border: Border.all(color: HabitaColores.borde),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icono, color: HabitaColores.marcaActivo),
          ),
          const SizedBox(height: 8),
          Text(
            texto,
            style: HabitaTipografia.micro,
            textAlign: TextAlign.center,
          ),
        ],
      ),
    ),
  );
}

Query<Map<String, dynamic>> avisosResidente(
  String complejoId,
  String unidadId, {
  FirebaseFirestore? firestore,
}) => (firestore ?? FirebaseFirestore.instance)
    .collection('complejos/$complejoId/notificaciones')
    .where(
      Filter.or(
        Filter('destinatarios', isEqualTo: 'todos'),
        Filter('destinatarios', arrayContains: unidadId),
      ),
    )
    .orderBy('enviadaEn', descending: true);

class _Novedades extends StatelessWidget {
  const _Novedades({required this.complejoId, required this.unidadId});
  final String complejoId;
  final String unidadId;
  @override
  Widget build(BuildContext context) =>
      StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
        stream: avisosResidente(complejoId, unidadId).limit(3).snapshots(),
        builder: (context, snap) {
          if (snap.hasError) {
            return const ErrorCarga(
              mensaje: 'No pudimos cargar las novedades.',
            );
          }
          if (!snap.hasData) return const LinearProgressIndicator();
          if (snap.data!.docs.isEmpty) {
            return const HabitaCard(
              child: Text('Todavía no hay novedades para tu unidad.'),
            );
          }
          return Column(
            children: snap.data!.docs
                .map(
                  (d) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: HabitaCard(
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 36,
                            height: 36,
                            decoration: BoxDecoration(
                              color: HabitaColores.estadoAvisoFondo,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(
                              Icons.notifications_active_outlined,
                              color: HabitaColores.estadoAviso,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  d.data()['titulo'] as String? ?? '',
                                  style: HabitaTipografia.etiqueta,
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  d.data()['cuerpo'] as String? ?? '',
                                  style: HabitaTipografia.cuerpoChico.copyWith(
                                    color: HabitaColores.textoSuave,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                )
                .toList(),
          );
        },
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
    body: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .collection('complejos/$complejoId/periodos')
          .where('estado', isEqualTo: 'cerrado')
          .snapshots(),
      builder: (context, snap) {
        if (snap.hasError) {
          return const ErrorCarga(mensaje: 'No pudimos cargar tu cuenta.');
        }
        if (!snap.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snap.data!.docs.isEmpty) {
          return const ErrorCarga(
            mensaje: 'Todavía no hay liquidaciones publicadas.',
          );
        }
        final documentos = [...snap.data!.docs]
          ..sort((a, b) => b.id.compareTo(a.id));
        return ListView(
          padding: const EdgeInsets.all(18),
          children: [
            ...documentos
                .take(12)
                .toList()
                .asMap()
                .entries
                .map(
                  (entrada) => _LiquidacionCard(
                    periodo: entrada.value,
                    unidadId: unidadId,
                    complejoId: complejoId,
                    destacada: entrada.key == 0,
                  ),
                ),
          ],
        );
      },
    ),
  );
}

class _LiquidacionCard extends StatelessWidget {
  const _LiquidacionCard({
    required this.periodo,
    required this.unidadId,
    required this.complejoId,
    required this.destacada,
  });
  final QueryDocumentSnapshot<Map<String, dynamic>> periodo;
  final String unidadId;
  final String complejoId;
  final bool destacada;
  @override
  Widget build(
    BuildContext context,
  ) => StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
    stream: periodo.reference.collection('detalle').doc(unidadId).snapshots(),
    builder: (context, snap) {
      final d = snap.data?.data();
      if (d == null) return const SizedBox.shrink();
      return Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: HabitaCard(
          color: destacada ? HabitaColores.superficieSuave : null,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      periodo.data()['etiqueta'] as String? ?? periodo.id,
                      style: destacada
                          ? HabitaTipografia.titulo3
                          : HabitaTipografia.etiqueta,
                    ),
                  ),
                  EstadoChip(
                    d['pagado'] == true ? 'Pagada' : 'Pendiente',
                    tipo: d['pagado'] == true ? 'exito' : 'aviso',
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Text(
                pesos(d['totalAPagar'] as num? ?? 0),
                style: destacada
                    ? HabitaTipografia.cifra
                    : HabitaTipografia.cifraChica,
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Ordinario ${pesos(d['montoOrdinario'] as num? ?? 0)}',
                      style: HabitaTipografia.micro,
                    ),
                  ),
                  Text(
                    'Extraordinario ${pesos(d['montoExtraordinario'] as num? ?? 0)}',
                    style: HabitaTipografia.micro,
                  ),
                ],
              ),
              if (destacada && d['pagado'] != true) ...[
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: () => _pagar(context, periodo.id),
                    child: const Text('Pagar con Mercado Pago'),
                  ),
                ),
              ],
              ExpansionTile(
                tilePadding: EdgeInsets.zero,
                title: const Text('¿Qué incluye esta expensa?'),
                children: [
                  const Text(
                    'Gastos totales del complejo en este período. Tu parte es la indicada arriba.',
                  ),
                  ...['gastosOrdinarios', 'gastosExtraordinarios'].expand(
                    (tipo) => (periodo.data()[tipo] as List? ?? [])
                        .whereType<Map>()
                        .map(
                          (g) => ListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Text('${g['concepto'] ?? 'Gasto'}'),
                            subtitle: Text(
                              tipo == 'gastosOrdinarios'
                                  ? 'Ordinario'
                                  : 'Extraordinario',
                            ),
                            trailing: Text(
                              pesos(g['montoCentavos'] as num? ?? 0),
                            ),
                          ),
                        ),
                  ),
                  if ((periodo.data()['gastosOrdinarios'] as List? ?? [])
                          .isEmpty &&
                      (periodo.data()['gastosExtraordinarios'] as List? ?? [])
                          .isEmpty)
                    const Padding(
                      padding: EdgeInsets.all(12),
                      child: Text(
                        'La administración no publicó el desglose de este período.',
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      );
    },
  );

  Future<void> _pagar(BuildContext context, String periodoId) async {
    try {
      final preferencia = await HabitaApi().post(
        '/complejos/$complejoId/expensas/pagar',
        {'periodoId': periodoId},
      );
      if (preferencia['simulado'] == true) {
        if (!context.mounted || !await confirmarPagoDemo(context)) return;
        await HabitaApi().post(
          '/complejos/$complejoId/expensas/pagos/simular',
          {'periodoId': periodoId, 'pagoId': preferencia['preferenciaId']},
        );
        if (context.mounted) {
          mostrarExito(
            context,
            'Pago demo acreditado e imputado correctamente.',
          );
        }
      } else if (context.mounted) {
        showDialog<void>(
          context: context,
          builder: (_) => AlertDialog(
            title: const Text('Continuar con Mercado Pago'),
            content: Text(
              'Abrí este enlace seguro para pagar:\n${preferencia['urlPago']}',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Entendido'),
              ),
            ],
          ),
        );
      }
    } catch (error) {
      if (context.mounted) mostrarError(context, error);
    }
  }
}

class AccesosResidenteScreen extends StatelessWidget {
  const AccesosResidenteScreen({
    super.key,
    required this.complejoId,
    required this.unidadId,
  });
  final String complejoId;
  final String unidadId;
  @override
  Widget build(BuildContext context) => DefaultTabController(
    length: 2,
    child: Scaffold(
      appBar: AppBar(
        title: const Text('Accesos'),
        bottom: const TabBar(
          tabs: [
            Tab(text: 'Abrir puerta'),
            Tab(text: 'Mis visitas'),
          ],
        ),
      ),
      body: TabBarView(
        children: [
          _QrDinamico(complejoId: complejoId),
          _Visitas(complejoId: complejoId, unidadId: unidadId),
        ],
      ),
    ),
  );
}

class _QrDinamico extends StatefulWidget {
  const _QrDinamico({required this.complejoId});
  final String complejoId;
  @override
  State<_QrDinamico> createState() => _QrDinamicoState();
}

class _QrDinamicoState extends State<_QrDinamico> {
  String? codigo;
  int restantes = 60;
  Timer? timer;
  Object? error;
  @override
  void initState() {
    super.initState();
    _cargar();
  }

  Future<void> _cargar() async {
    try {
      final r = await HabitaApi().post(
        '/complejos/${widget.complejoId}/accesos/qr-dinamico',
      );
      final valorCodigo = r['codigo'];
      if (valorCodigo is! String || valorCodigo.isEmpty) {
        throw ErrorApi(
          'El servidor devolvió un código QR inválido. Intentá nuevamente.',
          codigo: 'QR_INVALIDO',
        );
      }
      final valorVencimiento = r['venceEnSegundos'];
      if (!mounted) return;
      setState(() {
        codigo = valorCodigo;
        restantes = valorVencimiento is num ? valorVencimiento.toInt() : 60;
        error = null;
      });
      timer?.cancel();
      timer = Timer.periodic(const Duration(seconds: 1), (_) {
        if (!mounted) return;
        if (restantes <= 1) {
          timer?.cancel();
          _cargar();
        } else {
          setState(() => restantes--);
        }
      });
    } catch (e) {
      if (mounted) setState(() => error = e);
    }
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => SingleChildScrollView(
    padding: const EdgeInsets.all(24),
    child: Column(
      children: [
        const Text(
          'Acercá el QR al lector',
          style: HabitaTipografia.cuerpoChico,
        ),
        const SizedBox(height: 18),
        HabitaCard(
          padding: const EdgeInsets.all(22),
          child: error != null
              ? ErrorCarga(mensaje: error.toString(), reintentar: _cargar)
              : codigo == null
              ? const SizedBox(
                  width: 260,
                  height: 260,
                  child: Center(child: CircularProgressIndicator()),
                )
              : QrImageView(
                  data: codigo!,
                  size: 260,
                  eyeStyle: const QrEyeStyle(
                    color: HabitaColores.azul900,
                    eyeShape: QrEyeShape.square,
                  ),
                  dataModuleStyle: const QrDataModuleStyle(
                    color: HabitaColores.azul900,
                  ),
                ),
        ),
        const SizedBox(height: 15),
        Text(
          'QR dinámico',
          style: HabitaTipografia.etiqueta.copyWith(
            color: HabitaColores.estadoExitoTexto,
          ),
        ),
        Text(
          'Vence en 00:${restantes.toString().padLeft(2, '0')}',
          style: HabitaTipografia.cuerpoChico.copyWith(
            color: HabitaColores.estadoExitoTexto,
          ),
        ),
        const SizedBox(height: 22),
        const Text(
          'El código cambia automáticamente y no contiene datos personales.',
          textAlign: TextAlign.center,
          style: TextStyle(color: HabitaColores.textoSuave),
        ),
      ],
    ),
  );
}

class _Visitas extends StatelessWidget {
  const _Visitas({required this.complejoId, required this.unidadId});
  final String complejoId;
  final String unidadId;
  @override
  Widget build(BuildContext context) => Scaffold(
    floatingActionButton: FloatingActionButton.extended(
      onPressed: () => _nueva(context),
      icon: const Icon(Icons.person_add_alt_1_rounded),
      label: const Text('Autorizar visita'),
    ),
    body: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .collection('complejos/$complejoId/autorizaciones')
          .where('unidadId', isEqualTo: unidadId)
          .snapshots(),
      builder: (context, snap) {
        if (snap.hasError) {
          return const ErrorCarga(mensaje: 'No pudimos cargar tus visitas.');
        }
        if (!snap.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final docs = snap.data!.docs;
        return ListView(
          padding: const EdgeInsets.all(18),
          children: docs.map((d) {
            final datos = d.data();
            final nombreVisita = datos['nombre']?.toString() ?? 'visita';
            final estado = datos['estado']?.toString() ?? 'vigente';
            final codigoQr = datos['codigoQr'];
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: HabitaCard(
                child: Column(
                  children: [
                    Row(
                      children: [
                        CircleAvatar(
                          backgroundColor: HabitaColores.superficieSuave,
                          child: Text(nombreVisita[0]),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                nombreVisita,
                                style: HabitaTipografia.etiqueta,
                              ),
                              Text(
                                'DNI ${datos['documento'] ?? '—'}',
                                style: HabitaTipografia.micro,
                              ),
                              Text(
                                'Vence ${_fecha(datos['vigenciaHasta'])} · ${datos['usosConsumidos']}/${datos['usosPermitidos']} usos',
                                style: HabitaTipografia.micro,
                              ),
                            ],
                          ),
                        ),
                        EstadoChip(
                          estado,
                          tipo: estado == 'vigente' ? 'exito' : 'error',
                        ),
                      ],
                    ),
                    if (codigoQr is String && codigoQr.isNotEmpty)
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton.icon(
                          onPressed: estado == 'vigente'
                              ? () =>
                                    _mostrarQr(context, codigoQr, nombreVisita)
                              : null,
                          icon: const Icon(Icons.qr_code_2_rounded),
                          label: const Text('Mostrar QR para la garita'),
                        ),
                      ),
                  ],
                ),
              ),
            );
          }).toList(),
        );
      },
    ),
  );
  Future<void> _nueva(BuildContext context) async {
    final nombre = TextEditingController();
    final documento = TextEditingController();
    final hasta = DateTime.now().add(const Duration(hours: 6));
    var creando = false;
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setDialogState) => AlertDialog(
          title: const Text('Autorizar visita'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nombre,
                enabled: !creando,
                decoration: const InputDecoration(
                  labelText: 'Nombre y apellido',
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: documento,
                enabled: !creando,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'DNI',
                  hintText: '12345678',
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Al confirmar se genera un QR para que la visita lo presente en la garita.',
                style: TextStyle(color: HabitaColores.textoSuave),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: creando ? null : () => Navigator.pop(dialogContext),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: creando
                  ? null
                  : () async {
                      final nombreTexto = nombre.text.trim();
                      final documentoTexto = documento.text.trim();
                      if (nombreTexto.length < 2 || documentoTexto.length < 6) {
                        mostrarError(
                          dialogContext,
                          ErrorApi(
                            'Completá nombre y DNI válido para continuar.',
                          ),
                        );
                        return;
                      }
                      setDialogState(() => creando = true);
                      try {
                        final resultado = await HabitaApi().post(
                          '/complejos/$complejoId/accesos/autorizaciones',
                          {
                            'nombre': nombreTexto,
                            'documento': documentoTexto,
                            'unidadId': unidadId,
                            'vigenciaDesde': DateTime.now().toIso8601String(),
                            'vigenciaHasta': hasta.toIso8601String(),
                            'usosPermitidos': 2,
                          },
                        );
                        final codigoQr = resultado['codigoQr'];
                        if (codigoQr is! String || codigoQr.isEmpty) {
                          throw ErrorApi(
                            'La autorización se creó, pero no recibimos su QR. Volvé a abrir la lista de visitas para mostrarlo.',
                            codigo: 'QR_INCOMPLETO',
                          );
                        }
                        if (!dialogContext.mounted) return;
                        Navigator.pop(dialogContext);
                        _mostrarQr(context, codigoQr, nombreTexto);
                      } catch (e) {
                        if (!dialogContext.mounted) return;
                        setDialogState(() => creando = false);
                        mostrarError(dialogContext, e);
                      }
                    },
              child: creando
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Crear autorización'),
            ),
          ],
        ),
      ),
    );
    nombre.dispose();
    documento.dispose();
  }

  void _mostrarQr(BuildContext context, String codigo, String nombre) =>
      showDialog<void>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text('Visita de $nombre'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              QrImageView(data: codigo, size: 230),
              const SizedBox(height: 12),
              const Text(
                'Mostrá este QR en la cámara del guardia.',
                textAlign: TextAlign.center,
                style: TextStyle(color: HabitaColores.textoSuave),
              ),
            ],
          ),
          actions: [
            FilledButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Listo'),
            ),
          ],
        ),
      );
}

class MasResidenteScreen extends StatelessWidget {
  const MasResidenteScreen({
    super.key,
    required this.complejoId,
    required this.unidadId,
  });
  final String complejoId;
  final String unidadId;
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Más')),
    body: ListView(
      padding: const EdgeInsets.all(18),
      children: [
        const Padding(
          padding: EdgeInsets.only(bottom: 18),
          child: Text('Tu vida en comunidad', style: HabitaTipografia.titulo2),
        ),
        _Menu(
          icono: Icons.home_work_outlined,
          titulo: 'Mi unidad',
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute<void>(
              builder: (_) =>
                  MiUnidadScreen(complejoId: complejoId, unidadId: unidadId),
            ),
          ),
        ),
        _Menu(
          icono: Icons.payments_outlined,
          titulo: 'Mis pagos',
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute<void>(
              builder: (_) =>
                  MisPagosScreen(complejoId: complejoId, unidadId: unidadId),
            ),
          ),
        ),
        _Menu(
          icono: Icons.calendar_month_outlined,
          titulo: 'Reservar amenities',
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) =>
                  AmenitiesScreen(complejoId: complejoId, unidadId: unidadId),
            ),
          ),
        ),
        _Menu(
          icono: Icons.campaign_outlined,
          titulo: 'Mis reclamos',
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => ReclamosResidenteScreen(
                complejoId: complejoId,
                unidadId: unidadId,
              ),
            ),
          ),
        ),
        _Menu(
          icono: Icons.construction_outlined,
          titulo: 'Obras del complejo',
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute<void>(
              builder: (_) => ObrasComunidadScreen(complejoId: complejoId),
            ),
          ),
        ),
        _Menu(
          icono: Icons.notifications_outlined,
          titulo: 'Notificaciones',
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => _NotificacionesPantalla(
                complejoId: complejoId,
                unidadId: unidadId,
              ),
            ),
          ),
        ),
        _Menu(
          icono: Icons.help_outline_rounded,
          titulo: 'Ayuda y soporte',
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute<void>(
              builder: (_) => AyudaComunidadScreen(
                crearReclamo: () => Navigator.push(
                  context,
                  MaterialPageRoute<void>(
                    builder: (_) => NuevoReclamoScreen(complejoId: complejoId),
                  ),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 20),
        OutlinedButton.icon(
          onPressed: FirebaseAuth.instance.signOut,
          icon: const Icon(Icons.logout_rounded),
          label: const Text('Cerrar sesión'),
        ),
      ],
    ),
  );
}

class _Menu extends StatelessWidget {
  const _Menu({required this.icono, required this.titulo, required this.onTap});
  final IconData icono;
  final String titulo;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: HabitaCard(
      padding: EdgeInsets.zero,
      child: ListTile(
        leading: Icon(icono, color: HabitaColores.marcaActivo),
        title: Text(titulo),
        trailing: const Icon(Icons.chevron_right_rounded),
        onTap: onTap,
      ),
    ),
  );
}

class AmenitiesScreen extends StatefulWidget {
  const AmenitiesScreen({
    super.key,
    required this.complejoId,
    required this.unidadId,
    this.firestore,
    this.api,
  });
  final String complejoId;
  final String unidadId;
  final FirebaseFirestore? firestore;
  final HabitaApi? api;
  @override
  State<AmenitiesScreen> createState() => _AmenitiesScreenState();
}

class _AmenitiesScreenState extends State<AmenitiesScreen> {
  late DateTime _desde = DateUtils.dateOnly(
    DateTime.now(),
  ).add(const Duration(days: 1, hours: 10));
  int _horas = 2;
  int _asistentes = 1;
  bool _operando = false;
  bool _misReservas = false;
  String get complejoId => widget.complejoId;
  String get unidadId => widget.unidadId;
  FirebaseFirestore get _firestore =>
      widget.firestore ?? FirebaseFirestore.instance;
  HabitaApi get _api => widget.api ?? HabitaApi();

  Future<void> _elegirHorario() async {
    final hoy = DateUtils.dateOnly(DateTime.now());
    final fecha = await showDatePicker(
      context: context,
      initialDate: _desde.isBefore(hoy) ? hoy : _desde,
      firstDate: hoy,
      lastDate: hoy.add(const Duration(days: 365)),
    );
    if (fecha == null || !mounted) return;
    final hora = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_desde),
    );
    if (hora == null || !mounted) return;
    setState(
      () => _desde = DateTime(
        fecha.year,
        fecha.month,
        fecha.day,
        hora.hour,
        hora.minute,
      ),
    );
  }

  Future<void> _cancelar(String reservaId) async {
    if (_operando) return;
    final confirmar = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('¿Cancelar esta reserva?'),
        content: const Text('Se liberarán los lugares para otros vecinos.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Volver'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Cancelar reserva'),
          ),
        ],
      ),
    );
    if (confirmar != true || !mounted || _operando) return;
    setState(() => _operando = true);
    try {
      await _api.delete('/complejos/$complejoId/amenities/reservas/$reservaId');
      if (mounted) mostrarExito(context, 'Reserva cancelada.');
    } catch (error) {
      if (mounted) mostrarError(context, error);
    } finally {
      if (mounted) setState(() => _operando = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Reservas')),
    body: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: _firestore
          .collection('complejos/$complejoId/amenities')
          .snapshots(),
      builder: (context, snap) {
        if (snap.hasError) {
          return const ErrorCarga(mensaje: 'No pudimos cargar los amenities.');
        }
        if (!snap.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
          stream: _firestore
              .collection('complejos/$complejoId/reservas')
              .snapshots(),
          builder: (context, reservasSnap) {
            if (reservasSnap.hasError) {
              return const ErrorCarga(
                mensaje: 'No pudimos cargar la disponibilidad.',
              );
            }
            if (!reservasSnap.hasData) {
              return const Center(child: CircularProgressIndicator());
            }
            final desde = _desde;
            final hasta = desde.add(Duration(hours: _horas));
            final propias =
                reservasSnap.data!.docs
                    .where((r) => r.data()['unidadId'] == unidadId)
                    .toList()
                  ..sort(
                    (a, b) => (_fechaHora(b.data()['desde']) ?? DateTime(0))
                        .compareTo(
                          _fechaHora(a.data()['desde']) ?? DateTime(0),
                        ),
                  );
            return ListView(
              padding: const EdgeInsets.all(18),
              children: [
                Container(
                  padding: const EdgeInsets.all(22),
                  margin: const EdgeInsets.only(bottom: 18),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0C344B),
                    borderRadius: BorderRadius.circular(22),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(
                        Icons.spa_outlined,
                        color: Color(0xFF80DFD2),
                        size: 32,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'Disfrutá tu complejo',
                        style: HabitaTipografia.titulo2.copyWith(
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'Un lugar para entrenar, compartir y desconectar.',
                        style: TextStyle(color: Color(0xFFD5EBEE)),
                      ),
                    ],
                  ),
                ),
                SegmentedButton<bool>(
                  segments: const [
                    ButtonSegment(
                      value: false,
                      label: Text('Explorar'),
                      icon: Icon(Icons.grid_view_rounded),
                    ),
                    ButtonSegment(
                      value: true,
                      label: Text('Mis reservas'),
                      icon: Icon(Icons.event_note_rounded),
                    ),
                  ],
                  selected: {_misReservas},
                  onSelectionChanged: (v) =>
                      setState(() => _misReservas = v.single),
                ),
                const SizedBox(height: 18),
                if (!_misReservas) ...[
                  Card(
                    child: ExpansionTile(
                      title: const Text('Cuándo y cuántos'),
                      subtitle: Text(
                        '${DateFormat('dd/MM · HH:mm').format(desde)} · $_horas h · $_asistentes personas',
                      ),
                      leading: const Icon(Icons.tune_rounded),
                      children: [
                        SelectorReserva(
                          desde: desde,
                          horas: _horas,
                          asistentes: _asistentes,
                          ocupado: _operando,
                          elegirFecha: _elegirHorario,
                          cambiarDia: (v) => setState(() => _desde = v),
                          cambiarHoras: (v) => setState(() => _horas = v),
                          cambiarAsistentes: (v) =>
                              setState(() => _asistentes = v),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'Encontrá tu espacio',
                    style: HabitaTipografia.titulo3,
                  ),
                  const SizedBox(height: 12),
                  if (snap.data!.docs.isEmpty)
                    const HabitaCard(
                      child: Text('Todavía no hay espacios publicados.'),
                    ),
                  ...snap.data!.docs.map(
                    (d) => _AmenityCard(
                      amenity: d,
                      reservas: reservasSnap.data!.docs
                          .where(
                            (r) => [
                              'pendiente',
                              'confirmada',
                            ].contains(r.data()['estado']),
                          )
                          .toList(),
                      unidadId: unidadId,
                      desde: desde,
                      hasta: hasta,
                      asistentes: _asistentes,
                      operando: _operando,
                      onReservar: () =>
                          _reservar(context, d, desde: desde, hasta: hasta),
                    ),
                  ),
                ] else ...[
                  if (propias.isEmpty)
                    const HabitaCard(
                      child: Text(
                        'Todavía no tenés reservas. Explorá los espacios y armá tu próximo plan.',
                      ),
                    ),
                  ...propias.map((r) {
                    final d = r.data();
                    final espacios = snap.data!.docs.where(
                      (a) => a.id == d['amenityId'],
                    );
                    final nombre = espacios.isEmpty
                        ? d['amenityNombre']?.toString() ?? 'Espacio reservado'
                        : espacios.first.data()['nombre']?.toString() ??
                              'Espacio reservado';
                    final inicio = _fechaHora(d['desde']);
                    final fin = _fechaHora(d['hasta']);
                    final cancelable =
                        ['pendiente', 'confirmada'].contains(d['estado']) &&
                        (inicio?.isAfter(DateTime.now()) ?? false);
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: HabitaCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Icon(
                                  iconoEspacio(nombre),
                                  color: HabitaColores.marcaActivo,
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    nombre,
                                    style: HabitaTipografia.titulo3,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Text(
                              inicio == null
                                  ? 'Fecha no disponible'
                                  : DateFormat(
                                      'dd/MM/yyyy · HH:mm',
                                    ).format(inicio),
                            ),
                            Text(
                              'Hasta ${fin == null ? '—' : DateFormat('dd/MM HH:mm').format(fin)} · ${d['asistentes'] ?? 1} asistentes',
                            ),
                            const SizedBox(height: 10),
                            EstadoChip(
                              _estado(d['estado']),
                              tipo: d['estado'] == 'confirmada'
                                  ? 'exito'
                                  : 'info',
                            ),
                            if (cancelable)
                              TextButton(
                                onPressed: _operando
                                    ? null
                                    : () => _cancelar(r.id),
                                child: const Text('Cancelar reserva'),
                              ),
                          ],
                        ),
                      ),
                    );
                  }),
                ],
              ],
            );
          },
        );
      },
    ),
  );
  Future<void> _reservar(
    BuildContext context,
    QueryDocumentSnapshot<Map<String, dynamic>> amenity, {
    required DateTime desde,
    required DateTime hasta,
  }) async {
    if (_operando) return;
    if (!desde.isAfter(DateTime.now())) {
      mostrarError(context, 'Elegí una fecha y hora futuras.');
      return;
    }
    setState(() => _operando = true);
    try {
      final respuesta = await _api
          .post('/complejos/$complejoId/amenities/${amenity.id}/reservas', {
            'unidadId': unidadId,
            'desde': desde.toUtc().toIso8601String(),
            'hasta': hasta.toUtc().toIso8601String(),
            'asistentes': _asistentes,
          });
      if (context.mounted) {
        mostrarExito(
          context,
          respuesta['estado'] == 'pendiente'
              ? 'Solicitud enviada. Esperá la aprobación de la administración.'
              : 'Reserva confirmada.',
        );
      }
    } catch (e) {
      if (context.mounted) mostrarError(context, e);
    } finally {
      if (mounted) setState(() => _operando = false);
    }
  }
}

class _AmenityCard extends StatelessWidget {
  const _AmenityCard({
    required this.amenity,
    required this.reservas,
    required this.unidadId,
    required this.desde,
    required this.hasta,
    required this.onReservar,
    required this.asistentes,
    required this.operando,
  });
  final QueryDocumentSnapshot<Map<String, dynamic>> amenity;
  final List<QueryDocumentSnapshot<Map<String, dynamic>>> reservas;
  final String unidadId;
  final DateTime desde;
  final DateTime hasta;
  final VoidCallback onReservar;
  final int asistentes;
  final bool operando;

  @override
  Widget build(BuildContext context) {
    final datos = amenity.data();
    final capacidad = _entero(datos['capacidad']);
    final superpuestas = reservas.where((documento) {
      final reserva = documento.data();
      if (reserva['amenityId'] != amenity.id) return false;
      final reservaDesde = _fechaHora(reserva['desde']);
      final reservaHasta = _fechaHora(reserva['hasta']);
      return reservaDesde != null &&
          reservaHasta != null &&
          reservaDesde.isBefore(hasta) &&
          reservaHasta.isAfter(desde);
    }).toList();
    final ocupacion = superpuestas.fold<int>(0, (suma, documento) {
      final cantidad = _entero(documento.data()['asistentes']);
      return suma + (cantidad > 0 ? cantidad : 1);
    });
    final disponibles = capacidad > ocupacion ? capacidad - ocupacion : 0;
    final propia = superpuestas.any(
      (documento) => documento.data()['unidadId'] == unidadId,
    );
    return TarjetaEspacio(
      nombre: datos['nombre']?.toString() ?? 'Espacio común',
      descripcion: datos['descripcion']?.toString() ?? '',
      capacidad: capacidad,
      disponibles: disponibles,
      asistentes: asistentes,
      propia: propia,
      activo: datos['activo'] != false,
      aprobacion: datos['requiereAprobacion'] == true,
      ocupado: operando,
      reservar: onReservar,
    );
  }
}

DateTime? _fechaHora(dynamic valor) {
  if (valor is Timestamp) return valor.toDate();
  if (valor is DateTime) return valor;
  if (valor is String) return DateTime.tryParse(valor);
  return null;
}

int _entero(dynamic valor) =>
    valor is num ? valor.toInt() : int.tryParse('$valor') ?? 0;

class ReclamosResidenteScreen extends StatelessWidget {
  const ReclamosResidenteScreen({
    super.key,
    required this.complejoId,
    required this.unidadId,
  });
  final String complejoId;
  final String unidadId;
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Mis reclamos')),
    floatingActionButton: FloatingActionButton.extended(
      onPressed: () => Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => NuevoReclamoScreen(complejoId: complejoId),
        ),
      ),
      icon: const Icon(Icons.add_a_photo_outlined),
      label: const Text('Nuevo reclamo'),
    ),
    body: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .collection('complejos/$complejoId/reclamos')
          .where('unidadId', isEqualTo: unidadId)
          .snapshots(),
      builder: (context, snap) {
        if (snap.hasError) {
          return const ErrorCarga(mensaje: 'No pudimos cargar tus reclamos.');
        }
        if (!snap.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        return ListView(
          padding: const EdgeInsets.all(18),
          children: snap.data!.docs
              .map(
                (d) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: HabitaCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                '#${d.data()['numero'] ?? d.id.substring(0, 6)}',
                                style: HabitaTipografia.etiqueta,
                              ),
                            ),
                            EstadoChip(
                              _estado(d.data()['estado']),
                              tipo: d.data()['estado'] == 'resuelto'
                                  ? 'exito'
                                  : 'aviso',
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Text(d.data()['descripcion'] as String? ?? ''),
                        const SizedBox(height: 8),
                        Text(
                          '${_estado(d.data()['clasificacionFinal']?['area'])} · ${d.data()['clasificacionIA']?['confianza'] ?? 0}% de confianza',
                          style: HabitaTipografia.micro.copyWith(
                            color: HabitaColores.textoSuave,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              )
              .toList(),
        );
      },
    ),
  );
}

class NuevoReclamoScreen extends StatefulWidget {
  const NuevoReclamoScreen({super.key, required this.complejoId});
  final String complejoId;
  @override
  State<NuevoReclamoScreen> createState() => _NuevoReclamoScreenState();
}

class _NuevoReclamoScreenState extends State<NuevoReclamoScreen> {
  static const almacenamientoActivo = bool.fromEnvironment(
    'ENABLE_STORAGE_UPLOADS',
    defaultValue: true,
  );
  final descripcion = TextEditingController();
  XFile? foto;
  bool cargando = false;
  Future<void> _enviar() async {
    if (cargando) return;
    if (descripcion.text.trim().length < 10) {
      mostrarError(context, 'Describí el problema con al menos 10 caracteres.');
      return;
    }
    setState(() => cargando = true);
    try {
      String? fotoUrl;
      if (almacenamientoActivo && foto != null) {
        final bytes = await foto!.readAsBytes();
        final uid = FirebaseAuth.instance.currentUser!.uid;
        final ruta =
            'complejos/${widget.complejoId}/reclamos/$uid/${DateTime.now().microsecondsSinceEpoch}.jpg';
        final ref = FirebaseStorage.instance.ref(ruta);
        await ref.putData(bytes, SettableMetadata(contentType: 'image/jpeg'));
        fotoUrl = await ref.getDownloadURL();
      }
      await HabitaApi().post('/complejos/${widget.complejoId}/reclamos', {
        'descripcion': descripcion.text.trim(),
        'fotoUrl': fotoUrl,
      });
      if (mounted) {
        mostrarExito(context, 'Reclamo enviado y clasificado.');
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) mostrarError(context, e);
    } finally {
      if (mounted) setState(() => cargando = false);
    }
  }

  @override
  void dispose() {
    descripcion.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Nuevo reclamo')),
    body: ListView(
      padding: const EdgeInsets.all(18),
      children: [
        TextField(
          controller: descripcion,
          maxLines: 6,
          maxLength: 1000,
          decoration: const InputDecoration(
            labelText: '¿Qué pasó?',
            hintText:
                'Ej.: Hay una pérdida de agua debajo de la pileta de la cocina…',
            alignLabelWithHint: true,
          ),
        ),
        const SizedBox(height: 14),
        if (almacenamientoActivo)
          OutlinedButton.icon(
            onPressed: () async {
              final elegida = await ImagePicker().pickImage(
                source: ImageSource.camera,
                imageQuality: 78,
              );
              if (mounted) setState(() => foto = elegida);
            },
            icon: const Icon(Icons.camera_alt_outlined),
            label: Text(
              foto == null ? 'Agregar foto' : 'Foto lista para enviar',
            ),
          )
        else
          const Text(
            'Las fotos están desactivadas en la versión gratuita del TP.',
            style: TextStyle(color: Color(0xFF64748B)),
          ),
        const SizedBox(height: 20),
        FilledButton(
          onPressed: cargando ? null : _enviar,
          child: cargando
              ? const CircularProgressIndicator()
              : const Text('Enviar reclamo'),
        ),
      ],
    ),
  );
}

class _ObraResumen extends StatelessWidget {
  const _ObraResumen({required this.complejoId});
  final String complejoId;
  @override
  Widget build(BuildContext context) =>
      StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
        stream: FirebaseFirestore.instance
            .collection('complejos/$complejoId/obras')
            .where('tipo', isEqualTo: 'comun')
            .limit(1)
            .snapshots(),
        builder: (context, snap) {
          if (!snap.hasData || snap.data!.docs.isEmpty) {
            return const SizedBox.shrink();
          }
          final o = snap.data!.docs.first.data();
          final avance = (o['avanceFisicoPorcentaje'] as num? ?? 0).toDouble();
          return HabitaCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        o['nombre'] as String? ?? '',
                        style: HabitaTipografia.etiqueta,
                      ),
                    ),
                    EstadoChip('${avance.toStringAsFixed(0)}%', tipo: 'info'),
                  ],
                ),
                const SizedBox(height: 12),
                LinearProgressIndicator(
                  value: avance / 100,
                  minHeight: 8,
                  borderRadius: BorderRadius.circular(99),
                ),
                const SizedBox(height: 9),
                Text(
                  'Fecha estimada: ${_fecha(o['fechaFinEstimada'])}',
                  style: HabitaTipografia.micro,
                ),
              ],
            ),
          );
        },
      );
}

String _fecha(dynamic valor) {
  final fecha = valor is Timestamp
      ? valor.toDate()
      : valor is String
      ? DateTime.tryParse(valor)
      : null;
  return fecha == null
      ? '—'
      : '${fecha.day.toString().padLeft(2, '0')}/${fecha.month.toString().padLeft(2, '0')}/${fecha.year}';
}

String _estado(dynamic valor) =>
    (valor?.toString() ?? '—').replaceAll('_', ' ');

class _NotificacionesPantalla extends StatelessWidget {
  const _NotificacionesPantalla({
    required this.complejoId,
    required this.unidadId,
  });
  final String complejoId;
  final String unidadId;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Historial de notificaciones')),
    body: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: avisosResidente(complejoId, unidadId).snapshots(),
      builder: (context, snap) {
        if (snap.hasError) {
          return const ErrorCarga(
            mensaje: 'No pudimos cargar las notificaciones.',
          );
        }
        if (!snap.hasData) {
          return const Center(child: CircularProgressIndicator());
        }

        final docs = snap.data!.docs;
        if (docs.isEmpty) {
          return const Center(child: Text('No hay notificaciones recientes.'));
        }

        return ListView.separated(
          padding: const EdgeInsets.all(18),
          itemCount: docs.length,
          separatorBuilder: (context, index) => const SizedBox(height: 10),
          itemBuilder: (context, i) {
            final d = docs[i].data();
            return HabitaCard(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE8F2FB),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      Icons.notifications_active_rounded,
                      color: HabitaColores.marcaActivo,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          d['titulo']?.toString() ?? 'Notificación',
                          style: HabitaTipografia.etiqueta,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          d['cuerpo']?.toString() ?? '',
                          style: HabitaTipografia.micro,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          d['enviadaEn'] != null
                              ? (d['enviadaEn'] as Timestamp)
                                    .toDate()
                                    .toString()
                                    .split('.')[0]
                              : '',
                          style: HabitaTipografia.micro.copyWith(
                            color: Colors.black54,
                            fontSize: 10,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    ),
  );
}

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../nucleo/api.dart';
import '../nucleo/tema/tokens.dart';
import 'widgets.dart';

class GuardiaShell extends StatefulWidget {
  const GuardiaShell({super.key, required this.complejoId});
  final String complejoId;
  @override
  State<GuardiaShell> createState() => _GuardiaShellState();
}

class _GuardiaShellState extends State<GuardiaShell> {
  int indice = 0;
  @override
  Widget build(BuildContext context) => Scaffold(
    body: IndexedStack(
      index: indice,
      children: [
        EscanerGuardia(complejoId: widget.complejoId),
        HistorialGuardia(complejoId: widget.complejoId),
      ],
    ),
    bottomNavigationBar: NavigationBar(
      selectedIndex: indice,
      onDestinationSelected: (i) => setState(() => indice = i),
      destinations: const [
        NavigationDestination(
          icon: Icon(Icons.qr_code_scanner_rounded),
          label: 'Escanear',
        ),
        NavigationDestination(
          icon: Icon(Icons.history_rounded),
          label: 'Historial',
        ),
      ],
    ),
  );
}

class EscanerGuardia extends StatefulWidget {
  const EscanerGuardia({super.key, required this.complejoId});
  final String complejoId;
  @override
  State<EscanerGuardia> createState() => _EscanerGuardiaState();
}

class _EscanerGuardiaState extends State<EscanerGuardia> {
  final controlador = MobileScannerController(
    formats: const [BarcodeFormat.qrCode],
  );
  bool procesando = false;

  Future<void> _validar({String? codigo, String? patente}) async {
    if (procesando || (codigo == null && patente == null)) return;
    setState(() => procesando = true);
    try {
      final r = await HabitaApi()
          .post('/complejos/${widget.complejoId}/accesos/validar', {
            'codigo': ?codigo,
            'patente': ?patente,
            'punto': 'torre-principal',
            'sentido': 'ingreso',
          });
      if (mounted) await _resultado(r);
    } catch (e) {
      if (mounted) mostrarError(context, e);
    } finally {
      if (mounted) setState(() => procesando = false);
    }
  }

  Future<void> _resultado(Map<String, dynamic> r) async {
    final permitido = r['permitido'] == true;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        margin: const EdgeInsets.all(12),
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
        ),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 66,
                height: 66,
                decoration: BoxDecoration(
                  color: permitido
                      ? HabitaColores.estadoExitoFondo
                      : HabitaColores.estadoErrorFondo,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  permitido ? Icons.check_rounded : Icons.close_rounded,
                  size: 36,
                  color: permitido
                      ? HabitaColores.estadoExito
                      : HabitaColores.estadoError,
                ),
              ),
              const SizedBox(height: 18),
              Text(
                permitido ? 'Autorización válida' : 'Acceso rechazado',
                style: HabitaTipografia.titulo2,
              ),
              const SizedBox(height: 14),
              if (permitido) ...[
                Text(
                  r['nombre']?.toString() ?? r['patente']?.toString() ?? '',
                  style: HabitaTipografia.titulo3,
                ),
                const SizedBox(height: 5),
                Text(
                  '${r['tipo'] ?? ''} · ${r['unidad'] ?? ''}',
                  style: HabitaTipografia.cuerpoChico,
                ),
                const SizedBox(height: 12),
                EstadoChip(
                  'Usos restantes: ${r['usosRestantes'] ?? 'sin límite'}',
                  tipo: 'exito',
                ),
              ] else
                Text(
                  r['motivo']?.toString() ?? 'La credencial no es válida.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: HabitaColores.estadoErrorTexto),
                ),
              const SizedBox(height: 22),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Escanear otra credencial'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _patente() async {
    final texto = TextEditingController();
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (context) => Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          20,
          20,
          MediaQuery.viewInsetsOf(context).bottom + 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Buscar patente', style: HabitaTipografia.titulo2),
            const SizedBox(height: 14),
            TextField(
              controller: texto,
              textCapitalization: TextCapitalization.characters,
              autofocus: true,
              decoration: const InputDecoration(
                hintText: 'ABC123 o AB123CD',
                prefixIcon: Icon(Icons.directions_car_outlined),
              ),
            ),
            const SizedBox(height: 14),
            FilledButton(
              onPressed: () {
                final patente = texto.text;
                Navigator.pop(context);
                _validar(patente: patente);
              },
              child: const Text('Validar patente'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFF071A2D),
    body: SafeArea(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 12, 10, 12),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Control de acceso',
                        style: HabitaTipografia.titulo3.copyWith(
                          color: Colors.white,
                        ),
                      ),
                      Text(
                        'Escaneá QR o buscá patente',
                        style: HabitaTipografia.micro.copyWith(
                          color: const Color(0xFFAFC8D8),
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: FirebaseAuth.instance.signOut,
                  icon: const Icon(Icons.logout_rounded, color: Colors.white),
                ),
              ],
            ),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(22),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    MobileScanner(
                      controller: controlador,
                      onDetect: (capture) {
                        final codigo = capture.barcodes.firstOrNull?.rawValue;
                        if (codigo != null) _validar(codigo: codigo);
                      },
                    ),
                    CustomPaint(painter: _MarcoEscaner()),
                    if (procesando)
                      const ColoredBox(
                        color: Color(0x66000000),
                        child: Center(
                          child: CircularProgressIndicator(color: Colors.white),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
          Text(
            'Escaneá el código',
            style: HabitaTipografia.etiqueta.copyWith(color: Colors.white),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              IconButton.filledTonal(
                onPressed: controlador.toggleTorch,
                icon: const Icon(Icons.flashlight_on_rounded),
              ),
              const SizedBox(width: 14),
              FilledButton.tonalIcon(
                onPressed: _patente,
                icon: const Icon(Icons.directions_car_outlined),
                label: const Text('Patente'),
              ),
            ],
          ),
          const SizedBox(height: 20),
        ],
      ),
    ),
  );
}

class _MarcoEscaner extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final lado = size.width * .72;
    final rect = Rect.fromCenter(
      center: size.center(Offset.zero),
      width: lado,
      height: lado,
    );
    final pintura = Paint()
      ..color = HabitaColores.marcaDegradeFin
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4
      ..strokeCap = StrokeCap.round;
    const tramo = 34.0;
    for (final (a, b) in [
      (rect.topLeft, const Offset(tramo, 0)),
      (rect.topLeft, const Offset(0, tramo)),
      (rect.topRight, const Offset(-tramo, 0)),
      (rect.topRight, const Offset(0, tramo)),
      (rect.bottomLeft, const Offset(tramo, 0)),
      (rect.bottomLeft, const Offset(0, -tramo)),
      (rect.bottomRight, const Offset(-tramo, 0)),
      (rect.bottomRight, const Offset(0, -tramo)),
    ]) {
      canvas.drawLine(a, a + b, pintura);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class HistorialGuardia extends StatelessWidget {
  const HistorialGuardia({super.key, required this.complejoId});
  final String complejoId;
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Historial reciente')),
    body: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .collection('complejos/$complejoId/eventosAcceso')
          .orderBy('timestampServidor', descending: true)
          .limit(60)
          .snapshots(),
      builder: (context, snap) {
        if (snap.hasError) {
          return const ErrorCarga(mensaje: 'No pudimos cargar los accesos.');
        }
        if (!snap.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        return ListView.separated(
          padding: const EdgeInsets.all(18),
          itemCount: snap.data!.docs.length,
          separatorBuilder: (_, _) => const SizedBox(height: 10),
          itemBuilder: (context, i) {
            final e = snap.data!.docs[i].data();
            final permitido = e['resultado'] == 'permitido';
            return HabitaCard(
              child: Row(
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: permitido
                          ? HabitaColores.estadoExitoFondo
                          : HabitaColores.estadoErrorFondo,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(
                      permitido ? Icons.login_rounded : Icons.block_rounded,
                      color: permitido
                          ? HabitaColores.estadoExito
                          : HabitaColores.estadoError,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          e['nombre']?.toString() ??
                              e['patente']?.toString() ??
                              'Sin identificar',
                          style: HabitaTipografia.etiqueta,
                        ),
                        Text(
                          '${e['metodo'] ?? ''} · ${e['punto'] ?? ''}',
                          style: HabitaTipografia.micro,
                        ),
                        if (!permitido)
                          Text(
                            e['motivoRechazo']?.toString() ?? '',
                            style: HabitaTipografia.micro.copyWith(
                              color: HabitaColores.estadoErrorTexto,
                            ),
                          ),
                      ],
                    ),
                  ),
                  EstadoChip(
                    permitido ? 'Válido' : 'Rechazado',
                    tipo: permitido ? 'exito' : 'error',
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

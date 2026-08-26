import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../nucleo/tema/tokens.dart';

final _pesos = NumberFormat.currency(
  locale: 'es_AR',
  symbol: r'$ ',
  decimalDigits: 0,
);
String pesos(num centavos) => _pesos.format(centavos / 100);

class HabitaCard extends StatelessWidget {
  const HabitaCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.color,
  });
  final Widget child;
  final EdgeInsets padding;
  final Color? color;
  @override
  Widget build(BuildContext context) => Card(
    color: color,
    child: Padding(padding: padding, child: child),
  );
}

class EstadoChip extends StatelessWidget {
  const EstadoChip(this.texto, {super.key, this.tipo = 'info'});
  final String texto;
  final String tipo;
  @override
  Widget build(BuildContext context) {
    final (fondo, color) = switch (tipo) {
      'exito' => (
        HabitaColores.estadoExitoFondo,
        HabitaColores.estadoExitoTexto,
      ),
      'aviso' => (
        HabitaColores.estadoAvisoFondo,
        HabitaColores.estadoAvisoTexto,
      ),
      'error' => (
        HabitaColores.estadoErrorFondo,
        HabitaColores.estadoErrorTexto,
      ),
      _ => (HabitaColores.estadoInfoFondo, HabitaColores.estadoInfoTexto),
    };
    return DecoratedBox(
      decoration: BoxDecoration(
        color: fondo,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
        child: Text(
          texto,
          style: HabitaTipografia.micro.copyWith(
            color: color,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}

void mostrarError(BuildContext context, Object error) {
  if (!context.mounted) return;
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      backgroundColor: HabitaColores.estadoErrorTexto,
      content: Text(error.toString().replaceFirst('ErrorApi: ', '')),
    ),
  );
}

void mostrarExito(BuildContext context, String mensaje) {
  if (!context.mounted) return;
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      backgroundColor: HabitaColores.estadoExitoTexto,
      content: Text(mensaje),
    ),
  );
}

class ErrorCarga extends StatelessWidget {
  const ErrorCarga({super.key, required this.mensaje, this.reintentar});
  final String mensaje;
  final VoidCallback? reintentar;
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.cloud_off_rounded,
            color: HabitaColores.estadoError,
            size: 38,
          ),
          const SizedBox(height: 12),
          Text(mensaje, textAlign: TextAlign.center),
          if (reintentar != null) ...[
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: reintentar,
              child: const Text('Reintentar'),
            ),
          ],
        ],
      ),
    ),
  );
}

import 'package:flutter/material.dart';

import '../nucleo/enlaces.dart';
import 'widgets.dart';

/// El saldo y la acreditación pertenecen al servidor. Abrir el checkout no paga.
class PagoExpensas extends StatefulWidget {
  const PagoExpensas({
    super.key,
    required this.crearPreferencia,
    required this.pagarDemo,
    required this.confirmarDemo,
    required this.actualizar,
  });
  final Future<Map<String, dynamic>> Function() crearPreferencia;
  final Future<void> Function(String id) pagarDemo;
  final Future<bool> Function(BuildContext context) confirmarDemo;
  final Future<void> Function() actualizar;

  @override
  State<PagoExpensas> createState() => _PagoExpensasState();
}

class _PagoExpensasState extends State<PagoExpensas> {
  bool _ocupado = false;

  Future<void> _pagar() async {
    if (_ocupado) return;
    setState(() => _ocupado = true);
    try {
      final preferencia = await widget.crearPreferencia();
      if (!mounted) return;
      if (preferencia['simulado'] == true) {
        if (!await widget.confirmarDemo(context) || !mounted) return;
        await widget.pagarDemo(preferencia['preferenciaId'] as String);
        if (!mounted) return;
        mostrarExito(context, 'Pago demo acreditado.');
        await widget.actualizar();
        return;
      }
      final url = preferencia['urlPago'];
      final uri = url is String ? Uri.tryParse(url) : null;
      if (uri == null || uri.scheme != 'https' || uri.host.isEmpty) {
        throw Exception(
          'No recibimos un enlace de pago válido. Volvé a intentar.',
        );
      }
      // El diálogo conserva el enlace para reabrir/copiar sin generar otro cobro.
      await showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Continuar con Mercado Pago'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Importe: ${preferencia['montoFormateado'] ?? ''}'),
                const SizedBox(height: 12),
                const Text(
                  'El pago se acredita cuando Mercado Pago lo confirma. '
                  'Se aplica primero a los intereses y a la deuda más antigua. '
                  'Al terminar, volvé a Habita y actualizá tu cuenta.',
                ),
                const SizedBox(height: 12),
                SelectableText(url as String),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () async {
                try {
                  await LanzadorEnlaces.copiarAlPortapapeles(url);
                  if (dialogContext.mounted) {
                    mostrarExito(dialogContext, 'Enlace copiado.');
                  }
                } catch (error) {
                  if (dialogContext.mounted) mostrarError(dialogContext, error);
                }
              },
              child: const Text('Copiar enlace'),
            ),
            FilledButton(
              onPressed: () async {
                final abierto = await LanzadorEnlaces.abrirUrl(url);
                if (!abierto && dialogContext.mounted) {
                  mostrarError(
                    dialogContext,
                    'No pudimos abrir el navegador. Copiá el enlace y abrilo allí.',
                  );
                }
              },
              child: const Text('Abrir Mercado Pago'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Volver a mi cuenta'),
            ),
          ],
        ),
      );
      if (mounted) await widget.actualizar();
    } catch (error) {
      if (mounted) mostrarError(context, error);
    } finally {
      if (mounted) setState(() => _ocupado = false);
    }
  }

  @override
  Widget build(BuildContext context) => FilledButton.icon(
    onPressed: _ocupado ? null : _pagar,
    icon: _ocupado
        ? const Icon(Icons.hourglass_top)
        : const Icon(Icons.payments_outlined),
    label: Text(_ocupado ? 'Preparando pago…' : 'Pagar saldo con Mercado Pago'),
  );
}

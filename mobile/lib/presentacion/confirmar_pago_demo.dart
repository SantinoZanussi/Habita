import 'package:flutter/material.dart';

Future<bool> confirmarPagoDemo(BuildContext context) async {
  return await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Pago de demostración'),
          content: const Text(
            'Mercado Pago no está conectado. No se realizará ningún cobro ni '
            'se usará dinero real. Si continuás, se registrará un pago simulado '
            'y se actualizará el saldo de esta unidad en Habita. '
            'Usá esta opción solo con datos de demostración.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Simular pago'),
            ),
          ],
        ),
      ) ??
      false;
}

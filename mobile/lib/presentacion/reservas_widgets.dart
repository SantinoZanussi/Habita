import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../nucleo/tema/tokens.dart';
import 'widgets.dart';

IconData iconoEspacio(String nombre) {
  final texto = nombre.toLowerCase();
  if (texto.contains('pileta') || texto.contains('piscina')) {
    return Icons.pool_rounded;
  }
  if (texto.contains('gimnasio')) return Icons.fitness_center_rounded;
  if (texto.contains('parrilla') || texto.contains('quincho')) {
    return Icons.outdoor_grill_rounded;
  }
  if (texto.contains('cancha')) return Icons.sports_tennis_rounded;
  return Icons.weekend_rounded;
}

class SelectorReserva extends StatelessWidget {
  const SelectorReserva({
    super.key,
    required this.desde,
    required this.horas,
    required this.asistentes,
    required this.ocupado,
    required this.elegirFecha,
    required this.cambiarDia,
    required this.cambiarHoras,
    required this.cambiarAsistentes,
  });
  final DateTime desde;
  final int horas, asistentes;
  final bool ocupado;
  final VoidCallback elegirFecha;
  final ValueChanged<DateTime> cambiarDia;
  final ValueChanged<int> cambiarHoras, cambiarAsistentes;

  @override
  Widget build(BuildContext context) => HabitaCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Armá tu plan', style: HabitaTipografia.titulo3),
        const SizedBox(height: 6),
        const Text(
          'Elegí cuándo ir y mirá los lugares disponibles.',
          style: HabitaTipografia.cuerpoChico,
        ),
        const SizedBox(height: 16),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: List.generate(7, (i) {
              final dia = DateUtils.dateOnly(
                DateTime.now(),
              ).add(Duration(days: i));
              final seleccionado = DateUtils.isSameDay(dia, desde);
              return Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ChoiceChip(
                  selected: seleccionado,
                  label: Text(
                    '${i == 0
                        ? 'Hoy'
                        : i == 1
                        ? 'Mañana'
                        : const ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][dia.weekday - 1]} ${dia.day}',
                  ),
                  onSelected: ocupado
                      ? null
                      : (_) => cambiarDia(
                          DateTime(
                            dia.year,
                            dia.month,
                            dia.day,
                            desde.hour,
                            desde.minute,
                          ),
                        ),
                ),
              );
            }),
          ),
        ),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: ocupado ? null : elegirFecha,
          icon: const Icon(Icons.edit_calendar_outlined),
          label: Text(DateFormat('dd/MM · HH:mm').format(desde)),
        ),
        const SizedBox(height: 14),
        const Text('Duración', style: HabitaTipografia.etiqueta),
        Wrap(
          spacing: 6,
          children: List.generate(
            8,
            (i) => ChoiceChip(
              label: Text('${i + 1} h'),
              selected: horas == i + 1,
              onSelected: ocupado ? null : (_) => cambiarHoras(i + 1),
            ),
          ),
        ),
        const Divider(height: 28),
        Row(
          children: [
            const Expanded(
              child: Text('¿Cuántos van?', style: HabitaTipografia.etiqueta),
            ),
            IconButton.filledTonal(
              tooltip: 'Quitar asistente',
              onPressed: ocupado || asistentes == 1
                  ? null
                  : () => cambiarAsistentes(asistentes - 1),
              icon: const Icon(Icons.remove),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: Text('$asistentes', style: HabitaTipografia.titulo3),
            ),
            IconButton.filledTonal(
              tooltip: 'Agregar asistente',
              onPressed: ocupado
                  ? null
                  : () => cambiarAsistentes(asistentes + 1),
              icon: const Icon(Icons.add),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Text(
          'Hasta las ${DateFormat('HH:mm').format(desde.add(Duration(hours: horas)))} · El cupo se confirma al reservar.',
          style: HabitaTipografia.micro,
        ),
      ],
    ),
  );
}

class TarjetaEspacio extends StatelessWidget {
  const TarjetaEspacio({
    super.key,
    required this.nombre,
    required this.descripcion,
    required this.capacidad,
    required this.disponibles,
    required this.asistentes,
    required this.propia,
    required this.activo,
    required this.aprobacion,
    required this.ocupado,
    required this.reservar,
  });
  final String nombre, descripcion;
  final int capacidad, disponibles, asistentes;
  final bool propia, activo, aprobacion, ocupado;
  final VoidCallback reservar;

  @override
  Widget build(BuildContext context) {
    final suficiente = disponibles >= asistentes;
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: HabitaCard(
        padding: EdgeInsets.zero,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFF0C344B), Color(0xFF157C88)],
                ),
                borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
              ),
              child: Row(
                children: [
                  Icon(iconoEspacio(nombre), size: 42, color: Colors.white),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Text(
                      nombre,
                      style: HabitaTipografia.titulo3.copyWith(
                        color: Colors.white,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (descripcion.isNotEmpty) ...[
                    Text(descripcion),
                    const SizedBox(height: 14),
                  ],
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      EstadoChip(
                        !activo
                            ? 'No disponible'
                            : propia
                            ? 'Ya tenés reserva'
                            : suficiente
                            ? 'Hay lugar para tu grupo'
                            : 'Cupo insuficiente',
                        tipo: !activo || !suficiente ? 'aviso' : 'exito',
                      ),
                      EstadoChip(
                        aprobacion
                            ? 'Con aprobación'
                            : 'Confirmación inmediata',
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          '$disponibles lugares libres',
                          style: HabitaTipografia.etiqueta,
                        ),
                      ),
                      Text('de $capacidad'),
                    ],
                  ),
                  const SizedBox(height: 8),
                  LinearProgressIndicator(
                    value: capacidad > 0
                        ? (disponibles / capacidad).clamp(0, 1)
                        : 0,
                    minHeight: 6,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  const SizedBox(height: 18),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: ocupado || propia || !activo || !suficiente
                          ? null
                          : reservar,
                      icon: const Icon(Icons.calendar_today_outlined, size: 18),
                      label: Text(
                        !activo
                            ? 'Espacio no habilitado'
                            : propia
                            ? 'Ya reservaste este horario'
                            : !suficiente
                            ? 'Elegí otro horario'
                            : 'Reservar',
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

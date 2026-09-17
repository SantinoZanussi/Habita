export function fechaDato(valor) {
  const fecha = valor?.toDate?.() ?? new Date(valor ?? '');
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export function reservasFiltradas(reservas, { estado = 'todos', amenity = 'todos', fecha = '' } = {}) {
  return reservas.filter((r) => {
    const inicio = fechaDato(r.desde);
    const fin = fechaDato(r.hasta);
    const dia = fecha ? new Date(`${fecha}T00:00:00`) : null;
    const siguiente = dia ? new Date(dia.getFullYear(), dia.getMonth(), dia.getDate() + 1) : null;
    return (estado === 'todos' || r.estado === estado) &&
      (amenity === 'todos' || r.amenityId === amenity) &&
      (!dia || (inicio && fin && inicio < siguiente && fin > dia));
  }).sort((a, b) => (fechaDato(a.desde)?.getTime() ?? 0) - (fechaDato(b.desde)?.getTime() ?? 0));
}

export function destinatariosAviso(datos) {
  if (datos.get('alcance') === 'todos') return 'todos';
  const unidades = [...new Set(datos.getAll('unidades').filter(Boolean))];
  if (!unidades.length || unidades.length > 30) throw new Error('Elegí entre 1 y 30 unidades para un aviso dirigido.');
  return unidades;
}

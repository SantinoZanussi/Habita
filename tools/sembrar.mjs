/** Datos de demostracion reproducibles para los emuladores de Firebase. */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';

const proyecto = process.env.FIREBASE_PROJECT_ID ?? 'habita-demo';
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
process.env.FIREBASE_STORAGE_EMULATOR_HOST ??= '127.0.0.1:9199';
process.env.USAR_EMULADORES = 'true';
process.env.FCM_ACTIVO = 'false';

const app = getApps()[0] ?? initializeApp({ projectId: proyecto });
const db = getFirestore(app);
const auth = getAuth(app);
const { cerrarPeriodo } = await import('../backend/src/servicios/liquidacion.js');

await limpiarEmuladores();

const complejoId = 'torre-parque';
const usuarios = [
  { email: 'superadmin@habita.demo', password: 'Habita2026!', nombre: 'Sofía Administradora', rol: 'superadmin', claims: { rol: 'superadmin', complejos: [complejoId] } },
  { email: 'admin@habita.demo', password: 'Habita2026!', nombre: 'Juan Pérez', rol: 'admin_complejo', claims: { rol: 'admin_complejo', complejoId } },
  { email: 'residente@habita.demo', password: 'Habita2026!', nombre: 'Juan Pérez', rol: 'residente', claims: { rol: 'residente', complejoId, unidadId: 'unidad-3a' } },
  { email: 'guardia@habita.demo', password: 'Habita2026!', nombre: 'Marcos Guardia', rol: 'guardia', claims: { rol: 'guardia', complejoId } },
  { email: 'obra@habita.demo', password: 'Habita2026!', nombre: 'Elena Capataz', rol: 'responsable_obra', claims: { rol: 'responsable_obra', complejoId, obraIds: ['obra-pileta'] } },
];

for (const usuario of usuarios) {
  const registro = await auth.createUser({ email: usuario.email, password: usuario.password, displayName: usuario.nombre, emailVerified: true });
  usuario.uid = registro.uid;
  await auth.setCustomUserClaims(registro.uid, usuario.claims);
}

const porEmail = Object.fromEntries(usuarios.map((u) => [u.email, u]));
const ahora = new Date();
const manana = new Date(ahora.getTime() + 24 * 60 * 60 * 1000);

await db.collection('complejos').doc(complejoId).set({
  nombre: 'Torre del Parque',
  tipo: 'edificio', tipoUnidad: 'departamento', nomenclaturaAporte: 'expensa',
  metodosAcceso: ['qr', 'nfc', 'patente'],
  modulosActivos: { obras: true, evaluacion: true, consumos: true },
  politicaRedondeo: 'mayorResto', porcentajeFondoReserva: 10,
  tasaMoraMensual: 3, modoMora: 'simple', diasGraciaMora: 0,
  zonaHoraria: 'America/Argentina/Buenos_Aires',
  direccion: 'Av. del Libertador 3250, Buenos Aires',
  puntosAcceso: [
    { id: 'torre-principal', nombre: 'Torre - Entrada principal' },
    { id: 'garaje-salida', nombre: 'Garaje - Salida' },
  ],
  activo: true, creadoEn: FieldValue.serverTimestamp(), actualizadoEn: FieldValue.serverTimestamp(),
});

const loteUsuarios = db.batch();
for (const usuario of usuarios) {
  loteUsuarios.set(db.collection('usuarios').doc(usuario.uid), {
    nombre: usuario.nombre, email: usuario.email, rol: usuario.rol,
    complejoId: usuario.claims.complejoId ?? null, unidadId: usuario.claims.unidadId ?? null,
    complejos: usuario.claims.complejos ?? [], obraIds: usuario.claims.obraIds ?? [],
    activo: true, creadoEn: FieldValue.serverTimestamp(), actualizadoEn: FieldValue.serverTimestamp(),
  });
}
await loteUsuarios.commit();

await sembrarUnidades();
await sembrarAmenities();
await sembrarAccesos();
await sembrarReclamos();
await sembrarObra();
await sembrarAvisos();
await sembrarLiquidacion();

console.log('Habita listo para la demo.');
console.table(usuarios.map(({ email, password, rol }) => ({ email, password, rol })));
console.log('Panel: http://127.0.0.1:5000/panel');

async function limpiarEmuladores() {
  const base = `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${proyecto}/databases/(default)/documents`;
  const respuesta = await fetch(base, { method: 'DELETE' });
  if (!respuesta.ok) throw new Error('No se pudo limpiar Firestore. ¿Están encendidos los emuladores?');
  const listado = await auth.listUsers();
  if (listado.users.length) await auth.deleteUsers(listado.users.map((u) => u.uid));
}

async function sembrarUnidades() {
  let lote = db.batch();
  let operaciones = 0;
  for (let i = 1; i <= 152; i += 1) {
    const id = i === 3 ? 'unidad-3a' : `unidad-${String(i).padStart(3, '0')}`;
    const piso = Math.ceil(i / 8);
    const letra = String.fromCharCode(65 + ((i - 1) % 8));
    const identificador = i === 3 ? '3A' : `${piso}${letra}`;
    // 144 coeficientes de 0,6579 y 8 de 0,6578 suman 100,0000 exacto.
    const coeficiente = i <= 144 ? 0.6579 : 0.6578;
    lote.set(db.collection(`complejos/${complejoId}/unidades`).doc(id), {
      identificador, identificadorNormalizado: identificador,
      coeficiente, superficie: 58 + (i % 5) * 7,
      estado: 'ocupada',
      titularUid: i === 3 ? porEmail['residente@habita.demo'].uid : null,
      inquilinoUid: null,
      patentesAutorizadas: i === 3 ? ['ABC123'] : [],
      saldoAFavor: 0, creadoEn: FieldValue.serverTimestamp(), actualizadoEn: FieldValue.serverTimestamp(),
    });
    operaciones += 1;
    if (operaciones === 450) { await lote.commit(); lote = db.batch(); operaciones = 0; }
  }
  if (operaciones) await lote.commit();
}

async function sembrarAmenities() {
  const amenities = [
    ['sum', 'SUM', 30, 'Salón luminoso con galería'],
    ['parrilla', 'Parrilla', 12, 'Sector de parrillas cubierto'],
    ['pileta', 'Pileta', 20, 'Pileta y solárium'],
    ['gimnasio', 'Gimnasio', 10, 'Sala de musculación'],
  ];
  const lote = db.batch();
  for (const [id, nombre, capacidad, descripcion] of amenities) {
    lote.set(db.collection(`complejos/${complejoId}/amenities`).doc(id), {
      nombre, capacidad, descripcion, activo: true, requiereAprobacion: false,
      anticipacionMaximaDias: 30, horarios: [{ desde: '08:00', hasta: '23:00' }],
      creadoEn: FieldValue.serverTimestamp(), actualizadoEn: FieldValue.serverTimestamp(),
    });
  }
  await lote.commit();
}

async function sembrarAccesos() {
  await db.collection(`complejos/${complejoId}/autorizaciones`).doc('visita-demo').set({
    tipo: 'visita', nombre: 'María González', documento: '30111222', unidadId: 'unidad-3a',
    autorizadoPorUid: porEmail['residente@habita.demo'].uid,
    vigenciaDesde: Timestamp.fromDate(new Date(ahora.getTime() - 60 * 60 * 1000)),
    vigenciaHasta: Timestamp.fromDate(manana), diasPermitidos: [0, 1, 2, 3, 4, 5, 6],
    usosPermitidos: 2, usosConsumidos: 0, codigoQr: 'HBA-DEMO-VISITA-01',
    estado: 'vigente', puntosPermitidos: ['torre-principal'], creadoEn: FieldValue.serverTimestamp(),
  });

  const eventos = [
    { nombre: 'Juan Pérez', tipoPersona: 'residente', unidadId: 'unidad-3a', metodo: 'qr_dinamico', punto: 'torre-principal', sentido: 'ingreso', resultado: 'permitido', minutos: 5 },
    { nombre: 'María González', tipoPersona: 'visita', unidadId: 'unidad-3a', metodo: 'qr_autorizacion', punto: 'torre-principal', sentido: 'ingreso', resultado: 'permitido', minutos: 18 },
    { nombre: 'Patente ABC123', tipoPersona: 'residente', unidadId: 'unidad-3a', metodo: 'patente', punto: 'garaje-salida', sentido: 'egreso', resultado: 'permitido', minutos: 27, patente: 'ABC123' },
    { nombre: 'Proveedor no autorizado', tipoPersona: 'proveedor', unidadId: null, metodo: 'qr_autorizacion', punto: 'torre-principal', sentido: 'ingreso', resultado: 'rechazado', motivoRechazo: 'La autorización está vencida', minutos: 42 },
  ];
  const lote = db.batch();
  for (const evento of eventos) {
    const ref = db.collection(`complejos/${complejoId}/eventosAcceso`).doc();
    const { minutos, ...datos } = evento;
    lote.set(ref, { ...datos, guardiaUid: porEmail['guardia@habita.demo'].uid, timestampServidor: Timestamp.fromDate(new Date(Date.now() - minutos * 60_000)), creadoEn: FieldValue.serverTimestamp() });
  }
  await lote.commit();
}

async function sembrarReclamos() {
  const reclamos = [
    ['1523', 'Pérdida de agua en cocina', 'plomeria', 'alta', 92, 'en_progreso', 'unidad-028'],
    ['1522', 'La luz del pasillo está quemada', 'electricidad', 'media', 95, 'pendiente', 'unidad-007'],
    ['1521', 'El aire acondicionado no enfría', 'aire_acondicionado', 'baja', 78, 'resuelto', 'unidad-012'],
    ['1520', 'Portón del garaje trabado', 'seguridad', 'critica', 89, 'pendiente', 'unidad-041'],
  ];
  const lote = db.batch();
  for (const [numero, descripcion, area, urgencia, confianza, estado, unidadId] of reclamos) {
    const ref = db.collection(`complejos/${complejoId}/reclamos`).doc(`reclamo-${numero}`);
    lote.set(ref, {
      numero, descripcion, unidadId, autorUid: porEmail['residente@habita.demo'].uid,
      fotoUrl: null, estado, prioridad: { critica: 4, alta: 3, media: 2, baja: 1 }[urgencia],
      clasificacionIA: { area, urgencia, confianza, origen: 'ia', resumen: descripcion },
      clasificacionFinal: { area, urgencia, corregidaPorHumano: false },
      proveedorAsignadoId: estado === 'en_progreso' ? 'climatica' : null,
      historialEstados: [{ de: null, a: 'pendiente', en: new Date().toISOString() }],
      creadoEn: Timestamp.fromDate(new Date(Date.now() - Number(numero.slice(-1)) * 86_400_000)),
      actualizadoEn: FieldValue.serverTimestamp(),
    });
  }
  await lote.commit();
}

async function sembrarObra() {
  await db.collection(`complejos/${complejoId}/obras`).doc('obra-pileta').set({
    nombre: 'Renovación de pileta', tipo: 'comun', estado: 'en_progreso',
    presupuestoAprobado: 48_000_000, gastoEjecutado: 22_400_000,
    fechaInicio: Timestamp.fromDate(new Date('2026-08-03T12:00:00Z')),
    fechaFinPlanificada: Timestamp.fromDate(new Date('2026-09-30T12:00:00Z')),
    fechaFinEstimada: Timestamp.fromDate(new Date('2026-09-30T12:00:00Z')),
    avanceFisicoPorcentaje: 42, creadoEn: FieldValue.serverTimestamp(), actualizadoEn: FieldValue.serverTimestamp(),
  });
  const partidas = [
    ['demolicion', 'Retiro de revestimiento', 8, [], 100, 8_000_000],
    ['impermeabilizacion', 'Impermeabilización', 12, ['demolicion'], 55, 16_000_000],
    ['revestimiento', 'Nuevo revestimiento', 15, ['impermeabilizacion'], 0, 18_000_000],
    ['iluminacion', 'Iluminación del solárium', 7, ['demolicion'], 25, 6_000_000],
  ];
  const lote = db.batch();
  for (const [id, nombre, duracionEstimada, predecesoras, avancePorcentaje, presupuestoCentavos] of partidas) {
    lote.set(db.collection(`complejos/${complejoId}/obras/obra-pileta/partidas`).doc(id), {
      nombre, duracionEstimada, predecesoras, avancePorcentaje, presupuestoCentavos,
      creadoEn: FieldValue.serverTimestamp(), actualizadoEn: FieldValue.serverTimestamp(),
    });
  }
  await lote.commit();
}

async function sembrarAvisos() {
  const avisos = [
    ['Corte de agua programado', 'Mañana de 08:00 a 14:00 h.', 'mantenimiento'],
    ['Asamblea ordinaria', 'Jueves 3 de septiembre a las 19:00 h.', 'asamblea'],
  ];
  const lote = db.batch();
  for (const [titulo, cuerpo, tipo] of avisos) {
    lote.set(db.collection(`complejos/${complejoId}/notificaciones`).doc(), {
      titulo, cuerpo, tipo, destinatarios: 'todos', enviadaEn: FieldValue.serverTimestamp(), creadaPorUid: porEmail['admin@habita.demo'].uid,
    });
  }
  await lote.commit();
}

async function sembrarLiquidacion() {
  await db.collection(`complejos/${complejoId}/periodos`).doc('2026-08').set({
    etiqueta: 'Agosto 2026', vencimiento: Timestamp.fromDate(new Date('2026-09-10T12:00:00Z')),
    estado: 'borrador', politicaRedondeo: 'mayorResto',
    gastosOrdinarios: [
      { id: 'personal', concepto: 'Personal y cargas sociales', montoCentavos: 220_000_000, criterio: 'coeficiente', aCargoDe: 'ocupante' },
      { id: 'servicios', concepto: 'Servicios y mantenimiento', montoCentavos: 108_000_000, criterio: 'coeficiente', aCargoDe: 'ocupante' },
      { id: 'seguros', concepto: 'Seguros y administración', montoCentavos: 40_000_000, criterio: 'partesIguales', aCargoDe: 'ocupante' },
    ],
    gastosExtraordinarios: [
      { id: 'obra-pileta', concepto: 'Renovación de pileta', montoCentavos: 112_000_000, criterio: 'coeficiente', aCargoDe: 'propietario', obraId: 'obra-pileta' },
    ],
    fondoReserva: { modo: 'monto', valor: 32_000_000 },
    creadoPorUid: porEmail['admin@habita.demo'].uid,
    creadoEn: FieldValue.serverTimestamp(), actualizadoEn: FieldValue.serverTimestamp(),
  });

  await cerrarPeriodo({ complejoId, periodoId: '2026-08', adminUid: porEmail['admin@habita.demo'].uid });

  // 135 unidades al día y 17 pendientes: alimenta el dashboard de morosidad.
  let lote = db.batch();
  let operaciones = 0;
  const detalles = await db.collection(`complejos/${complejoId}/periodos/2026-08/detalle`).get();
  for (const [indice, doc] of detalles.docs.entries()) {
    if (indice < 135) lote.update(doc.ref, { saldoPendiente: 0, pagado: true, ultimoPagoEn: FieldValue.serverTimestamp() });
    operaciones += 1;
    if (operaciones === 450) { await lote.commit(); lote = db.batch(); operaciones = 0; }
  }
  if (operaciones) await lote.commit();
}

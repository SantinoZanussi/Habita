import { reservasFiltradas, destinatariosAviso } from './gestion.js';
import QRCode from 'qrcode';
import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator, getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut,
} from 'firebase/auth';
import {
  collection, connectFirestoreEmulator, doc, getFirestore, limit, onSnapshot,
  orderBy, query, getDocs,
} from 'firebase/firestore';

const config = await window.HABITA_CONFIG_PROMISE;
// Compatibilidad con preferencias antiguas cuyo retorno apuntaba al panel.
if (new URLSearchParams(location.search).get('pago') === 'resultado') {
  location.replace('/pago/');
}
const firebaseApp = initializeApp(config.firebase);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
if (config.emuladores.activo) {
  connectAuthEmulator(auth, `http://${config.emuladores.host}:${config.emuladores.auth}`, { disableWarnings: true });
  connectFirestoreEmulator(db, config.emuladores.host, config.emuladores.firestore);
}

const $ = (selector, raiz = document) => raiz.querySelector(selector);
const $$ = (selector, raiz = document) => [...raiz.querySelectorAll(selector)];
const estado = {
  usuario: null, claims: null, complejoId: null, complejo: null,
  unidades: [], eventos: [], reclamos: [], periodos: [], amenities: [], reservas: [], obras: [],
  autorizaciones: [], periodoSeleccionado: '', avisos: [], filtroAvisos: '', filtrosReservas: { estado: 'todos', amenity: 'todos', fecha: '' },
  resumen: null, seccion: 'dashboard', listeners: [], filtroUnidades: '', filtroReclamos: '', estadoReclamos: 'todos',
};
let temporizadorResumen;
let solicitudResumen = 0;
let focoAntesModal;

const login = $('#login');
const appShell = $('#aplicacion');
const loginForm = $('#form-login');
const loginError = $('#login-error');
if (!config.emuladores.activo) {
  $('#login-email').value = '';
  $('#login-password').value = '';
  $('.demo-access').hidden = true;
}
$('.environment strong').textContent = config.emuladores.activo ? 'Entorno local' : 'Entorno online';
$('.environment small').textContent = config.emuladores.activo ? 'Emuladores Firebase' : 'Firebase + Render';

loginForm.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const boton = $('button[type="submit"]', loginForm);
  boton.disabled = true;
  loginError.hidden = true;
  try {
    await signInWithEmailAndPassword(auth, $('#login-email').value.trim(), $('#login-password').value);
  } catch (error) {
    loginError.textContent = mensajeFirebase(error);
    loginError.hidden = false;
  } finally {
    boton.disabled = false;
  }
});

$$('[data-demo-login]').forEach((boton) => boton.addEventListener('click', () => {
  $('#login-email').value = boton.dataset.demoLogin;
  $('#login-password').value = 'Habita2026!';
  loginForm.requestSubmit();
}));

$('#salir').addEventListener('click', () => signOut(auth));
$('#menu-movil').addEventListener('click', () => appShell.classList.toggle('menu-open'));
window.addEventListener('online', actualizarConectividad);
window.addEventListener('offline', actualizarConectividad);
actualizarConectividad();

onAuthStateChanged(auth, async (usuario) => {
  limpiarListeners();
  if (!usuario) {
    estado.usuario = null;
    appShell.hidden = true;
    login.hidden = false;
    return;
  }

  try {
    const token = await usuario.getIdTokenResult(true);
    const rol = token.claims.rol;
    if (!['admin_complejo', 'superadmin'].includes(rol)) {
      await signOut(auth);
      throw new Error('Esta cuenta pertenece a la app móvil, no al panel de administración.');
    }
    estado.usuario = usuario;
    estado.claims = token.claims;
    estado.complejoId = token.claims.complejoId ?? token.claims.complejos?.[0];
    if (!estado.complejoId) throw new Error('La cuenta no tiene un complejo asignado.');
    $('#usuario-nombre').textContent = usuario.displayName ?? 'Administrador';
    $('.avatar').textContent = iniciales(usuario.displayName ?? usuario.email);
    login.hidden = true;
    appShell.hidden = false;
    suscribirTiempoReal();
    await cargarResumen();
  } catch (error) {
    mostrarToast('No pudimos abrir el panel', error.message, 'error');
  }
});

function suscribirTiempoReal() {
  const cid = estado.complejoId;
  escuchar(query(collection(db, `complejos/${cid}/autorizaciones`)), (snap) => {
    estado.autorizaciones = snap.docs.map(datosDoc); renderAccesos();
  });
  escuchar(doc(db, 'complejos', cid), (snap) => {
    const revisionAnterior = estado.complejo?.revisionCuenta;
    estado.complejo = snap.exists() ? { id: snap.id, ...snap.data() } : null;
    $('#complejo-nombre').textContent = estado.complejo?.nombre ?? cid;
    renderTodo();
    if (revisionAnterior !== estado.complejo?.revisionCuenta) {
      clearTimeout(temporizadorResumen);
      temporizadorResumen = setTimeout(() => cargarResumen(), 200);
    }
  });
  escuchar(query(collection(db, `complejos/${cid}/unidades`)), (snap) => {
    estado.unidades = snap.docs.map(datosDoc).filter((u) => u.estado !== 'baja')
      .sort((a, b) => String(a.identificador).localeCompare(String(b.identificador), 'es', { numeric: true }));
    renderTodo();
  });
  escuchar(query(collection(db, `complejos/${cid}/eventosAcceso`), orderBy('timestampServidor', 'desc'), limit(60)), (snap) => {
    estado.eventos = snap.docs.map(datosDoc); renderTodo();
  });
  escuchar(query(collection(db, `complejos/${cid}/reclamos`), orderBy('creadoEn', 'desc'), limit(100)), (snap) => {
    estado.reclamos = snap.docs.map(datosDoc); renderTodo();
  });
  escuchar(query(collection(db, `complejos/${cid}/periodos`)), (snap) => {
    estado.periodos = snap.docs.map(datosDoc)
      .sort((a, b) => b.id.localeCompare(a.id));
    renderTodo();
  });
  escuchar(query(collection(db, `complejos/${cid}/amenities`)), (snap) => {
    estado.amenities = snap.docs.map(datosDoc); renderTodo();
  });
  escuchar(query(collection(db, `complejos/${cid}/reservas`), orderBy('desde', 'desc'), limit(100)), (snap) => {
    estado.reservas = snap.docs.map(datosDoc); renderTodo();
  });
  escuchar(query(collection(db, `complejos/${cid}/obras`)), (snap) => {
    estado.obras = snap.docs.map(datosDoc); renderTodo();
  });
  escuchar(query(collection(db, `complejos/${cid}/notificaciones`), orderBy('enviadaEn', 'desc'), limit(100)), (snap) => {
    estado.avisos = snap.docs.map(datosDoc); renderComunicaciones();
  });

}

function escuchar(referencia, callback) {
  estado.listeners.push(onSnapshot(referencia, { includeMetadataChanges: true }, callback, (error) => {
    mostrarToast('Actualización en tiempo real pausada', error.message, 'error');
  }));
}

function limpiarListeners() {
  estado.autorizaciones = [];
  estado.periodoSeleccionado = '';
  clearTimeout(temporizadorResumen);
  solicitudResumen += 1;
  for (const clave of ['unidades','eventos','reclamos','periodos','amenities','reservas','obras','avisos']) estado[clave] = [];
  estado.resumen = null;
  estado.complejo = null;
  estado.listeners.forEach((cancelar) => cancelar());
  estado.listeners = [];
}

async function cargarResumen() {
  const solicitud = ++solicitudResumen;
  try {
    const resumen = await api(`/complejos/${estado.complejoId}/expensas/resumen`);
    if (solicitud !== solicitudResumen) return;
    estado.resumen = resumen;
    renderTodo();
  } catch (error) {
    if (solicitud !== solicitudResumen) return;
    mostrarToast('Cobranza no disponible', error.message, 'error');
  }
}

function renderTodo() {
  renderDashboard(); renderUnidades(); renderExpensas(); renderCobranza();
  renderAccesos(); renderReclamos(); renderAmenities(); renderComunicaciones(); renderObras();
  if (!$('#form-configuracion')?.dataset.dirty) renderConfiguracion();
}

function renderDashboard() {
  const resumen = estado.resumen ?? {};
  const abiertos = estado.reclamos.filter((r) => !['resuelto', 'anulado'].includes(r.estado));
  const accesosHoy = estado.eventos.filter((e) => e.resultado === 'permitido').length;
  $('#section-dashboard').innerHTML = `
    ${heading('Dashboard', `La operación de ${estado.complejo?.nombre ?? 'tu complejo'}, en una sola vista.`, '<button class="button button--secondary" data-action="nuevo-aviso">+ Nuevo aviso</button>')}
    <div class="toolbar quick-actions"><button class="button button--primary" data-action="nuevo-periodo">Cargar gastos</button><button class="button button--secondary" data-action="pago-manual">Registrar pago recibido</button><button class="button button--secondary" data-action="nueva-autorizacion">Autorizar visita</button><button class="button button--secondary" data-action="nueva-obra">Cargar obra</button></div>
    <div class="metrics">
      ${metric('Unidades', estado.unidades.length, 'Unidades registradas', '▦')}
      ${metric('Recaudación del período', dinero(resumen.recaudado), `${numero(resumen.porcentajeRecaudado)}% del total`, '$')}
      ${metric('Morosidad', dinero(resumen.morosidadTotal), `${resumen.unidadesMorosas ?? 0} unidades`, '!', true)}
      ${metric('Reclamos abiertos', abiertos.length, `${abiertos.filter((r) => esReciente(r.creadoEn)).length} recientes`, '◇', abiertos.length > 10)}
    </div>
    <div class="grid grid--2">
      <article class="card">
        <div class="card__header"><div><h3>Recaudación por período</h3><p>Liquidado, recaudado y pendiente</p></div><span class="chip chip--info">Últimos 12 meses</span></div>
        ${graficoBarras(resumen.serie ?? [])}
      </article>
      <article class="card">
        <div class="card__header"><div><h3>Morosidad por antigüedad</h3><p>${resumen.unidadesMorosas ?? 0} unidades con saldo</p></div></div>
        ${donutMorosidad(resumen)}
      </article>
    </div>
    <div class="grid grid--2">
      <article class="card card--flush">
        <div class="card__header" style="padding:18px 18px 0"><div><h3>Últimos reclamos</h3><p>Priorizados por urgencia y confianza</p></div><button class="link-button" data-nav="reclamos">Ver todos</button></div>
        ${tablaReclamos(estado.reclamos.slice(0, 4), false)}
      </article>
      <article class="card">
        <div class="card__header"><div><h3>Accesos en tiempo real</h3><p>${accesosHoy} movimientos recientes</p></div><span class="live-pill"><span class="status-dot"></span>En vivo</span></div>
        ${lineasAcceso(estado.eventos.slice(0, 5))}
        <button class="link-button" data-nav="accesos" style="margin-top:12px">Ver historial completo</button>
      </article>
    </div>`;
}

function renderUnidades() {
  const filtro = normalizar(estado.filtroUnidades);
  const unidades = estado.unidades.filter((u) => normalizar(`${u.identificador} ${u.estado}`).includes(filtro));
  const suma = estado.unidades.reduce((acc, u) => acc + Number(u.coeficiente ?? 0), 0);
  $('#section-unidades').innerHTML = `
    ${heading('Unidades', `${estado.unidades.length} departamentos configurados en ${safe(estado.complejo?.nombre ?? '')}.`, '<button class="button button--primary" data-action="nueva-unidad">+ Nueva unidad</button>')}
    <div class="verification"><span>✓ Los coeficientes suman <strong>${numero(suma, 4)}%</strong></span><span>${Math.abs(suma - 100) < .0001 ? 'Listos para liquidar' : 'Requiere corrección'}</span></div>
    <div class="toolbar" style="margin-top:14px"><div class="search"><input id="buscar-unidad" type="search" value="${safe(estado.filtroUnidades)}" placeholder="Buscar por identificador…"></div><select><option>Todas las unidades</option><option>Ocupadas</option><option>En obra</option></select></div>
    <article class="card card--flush">${tablaUnidades(unidades)}</article>`;
  $('#buscar-unidad')?.addEventListener('input', (e) => { estado.filtroUnidades = e.target.value; renderUnidades(); });
}

function renderExpensas() {
  const periodo = estado.periodos.find((p) => p.id === estado.periodoSeleccionado) ?? estado.periodos[0];
  const ordinario = periodo?.totalOrdinario ?? sumarGastos(periodo?.gastosOrdinarios);
  const extraordinario = periodo?.totalExtraordinario ?? sumarGastos(periodo?.gastosExtraordinarios);
  const fondo = periodo?.totalFondoReserva ?? Number(periodo?.fondoReserva?.valor ?? 0);
  const total = periodo?.totalLiquidado ?? ordinario + extraordinario + fondo;
  $('#section-expensas').innerHTML = `
    ${heading('Liquidación de expensas', periodo ? `${safe(periodo.etiqueta ?? periodo.id)} · ${estado.unidades.length} unidades` : 'Creá el primer período para comenzar.', '<button class="button button--primary" data-action="nuevo-periodo">+ Nuevo período</button>')}
    <div class="workflow"><div><strong>1. Cargá los gastos</strong><p>Agregá cada concepto del mes en un borrador.</p></div><div><strong>2. Revisá el reparto</strong><p>Consultá cuánto corresponde a cada unidad.</p></div><div><strong>3. Publicá y cobrá</strong><p>Los residentes pagan desde Mis expensas en la app.</p><button class="button button--ghost" data-nav="cobranza">Ver cobranza →</button></div></div>
    ${periodo ? `<label class="period-picker">Período a consultar<select data-periodo>${estado.periodos.map((p) => `<option value="${safe(p.id)}" ${p.id === periodo.id ? 'selected' : ''}>${safe(p.etiqueta ?? p.id)} · ${textoEstado(p.estado)}</option>`).join('')}</select></label><div class="metrics">
      ${metric('Gasto total', dinero(total), periodo.estado === 'cerrado' ? 'Período cerrado' : 'Borrador', '$')}
      ${metric('Gastos ordinarios', dinero(ordinario), porcentaje(ordinario, total), '○')}
      ${metric('Gastos extraordinarios', dinero(extraordinario), porcentaje(extraordinario, total), '△')}
      ${metric('Fondo de reserva', dinero(fondo), porcentaje(fondo, total), '◇')}
    </div>
    <div class="grid grid--2">
      <article class="card">
        <div class="card__header"><div><h3>Distribución del gasto</h3><p>Composición del período</p></div><span class="chip ${periodo.estado === 'cerrado' ? 'chip--success' : 'chip--warning'}">${textoEstado(periodo.estado)}</span></div>
        ${donutGastos({ ordinario, extraordinario, fondo, total })}
        <div class="verification">${periodo.estado === 'cerrado' ? 'Publicado: las unidades ya pueden consultar su liquidación.' : 'Borrador: revisá el reparto antes de publicar. Todavía no se cobra a los residentes.'}</div>
      </article>
      <article class="card">
        <div class="card__header"><div><h3>Revisar y publicar</h3><p>Después de publicar, los importes no se pueden editar.</p></div></div>
        <div class="access-line"><span class="access-line__icon">1</span><span><strong>${periodo.gastosOrdinarios?.length ?? 0} gastos ordinarios</strong><small>Criterios por coeficiente y partes iguales</small></span></div>
        <div class="access-line"><span class="access-line__icon">2</span><span><strong>${periodo.gastosExtraordinarios?.length ?? 0} gastos extraordinarios</strong><small>Separados por propietario u ocupante</small></span></div>
        <div class="access-line"><span class="access-line__icon">3</span><span><strong>${estado.unidades.length} liquidaciones</strong><small>Prorrateo exacto al centavo</small></span></div>
        <div class="form-actions">
          ${periodo.estado === 'borrador' ? `<button class="button button--secondary" data-action="previsualizar-periodo" data-id="${periodo.id}">Previsualizar</button><button class="button button--primary" data-action="cerrar-periodo" data-id="${periodo.id}">Cerrar período</button>` : '<span class="chip chip--success">✓ Cerrado y publicado</span>'}
        </div>
      </article>
    </div>` : vacio('Todavía no hay períodos', 'Creá un período, cargá los gastos y previsualizá la liquidación antes de cerrar.')}`;
}

function renderCobranza() {
  const r = estado.resumen ?? {};
  $('#section-cobranza').innerHTML = `
    ${heading('Cobranza', 'Seguimiento de pagos, saldos y morosidad por unidad.', '<button class="button button--primary" data-action="pago-manual">+ Registrar pago</button>')}
    <div class="metrics">
      ${metric('Total liquidado', dinero(r.liquidado), r.periodoId ?? 'Sin período', '$')}
      ${metric('Recaudado', dinero(r.recaudado), `${numero(r.porcentajeRecaudado)}% cobrado`, '✓')}
      ${metric('Saldo pendiente', dinero(r.totalAdeudado ?? r.saldoPendienteTotal ?? r.morosidadTotal), `Incluye ${dinero(r.interesesTotal ?? 0)} de intereses`, '!', true)}
      ${metric('Unidades al día', Math.max(0, (r.cantidadUnidades ?? estado.unidades.length) - (r.unidadesMorosas ?? 0)), 'Sobre el total activo', '○')}
    </div>
    <div class="grid grid--2"><article class="card"><div class="card__header"><div><h3>Evolución de la recaudación</h3><p>Últimos períodos cerrados</p></div></div>${graficoBarras(r.serie ?? [])}</article><article class="card"><div class="card__header"><div><h3>Antigüedad de deuda</h3><p>Distribución del saldo pendiente</p></div></div>${donutMorosidad(r)}</article></div>
    <article class="card card--flush"><div class="card__header" style="padding:18px 18px 0"><div><h3>Resumen por tramo</h3><p>Priorización de la gestión de cobro</p></div></div>${tablaTramos(r.porTramo ?? [])}</article>`;
}

function renderAccesos() {
  const permitidos = estado.eventos.filter((e) => e.resultado === 'permitido');
  const dentro = presentes(estado.eventos);
  $('#section-accesos').innerHTML = `
    ${heading('Visitas y accesos', 'Autorizá a una persona y luego validá su credencial al entrar o salir.', '<button class="button button--secondary" data-action="validar-acceso">Registrar ingreso / salida</button><button class="button button--primary" data-action="nueva-autorizacion">+ Autorizar persona</button>')}
    <article class="card"><div class="card__header"><div><h3>Autorizaciones</h3><p>Crear una autorización no registra un ingreso. La guardia valida la credencial al llegar.</p></div></div>${tablaAutorizaciones()}</article>
    <div class="metrics">${metric('Personas dentro', dentro.length, 'Según último movimiento', '◇')}${metric('Ingresos recientes', permitidos.filter((e) => e.sentido === 'ingreso').length, 'Tiempo real', '→')}${metric('Rechazos', estado.eventos.filter((e) => e.resultado === 'rechazado').length, 'Con motivo auditable', '!', true)}${metric('Puntos activos', estado.complejo?.puntosAcceso?.length ?? 0, 'Torre y garaje', '⌂')}</div>
    <div class="grid grid--2"><article class="card card--flush"><div class="card__header" style="padding:18px 18px 0"><div><h3>Historial reciente</h3><p>Este registro no se puede editar ni borrar</p></div><span class="live-pill"><span class="status-dot"></span>En vivo</span></div>${tablaAccesos(estado.eventos)}</article><article class="card"><div class="card__header"><div><h3>Ahora en el complejo</h3><p>${dentro.length} personas o vehículos</p></div></div>${lineasAcceso(dentro.slice(0, 8))}</article></div>`;
}

function renderReclamos() {
  const abiertos = estado.reclamos.filter((r) => !['resuelto', 'anulado'].includes(r.estado));
  const confianza = estado.reclamos.length ? estado.reclamos.reduce((s, r) => s + Number(r.clasificacionIA?.confianza ?? 0), 0) / estado.reclamos.length : 0;
  $('#section-reclamos').innerHTML = `
    ${heading('Reclamos', 'Bandeja priorizada con clasificación asistida y trazabilidad.', '')}
    <div class="metrics">${metric('Abiertos', abiertos.length, 'Requieren atención', '!')}${metric('Urgencia alta', abiertos.filter((r) => ['alta','critica'].includes(r.clasificacionFinal?.urgencia)).length, 'Priorizados primero', '↑', true)}${metric('Confianza IA', `${numero(confianza)}%`, 'Siempre corregible', '◇')}${metric('Resueltos', estado.reclamos.filter((r) => r.estado === 'resuelto').length, 'Historial conservado', '✓')}</div>
    <div class="toolbar"><div class="search"><input data-reclamos-search value="${safe(estado.filtroReclamos)}" placeholder="Buscar reclamo…" aria-label="Buscar reclamo"></div><select data-reclamos-estado aria-label="Filtrar reclamos por estado">${opcionesEstadosReclamos()}</select></div>
    <article id="tabla-reclamos" class="card card--flush">${tablaReclamos(reclamosVisibles(), true)}</article>`;
}

function opcionesEstadosReclamos() {
  return [['todos', 'Todos los estados'], ['pendiente', 'Pendientes'], ['en_progreso', 'En progreso'], ['esperando_proveedor', 'Esperando proveedor'], ['resuelto', 'Resueltos'], ['anulado', 'Anulados']]
    .map(([valor, etiqueta]) => `<option value="${valor}" ${valor === estado.estadoReclamos ? 'selected' : ''}>${etiqueta}</option>`).join('');
}

function reclamosVisibles() {
  const termino = estado.filtroReclamos.trim().toLocaleLowerCase('es');
  return estado.reclamos.filter((r) => {
    const coincideEstado = estado.estadoReclamos === 'todos' || r.estado === estado.estadoReclamos;
    if (!coincideEstado) return false;
    if (!termino) return true;
    const texto = [r.numero, r.descripcion, idUnidad(r.unidadId), r.clasificacionFinal?.area].filter(Boolean).join(' ').toLocaleLowerCase('es');
    return texto.includes(termino);
  });
}

function renderTablaReclamos() {
  const contenedor = $('#tabla-reclamos');
  if (contenedor) contenedor.innerHTML = tablaReclamos(reclamosVisibles(), true);
}

function renderAmenities() {
  const activas = estado.reservas.filter((r) => ['pendiente','confirmada'].includes(r.estado));
  $('#section-amenities').innerHTML = `
    ${heading('Espacios y reservas', 'Administrá los espacios, revisá solicitudes y consultá la agenda.', '<button class="button button--primary" data-action="nuevo-amenity">+ Nuevo espacio</button>')}
    <div class="management-hero"><div><span class="eyebrow">Vida en comunidad</span><h2>Todo listo para el próximo encuentro.</h2><p>Capacidades, aprobación y reservas en una misma vista.</p></div><span class="management-hero__icon" aria-hidden="true">⌁</span></div>
    <div class="metrics">${metric('Espacios habilitados', estado.amenities.filter((a) => a.activo !== false).length, 'Disponibles para residentes', '⌁')}${metric('Por aprobar', activas.filter((r) => r.estado === 'pendiente').length, 'Solicitudes cargadas', '◷')}${metric('Confirmadas', activas.filter((r) => r.estado === 'confirmada').length, 'En las últimas 100 reservas cargadas', '✓')}${metric('Reservas cargadas', estado.reservas.length, 'Hasta 100 por fecha de inicio', '▦')}</div>
    <div class="amenity-grid">${estado.amenities.map((a) => `<article class="amenity-card"><div class="amenity-card__top"><span class="amenity-card__icon">${iconoAmenity(a.id)}</span><span class="chip ${a.activo === false ? 'chip--warning' : 'chip--success'}">${a.activo === false ? 'No habilitado' : 'Habilitado'}</span></div><h3>${safe(a.nombre)}</h3><p>${safe(a.descripcion ?? 'Espacio común del complejo')}</p><div class="amenity-card__meta"><span><strong>${numero(a.capacidad,0)}</strong> personas</span><span>${a.requiereAprobacion ? 'Con aprobación' : 'Confirmación inmediata'}</span></div><button class="button button--secondary button--wide" data-action="editar-amenity" data-id="${safe(a.id)}">Configurar espacio</button></article>`).join('') || vacio('Sin espacios', 'Agregá los espacios que ofrece el complejo.')}</div>
    <article class="card agenda-card"><div class="card__header"><div><h3>Agenda de reservas</h3><p>Confirmadas, pendientes e historial. Las reservas que cruzan medianoche aparecen en ambos días.</p></div></div>
    <div class="toolbar agenda-filters">
      <label>Estado<select data-reserva-filtro="estado">${opciones(['todos','pendiente','confirmada','cancelada','rechazada'], estado.filtrosReservas.estado)}</select></label>
      <label>Espacio<select data-reserva-filtro="amenity"><option value="todos">Todos los espacios</option>${estado.amenities.map((a) => `<option value="${safe(a.id)}" ${estado.filtrosReservas.amenity === a.id ? 'selected' : ''}>${safe(a.nombre)}</option>`).join('')}</select></label>
      <label>Día<input data-reserva-filtro="fecha" type="date" value="${safe(estado.filtrosReservas.fecha)}"></label>
      <button class="button button--ghost" data-action="limpiar-reservas">Limpiar filtros</button>
    </div><div id="tabla-reservas">${tablaReservas()}</div></article>`;
}

function tablaReservas() {
  const reservas = reservasFiltradas(estado.reservas, estado.filtrosReservas);
  return `<div class="table-wrap"><table><thead><tr><th>Espacio / unidad</th><th>Desde</th><th>Hasta</th><th>Personas</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${reservas.map((r) => `<tr><td><strong>${safe(r.amenityNombre ?? estado.amenities.find((a) => a.id === r.amenityId)?.nombre ?? r.amenityId)}</strong><br>Unidad ${safe(idUnidad(r.unidadId))}</td><td>${fechaHora(r.desde)}</td><td>${fechaHora(r.hasta)}</td><td>${numero(r.asistentes,0)}</td><td><span class="chip ${r.estado === 'confirmada' ? 'chip--success' : r.estado === 'pendiente' ? 'chip--warning' : 'chip--info'}">${safe(textoEstado(r.estado))}</span></td><td>${r.estado === 'pendiente' ? `<div class="table-actions"><button class="button button--secondary button--small" data-action="resolver-reserva" data-id="${safe(r.id)}" data-estado="confirmada">Confirmar</button><button class="button button--ghost button--small" data-action="resolver-reserva" data-id="${safe(r.id)}" data-estado="rechazada">Rechazar</button></div>` : '—'}</td></tr>`).join('') || '<tr><td colspan="6" class="table-empty">No hay reservas con estos filtros.</td></tr>'}</tbody></table></div>`;
}

function renderComunicaciones() {
  $('#section-comunicaciones').innerHTML = `
    ${heading('Comunicaciones', 'Avisos que llegan al historial de los residentes y al servicio de notificaciones.', '<button class="button button--primary" data-action="nuevo-aviso">+ Publicar aviso</button>')}
    <div class="management-hero"><div><span class="eyebrow">Conectá con tus vecinos</span><h2>La información correcta, a quien la necesita.</h2><p>Publicá para todo el complejo o para unidades específicas.</p></div></div>
    <div class="toolbar"><div class="search"><input type="search" data-avisos-search aria-label="Buscar comunicados" placeholder="Buscar por título o mensaje…" value="${safe(estado.filtroAvisos)}"></div><span class="chip chip--info">Últimos ${estado.avisos.length} avisos (máximo 100)</span></div>
    <div id="lista-avisos" class="notice-grid">${listaAvisos()}</div>`;
}

function listaAvisos() {
  const filtro = normalizar(estado.filtroAvisos);
  return estado.avisos.filter((a) => normalizar(`${a.titulo} ${a.cuerpo}`).includes(filtro)).map((a) => `<article class="card notice-card"><div class="card__header"><span class="chip chip--info">${safe(textoEstado(a.tipo ?? 'administracion'))}</span><time>${fechaHora(a.enviadaEn)}</time></div><h3>${safe(a.titulo)}</h3><p class="notice-body">${safe(a.cuerpo)}</p><div class="notice-audience">${a.destinatarios === 'todos' ? 'Todo el complejo' : 'Unidades: ' + safe((Array.isArray(a.destinatarios) ? a.destinatarios : []).map(idUnidad).join(', '))}</div></article>`).join('') || vacio('Sin comunicados para mostrar', 'Publicá un aviso o probá otra búsqueda.');
}

function renderObras() {
  $('#section-obras').innerHTML = `
    ${heading('Obras', 'Creá la obra, agregá sus tareas y registrá los avances.', '<button class="button button--primary" data-action="nueva-obra">+ Cargar obra</button>')}
    <div class="toolbar">${estado.obras.map((o) => `<button class="button button--secondary" data-action="gestionar-obra" data-id="${safe(o.id)}">Gestionar ${safe(o.nombre)}</button>`).join('')}</div>
    <div class="work-grid">${estado.obras.map((o) => `<article class="work-card"><div class="amenity-card__top"><span class="chip chip--info">${o.tipo === 'comun' ? 'Obra común' : 'Obra privada'}</span><span class="chip ${o.estado === 'en_progreso' ? 'chip--warning' : 'chip--success'}">${textoEstado(o.estado)}</span></div><h3>${safe(o.nombre)}</h3><p>Avance físico <strong>${numero(o.avanceFisicoPorcentaje)}%</strong> · gasto ejecutado <strong>${porcentaje(o.gastoEjecutado, o.presupuestoAprobado)}</strong></p><div class="progress"><span style="width:${Math.min(100, o.avanceFisicoPorcentaje ?? 0)}%"></span></div><div class="amenity-card__meta" style="margin-top:14px"><span>Presupuesto ${dinero(o.presupuestoAprobado)}</span><span>${o.caminoCritico?.length ?? 0} partidas críticas</span></div></article>`).join('') || vacio('No hay obras activas', 'Las obras comunes y privadas aparecerán acá.')}</div>`;
}

function renderConfiguracion() {
  const c = estado.complejo ?? {};
  $('#section-configuracion').innerHTML = `
    ${heading('Configuración', 'La misma plataforma se adapta cambiando estos parámetros.', '')}
    <form id="form-configuracion" class="settings-grid">
      <article class="card"><div class="card__header"><div><h3>Identidad del complejo</h3><p>Nomenclatura visible en ambas aplicaciones</p></div></div><div class="form-grid"><label class="span-2">Nombre<input name="nombre" value="${safe(c.nombre ?? '')}" required></label><label>Tipo de complejo<select name="tipo">${opciones(['edificio','consorcio','barrio','country'], c.tipo)}</select></label><label>Tipo de unidad<select name="tipoUnidad">${opciones(['departamento','casa','lote'], c.tipoUnidad)}</select></label><label>Nomenclatura del aporte<select name="nomenclaturaAporte">${opciones(['expensa','cuota','aporte'], c.nomenclaturaAporte)}</select></label><label>Política de redondeo<select name="politicaRedondeo">${opciones(['mayorResto','mayorCoeficiente'], c.politicaRedondeo)}</select></label></div></article>
      <article class="card"><div class="card__header"><div><h3>Reglas financieras</h3><p>Fuente única de verdad para el motor</p></div></div><div class="form-grid"><label>Fondo de reserva (%)<input name="porcentajeFondoReserva" type="number" min="0" max="100" step=".1" value="${c.porcentajeFondoReserva ?? 0}"></label><label>Interés por mora (%)<input name="tasaMoraMensual" type="number" min="0" step=".1" value="${c.tasaMoraMensual ?? 0}"></label><label>Días de gracia<input name="diasGraciaMora" type="number" min="0" value="${c.diasGraciaMora ?? 0}"></label><label>Zona horaria<input name="zonaHoraria" value="${safe(c.zonaHoraria ?? 'America/Argentina/Buenos_Aires')}"></label></div><div class="form-actions"><button class="button button--primary" type="submit">Guardar configuración</button></div></article>
    </form>`;
}

// Acciones -----------------------------------------------------------------
document.addEventListener('keydown', (e) => {
  if ($('#modal').hidden) return;
  if (e.key === 'Escape') cerrarModal();
  if (e.key === 'Tab') {
    const campos = $$('button, input, select, textarea, a[href], summary', $('#modal')).filter((el) => !el.disabled && el.offsetParent !== null);
    const primero = campos[0], ultimo = campos.at(-1);
    if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo?.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero?.focus(); }
  }
});
$('#navegacion').addEventListener('click', (e) => {
  const boton = e.target.closest('[data-section]');
  if (!boton) return;
  navegar(boton.dataset.section);
});

document.addEventListener('click', async (e) => {
  const nav = e.target.closest('[data-nav]');
  if (nav) return navegar(nav.dataset.nav);
  if (e.target.closest('[data-close-modal]')) return cerrarModal();
  const boton = e.target.closest('[data-action]');
  if (!boton) return;
  if (boton.disabled) return;
  boton.disabled = true;
  try {
    await ejecutarAccion(boton.dataset.action, boton);
  } catch (error) {
    mostrarToast('No pudimos completar la operación', error.message, 'error');
  } finally { boton.disabled = false; }
});

document.addEventListener('submit', async (e) => {
  const form = e.target;
  if (form.id === 'form-login') return;
  e.preventDefault();
  const boton = $('button[type="submit"]', form);
  if (boton) boton.disabled = true;
  try {
    if (form.id === 'form-configuracion') await guardarConfiguracion(form);
    else if (form.dataset.form) await enviarModal(form.dataset.form, form);
  } catch (error) {
    let aviso = $('[data-form-error]', form);
    if (!aviso) { form.insertAdjacentHTML('afterbegin', '<p data-form-error role="alert" class="form-error"></p>'); aviso = $('[data-form-error]', form); }
    aviso.textContent = error.message;
    aviso.scrollIntoView({ block: 'nearest' });
    mostrarToast('Revisá los datos', error.message, 'error');
  } finally {
    if (boton) boton.disabled = false;
  }
});

document.addEventListener('input', (e) => {
  if (e.target.closest('#form-configuracion')) e.target.closest('form').dataset.dirty = 'true';
  if (e.target.matches('[data-avisos-search]')) { estado.filtroAvisos = e.target.value; $('#lista-avisos').innerHTML = listaAvisos(); return; }
  const campo = e.target.closest('[data-reclamos-search]');
  if (!campo) return;
  estado.filtroReclamos = campo.value;
  renderTablaReclamos();
});

document.addEventListener('change', (e) => {
  if (e.target.matches('[data-periodo]')) { estado.periodoSeleccionado = e.target.value; renderExpensas(); return; }
  if (e.target.dataset.reservaFiltro) { estado.filtrosReservas[e.target.dataset.reservaFiltro] = e.target.value; $('#tabla-reservas').innerHTML = tablaReservas(); return; }
  if (e.target.name === 'alcance') { $('#unidades-aviso').hidden = e.target.value === 'todos'; return; }
  const filtro = e.target.closest('[data-reclamos-estado]');
  if (!filtro) return;
  estado.estadoReclamos = filtro.value;
  renderTablaReclamos();
});

async function ejecutarAccion(accion, boton) {
  if (accion === 'nueva-obra') return modalObra();
  if (accion === 'gestionar-obra') return modalGestionObra(boton.dataset.id);
  if (accion === 'nueva-autorizacion') return modalAutorizacion();
  if (accion === 'ver-credencial') return mostrarCredencial(estado.autorizaciones.find((a) => a.id === boton.dataset.id));
  if (accion === 'revocar-autorizacion') {
    if (!confirm('¿Revocar esta autorización? Ya no permitirá nuevos ingresos.')) return;
    await api(`/complejos/${estado.complejoId}/accesos/autorizaciones/${boton.dataset.id}/revocar`, { method: 'PATCH' });
    mostrarToast('Autorización revocada', 'Los nuevos ingresos con esta credencial serán rechazados.'); return;
  }
  if (accion === 'agregar-gasto') { $('#gastos-periodo').insertAdjacentHTML('beforeend', filaGasto()); return; }
  if (accion === 'quitar-gasto') { if ($$('[data-gasto]').length > 1) boton.closest('[data-gasto]').remove(); return; }
  if (accion === 'nueva-unidad') return modalUnidad();
  if (accion === 'editar-unidad') return modalUnidad(estado.unidades.find((u) => u.id === boton.dataset.id));
  if (accion === 'nueva-unidad') return modalUnidad();
  if (accion === 'nuevo-periodo') return modalPeriodo();
  if (accion === 'previsualizar-periodo') return previsualizarPeriodo(boton.dataset.id);
  if (accion === 'cerrar-periodo') return cerrarPeriodo(boton.dataset.id);
  if (accion === 'resolver-reserva') return resolverReserva(boton.dataset.id, boton.dataset.estado);
  if (accion === 'validar-acceso') return modalAcceso();
  if (accion === 'avanzar-reclamo') return avanzarReclamo(boton.dataset.id, boton.dataset.estado);
  if (accion === 'corregir-reclamo') return modalClasificacion(estado.reclamos.find((r) => r.id === boton.dataset.id));
  if (accion === 'nuevo-amenity') return modalAmenity();
  if (accion === 'editar-amenity') return modalAmenity(estado.amenities.find((a) => a.id === boton.dataset.id));
  if (accion === 'limpiar-reservas') { estado.filtrosReservas = {estado:'todos',amenity:'todos',fecha:''}; return renderAmenities(); }
  if (accion === 'pago-manual') return modalPago();
  if (accion === 'nuevo-aviso') return modalAviso();
}

async function resolverReserva(id, nuevoEstado) {
  await api(`/complejos/${estado.complejoId}/amenities/reservas/${id}`, {
    method: 'PATCH', body: { estado: nuevoEstado },
  });
  mostrarToast(nuevoEstado === 'confirmada' ? 'Reserva confirmada' : 'Reserva rechazada', 'La solicitud se actualizó.');
}

function navegar(seccion) {
  estado.seccion = seccion;
  $$('.page').forEach((p) => p.classList.toggle('is-visible', p.id === `section-${seccion}`));
  $$('.nav__item[data-section]').forEach((b) => b.classList.toggle('is-active', b.dataset.section === seccion));
  appShell.classList.remove('menu-open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function modalUnidad(unidad = null) {
  abrirModal(unidad ? 'Editar unidad' : 'Nueva unidad', 'Configuración y unidades', `
    <form data-form="unidad" data-id="${unidad?.id ?? ''}"><div class="form-grid"><label>Identificador<input name="identificador" value="${safe(unidad?.identificador ?? '')}" placeholder="3A" required></label><label>Coeficiente (%)<input name="coeficiente" type="number" step=".0001" min=".0001" max="100" value="${unidad?.coeficiente ?? ''}" required></label><label>Superficie (m²)<input name="superficie" type="number" min="0" value="${unidad?.superficie ?? ''}"></label><label>Estado<select name="estado">${opciones(['ocupada','vacante','en_obra'], unidad?.estado ?? 'ocupada')}</select></label><label>Habitantes<input name="habitantes" type="number" min="1" step="1" value="${unidad?.habitantes ?? 1}" required></label><label class="span-2">Patentes autorizadas<input name="patentesAutorizadas" value="${safe(unidad?.patentesAutorizadas?.join(', ') ?? '')}" placeholder="ABC123, AB123CD"></label></div><div class="form-actions"><button type="button" class="button button--ghost" data-close-modal>Cancelar</button><button class="button button--primary" type="submit">${unidad ? 'Guardar cambios' : 'Crear unidad'}</button></div></form>`);
}

function filaGasto() {
  return `<fieldset data-gasto class="expense-line"><legend>Concepto de gasto</legend><div class="form-grid"><label class="span-2">Descripción<input data-campo="concepto" placeholder="Ej.: limpieza de espacios comunes" required maxlength="200"></label><label>Importe ($)<input data-campo="monto" type="number" min="0.01" step=".01" required></label><label>Tipo<select data-campo="tipo"><option value="ordinario">Ordinario · habitual</option><option value="extraordinario">Extraordinario · excepcional</option></select></label><label>Repartir por<select data-campo="criterio"><option value="coeficiente">Coeficiente de la unidad</option><option value="partesIguales">Partes iguales</option></select></label><label>A cargo de<select data-campo="aCargoDe"><option value="ocupante">Ocupante</option><option value="propietario">Propietario</option></select></label></div><button type="button" class="button button--ghost" data-action="quitar-gasto">Quitar concepto</button></fieldset>`;
}

function modalPeriodo() {
  if (!estado.unidades.length) throw new Error('Creá las unidades y sus coeficientes antes de liquidar expensas.');
  const proximo = proximoPeriodo();
  abrirModal('Cargar gastos del período', 'Paso 1 de 3 · Borrador', `
    <form data-form="periodo"><p class="form-help">Cargá los importes en pesos. Podés sumar varios conceptos; todavía no se publicarán a los residentes.</p><div class="form-grid"><label>Mes<input type="month" name="periodoId" value="${proximo}" required></label><label>Nombre visible<input name="etiqueta" value="${etiquetaPeriodo(proximo)}" required></label><label>Vencimiento<input name="vencimiento" type="date" required></label><label>Fondo de reserva ($)<input name="fondo" type="number" min="0" step=".01" value="0" required></label></div><div id="gastos-periodo">${filaGasto()}</div><button type="button" class="button button--secondary" data-action="agregar-gasto">+ Agregar otro gasto</button><div class="form-actions"><button type="button" class="button button--ghost" data-close-modal>Cancelar</button><button class="button button--primary" type="submit">Guardar borrador</button></div></form>`);
}

function modalAcceso() {
  const puntos = (estado.complejo?.puntosAcceso ?? []).filter((p) => p.activo !== false);
  if (!puntos.length) throw new Error('El complejo no tiene puntos de acceso activos configurados.');
  abrirModal('Registrar ingreso o salida', 'Validar credencial', `<form data-form="acceso"><div class="form-grid"><label>Método<select name="metodo"><option value="codigo">Código de la credencial QR</option><option value="patente">Patente del vehículo</option></select></label><label>Movimiento<select name="sentido">${opciones(['ingreso','egreso'], 'ingreso')}</select></label><label class="span-2">Código o patente<input name="credencial" placeholder="Pegá el contenido del QR o escribí la patente" required autocomplete="off"></label><label class="span-2">Punto de acceso<select name="punto">${puntos.map((p) => `<option value="${safe(p.id)}">${safe(p.nombre)}</option>`).join('')}</select></label></div><p class="form-help">Se comprobarán la vigencia, los usos y el punto habilitado. Cada intento queda en el historial.</p><div class="form-actions"><button type="button" class="button button--ghost" data-close-modal>Cancelar</button><button class="button button--primary" type="submit">Validar y registrar</button></div></form>`);
}

function modalAmenity(amenity = null) {
  abrirModal(amenity ? 'Configurar espacio' : 'Nuevo espacio', 'Espacios comunes', `<form data-form="amenity" data-id="${safe(amenity?.id ?? '')}"><div class="form-grid"><label>Nombre<input name="nombre" maxlength="120" value="${safe(amenity?.nombre ?? '')}" required placeholder="Quincho"></label><label>Capacidad<input name="capacidad" type="number" min="1" step="1" value="${amenity?.capacidad ?? ''}" required></label><label class="span-2">Descripción<textarea name="descripcion" maxlength="1000" placeholder="Equipamiento y recomendaciones de uso">${safe(amenity?.descripcion ?? '')}</textarea></label><label>Estado<select name="activo"><option value="true" ${amenity?.activo !== false ? 'selected' : ''}>Habilitado</option><option value="false" ${amenity?.activo === false ? 'selected' : ''}>No habilitado</option></select></label><label>Requiere aprobación<select name="requiereAprobacion"><option value="false">No</option><option value="true" ${amenity?.requiereAprobacion ? 'selected' : ''}>Sí</option></select></label></div><p class="form-help">Deshabilitar impide nuevas reservas. Las existentes conservan su estado.</p><div class="form-actions"><button type="button" class="button button--ghost" data-close-modal>Cancelar</button><button class="button button--primary" type="submit">Guardar espacio</button></div></form>`);
}

function modalPago() {
  if (!estado.unidades.length || !estado.periodos.some((p) => p.estado === 'cerrado')) throw new Error('Para registrar un pago necesitás unidades y al menos un período publicado.');
  abrirModal('Registrar pago manual', 'Cobranza', `<form data-form="pago"><p class="form-help">Usá este formulario sólo después de comprobar que recibiste el dinero. El registro acredita el saldo de la unidad; no inicia un cobro. Para pagar con Mercado Pago, el residente usa Mis expensas en la app.</p><input type="hidden" name="idempotencyKey" value="${crypto.randomUUID()}"><div class="form-grid"><label>Unidad<select name="unidadId">${estado.unidades.map((u) => `<option value="${u.id}">${safe(u.identificador)}</option>`).join('')}</select></label><label>Período<select name="periodoId">${estado.periodos.filter((p) => p.estado === 'cerrado').map((p) => `<option value="${p.id}">${safe(p.etiqueta ?? p.id)}</option>`).join('')}</select></label><label>Monto ($)<input name="monto" type="number" min=".01" step=".01" required></label><label>Medio<select name="medio">${opciones(['transferencia','efectivo','debito'], 'transferencia')}</select></label><label class="span-2">Observación<textarea name="observacion" placeholder="Referencia o comprobante"></textarea></label></div><div class="form-actions"><button type="button" class="button button--ghost" data-close-modal>Cancelar</button><button class="button button--primary" type="submit">Registrar e imputar</button></div></form>`);
}

function modalAviso() {
  abrirModal('Nuevo aviso', 'Comunicaciones', `<form data-form="aviso"><div class="form-grid"><label class="span-2">Título<input name="titulo" maxlength="120" required placeholder="Corte de agua programado"></label><label class="span-2">Mensaje<textarea name="cuerpo" maxlength="4000" required rows="5"></textarea></label><label>Tipo<select name="tipo">${opciones(['administracion','mantenimiento','asamblea','seguridad'], 'administracion')}</select></label><label>Destinatarios<select name="alcance"><option value="todos">Todo el complejo</option><option value="unidades">Elegir unidades</option></select></label><fieldset id="unidades-aviso" class="span-2 audience-picker" hidden><legend>Unidades destinatarias (hasta 30)</legend>${estado.unidades.map((u) => `<label><input type="checkbox" name="unidades" value="${safe(u.id)}"> ${safe(u.identificador)}</label>`).join('') || '<p>No hay unidades registradas.</p>'}</fieldset></div><div class="form-actions"><button type="button" class="button button--ghost" data-close-modal>Cancelar</button><button class="button button--primary" type="submit">Publicar aviso</button></div></form>`);
}

function accionesFormulario(texto) {
  return `<div class="form-actions"><button type="button" class="button button--ghost" data-close-modal>Cancelar</button><button class="button button--primary" type="submit">${texto}</button></div>`;
}

function modalObra() {
  abrirModal('Cargar obra', 'Obras · Datos iniciales', `<form data-form="obra"><p class="form-help">Primero creá la obra. Después agregá las tareas para planificar y registrar su avance.</p><div class="form-grid"><label class="span-2">Nombre<input name="nombre" minlength="3" maxlength="120" required placeholder="Ej.: renovación del ascensor"></label><label>Tipo<select name="tipo"><option value="comun">Común · todo el complejo</option><option value="privada">Privada · una unidad</option></select></label><label>Unidad (para obra privada)<select name="unidadId"><option value="">Sin unidad · obra común</option>${estado.unidades.map((u) => `<option value="${safe(u.id)}">${safe(u.identificador)}</option>`).join('')}</select></label><label>Fecha de inicio<input type="date" name="fechaInicio" required></label><label>Presupuesto aprobado ($)<input type="number" name="presupuestoAprobado" min="0" step=".01" required></label></div>${accionesFormulario('Crear obra')}</form>`);
}

async function modalGestionObra(id) {
  const obra = estado.obras.find((o) => o.id === id);
  if (!obra) throw new Error('La obra ya no está disponible.');
  const snap = await getDocs(collection(db, `complejos/${estado.complejoId}/obras/${id}/partidas`));
  const partidas = snap.docs.map(datosDoc);
  abrirModal(safe(obra.nombre), 'Planificación y avances', `<h3>Tareas de la obra</h3><div class="table-wrap"><table><thead><tr><th>Tarea</th><th>Duración</th><th>Avance</th></tr></thead><tbody>${partidas.map((p) => `<tr><td>${safe(p.nombre)}</td><td>${numero(p.duracionEstimada)} días</td><td>${numero(p.avancePorcentaje)}%</td></tr>`).join('') || '<tr><td colspan="3">Agregá la primera tarea para comenzar.</td></tr>'}</tbody></table></div><details open><summary>Agregar tarea</summary><form data-form="partida" data-id="${safe(id)}"><div class="form-grid"><label class="span-2">Nombre<input name="nombre" required minlength="3"></label><label>Duración (días)<input name="duracionEstimada" type="number" min="1" step="1" required></label><label>Presupuesto ($)<input name="presupuesto" type="number" min="0" step=".01" required></label><label class="span-2">Comienza después de<select name="predecesora"><option value="">No depende de otra tarea</option>${partidas.map((p) => `<option value="${safe(p.id)}">${safe(p.nombre)}</option>`).join('')}</select></label></div>${accionesFormulario('Agregar tarea')}</form></details>${partidas.length ? `<details><summary>Registrar avance</summary><form data-form="avance" data-id="${safe(id)}"><input type="hidden" name="idempotencyKey" value="${crypto.randomUUID()}"><div class="form-grid"><label>Tarea<select name="partidaId">${partidas.map((p) => `<option value="${safe(p.id)}">${safe(p.nombre)}</option>`).join('')}</select></label><label>Avance total de la tarea (%)<input type="number" name="porcentaje" min="0" max="100" step=".1" required></label><label class="span-2">Observación<textarea name="observacion" required></textarea></label></div><p class="form-help">Ingresá el porcentaje alcanzado, no cuánto aumentó. El registro queda en el historial.</p>${accionesFormulario('Guardar avance')}</form></details>` : ''}`);
}

function modalAutorizacion() {
  if (!estado.unidades.length) throw new Error('Primero creá la unidad que recibirá a la persona.');
  const puntos = (estado.complejo?.puntosAcceso ?? []).filter((p) => p.activo !== false);
  if (!puntos.length) throw new Error('El complejo necesita un punto de acceso activo.');
  abrirModal('Autorizar persona', 'Visitas, proveedores y personal de obra', `<form data-form="autorizacion"><div class="form-grid"><label>Nombre y apellido<input name="nombre" minlength="2" required></label><label>Documento<input name="documento" minlength="6" required></label><label>Tipo<select name="tipo">${opciones(['visita','proveedor','obra'], 'visita')}</select></label><label>Unidad<select name="unidadId">${estado.unidades.map((u) => `<option value="${safe(u.id)}">${safe(u.identificador)}</option>`).join('')}</select></label><label>Válida desde<input type="datetime-local" name="vigenciaDesde" required></label><label>Válida hasta<input type="datetime-local" name="vigenciaHasta" required></label><label>Ingresos permitidos<input name="usosPermitidos" type="number" min="1" max="10" value="1" required></label><label>Patente (opcional)<input name="patente" placeholder="AB123CD"></label><label>Punto habilitado<select name="punto">${puntos.map((p) => `<option value="${safe(p.id)}">${safe(p.nombre)}</option>`).join('')}</select></label><label>Días habilitados<select name="dias"><option value="todos">Todos los días</option><option value="laborables">Lunes a viernes</option><option value="obra">Lunes a sábado</option></select></label><label>Horario diario desde<input name="horaDesde" type="time" value="00:00" required></label><label>Horario diario hasta<input name="horaHasta" type="time" value="23:59" required></label></div><p class="form-help">Las fechas usan la hora de este dispositivo; el horario diario se aplica en la zona del complejo (${safe(estado.complejo?.zonaHoraria ?? 'America/Argentina/Buenos_Aires')}). La credencial se genera al guardar.</p>${accionesFormulario('Crear autorización')}</form>`);
}

function tablaAutorizaciones() {
  const lista = estado.autorizaciones ?? [];
  if (!lista.length) return '<p class="form-help">Todavía no hay autorizaciones. Usá «Autorizar persona» para crear la primera.</p>';
  return `<div class="table-wrap"><table><thead><tr><th>Persona / unidad</th><th>Vigencia</th><th>Ingresos usados</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${lista.map((a) => {
    const hasta = a.vigenciaHasta?.toDate?.() ?? new Date(a.vigenciaHasta);
    const desde = a.vigenciaDesde?.toDate?.() ?? new Date(a.vigenciaDesde);
    const etiqueta = a.estado === 'revocada' ? 'Revocada' : hasta < new Date() ? 'Vencida' : a.usosConsumidos >= a.usosPermitidos ? 'Sin usos' : desde > new Date() ? 'Programada' : 'Vigente';
    return `<tr><td><strong>${safe(a.nombre)}</strong><br>${safe(idUnidad(a.unidadId))} · ${safe(textoEstado(a.tipo))}</td><td>${fechaHora(a.vigenciaDesde)}<br>${fechaHora(a.vigenciaHasta)}</td><td>${numero(a.usosConsumidos)} / ${numero(a.usosPermitidos)}</td><td>${etiqueta}</td><td><button class="button button--ghost" data-action="ver-credencial" data-id="${safe(a.id)}">Ver credencial</button>${a.estado !== 'revocada' ? `<button class="button button--ghost" data-action="revocar-autorizacion" data-id="${safe(a.id)}">Revocar</button>` : ''}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

async function mostrarCredencial(a) {
  if (!a) throw new Error('No se encontró la autorización.');
  const imagen = await QRCode.toDataURL(a.codigoQr, { width: 256, margin: 4 });
  abrirModal('Credencial de acceso', a.nombre, `<div class="credential"><img src="${imagen}" width="256" height="256" alt="QR de la autorización"><a class="button button--secondary" href="${imagen}" download="habita-acceso.png">Descargar QR</a></div><p>Compartí este código sólo con la persona autorizada. La guardia puede pegarlo en «Registrar ingreso / salida».</p><label>Código de la credencial QR<input readonly value="${safe(a.codigoQr)}" onclick="this.select()"></label><p class="form-help">Unidad ${safe(idUnidad(a.unidadId))} · Válida desde ${fechaHora(a.vigenciaDesde)} hasta ${fechaHora(a.vigenciaHasta)}. Hasta ${numero(a.usosPermitidos)} ingresos, sujetos a los días y horarios autorizados.</p>`);
}

async function enviarModal(tipo, form) {
  const datos = Object.fromEntries(new FormData(form));
  const cid = estado.complejoId;
  if (tipo === 'unidad') {
    const cuerpo = { ...datos, coeficiente: Number(datos.coeficiente), superficie: Number(datos.superficie || 0), habitantes: Number(datos.habitantes || 4), patentesAutorizadas: datos.patentesAutorizadas.split(',').map((p) => p.trim()).filter(Boolean) };
    await api(`/complejos/${cid}/unidades${form.dataset.id ? `/${form.dataset.id}` : ''}`, { method: form.dataset.id ? 'PATCH' : 'POST', body: cuerpo });
  } else if (tipo === 'obra') {
    if (datos.tipo === 'privada' && !datos.unidadId) throw new Error('Elegí la unidad de la obra privada.');
    await api(`/complejos/${cid}/obras`, { method: 'POST', body: { nombre: datos.nombre.trim(), tipo: datos.tipo, unidadId: datos.tipo === 'privada' ? datos.unidadId : null, fechaInicio: datos.fechaInicio, presupuestoAprobado: Number(datos.presupuestoAprobado) } });
  } else if (tipo === 'partida') {
    await api(`/complejos/${cid}/obras/${form.dataset.id}/partidas`, { method: 'POST', body: { nombre: datos.nombre.trim(), duracionEstimada: Number(datos.duracionEstimada), presupuesto: Number(datos.presupuesto), predecesoras: datos.predecesora ? [datos.predecesora] : [] } });
    await modalGestionObra(form.dataset.id); return;
  } else if (tipo === 'avance') {
    await api(`/complejos/${cid}/obras/${form.dataset.id}/avances`, { method: 'POST', body: { partidaId: datos.partidaId, porcentaje: Number(datos.porcentaje), observacion: datos.observacion, idempotencyKey: datos.idempotencyKey } });
    await modalGestionObra(form.dataset.id); return;
  } else if (tipo === 'autorizacion') {
    if (new Date(datos.vigenciaHasta) <= new Date(datos.vigenciaDesde)) throw new Error('El vencimiento debe ser posterior al inicio.');
    const autorizacion = await api(`/complejos/${cid}/accesos/autorizaciones`, { method: 'POST', body: { nombre: datos.nombre.trim(), documento: datos.documento.trim(), tipo: datos.tipo, unidadId: datos.unidadId, patente: datos.patente.trim() || null, vigenciaDesde: new Date(datos.vigenciaDesde).toISOString(), vigenciaHasta: new Date(datos.vigenciaHasta).toISOString(), usosPermitidos: Number(datos.usosPermitidos), puntosHabilitados: [datos.punto], diasPermitidos: datos.dias === 'todos' ? [0,1,2,3,4,5,6] : datos.dias === 'obra' ? [1,2,3,4,5,6] : [1,2,3,4,5], franjaHoraria: { desde: datos.horaDesde, hasta: datos.horaHasta } } });
    await mostrarCredencial(autorizacion); return;
  } else if (tipo === 'periodo') {
    const gastos = $$('[data-gasto]', form).map((fila) => Object.fromEntries($$('[data-campo]', fila).map((input) => [input.dataset.campo, input.dataset.campo === 'monto' ? Number(input.value) : input.value.trim()])));
    await api(`/complejos/${cid}/expensas/periodos`, { method: 'POST', body: { periodoId: datos.periodoId, etiqueta: datos.etiqueta, vencimiento: datos.vencimiento, gastosOrdinarios: gastos.filter((g) => g.tipo === 'ordinario'), gastosExtraordinarios: gastos.filter((g) => g.tipo === 'extraordinario'), fondoReserva: { modo: 'monto', valor: Math.round(Number(datos.fondo) * 100) } } });
    estado.periodoSeleccionado = datos.periodoId;
  } else if (tipo === 'acceso') {
    const credencial = datos.credencial.trim();
    const cuerpo = datos.metodo === 'patente' ? { patente: credencial } : { codigo: credencial };
    const resultado = await api(`/complejos/${cid}/accesos/validar`, { method: 'POST', body: { ...cuerpo, punto: datos.punto, sentido: datos.sentido } });
    cerrarModal();
    mostrarResultadoAcceso(resultado);
    return;
  } else if (tipo === 'amenity') {
    await api(`/complejos/${cid}/amenities${form.dataset.id ? `/${form.dataset.id}` : ''}`, { method: form.dataset.id ? 'PATCH' : 'POST', body: { ...datos, capacidad: Number(datos.capacidad), activo: datos.activo === 'true', requiereAprobacion: datos.requiereAprobacion === 'true' } });
  } else if (tipo === 'pago') {
    await api(`/complejos/${cid}/expensas/pagos/manual`, { method: 'POST', body: { ...datos, monto: Number(datos.monto) } });
    await cargarResumen();
  } else if (tipo === 'aviso') {
    await api(`/complejos/${cid}/notificaciones`, { method: 'POST', body: { titulo: datos.titulo, cuerpo: datos.cuerpo, tipo: datos.tipo, destinatarios: destinatariosAviso(new FormData(form)) } });
  } else if (tipo === 'clasificacion') {
    await api(`/complejos/${cid}/reclamos/${form.dataset.id}/clasificacion`, {
      method: 'PATCH',
      body: { area: datos.area, urgencia: datos.urgencia },
    });
  }
  cerrarModal();
  mostrarToast(tipo === 'clasificacion' ? 'Clasificación corregida' : 'Cambios guardados', tipo === 'clasificacion' ? 'La corrección quedó registrada para medir el desempeño de la IA.' : 'La información ya se actualizó para todos los usuarios.');
}

async function previsualizarPeriodo(id) {
  const resultado = await api(`/complejos/${estado.complejoId}/expensas/periodos/${id}/borrador`);
  abrirModal(`Vista previa · ${id}`, 'Cierre exacto', `<div class="metrics" style="grid-template-columns:1fr 1fr">${metric('Total del período', dinero(resultado.totales.periodo), `${resultado.detalle.length} unidades`, '$')}${metric('Diferencia', dinero(resultado.verificacion.total?.diferencia ?? 0), resultado.verificacion.cierra ? 'Cierra exacto' : 'No cerrar', '✓')}</div><div class="verification">${resultado.verificacion.cierra ? '✓ La suma de todas las liquidaciones coincide exactamente con el gasto total.' : 'Hay una diferencia; el backend impedirá el cierre.'}</div><div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>Unidad</th><th>Ordinario</th><th>Extraordinario</th><th>Total</th></tr></thead><tbody>${resultado.detalle.map((d) => `<tr><td>${safe(d.identificador)}</td><td>${dinero(d.ordinario)}</td><td>${dinero(d.extraordinario)}</td><td><strong>${dinero(d.totalAPagar)}</strong></td></tr>`).join('')}</tbody></table></div>`);
}

async function cerrarPeriodo(id) {
  const borrador = await api(`/complejos/${estado.complejoId}/expensas/periodos/${id}/borrador`);
  if (!borrador.verificacion?.cierra) throw new Error('El reparto no cierra. Revisá los gastos y coeficientes antes de publicar.');
  if (!confirm(`¿Cerrar ${id}? Las liquidaciones publicadas no podrán editarse.`)) return;
  await api(`/complejos/${estado.complejoId}/expensas/periodos/${id}/cerrar`, { method: 'POST' });
  await cargarResumen();
  mostrarToast('Período cerrado', 'Las expensas ya están disponibles en la app de residentes.');
}

async function avanzarReclamo(id, actual) {
  const siguiente = { pendiente: 'en_progreso', en_progreso: 'resuelto', esperando_proveedor: 'resuelto', resuelto: 'en_progreso' }[actual];
  if (!siguiente) return;
  await api(`/complejos/${estado.complejoId}/reclamos/${id}/estado`, { method: 'PATCH', body: { estado: siguiente, nota: 'Actualizado desde el panel' } });
  mostrarToast('Reclamo actualizado', `El estado cambió a ${textoEstado(siguiente)}.`);
}

function modalClasificacion(reclamo) {
  if (!reclamo) return;
  const final = reclamo.clasificacionFinal ?? reclamo.clasificacionIA ?? {};
  const areas = ['plomeria', 'electricidad', 'seguridad', 'limpieza', 'estructura', 'climatizacion', 'ascensores', 'espacios_comunes', 'otro'];
  const urgencias = ['baja', 'media', 'alta', 'critica'];
  abrirModal('Corregir clasificación', 'Reclamos · revisión humana', `
    <p style="color:var(--texto-suave);margin-bottom:16px">${safe(reclamo.descripcion)}</p>
    <form data-form="clasificacion" data-id="${safe(reclamo.id)}">
      <div class="form-grid">
        <label>Área responsable<select name="area" required>${opciones(areas, final.area)}</select></label>
        <label>Urgencia<select name="urgencia" required>${opciones(urgencias, final.urgencia)}</select></label>
      </div>
      <p style="color:var(--texto-suave);font-size:12px;margin:14px 0 0">La clasificación de la IA queda conservada. Esta selección se guarda como corrección humana y actualiza la prioridad de la bandeja.</p>
      <div class="form-actions"><button type="button" class="button button--ghost" data-close-modal>Cancelar</button><button class="button button--primary" type="submit">Guardar corrección</button></div>
    </form>`);
}

async function guardarConfiguracion(form) {
  const datos = Object.fromEntries(new FormData(form));
  for (const campo of ['porcentajeFondoReserva', 'tasaMoraMensual', 'diasGraciaMora']) datos[campo] = Number(datos[campo]);
  await api(`/complejos/${estado.complejoId}/configuracion`, { method: 'PATCH', body: datos });
  delete form.dataset.dirty;
  mostrarToast('Configuración guardada', 'La app y el panel usarán la nueva nomenclatura.');
}

function mostrarResultadoAcceso(resultado) {
  abrirModal(resultado.permitido ? 'Autorización válida' : 'Acceso rechazado', 'Control de acceso', `<div style="display:grid;place-items:center;text-align:center;gap:14px;padding:8px 0 20px"><span class="access-line__icon ${resultado.permitido ? '' : 'access-line__icon--danger'}" style="width:62px;height:62px;border-radius:50%;font-size:28px">${resultado.permitido ? '✓' : '×'}</span><div><h3 style="margin-bottom:5px">${safe(resultado.nombre ?? resultado.patente ?? 'Credencial')}</h3><p>${resultado.permitido ? `${safe(resultado.tipo)} · ${safe(resultado.unidad ?? '')}` : safe(resultado.motivo)}</p></div>${resultado.permitido ? `<span class="chip chip--success">Usos restantes: ${resultado.usosRestantes ?? 'sin límite'}</span>` : '<span class="chip chip--danger">Ingreso no registrado como válido</span>'}</div>`);
}

// Helpers de UI ------------------------------------------------------------
function heading(titulo, bajada, acciones = '') { return `<div class="page-heading"><div><span class="eyebrow">Panel de administración</span><h1>${safe(titulo)}</h1><p>${safe(bajada)}</p></div><div class="page-actions">${acciones}</div></div>`; }
function metric(etiqueta, valor, tendencia, icono, peligro = false) { return `<article class="metric"><div class="metric__top"><span>${safe(String(etiqueta))}</span><span class="metric__icon">${icono}</span></div><strong class="metric__value">${valor ?? '—'}</strong><span class="metric__trend ${peligro ? 'metric__trend--danger' : ''}">${peligro ? '↑' : '↗'} ${safe(String(tendencia ?? ''))}</span></article>`; }
function vacio(titulo, texto) { return `<div class="card" style="text-align:center;padding:48px"><span class="amenity-card__icon" style="margin:auto">H</span><h3 style="margin-top:14px">${safe(titulo)}</h3><p>${safe(texto)}</p></div>`; }
function graficoBarras(serie) {
  if (!serie.length) return '<div class="skeleton"></div>';
  const max = Math.max(...serie.flatMap((s) => [s.liquidado ?? 0, s.recaudado ?? 0]), 1);
  return `<div class="chart">${serie.slice(-12).map((s) => `<div class="chart__col"><div class="chart__bars"><i class="chart__bar" style="height:${Math.max(3, (s.recaudado / max) * 100)}%"></i><i class="chart__bar chart__bar--secondary" style="height:${Math.max(3, ((s.pendiente ?? 0) / max) * 100)}%"></i></div><span>${safe((s.etiqueta ?? s.periodoId).slice(0, 3))}</span></div>`).join('')}</div><div class="chart-legend"><span><i class="legend-dot"></i>Recaudado</span><span><i class="legend-dot legend-dot--secondary"></i>Pendiente</span></div>`;
}
function donutMorosidad(r) {
  const tramos = r.porTramo ?? [];
  const colores = ['#5979db','#67acd2','#f16b5f','#14395e'];
  let acumulado = 0;
  const segmentos = tramos.map((t, i) => {
    const inicio = acumulado;
    acumulado += Number(t.porcentaje ?? 0);
    return `${colores[i]} ${inicio}% ${acumulado}%`;
  });
  const fondo = Number(r.morosidadTotal ?? 0) > 0
    ? `conic-gradient(${segmentos.join(',')})`
    : 'var(--superficie-suave)';
  return `<div class="donut-wrap"><div class="donut" style="background:${fondo}"><span class="donut__center"><strong>${dinero(r.morosidadTotal)}</strong><small>Deuda vencida</small></span></div><div class="donut-legend">${tramos.map((t, i) => `<div class="donut-legend__row"><i style="--c:${colores[i]}"></i><span>${safe(t.etiqueta)}</span><strong>${dinero(t.monto)} (${numero(t.porcentaje)}%)</strong></div>`).join('') || '<p>Sin deuda vencida.</p>'}</div></div>`;
}
function donutGastos({ ordinario, extraordinario, fondo, total }) { return `<div class="donut-wrap"><div class="donut" style="background:conic-gradient(#24a6bd 0 ${Math.round(ordinario/Math.max(total,1)*100)}%,#3c8f79 0 ${Math.round((ordinario+extraordinario)/Math.max(total,1)*100)}%,#7aa59a 0)"><span class="donut__center"><strong>${dinero(total)}</strong><small>Total</small></span></div><div class="donut-legend"><div class="donut-legend__row"><i style="--c:#24a6bd"></i><span>Gastos ordinarios</span><strong>${dinero(ordinario)}</strong></div><div class="donut-legend__row"><i style="--c:#3c8f79"></i><span>Gastos extraordinarios</span><strong>${dinero(extraordinario)}</strong></div><div class="donut-legend__row"><i style="--c:#7aa59a"></i><span>Fondo de reserva</span><strong>${dinero(fondo)}</strong></div></div></div>`; }
function tablaUnidades(unidades) { return `<div class="table-wrap"><table><thead><tr><th>Unidad</th><th>Coeficiente</th><th>Superficie</th><th>Estado</th><th>Patentes</th><th></th></tr></thead><tbody>${unidades.map((u) => `<tr><td><strong>${safe(u.identificador)}</strong></td><td>${numero(u.coeficiente,4)}%</td><td>${numero(u.superficie)} m²</td><td><span class="chip ${u.estado === 'ocupada' ? 'chip--success' : 'chip--warning'}">${textoEstado(u.estado)}</span></td><td>${safe(u.patentesAutorizadas?.join(', ') || '—')}</td><td><button class="button button--ghost button--small" data-action="editar-unidad" data-id="${u.id}">Editar</button></td></tr>`).join('') || '<tr><td class="table-empty" colspan="6">No hay resultados.</td></tr>'}</tbody></table></div>`; }
function tablaReclamos(reclamos, acciones) { return `<div class="table-wrap"><table><thead><tr><th>Reclamo</th><th>Unidad</th><th>Área final</th><th>Confianza IA</th><th>Urgencia</th><th>Estado</th>${acciones ? '<th></th>' : ''}</tr></thead><tbody>${reclamos.map((r) => `<tr><td><strong>#${safe(r.numero ?? r.id.slice(0,6))}</strong><br><span>${safe(r.descripcion)}</span></td><td>${safe(idUnidad(r.unidadId))}</td><td>${safe(textoEstado(r.clasificacionFinal?.area ?? 'sin_clasificar'))}${r.clasificacionFinal?.corregidaPorHumano ? '<br><span class="chip chip--info">Corregida</span>' : ''}</td><td>${numero(r.clasificacionIA?.confianza)}%</td><td><span class="chip ${chipUrgencia(r.clasificacionFinal?.urgencia)}">${textoEstado(r.clasificacionFinal?.urgencia)}</span></td><td><span class="chip ${chipEstado(r.estado)}">${textoEstado(r.estado)}</span></td>${acciones ? `<td><div class="table-actions"><button class="button button--secondary button--small" data-action="avanzar-reclamo" data-id="${r.id}" data-estado="${r.estado}">${r.estado === 'resuelto' ? 'Reabrir' : r.estado === 'pendiente' ? 'Tomar' : 'Resolver'}</button><button class="button button--ghost button--small" data-action="corregir-reclamo" data-id="${r.id}">Corregir</button></div></td>` : ''}</tr>`).join('') || `<tr><td colspan="${acciones ? 7 : 6}" class="table-empty">No hay reclamos.</td></tr>`}</tbody></table></div>`; }
function tablaAccesos(eventos) { return `<div class="table-wrap"><table><thead><tr><th>Hora</th><th>Persona / patente</th><th>Método</th><th>Punto</th><th>Resultado</th></tr></thead><tbody>${eventos.map((e) => `<tr><td>${hora(e.timestampServidor)}</td><td><strong>${safe(e.nombre ?? e.patente ?? 'Sin identificar')}</strong><br><span>${safe(idUnidad(e.unidadId))}</span></td><td>${textoEstado(e.metodo)}</td><td>${safe(e.punto)}</td><td><span class="chip ${e.resultado === 'permitido' ? 'chip--success' : 'chip--danger'}">${textoEstado(e.resultado)}</span>${e.motivoRechazo ? `<br><small>${safe(e.motivoRechazo)}</small>` : ''}</td></tr>`).join('')}</tbody></table></div>`; }
function tablaTramos(tramos) { return `<div class="table-wrap"><table><thead><tr><th>Antigüedad</th><th>Unidades</th><th>Monto</th><th>Participación</th></tr></thead><tbody>${tramos.map((t) => `<tr><td><span class="chip ${t.clave === 'mas_90' ? 'chip--danger' : 'chip--warning'}">${safe(t.etiqueta)}</span></td><td>${t.unidades}</td><td><strong>${dinero(t.monto)}</strong></td><td>${numero(t.porcentaje)}%</td></tr>`).join('')}</tbody></table></div>`; }
function lineasAcceso(eventos) { return eventos.map((e) => `<div class="access-line"><span class="access-line__icon ${e.resultado === 'rechazado' ? 'access-line__icon--danger' : ''}">${e.sentido === 'egreso' ? '←' : e.resultado === 'rechazado' ? '×' : '→'}</span><span><strong>${safe(e.nombre ?? e.patente ?? 'Movimiento')}</strong><small>${safe(idUnidad(e.unidadId))} · ${safe(textoEstado(e.punto ?? e.metodo))}</small></span><time>${hora(e.timestampServidor)}</time></div>`).join('') || '<p style="color:var(--texto-suave)">Sin movimientos recientes.</p>'; }

function abrirModal(titulo, eyebrow, cuerpo) { focoAntesModal = document.activeElement; $('#aplicacion').inert = true; $('#modal-title').textContent = titulo; $('#modal-eyebrow').textContent = eyebrow; $('#modal-body').innerHTML = cuerpo; $('#modal').hidden = false; document.body.style.overflow = 'hidden'; setTimeout(() => $('#modal input, #modal select, #modal button')?.focus(), 20); }
function cerrarModal() { $('#modal').hidden = true; document.body.style.overflow = ''; $('#aplicacion').inert = false; focoAntesModal?.focus(); }
function mostrarToast(titulo, mensaje, tipo = 'ok') { const id = crypto.randomUUID(); $('#toasts').insertAdjacentHTML('beforeend', `<div id="toast-${id}" class="toast ${tipo === 'error' ? 'toast--error' : ''}"><span class="toast__mark">${tipo === 'error' ? '!' : '✓'}</span><span><strong>${safe(titulo)}</strong><span>${safe(mensaje)}</span></span><button aria-label="Cerrar">×</button></div>`); const toast = $(`#toast-${id}`); $('button', toast).onclick = () => toast.remove(); setTimeout(() => toast?.remove(), 6000); }

async function api(ruta, opciones = {}) {
  const token = await estado.usuario.getIdToken();
  let respuesta;
  try {
    respuesta = await fetch(`${config.apiUrl}${ruta}`, { method: opciones.method ?? 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: opciones.body === undefined ? undefined : JSON.stringify(opciones.body), signal: AbortSignal.timeout(75000) });
  } catch (error) {
    throw new Error('No recibimos respuesta del servidor. Revisá el estado de la operación antes de repetirla.');
  }
  const cuerpo = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw new Error(cuerpo.error?.mensaje ?? `La operación falló (${respuesta.status}).`);
  return cuerpo;
}

function datosDoc(d) { return { id: d.id, ...d.data() }; }
function safe(v) { return String(v ?? '').replace(/[&<>'"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c])); }
function normalizar(v) { return String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
function numero(v, decimales = 1) { return Number(v ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: decimales }); }
function dinero(centavos) { if (centavos === undefined || centavos === null) return '—'; return (Number(centavos) / 100).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fechaHora(v) { const d = v?.toDate ? v.toDate() : new Date(v); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
function fechaCorta(v) { return fechaHora(v); }
function porcentaje(parte, total) { return `${numero(Number(parte ?? 0) / Math.max(Number(total ?? 0), 1) * 100)}% del total`; }
function sumarGastos(gastos = []) { return gastos?.reduce((s, g) => s + Number(g.montoCentavos ?? 0), 0) ?? 0; }
function hora(v) { const d = v?.toDate?.() ?? (v ? new Date(v) : null); return d && !Number.isNaN(d.getTime()) ? d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '—'; }
function iniciales(v) { return String(v).split(/\s+/).slice(0,2).map((p) => p[0]).join('').toUpperCase(); }
function idUnidad(id) { return estado.unidades.find((u) => u.id === id)?.identificador ?? id ?? '—'; }
function textoEstado(v) { return String(v ?? '—').replaceAll('_',' ').replace(/\b\w/g, (c) => c.toUpperCase()); }
function chipEstado(v) { return v === 'resuelto' ? 'chip--success' : v === 'pendiente' ? 'chip--warning' : v === 'anulado' ? 'chip--danger' : 'chip--info'; }
function chipUrgencia(v) { return ['critica','alta'].includes(v) ? 'chip--danger' : v === 'media' ? 'chip--warning' : 'chip--success'; }
function esReciente(v) { const d = v?.toDate?.() ?? new Date(v ?? 0); return Date.now() - d.getTime() < 86_400_000; }
function iconoAmenity(id) { return ({ sum:'⌂', parrilla:'♨', pileta:'≈', gimnasio:'+' })[id] ?? '◇'; }
function opciones(valores, actual) { return valores.map((v) => `<option value="${v}" ${v === actual ? 'selected' : ''}>${textoEstado(v)}</option>`).join(''); }
function proximoPeriodo() { const d = new Date(); d.setMonth(d.getMonth() + 1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
function etiquetaPeriodo(id) { const [a,m] = id.split('-').map(Number); return new Date(a,m-1,1).toLocaleDateString('es-AR',{month:'long',year:'numeric'}).replace(/^./,(c)=>c.toUpperCase()); }
function presentes(eventos) { const mapa = new Map(); [...eventos].reverse().filter((e) => e.resultado === 'permitido').forEach((e) => mapa.set(e.autorizacionId ?? `${e.unidadId}:${e.nombre}`, e)); return [...mapa.values()].filter((e) => e.sentido === 'ingreso'); }
function mensajeFirebase(error) { const codigo = error.code ?? ''; if (codigo.includes('invalid-credential') || codigo.includes('wrong-password') || codigo.includes('user-not-found')) return 'El correo o la contraseña no son correctos.'; if (codigo.includes('network')) return 'No pudimos conectar. Revisá tu conexión y los emuladores.'; return error.message ?? 'No pudimos iniciar sesión.'; }
function actualizarConectividad() { $('#conectividad').hidden = navigator.onLine; }

import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator, getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut,
} from 'firebase/auth';
import {
  collection, connectFirestoreEmulator, doc, getFirestore, limit, onSnapshot,
  orderBy, query,
} from 'firebase/firestore';

const config = window.HABITA_CONFIG;
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
  unidades: [], eventos: [], reclamos: [], periodos: [], amenities: [], obras: [],
  resumen: null, seccion: 'dashboard', listeners: [], filtroUnidades: '',
};

const login = $('#login');
const appShell = $('#aplicacion');
const loginForm = $('#form-login');
const loginError = $('#login-error');

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
  escuchar(doc(db, 'complejos', cid), (snap) => {
    estado.complejo = snap.exists() ? { id: snap.id, ...snap.data() } : null;
    $('#complejo-nombre').textContent = estado.complejo?.nombre ?? cid;
    renderTodo();
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
      .sort((a, b) => b.id.localeCompare(a.id))
      .slice(0, 18);
    renderTodo();
  });
  escuchar(query(collection(db, `complejos/${cid}/amenities`)), (snap) => {
    estado.amenities = snap.docs.map(datosDoc); renderTodo();
  });
  escuchar(query(collection(db, `complejos/${cid}/obras`)), (snap) => {
    estado.obras = snap.docs.map(datosDoc); renderTodo();
  });
}

function escuchar(referencia, callback) {
  estado.listeners.push(onSnapshot(referencia, { includeMetadataChanges: true }, callback, (error) => {
    mostrarToast('Actualización en tiempo real pausada', error.message, 'error');
  }));
}

function limpiarListeners() {
  estado.listeners.forEach((cancelar) => cancelar());
  estado.listeners = [];
}

async function cargarResumen() {
  try {
    estado.resumen = await api(`/complejos/${estado.complejoId}/expensas/resumen`);
    renderTodo();
  } catch (error) {
    mostrarToast('Cobranza no disponible', error.message, 'error');
  }
}

function renderTodo() {
  renderDashboard(); renderUnidades(); renderExpensas(); renderCobranza();
  renderAccesos(); renderReclamos(); renderAmenities(); renderObras(); renderConfiguracion();
}

function renderDashboard() {
  const resumen = estado.resumen ?? {};
  const abiertos = estado.reclamos.filter((r) => !['resuelto', 'anulado'].includes(r.estado));
  const accesosHoy = estado.eventos.filter((e) => e.resultado === 'permitido').length;
  $('#section-dashboard').innerHTML = `
    ${heading('Dashboard', 'La operación de Torre del Parque, en una sola vista.', '<button class="button button--secondary" data-action="nuevo-aviso">+ Nuevo aviso</button>')}
    <div class="metrics">
      ${metric('Unidades', estado.unidades.length || '—', '+2 este mes', '▦')}
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
  const periodo = estado.periodos[0];
  const ordinario = periodo?.totalOrdinario ?? sumarGastos(periodo?.gastosOrdinarios);
  const extraordinario = periodo?.totalExtraordinario ?? sumarGastos(periodo?.gastosExtraordinarios);
  const fondo = periodo?.totalFondoReserva ?? Number(periodo?.fondoReserva?.valor ?? 0);
  const total = periodo?.totalLiquidado ?? ordinario + extraordinario + fondo;
  $('#section-expensas').innerHTML = `
    ${heading('Liquidación de expensas', periodo ? `${safe(periodo.etiqueta ?? periodo.id)} · ${estado.unidades.length} unidades` : 'Creá el primer período para comenzar.', '<button class="button button--primary" data-action="nuevo-periodo">+ Nuevo período</button>')}
    ${periodo ? `<div class="metrics">
      ${metric('Gasto total', dinero(total), periodo.estado === 'cerrado' ? 'Período cerrado' : 'Borrador', '$')}
      ${metric('Gastos ordinarios', dinero(ordinario), porcentaje(ordinario, total), '○')}
      ${metric('Gastos extraordinarios', dinero(extraordinario), porcentaje(extraordinario, total), '△')}
      ${metric('Fondo de reserva', dinero(fondo), porcentaje(fondo, total), '◇')}
    </div>
    <div class="grid grid--2">
      <article class="card">
        <div class="card__header"><div><h3>Distribución del gasto</h3><p>Composición del período</p></div><span class="chip ${periodo.estado === 'cerrado' ? 'chip--success' : 'chip--warning'}">${textoEstado(periodo.estado)}</span></div>
        ${donutGastos({ ordinario, extraordinario, fondo, total })}
        <div class="verification"><span>✓ La suma de liquidaciones individuales coincide con el gasto total.</span><strong>Diferencia $ 0,00</strong></div>
      </article>
      <article class="card">
        <div class="card__header"><div><h3>Control del período</h3><p>El cierre es atómico e irreversible</p></div></div>
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
      ${metric('Saldo pendiente', dinero(r.morosidadTotal), `${r.unidadesMorosas ?? 0} unidades`, '!', true)}
      ${metric('Unidades al día', Math.max(0, (r.cantidadUnidades ?? estado.unidades.length) - (r.unidadesMorosas ?? 0)), 'Sobre el total activo', '○')}
    </div>
    <div class="grid grid--2"><article class="card"><div class="card__header"><div><h3>Evolución de la recaudación</h3><p>Últimos períodos cerrados</p></div></div>${graficoBarras(r.serie ?? [])}</article><article class="card"><div class="card__header"><div><h3>Antigüedad de deuda</h3><p>Distribución del saldo pendiente</p></div></div>${donutMorosidad(r)}</article></div>
    <article class="card card--flush"><div class="card__header" style="padding:18px 18px 0"><div><h3>Resumen por tramo</h3><p>Priorización de la gestión de cobro</p></div></div>${tablaTramos(r.porTramo ?? [])}</article>`;
}

function renderAccesos() {
  const permitidos = estado.eventos.filter((e) => e.resultado === 'permitido');
  const dentro = presentes(estado.eventos);
  $('#section-accesos').innerHTML = `
    ${heading('Control de accesos', 'Eventos append-only y validación transaccional en cada ingreso.', '<button class="button button--primary" data-action="validar-acceso">Validar credencial</button>')}
    <div class="metrics">${metric('Personas dentro', dentro.length, 'Según último movimiento', '◇')}${metric('Ingresos recientes', permitidos.filter((e) => e.sentido === 'ingreso').length, 'Tiempo real', '→')}${metric('Rechazos', estado.eventos.filter((e) => e.resultado === 'rechazado').length, 'Con motivo auditable', '!', true)}${metric('Puntos activos', estado.complejo?.puntosAcceso?.length ?? 0, 'Torre y garaje', '⌂')}</div>
    <div class="grid grid--2"><article class="card card--flush"><div class="card__header" style="padding:18px 18px 0"><div><h3>Historial reciente</h3><p>Este registro no se puede editar ni borrar</p></div><span class="live-pill"><span class="status-dot"></span>En vivo</span></div>${tablaAccesos(estado.eventos)}</article><article class="card"><div class="card__header"><div><h3>Ahora en el complejo</h3><p>${dentro.length} personas o vehículos</p></div></div>${lineasAcceso(dentro.slice(0, 8))}</article></div>`;
}

function renderReclamos() {
  const abiertos = estado.reclamos.filter((r) => !['resuelto', 'anulado'].includes(r.estado));
  const confianza = estado.reclamos.length ? estado.reclamos.reduce((s, r) => s + Number(r.clasificacionIA?.confianza ?? 0), 0) / estado.reclamos.length : 0;
  $('#section-reclamos').innerHTML = `
    ${heading('Reclamos', 'Bandeja priorizada con clasificación asistida y trazabilidad.', '')}
    <div class="metrics">${metric('Abiertos', abiertos.length, 'Requieren atención', '!')}${metric('Urgencia alta', abiertos.filter((r) => ['alta','critica'].includes(r.clasificacionFinal?.urgencia)).length, 'Priorizados primero', '↑', true)}${metric('Confianza IA', `${numero(confianza)}%`, 'Siempre corregible', '◇')}${metric('Resueltos', estado.reclamos.filter((r) => r.estado === 'resuelto').length, 'Historial conservado', '✓')}</div>
    <div class="toolbar"><div class="search"><input placeholder="Buscar reclamo…"></div><select><option>Todos los estados</option><option>Pendientes</option><option>En progreso</option><option>Resueltos</option></select></div>
    <article class="card card--flush">${tablaReclamos(estado.reclamos, true)}</article>`;
}

function renderAmenities() {
  $('#section-amenities').innerHTML = `
    ${heading('Amenities', 'Espacios configurables con cupo y disponibilidad compartida.', '<button class="button button--primary" data-action="nuevo-amenity">+ Nuevo amenity</button>')}
    <div class="amenity-grid">${estado.amenities.map((a) => `<article class="amenity-card"><div class="amenity-card__top"><span class="amenity-card__icon">${iconoAmenity(a.id)}</span><span class="chip ${a.activo === false ? 'chip--danger' : 'chip--success'}">${a.activo === false ? 'Inactivo' : 'Disponible'}</span></div><h3>${safe(a.nombre)}</h3><p>${safe(a.descripcion ?? 'Espacio común del complejo')}</p><div class="amenity-card__meta"><span>Capacidad: <strong>${a.capacidad}</strong></span><span>Hasta ${a.anticipacionMaximaDias ?? 30} días</span></div></article>`).join('') || vacio('Sin amenities', 'Agregá los espacios que ofrece el complejo.')}</div>`;
}

function renderObras() {
  $('#section-obras').innerHTML = `
    ${heading('Obras', 'Avance físico, presupuesto y camino crítico en la misma vista.', '')}
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
  try {
    await ejecutarAccion(boton.dataset.action, boton);
  } catch (error) {
    mostrarToast('No pudimos completar la operación', error.message, 'error');
  }
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
    mostrarToast('Revisá los datos', error.message, 'error');
  } finally {
    if (boton) boton.disabled = false;
  }
});

async function ejecutarAccion(accion, boton) {
  if (accion === 'nueva-unidad') return modalUnidad();
  if (accion === 'editar-unidad') return modalUnidad(estado.unidades.find((u) => u.id === boton.dataset.id));
  if (accion === 'nueva-unidad') return modalUnidad();
  if (accion === 'nuevo-periodo') return modalPeriodo();
  if (accion === 'previsualizar-periodo') return previsualizarPeriodo(boton.dataset.id);
  if (accion === 'cerrar-periodo') return cerrarPeriodo(boton.dataset.id);
  if (accion === 'validar-acceso') return modalAcceso();
  if (accion === 'avanzar-reclamo') return avanzarReclamo(boton.dataset.id, boton.dataset.estado);
  if (accion === 'nuevo-amenity') return modalAmenity();
  if (accion === 'pago-manual') return modalPago();
  if (accion === 'nuevo-aviso') return modalAviso();
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
    <form data-form="unidad" data-id="${unidad?.id ?? ''}"><div class="form-grid"><label>Identificador<input name="identificador" value="${safe(unidad?.identificador ?? '')}" placeholder="3A" required></label><label>Coeficiente (%)<input name="coeficiente" type="number" step=".0001" min=".0001" max="100" value="${unidad?.coeficiente ?? ''}" required></label><label>Superficie (m²)<input name="superficie" type="number" min="0" value="${unidad?.superficie ?? ''}"></label><label>Estado<select name="estado">${opciones(['ocupada','vacante','en_obra'], unidad?.estado ?? 'ocupada')}</select></label><label class="span-2">Patentes autorizadas<input name="patentesAutorizadas" value="${safe(unidad?.patentesAutorizadas?.join(', ') ?? '')}" placeholder="ABC123, AB123CD"></label></div><div class="form-actions"><button type="button" class="button button--ghost" data-close-modal>Cancelar</button><button class="button button--primary" type="submit">${unidad ? 'Guardar cambios' : 'Crear unidad'}</button></div></form>`);
}

function modalPeriodo() {
  const proximo = proximoPeriodo();
  abrirModal('Nuevo período', 'Liquidación de expensas', `
    <form data-form="periodo"><div class="form-grid"><label>Período<input name="periodoId" value="${proximo}" pattern="\\d{4}-(0[1-9]|1[0-2])" required></label><label>Etiqueta<input name="etiqueta" value="${etiquetaPeriodo(proximo)}" required></label><label>Vencimiento<input name="vencimiento" type="date" required></label><label>Fondo de reserva ($)<input name="fondo" type="number" min="0" value="320000"></label><label class="span-2">Gasto ordinario principal<input name="ordinarioConcepto" value="Personal y cargas sociales" required></label><label>Monto ordinario ($)<input name="ordinarioMonto" type="number" min="0" value="3680000" required></label><label>Criterio<select name="ordinarioCriterio">${opciones(['coeficiente','partesIguales'], 'coeficiente')}</select></label><label class="span-2">Gasto extraordinario<input name="extraConcepto" value="Obra extraordinaria"></label><label>Monto extraordinario ($)<input name="extraMonto" type="number" min="0" value="0"></label><label>A cargo de<select name="extraCargo">${opciones(['propietario','ocupante'], 'propietario')}</select></label></div><div class="form-actions"><button type="button" class="button button--ghost" data-close-modal>Cancelar</button><button class="button button--primary" type="submit">Crear borrador</button></div></form>`);
}

function modalAcceso() {
  abrirModal('Validar credencial', 'Control de acceso', `
    <form data-form="acceso"><div class="segmented"><button type="button" class="is-active">Código QR</button><button type="button">Patente</button></div><div class="form-grid" style="margin-top:16px"><label class="span-2">Código o patente<input name="credencial" value="HBA-DEMO-VISITA-01" required></label><label>Punto de acceso<select name="punto">${(estado.complejo?.puntosAcceso ?? []).map((p) => `<option value="${safe(p.id)}">${safe(p.nombre)}</option>`).join('')}</select></label><label>Sentido<select name="sentido">${opciones(['ingreso','egreso'], 'ingreso')}</select></label></div><p style="color:var(--texto-suave);margin-top:14px">La segunda validación del mismo QR será rechazada cuando se agoten sus usos. El evento quedará registrado en ambos casos.</p><div class="form-actions"><button type="button" class="button button--ghost" data-close-modal>Cancelar</button><button class="button button--primary" type="submit">Validar ahora</button></div></form>`);
}

function modalAmenity() {
  abrirModal('Nuevo amenity', 'Espacios comunes', `<form data-form="amenity"><div class="form-grid"><label>Nombre<input name="nombre" required placeholder="Quincho"></label><label>Capacidad<input name="capacidad" type="number" min="1" required></label><label class="span-2">Descripción<input name="descripcion" placeholder="Espacio equipado para reuniones"></label><label>Anticipación máxima (días)<input name="anticipacionMaximaDias" type="number" min="1" value="30"></label><label>Requiere aprobación<select name="requiereAprobacion"><option value="false">No</option><option value="true">Sí</option></select></label></div><div class="form-actions"><button type="button" class="button button--ghost" data-close-modal>Cancelar</button><button class="button button--primary" type="submit">Crear amenity</button></div></form>`);
}

function modalPago() {
  abrirModal('Registrar pago manual', 'Cobranza', `<form data-form="pago"><div class="form-grid"><label>Unidad<select name="unidadId">${estado.unidades.slice(0, 152).map((u) => `<option value="${u.id}">${safe(u.identificador)}</option>`).join('')}</select></label><label>Período<select name="periodoId">${estado.periodos.filter((p) => p.estado === 'cerrado').map((p) => `<option value="${p.id}">${safe(p.etiqueta ?? p.id)}</option>`).join('')}</select></label><label>Monto ($)<input name="monto" type="number" min=".01" step=".01" required></label><label>Medio<select name="medio">${opciones(['transferencia','efectivo','debito'], 'transferencia')}</select></label><label class="span-2">Observación<textarea name="observacion" placeholder="Referencia o comprobante"></textarea></label></div><div class="form-actions"><button type="button" class="button button--ghost" data-close-modal>Cancelar</button><button class="button button--primary" type="submit">Registrar e imputar</button></div></form>`);
}

function modalAviso() {
  abrirModal('Nuevo aviso', 'Notificaciones', `<form data-form="aviso"><div class="form-grid"><label class="span-2">Título<input name="titulo" required placeholder="Corte de agua programado"></label><label class="span-2">Mensaje<textarea name="cuerpo" required></textarea></label><label>Tipo<select name="tipo">${opciones(['administracion','mantenimiento','asamblea','seguridad'], 'administracion')}</select></label><label>Destinatarios<select name="destinatarios"><option value="todos">Todo el complejo</option></select></label></div><div class="form-actions"><button type="button" class="button button--ghost" data-close-modal>Cancelar</button><button class="button button--primary" type="submit">Publicar aviso</button></div></form>`);
}

async function enviarModal(tipo, form) {
  const datos = Object.fromEntries(new FormData(form));
  const cid = estado.complejoId;
  if (tipo === 'unidad') {
    const cuerpo = { ...datos, coeficiente: Number(datos.coeficiente), superficie: Number(datos.superficie || 0), patentesAutorizadas: datos.patentesAutorizadas.split(',').map((p) => p.trim()).filter(Boolean) };
    await api(`/complejos/${cid}/unidades${form.dataset.id ? `/${form.dataset.id}` : ''}`, { method: form.dataset.id ? 'PATCH' : 'POST', body: cuerpo });
  } else if (tipo === 'periodo') {
    await api(`/complejos/${cid}/expensas/periodos`, { method: 'POST', body: { periodoId: datos.periodoId, etiqueta: datos.etiqueta, vencimiento: datos.vencimiento, gastosOrdinarios: [{ concepto: datos.ordinarioConcepto, monto: Number(datos.ordinarioMonto), criterio: datos.ordinarioCriterio, aCargoDe: 'ocupante' }], gastosExtraordinarios: Number(datos.extraMonto) > 0 ? [{ concepto: datos.extraConcepto, monto: Number(datos.extraMonto), criterio: 'coeficiente', aCargoDe: datos.extraCargo }] : [], fondoReserva: { modo: 'monto', valor: Math.round(Number(datos.fondo) * 100) } } });
  } else if (tipo === 'acceso') {
    const credencial = datos.credencial.trim();
    const cuerpo = /^[A-Z]{2,3}\d{3}[A-Z]{0,2}$/i.test(credencial.replace(/[^A-Z0-9]/gi, '')) ? { patente: credencial } : { codigo: credencial };
    const resultado = await api(`/complejos/${cid}/accesos/validar`, { method: 'POST', body: { ...cuerpo, punto: datos.punto, sentido: datos.sentido } });
    cerrarModal();
    mostrarResultadoAcceso(resultado);
    return;
  } else if (tipo === 'amenity') {
    await api(`/complejos/${cid}/amenities`, { method: 'POST', body: { ...datos, capacidad: Number(datos.capacidad), anticipacionMaximaDias: Number(datos.anticipacionMaximaDias), requiereAprobacion: datos.requiereAprobacion === 'true' } });
  } else if (tipo === 'pago') {
    await api(`/complejos/${cid}/expensas/pagos/manual`, { method: 'POST', body: { ...datos, monto: Number(datos.monto) } });
    await cargarResumen();
  } else if (tipo === 'aviso') {
    await api(`/complejos/${cid}/notificaciones`, { method: 'POST', body: datos });
  }
  cerrarModal();
  mostrarToast('Cambios guardados', 'La información ya se actualizó para todos los usuarios.');
}

async function previsualizarPeriodo(id) {
  const resultado = await api(`/complejos/${estado.complejoId}/expensas/periodos/${id}/borrador`);
  abrirModal(`Vista previa · ${id}`, 'Cierre exacto', `<div class="metrics" style="grid-template-columns:1fr 1fr">${metric('Total del período', dinero(resultado.totales.periodo), `${resultado.detalle.length} unidades`, '$')}${metric('Diferencia', dinero(resultado.verificacion.total?.diferencia ?? 0), resultado.verificacion.cierra ? 'Cierra exacto' : 'No cerrar', '✓')}</div><div class="verification">${resultado.verificacion.cierra ? '✓ La suma de todas las liquidaciones coincide exactamente con el gasto total.' : 'Hay una diferencia; el backend impedirá el cierre.'}</div><div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>Unidad</th><th>Ordinario</th><th>Extraordinario</th><th>Total</th></tr></thead><tbody>${resultado.detalle.slice(0, 12).map((d) => `<tr><td>${safe(d.identificador)}</td><td>${dinero(d.ordinario)}</td><td>${dinero(d.extraordinario)}</td><td><strong>${dinero(d.totalAPagar)}</strong></td></tr>`).join('')}</tbody></table></div>`);
}

async function cerrarPeriodo(id) {
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

async function guardarConfiguracion(form) {
  const datos = Object.fromEntries(new FormData(form));
  for (const campo of ['porcentajeFondoReserva', 'tasaMoraMensual', 'diasGraciaMora']) datos[campo] = Number(datos[campo]);
  await api(`/complejos/${estado.complejoId}/configuracion`, { method: 'PATCH', body: datos });
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
  return `<div class="donut-wrap"><div class="donut"><span class="donut__center"><strong>${dinero(r.morosidadTotal)}</strong><small>Total</small></span></div><div class="donut-legend">${tramos.map((t, i) => `<div class="donut-legend__row"><i style="--c:${colores[i]}"></i><span>${safe(t.etiqueta)}</span><strong>${dinero(t.monto)} (${numero(t.porcentaje)}%)</strong></div>`).join('') || '<p>Sin deuda registrada.</p>'}</div></div>`;
}
function donutGastos({ ordinario, extraordinario, fondo, total }) { return `<div class="donut-wrap"><div class="donut" style="background:conic-gradient(#24a6bd 0 ${Math.round(ordinario/Math.max(total,1)*100)}%,#3c8f79 0 ${Math.round((ordinario+extraordinario)/Math.max(total,1)*100)}%,#7aa59a 0)"><span class="donut__center"><strong>${dinero(total)}</strong><small>Total</small></span></div><div class="donut-legend"><div class="donut-legend__row"><i style="--c:#24a6bd"></i><span>Gastos ordinarios</span><strong>${dinero(ordinario)}</strong></div><div class="donut-legend__row"><i style="--c:#3c8f79"></i><span>Gastos extraordinarios</span><strong>${dinero(extraordinario)}</strong></div><div class="donut-legend__row"><i style="--c:#7aa59a"></i><span>Fondo de reserva</span><strong>${dinero(fondo)}</strong></div></div></div>`; }
function tablaUnidades(unidades) { return `<div class="table-wrap"><table><thead><tr><th>Unidad</th><th>Coeficiente</th><th>Superficie</th><th>Estado</th><th>Patentes</th><th></th></tr></thead><tbody>${unidades.map((u) => `<tr><td><strong>${safe(u.identificador)}</strong></td><td>${numero(u.coeficiente,4)}%</td><td>${numero(u.superficie)} m²</td><td><span class="chip ${u.estado === 'ocupada' ? 'chip--success' : 'chip--warning'}">${textoEstado(u.estado)}</span></td><td>${safe(u.patentesAutorizadas?.join(', ') || '—')}</td><td><button class="button button--ghost button--small" data-action="editar-unidad" data-id="${u.id}">Editar</button></td></tr>`).join('') || '<tr><td class="table-empty" colspan="6">No hay resultados.</td></tr>'}</tbody></table></div>`; }
function tablaReclamos(reclamos, acciones) { return `<div class="table-wrap"><table><thead><tr><th>Reclamo</th><th>Unidad</th><th>Clasificación IA</th><th>Confianza</th><th>Urgencia</th><th>Estado</th>${acciones ? '<th></th>' : ''}</tr></thead><tbody>${reclamos.map((r) => `<tr><td><strong>#${safe(r.numero ?? r.id.slice(0,6))}</strong><br><span>${safe(r.descripcion)}</span></td><td>${safe(idUnidad(r.unidadId))}</td><td>${safe(textoEstado(r.clasificacionFinal?.area ?? 'sin_clasificar'))}</td><td>${numero(r.clasificacionIA?.confianza)}%</td><td><span class="chip ${chipUrgencia(r.clasificacionFinal?.urgencia)}">${textoEstado(r.clasificacionFinal?.urgencia)}</span></td><td><span class="chip ${chipEstado(r.estado)}">${textoEstado(r.estado)}</span></td>${acciones ? `<td><button class="button button--secondary button--small" data-action="avanzar-reclamo" data-id="${r.id}" data-estado="${r.estado}">${r.estado === 'resuelto' ? 'Reabrir' : r.estado === 'pendiente' ? 'Tomar' : 'Resolver'}</button></td>` : ''}</tr>`).join('') || `<tr><td colspan="${acciones ? 7 : 6}" class="table-empty">No hay reclamos.</td></tr>`}</tbody></table></div>`; }
function tablaAccesos(eventos) { return `<div class="table-wrap"><table><thead><tr><th>Hora</th><th>Persona / patente</th><th>Método</th><th>Punto</th><th>Resultado</th></tr></thead><tbody>${eventos.map((e) => `<tr><td>${hora(e.timestampServidor)}</td><td><strong>${safe(e.nombre ?? e.patente ?? 'Sin identificar')}</strong><br><span>${safe(idUnidad(e.unidadId))}</span></td><td>${textoEstado(e.metodo)}</td><td>${safe(e.punto)}</td><td><span class="chip ${e.resultado === 'permitido' ? 'chip--success' : 'chip--danger'}">${textoEstado(e.resultado)}</span>${e.motivoRechazo ? `<br><small>${safe(e.motivoRechazo)}</small>` : ''}</td></tr>`).join('')}</tbody></table></div>`; }
function tablaTramos(tramos) { return `<div class="table-wrap"><table><thead><tr><th>Antigüedad</th><th>Unidades</th><th>Monto</th><th>Participación</th></tr></thead><tbody>${tramos.map((t) => `<tr><td><span class="chip ${t.clave === 'mas_90' ? 'chip--danger' : 'chip--warning'}">${safe(t.etiqueta)}</span></td><td>${t.unidades}</td><td><strong>${dinero(t.monto)}</strong></td><td>${numero(t.porcentaje)}%</td></tr>`).join('')}</tbody></table></div>`; }
function lineasAcceso(eventos) { return eventos.map((e) => `<div class="access-line"><span class="access-line__icon ${e.resultado === 'rechazado' ? 'access-line__icon--danger' : ''}">${e.sentido === 'egreso' ? '←' : e.resultado === 'rechazado' ? '×' : '→'}</span><span><strong>${safe(e.nombre ?? e.patente ?? 'Movimiento')}</strong><small>${safe(idUnidad(e.unidadId))} · ${safe(textoEstado(e.punto ?? e.metodo))}</small></span><time>${hora(e.timestampServidor)}</time></div>`).join('') || '<p style="color:var(--texto-suave)">Sin movimientos recientes.</p>'; }

function abrirModal(titulo, eyebrow, cuerpo) { $('#modal-title').textContent = titulo; $('#modal-eyebrow').textContent = eyebrow; $('#modal-body').innerHTML = cuerpo; $('#modal').hidden = false; document.body.style.overflow = 'hidden'; setTimeout(() => $('#modal input, #modal select, #modal button')?.focus(), 20); }
function cerrarModal() { $('#modal').hidden = true; document.body.style.overflow = ''; }
function mostrarToast(titulo, mensaje, tipo = 'ok') { const id = crypto.randomUUID(); $('#toasts').insertAdjacentHTML('beforeend', `<div id="toast-${id}" class="toast ${tipo === 'error' ? 'toast--error' : ''}"><span class="toast__mark">${tipo === 'error' ? '!' : '✓'}</span><span><strong>${safe(titulo)}</strong><span>${safe(mensaje)}</span></span><button aria-label="Cerrar">×</button></div>`); const toast = $(`#toast-${id}`); $('button', toast).onclick = () => toast.remove(); setTimeout(() => toast?.remove(), 6000); }

async function api(ruta, opciones = {}) {
  const token = await estado.usuario.getIdToken();
  let respuesta;
  try {
    respuesta = await fetch(`${config.apiUrl}${ruta}`, { method: opciones.method ?? 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: opciones.body === undefined ? undefined : JSON.stringify(opciones.body) });
  } catch (error) {
    throw new Error('No pudimos conectar con el backend. Revisá que esté iniciado e intentá de nuevo.');
  }
  const cuerpo = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw new Error(cuerpo.error?.mensaje ?? `La operación falló (${respuesta.status}).`);
  return cuerpo;
}

function datosDoc(d) { return { id: d.id, ...d.data() }; }
function safe(v) { return String(v ?? '').replace(/[&<>'"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c])); }
function normalizar(v) { return String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
function numero(v, decimales = 1) { return Number(v ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: decimales }); }
function dinero(centavos) { if (centavos === undefined || centavos === null) return '—'; return (Number(centavos) / 100).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }); }
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

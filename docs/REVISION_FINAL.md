# Revision del proyecto finalizado

Fecha: 2026-09-15. Base revisada: `main`, commit `8b3a1db`.

## Alcance y resultado

Revision de bitacora, documentos de entrega y despliegue, y flujos sensibles del backend, reglas y clientes. No se modifico el comportamiento del producto ni se escribieron datos en produccion. La implementacion tiene una base amplia para el TP, pero quedan defectos de consistencia y tareas de entrega. Esta revision no equivale a una certificacion integral de seguridad ni a QA visual de todas las pantallas.

## Correcciones prioritarias

### P1: deuda anterior contada mas de una vez

En `backend/src/servicios/liquidacion.js:168`, el nuevo periodo guarda como `saldoPendiente` el total que ya incluye saldos anteriores e intereses. Los detalles anteriores conservan su deuda. `saldoYMora`, en la linea 226, vuelve a sumar todos esos saldos.

Reproduccion con los servicios reales y dobles de Firestore en memoria: una unidad con coeficiente 100, dos periodos consecutivos de 10000 centavos cada uno, sin pagos ni intereses. Luego de cerrar ambos, `estadoDeCuenta` devuelve 30000 centavos; corresponde 20000.

Propuesta: separar el cargo propio del periodo del saldo anterior mostrado en el comprobante. Cada obligacion debe existir una sola vez en la cuenta. Conservar la antiguedad original para mora e imputacion; no borrar deuda historica para disimular la suma. Evaluar los datos existentes antes de migrarlos.

Criterio de cierre: tests de servicio con tres periodos, pagos parciales, intereses y cierre posterior; capital pendiente igual a cargos menos pagos aplicados.

### P1: pagos distintos pueden sobrescribirse

En `backend/src/servicios/pagos.js:104`, la cuenta se lee antes de la transaccion. La imputacion tambien se calcula afuera (linea 118). La transaccion solo lee el documento del pago y escribe saldos absolutos calculados previamente (linea 150). La proteccion contra repetir el mismo pago no protege frente a dos pagos diferentes para una unidad.

Reproduccion con servicios y dobles en memoria: deuda de 10000 centavos y pagos concurrentes de 3000 y 4000. Ambos quedan procesados, pero el saldo termina en 6000, no 3000. La simulacion demuestra el calculo obsoleto; falta una prueba de concurrencia con el emulador real.

Propuesta: leer los saldos relevantes y recalcular la imputacion dentro de la transaccion, con un mecanismo compartido por unidad que tambien coordine los cierres. Agregar tests de dos pagos distintos, reintentos del mismo pago y pago concurrente con cierre.

### P1: avisos dirigidos no tienen aislamiento de destinatarios

En `backend/src/servicios/notificaciones.js:15`, el filtro de usuarios se aplica solo cuando la lista de destinatarios tiene exactamente una unidad. Con dos unidades se envian los tokens de todo el complejo. Ademas, `firebase/firestore.rules:259` permite a cualquier miembro del complejo leer todos los avisos, incluidos los dirigidos.

La interfaz actual del panel solo ofrece avisos a todo el complejo; el defecto afecta al contrato de la API que ya acepta listas. No se observo una filtracion real. Antes de habilitar avisos privados, filtrar todas las unidades destinatarias y restringir la lectura de documentos con reglas y consultas compatibles, o retirar expresamente esa modalidad del contrato. Agregar tests negativos con una tercera unidad.

### P2: cobranza del panel puede quedar desactualizada

`web/src/main.js:90` escucha varias colecciones, pero no los pagos ni el detalle de las cuentas. `cargarResumen` (linea 133) guarda una respuesta de API; los listeners solo vuelven a renderizarla. Un pago realizado desde otro dispositivo no dispara por si mismo una nueva consulta del resumen.

Propuesta: invalidar y volver a consultar el resumen ante pagos/cierres, controlando consultas repetidas. Verificar con dos sesiones: pagar desde residente y observar el panel sin recargar.

### P2: portada publicada desactualizada

`npm run verificar:servicios` falla en `landing`. La lectura del HTML publico confirma que la raiz publicada contiene una redireccion a `/panel`, no la landing existente en el repositorio.

Propuesta: comprobar la configuracion y los artefactos de Hosting, publicar la landing y repetir el chequeo y el recorrido del formulario. No se desplego durante esta revision.

## Mejoras de producto recomendadas

1. Completar reservas: fecha, horario, asistentes, listado de mis reservas, cancelacion y resolucion administrativa de solicitudes pendientes. `mobile/lib/presentacion/residente_shell.dart:1127` sigue enviando dos asistentes para la franja demo de manana.
2. Completar el ciclo de saldo a favor: el pago excedente se acumula en `unidad.saldoAFavor`, pero la liquidacion y la cuenta no lo descuentan. Cubrirlo junto con las correcciones contables, no solo mostrar una etiqueta.
3. Probar instalacion y acceso desde un telefono real. `mobile/lib/main.dart:25` usa `10.0.2.2` para Firebase en todo dispositivo no web cuando hay emuladores: sirve para el emulador Android, no para un telefono de la red local. Parametrizar ese host y verificar camara y notificaciones.
4. Agregar CI en GitHub para backend, reglas, web y Flutter, con tests de los servicios que conectan persistencia y dominio. La suite actual pasa sin detectar los dos escenarios contables anteriores.
5. Cerrar evidencias academicas: QA con otro equipo, video demo y material del pitch. Los guiones/checklists del repo no prueban que esas actividades ya se hayan realizado.

## Verificacion de esta sesion

- `npm test`: 82 pruebas aprobadas. El primer intento en sandbox fallo por `spawn EPERM`; la ejecucion autorizada termino correctamente.
- Reproducciones contables ejecutadas con dobles en memoria, sin acceso a Firestore ni usuarios reales. No son pruebas de integracion con emulador.
- `npm run verificar:servicios`: backend, Firestore, modo produccion, panel, CORS y sesion obligatoria correctos; landing incorrecta. Codigo de salida 1 por ese control.
- Estado informado por API: Mercado Pago simulado, IA activa, FCM activo, Maps simulado, BCRA publico. Configuracion activa no significa cobro, inferencia o entrega push comprobados.
- No se ejecutaron en esta sesion Flutter analyze/test, reglas con emulador, QA visual ni pruebas en telefono. Las verificaciones anteriores siguen documentadas en la bitacora con su fecha original.

## Orden sugerido

Primero consistencia contable y privacidad de avisos; despues actualizacion del panel y reservas completas; finalmente despliegue de la landing y evidencias de entrega. Mantener Mercado Pago simulado hasta disponer de credenciales y un entorno de prueba autorizado. No hace falta rehacer el proyecto ni agregar otro framework.

# Bitácora de Habita

Registro de continuidad para trabajar desde distintas computadoras y con distintas sesiones de IA. Las entradas nuevas van arriba. Cada agente debe leer `AGENTS.md` y completar su entrada al terminar.

## 2026-09-10 — Completar el flujo de autorización de visitas

### Objetivo

Dejar claro cómo una persona autorizada ingresa y permitir volver a mostrar su QR desde la lista de visitas.

### Estado inicial

El residente cargaba nombre y documento y recibía el QR sólo en el diálogo de creación. La lista no tenía una acción para recuperar ese código y la respuesta de la garita mostraba el nombre, pero no el documento para cotejarlo.

### Verificado

- El backend conserva el código QR aleatorio, la vigencia, los usos y el documento; el guardia valida el código con la cámara y recibe nombre, DNI, unidad y usos restantes.
- La ruta HTTP de creación respondió `201` con `codigoQr` de tipo texto; el registro temporal usado para comprobarlo se eliminó del emulador.
- `npm test`: 82 pruebas aprobadas.
- `flutter analyze`: sin problemas.
- `flutter test`: 4 tests aprobados.
- `flutter build web --release`: compilación web completada.
- El backend rechaza una autorización de visita sin DNI válido antes de escribirla; las autorizaciones de proveedor u obra mantienen su contrato flexible.

### Cambios

- `mobile/lib/presentacion/residente_shell.dart` muestra DNI, agrega “Mostrar QR para la garita” en cada autorización vigente y explica que ese QR se presenta en la entrada.
- `mobile/lib/presentacion/residente_shell.dart` evita dobles envíos mientras crea la autorización, valida los campos antes de llamar a la API y verifica que la respuesta contenga un QR renderizable antes de cerrar el diálogo.
- `mobile/lib/presentacion/guardia_shell.dart` muestra el DNI devuelto junto al nombre luego de un escaneo válido.
- `backend/src/rutas/accesos.js` normaliza nombre y DNI y exige el documento para el tipo `visita`.

### Pendiente

La cámara requiere un teléfono, webcam o emulador Android con cámara; el escáner de la garita no ingresa un DNI manualmente porque el QR es la credencial que el backend valida.

### Supuesto

El residente comparte el QR generado con la visita y la garita coteja visualmente el nombre y DNI que devuelve el backend antes de permitir el ingreso.

## 2026-09-10 — Mostrar disponibilidad y evitar duplicados en amenities

### Objetivo

Hacer visible el cupo de SUM, pileta, parrilla y gimnasio y evitar que una misma unidad consuma reservas superpuestas indefinidamente.

### Estado inicial

El backend ya rechazaba una reserva cuando la suma de asistentes superaba la capacidad, pero la app sólo escuchaba la colección de amenities y mostraba siempre “Disponible”. Además, las reservas pendientes no se contaban y una unidad podía crear varias reservas superpuestas para el mismo espacio.

### Verificado

- `npm test`: 82 pruebas aprobadas, incluyendo validación de intervalos y estados activos de reserva.
- `flutter analyze`: sin problemas.
- `flutter test`: 4 tests aprobados.
- En el backend local, una primera reserva de prueba informó `disponibles: 28` y el mismo intento repetido respondió `409 CONFLICTO` con el mensaje de duplicado.
- La reserva de prueba se eliminó del emulador; no se modificó Firebase Cloud.

### Cambios

- `backend/src/servicios/amenities.js` valida fechas, asistentes y capacidad; cuenta reservas confirmadas y pendientes; bloquea superposición de la misma unidad; devuelve ocupación y disponibles.
- `mobile/lib/presentacion/residente_shell.dart` escucha las reservas en tiempo real, calcula el cupo del horario demo, deshabilita “Reservar” cuando no hay lugares o la unidad ya está anotada y muestra `Disponibles mañana: X de Y`.
- `backend/test/amenities.test.js` cubre intervalos y reservas activas.

### Pendiente

La pantalla actual reserva el horario demo de mañana con dos asistentes; todavía no incluye selector de fecha, cantidad ni botón de cancelación. Para empezar una demo limpia, `npm run seed` recrea únicamente el escenario local y borra las reservas anteriores del emulador.

### Supuesto

Una reserva confirmada o pendiente ocupa capacidad, y una unidad no puede tener dos reservas superpuestas del mismo amenity; una reserva en otro horario sigue siendo válida.

## 2026-09-10 — Corregir QR dinámico de acceso en la app

### Objetivo

Resolver el error que impedía dibujar el QR de residente en Flutter: `TypeError: Instance of '_JsonMap': type '_JsonMap' is not a subtype of type 'String'`.

### Estado inicial

La ruta `POST /api/complejos/:complejoId/accesos/qr-dinamico` guardaba el objeto completo devuelto por `generarCodigoDinamico` dentro del campo `codigo`. Flutter esperaba que ese campo fuera la cadena que consume `QrImageView`.

### Verificado

- Con la sesión demo de `residente@habita.demo`, la ruta local devolvió `codigo` como cadena `HB1...`, `venceEnSegundos` numérico y `expiraEn` ISO.
- `npm test`: 80 pruebas aprobadas.
- `flutter analyze`: sin problemas.
- `flutter test`: 4 tests aprobados.
- Se reinició `flutter run -d web-server --web-port 9100` y quedó respondiendo por HTTP; el backend recargó el cambio automáticamente.

### Cambios

- `backend/src/rutas/accesos.js` ahora separa el código textual, usa el vencimiento calculado y expone `expiraEn`.
- `mobile/lib/presentacion/residente_shell.dart` valida el tipo de la respuesta y muestra un mensaje entendible si el contrato vuelve a ser inválido.
- `README.md` documenta la prueba con dos instancias Flutter (`9100` residente y `9101` guardia), porque Firebase Auth separa la sesión por origen.

### Pendiente

La lectura física con cámara en un dispositivo de guardia sigue requiriendo un teléfono o emulador Android compatible; el flujo local de generación ya queda listo para esa prueba. En esta sesión se dejó también una segunda instancia web en `http://localhost:9101/` para separar la sesión del guardia.

### Supuesto

El contrato público del endpoint debe conservar `codigo` como texto porque es el valor que se codifica visualmente y que luego valida el backend.

## 2026-09-10 — Unificar el identificador de Firebase con el proyecto Habita

### Objetivo

Corregir el enlace que muestra Firebase Emulator Suite para que apunte al proyecto real de la cuenta de Goiburu, manteniendo los datos de demo aislados en emuladores locales.

### Estado inicial

El proyecto real aparece en Firebase como **Habita**, con ID `habita-complejos-goiburu`, pero los valores locales usaban `habita-demo`. El usuario pidió entender por qué se usaba Firestore local y dejó los servicios abiertos para probar.

### Verificado

- `firebase projects:list` confirmó `Habita / habita-complejos-goiburu` en la cuenta autenticada.
- La separación queda explícita: el emulador puede usar el mismo ID como namespace y enlace visual, pero `npm run seed` sólo borra el Firestore/Auth local.
- `npm test`: 80 pruebas aprobadas; `flutter analyze`: sin problemas; `flutter test`: 4 tests aprobados.
- `npm run test:reglas`: 11 pruebas aprobadas después de liberar un proceso Java de Firestore que había quedado ocupando el puerto 8080.

### Cambios

- Se agregó `.firebaserc` con `habita-complejos-goiburu` como proyecto Firebase por defecto.
- Los defaults de emuladores, seed, reglas, backend, web y Flutter ahora usan ese ID real como referencia.
- `README.md` explica la diferencia entre emulador local y Firebase Cloud y prohíbe usar `npm run seed` contra producción.

### Pendiente

Conectar una sesión de la app directamente a Firebase Cloud requiere usar la configuración de producción, credenciales de servicio para el backend y usuarios reales/demo creados en el proyecto. No se habilita automáticamente para evitar escrituras o borrados accidentales.

### Supuesto

“Habita” es el nombre visible del proyecto y `habita-complejos-goiburu` es su ID técnico, según `firebase projects:list`.

### Comandos y resultado

La migración de referencias pasó las pruebas de backend, reglas y Flutter. Se reinició el emulador y su banner ahora muestra `habita-complejos-goiburu` y enlaza la consola correcta de Firebase.

## 2026-09-10 — Verificación integral local y guía de funcionamiento

### Objetivo

Ejecutar las verificaciones automatizadas y un recorrido local con emuladores, datos demo, API, landing y panel para documentar cómo funciona Habita y qué pruebas requieren un dispositivo o una persona.

### Estado inicial

`main` estaba publicado en `661a89a`. La landing y el formulario público ya estaban implementados; `docs/entrega/` continuaba fuera del repositorio por estar incompleto.

### Verificado

- `npm test`: 80 pruebas aprobadas.
- `npm run test:reglas`: 11 pruebas de Firestore y Storage aprobadas en un arranque limpio de emuladores. Las advertencias de `sun.misc.Unsafe` provienen del runtime Java del emulador y no cambian el resultado.
- `npm run build:web`: compilación del panel completada.
- `flutter analyze`: sin problemas; `flutter test`: 4 tests aprobados.
- `flutter devices`: esta PC sólo tiene Windows, Chrome y Edge; `flutter run -d chrome --web-port 9100` compiló y dejó la app Flutter web conectada al servicio de depuración. `flutter build web --release` también terminó correctamente.
- `npm run emu`: Auth, Firestore, Hosting y Storage quedaron listos en los puertos locales esperados. El script ya no intenta levantar Functions, que no forman parte del backend local y fallaban al leer las credenciales inválidas del `.env`.
- `npm run seed`: creó el escenario `torre-parque` con cinco cuentas demo, 152 unidades, amenities, accesos, reclamos, obra, avisos y una liquidación cerrada. Una consulta con Admin SDK confirmó 152 identificadores únicos y conservó la unidad demo `unidad-3a` como `3A`.
- Smoke test HTTP contra `http://127.0.0.1:8787/api`: salud `200`, contacto público `201`, métricas admin `200`, bloqueo de residente en métricas `403`, cuenta propia `200`, cuenta vecina `403`, creación de reclamo `201`, corrección humana `200`, dos usos permitidos del QR demo y tercer uso rechazado con motivo de usos agotados, presentes `200`.
- Recorrido visual del panel en `http://127.0.0.1:5000/panel`: login admin, Dashboard, Unidades, Reclamos con búsqueda y filtro, modal de corrección humana, Expensas y Accesos. El historial mostró los tres intentos del QR demo y el mensaje actualizado explica sus dos usos.
- `npm run verificar:servicios` comprobó en producción backend, Firestore, modo producción, panel, CORS y sesión obligatoria. La raíz publicada respondió `200`, pero todavía contiene la portada anterior que redirige a `/panel`; la landing nueva del repositorio aún necesita un deploy.

### Cambios

- `tools/sembrar.mjs` evita duplicar `3A` al reservar la posición de la unidad demo y mantiene los coeficientes del escenario.
- `tools/emuladores.mjs` inicia sólo los emuladores usados por la app local: Auth, Firestore, Hosting y Storage.
- `web/src/main.js` y `web/assets/js/app.js` explican que el QR demo permite dos usos y registra también el rechazo posterior.
- `docs/FASE_3_QA.md` y `docs/FASE_5_PITCH.md` alinean el caso de prueba y el guion con ese comportamiento real.
- Esta entrada documenta el recorrido completo y cómo reproducirlo desde otra computadora.

### Pendiente

Mercado Pago continúa pausado por el error del portal. La landing nueva requiere publicar el `main` actual en Firebase Hosting. La prueba física de Android, cámara/QR, notificaciones FCM y QA cruzado requieren un dispositivo o una persona externa. El video final y la exposición presencial también quedan fuera de una sesión automática.

### Supuesto

La verificación se hizo con Firebase Emulator Suite y proveedores simulados (`MP_ACCESS_TOKEN`, Gemini, Maps y FCM vacíos), por lo que demuestra el flujo local y las reglas de negocio, no una acreditación real de dinero, una notificación en un teléfono ni una integración externa productiva.

### Comandos y resultado

`npm run verificar` finalizó con código 0 e incluyó `tokens`, `marca`, `build:web`, las 80 pruebas de backend y las 11 pruebas de reglas. También finalizaron correctamente `flutter analyze`, `flutter test`, `flutter build web --release`, `npm run emu`, `npm run seed` y el smoke test HTTP. `npm run verificar:servicios` devolvió código 1 sólo por la landing publicada desactualizada; los otros seis controles pasaron y reportó Mercado Pago simulado. El primer intento aislado de `npm run test:reglas` fue bloqueado porque el recorrido visual todavía ocupaba los puertos 8080/9199; se cerró ese proceso y la ejecución siguiente pasó completa. El código y los ajustes funcionales quedaron publicados en `main` en `da9b7ba` (`test: verificar recorrido integral local`).

## 2026-09-10 — Avanzar Fase 4: landing y materiales de demo

### Objetivo

Continuar desde `main` y convertir la portada que hoy redirige al panel en una landing pública de Habita, con propuesta de valor, módulos, planes, captura real, CTA al panel y guion de demo enlazado.

### Estado inicial

La implementación técnica de Fase 2 está publicada y la preparación de QA de Fase 3 está documentada. `web/index.html` sólo redirigía a `/panel`; `docs/entrega/` contiene un generador de pitch incompleto y no se usará como fuente de publicación.

### Verificado

- La landing local responde `200` en `/`, `/landing.css` y `/landing.js`; se revisó visualmente en navegador y en viewport móvil.
- `npm test`: 80 pruebas aprobadas, incluida la ruta pública de contacto.
- `npm run build:web`: compilación del panel completada.
- `node --check web/landing.js` y `node --check tools/verificar-servicios.mjs`: sintaxis válida.
- `git diff --check`: sin errores de whitespace.

### Cambios

- `web/index.html` dejó de redirigir y ahora contiene la landing pública responsive con propuesta de valor, módulos, planes, demo guiada y formulario.
- `web/landing.css` define el sistema visual de la portada reutilizando tokens, fuentes y la captura real de app/panel.
- `web/landing.js` conecta el formulario con `POST /api/contacto` y muestra estados de éxito o error.
- `backend/src/rutas/publico.js` valida límites de nombre, correo, mensaje y tipo, y conserva el tipo de complejo en el contacto.
- `backend/test/publico.test.js` cubre el contrato público con un caso inválido y uno válido.
- `tools/verificar-servicios.mjs` comprueba también que la landing publicada esté disponible.
- Se agregaron `docs/FASE_4_LANZAMIENTO.md` y `docs/FASE_5_PITCH.md`, y se actualizaron README y producción con las rutas nuevas.

### Pendiente

El video demo final y la presentación presencial requieren grabación y exposición humana. Mercado Pago continúa pausado por el error del portal.

### Comandos y resultado

`npm run build:web`, `npm test`, los chequeos de sintaxis y la comprobación HTTP local finalizaron con código 0. No se desplegó producción en esta sesión; el cambio queda listo para el próximo deploy. Commit funcional: `e969b98` (`feat: publicar landing y preparar lanzamiento`); cierre de bitácora: `41dd87b`. `docs/entrega/` sigue fuera del commit por estar incompleto.

## 2026-09-10 — Preparar Fase 3 y continuidad de QA

### Objetivo

Continuar el trabajo desde `main`, dejar Mercado Pago en pausa por el error del portal y avanzar todo lo posible hacia la Fase 3 con una mejora funcional y un checklist reproducible.

### Estado inicial

La Fase 2 ya estaba integrada y publicada en `main` en `ef83278`. El backend tenía el endpoint para corregir la clasificación de reclamos, pero el panel sólo permitía cambiar el estado. `docs/entrega/` sigue siendo un generador de pitch incompleto y queda fuera del alcance de esta sesión.

### Verificado

- `npm test`: 79 pruebas aprobadas.
- `npm run test:reglas`: 11 pruebas de Firestore y Storage aprobadas en emuladores oficiales.
- `npm run build:web`: compilación del panel completada.
- `mobile/flutter analyze`: sin problemas.
- `mobile/flutter test`: 4 tests aprobados.

### Cambios

- El panel expone la corrección humana de área y urgencia en `web/src/main.js`; llama a `PATCH /reclamos/:id/clasificacion` y conserva la clasificación IA.
- La bandeja de reclamos ahora filtra por texto y estado sin perder el foco ni recargar toda la sección.
- Se agregó el estilo de acciones múltiples de la tabla en `web/assets/css/app.css` y se regeneró `web/assets/js/app.js`.
- Se agregó `docs/FASE_3_QA.md` con casos por rol, seguridad, pagos demo, accesibilidad responsive, recuperación de conexión y ficha de bugs.
- Se actualizaron `docs/FASE_2_ENTREGA.md` y esta bitácora para reflejar que la preparación de Fase 3 está iniciada y que Fase 2 ya está en `ef83278`.

### Pendiente

El QA cruzado real requiere otra persona o equipo y no se debe marcar como ejecutado sin evidencia. Mercado Pago queda pausado hasta que el portal permita activar credenciales de prueba.

### Comandos y resultado

`npm run build:web`, `npm test`, `npm run test:reglas`, `flutter analyze` y `flutter test` finalizaron con código 0. El generador incompleto de `docs/entrega/` no se incluyó en estos cambios. Cambios funcionales publicados en `main`: `c838c68` (`feat: preparar qa de reclamos y continuidad de fase 3`); cierre de esta bitácora: `0ab7f60`.

## 2026-09-10 — Integrar la última Fase 2 en `main`

### Objetivo

Reunir los cambios de Fase 2 que estaban en esta PC, validarlos y publicarlos en `main` para continuar desde cualquier computadora.

### Estado inicial

`main` estaba actualizado sólo con la documentación de continuidad. Había cambios locales sin commit de pagos demo, seguridad de roles, accesos, reglas, documentación de producción y pruebas. El directorio `docs/entrega` contenía únicamente un generador de pitch incompleto y quedó fuera de esta integración.

### Verificado

- Backend: 79 pruebas aprobadas.
- Firestore y Storage: 11 pruebas de reglas aprobadas en emuladores oficiales.
- Flutter: `flutter analyze` sin problemas y 4 tests aprobados.
- Panel: `npm run build:web` completó correctamente.
- La suite incluye controles para aislamiento de usuarios, puntos de acceso, egresos sin usos restantes, pagos demo y bloqueo de rutas según el estado de Mercado Pago.

### Cambios integrados

Se prepararon para commit los cambios de Fase 2 en backend, reglas, app móvil, pruebas, configuración y documentación. El destino es `main`, según la preferencia permanente del proyecto.

Commit publicado: `ef83278` (`feat: integrar correcciones y demo de fase 2`).

### Pendiente

QA cruzado con otro equipo, prueba presencial completa de app y panel, landing, video demo, pitch y reintento de activación externa de Mercado Pago. La simulación de pagos no se presenta como integración externa verificada.

## Estado rápido

- Rama principal del proyecto: `main`. La rama temporal `codex/retomar-fase-2` se usó durante la recuperación y no debe ser el destino normal de nuevas sesiones.
- Base histórica del código retomado: commit `1f8945a` (`docs: ordenar activacion gratuita de integraciones`). La documentación de continuidad se agregó en `0e399bd` (`docs: agregar contexto y bitacora para continuidad`) y la preferencia de trabajar en `main` quedó fijada en `22b5f12`.
- Fase: transición de Fase 2 hacia preparación de Fases 3 a 5.
- Mercado Pago: la aplicación `Habita TP` existe, pero la activación de credenciales de prueba devuelve “Algo salió mal” en el portal. El código conserva modo simulado autenticado.
- Firebase/Render: hay un despliegue preparado y una comprobación de solo lectura documentada en `docs/PRODUCCION.md`.
- Seguridad: los cambios de aislamiento de usuarios y accesos ya están integrados y cubiertos por las suites de backend y reglas en `ef83278`.
- Preferencia de flujo: desde esta entrada, los cambios terminados y verificados se integran directamente en `main`; no crear ramas nuevas sin pedido explícito.

## 2026-09-10 — Retomar Fase 2 y preparar continuidad

### Objetivo

Continuar Habita desde el bloqueo de Mercado Pago y dejar el repositorio listo para trabajar desde otra PC con contexto persistente.

### Verificado

- Se revisaron `README.md`, `docs/TAREA_CONTEXTO.md`, `docs/PROYECTO_CONTEXTO.md`, `docs/FASE_2_ENTREGA.md` y `docs/PRODUCCION.md`.
- Se recuperó el trabajo pendiente de la sesión anterior en la rama `codex/retomar-fase-2`, sin eliminar cambios locales.
- El backend pasó 68 pruebas automatizadas.
- Las reglas de Firestore y Storage pasaron 8 pruebas en emuladores oficiales.
- `npm run verificar:servicios` respondió correctamente para backend, Firestore, panel, CORS y rechazo de consultas sin sesión; informó Mercado Pago simulado, IA activa, FCM activo, Maps simulado y BCRA público.
- Flutter informó `flutter analyze` sin problemas y `flutter test` con 4 pruebas aprobadas en la sesión de Android.
- La app de Mercado Pago mostró que `Habita TP` tiene cuentas de prueba creadas, pero la activación de credenciales de prueba sigue fallando en el proveedor.
- La documentación oficial consultada indica que Checkout Pro puede probarse con cuentas separadas de vendedor y comprador; el access token debe mantenerse fuera del repositorio.

### Cambios locales observados

- Modo de pago demo autenticado y con confirmación explícita en app móvil.
- Middleware que bloquea pagos simulados cuando existe `MP_ACCESS_TOKEN` y bloquea el webhook externo cuando Mercado Pago está simulado.
- Pruebas HTTP y de modo de pagos.
- Correcciones de aislamiento de usuarios, restricciones de puntos de acceso y egreso, con pruebas asociadas.
- Ajustes de reglas y documentación de producción.

### Pendiente

- Revisar el diff completo y crear un commit coherente de código después de validar las correcciones de seguridad.
- Completar QA cruzado con otro grupo o registrar formalmente los casos ejecutados por una persona externa.
- Capturar una prueba real de app y panel para la demo.
- Completar landing, video demo y pitch; marcar como presenciales los pasos que no pueda ejecutar una IA.
- Reintentar Mercado Pago sólo desde la cuenta y flujo de pruebas documentados por el proveedor. No usar credenciales productivas ni inventar valores.

### Próxima sesión recomendada

1. Leer esta bitácora y `AGENTS.md`.
2. Ejecutar `git status --short --branch` y revisar todos los cambios pendientes.
3. Levantar emuladores, ejecutar `npm run seed` sólo en local y levantar backend/panel.
4. Verificar residente, guardia y administración con las cuentas demo del README.
5. Ejecutar las pruebas correspondientes y agregar el resultado a esta entrada o a una nueva.

## Plantilla para cada sesión

```markdown
## AAAA-MM-DD — Título breve

### Objetivo

### Estado inicial

### Verificado

### Cambios

### Pendiente

### Comandos y resultado
```

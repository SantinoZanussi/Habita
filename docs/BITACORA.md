## 2026-09-15 - Expansión de funcionalidades (Fase 4+)

- Objetivo: Iniciar el análisis y planificación de nuevas funciones de gran alcance solicitadas por el usuario: reconocimiento de patentes para guardias, historial de notificaciones, cupos familiares y cuentas individuales para amenities, y desglose de gastos en las expensas.
- Estado inicial: App y backend funcionales. APK recién compilada con la redirección directa a Mercado Pago corregida.
- Pendiente: Investigar el código base para crear un plan de implementación detallado para cada una de las funcionalidades solicitadas sin romper el aislamiento multi-tenant ni depender innecesariamente de paquetes externos.

## 2026-09-16 - Mejoras de uso y corrección de notificaciones

- Objetivo: corregir fallas observadas en notificaciones y mejorar ingreso y precisión de importes en la app.
- Estado inicial: copia de archivos sin directorio `.git`; `git status` y `git log` fallan con `not a git repository`. No es posible sincronizar ni publicar en main desde esta copia. Se preserva el contenido existente.
- Verificado: historial con ruta `complejos//notificaciones`; novedades sin filtro de destinatarios requerido por las reglas; importes mostrados sin centavos.
- Cambios: [residente_shell.dart](../mobile/lib/presentacion/residente_shell.dart) conecta la campana, comparte el filtro por destinatarios entre inicio e historial y corrige la ruta; agrega selección de fecha/hora, duración de 1 a 8 horas, asistentes, próximas reservas y cancelación confirmada. Fechas enviadas en UTC, cupos/permisos siguen en backend; bloqueo de envíos simultáneos y liberación del controlador de reclamos.
- Cambios: [login.dart](../mobile/lib/presentacion/login.dart) agrega recuperación por Firebase Auth, mensajes sin revelar existencia de cuenta y mostrar/ocultar contraseña; [widgets.dart](../mobile/lib/presentacion/widgets.dart) conserva centavos y formato monetario argentino.
- Cambios: [api.dart](../mobile/lib/nucleo/api.dart) usa Render como URL predeterminada cuando los emuladores están deshabilitados, espera hasta 75 segundos, valida token y distingue timeout/servidor no disponible. No reintenta escrituras automáticamente; informa resultados inciertos. [AGENTS.md](../AGENTS.md) registra la prioridad permanente de Render/Firebase reales.
- Verificado: `flutter analyze --no-pub` sin incidencias con Flutter 3.47.4, preparado en `%TEMP%/habita-flutter-3.47.4` sin reemplazar el SDK instalado. Pruebas aprobadas de login, formato de importes, filtros de avisos, reserva con asistentes y horario UTC, cancelación, petición autenticada, timeout sin reintento y respuesta 503. Reserva comprobada por widget a 390 px de ancho. Archivos: [login_test.dart](../mobile/test/login_test.dart), [importes_test.dart](../mobile/test/importes_test.dart), [reservas_avisos_test.dart](../mobile/test/reservas_avisos_test.dart), [api_test.dart](../mobile/test/api_test.dart).
- Verificado online: `npm run verificar:servicios` terminó con código 0: backend Render, Firestore real, modo production, landing, panel, CORS y sesión obligatoria. Mercado Pago, IA y FCM informan activo; Maps simulado. Esto actualiza el estado antiguo de configuración de Mercado Pago, pero NO demuestra cobros ni push de extremo a extremo. No se escribieron datos online.
- Verificado Git: se recuperó `.git` de una clonación de `origin` (`SantinoZanussi/Habita`) en main, base `743ce16`, después de comparar el contenido. Los archivos ajenos a esta sesión coinciden; no se reemplazaron fuentes. Esta unidad no registra propietario: usar `git -c safe.directory=D:/Habita-main/Habita-main ...` en esta PC. `git diff --check` pasó. Se conserva la configuración de saltos de línea del clon.
- Fallos resueltos: el SDK instalado (Dart 3.11.3) no satisface ^3.12.2; recuperación con SDK temporal. Primer test monetario detectó símbolo al final, corregido con patrón explícito. Primer test de cancelación intentó tocar antes del reacomodamiento visual; se agregó espera de frame. Analizador inicial detectó estilo y dobles del SDK sellados; correcciones de estilo e ignorado documentado únicamente para dobles de prueba.
- Pendiente de publicación: `git push --dry-run origin main` fue rechazado con HTTP 403 para la cuenta GitHub conectada. Firebase CLI no puede listar apps de `habita-complejos-goiburu`; la cuenta actual lista otros proyectos. Falta `mobile/firebase.production.json`. Se solicitó al usuario conectar una cuenta con acceso; no se enviaron credenciales por chat ni se alteraron cuentas.
- Pendiente: generar e instalar APK online al recuperar la configuración autorizada; comprobar avisos con sesión real, aprobación/cancelación de reservas y correo de recuperación. No se desplegó backend, Hosting ni reglas en esta sesión.
- Mejoras siguientes observadas: los botones de obras, ayuda y ver todas las novedades conservan acciones vacías; falta el detalle de gastos en las tarjetas de expensas pese a la entrada histórica que lo daba por implementado; validar recepción push/cámara en dispositivo y manejo de arranque Firebase/FCM sin bloquear ingreso. Requieren otra tanda de implementación y verificación, no se declaran resueltos.
- Supuesto: se priorizan mejoras del uso cotidiano sin modificar datos reales ni proveedores.

# BitÃ¡cora de Habita

Registro de continuidad para trabajar desde distintas computadoras y con distintas sesiones de IA. Las entradas nuevas van arriba. Cada agente debe leer `AGENTS.md` y completar su entrada al terminar.

## 2026-09-15 - RedirecciÃ³n directa y copiado de link de pago en Android

- Objetivo: corregir el flujo de pago de expensas en la APK de Android para que redirija directamente a Mercado Pago al tocar "Pagar", permita copiar el enlace al portapapeles y reabrirlo, sin agregar dependencias externas de acuerdo con las reglas de `AGENTS.md`.
- Verificado: se analizÃ³ el cÃ³digo de [residente_shell.dart](../mobile/lib/presentacion/residente_shell.dart) y se diagnosticÃ³ que ante un pago real o de prueba (`simulado: false`) se desplegaba un `AlertDialog` con un widget `Text` estÃ¡tico no interactivo ni seleccionable.
- Verificado: se implementÃ³ el canal nativo `ar.com.habita/enlaces` en [MainActivity.kt](../mobile/android/app/src/main/kotlin/ar/com/habita/habita/MainActivity.kt) mediante `Intent(Intent.ACTION_VIEW)` y se declararon las intenciones `https` y `http` en `<queries>` de [AndroidManifest.xml](../mobile/android/app/src/main/AndroidManifest.xml).
- Verificado: se creÃ³ [enlaces.dart](../mobile/lib/nucleo/enlaces.dart) con `LanzadorEnlaces.abrirUrl` y `LanzadorEnlaces.copiarAlPortapapeles`, integrÃ¡ndose en `_pagar()` de [residente_shell.dart](../mobile/lib/presentacion/residente_shell.dart) con diÃ¡logo de estado, botones de copiado con `SnackBar`, reapertura y `SelectableText`.
- Verificado: `flutter analyze --no-pub` finalizÃ³ sin incidencias (`No issues found!`).
- Verificado: `flutter test --no-pub` pasÃ³ 11 pruebas exitosas, incluyendo las nuevas pruebas unitarias en [enlaces_test.dart](../mobile/test/enlaces_test.dart) y la prueba de widget en [pago_enlace_dialog_test.dart](../mobile/test/pago_enlace_dialog_test.dart).
- Verificado: APK release recompilada exitosamente en 246,7s (71,1 MiB, 74.556.267 bytes) en [app-release.apk](../mobile/build/app/outputs/flutter-apk/app-release.apk) mediante [build-mobile-produccion.mjs](../tools/build-mobile-produccion.mjs).
- Pendiente: instalar el APK en el dispositivo Android fÃ­sico y validar el flujo de redirecciÃ³n hacia Mercado Pago en vivo.
- Supuesto: el usuario dispone de navegador web o app de Mercado Pago instalada en el dispositivo Android para procesar el link de checkout.

## 2026-09-15 - Administrador online


- Objetivo: crear por pedido explicito `admin@habita.demo` con rol `admin_complejo` limitado a Torre del Parque y acceso equivalente al local.
- Verificado: se preparo `--solo-admin` en [preparar-demo-online.mjs](../tools/preparar-demo-online.mjs) para agregar exclusivamente esa cuenta y su perfil al complejo demo existente.
- Pendiente: ejecutar alta y comprobar inicio de sesion y rol.
- Supuesto: se conserva la clave de demostracion solicitada previamente; no se modifica una clave existente.

## 2026-09-15 - Novedades online y datos faltantes

- Objetivo: resolver la nube roja de novedades y distinguir errores de consulta de datos demo ausentes.
- Verificado: el usuario ingreso correctamente en Android. La APK consulta destinatarios con OR y orden por enviadaEn; los indices publicados no contienen esas combinaciones. No hay liquidaciones en el escenario minimo cargado anteriormente.
- Verificado: [reparar-indices-novedades.mjs](../tools/reparar-indices-novedades.mjs) reprodujo `FAILED_PRECONDITION` con un token real de residente y la misma consulta de la APK. Se solicitaron exactamente los dos indices de destinatarios/enviadaEn; Firebase los mostro en estado `CREATING`.
- Pendiente: la espera acotada de cinco minutos termino con codigo 1 porque la consulta sigue en `FAILED_PRECONDITION`; limitacion de disponibilidad del proveedor, no prueba aprobada. Volver a ejecutar el script sin `--corregir` para comprobar cuando terminen los indices. No se recompilo APK ni se ejecutaron suites generales.
- Pendiente: el usuario informo liquidaciones ausentes; se explico que el escenario previo no contenia periodos ni gastos. Se pidio confirmacion para novedades, amenities y liquidacion ficticia, aun sin respuesta. No se crearon deudas/pagos ni datos adicionales. Estos cambios y la nota de cierre siguen locales; GitHub carece de autenticacion.
- Supuesto: la nube roja desaparecera al habilitarse los indices; todavia no confirmado en el dispositivo.

## 2026-09-15 - Logo y acceso de la APK online

- Objetivo: corregir el logo blanco y diagnosticar el rechazo de inicio de sesion sin repetir pruebas generales.
- Verificado: el login aplica `color: Colors.white` a un PNG opaco; Firebase Authentication muestra que `habita-complejos-goiburu` no tiene usuarios. Los perfiles precargados corresponden al emulador.
- Verificado: [login.dart](../mobile/lib/presentacion/login.dart) muestra isotipo sin tinte blanco, con tamano fijo, campos vacios en modo online y errores de acceso diferenciados. Los perfiles demo siguen solo en emuladores. Las dos pruebas focalizadas de [login_test.dart](../mobile/test/login_test.dart) pasaron.
- Verificado: APK release recompilada correctamente en 232,9 segundos, 71,1 MiB, en `mobile/build/app/outputs/flutter-apk/app-release.apk`.
- Verificado: el usuario autorizo explicitamente Firebase CLI y las dos cuentas demo con sus accesos locales. Se conecto CLI con retorno local en puerto 9005; la deteccion automatica de puerto no completaba. No se guardaron claves en el repositorio.
- Verificado: [preparar-demo-online.mjs](../tools/preparar-demo-online.mjs) creo solo residente y guardia, sus perfiles, Torre del Parque y unidad 3A. Se comprobo inicio de sesion real y claims de ambos. El script es create-only para documentos, no resetea passwords, no ejecuta el seed, no crea cuentas administrativas ni deudas/pagos. El primer chequeo fallo por scopes indefinidos de CLI; se corrigio usando los scopes ya autorizados y la vista previa posterior paso.
- Pendiente: instalar esta APK actualizada y probar el ingreso en dispositivo. No se verificaron camara, QR ni notificaciones fisicas. El escenario online es minimo: una unidad sin movimientos, no una copia de los 152 departamentos del emulador. Nunca usar estas credenciales publicas demo con datos reales.
- Publicacion: correcciones guardadas en `main` como `9177c6b`. `git push origin main` fallo por falta de autenticacion de GitHub en esta PC; Firebase CLI conectado no autentica Git. Los cambios anteriores de backend/panel siguen preservados sin integrar. Esta nota de cierre queda local.
- Supuesto: se necesitan cuentas de residente y guardia para la demostracion en telefonos.

## 2026-09-15 - Icono Android de Habita

Objetivo: reemplazar el icono generico de la APK por el isotipo existente, conservando los cambios locales anteriores.

- Verificado: el manifest usa `@mipmap/ic_launcher`; se prepararon recursos para las cinco densidades mediante [generar-icono-android.ps1](../tools/generar-icono-android.ps1), sin nuevas dependencias. Nombre visible: Habita.
- Verificado: la APK posterior incluye los recursos Android de la marca y el nombre visible Habita. Se inspecciono visualmente el PNG generado; falta comprobacion en launcher fisico.
- Supuesto: se mantiene el isotipo original, sin redisenar la marca.

## 2026-09-15 - Generacion de APK Android

### Objetivo y estado inicial

Generar una APK instalable conectada a Firebase y Render usando la configuracion local ya preparada. Se conservan los cambios sin commit de la correccion anterior.

### Verificado

- Flutter 3.47.4 responde correctamente al ejecutarlo con acceso autorizado a su cache fuera del workspace. Los intentos anteriores restringidos no demostraban un problema del SDK.
- `flutter analyze --no-pub`: sin incidencias. Se corrigio el orden de propiedades de un boton en [residente_shell.dart](../mobile/lib/presentacion/residente_shell.dart).
- `flutter test --no-pub`: las cuatro pruebas pasaron.
- Flutter actualizo [analysis_options.yaml](../mobile/analysis_options.yaml) y [pubspec.lock](../mobile/pubspec.lock) para su SDK actual. La configuracion Firebase local permanece ignorada por Git, con emuladores deshabilitados y API de Render.
- Compilacion iniciada desde `mobile`: `flutter build apk --release --dart-define-from-file=firebase.production.json`. Gradle instalo NDK, Build Tools, plataformas Android y CMake faltantes usando licencias existentes.
- El primer proceso termino sin APK ni diagnostico final. Se redujo el heap de Gradle de 8 GB a 2 GB y sus workers a dos en [gradle.properties](../mobile/android/gradle.properties). El reintento con `--no-pub` termino correctamente en 234,5 segundos: [app-release.apk](../mobile/build/app/outputs/flutter-apk/app-release.apk), 74.622.775 bytes (71,2 MiB). Se comprobo que el archivo existe; no se repitieron suites.
- Se registro en [AGENTS.md](../AGENTS.md) la preferencia del usuario: pruebas indispensables por cambio y acordar revisiones profundas al cierre de jornada o entrega.

### Pendiente

Instalar y probar en un telefono fisico (no hay uno conectado). La firma configurada es de desarrollo, apta para instalar el TP, no una firma de publicacion en Play Store. Gradle, AGP y Kotlin emitieron advertencias de soporte futuro, sin bloquear la compilacion. Los cambios previos de backend/panel siguen pendientes de su verificacion final; las pruebas moviles no los validan. Los cambios locales no se publicaron en esta sesion; el APK es un artefacto local ignorado por Git.

### Supuesto

La APK se usara para la demostracion en dispositivos Android con cuentas de roles distintos.

## 2026-09-15 - Correcciones de la revision final

### Objetivo y estado inicial

Implementar las correcciones solicitadas de contabilidad, avisos, panel y reservas, con pruebas de regresion. Inicio en `main`, limpio, con el informe de revision en un commit local pendiente de publicar por autenticacion.

### Verificado

- Se corrigio el modelo de cuenta para que cada cargo mensual exista una sola vez, se serializaron cierres y pagos por transaccion y se agrego bloqueo para saldos historicos que requieren conciliacion.
- Se agregaron avisos dirigidos con validacion, reglas de lectura por unidad y aprobacion/rechazo de reservas.
- El panel vuelve a consultar cobranza cuando cambia la revision de cuenta; la app permite elegir fecha, horario y asistentes, cancelar reservas y parametrizar el host del emulador en un telefono.
- `npm run verificar` habia completado correctamente backend, reglas y build web antes de los ultimos cambios de cliente; las nuevas comprobaciones de backend pasaron 86 pruebas. Las nuevas pruebas de Firestore pasaron 17 casos dentro de la verificacion completa.

### Pendiente

Repetir build web y Flutter analyze/test fuera del bloqueo actual de procesos `spawn EPERM`; revisar visualmente reservas en navegador y telefono. Publicacion sujeta a autenticacion de GitHub. No se migraran saldos historicos de produccion sin conciliacion. Mercado Pago sigue pendiente de credenciales de prueba habilitadas por el proveedor.

### Supuesto

La autorizacion incluye corregir el producto y preparar su despliegue, pero no inventar credenciales, efectuar cobros reales ni dar por realizadas pruebas externas.

## 2026-09-15 - Revision del proyecto finalizado

### Objetivo y estado inicial

Revisar la version terminada y proponer mejoras, sin implementar cambios funcionales. El checkout local estaba en `codex/fase-2-seguridad`, limpio y desactualizado. Se consulto el remoto y se actualizo `main` por fast-forward hasta `8b3a1db`, conservando la rama anterior.

### Verificado

- Lectura de bitacora, documentos de entrega y flujos sensibles. Hallazgos y prioridades en [REVISION_FINAL.md](REVISION_FINAL.md).
- `npm test`: 82 pruebas aprobadas. El primer intento restringido fallo por `spawn EPERM`; el segundo, autorizado, termino correctamente.
- Con los servicios y dobles de Firestore en memoria se reprodujeron deuda duplicada al cerrar dos periodos y saldo obsoleto con dos pagos concurrentes. No se escribieron datos reales.
- `npm run verificar:servicios`: controles correctos salvo landing, con salida 1. La raiz publica todavia devuelve una redireccion a `/panel`.
- Mercado Pago sigue simulado. IA y FCM informan configuracion activa, sin prueba funcional externa en esta sesion.
- Publicacion pendiente: `git push origin main` no termino; se interrumpio y el reintento no interactivo confirmo falta de autenticacion (`unable to get password from user`). La revision queda en un commit local de `main`, sin confirmacion de subida a GitHub.

### Cambios y decisiones

Solo documentacion: esta entrada y `docs/REVISION_FINAL.md`. No se modificaron codigo, reglas, credenciales ni despliegues. La solicitud se interpreto como revision y propuesta de mejoras.

### Pendiente

Corregir consistencia contable, aislamiento de avisos dirigidos y refresco de cobranza; completar reservas; actualizar la landing publicada. Validar concurrencia con emulador y flujos en telefono real. Flutter, reglas y QA visual no se volvieron a ejecutar en esta sesion. Mantener pendientes de evidencia el QA externo, video y pitch salvo confirmacion del usuario.

### Supuesto

Los documentos de entrega describen el alcance implementado, pero no sustituyen pruebas de uso real ni confirman que las actividades academicas externas hayan ocurrido.

## 2026-09-10 â€” Completar el flujo de autorizaciÃ³n de visitas

### Objetivo

Dejar claro cÃ³mo una persona autorizada ingresa y permitir volver a mostrar su QR desde la lista de visitas.

### Estado inicial

El residente cargaba nombre y documento y recibÃ­a el QR sÃ³lo en el diÃ¡logo de creaciÃ³n. La lista no tenÃ­a una acciÃ³n para recuperar ese cÃ³digo y la respuesta de la garita mostraba el nombre, pero no el documento para cotejarlo.

### Verificado

- El backend conserva el cÃ³digo QR aleatorio, la vigencia, los usos y el documento; el guardia valida el cÃ³digo con la cÃ¡mara y recibe nombre, DNI, unidad y usos restantes.
- La ruta HTTP de creaciÃ³n respondiÃ³ `201` con `codigoQr` de tipo texto; el registro temporal usado para comprobarlo se eliminÃ³ del emulador.
- `npm test`: 82 pruebas aprobadas.
- `flutter analyze`: sin problemas.
- `flutter test`: 4 tests aprobados.
- `flutter build web --release`: compilaciÃ³n web completada.
- El backend rechaza una autorizaciÃ³n de visita sin DNI vÃ¡lido antes de escribirla; las autorizaciones de proveedor u obra mantienen su contrato flexible.

### Cambios

- `mobile/lib/presentacion/residente_shell.dart` muestra DNI, agrega â€œMostrar QR para la garitaâ€ en cada autorizaciÃ³n vigente y explica que ese QR se presenta en la entrada.
- `mobile/lib/presentacion/residente_shell.dart` evita dobles envÃ­os mientras crea la autorizaciÃ³n, valida los campos antes de llamar a la API y verifica que la respuesta contenga un QR renderizable antes de cerrar el diÃ¡logo.
- `mobile/lib/presentacion/guardia_shell.dart` muestra el DNI devuelto junto al nombre luego de un escaneo vÃ¡lido.
- `backend/src/rutas/accesos.js` normaliza nombre y DNI y exige el documento para el tipo `visita`.

### Pendiente

La cÃ¡mara requiere un telÃ©fono, webcam o emulador Android con cÃ¡mara; el escÃ¡ner de la garita no ingresa un DNI manualmente porque el QR es la credencial que el backend valida.

### Supuesto

El residente comparte el QR generado con la visita y la garita coteja visualmente el nombre y DNI que devuelve el backend antes de permitir el ingreso.

## 2026-09-10 â€” Mostrar disponibilidad y evitar duplicados en amenities

### Objetivo

Hacer visible el cupo de SUM, pileta, parrilla y gimnasio y evitar que una misma unidad consuma reservas superpuestas indefinidamente.

### Estado inicial

El backend ya rechazaba una reserva cuando la suma de asistentes superaba la capacidad, pero la app sÃ³lo escuchaba la colecciÃ³n de amenities y mostraba siempre â€œDisponibleâ€. AdemÃ¡s, las reservas pendientes no se contaban y una unidad podÃ­a crear varias reservas superpuestas para el mismo espacio.

### Verificado

- `npm test`: 82 pruebas aprobadas, incluyendo validaciÃ³n de intervalos y estados activos de reserva.
- `flutter analyze`: sin problemas.
- `flutter test`: 4 tests aprobados.
- En el backend local, una primera reserva de prueba informÃ³ `disponibles: 28` y el mismo intento repetido respondiÃ³ `409 CONFLICTO` con el mensaje de duplicado.
- La reserva de prueba se eliminÃ³ del emulador; no se modificÃ³ Firebase Cloud.

### Cambios

- `backend/src/servicios/amenities.js` valida fechas, asistentes y capacidad; cuenta reservas confirmadas y pendientes; bloquea superposiciÃ³n de la misma unidad; devuelve ocupaciÃ³n y disponibles.
- `mobile/lib/presentacion/residente_shell.dart` escucha las reservas en tiempo real, calcula el cupo del horario demo, deshabilita â€œReservarâ€ cuando no hay lugares o la unidad ya estÃ¡ anotada y muestra `Disponibles maÃ±ana: X de Y`.
- `backend/test/amenities.test.js` cubre intervalos y reservas activas.

### Pendiente

La pantalla actual reserva el horario demo de maÃ±ana con dos asistentes; todavÃ­a no incluye selector de fecha, cantidad ni botÃ³n de cancelaciÃ³n. Para empezar una demo limpia, `npm run seed` recrea Ãºnicamente el escenario local y borra las reservas anteriores del emulador.

### Supuesto

Una reserva confirmada o pendiente ocupa capacidad, y una unidad no puede tener dos reservas superpuestas del mismo amenity; una reserva en otro horario sigue siendo vÃ¡lida.

## 2026-09-10 â€” Corregir QR dinÃ¡mico de acceso en la app

### Objetivo

Resolver el error que impedÃ­a dibujar el QR de residente en Flutter: `TypeError: Instance of '_JsonMap': type '_JsonMap' is not a subtype of type 'String'`.

### Estado inicial

La ruta `POST /api/complejos/:complejoId/accesos/qr-dinamico` guardaba el objeto completo devuelto por `generarCodigoDinamico` dentro del campo `codigo`. Flutter esperaba que ese campo fuera la cadena que consume `QrImageView`.

### Verificado

- Con la sesiÃ³n demo de `residente@habita.demo`, la ruta local devolviÃ³ `codigo` como cadena `HB1...`, `venceEnSegundos` numÃ©rico y `expiraEn` ISO.
- `npm test`: 80 pruebas aprobadas.
- `flutter analyze`: sin problemas.
- `flutter test`: 4 tests aprobados.
- Se reiniciÃ³ `flutter run -d web-server --web-port 9100` y quedÃ³ respondiendo por HTTP; el backend recargÃ³ el cambio automÃ¡ticamente.

### Cambios

- `backend/src/rutas/accesos.js` ahora separa el cÃ³digo textual, usa el vencimiento calculado y expone `expiraEn`.
- `mobile/lib/presentacion/residente_shell.dart` valida el tipo de la respuesta y muestra un mensaje entendible si el contrato vuelve a ser invÃ¡lido.
- `README.md` documenta la prueba con dos instancias Flutter (`9100` residente y `9101` guardia), porque Firebase Auth separa la sesiÃ³n por origen.

### Pendiente

La lectura fÃ­sica con cÃ¡mara en un dispositivo de guardia sigue requiriendo un telÃ©fono o emulador Android compatible; el flujo local de generaciÃ³n ya queda listo para esa prueba. En esta sesiÃ³n se dejÃ³ tambiÃ©n una segunda instancia web en `http://localhost:9101/` para separar la sesiÃ³n del guardia.

### Supuesto

El contrato pÃºblico del endpoint debe conservar `codigo` como texto porque es el valor que se codifica visualmente y que luego valida el backend.

## 2026-09-10 â€” Unificar el identificador de Firebase con el proyecto Habita

### Objetivo

Corregir el enlace que muestra Firebase Emulator Suite para que apunte al proyecto real de la cuenta de Goiburu, manteniendo los datos de demo aislados en emuladores locales.

### Estado inicial

El proyecto real aparece en Firebase como **Habita**, con ID `habita-complejos-goiburu`, pero los valores locales usaban `habita-demo`. El usuario pidiÃ³ entender por quÃ© se usaba Firestore local y dejÃ³ los servicios abiertos para probar.

### Verificado

- `firebase projects:list` confirmÃ³ `Habita / habita-complejos-goiburu` en la cuenta autenticada.
- La separaciÃ³n queda explÃ­cita: el emulador puede usar el mismo ID como namespace y enlace visual, pero `npm run seed` sÃ³lo borra el Firestore/Auth local.
- `npm test`: 80 pruebas aprobadas; `flutter analyze`: sin problemas; `flutter test`: 4 tests aprobados.
- `npm run test:reglas`: 11 pruebas aprobadas despuÃ©s de liberar un proceso Java de Firestore que habÃ­a quedado ocupando el puerto 8080.

### Cambios

- Se agregÃ³ `.firebaserc` con `habita-complejos-goiburu` como proyecto Firebase por defecto.
- Los defaults de emuladores, seed, reglas, backend, web y Flutter ahora usan ese ID real como referencia.
- `README.md` explica la diferencia entre emulador local y Firebase Cloud y prohÃ­be usar `npm run seed` contra producciÃ³n.

### Pendiente

Conectar una sesiÃ³n de la app directamente a Firebase Cloud requiere usar la configuraciÃ³n de producciÃ³n, credenciales de servicio para el backend y usuarios reales/demo creados en el proyecto. No se habilita automÃ¡ticamente para evitar escrituras o borrados accidentales.

### Supuesto

â€œHabitaâ€ es el nombre visible del proyecto y `habita-complejos-goiburu` es su ID tÃ©cnico, segÃºn `firebase projects:list`.

### Comandos y resultado

La migraciÃ³n de referencias pasÃ³ las pruebas de backend, reglas y Flutter. Se reiniciÃ³ el emulador y su banner ahora muestra `habita-complejos-goiburu` y enlaza la consola correcta de Firebase.

## 2026-09-10 â€” VerificaciÃ³n integral local y guÃ­a de funcionamiento

### Objetivo

Ejecutar las verificaciones automatizadas y un recorrido local con emuladores, datos demo, API, landing y panel para documentar cÃ³mo funciona Habita y quÃ© pruebas requieren un dispositivo o una persona.

### Estado inicial

`main` estaba publicado en `661a89a`. La landing y el formulario pÃºblico ya estaban implementados; `docs/entrega/` continuaba fuera del repositorio por estar incompleto.

### Verificado

- `npm test`: 80 pruebas aprobadas.
- `npm run test:reglas`: 11 pruebas de Firestore y Storage aprobadas en un arranque limpio de emuladores. Las advertencias de `sun.misc.Unsafe` provienen del runtime Java del emulador y no cambian el resultado.
- `npm run build:web`: compilaciÃ³n del panel completada.
- `flutter analyze`: sin problemas; `flutter test`: 4 tests aprobados.
- `flutter devices`: esta PC sÃ³lo tiene Windows, Chrome y Edge; `flutter run -d chrome --web-port 9100` compilÃ³ y dejÃ³ la app Flutter web conectada al servicio de depuraciÃ³n. `flutter build web --release` tambiÃ©n terminÃ³ correctamente.
- `npm run emu`: Auth, Firestore, Hosting y Storage quedaron listos en los puertos locales esperados. El script ya no intenta levantar Functions, que no forman parte del backend local y fallaban al leer las credenciales invÃ¡lidas del `.env`.
- `npm run seed`: creÃ³ el escenario `torre-parque` con cinco cuentas demo, 152 unidades, amenities, accesos, reclamos, obra, avisos y una liquidaciÃ³n cerrada. Una consulta con Admin SDK confirmÃ³ 152 identificadores Ãºnicos y conservÃ³ la unidad demo `unidad-3a` como `3A`.
- Smoke test HTTP contra `http://127.0.0.1:8787/api`: salud `200`, contacto pÃºblico `201`, mÃ©tricas admin `200`, bloqueo de residente en mÃ©tricas `403`, cuenta propia `200`, cuenta vecina `403`, creaciÃ³n de reclamo `201`, correcciÃ³n humana `200`, dos usos permitidos del QR demo y tercer uso rechazado con motivo de usos agotados, presentes `200`.
- Recorrido visual del panel en `http://127.0.0.1:5000/panel`: login admin, Dashboard, Unidades, Reclamos con bÃºsqueda y filtro, modal de correcciÃ³n humana, Expensas y Accesos. El historial mostrÃ³ los tres intentos del QR demo y el mensaje actualizado explica sus dos usos.
- `npm run verificar:servicios` comprobÃ³ en producciÃ³n backend, Firestore, modo producciÃ³n, panel, CORS y sesiÃ³n obligatoria. La raÃ­z publicada respondiÃ³ `200`, pero todavÃ­a contiene la portada anterior que redirige a `/panel`; la landing nueva del repositorio aÃºn necesita un deploy.

### Cambios

- `tools/sembrar.mjs` evita duplicar `3A` al reservar la posiciÃ³n de la unidad demo y mantiene los coeficientes del escenario.
- `tools/emuladores.mjs` inicia sÃ³lo los emuladores usados por la app local: Auth, Firestore, Hosting y Storage.
- `web/src/main.js` y `web/assets/js/app.js` explican que el QR demo permite dos usos y registra tambiÃ©n el rechazo posterior.
- `docs/FASE_3_QA.md` y `docs/FASE_5_PITCH.md` alinean el caso de prueba y el guion con ese comportamiento real.
- Esta entrada documenta el recorrido completo y cÃ³mo reproducirlo desde otra computadora.

### Pendiente

Mercado Pago continÃºa pausado por el error del portal. La landing nueva requiere publicar el `main` actual en Firebase Hosting. La prueba fÃ­sica de Android, cÃ¡mara/QR, notificaciones FCM y QA cruzado requieren un dispositivo o una persona externa. El video final y la exposiciÃ³n presencial tambiÃ©n quedan fuera de una sesiÃ³n automÃ¡tica.

### Supuesto

La verificaciÃ³n se hizo con Firebase Emulator Suite y proveedores simulados (`MP_ACCESS_TOKEN`, Gemini, Maps y FCM vacÃ­os), por lo que demuestra el flujo local y las reglas de negocio, no una acreditaciÃ³n real de dinero, una notificaciÃ³n en un telÃ©fono ni una integraciÃ³n externa productiva.

### Comandos y resultado

`npm run verificar` finalizÃ³ con cÃ³digo 0 e incluyÃ³ `tokens`, `marca`, `build:web`, las 80 pruebas de backend y las 11 pruebas de reglas. TambiÃ©n finalizaron correctamente `flutter analyze`, `flutter test`, `flutter build web --release`, `npm run emu`, `npm run seed` y el smoke test HTTP. `npm run verificar:servicios` devolviÃ³ cÃ³digo 1 sÃ³lo por la landing publicada desactualizada; los otros seis controles pasaron y reportÃ³ Mercado Pago simulado. El primer intento aislado de `npm run test:reglas` fue bloqueado porque el recorrido visual todavÃ­a ocupaba los puertos 8080/9199; se cerrÃ³ ese proceso y la ejecuciÃ³n siguiente pasÃ³ completa. El cÃ³digo y los ajustes funcionales quedaron publicados en `main` en `da9b7ba` (`test: verificar recorrido integral local`).

## 2026-09-10 â€” Avanzar Fase 4: landing y materiales de demo

### Objetivo

Continuar desde `main` y convertir la portada que hoy redirige al panel en una landing pÃºblica de Habita, con propuesta de valor, mÃ³dulos, planes, captura real, CTA al panel y guion de demo enlazado.

### Estado inicial

La implementaciÃ³n tÃ©cnica de Fase 2 estÃ¡ publicada y la preparaciÃ³n de QA de Fase 3 estÃ¡ documentada. `web/index.html` sÃ³lo redirigÃ­a a `/panel`; `docs/entrega/` contiene un generador de pitch incompleto y no se usarÃ¡ como fuente de publicaciÃ³n.

### Verificado

- La landing local responde `200` en `/`, `/landing.css` y `/landing.js`; se revisÃ³ visualmente en navegador y en viewport mÃ³vil.
- `npm test`: 80 pruebas aprobadas, incluida la ruta pÃºblica de contacto.
- `npm run build:web`: compilaciÃ³n del panel completada.
- `node --check web/landing.js` y `node --check tools/verificar-servicios.mjs`: sintaxis vÃ¡lida.
- `git diff --check`: sin errores de whitespace.

### Cambios

- `web/index.html` dejÃ³ de redirigir y ahora contiene la landing pÃºblica responsive con propuesta de valor, mÃ³dulos, planes, demo guiada y formulario.
- `web/landing.css` define el sistema visual de la portada reutilizando tokens, fuentes y la captura real de app/panel.
- `web/landing.js` conecta el formulario con `POST /api/contacto` y muestra estados de Ã©xito o error.
- `backend/src/rutas/publico.js` valida lÃ­mites de nombre, correo, mensaje y tipo, y conserva el tipo de complejo en el contacto.
- `backend/test/publico.test.js` cubre el contrato pÃºblico con un caso invÃ¡lido y uno vÃ¡lido.
- `tools/verificar-servicios.mjs` comprueba tambiÃ©n que la landing publicada estÃ© disponible.
- Se agregaron `docs/FASE_4_LANZAMIENTO.md` y `docs/FASE_5_PITCH.md`, y se actualizaron README y producciÃ³n con las rutas nuevas.

### Pendiente

El video demo final y la presentaciÃ³n presencial requieren grabaciÃ³n y exposiciÃ³n humana. Mercado Pago continÃºa pausado por el error del portal.

### Comandos y resultado

`npm run build:web`, `npm test`, los chequeos de sintaxis y la comprobaciÃ³n HTTP local finalizaron con cÃ³digo 0. No se desplegÃ³ producciÃ³n en esta sesiÃ³n; el cambio queda listo para el prÃ³ximo deploy. Commit funcional: `e969b98` (`feat: publicar landing y preparar lanzamiento`); cierre de bitÃ¡cora: `41dd87b`. `docs/entrega/` sigue fuera del commit por estar incompleto.

## 2026-09-10 â€” Preparar Fase 3 y continuidad de QA

### Objetivo

Continuar el trabajo desde `main`, dejar Mercado Pago en pausa por el error del portal y avanzar todo lo posible hacia la Fase 3 con una mejora funcional y un checklist reproducible.

### Estado inicial

La Fase 2 ya estaba integrada y publicada en `main` en `ef83278`. El backend tenÃ­a el endpoint para corregir la clasificaciÃ³n de reclamos, pero el panel sÃ³lo permitÃ­a cambiar el estado. `docs/entrega/` sigue siendo un generador de pitch incompleto y queda fuera del alcance de esta sesiÃ³n.

### Verificado

- `npm test`: 79 pruebas aprobadas.
- `npm run test:reglas`: 11 pruebas de Firestore y Storage aprobadas en emuladores oficiales.
- `npm run build:web`: compilaciÃ³n del panel completada.
- `mobile/flutter analyze`: sin problemas.
- `mobile/flutter test`: 4 tests aprobados.

### Cambios

- El panel expone la correcciÃ³n humana de Ã¡rea y urgencia en `web/src/main.js`; llama a `PATCH /reclamos/:id/clasificacion` y conserva la clasificaciÃ³n IA.
- La bandeja de reclamos ahora filtra por texto y estado sin perder el foco ni recargar toda la secciÃ³n.
- Se agregÃ³ el estilo de acciones mÃºltiples de la tabla en `web/assets/css/app.css` y se regenerÃ³ `web/assets/js/app.js`.
- Se agregÃ³ `docs/FASE_3_QA.md` con casos por rol, seguridad, pagos demo, accesibilidad responsive, recuperaciÃ³n de conexiÃ³n y ficha de bugs.
- Se actualizaron `docs/FASE_2_ENTREGA.md` y esta bitÃ¡cora para reflejar que la preparaciÃ³n de Fase 3 estÃ¡ iniciada y que Fase 2 ya estÃ¡ en `ef83278`.

### Pendiente

El QA cruzado real requiere otra persona o equipo y no se debe marcar como ejecutado sin evidencia. Mercado Pago queda pausado hasta que el portal permita activar credenciales de prueba.

### Comandos y resultado

`npm run build:web`, `npm test`, `npm run test:reglas`, `flutter analyze` y `flutter test` finalizaron con cÃ³digo 0. El generador incompleto de `docs/entrega/` no se incluyÃ³ en estos cambios. Cambios funcionales publicados en `main`: `c838c68` (`feat: preparar qa de reclamos y continuidad de fase 3`); cierre de esta bitÃ¡cora: `0ab7f60`.

## 2026-09-10 â€” Integrar la Ãºltima Fase 2 en `main`

### Objetivo

Reunir los cambios de Fase 2 que estaban en esta PC, validarlos y publicarlos en `main` para continuar desde cualquier computadora.

### Estado inicial

`main` estaba actualizado sÃ³lo con la documentaciÃ³n de continuidad. HabÃ­a cambios locales sin commit de pagos demo, seguridad de roles, accesos, reglas, documentaciÃ³n de producciÃ³n y pruebas. El directorio `docs/entrega` contenÃ­a Ãºnicamente un generador de pitch incompleto y quedÃ³ fuera de esta integraciÃ³n.

### Verificado

- Backend: 79 pruebas aprobadas.
- Firestore y Storage: 11 pruebas de reglas aprobadas en emuladores oficiales.
- Flutter: `flutter analyze` sin problemas y 4 tests aprobados.
- Panel: `npm run build:web` completÃ³ correctamente.
- La suite incluye controles para aislamiento de usuarios, puntos de acceso, egresos sin usos restantes, pagos demo y bloqueo de rutas segÃºn el estado de Mercado Pago.

### Cambios integrados

Se prepararon para commit los cambios de Fase 2 en backend, reglas, app mÃ³vil, pruebas, configuraciÃ³n y documentaciÃ³n. El destino es `main`, segÃºn la preferencia permanente del proyecto.

Commit publicado: `ef83278` (`feat: integrar correcciones y demo de fase 2`).

### Pendiente

QA cruzado con otro equipo, prueba presencial completa de app y panel, landing, video demo, pitch y reintento de activaciÃ³n externa de Mercado Pago. La simulaciÃ³n de pagos no se presenta como integraciÃ³n externa verificada.

## Estado rÃ¡pido

- Rama principal del proyecto: `main`. La rama temporal `codex/retomar-fase-2` se usÃ³ durante la recuperaciÃ³n y no debe ser el destino normal de nuevas sesiones.
- Base histÃ³rica del cÃ³digo retomado: commit `1f8945a` (`docs: ordenar activacion gratuita de integraciones`). La documentaciÃ³n de continuidad se agregÃ³ en `0e399bd` (`docs: agregar contexto y bitacora para continuidad`) y la preferencia de trabajar en `main` quedÃ³ fijada en `22b5f12`.
- Fase: transiciÃ³n de Fase 2 hacia preparaciÃ³n de Fases 3 a 5.
- Mercado Pago: la aplicaciÃ³n `Habita TP` existe, pero la activaciÃ³n de credenciales de prueba devuelve â€œAlgo saliÃ³ malâ€ en el portal. El cÃ³digo conserva modo simulado autenticado.
- Firebase/Render: hay un despliegue preparado y una comprobaciÃ³n de solo lectura documentada en `docs/PRODUCCION.md`.
- Seguridad: los cambios de aislamiento de usuarios y accesos ya estÃ¡n integrados y cubiertos por las suites de backend y reglas en `ef83278`.
- Preferencia de flujo: desde esta entrada, los cambios terminados y verificados se integran directamente en `main`; no crear ramas nuevas sin pedido explÃ­cito.

## 2026-09-10 â€” Retomar Fase 2 y preparar continuidad

### Objetivo

Continuar Habita desde el bloqueo de Mercado Pago y dejar el repositorio listo para trabajar desde otra PC con contexto persistente.

### Verificado

- Se revisaron `README.md`, `docs/TAREA_CONTEXTO.md`, `docs/PROYECTO_CONTEXTO.md`, `docs/FASE_2_ENTREGA.md` y `docs/PRODUCCION.md`.
- Se recuperÃ³ el trabajo pendiente de la sesiÃ³n anterior en la rama `codex/retomar-fase-2`, sin eliminar cambios locales.
- El backend pasÃ³ 68 pruebas automatizadas.
- Las reglas de Firestore y Storage pasaron 8 pruebas en emuladores oficiales.
- `npm run verificar:servicios` respondiÃ³ correctamente para backend, Firestore, panel, CORS y rechazo de consultas sin sesiÃ³n; informÃ³ Mercado Pago simulado, IA activa, FCM activo, Maps simulado y BCRA pÃºblico.
- Flutter informÃ³ `flutter analyze` sin problemas y `flutter test` con 4 pruebas aprobadas en la sesiÃ³n de Android.
- La app de Mercado Pago mostrÃ³ que `Habita TP` tiene cuentas de prueba creadas, pero la activaciÃ³n de credenciales de prueba sigue fallando en el proveedor.
- La documentaciÃ³n oficial consultada indica que Checkout Pro puede probarse con cuentas separadas de vendedor y comprador; el access token debe mantenerse fuera del repositorio.

### Cambios locales observados

- Modo de pago demo autenticado y con confirmaciÃ³n explÃ­cita en app mÃ³vil.
- Middleware que bloquea pagos simulados cuando existe `MP_ACCESS_TOKEN` y bloquea el webhook externo cuando Mercado Pago estÃ¡ simulado.
- Pruebas HTTP y de modo de pagos.
- Correcciones de aislamiento de usuarios, restricciones de puntos de acceso y egreso, con pruebas asociadas.
- Ajustes de reglas y documentaciÃ³n de producciÃ³n.

### Pendiente

- Revisar el diff completo y crear un commit coherente de cÃ³digo despuÃ©s de validar las correcciones de seguridad.
- Completar QA cruzado con otro grupo o registrar formalmente los casos ejecutados por una persona externa.
- Capturar una prueba real de app y panel para la demo.
- Completar landing, video demo y pitch; marcar como presenciales los pasos que no pueda ejecutar una IA.
- Reintentar Mercado Pago sÃ³lo desde la cuenta y flujo de pruebas documentados por el proveedor. No usar credenciales productivas ni inventar valores.

### PrÃ³xima sesiÃ³n recomendada

1. Leer esta bitÃ¡cora y `AGENTS.md`.
2. Ejecutar `git status --short --branch` y revisar todos los cambios pendientes.
3. Levantar emuladores, ejecutar `npm run seed` sÃ³lo en local y levantar backend/panel.
4. Verificar residente, guardia y administraciÃ³n con las cuentas demo del README.
5. Ejecutar las pruebas correspondientes y agregar el resultado a esta entrada o a una nueva.

## Plantilla para cada sesiÃ³n

```markdown
## AAAA-MM-DD â€” TÃ­tulo breve

### Objetivo

### Estado inicial

### Verificado

### Cambios

### Pendiente

### Comandos y resultado
```


## 2026-09-15 - Funcionalidades de Fase 4+ (ALPR, notificaciones, amenities, expensas)

### Objetivo
Implementar las funcionalidades de la Fase 4 para mejorar el alcance de la aplicación (reconocimiento de patentes, historial de notificaciones, límites familiares en reservas de amenities y desglose de gastos en las expensas).

### Estado inicial
El backend soportaba arrays de expensas pero no se exponían al frontend. La app móvil carecía del listado de notificaciones (solo existía el botón), no limitaba familiares por unidad y no poseía ALPR.

### Verificado
- Se pasó la suite de \
pm run verificar\ (incluyendo corrección de sintaxis y charset).
- Flutter pasó análisis y pruebas con \lutter analyze\ y \lutter test\.

### Cambios
- Backend: Endpoint \POST /reconocer-patente\ y lógica \extraerPatenteConGemini\ en \ia.js\.
- App móvil: Inclusión de cámara en la app guardia usando \image_picker\. 
- App móvil: UI de historial de notificaciones.
- App móvil: Renderizado de listas de detalles ordinarios y extraordinarios para la expensa.
- Backend: Campo \habitantes\ en unidades. Lógica en \menities.js\ suma ocupantes concurrentes para limitar reservas familiares.
- Panel Web: Formularios adaptados en \web/src/main.js\ para unidades y períodos.

### Pendiente
Verificar el uso real y las dimensiones de la UI en dispositivos físicos. 

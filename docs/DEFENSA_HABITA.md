# Habita | Guía para la defensa

## Qué resolvemos

Una administración puede recibir el aviso de una pérdida por chat, anotar visitas en la garita y llevar expensas en una planilla. Habita conecta esas tareas por complejo y unidad. El cliente objetivo es la administración de edificios, consorcios y barrios cerrados. Residente, guardia y responsable de obra utilizan pantallas diferentes porque toman decisiones diferentes.

## Dónde vive cada parte

| Pieza | Dónde está | Cómo explicarla |
|---|---|---|
| App de Android | Flutter, instalada mediante APK. Código en `mobile/lib`. | El teléfono muestra datos del complejo y envía solicitudes con la identidad del usuario. Drive distribuye el instalador. |
| Landing y panel | Firebase Hosting sirve los archivos de `web/`. [Landing](https://habita-complejos-goiburu.web.app/) y [panel](https://habita-complejos-goiburu.web.app/panel/). | La landing presenta el producto. El panel abre en el navegador y requiere una cuenta administrativa. |
| Identidad | Firebase Authentication, proyecto `habita-complejos-goiburu`. | Al iniciar sesión entrega un token. Incluye permisos firmados por el servidor, como rol, complejo, unidad u obras asignadas. |
| Base de datos | Cloud Firestore, base `(default)`, región documentada `southamerica-east1` (São Paulo). | Guarda documentos organizados en colecciones. Para inspeccionarlos como propietario, abrir Firebase Console, proyecto Habita, Firestore Database, Datos. |
| Backend | Node.js y Express en Render. [Estado de la API](https://habita-api-goiburu.onrender.com/api/estado). Código en `backend/src/`. | Recibe la solicitud, valida la identidad y los permisos, aplica las reglas del negocio y escribe el resultado. El primer acceso puede tardar si el servicio está en reposo. |
| Código y distribución | GitHub guarda el código; Hosting publica la web, Render ejecuta la API y la APK se instala en el dispositivo. | Actualizar el código, publicar un servicio y actualizar una app instalada son operaciones distintas. |

## Qué pasa cuando alguien usa la app

**Reclamo.** El residente informa un problema asociado a su unidad. El panel escucha la colección de reclamos del mismo complejo. Cuando Firestore comunica un cambio, el navegador actualiza su vista. El clasificador propone área, urgencia, resumen y acción. Reserva la prioridad crítica para riesgo de personas o estructura. La confianza de 0 a 100 expresa la certeza que declara el clasificador. Si faltan datos debe bajarla. La alternativa por palabras clave informa confianza 35. Administración puede revisar el resultado.

**Visitas.** El permiso vincula visitante, complejo, vigencia y usos disponibles. El guardia escanea el QR. El backend verifica el permiso y registra el evento en una transacción, para que dos escaneos simultáneos no consuman el mismo último uso. El historial conserva lo ocurrido. En clase conviene mostrar una autorización de un uso y leer la respuesta de ambos intentos.

**Expensas.** Administración prepara un período, carga gastos y previsualiza el reparto. El cálculo usa enteros en centavos y verifica que la suma individual coincida con el total antes del cierre. Firestore guarda el período y el detalle de cada unidad. El residente consulta deuda, intereses y crédito. Un checkout abierto todavía no acredita el pago. El backend verifica la notificación y maneja reintentos. Para explicar este flujo alcanza con mostrar la cuenta sin mover dinero.

**Reservas y avisos.** Administración configura los espacios. El residente selecciona fecha, horario y asistentes. El backend controla capacidad y conflictos; la política del espacio determina si necesita aprobación. Los avisos pueden dirigirse a todo el complejo o a unidades. Una nube roja significa que falló una lectura; una lista vacía significa que la consulta terminó sin resultados.

**Obras.** Administración crea la obra y sus partidas. Cada partida tiene duración, avance y, cuando corresponde, dependencias. El responsable consulta las obras asignadas y registra avances. El cronograma considera las dependencias para identificar las tareas cuyo atraso cambia la fecha de terminación.

## Qué cuenta usar

| Cuenta demo | Abrir | Alcance verificado el 25/11 |
|---|---|---|
| `residente@habita.demo` | APK | Residente de Torre del Parque, unidad 3A. Autenticación y perfil online correctos. |
| `guardia@habita.demo` | APK | Guardia del complejo. Autenticación y perfil online correctos. |
| `obra@habita.demo` | APK | Responsable de **Pintura del SUM (demo)**. Ingreso y lectura de obra y partidas confirmados con su propia sesión. |
| `admin@habita.demo` | Panel publicado | Administración de Torre del Parque. Ingreso desde Chrome y navegación por Reclamos, Amenities, Obras y Expensas. |
| `superadmin@habita.demo` | Panel de emuladores con seed | Rol de cartera de complejos. Firebase online rechazó las credenciales de la demo local. Para la exposición online usen admin. |

Las cuatro cuentas online verificadas usan la contraseña demo que el equipo ya conoce. Si una cuenta autentica pero no muestra la pantalla esperada, revisar su rol y asignaciones. Un documento en `usuarios/{uid}` contiene el perfil; editar texto en ese documento no concede permisos firmados.

## Cómo se organiza Firestore

El documento `complejos/torre-parque` identifica el complejo de la demo. Debajo viven colecciones como `unidades`, `reclamos`, `notificaciones`, `reservas`, `autorizaciones`, `periodos` y `obras`. Una liquidación individual está en `periodos/{periodo}/detalle/{unidad}` bajo su complejo. Una partida está en `obras/{obra}/partidas/{partida}`. Cada cliente lee según las reglas de `firebase/firestore.rules`. La API usa Firebase Admin y por eso debe comprobar el alcance del usuario antes de actuar. Los índices permiten filtrar y ordenar datos, por ejemplo avisos por destinatario y fecha.

## Preguntas que pueden hacerles

**¿Por qué mi panel local se ve distinto del celular?** El panel en localhost apunta a emuladores. La APK online y el panel publicado comparten Firebase y Render. Usen ambos online para la demo.

**¿Dónde se guarda una foto?** El diseño usa Firebase Storage para archivos y Firestore para datos y referencias. La configuración de la APK y el plan del proyecto condicionan las cargas; comprueben esa función en el dispositivo antes de ofrecer mostrarla.

**¿Qué necesita internet?** El ingreso online, las consultas al servidor y las operaciones entre dispositivos necesitan conectividad. Tener el APK instalado no sustituye al backend. El estado de un pago o una autorización lo confirma el servidor.

**¿Qué probaron?** El 25/11 pasaron 28 pruebas Flutter, 6 del panel, 94 del backend y 30 en emuladores Firebase. Se comprobó además el acceso online de cuatro roles, la lectura asignada de Obras y la navegación administrativa en Chrome. Los cinco archivos que compara el verificador del sitio publicado coinciden con los versionados en Git.

**¿Qué queda para probar con dispositivos?** En esta sesión no había Android conectado por USB. Quedan el escaneo con cámara, el push recibido en pantalla y el recorrido completo celular → panel con el mismo reclamo. El servicio reportó IA, Mercado Pago y FCM configurados y Maps simulado. Esa lectura por sí sola no verifica una inferencia real, un cobro ni una entrega push.

## Ensayo de dos minutos

1. Juanma abre el residente en el teléfono. Santino abre Reclamos en el panel publicado. Ambos comprueban Torre del Parque.
2. Juanma envía un reclamo de ensayo con título reconocible. Santino señala ese mismo registro y lee el estado que efectivamente aparece.
3. En el teléfono de guardia, escanear una autorización recién creada y revisar el evento en el panel. Para mostrar Obras, iniciar sesión en la APK con el responsable y abrir la partida de pintura.
4. Proyectar la landing y el video del equipo. Cerrar con los QR. Ensayar la descarga de Drive desde un teléfono sin sesión del equipo.

### Evidencia y mantenimiento

Los detalles reproducibles están en [auditoría técnica](AUDITORIA_2026-10-16.md), [producción](PRODUCCION.md), [guía de testers](GUIA_QA_GRUPO.md) y [bitácora](BITACORA.md). Para volver a probar, usar `npm run verificar`, `flutter test` desde mobile, `npm run verificar:servicios` y `npm run verificar:version-web`. El seed recrea exclusivamente emuladores. Si cambia Render, la APK o el panel publicado, registrar la revisión y repetir el recorrido afectado.

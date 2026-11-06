# Habita · Guía rápida para el equipo de QA

Entrega de prueba · 6 de noviembre de 2026

## 1. Qué van a probar

Habita administra un complejo residencial. La APK es para residentes y guardias; el panel web es para administración. Ambas vistas comparten los datos: por ejemplo, un reclamo creado en el celular aparece en la web.

## 2. Cómo entrar

- **APK:** instalar el archivo entregado `Habita-Android-2026-10-29 (1).apk` (versión 1.0.2). Es la copia con la que el equipo confirmó el inicio de sesión. Requiere Android 7 o superior e internet.
- **Panel de administración:** https://habita-complejos-goiburu.web.app/panel/
- **Página de presentación:** https://habita-complejos-goiburu.web.app/ (no requiere cuenta).

Al abrir la APK, Android puede pedir permiso para instalar desde el navegador o gestor de archivos. Habilitarlo para esa instalación. Aceptar cámara para escanear QR y notificaciones para probar avisos. No necesitan acceder a Firebase, Render ni instalar herramientas de programación.

### Cuentas de prueba

**Contraseña de las tres cuentas: `Habita2026!`** (respetar mayúscula y signo final).

| Dónde | Rol | Correo |
| --- | --- | --- |
| APK | Residente | residente@habita.demo |
| APK | Guardia | guardia@habita.demo |
| Panel web | Administración | admin@habita.demo |

Accesos y roles comprobados online el 06/11/2026. Trabajan sobre el complejo demo Torre del Parque; el residente corresponde a la unidad 3A. Para cambiar de rol, cerrar sesión y entrar con la otra cuenta. Una cuenta móvil no habilita el panel; administración se usa en la web. No cambiar las contraseñas compartidas.

## 3. Qué hace cada vista

- **Residente / APK:** Inicio muestra novedades; Expensas muestra liquidaciones y acceso al pago; Accesos permite ver credenciales y autorizar visitas con QR. En Más están Mi unidad, Mis pagos, Reservar amenities, Mis reclamos, Obras del complejo y Notificaciones.
- **Guardia / APK:** Escanear valida QR o patentes con el punto y sentido correspondientes; Historial muestra los intentos y resultados. Si un acceso se rechaza, revisar el motivo, vigencia y usos disponibles.
- **Administración / web:** Dashboard resume el complejo; Unidades gestiona departamentos; Expensas prepara y publica períodos; Cobranza consulta pagos. También hay Accesos, Reclamos, Amenities, Comunicaciones, Obras y Configuración.

## 4. Recorrido sugerido (20–30 minutos)

Ideal: una PC con el panel y dos celulares, uno por rol. Con un celular pueden alternar cuentas; para escanear, mostrar el QR en otra pantalla.

1. **Ingreso:** abrir la APK como residente y el panel como administrador. Probar también una contraseña incorrecta: debe informar el rechazo sin cerrar la app.
2. **Reclamo → panel → APK:** en Más → Mis reclamos, crear uno titulado `QA - [grupo] - luz de prueba`. Encontrarlo en Reclamos del panel, cambiar su estado y comprobar el cambio en el celular.
3. **Aviso → residente:** desde Comunicaciones del panel, publicar un aviso de prueba. Revisar Inicio o Notificaciones en la APK; comprobar por separado si llega el push.
4. **Reserva → administración:** en Más → Reservar amenities, elegir espacio, fecha, horario y asistentes. Verificar la reserva en Amenities del panel y probar su cancelación. Si requiere aprobación, gestionarla desde el panel.
5. **Visita → guardia:** generar una autorización en Accesos del residente y mostrar su QR. Entrar como guardia, seleccionar punto/sentido y escanearlo; revisar el resultado y el historial. Un QR vencido o sin usos debe rechazarse.
6. **Expensas:** comparar el período y saldo de la unidad 3A en app y panel; abrir el detalle. Preparar borradores sólo con datos acordados con el equipo; cerrar un período publica importes para las unidades.
7. **Errores y conexión:** probar formularios vacíos, volver atrás y cerrar sesión. Cortar/restaurar internet y observar si informa el problema y permite recuperarse. Anotar pantallas trabadas, desbordes o datos inconsistentes.

## 5. Alcance de esta entrega

- Usar datos ficticios con prefijo `QA - [grupo]`; los cambios se guardan y son visibles para los demás testers. Si falta un espacio, obra o período, pedir al equipo un escenario de prueba.
- **Pagos:** no usar dinero, tarjetas ni cuentas personales. Probar un pago completo sólo cuando el equipo entregue el circuito sandbox y sus datos de prueba. Un estado de integración “activo” no demuestra un pago exitoso.
- **Fotos:** la carga de imágenes está desactivada en esta APK. No confundirla con el permiso de cámara del escáner QR.
- **Obras:** puede consultarse lo que exista; la cuenta específica de responsable de obra no está habilitada en esta entrega. Tampoco se entrega una cuenta de superadministración. No dar por probado el registro de avances ni su sincronización sin conexión.
- La primera consulta tras un rato de inactividad puede tardar cerca de un minuto. Si sigue fallando, registrar el mensaje y la hora.

## 6. Cómo informar un error

Entregar una lista con: **título, rol, celular/Android o navegador, pasos para repetirlo, resultado esperado, resultado obtenido y captura/video** sin contraseñas ni QR vigentes. Agregar fecha/hora y severidad: bloqueante (no permite continuar), alta (función importante falla), media o baja.

Ejemplo: “Reserva no aparece — Residente / Android — elegí espacio y horario, confirmé y abrí Mis reservas — esperaba verla; apareció una lista vacía”. Si una prueba no pudo hacerse, marcarla como **no ejecutada** y explicar qué faltó.

# Habita: registro de GitHub Projects

Actualizado: 2026-10-09. [Tablero Habita - Startup](https://github.com/users/SantinoZanussi/projects/2).

59 tarjetas activas: **21 Finalizado**, **13 En proceso**, **25 Pendiente**. Se conservan las 11 tarjetas previas y se agregan 48 actividades, incluyendo las fases 1 a 5. El sprint del 02/10 conserva su compromiso y no se da por cumplido sin evidencia.

## Cómo usarlo

Trabajar sobre `main`, leer [AGENTS.md](../AGENTS.md) y [BITACORA.md](BITACORA.md), verificar el resultado y actualizar el tablero y [copia estructurada](TABLERO_GITHUB.json). Buscar el título antes de crear una tarjeta. Las actividades agregadas usan prefijos de fase. Los criterios siguientes permiten retomar desde otra PC.

**Finalizado** puede cerrar una implementación, una prueba automática o un material preparado. No equivale a cerrar la prueba física, integración externa, QA presencial ni presentación: cada una tiene actividad independiente. **En proceso** agrupa funciones implementadas cuya validación o integración queda abierta. **Pendiente** contiene recorridos concretos y entregas sin evidencia de realización.

No crear datos ni pagos reales para validar. Usar escenarios demo autorizados o emuladores; `seed` sólo en emuladores. No publicar credenciales ni datos personales en tarjetas o capturas.

## Evidencia

- [Bitácora](BITACORA.md): verificaciones, APK y publicación con fechas.
- [Matriz QA](QA_2026-10-02.md): resultados automáticos y recorridos manuales pendientes.
- [Producción](PRODUCCION.md): Firebase, Render y límites de proveedores.
- [QA cruzado](FASE_3_QA.md), [lanzamiento](FASE_4_LANZAMIENTO.md), [pitch y demo](FASE_5_PITCH.md).

## Finalizado

### [F1] Definir problema, público, modelo de negocio e identidad Habita

Concepto, cliente, escalabilidad e identidad disponibles en docs/PROYECTO_CONTEXTO.md y brand/. No equivale a validar ventas.

### [F2] Implementar autenticación Firebase y perfiles de los cinco roles

Firebase Auth y roles implementados. Pruebas online con cada perfil en tarjeta independiente.

### [F2] Validar permisos y aislamiento por complejo, unidad y obra en API

Validaciones de backend y reglas implementadas; conservar controles negativos y aislamiento multi-tenant.

### [F2] Implementar consultas del residente: unidad, avisos, reclamos y reservas

Pantallas implementadas; navegación física y errores pendientes en QA.

### [F2] Implementar autorización de visitas y QR dinámico firmado

Nombre/documento, vigencia y usos; QR sin datos personales. Recorrido con guardia físico pendiente.

### [F2] Implementar validación de ingreso y egreso con eventos inmutables

Transacciones y eventos append-only implementados. Escaneo físico y casos negativos en tareas de QA.

### [F2] Implementar reservas de SUM, pileta y amenities con cupos y límites

Capacidad, límites por residente, disponibilidad y cancelación implementados. Verificación con varias cuentas pendiente.

### [F2] Implementar reclamos con categoría, prioridad, asignación y estados

Ciclo de reclamos implementado en app/API/panel. Prueba sincronizada con sesión pendiente.

### [F2] Implementar clasificación de reclamos y fallback local de IA

Integración Gemini y respaldo local implementados. Respuesta del proveedor real pendiente.

### [F2] Implementar obras con etapas, dependencias, calendario y presupuesto

Planificación, avances y gasto versus presupuesto implementados. Demo física pendiente.

### [F2] Implementar liquidación de expensas con cierre exacto en centavos

Prorrateo, detalle por unidad y mora implementados. Compatibilidad y cuenta online conservan tarjetas propias.

### [F2] Implementar pagos transaccionales, imputación e idempotencia

Lógica sensible en backend. Checkout externo y prueba manual online pendientes.

### [F2] Conectar app y panel a Firebase y Render de producción

API HTTPS y Firebase habita-complejos-goiburu configurados. No implica validar todos los proveedores.

### [F2] Ejecutar verificaciones de backend, reglas, web y Flutter

02/10: 2 pruebas web, 88 backend y 20 reglas/integración aprobadas. 08/10: analyze limpio y 23 pruebas Flutter aprobadas. Evidencia fechada, sin repetir en esta carga.

### [F2] Probar reintentos concurrentes del mismo pago sin duplicar imputación

Integración Firestore aprobada el 02/10 en firebase/tests/contabilidad.test.mjs; commit cce562f publicado.

### [F2] Probar pagos pendientes, rechazados y cancelados sin acreditar saldo

Casos automatizados aprobados el 02/10: sólo approved imputa; transición y reintentos seguros. Commit cce562f.

### [F3] Preparar matriz QA con pasos, resultados y evidencia por rol

docs/QA_2026-10-02.md publicado. Matriz y casos automáticos completos; 15 recorridos manuales siguen pendientes. No cierra QA cruzado.

### [F2] Generar APK Android de producción firmada para pruebas

08/10: release 1.0.0, paquete ar.com.habita.habita, Android 7+, firma y configuración verificadas. APK en Descargas; instalación física pendiente.

### [F4] Publicar landing y panel actuales en Firebase Hosting

08/10: Deploy complete; HTML, CSS y JS publicados coinciden con build local. npm run verificar:version-web y verificar:servicios aprobados.

### [F4] Implementar landing y formulario de contacto validado en API

Propuesta, módulos, planes, CTA y formulario implementados. docs/FASE_4_LANZAMIENTO.md. Video real y revisión visual final pendientes.

### [F5] Preparar guion de pitch y demo de tres minutos

docs/FASE_5_PITCH.md contiene pitch de 90 segundos y recorrido QR/expensas/obras. No es evidencia de ensayo o exposición.

## En proceso

### [F2] Validar pantallas nuevas de unidades, ayuda y obras en Android

Cerrar al recorrer enlaces, estados vacíos, errores y navegación de cada perfil en dispositivo y navegador; adjuntar evidencia.

### [F2] Instalar APK del 08/10 y validar actualización y recorridos reales

Instalar Habita-Android-2026-10-08.apk, comprobar acceso residente/guardia y enviar hallazgos reproducibles. No afirmar funcionamiento completo por compilar.

### [F2] Resolver o documentar adjuntos de reclamos sin Firebase Blaze

Storage uploads desactivados en Spark. Evaluar alternativa gratuita o conservar limitación explícita; cerrar con decisión y comportamiento visible.

### SPRINT (2 oct): Comprobar el despliegue 734b2c4 en Render y abrir expensas desde residente y administración sin error de conciliación

Compromiso del 02/10 conservado sin aprobarlo. Cierre con revisión de Render y expensas en ambas sesiones.

### Desbloquear pagos de app y panel tras confirmar el despliegue: revisar cuenta histórica y el flujo manual demo

Revisar cuenta histórica y flujo manual sólo en demo autorizado. Casos separados en Pendiente.

### Mercado Pago: completar sandbox y verificar checkout, retorno y webhook cuando el proveedor habilite credenciales de prueba

Configuración MP activa informada por health; aún falta checkout/retorno/webhook en sandbox y validar tipo de credenciales.

### Compatibilizar la lectura de liquidaciones históricas sin duplicar saldo ni intereses

Código y pruebas de compatibilidad preparados; validar liquidaciones antiguas sin deuda ni intereses duplicados con sesión.

### Probar autorización y QR dinámico de residente a guardia con dos sesiones y un teléfono físico

Crear visita demo autorizada, renovar QR y registrar ingreso/egreso usando residente y guardia físicos.

### Revisar estabilidad de la cámara del guardia: permisos, lectura repetida y recuperación ante congelamiento

Comprobar permisos, lectura repetida y recuperación ante cámara congelada en teléfono físico.

### Validar con cuentas distintas que reservas y cupos se actualicen al reservar y cancelar

Con varias cuentas, respetar cupo y límite individual; disponibilidad visible actualizada tras reservar/cancelar.

### Confirmar que las versiones publicadas de Firebase/Render coincidan con main y funcionen con sesiones de cada rol

Hosting publicado y comparado el 08/10; Render y sesiones por rol aún pendientes.

### Demostrar recepción de notificaciones FCM en un Android físico

Recibir FCM en Android físico con destinatario correcto; configuración activa no prueba entrega.

### Validar clasificación real con Gemini y el respaldo local ante errores del proveedor

Observar clasificación real y fallback ante fallo; configuración activa no prueba inferencia.

## Pendiente

### [F2] Abrir expensas del residente sin error de conciliación histórica

Tras confirmar Render, iniciar sesión y comprobar que liquidaciones pagadas no bloquean ni duplican deuda. Usar datos demo autorizados.

### [F2] Comprobar cobranza del administrador para la misma cuenta

Abrir panel con sesión, consultar saldo y registrar ausencia del mensaje de conciliación. Comparar con la app.

### [F2] Generar enlace de pago demo o sandbox sin cobro real

Comprobar validaciones, monto, referencia y apertura del enlace en entorno de prueba; no crear pagos reales para validar.

### [F2] Verificar pago manual demo: saldo, comprobante e historial

Registrar pago sólo en entorno demo autorizado y comprobar saldo correcto, recibo, trazabilidad y actualización en app/panel.

### [F3] Probar QR vencido, revocado, agotado y captura antigua

Rechazar cada autorización inválida sin registrar entrada. Conservar mensaje visible y evidencia sin datos personales.

### [F3] Probar QR repetido y egreso sin ingreso previo

Escaneo repetido no duplica ingreso; salida requiere entrada válida. Comprobar eventos y respuesta del guardia.

### [F3] Comprobar devolución inmediata de cupo al cancelar reserva

Con dos sesiones, cancelar una reserva y observar capacidad disponible actualizada sin recargar manualmente.

### [F3] Probar horarios, días, solapamientos y cambio de fecha en reservas

Cubrir límites temporales y franja que cruza medianoche; respetar configuración del amenity y zona horaria.

### [F3] Validar privacidad con sesiones de distintas unidades y complejos

Intentar consultar reclamos, reservas, cuentas y autorizaciones ajenas; confirmar rechazo en UI/API y avisos dirigidos.

### [F3] Recorrer permisos visibles de residente, guardia y administración

Cada perfil sólo ve acciones autorizadas; guardia no accede a saldos. Incluir responsable de obra y superadmin en matriz.

### [F3] Verificar notificaciones de aviso, reserva y pago en Android

Complementa recepción FCM: comprobar destinatarios correctos, vínculo de apertura y ausencia de duplicados en cada evento.

### [F3] Probar creación, asignación y resolución de reclamo entre app y panel

Mismo reclamo demo se actualiza en ambas sesiones; permisos y trazabilidad correctos.

### [F3] Probar panel publicado con sesión en celular y computadora

Hosting actualizado el 08/10. Validar responsive, tablas, menús y formularios reales; adjuntar capturas de ambos anchos.

### [F3] Ejecutar QA cruzado presencial con otro equipo

Usar docs/FASE_3_QA.md y matriz; registrar equipo evaluador, casos, resultados y bugs reproducibles. No cerrar sin actividad real.

### [F4] Corregir hallazgos del QA y verificar regresiones

Crear tareas por defecto observado con pasos/evidencia; corregir y repetir caso fallido y flujos afectados antes del cierre.

### [F4] Revisar landing con funcionalidades reales y capturas actuales

Revisar textos, límites de proveedores, CTA y capturas en desktop/móvil; evitar promesas de capacidades aún no verificadas.

### [F4] Grabar video demo de residente, guardia y administrador

Video real de 2:30–3:00 con QR, expensas y obras; sin credenciales ni datos reales. Publicar vínculo reproducible e incorporarlo a landing.

### [F5] Preparar diapositivas finales del pitch

Problema, cliente, solución, arquitectura, núcleos técnicos, demo, límites y próximos pasos; exportación y revisión visual.

### [F5] Asignar partes de presentación y explicar los flujos

Confirmar responsables para narración/panel, residente y guardia/obra; cada integrante explica arquitectura y decisiones.

### [F5] Ensayar y cronometrar la demo con la red del aula

Probar recorrido de tres minutos, inicio de servicios y alternativa ante demora de Render. Seed únicamente en emuladores.

### [F5] Realizar exposición presencial y registrar evidencia

Presentación efectiva del equipo y devolución docente; guion o slides por sí solos no cumplen este objetivo.

### [Gestión] Revisar sprint cada viernes y acordar siguiente objetivo

Responsable mantiene Sheets/Projects: evidencia, cumplido/no cumplido y meta siguiente. No modificar fechas ni aprobar compromisos sin revisión.

### [Entrega] Ejecutar aceptación final de app y panel con evidencia

Completar recorridos manuales de matriz, proveedores/dispositivo, publicación y materiales. Revisar suite profunda antes de entrega cuando corresponda.

### [F3] Validar obras: camino crítico, avances y presupuesto entre roles

Responsable registra avance demo; residente/admin observan calendario, estimación y gasto. Comprobar restricciones por obra y registros append-only.

### Confirmar en Render que el commit 734b2c4 está activo y revisar la cuenta desde app y panel

Confirmar en dashboard el commit activo de Render y compararlo con main. La revisión antigua 734b2c4 se mantiene como referencia; no desplegar automáticamente un commit viejo.



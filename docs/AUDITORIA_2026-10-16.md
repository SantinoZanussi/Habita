# Revisión integral — 2026-10-16

## Alcance y evidencia

Revisión de Flutter residente/guardia/obras, panel web, rutas y servicios de backend, reglas de Firestore e integraciones. Prioridad: expensas y apertura de Mercado Pago en Android. Las pruebas contables escriben únicamente en emuladores; la auditoría de Firebase real fue de sólo lectura. No se cobraron pagos reales ni se alteraron saldos publicados.

## Defectos corregidos

| Área | Problema observado | Corrección y evidencia |
| --- | --- | --- |
| Android / MP | El checkout sólo aparecía como texto. La prueba anterior construía un diálogo ficticio. | Componente real con Abrir Mercado Pago y Copiar enlace, bloqueo de pulsaciones simultáneas, recuperación si no hay navegador; tests del componente real. |
| Expensas | Inicio podía afirmar que toda la cuenta estaba al día mirando sólo el último período. Se mostraba el importe original después de pagos parciales. | Inicio y expensas consultan el estado contable del backend; separan capital, intereses, crédito, saldo actual e importe histórico. Actualización al volver a la app, botón manual y eventos de Firestore. |
| Deuda antigua | El checkout no encontraba deudas anteriores a los últimos 12 períodos. | Historial completo y próximo pendiente ordenado por vencimiento; checkout del saldo total de cuenta, incluido pago parcial. Se mantiene contrato por período para APK anteriores. |
| Cobranza | El resumen recalculaba mora sin considerar el último corte contable. | Usa la misma deuda calculada que el residente; incluye intereses en morosidad y saldo total. Regresión después de pago parcial. |
| Pago manual | Reintentar tras una respuesta perdida podía acreditar otro pago. | Clave estable por formulario, transacción idempotente y rechazo de una misma clave con otros datos. Validación de período cerrado, unidad, importe y medio. |
| Liquidaciones | Alta y edición separaban lectura/escritura y podían competir con el cierre. | Transacciones para crear/editar; cierre inmutable; validación de vencimiento, fondo y gastos antes de persistir. |
| Retorno MP | El residente volvía al login del panel administrativo. | Página pública `/pago/`, sin afirmar pago aprobado por parámetros de URL; compatibilidad con retornos antiguos del panel. |
| Integración MP | La clave por período podía reutilizar una preferencia con un importe anterior. | Clave nueva por solicitud, estable en sus reintentos HTTP; referencias estrictas, importes seguros y validación de moneda/ID del pago consultado. |
| Reservas | Dos altas podían competir por una consulta vacía; cancelar/aprobar podía revivir reservas. | Documento de amenity compartido para serializar altas; cancelación/aprobación transaccionales; prueba concurrente y devolución del cupo. |
| Horarios | No se aplicaban horario ni anticipación en backend. | Control de pasado, anticipación y franjas en hora argentina, incluidas franjas nocturnas. |
| ABM de amenities | Una edición parcial podía guardar capacidad NaN o reactivar un espacio. | Campos permitidos y validación; preservación de capacidad/estado no enviados. |
| Privacidad | Guardia podía leer unidades completas; responsable podía leer autorizaciones de cualquier obra. | Guardia utiliza el flujo de accesos; reglas cierran lectura de unidades y restringen autorizaciones por obra asignada. |
| Integridad | ABM de unidades aceptaba saldo a favor; un cliente podía inyectar clasificación de reclamos. | Lista de campos permitidos; reglas de creación de reclamos restringidas. |
| Obras | Porcentajes no finitos/fuera de rango o fechas inválidas podían llegar a persistencia. | Rechazo previo a lecturas/escrituras; pruebas de entradas inválidas. |
| Operación | Salud no identificaba el código desplegado. | `/api/salud` expone `RENDER_GIT_COMMIT`, sin credenciales. |

## Verificación

- `npm run verificar`: 2 pruebas web, 89 backend y 28 integración/reglas aprobadas en primera pasada.
- Pruebas nuevas posteriores: validación de expensas/obras y contrato MP aprobadas (5 casos adicionales, 94 backend en total). Segunda pasada de integración/reglas: 30/30 aprobadas, incluyendo HTTP de períodos y edición parcial de amenities.
- Flutter: suite completa de 26 pruebas aprobada; nueva prueba de copiar enlace usa el widget real. `flutter analyze --no-pub` sin observaciones y 4 pruebas focalizadas de pago aprobadas tras ajustes.
- El primer intento online falló por conectividad (también reportó autenticación Firebase); al recuperar red, las mismas comprobaciones y la auditoría autenticada funcionaron sin cambiar credenciales.
- Render, Firestore real, landing, panel, CORS y rechazo sin sesión respondieron correctamente. La auditoría contable confirmó el comprobante histórico cancelado; no se migraron documentos.
- Render mostraba Live `253fed9` y Auto-Deploy deshabilitado después de rollback. Incluía la compatibilidad histórica `734b2c4`, pero no las revisiones posteriores. Publicar en Git no desplegaba automáticamente.
- Publicación final comprobada: Render Live y `/api/salud` identifican `8ee4e8ada4ed06ef051378580f6c276946e81ad8`. El despliegue se disparó por Blueprint; Auto-Deploy continúa deshabilitado tras el rollback anterior. No asumir que cada push futuro publica el backend.
- Hosting y reglas publicados mediante Firebase CLI. `npm run verificar:version-web` confirmó los cinco archivos (incluido `/pago/`); `npm run verificar:servicios` aprobó todos los controles. La página pública de retorno se abrió en navegador y no afirma una acreditación sin confirmación del backend.
- APK 1.0.1+2 compilada correctamente en modo release con Firebase/Render reales (455 segundos); `apksigner verify` confirmó firma v2 válida y el mismo certificado que la APK del 08/10. Paquete `ar.com.habita.habita`, Android 7+ (SDK 24), objetivo SDK 36. Sigue usando la firma de desarrollo configurada en el repo: es una entrega para pruebas, no una publicación de Play Store.
- Compilación Flutter web aprobada; no equivale a publicar esa aplicación Flutter en Hosting, que sirve la landing y el panel.

## Entrega y seguimiento

- APK instalable: `C:\Users\user\Downloads\Habita-Android-2026-10-16.apk`. SHA-256: `D605329DDCF32FE3755ABC5FAD98CFF077729CAB6BA8866370A58629E47564F8`. Debe instalarse para obtener las correcciones del cliente; desplegar el backend no actualiza una APK instalada.
- [Google Sheets](https://docs.google.com/spreadsheets/d/1C36qSaOgDZzIdiSCcnQrlan674dMUNDXCEfIL0cujNw/edit): seis avances en `Diagnóstico!B26:B31`, notas verificadas en `Sprints!G7` y `C8`. Guardado en Drive confirmado; compromisos, desplegables y aprobación/cumplimiento preservados.
- [Tarjeta de pagos](https://github.com/users/SantinoZanussi/projects/2/views/1?pane=issue&itemId=259771299): descripción actualizada con publicación, pruebas y criterios pendientes; continúa En proceso por la aceptación física/sandbox.
- Evidencia: [diagnóstico](../outputs/auditoria-2026-10-16/sheets-diagnostico.png), [sprint](../outputs/auditoria-2026-10-16/sheets-sprint.png), [Render Live](../outputs/auditoria-2026-10-16/render-live.png).

## Pendiente de aceptación real

1. Instalar APK nueva y recorrer residente/guardia/obras; cámara, QR físico, retorno de navegador y recepción FCM.
2. Checkout completo con usuarios/tarjetas de prueba de Mercado Pago y webhook. El estado `activo` sólo prueba configuración. No hay evidencia de un cobro sandbox realizado esta sesión.
3. Confirmar con sesión de usuario la misma cuenta desde APK y panel, sin error de conciliación; no confundir lectura administrativa de Firestore con una prueba de UI autenticada.
4. Reservar/cancelar con dos sesiones visibles y observar disponibilidad; los tests transaccionales no sustituyen esa evidencia presencial.
5. Clasificación real por Gemini y notificaciones en dispositivo. Se conservan las regresiones del fallback ante respuesta inválida.
6. Obras sin conexión: existe endpoint de sincronización, pero la pantalla actual envía directamente; falta cola persistente de avances y ensayo sin red. La actualización concurrente del cronograma requiere ampliar las pruebas específicas de obras.
7. Fotos continúan deshabilitadas en el build Spark; Maps está simulado. No se cambió facturación.
8. QA cruzado, video, pitch y exposición siguen requiriendo trabajo del equipo. Los sprints se documentan sin inventar aprobación docente ni demostraciones.

## Referencias técnicas consultadas

- [Mercado Pago: preferencia y enlace init_point](https://www.mercadopago.com.ar/developers/es/reference/online-payments/checkout-pro-preferences/overview).
- [Render: variables del despliegue](https://render.com/docs/environment-variables).

El detalle final de publicación, APK y seguimiento queda en [BITACORA.md](BITACORA.md).

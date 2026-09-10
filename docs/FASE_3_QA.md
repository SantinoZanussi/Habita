# Fase 3 — Preparación de QA cruzado

## Objetivo

Dejar una prueba reproducible para que otra persona o equipo use la app móvil y el panel con datos demo, intente romper los flujos principales y registre cada hallazgo. Esta guía prepara la Fase 3; no reemplaza el intercambio presencial con otro equipo.

## Estado actual

- El backend, las reglas de Firebase y la app móvil tienen suites automatizadas.
- El panel permite avanzar el estado de un reclamo y corregir su área o urgencia. La corrección queda registrada por usuario y actualiza la prioridad.
- Mercado Pago queda fuera de esta ronda: el portal del proveedor no permite activar las credenciales de prueba. El flujo de pagos demo autenticado sigue disponible y está marcado como simulado.
- Falta ejecutar la prueba con una persona externa y adjuntar sus hallazgos en una sección de resultados.

## Preparación local

Desde la raíz del repositorio:

```powershell
npm install
npm run emu
```

En otra terminal:

```powershell
npm run seed
npm run backend
```

Abrir `http://127.0.0.1:5000/panel`. Para la app móvil, ejecutar `cd mobile; flutter run`. Todas las cuentas demo usan `Habita2026!`; están listadas en el README.

## Casos para la persona que hace QA

| ID | Rol | Acción | Resultado esperado |
| --- | --- | --- | --- |
| QA-01 | Administración | Iniciar sesión y abrir Dashboard, Reclamos, Expensas y Accesos | Las secciones cargan sin pantalla rota; los datos aparecen en tiempo real. |
| QA-02 | Residente | Crear un reclamo de más de 10 caracteres desde la app | El reclamo aparece en el panel, con área, urgencia, confianza y resumen; si la IA no responde, queda marcado con origen de respaldo. |
| QA-03 | Administración | Abrir Reclamos, buscar por texto y filtrar por estado | La tabla conserva el texto al actualizarse, muestra sólo los resultados coincidentes y permite volver a `Todos los estados`. |
| QA-04 | Administración | Pulsar `Corregir` en un reclamo | Se pueden elegir área y urgencia; al guardar, la corrección queda visible y la prioridad cambia. La clasificación IA original no se reemplaza. |
| QA-05 | Administración | Avanzar un reclamo de pendiente a en progreso y luego a resuelto; intentar una transición inválida | Las transiciones válidas funcionan y la inválida informa el error sin modificar el historial. |
| QA-06 | Residente / Administración | Crear o revisar un período, previsualizarlo y cerrarlo | La vista previa informa si cierra exacto; un período cerrado queda publicado y no se puede editar como borrador. |
| QA-07 | Guardia | Validar `HBA-DEMO-VISITA-01` tres veces en el mismo sentido | Los dos primeros ingresos permitidos consumen los usos; el tercer intento se rechaza y los tres eventos quedan auditados. |
| QA-08 | Guardia | Intentar validar una salida sin ingreso previo | Se rechaza con un motivo comprensible y no se crea un egreso válido. |
| QA-09 | Residente | Registrar un pago desde el flujo demo de la app | Se muestra confirmación explícita; el pago sólo se registra si la persona confirma. La pantalla identifica que es demo. |
| QA-10 | Roles | Abrir la app móvil con residente, guardia y responsable de obra; intentar entrar al panel con una cuenta móvil | Cada rol ve sus acciones; una cuenta móvil no puede abrir el panel de administración. |
| QA-11 | Seguridad | Cambiar el ID de complejo o unidad en una solicitud autenticada | El backend rechaza el acceso fuera del alcance del usuario; no se filtran datos de otro complejo. |
| QA-12 | Responsive | Repetir login, reclamos y accesos en una ventana angosta y en un celular | No hay desbordamiento horizontal; los botones y formularios siguen siendo utilizables. |
| QA-13 | Recuperación | Cortar y restaurar la conexión local mientras el panel está abierto | Se muestra el aviso de conectividad y, al volver la red, las suscripciones se actualizan sin recargar manualmente. |

## Registro de hallazgos

Para cada bug, copiar esta ficha y completar todos los campos:

```markdown
### BUG-001 — Título breve
- Severidad: bloqueante / alta / media / baja
- Caso: QA-xx
- Rol y entorno: cuenta demo, navegador o dispositivo, tamaño de pantalla
- Pasos:
  1. ...
  2. ...
- Esperado: ...
- Observado: ...
- Evidencia: captura, video o log sin credenciales
- Estado: abierto / corregido / verificado
```

## Evidencia automatizada disponible

Ejecutar desde la raíz y adjuntar la salida al cierre de la ronda:

```powershell
npm test                 # backend y dominio
npm run test:reglas      # Firestore y Storage
npm run build:web        # compilación del panel
cd mobile
flutter analyze
flutter test
```

En la integración de Fase 2 quedaron verificadas 79 pruebas de backend, 11 de reglas, análisis Flutter sin problemas y 4 tests móviles. Si una ejecución posterior cambia esos números, registrar el resultado real en `docs/BITACORA.md`.

## Cierre de la ronda

La Fase 3 se puede marcar como ejecutada sólo cuando una persona o equipo externo complete los casos, registre los bugs y deje su fecha y nombre en esta documentación o en un informe enlazado. Las correcciones de esos bugs se documentan después en la Fase 4.

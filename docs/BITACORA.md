# Bitácora de Habita

Registro de continuidad para trabajar desde distintas computadoras y con distintas sesiones de IA. Las entradas nuevas van arriba. Cada agente debe leer `AGENTS.md` y completar su entrada al terminar.

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

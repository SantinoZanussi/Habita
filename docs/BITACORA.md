# Bitácora de Habita

Registro de continuidad para trabajar desde distintas computadoras y con distintas sesiones de IA. Las entradas nuevas van arriba. Cada agente debe leer `AGENTS.md` y completar su entrada al terminar.

## Estado rápido

- Rama de trabajo registrada al crear esta bitácora: `codex/retomar-fase-2`.
- Base del código retomado: commit `1f8945a` (`docs: ordenar activacion gratuita de integraciones`). La documentación de continuidad quedó en `fdfd921` (`docs: agregar contexto y bitacora para continuidad`).
- Fase: transición de Fase 2 hacia preparación de Fases 3 a 5.
- Mercado Pago: la aplicación `Habita TP` existe, pero la activación de credenciales de prueba devuelve “Algo salió mal” en el portal. El código conserva modo simulado autenticado.
- Firebase/Render: hay un despliegue preparado y una comprobación de solo lectura documentada en `docs/PRODUCCION.md`.
- Seguridad: existen cambios locales para aislamiento de usuarios y accesos; deben permanecer visibles en el diff hasta que se revisen y se integren. El commit `fdfd921` contiene sólo la documentación de continuidad.

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

# Instrucciones para agentes de IA

Estas instrucciones acompañan al repositorio Habita. Leerlas antes de modificar código. El contexto funcional completo está en `docs/TAREA_CONTEXTO.md` y `docs/PROYECTO_CONTEXTO.md`; el estado y la historia de trabajo están en `docs/BITACORA.md`.

**Preferencia permanente del proyecto:** trabajar siempre sobre `main`, verificar los cambios y publicarlos allí. No crear ramas nuevas ni dejar el resultado final sólo en una rama salvo que el usuario lo pida expresamente. Si existe trabajo incompleto, registrá su estado en la bitácora y terminá de validarlo antes de integrarlo a `main`.

## Comportamiento automático al retomar

Cuando el usuario diga `continuá`, `seguí`, `retomá`, `avanzá` o pida continuar el proyecto, no esperes que te indique dónde están las instrucciones ni que te pida actualizar la bitácora. Leé este archivo y `docs/BITACORA.md` de inmediato, inspeccioná el estado real del repositorio, elegí el siguiente pendiente autorizado, ejecutá el trabajo y verificá el resultado. Registrá el inicio y el cierre en la bitácora. Preguntá sólo si falta un dato que realmente impide avanzar o si una acción requiere una decisión del usuario; mientras tanto, continuá con todo lo que sí esté habilitado.

## Objetivo del producto

Habita administra edificios, consorcios, barrios cerrados y countries desde una app Flutter multirol, un panel web y un backend Node/Express conectados al mismo Firebase. Los roles son residente, guardia, responsable de obra, administrador y superadministrador.

## Orden de lectura al retomar

1. `AGENTS.md`.
2. `docs/BITACORA.md` para saber qué se hizo, qué se verificó y cuál es el siguiente paso.
3. `docs/TAREA_CONTEXTO.md` y `docs/PROYECTO_CONTEXTO.md` para requisitos y producto.
4. `docs/FASE_2_ENTREGA.md` y `docs/PRODUCCION.md` para arquitectura, límites y despliegue.
5. `git status --short --branch`, `git log -10 --oneline` y el diff existente.

No borres cambios locales ni uses `git reset --hard` o `git checkout --` para limpiar el árbol. Los cambios sin commit pueden pertenecer a otra sesión. Si hay modificaciones que no entendés, documentalas y trabajá alrededor de ellas.

## Reglas de trabajo

- Trabajá sobre `main` y conservá el remoto `origin`. Antes de empezar, sincronizá el árbol con `git pull --rebase` si no hay cambios locales que proteger.
- Antes de una decisión importante, buscá la evidencia en el código y en la documentación. No declares una fase terminada sólo porque compila.
- La lógica sensible vive en el backend. El cliente no debe calcular ni escribir por su cuenta saldos, permisos, eventos de acceso, cierres de liquidación, roles ni avances de obra.
- Mantené aislamiento multi-tenant: validá `complejoId`, `unidadId`, `obraIds` y el rol en cada ruta. Los eventos de acceso y avances de obra son append-only.
- Usá enteros en centavos para dinero y preservá el cierre exacto del prorrateo.
- Las claves de Firebase, Mercado Pago, Gemini, Maps y cualquier token quedan en variables de entorno. Nunca las pegues en código, commits, logs ni respuestas.
- `npm run seed` borra y recrea datos sólo en emuladores locales. Nunca lo ejecutes contra Firebase real.
- Mercado Pago permanece en modo simulado si `MP_ACCESS_TOKEN` está vacío. La simulación requiere sesión de residente y sólo sirve para datos demo. No inventes credenciales ni uses producción para destrabar una prueba.
- Firebase Spark, Render Free y las restricciones de Storage están documentados en `docs/PRODUCCION.md`. Si un proveedor externo falla, preservá el fallback local y registrá la limitación.
- Para editar archivos usá `apply_patch`. No agregues dependencias si el cambio puede resolverse con las existentes.

## Verificación mínima

Después de cambios de backend o reglas:

```powershell
npm run verificar
```

Después de cambios móviles:

```powershell
cd mobile
flutter analyze
flutter test
```

Para comprobar un despliegue existente, sin modificar datos:

```powershell
npm run verificar:servicios
```

Si un comando falla, registrá el comando, el error resumido y si el fallo es de código, entorno o proveedor. No ocultes una prueba fallida cambiando el resultado esperado.

## Protocolo de bitácora

Antes de empezar una sesión, agregá una entrada en `docs/BITACORA.md` con fecha, objetivo y estado inicial. Al terminar, completá la misma entrada con archivos modificados, verificaciones, decisiones y pendientes. Usá fechas ISO (`AAAA-MM-DD`) y enlaces relativos a archivos. No escribas secretos, tokens, contraseñas privadas ni datos personales.

La bitácora debe separar claramente:

- `Verificado`: evidencia observada en esta sesión.
- `Pendiente`: trabajo que todavía requiere código, proveedor, dispositivo o una persona.
- `Supuesto`: interpretación que debe confirmarse.

## Fases académicas

Fase 1 corresponde a ideación y marca. Fase 2 corresponde al desarrollo técnico. Fase 3 requiere QA cruzado con otro equipo. Fase 4 requiere correcciones, landing y video demo. Fase 5 requiere pitch y exposición. Un agente puede preparar materiales y checklists de las fases 3 a 5, pero no debe afirmar que el QA cruzado o una presentación presencial ocurrieron si no existe evidencia en la bitácora.

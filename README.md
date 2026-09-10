# Habita

Habita centraliza la operación de edificios, consorcios, barrios y countries en un único producto: app móvil multirol, panel de administración, backend de negocio y Firebase en tiempo real.

La Fase 2 implementa todo el alcance P0 definido en `docs/PROYECTO_CONTEXTO.md` y suma una base funcional de amenities, notificaciones y obras. La portada pública de Fase 4 está en `/` y el panel autenticado en `/panel`.

## Arranque local

Requisitos: Node.js 20 o superior, Java 21 (se reutiliza el JBR de Android Studio si está instalado) y Flutter 3.44 o superior.

```powershell
npm install
npm run emu
```

En otra terminal:

```powershell
npm run seed
npm run backend
```

Abrir `http://127.0.0.1:5000/` para la landing o `http://127.0.0.1:5000/panel` para el panel. El hosting se inicia junto con los emuladores.

### Entorno local y Firebase real

`npm run emu` levanta una copia local de Auth, Firestore, Storage y Hosting. Usa el mismo `projectId` de Firebase (**`habita-complejos-goiburu`**) sólo para que las referencias y la consola del emulador apunten al proyecto **Habita** correcto; los datos siguen dentro de la PC y no se escriben en Firebase Cloud. Por eso `npm run seed` es seguro sólo después de `npm run emu`: borra y recrea el escenario local.

El entorno real se usa con el deploy de Firebase Hosting y la API de Render. Requiere las credenciales de servicio y la configuración pública de `mobile/firebase.production.json`; no se debe ejecutar `npm run seed` ni apuntar el backend local a producción. Para comprobar el despliegue sin modificarlo, usar `npm run verificar:servicios`.

Para la app móvil:

```powershell
cd mobile
flutter pub get
flutter run
```

En Android Emulator, la app usa `10.0.2.2` para alcanzar los servicios de la PC. Para un dispositivo físico, pasar la IP de la computadora:

```powershell
flutter run --dart-define=API_BASE_URL=http://192.168.1.20:8787/api
```

### Probar el QR con dos sesiones en la misma PC

Firebase Auth conserva la sesión por origen del navegador. Para usar residente y guardia al mismo tiempo, levantá dos instancias de Flutter:

```powershell
# Terminal 1
cd mobile
flutter run -d web-server --web-port 9100

# Terminal 2
cd mobile
flutter run -d web-server --web-port 9101
```

Abrí `http://localhost:9100/` como residente y `http://localhost:9101/` como guardia. Los puertos distintos mantienen sesiones separadas, pero ambas instancias usan el mismo backend (`8787`) y los mismos emuladores. Usá las cuentas demo de la tabla siguiente. En residente, entrá a **Accesos** para mostrar el QR; en guardia, entrá a **Escanear** y apuntá la cámara del dispositivo o de la PC al código.

## Cuentas demo

Todas usan la contraseña `Habita2026!`.

| Rol | Usuario |
| --- | --- |
| Superadministración | `superadmin@habita.demo` |
| Administración | `admin@habita.demo` |
| Residente, unidad 3A | `residente@habita.demo` |
| Guardia | `guardia@habita.demo` |
| Responsable de obra | `obra@habita.demo` |

## Verificación

```powershell
npm run verificar
cd mobile
flutter analyze
flutter test
flutter build web --release
```

La guía completa de arquitectura, alcance, seguridad, proveedores externos y defensa está en [docs/FASE_2_ENTREGA.md](docs/FASE_2_ENTREGA.md). El checklist de QA cruzado está en [docs/FASE_3_QA.md](docs/FASE_3_QA.md).

## Continuidad entre computadoras y sesiones de IA

Antes de trabajar en otra PC, actualizá el repositorio y conservá los archivos de contexto. El agente debe leer primero [AGENTS.md](AGENTS.md) y después [docs/BITACORA.md](docs/BITACORA.md). La bitácora registra qué se verificó, qué quedó pendiente y cuál es el siguiente paso; no contiene secretos.

Al pedirle al agente que continúe, esas instrucciones le indican que debe leer ambos archivos, retomar el siguiente pendiente y actualizar la bitácora sin que tengas que recordárselo.

```powershell
git pull --rebase
git status --short --branch
Get-Content AGENTS.md
Get-Content docs/BITACORA.md
```

Al terminar una sesión, agregá una entrada a la bitácora, ejecutá las verificaciones que correspondan y hacé commit de la documentación y del código revisado directamente en `main`. Publicá `main` en GitHub para que la próxima PC pueda continuar desde el mismo punto. No subas `.env`, claves de servicio, APKs con secretos ni credenciales de proveedores.

El flujo normal del proyecto no crea ramas. Sólo usá una rama separada si el usuario lo solicita expresamente o si hay un trabajo incompleto que todavía no puede integrarse con seguridad; en ese caso, volvé a `main` al cerrar la validación.

Archivos de referencia:

- [AGENTS.md](AGENTS.md): reglas para cualquier agente de IA que retome el proyecto.
- [docs/BITACORA.md](docs/BITACORA.md): estado, decisiones, verificaciones y pendientes por sesión.
- [docs/TAREA_CONTEXTO.md](docs/TAREA_CONTEXTO.md): consigna académica y fases.
- [docs/PROYECTO_CONTEXTO.md](docs/PROYECTO_CONTEXTO.md): producto, arquitectura y guion de demo.
- [docs/FASE_2_ENTREGA.md](docs/FASE_2_ENTREGA.md): alcance técnico de Fase 2.
- [docs/FASE_3_QA.md](docs/FASE_3_QA.md): casos reproducibles y formato de reporte de Fase 3.
- [docs/FASE_4_LANZAMIENTO.md](docs/FASE_4_LANZAMIENTO.md): landing, contacto, publicación y pendientes de video.
- [docs/FASE_5_PITCH.md](docs/FASE_5_PITCH.md): pitch y guion de demo en vivo.
- [docs/PRODUCCION.md](docs/PRODUCCION.md): despliegue gratuito y límites de proveedores.

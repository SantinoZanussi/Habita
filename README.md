# Habita

Habita centraliza la operación de edificios, consorcios, barrios y countries en un único producto: app móvil multirol, panel de administración, backend de negocio y Firebase en tiempo real.

La Fase 2 implementa todo el alcance P0 definido en `docs/PROYECTO_CONTEXTO.md` y suma una base funcional de amenities, notificaciones y obras.

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

Abrir `http://127.0.0.1:5000/panel`. El hosting del panel se inicia junto con los emuladores.

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

La guía completa de arquitectura, alcance, seguridad, proveedores externos y defensa está en [docs/FASE_2_ENTREGA.md](docs/FASE_2_ENTREGA.md).

## Continuidad entre computadoras y sesiones de IA

Antes de trabajar en otra PC, actualizá el repositorio y conservá los archivos de contexto. El agente debe leer primero [AGENTS.md](AGENTS.md) y después [docs/BITACORA.md](docs/BITACORA.md). La bitácora registra qué se verificó, qué quedó pendiente y cuál es el siguiente paso; no contiene secretos.

Al pedirle al agente que continúe, esas instrucciones le indican que debe leer ambos archivos, retomar el siguiente pendiente y actualizar la bitácora sin que tengas que recordárselo.

```powershell
git pull --rebase
git status --short --branch
Get-Content AGENTS.md
Get-Content docs/BITACORA.md
```

Al terminar una sesión, agregá una entrada a la bitácora, ejecutá las verificaciones que correspondan y hacé commit de la documentación y del código revisado. Subí esa rama a GitHub para que la próxima PC pueda continuar desde el mismo punto. No subas `.env`, claves de servicio, APKs con secretos ni credenciales de proveedores.

Archivos de referencia:

- [AGENTS.md](AGENTS.md): reglas para cualquier agente de IA que retome el proyecto.
- [docs/BITACORA.md](docs/BITACORA.md): estado, decisiones, verificaciones y pendientes por sesión.
- [docs/TAREA_CONTEXTO.md](docs/TAREA_CONTEXTO.md): consigna académica y fases.
- [docs/PROYECTO_CONTEXTO.md](docs/PROYECTO_CONTEXTO.md): producto, arquitectura y guion de demo.
- [docs/FASE_2_ENTREGA.md](docs/FASE_2_ENTREGA.md): alcance técnico de Fase 2.
- [docs/PRODUCCION.md](docs/PRODUCCION.md): despliegue gratuito y límites de proveedores.

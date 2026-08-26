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

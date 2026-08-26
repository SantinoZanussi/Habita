# Habita móvil

Aplicación Flutter multirol para residente, guardia y responsable de obra.

```powershell
flutter pub get
flutter run
```

Las cuentas demo y el arranque de Firebase/backend se documentan en `../README.md`. La URL de la API puede sobrescribirse con `--dart-define=API_BASE_URL=...`.

La selección de experiencia ocurre después del login usando las custom claims del token; un usuario no elige su propio rol desde la interfaz.

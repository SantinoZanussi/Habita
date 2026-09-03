# Habita — Entrega de Fase 2

## Resultado

La solución implementa el producto P0 completo: una app Flutter multirol, un panel web administrativo, un backend Node/Express y una única base Firebase compartida en tiempo real. La arquitectura evita duplicar reglas de negocio: Firestore entrega lecturas reactivas y el backend concentra las escrituras sensibles, las transacciones y los proveedores externos.

La identidad visual se construyó con los logos y fuentes entregados. El panel replica el lenguaje del mockup: navegación lateral azul profunda, superficies claras, tarjetas compactas, jerarquía tipográfica Sora/Archivo y colores de estado reservados para información accionable. La app mantiene el mismo sistema visual en formato móvil.

## Arquitectura

```text
App Flutter (residente / guardia / responsable de obra)
              │ lecturas en tiempo real
Panel web ────┼──────────────────────────► Firebase Auth + Firestore + FCM
              │                                   ▲
              │ comandos autenticados             │ Admin SDK / transacciones
              └──────────────────────────► Backend Node/Express en Render Free
                                             │
                                             ├─ Mercado Pago
                                             ├─ Gemini Free / fallback local
                                             ├─ FCM
                                             └─ BCRA / Google Maps
```

### Decisiones técnicas defendibles

- **Una fuente de verdad:** app y panel escuchan el mismo Firestore; no hay una base separada por interfaz.
- **Reglas de negocio en el servidor:** cerrar liquidaciones, consumir autorizaciones, imputar pagos, cambiar estados y registrar avances pasa por el backend.
- **Multi-tenant por ruta:** todos los datos operativos cuelgan de `complejos/{complejoId}` y las custom claims asignan rol, complejo, unidad u obras permitidas.
- **Dinero en centavos enteros:** el motor no usa flotantes para dinero. El reparto por mayor resto garantiza que la suma de 152 liquidaciones sea exactamente igual al gasto total.
- **Historial inmutable:** eventos de acceso y avances de obra son append-only; una corrección agrega un nuevo registro.
- **Fallos externos aislados:** Mercado Pago, IA, FCM y Maps tienen adaptadores propios. En local funcionan con simuladores deterministas sin exponer secretos al navegador o a Flutter.

## Alcance implementado

### P0 — producto obligatorio

| Capacidad | Implementación |
| --- | --- |
| Configuración y unidades | Configuración adaptable por complejo, ABM de unidades, validación de coeficientes y baja lógica. |
| Autenticación y roles | Firebase Auth, custom claims y cinco roles: superadmin, administrador, residente, guardia y responsable de obra. |
| Seguridad | Reglas Firestore cerradas por defecto, aislamiento por complejo/unidad y pruebas contra accesos horizontales. Storage se valida en emuladores y no se publica en Spark. |
| Accesos | QR dinámico firmado, QR de visita, patente, validación transaccional, límite de usos y registro append-only en vivo. |
| Visitas | Alta con vigencia, días, puntos habilitados y cantidad máxima de usos. |
| Reclamos | Alta, clasificación IA o fallback local, confianza, urgencia, corrección humana, estados e historial. La foto funciona en emuladores y queda desactivada en el build Spark. |
| Expensas | Gastos ordinarios/extraordinarios, fondo de reserva, prorrateo exacto, vista previa y cierre atómico irreversible. |
| Pagos | Preferencia Mercado Pago, webhook idempotente, imputación a saldo, pago manual y simulación local. |
| Gestión | Dashboard de recaudación/morosidad, gráficos, reclamos y accesos en tiempo real. |

### P1 y extensiones

- Amenities configurables y reservas con validación de cupo, horario y superposición.
- Avisos en tiempo real y FCM de extremo a extremo: cada instalación móvil solicita permiso, registra y renueva su token en el perfil, y el backend envía los avisos.
- Obras comunes/privadas, partidas, dependencias, camino crítico y avances idempotentes con foto.
- Responsable de obra restringido a los IDs incluidos en su custom claim.
- Evaluación de ingresantes disponible como servicio y API, sin una pantalla dedicada porque no forma parte del P0.

## Experiencias por rol

### Residente

- Inicio con próximo vencimiento, accesos rápidos y novedades.
- Estado de cuenta y pago.
- QR dinámico personal y autorización de visitas.
- Reserva de amenities.
- Reclamos con seguimiento; foto disponible en el entorno local con Storage Emulator.
- Consulta de obras y notificaciones.

### Guardia

- Escáner QR con cámara y alternativa por patente.
- Resultado explícito de autorización o rechazo.
- Historial reciente en tiempo real.
- El uso de una visita se consume en la misma transacción que registra el acceso.

### Responsable de obra

- Solo visualiza las obras asignadas en sus claims.
- Registra avances con `idempotencyKey`; repetir un envío no duplica el historial.

### Administración

- Dashboard financiero y operativo.
- ABM de unidades y configuración.
- Liquidación y cobranza.
- Accesos, reclamos, amenities, obras y avisos.

## Datos de demostración

`npm run seed` borra únicamente los emuladores locales y crea un escenario reproducible:

- Torre del Parque con 152 unidades.
- Coeficientes que suman `100,0000 %`.
- Liquidación Agosto 2026 por `$ 5.120.000,00`.
- 135 unidades pagadas, 17 pendientes y `$ 4.547.402,10` recaudados.
- Cuatro reclamos clasificados, cuatro movimientos de acceso, cuatro amenities y una obra activa.
- Una visita con QR `HBA-DEMO-VISITA-01` y dos usos disponibles.

Las cinco cuentas demo figuran en el README y usan exclusivamente Firebase Auth Emulator.

## Seguridad

Las pruebas automatizadas verifican los casos de defensa principales:

1. Un residente puede leer su unidad, pero no la de un vecino ni listar el complejo.
2. Un guardia no puede leer ni escribir períodos de expensas.
3. Ningún cliente, incluido el administrador, puede modificar o borrar eventos de acceso.
4. Un responsable de obra solo ve las obras indicadas en `obraIds`.
5. En el entorno local, Storage aísla complejos y rechaza contenido que no sea una imagen permitida.

Además:

- los tokens se verifican en cada request del backend;
- se controla el complejo solicitado contra las claims;
- las rutas públicas tienen limitación de frecuencia;
- producción no inicia con el secreto QR de desarrollo ni con emuladores activos;
- las claves externas solo se leen desde variables de entorno;
- los webhooks y avances son idempotentes.

## Puesta en marcha local

### 1. Dependencias

```powershell
npm install
cd mobile
flutter pub get
cd ..
```

### 2. Firebase local

```powershell
npm run emu
```

Esto inicia Auth `9099`, Firestore `8080`, Storage `9199`, Hosting `5000` y Emulator UI `4000`. El proceso importa `emulador-datos/` si existe y lo exporta al salir.

### 3. Escenario demo y API

En terminales separadas:

```powershell
npm run seed
npm run backend
```

Panel: `http://127.0.0.1:5000/panel`

### 4. Flutter

```powershell
cd mobile
flutter run
```

El Android Emulator ya queda apuntado a `10.0.2.2`. Para un teléfono físico debe pasarse `API_BASE_URL` con la IP local y reemplazarse el host de emuladores en `mobile/lib/main.dart` durante la prueba en red.

## Configuración para producción

El proyecto Spark propio, las apps Firebase, Firestore regional, Authentication, FCM y los comandos de despliegue ya están preparados. Para evitar Blaze, Hosting se publica en Firebase y la API Express en Render Free; Gemini usa su nivel gratuito y Mercado Pago usa credenciales de prueba. La configuración operativa, los secretos y los controles posteriores se documentan en `docs/PRODUCCION.md`.

El modo local simulado es intencional: permite defender todo el flujo sin usar dinero real ni depender de una API paga, pero no se presenta como una transacción comercial real.

## Comandos de calidad

```powershell
npm run test          # dominio y servicios del backend
npm run test:reglas   # Firestore y Storage en emuladores oficiales
npm run verificar     # tokens, marca, panel y las dos suites anteriores

cd mobile
flutter analyze
flutter test
flutter build web --release
```

## Estructura

```text
backend/   API, dominio, servicios, integraciones y pruebas
firebase/  reglas, índices, configuración y pruebas de seguridad
mobile/    aplicación Flutter multirol
web/       panel administrativo responsive
brand/     identidad y fuentes fuente del proyecto
tools/     build, emuladores, seed y generación de assets
docs/      contexto, decisiones y esta entrega
```

## Límite de esta fase

Fase 2 entrega el sistema funcional y preparado para la demo. La Fase 3 de la consigna sigue siendo el QA cruzado con otro equipo; sus hallazgos deberían registrarse como bugs reproducibles y corregirse en Fase 4, sin alterar los invariantes de seguridad, tiempo real y cierre exacto.

# Activación de producción

Habita ya separa el modo demo del modo real. Este procedimiento publica el panel, la API, las reglas y habilita FCM, Mercado Pago y Anthropic sin guardar secretos en Git.

## Estado actual — 1 de septiembre de 2026

- Proyecto Firebase: `habita-complejos-ar`.
- Apps registradas: `Habita Panel` y `Habita Android` (`ar.com.habita.habita`).
- Firestore Standard creado en `southamerica-east1`, con protección contra borrado, reglas e índices publicados.
- Authentication por correo/contraseña habilitado y versionado en `firebase/firebase.json`.
- APK release productivo generado en `mobile/build/app/outputs/flutter-apk/app-release.apk`.
- Configuración pública real guardada sólo en `mobile/firebase.production.json`, excluida de Git.

Para completar la activación externa faltan el plan Blaze, el bucket de Storage, los tres secretos de Mercado Pago/Anthropic y el despliegue final de Functions + Hosting. Ninguno de esos secretos debe copiarse al repositorio.

## Requisitos externos

1. Proyecto Firebase con plan Blaze, Firestore, Storage, Hosting y Authentication por correo/contraseña.
2. Aplicación Web y aplicación Android registradas. El package Android es `ar.com.habita.habita`.
3. Aplicación de Mercado Pago Checkout Pro con credenciales productivas.
4. Clave de API de Anthropic con crédito disponible.

## 1. Autenticar y elegir Firebase

```powershell
node node_modules/firebase-tools/lib/bin/firebase.js login --reauth
node node_modules/firebase-tools/lib/bin/firebase.js projects:list
```

No se usa un alias silencioso: todos los comandos de despliegue exigen `--project=PROJECT_ID` para evitar publicar por error en otro proyecto.

## 2. Cargar secretos

Los comandos solicitan el valor de forma interactiva y lo guardan en Google Secret Manager, no en archivos del repositorio.

```powershell
node node_modules/firebase-tools/lib/bin/firebase.js functions:secrets:set MP_ACCESS_TOKEN --project habita-complejos-ar
node node_modules/firebase-tools/lib/bin/firebase.js functions:secrets:set MP_SECRETO_WEBHOOK --project habita-complejos-ar
node node_modules/firebase-tools/lib/bin/firebase.js functions:secrets:set ANTHROPIC_API_KEY --project habita-complejos-ar
node node_modules/firebase-tools/lib/bin/firebase.js functions:secrets:set SECRETO_QR --project habita-complejos-ar
```

`SECRETO_QR` debe ser aleatorio y largo. Los otros tres valores provienen de los paneles de Mercado Pago y Anthropic.

## 3. Configurar Mercado Pago

En Mercado Pago Developers, configurar Checkout Pro y el evento **Pagos** con:

```text
https://habita-complejos-ar.web.app/api/webhooks/mercadopago
```

El secreto generado en Webhooks es el valor de `MP_SECRETO_WEBHOOK`. El backend verifica HMAC, normaliza `data.id`, tolera timestamps en segundos o milisegundos y después consulta el pago directamente a Mercado Pago antes de imputarlo.

## 4. Construir Android productivo

Copiar `mobile/firebase.production.example.json` como `mobile/firebase.production.json` y completar los identificadores públicos que muestra Firebase en la configuración de las apps.

```powershell
npm run build:mobile:prod
```

El APK queda en `mobile/build/app/outputs/flutter-apk/app-release.apk`. En release los emuladores quedan desactivados. FCM solicita permiso, guarda el token en el perfil, escucha sus renovaciones y muestra los mensajes recibidos en primer plano.

## 5. Desplegar

```powershell
npm run deploy:prod -- --project=habita-complejos-ar
```

El comando ejecuta todas las pruebas antes de publicar y despliega:

- Cloud Functions v2 `api` en `southamerica-east1`;
- Firebase Hosting;
- proveedor de Authentication por correo y contraseña;
- reglas e índices de Firestore;
- reglas de Storage.

Hosting obtiene su configuración mediante `/__/firebase/init.json`, por lo que el panel usa automáticamente el proyecto correcto. `/api/**` se reescribe a la Function HTTPS del backend.

## 6. Controles posteriores

1. Abrir `https://habita-complejos-ar.web.app/panel/`.
2. Consultar `https://habita-complejos-ar.web.app/api/salud` para comprobar la API y `/api/estado` para confirmar `mercadoPago: activo`, `ia: activo` y `fcm: activo`.
3. Crear usuarios mediante el flujo administrativo para que reciban custom claims.
4. Instalar el APK en un Android real, aceptar notificaciones y comprobar que `usuarios/{uid}.tokenFcm` se complete.
5. Realizar primero un pago de importe pequeño y verificar el webhook en Mercado Pago Developers.
6. Configurar alertas de presupuesto en Google Cloud antes de abrir la prueba a terceros.

# Publicación gratuita del TP

Habita está preparado para funcionar sin plan Blaze, sin tarjeta y sin pagos reales. Los secretos permanecen fuera de Git.

## Estado actual — 3 de septiembre de 2026

- Cuenta Firebase propietaria: `goiburujuanmanuel@gmail.com`.
- Proyecto Firebase Spark: `habita-complejos-goiburu`.
- Apps registradas: `Habita Panel` y `Habita Android` (`ar.com.habita.habita`).
- Firestore Standard creado en `southamerica-east1`, con protección contra borrado, reglas e índices publicados.
- Authentication por correo/contraseña habilitado.
- FCM configurado en la app móvil y disponible sin cargo.
- Backend publicado como Web Service gratuito de Render: `habita-api-goiburu`; salud y conexión con Firestore verificadas.
- Gemini Free (`gemini-3.5-flash-lite`) y FCM configurados. El estado `activo` confirma configuración, no una clasificación o entrega push de extremo a extremo.
- Mercado Pago pendiente: se creó `Habita TP`, pero la activación de credenciales de prueba muestra un error en el portal del proveedor. Por decisión del usuario, se continúa sin esa integración externa; no se habilita producción ni facturación como alternativa.
- Las fotos quedan desactivadas en el APK gratuito porque los buckets nuevos de Firebase Storage exigen Blaze. Siguen disponibles con el emulador local.

## Arquitectura gratuita

```text
Panel web (Firebase Hosting Spark) ─┐
App Flutter ────────────────────────┼── Firebase Auth + Firestore + FCM
                                    │
                                    └── API Express (Render Free)
                                             ├── Mercado Pago Test
                                             └── Gemini Free
```

Firebase Spark no permite desplegar el runtime moderno de Cloud Functions y, desde febrero de 2026, tampoco crear o utilizar un bucket nuevo de Cloud Storage. Por eso la API se ejecuta en Render y el build productivo no ofrece adjuntar fotos. No se debe habilitar Blaze para este TP.

Render Free apaga el servidor después de 15 minutos sin tráfico. La primera petición posterior puede tardar cerca de un minuto; no es un error de Habita. El plan gratuito es apropiado para una demostración, no para una aplicación comercial.

## 1. Publicar Firebase Spark

```powershell
npm run deploy:prod -- --project=habita-complejos-goiburu
```

El comando ejecuta las pruebas y publica únicamente:

- Firebase Hosting;
- Authentication por correo/contraseña;
- reglas e índices de Firestore.

No despliega Functions ni Storage y no solicita facturación.

Panel: `https://habita-complejos-goiburu.web.app/panel/`

## 2. Credencial Firebase para Render

El backend necesita una cuenta de servicio porque realiza transacciones, asigna custom claims y envía FCM.

1. Abrir Firebase Console > Configuración del proyecto > Cuentas de servicio.
2. Elegir **Generar nueva clave privada**.
3. Guardar el JSON fuera del repositorio.
4. En Render, pegar el contenido completo como valor secreto de `FIREBASE_SERVICE_ACCOUNT_JSON`.

No subir ese JSON a Git, no copiarlo en la app móvil y no enviarlo por chat. Si se filtra, revocar la clave inmediatamente.

## 3. IA gratuita

1. Entrar a `https://aistudio.google.com/app/apikey` con la cuenta propia.
2. Crear una API key gratuita de Gemini.
3. Guardarla en Render como `GEMINI_API_KEY`.

La clave sólo vive en Render. Si falta o Gemini alcanza su cuota, Habita conserva el reclamo y usa automáticamente el clasificador local por palabras clave.

## 4. Crear el servicio gratuito de Render

El archivo `render.yaml` describe el servicio y obliga a utilizar `plan: free`.

1. Subir los cambios a GitHub.
2. Abrir `https://dashboard.render.com/blueprints`.
3. Crear un Blueprint desde `SantinoZanussi/Habita`.
4. Completar los dos valores secretos solicitados:
   - `FIREBASE_SERVICE_ACCOUNT_JSON`;
   - `GEMINI_API_KEY`.
5. Confirmar que el servicio seleccionado diga **Free** antes de crearlo.

Render genera `SECRETO_QR` automáticamente. No se debe escribir ni guardar manualmente.

## 5. Mercado Pago sin dinero real

### Estado de trabajo: continuar sin Mercado Pago

Dejar `MP_ACCESS_TOKEN` y `MP_SECRETO_WEBHOOK` sin configurar. No generar valores aleatorios para reemplazar estas claves. El borrador de Render con ambos campos vacíos se descartó sin desplegarlo.

La app detecta el modo simulado y pide confirmación antes de registrar el pago. No abre Mercado Pago ni mueve dinero; **sí actualiza el saldo guardado en Firestore** y deja `simulado: true` en el registro. Usarlo solo con datos de demostración. Cancelar o cerrar el diálogo no acredita nada.

El backend conserva autenticación, rol residente y unidad propia. Cuando se configura un Access Token, la ruta `/pagos/simular` devuelve 403, incluso si se la invoca fuera de la app. Sin Access Token, el webhook externo devuelve 503 y no procesa datos; la demo usa la ruta autenticada, no notificaciones falsas públicas.

Este modo permite continuar el desarrollo y las pruebas de expensas. **No equivale a tener Mercado Pago integrado y verificado** ni sustituye por sí solo el requisito de APIs comerciales de la consigna.

### Retomar la integración cuando el proveedor permita activar las claves

Con Render publicado y sin crear otra aplicación duplicada:

1. Abrir la aplicación existente `Habita TP` en Mercado Pago Developers (ID `38832665522878`).
2. Abrir Pruebas > Credenciales de prueba y copiar el Access Token.
3. Configurar, en **Modo de prueba**, el evento **Pagos (legacy)** utilizado por esta integración de Checkout Pro con esta URL:

```text
https://habita-api-goiburu.onrender.com/api/webhooks/mercadopago
```

4. Copiar la firma secreta generada para el webhook.
5. En Render > `habita-api-goiburu` > Environment, agregar:
   - `MP_ACCESS_TOKEN`: Access Token de prueba;
   - `MP_SECRETO_WEBHOOK`: firma secreta del webhook.
6. Elegir **Save, rebuild, and deploy**.

Las credenciales de prueba llaman a la integración real de Mercado Pago, pero no permiten transacciones reales. No usar credenciales productivas para la entrega académica.

## 6. Construir Android

La configuración pública correcta está en `mobile/firebase.production.json`, excluida de Git.

```powershell
npm run build:mobile:prod
```

El APK queda en `mobile/build/app/outputs/flutter-apk/app-release.apk`. Usa Firebase real, la API gratuita de Render y FCM; no intenta usar Storage.

## 7. Controles finales

1. Abrir el panel de Firebase Hosting.
2. Consultar `https://habita-api-goiburu.onrender.com/api/salud`.
3. Ejecutar `npm run verificar:servicios`: comprueba salud, Firestore real, panel, CORS y rechazo de consultas sin sesión. Mientras Mercado Pago esté pendiente, `mercadoPago: simulado` es esperado; no se marca como integración terminada.
4. Crear usuarios mediante el flujo administrativo para recibir custom claims.
5. Instalar el APK en Android, aceptar notificaciones y comprobar `usuarios/{uid}.tokenFcm`.
6. Ensayar el pago simulado con datos demo y comprobar el saldo en ambas vistas. Cuando Mercado Pago esté habilitado, hacer una compra exclusivamente con usuarios y tarjetas de prueba.

La comprobación de solo lectura del 3 de septiembre encontró **cero usuarios de Auth y cero complejos** en `habita-complejos-goiburu`. El hosting publicado todavía no equivale a una demo utilizable con sesión: hace falta crear el primer administrador y un escenario de prueba en ese proyecto.

Pendientes para cerrar la validación de fase 2: usuarios con roles y datos de demostración en el proyecto publicado; prueba app/panel con esos usuarios; clasificación real por Gemini; permiso, registro de token y recepción de FCM en un dispositivo Android. No reutilizar `npm run seed` para poblar Firebase real: ese comando está diseñado para borrar y recrear únicamente los emuladores.

## Costos

- Firebase: Spark, sin método de pago.
- Render: Web Service Free; si se agota la cuota sin tarjeta, el servicio se suspende en lugar de cobrar.
- Gemini: Free Tier; sujeto a su cuota gratuita.
- Mercado Pago: entorno de pruebas, sin pagos reales.

No hay ningún paso de esta guía que requiera contratar Blaze.

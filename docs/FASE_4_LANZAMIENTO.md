# Fase 4 — Corrección y lanzamiento

## Estado

La landing pública está implementada en `web/index.html`, con estilos en `web/landing.css` y comportamiento del formulario en `web/landing.js`. El panel continúa en `/panel` y la portada ahora ocupa `/`.

El formulario de contacto usa `POST /api/contacto`, valida nombre, correo, tipo de complejo y mensaje, y guarda el contacto como `nuevo` en Firestore. El backend tiene límites de tamaño y una prueba automatizada para este contrato.

Mercado Pago sigue fuera del lanzamiento porque el portal no permite activar las credenciales de prueba. La landing habla de pagos demo cuando corresponde y no presenta la integración externa como terminada.

## Qué contiene la landing

- Propuesta de valor y problema que resuelve Habita.
- Captura real de la app y el panel en `web/assets/brand/diseno-app.png`.
- Módulos de accesos, expensas, reclamos y obras.
- Planes Base, Barrio y Cartera, con precio a medida por unidad/mes.
- CTA al panel de demo y formulario público de contacto.
- Diseño responsive, navegación móvil y estados de error/éxito del formulario.

## Validación local

```powershell
$env:PUERTO_WEB = '5050'
node tools/servidor-web.mjs
```

Abrir `http://127.0.0.1:5050/` y revisar escritorio y celular. Para probar el envío real del formulario, levantar también el backend en `8787`; la ruta responde `201` y crea el contacto en el emulador.

## Publicación

Antes de desplegar, ejecutar:

```powershell
npm run build:web
npm test
npm run test:reglas
npm run deploy:prod -- --project=habita-complejos-goiburu
```

El deploy publica la portada y el panel en Firebase Hosting. La API de contacto debe estar disponible en la URL configurada en `web/config.js` y aceptar el origen del hosting mediante `ORIGENES_PERMITIDOS`.

## Video demo pendiente

La landing deja lista la sección de demo y el acceso al panel, pero no se inventa una URL de video. Para cerrar este punto, grabar una toma de 2:30 a 3:00 minutos siguiendo el guion de `docs/FASE_5_PITCH.md` y agregar el `iframe` o `<video>` real en la sección `#demo`. Verificar que no aparezcan contraseñas, tokens ni datos reales.

## Criterio de cierre

Fase 4 queda lista cuando el QA cruzado de `docs/FASE_3_QA.md` tenga sus bugs corregidos, la landing esté publicada, el formulario haya sido probado en el entorno elegido y el video demo esté insertado con una fuente reproducible.

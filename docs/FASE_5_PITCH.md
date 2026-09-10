# Fase 5 — Pitch y demo en vivo

## Idea central

Habita convierte la operación dispersa de un complejo residencial en un sistema visible, seguro y adaptable. La app simplifica el día a día; el panel transforma los datos en decisiones.

## Pitch de 90 segundos

> Administrar un edificio o un barrio cerrado todavía significa saltar entre WhatsApp, planillas y el cuaderno de la garita. Cuando un reclamo se pierde, una expensa no cierra o nadie puede explicar quién ingresó, el costo lo paga toda la comunidad.
>
> Habita reúne accesos, expensas, reclamos y obras en un solo sistema. Cada persona tiene la vista que necesita: el residente resuelve desde el celular y la administración controla desde el panel. Los datos se sincronizan en tiempo real y las reglas separan cada complejo y cada rol.
>
> Hay tres decisiones técnicas que hacen confiable al producto. Las expensas cierran al centavo. Los accesos se validan con transacciones y dejan un historial que no se puede editar. Las obras calculan el camino crítico para mostrar qué atraso realmente cambia la fecha final.
>
> Habita no obliga a que todos los complejos funcionen igual: el mismo motor se configura para edificios, consorcios, barrios y countries. Empezamos por ordenar la operación y terminamos devolviendo tiempo y confianza a quienes administran y viven en el complejo.

## Demo en vivo — 3 minutos

1. **Acceso (60 s).** En la app del residente abrir una visita y mostrar el QR. En el dispositivo del guardia validar el ingreso dos veces; mostrar el evento nuevo en el panel y repetirlo una tercera vez para enseñar el rechazo por usos agotados.
2. **Expensa (45 s).** En el panel abrir un período de ejemplo, mostrar la previsualización y señalar la verificación de cierre exacto. En la app del residente abrir el detalle publicado.
3. **Obra (45 s).** Entrar como responsable de obra, registrar un atraso en una partida crítica y mostrar cómo cambia la fecha estimada en el panel y en la app.
4. **Cierre (30 s).** Volver a la configuración del panel, mostrar que el tipo de complejo y la nomenclatura son configurables y terminar con la landing y el CTA de demo.

## Reparto y preparación

- Una persona narra y controla el panel proyectado.
- Una persona usa la app como residente.
- Una persona usa la app como guardia o responsable de obra.
- Preparar los emuladores y ejecutar `npm run seed` antes de la presentación.
- Ensayar con la misma red y tener una copia de la landing abierta si Render demora en despertar.
- No mostrar credenciales, tokens, correos personales ni datos de producción.

## Materiales

- Landing: `/`.
- Panel: `/panel`.
- Checklist de QA: `docs/FASE_3_QA.md`.
- Alcance técnico y límites de proveedores: `docs/FASE_2_ENTREGA.md` y `docs/PRODUCCION.md`.
- Captura compuesta de app y panel: `web/assets/brand/diseno-app.png`.

Mercado Pago se presenta como integración pendiente con flujo demo explícitamente simulado mientras el portal del proveedor no habilite las credenciales de prueba.

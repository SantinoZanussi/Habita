# Habita

---

## 1. El concepto

**Un mismo motor administra cualquier complejo residencial.** Un edificio de 20 departamentos, un consorcio, un barrio cerrado o un country de 500 lotes. Lo que cambia entre uno y otro es la **configuración inicial**, no el sistema:

- el tipo de unidad (departamento, casa o lote),
- qué amenities tiene el complejo,
- qué métodos de acceso usa (QR, NFC, patente),
- cómo se llama el aporte mensual (expensa, cuota o aporte).

Esa es la apuesta de arquitectura del producto: donde la competencia tiene un software para consorcios y otro distinto para barrios privados, nosotros tenemos un modelo de datos único y una pantalla de configuración.

### El problema

La administración de un complejo residencial se maneja hoy con grupos de WhatsApp, planillas y un cuaderno en la garita. El residente no sabe si su expensa está paga, la administración no sabe quién entró anoche, los reclamos se pierden entre mensajes y las obras del complejo son una caja negra hasta la asamblea. No hay un lugar donde el complejo exista como sistema.

### El cliente

Administradoras de consorcios y barrios privados, y consorcios grandes que se autoadministran. En segunda instancia, desarrolladoras que entregan un complejo y quedan como administradoras.

### Escalabilidad

El producto se cobra **por unidad por mes**, así que el ingreso escala solo con el tamaño del complejo sin que aumente el costo de servirlo. Una administradora que suma un barrio de 300 lotes no requiere desarrollo nuevo: requiere una configuración nueva. Y el modelo es multi-tenant desde el arranque, así que una misma cuenta administra toda su cartera.

---

## 2. Sistema base

Esto es el producto. Todo lo de la sección 3 es opcional y se activa por complejo.

### App móvil — residente

- **Accesos.** Abre puerta de edificio, molinete peatonal o barrera vehicular con QR dinámico o NFC, según lo que tenga configurado el complejo.
- **Amenities.** Reserva SUM, parrilla, pileta, cancha, gimnasio o quincho. La lista es configurable por la administración, con capacidad, horarios y anticipación máxima por amenity.
- **Pagos.** Paga su expensa, cuota o aporte, ve el detalle de la liquidación del período y su saldo de cuenta corriente.
- **Visitas y proveedores.** Autoriza el ingreso de una persona con horario límite, y recibe aviso cuando efectivamente entró.
- **Reclamos.** Reporta una incidencia con foto: caño roto, luz quemada, ruidos molestos.
- **Notificaciones.** Recibe avisos de la administración: corte de agua, convocatoria a asamblea, alerta de seguridad.

### Panel web — administración

- **Unidades.** Alta, baja y modificación de departamentos, casas o lotes, con titular, inquilino, coeficiente y estado. El mismo modelo de datos sirve para los tres tipos.
- **Accesos.** Historial completo de entradas y salidas, patentes autorizadas, autorizaciones vigentes y tablero en tiempo real de quién está adentro.
- **Reclamos.** Bandeja con estados (pendiente, en progreso, resuelto), asignación a proveedores y trazabilidad de cada cambio de estado.
- **Cobranza.** Estado de pagos, morosidad por unidad y dashboard con gráficos de recaudación por período.
- **Consumos.** Carga y seguimiento de agua, luz y gas cuando el complejo mide de forma centralizada.
- **Configuración.** Tipo de complejo, amenities, métodos de acceso, nomenclatura del aporte, coeficientes y política de redondeo.

### App móvil — guardia

Un tercer perfil sobre la misma app. Escanea QR o consulta patente, valida contra las autorizaciones vigentes y registra el evento. No ve expensas, ni morosidad, ni datos de contacto de los residentes.

---

## 3. Los tres núcleos técnicos del sistema base

Un ABM lo escribe cualquiera. Estos tres son los que hacen que el proyecto sea difícil y los que hay que poder explicar en la defensa.

### Núcleo 1 — Liquidación de expensas

Es la parte del rubro que nadie resuelve bien y la que más dolor genera. El motor tiene que:

- prorratear los gastos por coeficiente de cada unidad;
- separar gastos **ordinarios** de **extraordinarios**, que se dividen con criterios distintos y a veces los paga el propietario y no el inquilino;
- aportar al fondo de reserva;
- calcular intereses por mora sobre saldos vencidos;
- imputar los pagos parciales en orden legal: primero intereses, después capital, y recién ahí saldo a favor.

La restricción dura, y el punto que hay que mostrar en la demo: **la suma de las liquidaciones individuales tiene que dar exactamente el gasto total del período.** Los centavos que sobran del redondeo se reparten según una política explícita y configurable, no se pierden.

### Núcleo 2 — Control de acceso concurrente

Dos puestos de guardia escaneando al mismo tiempo no pueden validar la misma autorización de visita. Una autorización tiene vigencia horaria y cantidad de usos permitidos, y consumir un uso es una operación que tiene que ser atómica.
Se resuelve con transacciones de Firestore sobre el documento de autorización, más un log de eventos **append-only**: los eventos de acceso no se pueden editar ni borrar por regla de seguridad, para nadie. Un sistema que registra quién entró a un barrio no puede permitir que alguien reescriba la historia.

### Núcleo 3 — Clasificación de reclamos por IA

El residente escribe en lenguaje natural y saca una foto. El sistema clasifica **área responsable** (plomería, electricidad, seguridad, limpieza, estructura) y **urgencia**, y sugiere proveedor. La administración recibe la bandeja ya priorizada en vez de leer cuarenta mensajes.
Detalle que conviene defender: el sistema muestra el nivel de confianza de la clasificación y permite corregirla, y las correcciones quedan registradas. Es honesto y demuestra criterio sobre los límites del modelo.

---

## 4. Módulos adicionales

Se activan por complejo desde la configuración. Un consorcio chico usa solo el sistema base; un country con obras en curso activa el módulo de obras.

### Módulo Obras del complejo

Dentro de un complejo siempre hay obras, y son de dos tipos.
**Obras privadas.** Un propietario construye su casa en su lote, o refacciona su departamento. Interesa a la administración porque genera flujo de obreros y proveedores, tiene horarios permitidos (no se puede trabajar domingo, ni después de las 18) y tiene un plazo comprometido. Interesa al propietario porque quiere ver cómo va sin tener que ir hasta ahí.
**Obras comunes.** Cambio de ascensor, refacción de la pileta, repavimentación de calles internas. Se financian con expensa extraordinaria y son el conflicto número uno de la vida en consorcio: durante seis meses todos los propietarios se preguntan lo mismo, *en qué va y en qué se gastó mi plata*.
**Cómo funciona.** El capataz o el responsable de obra carga avance por partida desde el celular, con foto y geolocalización, y **sin señal** (en una obra rara vez hay wifi). Al recuperar conexión, la app sincroniza.
En cada carga el sistema recalcula:

- avance real contra avance planificado,
- el camino crítico de la obra,
- la nueva fecha estimada de finalización,
- qué partidas quedaron sin holgura.

**Por qué es nativo al producto y no un anexo.** Se engancha en dos puntos del sistema base:

1. **Con la liquidación.** La obra común está financiada por una expensa extraordinaria que ya vive en el motor de liquidación. El residente ve, en la misma pantalla, el avance físico contra el avance del gasto sobre el presupuesto aprobado. Si la obra va por el 40% y ya se gastó el 75% del presupuesto, eso se ve solo.
2. **Con los accesos.** Una obra genera permisos de ingreso para obreros y proveedores, con vigencia y horario permitido. El guardia los valida con el mismo flujo que valida una visita. Si un obrero se presenta un domingo, el sistema lo rechaza indicando el motivo.

**El momento de la demo:** se carga un atraso menor en una partida cualquiera y el panel muestra que la obra entera se corre tres semanas, porque esa partida no tenía holgura. Y en la app del residente, la fecha prometida cambia sola.

### Módulo Evaluación de ingresantes

Cuando una unidad cambia de manos —entra un inquilino nuevo, se vende un lote— la administración necesita saber algo puntual: **si esa persona va a poder sostener la expensa.** Un moroso no es un problema entre él y la administración, es un problema de todos los vecinos, porque el gasto se reparte igual.
El módulo construye un score con la relación entre ingreso declarado y expensa, el tipo de garantía, la composición del grupo conviviente y los antecedentes de pago dentro del sistema si la persona ya fue residente en otro complejo de la cartera.
Y proyecta: la expensa no es fija, sube con la inflación y con las paritarias del personal. El sistema toma el índice real de la API del BCRA y muestra la **curva de esfuerzo** —qué porcentaje del ingreso se va a llevar la expensa en el mes 6, 12 y 18— indicando en qué mes el candidato entra en zona roja.
**El momento de la demo:** dos candidatos con ingresos casi iguales; el panel superpone las curvas y muestra que uno aguanta el año entero y el otro cruza el umbral en el mes 11.

---

## 5. Requisitos técnicos de la materia

| **Requisito**                | **Cómo se cumple**                                                                                                                                                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vista 1 — App móvil          | Flutter. Tres perfiles sobre la misma app: **residente**, **guardia** y **responsable de obra**. La app muestra un módulo u otro según el rol autenticado.                                                                   |
| Vista 2 — Panel web          | HTML, CSS y JavaScript, servido en el mismo sitio que la landing y protegido por login de administrador. Dashboard de cobranza, tablero de accesos en vivo, bandeja de reclamos priorizada, ABM de unidades y configuración. |
| Backend                      | Node.js con Express. Concentra toda la lógica de negocio y las credenciales de las APIs externas.                                                                                                                            |
| Tiempo real sobre Firestore  | La app escucha con `snapshots()` y el panel web con `onSnapshot()` del SDK de JavaScript. Ambas vistas sobre la misma base. Los momentos de la demo dependen de esto.                                                        |
| Reglas de seguridad cerradas | Sección 7. Nada de `allow read, write: if true`.                                                                                                                                                                             |
| Mínimo dos roles             | Cinco roles con reglas propias.                                                                                                                                                                                              |
| Mínimo dos APIs externas     | Cinco integraciones. Sección 8.                                                                                                                                                                                              |
| Resiliencia                  | El módulo de obras es offline-first por necesidad del caso de uso. Todo formulario con validación y `try/catch`, estados de error explícitos en la UI y reintento con backoff en llamadas a API.                             |

---

## 5 bis. Arquitectura técnica

  ┌─────────────────────┐        ┌──────────────────────────┐
   │   App móvil         │        │   Sitio web              │
   │   Flutter           │        │   HTML + CSS + JS        │
   │   residente /       │        │   landing pública +      │
   │   guardia / obra    │        │   panel tras login       │
   └──────────┬──────────┘        └────────────┬─────────────┘
              │                                │
              │   lectura y tiempo real        │
              │   (SDK de Firestore)           │
              ▼                                ▼
        ┌───────────────────────────────────────────┐
        │        Firebase: Firestore + Auth         │
        └───────────────────────────────────────────┘
                            ▲
                            │  Admin SDK
              ┌─────────────┴──────────────┐
              │      Backend Node.js       │
              │         (Express)          │
              │  · motor de liquidación    │
              │  · camino crítico          │
              │  · scoring y proyección    │
              │  · webhook de Mercado Pago │
              │  · clasificación por IA    │
              │  · asignación de claims    │
              └─────────────┬──────────────┘
                            │  HTTPS
        Mercado Pago · IA · BCRA · Maps · FCM

**Las cuatro reglas que evitan que esto se desordene:**

1. **Las lecturas van directo a Firestore.** Tanto la app como el panel se suscriben a la base con el SDK correspondiente. Es lo que da el tiempo real y lo que satisface el requisito de la materia. No hay que pasarlas por el backend ni hacer polling.


2. **Las escrituras con lógica de negocio pasan por Node.** El cliente nunca calcula una liquidación, ni un camino crítico, ni un score. Manda los datos crudos al backend, el backend calcula y escribe. Si la lógica viviera en el cliente, cualquiera podría alterar su propia expensa.


3. **La lógica de negocio se escribe una sola vez.** Como ahora hay dos clientes en lenguajes distintos (Dart y JavaScript), la tentación de duplicar un cálculo en los dos es real y es el camino más rápido a que la app y el panel muestren números diferentes. Node es la única fuente de verdad.


4. **Los secretos viven solo en el backend.** El access token de Mercado Pago y la API key del modelo de IA nunca se compilan dentro de la app ni se sirven al navegador.



**Consecuencias prácticas a tener en cuenta:**

- El webhook de Mercado Pago necesita una URL pública, así que el backend tiene que estar desplegado (Railway, Render o Cloud Run sirven y tienen capa gratuita). No alcanza con correrlo en `localhost` el día de la demo.
- La landing y el panel son el mismo sitio estático: la landing pública en la raíz, el panel detrás de `/panel` con verificación de sesión de Firebase Auth y del claim de rol. Si un usuario sin rol de administración entra a esa ruta, se lo redirige.
- La verificación en el frontend es solo comodidad visual. **La seguridad real está en las reglas de Firestore**, que es donde el jurado va a mirar.

---

## 6. Modelo de datos (Firestore)

Multi-tenant: todo cuelga del complejo.
usuarios/{uid}
  rol, complejoId, unidadId, nombre, telefono, activo

complejos/{complejoId}
  nombre
  tipo: "edificio" | "consorcio" | "barrio" | "country"
  tipoUnidad: "departamento" | "casa" | "lote"
  nomenclaturaAporte: "expensa" | "cuota" | "aporte"
  metodosAcceso: ["qr", "nfc", "patente"]
  modulosActivos: { obras: bool, evaluacion: bool, consumos: bool }
  politicaRedondeo, indiceIndexacion

  unidades/{unidadId}
    identificador ("3B", "Lote 42"), coeficiente, superficie
    estado: "ocupada" | "vacante" | "en\_obra"
    titularUid, inquilinoUid, patentesAutorizadas: [ ]

  amenities/{amenityId}
    nombre, capacidad, horarios, anticipacionMaxima, requiereAprobacion

  reservas/{reservaId}
    amenityId, unidadId, desde, hasta, estado

  autorizaciones/{autorizacionId}
    tipo: "visita" | "proveedor" | "obra"
    nombre, documento, patente, autorizadoPorUid
    vigenciaDesde, vigenciaHasta, diasPermitidos, franjaHoraria
    usosPermitidos, usosConsumidos, codigoQr

  eventosAcceso/{eventoId}          ← append-only
    autorizacionId | unidadId, punto, sentido, metodo
    timestamp, guardiaUid, resultado, motivoRechazo, fotoUrl

  reclamos/{reclamoId}
    descripcion, fotoUrl, unidadId, autorUid
    clasificacionIA: { area, urgencia, confianza }
    clasificacionFinal, estado, proveedorAsignadoId, historialEstados

  periodos/{periodoId}              ← "2026-08"
    gastosOrdinarios: [ ], gastosExtraordinarios: [ ]
    fondoReserva, totalLiquidado, estado: "borrador" | "cerrado"

    detalle/{unidadId}
      montoOrdinario, montoExtraordinario, ajusteRedondeo
      saldoAnterior, interesesMora, totalAPagar

  pagos/{pagoId}
    unidadId, periodoId, monto, medio, idPagoMercadoPago
    imputacion: { aIntereses, aCapital, aSaldoFuturo }

  consumos/{consumoId}
    unidadId, servicio, periodo, lectura, consumo

  notificaciones/{notificacionId}
    titulo, cuerpo, destinatarios, tipo, enviadaEn

  — módulo Obras —
  obras/{obraId}
    nombre, tipo: "privada" | "comun"
    unidadId (si es privada), presupuestoAprobado, gastoEjecutado
    periodoExtraordinarioId (si es común), estado
    fechaInicio, fechaFinPlanificada, fechaFinEstimada

    partidas/{partidaId}
      nombre, duracionEstimada, predecesoras: [ids]
      avancePorcentaje, esCritica, holgura
      fechaInicioTemprano, fechaFinTardio

    avances/{avanceId}              ← append-only
      partidaId, porcentaje, fotoUrl, autorUid
      timestampCliente, timestampServidor, idempotencyKey

  — módulo Evaluación —
  candidatos/{candidatoId}
    unidadId, nombre, ingresoDeclarado, tipoGarantia, grupoConviviente
    score, desglose: { }
    proyeccion: [ { mes, expensaProyectada, esfuerzo } ]
    estado: "evaluando" | "aprobado" | "rechazado"

**Dos decisiones que conviene poder defender:**

- `eventosAcceso` y `avances` son **append-only**: las reglas prohíben `update` y `delete` para todos los roles, incluido el admin. Un avance mal cargado se corrige cargando un avance correctivo. Esto hace el historial auditable.
- Los `avances` llevan `idempotencyKey` generada en el cliente. Si el celular sincroniza dos veces la misma carga al recuperar señal —cosa que pasa siempre—, el segundo escrito se descarta. Es la solución concreta al problema del offline, y es una pregunta muy probable en la defensa.

---

## 7. Seguridad y roles

| **Rol**           | **Alcance**                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| superadmin        | La administradora: acceso a todos los complejos de su cartera. Único que da de alta un complejo. |
| admin\_complejo   | Todo dentro de **su** complejo. Único que cierra períodos de liquidación.                        |
| guardia           | Solo valida accesos y lee autorizaciones vigentes. No accede a expensas, morosidad ni contactos. |
| responsable\_obra | Solo partidas y avances de su obra. No ve nada del sistema base.                                 |
| residente         | Solo su unidad: sus expensas, sus reservas, sus reclamos, sus autorizaciones.                    |

El rol y el `complejoId` viajan en **custom claims** del token de Firebase Auth, no en un documento que el cliente pueda leer o modificar. Las reglas de Firestore validan contra el claim.
Los tres casos que hay que dejar andando y mostrar en la defensa:

1. Un residente intenta leer la unidad de un vecino → **denegado**.
2. Un guardia intenta escribir en `periodos` → **denegado**.
3. Cualquiera intenta editar un `eventoAcceso` ya registrado → **denegado**, la colección es append-only.

---

## 8. APIs externas

| **API**                             | **Para qué**                                                                                          | **Dónde**    |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------ |
| **Mercado Pago**                    | Cobro de expensas y cuotas: checkout y webhook de confirmación.                                       | Base         |
| **IA generativa** (Claude o Gemini) | Clasificación de reclamos por área y urgencia desde texto y foto.                                     | Base         |
| **Firebase Cloud Messaging**        | Avisos de administración, aviso de ingreso de visita, alerta de partida crítica.                      | Base         |
| **Google Maps**                     | Ubicación de unidades y lotes en complejos grandes, geolocalización de reclamos y de avances de obra. | Base + Obras |
| **API del BCRA**                    | Serie de índices reales para proyectar la expensa. Pública y gratuita.                                | Evaluación   |

**Opcional si sobra tiempo:** OCR de patentes para la barrera vehicular.
**Recomendación explícita: saquen reconocimiento facial.** Tiene costo por llamada, exige consentimiento por tratamiento de datos biométricos según la Ley 25.326, y no resuelve nada que el QR no resuelva mejor. Saquen también el streaming de cámaras en vivo: es un pozo sin fondo que no aporta ningún núcleo interesante. Si quieren cubrir el punto "cámaras", muestren el **historial de accesos con la foto capturada en el momento del ingreso** — es la parte útil y cuesta diez veces menos.

---

## 9. Alcance y plan de recorte

Tienen desde hoy hasta el **16 de octubre**, trabajando solo en horas de clase. El riesgo principal no es la dificultad técnica: es dispersarse. Construyan en este orden.

### P0 — Sin esto no hay producto

- Configuración de complejo y ABM de unidades
- Auth, roles con custom claims y reglas de Firestore cerradas
- Accesos: QR dinámico, escaneo del guardia, validación transaccional, log inmutable, panel en vivo
- Autorización de visitas con vigencia
- Reclamos con foto y clasificación por IA
- Bandeja de reclamos con estados y asignación
- Liquidación de expensas con prorrateo y cierre exacto
- Pago con Mercado Pago e imputación al saldo
- Dashboard de cobranza y morosidad

### P1 — Lo que sube mucho la nota

- Reserva de amenities con validación de superposición y cupos
- Notificaciones push
- Módulo Obras: partidas, camino crítico, carga de avance con foto
- Sincronización offline con `idempotencyKey`
- Permisos de obra integrados al control de acceso

### P2 — Solo si sobra tiempo

- Módulo Evaluación de ingresantes
- Avance físico contra avance de gasto en obra común
- Consumos de servicios
- OCR de patentes

### Qué recortar si a fin de septiembre no llegan

Primero el **módulo Evaluación**: es el más chico y el que menos se luce en vivo. Se puede dejar como pantalla funcional simple y explicar el motor en el pitch.
Después, la **sincronización offline** del módulo de obras: la carga puede requerir conexión y el módulo sigue siendo válido.
**Nunca recorten** el tiempo real entre app y panel, las reglas de seguridad, ni el cierre exacto de la liquidación. Son los tres puntos donde la materia evalúa de verdad.

---

## 10. Identidad visual (Fase 1)

**Concepto del isotipo.** Un perímetro cerrado con unidades adentro: un contorno simple que contiene tres o cuatro formas. Se lee como edificio visto en planta, como manzana y como barrio, así que funciona para los cuatro tipos de complejo sin cambiar. Es reconocible en un ícono de 48px y se puede animar en la landing (las unidades encendiéndose de a una).
**Paleta.** Predominan el blanco y el celeste. Los colores de estado aparecen solo cuando hay algo que comunicar.

| **Uso**                                                           | **Color**      | **Hex** |
| ----------------------------------------------------------------- | -------------- | ------- |
| Celeste principal — marca, botones, elementos activos             | Celeste        | #3E9BE4 |
| Celeste claro — fondos de sección, tarjetas, hover                | Celeste pálido | #E8F3FC |
| Celeste borde — divisores suaves, bordes de tarjeta               | Celeste tenue  | #C7E1F5 |
| Azul profundo — títulos, encabezado del panel, texto sobre blanco | Azul           | #14395E |
| Superficie principal                                              | Blanco         | #FFFFFF |
| Bordes y separadores neutros                                      | Gris claro     | #DCE5EC |
| Texto principal                                                   | Grafito        | #16232E |
| Texto secundario                                                  | Gris azulado   | #5C6D7C |
| Al día / resuelto                                                 | Verde          | #1F9D6B |
| Pendiente / en progreso                                           | Ámbar          | #E0A030 |
| Vencido / crítico                                                 | Rojo           | #D8503F |

**Cómo usarla.** Proporción 60 / 30 / 10: sesenta por ciento blanco, treinta por ciento celeste pálido en fondos y tarjetas, diez por ciento celeste principal y colores de estado. Un dashboard donde todo es celeste no comunica nada; el celeste tiene que ser el descanso para que el rojo de una unidad morosa salte a la vista.
**Un detalle de accesibilidad que conviene poder defender.** El celeste principal sobre blanco da un contraste aproximado de 3:1. Alcanza para botones, íconos, barras y títulos grandes, pero **no para texto de cuerpo**: todo el texto chico va en azul profundo o grafito, que superan 10:1. Es la clase de decisión que demuestra criterio de diseño y no gusto personal.
Verde, ámbar y rojo no son decorativos: son los estados de morosidad, de reclamo y de partida crítica. La paleta tiene función además de estética.
**Tipografía.**

- **Sora** — primaria. Titulares, nombre de marca, números grandes del dashboard. Es geométrica y tiene personalidad propia, así que carga el peso de la identidad.
- **Archivo** — secundaria. Interfaz, cuerpo de texto, tablas y formularios. Fue diseñada para uso intensivo en pantalla y tiene la variante **Archivo Narrow** para tablas densas, que en el panel de morosidad se agradece.
- **Tahoma** — queda como respaldo en la cascada CSS. Está instalada en todas las máquinas con Windows, así que si por lo que sea no cargan las webfonts el día de la demo, el sitio no se cae a Times New Roman.

\--fuente-titulos: 'Sora', Tahoma, sans-serif;
\--fuente-texto: 'Archivo', Tahoma, 'Segoe UI', sans-serif;

Para las columnas de plata, activar cifras tabulares con `font-feature-settings: 'tnum'`. Sin eso, los montos no alinean en la vertical y el dashboard se ve amateur. Las dos fuentes están en Google Fonts, así que funcionan igual en la web y en Flutter con el paquete `google_fonts`.

---

## 11. Backlog inicial para el tablero (Fase 1)

Para cargar en **Por Hacer**. Conviene una etiqueta por épica y otra por prioridad.
**Producto y marca**

- Definir nombre final, verificar dominio y buscar en INPI
- Diseñar logotipo e isotipo
- Definir y documentar paleta y tipografía
- Redactar propuesta de valor y planes de precio
- Armar el tablero y cargar el backlog completo

**Infraestructura**

- Crear proyecto Firebase y configurar entornos
- Configurar Auth y custom claims por rol
- Escribir reglas de Firestore por colección
- Escribir los tres tests de reglas de seguridad
- Armar seeds de datos de demostración

**Configuración y unidades**

- ABM de complejos con configuración por tipo
- Pantalla de configuración: amenities, métodos de acceso, nomenclatura
- ABM de unidades con titular e inquilino
- Carga de coeficientes y validación de que sumen 100%

**Accesos**

- Generación de QR dinámico
- Pantalla de escaneo del guardia
- Transacción de validación con control de doble uso
- Log inmutable de eventos de acceso
- Panel de accesos en tiempo real
- Alta de autorización de visita con vigencia y horario límite
- ABM de patentes autorizadas por unidad
- Notificación al residente cuando ingresa su visita

**Amenities**

- ABM de amenities configurables
- Calendario de disponibilidad
- Reserva con validación de superposición y cupo
- Cancelación y liberación de cupo

**Reclamos**

- Carga de reclamo con foto desde la app
- Integración de clasificación por IA
- Bandeja priorizada en el panel
- Cambio de estado con historial
- ABM de proveedores y asignación

**Expensas y pagos**

- Carga de gastos del período (ordinarios y extraordinarios)
- Motor de prorrateo por coeficiente
- Política de redondeo con cierre exacto
- Cálculo de intereses por mora
- Imputación de pagos parciales
- Integración de checkout de Mercado Pago
- Webhook de confirmación de pago
- Detalle de liquidación en la app del residente
- Dashboard de cobranza y morosidad

**Notificaciones**

- Envío de aviso masivo desde el panel
- Integración con Firebase Cloud Messaging
- Bandeja de avisos en la app

**Módulo Obras**

- ABM de obras (privadas y comunes)
- ABM de partidas con predecesoras
- Algoritmo de camino crítico
- Cálculo de holguras y fecha estimada de fin
- Carga de avance con foto y geolocalización
- Cola local de sincronización offline
- Resolución de duplicados por idempotencyKey
- Vista de avance para el residente
- Avance físico contra avance de gasto
- Permisos de obra con horario permitido, integrados a accesos

**Módulo Evaluación**

- Formulario de carga de candidato
- Motor de scoring con pesos configurables
- Integración con la API del BCRA
- Proyección de expensa mes a mes
- Gráfico de curva de esfuerzo
- Flujo de aprobación y alta automática de residente

**Cierre**

- Landing page
- Video demo
- Presentación del pitch
- Guion y ensayo de la demo en vivo
- Corrección de bugs del QA cruzado

---

## 12. Landing page y modelo de negocio (Fase 4)

**Estructura:**

1. Titular con el concepto: un solo sistema para cualquier complejo.
2. El problema, contado con el WhatsApp, la planilla y el cuaderno de la garita.
3. Las dos vistas, con captura real de cada una.
4. Los módulos activables.
5. Video demo embebido.
6. Planes y precios.
7. Formulario de contacto y botón de prueba.

**Planes** (precio por unidad por mes, que es como se cobra en el rubro):

| **Plan**    | **Para quién**               | **Incluye**                                                           |
| ----------- | ---------------------------- | --------------------------------------------------------------------- |
| **Base**    | Consorcios y edificios       | Accesos, amenities, reclamos, expensas y pagos                        |
| **Barrio**  | Barrios cerrados y countries | Base + patentes, múltiples puntos de acceso y módulo de obras         |
| **Cartera** | Administradoras              | Todo, multi-complejo, evaluación de ingresantes y soporte prioritario |

---

## 13. Guion de la demo en vivo

Tres momentos, en este orden. Cada uno tiene que verse moverse sin explicación.
**Momento 1 — Accesos (60 s).** Un residente autoriza una visita desde el celular con horario límite. Un compañero, haciendo de guardia con otro dispositivo, escanea el QR: el ingreso aparece en el panel proyectado al instante y al residente le llega la notificación. Se intenta escanear el mismo QR una segunda vez y el sistema lo rechaza mostrando el motivo.
**Momento 2 — Liquidación (45 s).** Se carga una factura extraordinaria en el panel. El sistema liquida las 40 unidades y muestra la verificación de que la suma cierra al centavo. En el celular del residente, su expensa se actualiza sola.
**Momento 3 — Obra (45 s).** El responsable de obra carga un atraso en una partida menor. El panel muestra que la obra se corre tres semanas porque esa partida no tenía holgura, y en la app del residente cambia la fecha estimada de finalización.
**Cierre (20 s).** Se cambia el tipo de complejo en configuración, de edificio a country: la app pasa a hablar de lotes y cuotas en vez de departamentos y expensas, y aparece la barrera vehicular. Es la prueba visible de la tesis del producto.
Ensáyenlo con los datos ya cargados. La demo se prepara, no se improvisa.

---

## 14. Calendario

| **Fecha**            | **Entrega**                                                    |
| -------------------- | -------------------------------------------------------------- |
| 21 de agosto         | **Fase 1** — negocio, marca, identidad visual, tablero cargado |
| 16 de octubre        | **Fase 2** — sistema funcionando con todo el P0                |
| 30 de octubre        | **Fase 3** — QA cruzado                                        |
| 6 de noviembre       | **Fase 4** — sistema corregido, landing y video demo           |
| 6 al 19 de noviembre | **Fase 5** — exposición                                        |

**Hitos internos para no llegar apurados:**

- **5 de septiembre:** infraestructura lista — Auth, roles, reglas y modelo de datos andando con datos de prueba. Sin esto, todo lo demás se construye sobre arena.
- **19 de septiembre:** accesos y reclamos operativos punta a punta.
- **3 de octubre:** liquidación cerrando exacto y pagos integrados.
- **10 de octubre:** congelamiento de funcionalidades. La última semana es solo para arreglar, no para agregar. Es la regla que más proyectos salva.

---

## 15. Los tres argumentos para la defensa oral

1. **Un motor, cuatro complejos.** Un edificio y un country de 500 lotes corren el mismo código; lo que cambia es una pantalla de configuración. Es una decisión de arquitectura tomada al principio, no una funcionalidad agregada después.


2. **Tres motores propios, no tres integraciones.** El prorrateo con cierre exacto, la validación transaccional de accesos y el camino crítico son lógica de negocio que escribimos nosotros y podemos explicar línea por línea. Las APIs externas son plomería alrededor de eso.


3. **Lo que importa no se puede editar.** Los eventos de acceso y los avances de obra son append-only por regla de seguridad, no por convención. Un sistema que registra quién entró a un barrio y en qué se gastó la expensa extraordinaria no puede permitir que alguien reescriba la historia.

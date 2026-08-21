# Proyecto Integrador: Lanzamiento de una Startup

## Objetivo del proyecto

El objetivo de este proyecto es crear un **producto de software real, completo y listo para ser vendido o implementado en un cliente real**.

Los estudiantes trabajarán como un **equipo de desarrollo y producto (una startup)**. Pueden utilizar Inteligencia Artificial para todo lo que consideren necesario, pero son responsables de:

- La arquitectura del sistema.
- La lógica del negocio.
- El correcto funcionamiento de todo el producto.

> **IMPORTANTE:** Todo el trabajo debe realizarse dentro del aula y durante las horas de clase. Las entregas están planificadas para proporcionar el tiempo y el espacio necesarios durante las clases.

---

# 1. Fases de trabajo

El proyecto se divide en las siguientes fases:

1. **Fase 1 — Ideación y producto**
   - Definición del problema.
   - Público objetivo.
   - Marca.
   - Diseño visual.
   - Tablero de gestión.

2. **Fase 2 — Desarrollo técnico**
   - Aplicaciones.
   - Usuarios.
   - Firebase.
   - APIs.

3. **Fase 3 — QA cruzado**
   - Testeo de las aplicaciones entre grupos.

4. **Fase 4 — Corrección y lanzamiento**
   - Corrección de errores.
   - Landing Page.
   - Demo.
   - Entrega final.

5. **Fase 5 — Presentaciones**
   - Exposición de cada startup.

---

## Fase 1: Ideación, Identidad y Planificación

**Fecha límite: 21 de agosto**

En esta primera etapa se deberá entregar:

### 1.1. Definición del negocio

Responder:

- ¿Qué problema puntual resuelve el producto?
- ¿Quién es el cliente real?
- ¿Qué tan escalable es el negocio?

### 1.2. Identidad visual y branding

Definir:

- Nombre de la startup/producto.
- Logotipo.
- Isotipo:
  - Ícono de la aplicación.
  - Logo completo.
- Paleta de colores.
  - Incluir los códigos de color que posteriormente se utilizarán en la aplicación y en la web.
- Tipografía.

### 1.3. Tablero de gestión

Utilizar una de las siguientes herramientas:

- Trello.
- Jira.
- GitHub Projects.

El tablero será utilizado para organizar todo el trabajo del semestre.

En la columna **Por Hacer (To-Do)** se deberán cargar **absolutamente todas las tareas**, incluyendo tanto tareas técnicas como de diseño y contenido.

Ejemplos:

- "Armar pantalla de login".
- "Conectar Mercado Pago".
- "Diseñar logo".
- "Redactar landing".

---

# Fase 2: Desarrollo del sistema

**Fecha límite: 16 de octubre**

Una vez aprobada la Fase 1, comienza el desarrollo del sistema.

Se pueden utilizar herramientas de Inteligencia Artificial para:

- Escribir código.
- Crear vistas.
- Resolver problemas técnicos.
- Asistir durante el desarrollo.

Sin embargo, el proyecto debe cumplir obligatoriamente con los **requisitos técnicos de la materia**, detallados en la sección 2.

---

# Fase 3: Control de calidad cruzado

**Fecha límite: 30 de octubre**

Cuando los sistemas estén funcionales, se realizará un proceso de **QA cruzado** en el aula.

El funcionamiento será el siguiente:

- El **Equipo A** utilizará la aplicación del **Equipo B**.
- El objetivo será intentar encontrar:
  - Fallas.
  - Errores de seguridad.
  - Pantallas rotas.
  - Problemas en formularios.
  - Otros errores o comportamientos inesperados.

Cada equipo deberá entregar un **reporte formal con todos los bugs encontrados**, para que el equipo responsable pueda corregirlos.

---

# Fase 4: Corrección, Landing Page y presentación

**Fecha límite: 6 de noviembre**

A partir de los reportes realizados por los compañeros, cada grupo deberá corregir los errores encontrados en su sistema.

Para el cierre final del año se deberá presentar el paquete completo:

### Sistema

- Sistema funcionando.
- Errores encontrados durante el QA corregidos.

### Landing Page

Una página web diseñada para **vender el producto**.

Debe incluir como mínimo:

- Propuesta de valor.
- Capturas del sistema.
- Precios y/o planes.
- Botón para:
  - Contactarse.
  - Probar la aplicación.

### Video Demo

Video corto y dinámico que muestre:

- Cómo se utiliza la aplicación desde el celular.
- Cómo se utiliza el panel desde la PC.

---

# 2. Requisitos técnicos obligatorios

El tema de la aplicación es libre.

Sin embargo, **todos los proyectos deben cumplir obligatoriamente con los siguientes requisitos técnicos**.

## 2.1. Ecosistema de dos vistas

El sistema debe contar con **dos aplicaciones/vistas destinadas a diferentes tipos de usuarios**.

### Vista 1 — App móvil

Pensada para el **usuario final o cliente**.

Características esperadas:

- Rápida.
- Sencilla.
- Clara.
- Adaptada al uso desde un celular.

### Vista 2 — Panel web/escritorio

Pensada para el:

- Administrador.
- Dueño.
- Gestor.

Debe permitir realizar tareas de administración y control, incluyendo elementos como:

- Tablas de control.
- Gráficos.
- Listados.
- Alta de datos.
- Baja de datos.

---

## 2.2. Base de datos

**Ambas aplicaciones deben estar conectadas en tiempo real a la misma base de datos utilizando Firebase Firestore.**

La App Móvil y el Panel Web/Escritorio deben trabajar sobre la misma información.

---

## 2.3. Seguridad y roles

Se deben implementar **reglas de seguridad cerradas en Firestore**.

> No se puede dejar la base de datos abierta para que cualquier persona pueda acceder o modificarla.

El sistema debe contar como mínimo con **dos roles diferenciados**:

- `admin`
- `usuario`

Cada rol debe poder acceder únicamente a la información y funcionalidades que le corresponden.

---

## 2.4. Consumo de APIs externas

El software debe comunicarse con servicios externos y con el "mundo real".

Se deben integrar **como mínimo 2 APIs comerciales**, seleccionadas de acuerdo con las necesidades del negocio.

Algunos ejemplos:

- Mercado Pago.
- Google Maps.
- APIs de logística.
- APIs de mensajería.
- APIs de correo electrónico.
- APIs de Inteligencia Artificial generativa.
- APIs de datos deportivos.
- APIs de clima.

> Las APIs seleccionadas deben tener sentido dentro del funcionamiento del negocio.

---

## 2.5. Resiliencia y manejo de errores

La aplicación debe ser capaz de manejar situaciones inesperadas.

Por ejemplo:

- Pérdida de conexión a Internet.
- Datos ingresados incorrectamente.
- Errores en formularios.
- Errores al realizar consultas.
- Fallos en servicios externos.

La aplicación **no debe mostrar pantallas rojas de error de Flutter** ante estos casos.

Todo formulario y consulta debe contar con:

- Manejo de excepciones mediante `try/catch`.
- Validación de datos.
- Mensajes claros para el usuario.
- Manejo adecuado de errores.

---

# 3. Presentación oral y exposición en clase

**Fecha límite: jueves 19 de noviembre**

Las exposiciones se realizarán **desde el viernes 6 de noviembre hasta el jueves 19 de noviembre**.

Se expondrán aproximadamente **3 grupos por clase**.

El orden de presentación será sorteado previamente.

## Materiales obligatorios para presentar en pantalla

### 3.1. Presentación con diapositivas — Pitch

Debe explicar:

- El problema.
- La solución.
- El cliente objetivo.
- La marca.
- El proceso de desarrollo realizado durante las clases.

### 3.2. Demostración en vivo

Se deberá mostrar el funcionamiento real del ecosistema:

- App Móvil.
- Panel Web.
- Comunicación entre ambas aplicaciones.
- Actualización de información en tiempo real.

### 3.3. Landing Page y Video Demo

Se deberá mostrar:

- La Landing Page terminada.
- El Video Demo del producto.

---

# ¿Cómo se aprueba y evalúa este proyecto?

El proyecto de cada grupo será evaluado de forma **integral durante la exposición final frente al curso y al docente**.

> **No se evalúa la sintaxis ni el código en detalle. Se evalúa la totalidad del producto construido.**

Los principales aspectos evaluados serán:

### 1. Solidez de la idea

- Calidad de la idea.
- Problema real que resuelve.
- Claridad de la propuesta de valor.

### 2. Funcionamiento del ecosistema

- Funcionamiento de la App Móvil.
- Funcionamiento del Panel Web.
- Comunicación entre ambos.
- Conexión en tiempo real.
- Correcto funcionamiento durante la demostración.

### 3. Calidad del producto y presentación

- Calidad de la marca.
- Calidad de la Landing Page.
- Calidad del Video Demo.
- Coherencia general del producto.

### 4. Capacidad del equipo

El equipo debe demostrar que puede:

- Exponer correctamente su startup.
- Defender el trabajo realizado durante el año.
- Explicar las decisiones tomadas.
- Demostrar que entiende perfectamente cómo funciona todo lo que construyó.
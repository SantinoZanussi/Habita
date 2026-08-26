/**
 * Mapa de rutas de la API.
 *
 * Convencion: todo lo que opera sobre un complejo cuelga de
 * /api/complejos/:complejoId/... y pasa por `exigirComplejo`, que es la barrera
 * multi-tenant. Sin ese middleware, cambiar un id en la URL daria acceso a otro
 * complejo, porque el Admin SDK no pasa por las reglas de Firestore.
 */

import salud from './salud.js';
import publico from './publico.js';
import usuarios from './usuarios.js';
import complejos from './complejos.js';
import unidades from './unidades.js';
import accesos from './accesos.js';
import reclamos from './reclamos.js';
import expensas from './expensas.js';
import amenities from './amenities.js';
import obras from './obras.js';
import evaluacion from './evaluacion.js';
import notificaciones from './notificaciones.js';

export default function montarRutas(app) {
  app.use('/api', salud);
  app.use('/api', publico);
  app.use('/api/usuarios', usuarios);
  app.use('/api/complejos', complejos);
  app.use('/api/complejos/:complejoId/unidades', unidades);
  app.use('/api/complejos/:complejoId/accesos', accesos);
  app.use('/api/complejos/:complejoId/reclamos', reclamos);
  app.use('/api/complejos/:complejoId/expensas', expensas);
  app.use('/api/complejos/:complejoId/amenities', amenities);
  app.use('/api/complejos/:complejoId/obras', obras);
  app.use('/api/complejos/:complejoId/candidatos', evaluacion);
  app.use('/api/complejos/:complejoId/notificaciones', notificaciones);
}

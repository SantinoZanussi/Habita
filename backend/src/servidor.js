/**
 * Punto de arranque del backend.
 *
 * Valida el entorno antes de levantar: en produccion, un secreto de desarrollo
 * o la falta de credenciales cortan el arranque. Es preferible que el servicio
 * no levante a que levante inseguro y nadie se entere.
 */

import { crearApp } from './app.js';
import { entorno, validarEntorno } from './config/entorno.js';
import { log } from './infra/log.js';

const { problemas, advertencias, valido } = validarEntorno();

if (!valido) {
  log.error('El backend no puede arrancar con esta configuracion');
  for (const p of problemas) log.error(`  - ${p}`);
  process.exit(1);
}

for (const a of advertencias) log.aviso(a);

const app = crearApp();

const servidor = app.listen(entorno.puerto, () => {
  log.info('Habita backend en linea', {
    puerto: entorno.puerto,
    modo: entorno.modo,
    proyecto: entorno.firebase.projectId,
    emuladores: entorno.firebase.usarEmuladores,
  });
});

/** Cierre ordenado: se dejan terminar las peticiones en curso. */
function apagar(senal) {
  log.info(`Recibido ${senal}, cerrando`);
  servidor.close(() => {
    log.info('Servidor cerrado');
    process.exit(0);
  });
  // Si en diez segundos no cerro, se fuerza: mejor eso que quedar colgado.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => apagar('SIGTERM'));
process.on('SIGINT', () => apagar('SIGINT'));

process.on('unhandledRejection', (motivo) => {
  log.error('Promesa rechazada sin manejar', { motivo: String(motivo) });
});

process.on('uncaughtException', (error) => {
  log.error('Excepcion no capturada', { mensaje: error.message, stack: error.stack });
  apagar('uncaughtException');
});

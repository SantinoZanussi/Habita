/** Avisos persistidos en Firestore y enviados por FCM. */

import { rutas, FieldValue, aObjeto } from '../infra/firebase.js';
import { enviarATokens, avisos } from '../externos/notificaciones.js';
import { errores } from '../infra/errores.js';

export function normalizarAviso({ titulo, cuerpo, destinatarios = 'todos' }) {
  if (typeof titulo !== 'string' || !titulo.trim() || titulo.length > 120 ||
      typeof cuerpo !== 'string' || !cuerpo.trim() || cuerpo.length > 4000) {
    throw errores.datosInvalidos({ aviso: 'Ingresá un título de hasta 120 caracteres y un mensaje de hasta 4000.' });
  }
  if (destinatarios !== 'todos' && (!Array.isArray(destinatarios) || destinatarios.length < 1 ||
      destinatarios.length > 30 || destinatarios.some((id) => typeof id !== 'string' || !id.trim() || id.includes('/')))) {
    throw errores.datosInvalidos({ destinatarios: 'Elegí todos o entre 1 y 30 unidades.' });
  }
  return { titulo: titulo.trim(), cuerpo: cuerpo.trim(), destinatarios: destinatarios === 'todos' ? 'todos' : [...new Set(destinatarios)] };
}

export function tokensDestinatarios(usuarios, destinatarios) {
  return [...new Set(usuarios.filter((u) => u.activo === true &&
    (destinatarios === 'todos' || destinatarios.includes(u.unidadId)))
    .map((u) => u.tokenFcm).filter(Boolean))];
}

export async function publicarAviso({ complejoId, titulo, cuerpo, tipo = 'administracion', destinatarios = 'todos', actorUid }) {
  ({ titulo, cuerpo, destinatarios } = normalizarAviso({ titulo, cuerpo, destinatarios }));
  const ref = rutas.notificaciones(complejoId).doc();
  await ref.set({
    titulo, cuerpo, tipo, destinatarios,
    enviadaEn: FieldValue.serverTimestamp(),
    creadaPorUid: actorUid,
  });

  const consulta = rutas.usuarios().where('complejoId', '==', complejoId).where('activo', '==', true);
  const tokens = tokensDestinatarios((await consulta.get()).docs.map((d) => d.data()), destinatarios);
  const resultado = await enviarATokens({ tokens, ...avisos.avisoAdministracion({ titulo, cuerpo }), datos: { tipo, id: ref.id } });
  return { ...aObjeto(await ref.get()), entrega: resultado };
}


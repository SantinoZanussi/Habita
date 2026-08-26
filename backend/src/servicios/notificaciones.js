/** Avisos persistidos en Firestore y enviados por FCM. */

import { rutas, FieldValue, aObjeto } from '../infra/firebase.js';
import { enviarATokens, avisos } from '../externos/notificaciones.js';

export async function publicarAviso({ complejoId, titulo, cuerpo, tipo = 'administracion', destinatarios = 'todos', actorUid }) {
  const ref = rutas.notificaciones(complejoId).doc();
  await ref.set({
    titulo, cuerpo, tipo, destinatarios,
    enviadaEn: FieldValue.serverTimestamp(),
    creadaPorUid: actorUid,
  });

  let consulta = rutas.usuarios().where('complejoId', '==', complejoId).where('activo', '==', true);
  if (Array.isArray(destinatarios) && destinatarios.length === 1) {
    consulta = consulta.where('unidadId', '==', destinatarios[0]);
  }
  const tokens = (await consulta.get()).docs.map((d) => d.data().tokenFcm).filter(Boolean);
  const resultado = await enviarATokens({ tokens, ...avisos.avisoAdministracion({ titulo, cuerpo }), datos: { tipo, id: ref.id } });
  return { ...aObjeto(await ref.get()), entrega: resultado };
}


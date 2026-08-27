import { readFileSync } from 'node:fs';
import { after, before, beforeEach, test } from 'node:test';
import {
  assertFails, assertSucceeds, initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc,
} from 'firebase/firestore';
import { getBytes, ref, uploadBytes } from 'firebase/storage';

const projectId = `habita-reglas-${Date.now()}`;
let entorno;

before(async () => {
  entorno = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: '127.0.0.1', port: 8080,
      rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
    },
    storage: {
      host: '127.0.0.1', port: 9199,
      rules: readFileSync(new URL('../storage.rules', import.meta.url), 'utf8'),
    },
  });
});

beforeEach(async () => {
  await entorno.clearFirestore();
  await entorno.withSecurityRulesDisabled(async (contexto) => {
    const db = contexto.firestore();
    await setDoc(doc(db, 'complejos/c1'), { nombre: 'Complejo 1' });
    await setDoc(doc(db, 'complejos/c1/unidades/u1'), { identificador: '1A' });
    await setDoc(doc(db, 'complejos/c1/unidades/u2'), { identificador: '1B' });
    await setDoc(doc(db, 'complejos/c1/eventosAcceso/e1'), { unidadId: 'u1', resultado: 'permitido' });
    await setDoc(doc(db, 'complejos/c1/periodos/2026-08'), { estado: 'cerrado' });
    await setDoc(doc(db, 'usuarios/residente-1'), {
      nombre: 'Residente Uno', telefono: '1111-1111', complejoId: 'c1', unidadId: 'u1',
    });
    await setDoc(doc(db, 'complejos/c1/obras/obra-propia'), { tipo: 'privada', unidadId: 'u1' });
    await setDoc(doc(db, 'complejos/c1/obras/obra-ajena'), { tipo: 'privada', unidadId: 'u2' });
    await setDoc(doc(db, 'complejos/c1/obras/obra-comun'), { tipo: 'comun' });
    await setDoc(doc(db, 'complejos/c1/obras/obra-propia/partidas/p1'), { nombre: 'Pintura' });
    await setDoc(doc(db, 'complejos/c1/obras/obra-ajena/partidas/p1'), { nombre: 'Baño privado' });
    await setDoc(doc(db, 'complejos/c1/obras/obra-ajena/avances/a1'), { partidaId: 'p1', porcentaje: 40 });
    await setDoc(doc(db, 'complejos/c1/obras/obra-comun/partidas/p1'), { nombre: 'Pileta' });
  });
});

after(async () => entorno?.cleanup());

test('residente lee su unidad pero no la de un vecino ni el listado', async () => {
  const db = entorno.authenticatedContext('residente-1', {
    rol: 'residente', complejoId: 'c1', unidadId: 'u1',
  }).firestore();
  await assertSucceeds(getDoc(doc(db, 'complejos/c1/unidades/u1')));
  await assertFails(getDoc(doc(db, 'complejos/c1/unidades/u2')));
  await assertFails(getDocs(collection(db, 'complejos/c1/unidades')));
});

test('guardia no puede crear ni editar periodos', async () => {
  const db = entorno.authenticatedContext('guardia-1', { rol: 'guardia', complejoId: 'c1' }).firestore();
  await assertFails(setDoc(doc(db, 'complejos/c1/periodos/2026-09'), { estado: 'borrador' }));
  await assertFails(updateDoc(doc(db, 'complejos/c1/periodos/2026-08'), { estado: 'borrador' }));
  await assertFails(getDoc(doc(db, 'usuarios/residente-1')));
});

test('un residente no puede saltar la privacidad leyendo subcolecciones de una obra ajena', async () => {
  const db = entorno.authenticatedContext('residente-1', {
    rol: 'residente', complejoId: 'c1', unidadId: 'u1',
  }).firestore();
  await assertSucceeds(getDoc(doc(db, 'complejos/c1/obras/obra-propia/partidas/p1')));
  await assertSucceeds(getDoc(doc(db, 'complejos/c1/obras/obra-comun/partidas/p1')));
  await assertFails(getDoc(doc(db, 'complejos/c1/obras/obra-ajena/partidas/p1')));
  await assertFails(getDoc(doc(db, 'complejos/c1/obras/obra-ajena/avances/a1')));
});

test('eventos de acceso son append-only incluso para el admin', async () => {
  const db = entorno.authenticatedContext('admin-1', { rol: 'admin_complejo', complejoId: 'c1' }).firestore();
  await assertSucceeds(getDoc(doc(db, 'complejos/c1/eventosAcceso/e1')));
  await assertFails(updateDoc(doc(db, 'complejos/c1/eventosAcceso/e1'), { resultado: 'rechazado' }));
  await assertFails(deleteDoc(doc(db, 'complejos/c1/eventosAcceso/e1')));
  await assertFails(addDoc(collection(db, 'complejos/c1/eventosAcceso'), { resultado: 'permitido' }));
});

test('residente crea un reclamo valido solo para su propia unidad', async () => {
  const db = entorno.authenticatedContext('residente-1', {
    rol: 'residente', complejoId: 'c1', unidadId: 'u1',
  }).firestore();
  const base = { autorUid: 'residente-1', estado: 'pendiente', descripcion: 'Hay una pérdida de agua importante' };
  await assertSucceeds(setDoc(doc(db, 'complejos/c1/reclamos/r1'), { ...base, unidadId: 'u1' }));
  await assertFails(setDoc(doc(db, 'complejos/c1/reclamos/r2'), { ...base, unidadId: 'u2' }));
});

test('una foto de reclamo queda aislada por usuario, complejo y tipo de archivo', async () => {
  const contexto = entorno.authenticatedContext('residente-1', {
    rol: 'residente', complejoId: 'c1', unidadId: 'u1',
  });
  const storage = contexto.storage();
  const imagen = new Uint8Array([137, 80, 78, 71]);
  const propia = ref(storage, 'complejos/c1/reclamos/residente-1/evidencia.png');
  const ajena = ref(storage, 'complejos/c1/reclamos/residente-2/evidencia.png');
  const storageAjeno = entorno.authenticatedContext('residente-2', {
    rol: 'residente', complejoId: 'c1', unidadId: 'u2',
  }).storage();
  await assertSucceeds(uploadBytes(propia, imagen, { contentType: 'image/png' }));
  await assertSucceeds(uploadBytes(ref(storageAjeno, ajena.fullPath), imagen, { contentType: 'image/png' }));
  await assertSucceeds(getBytes(propia));
  await assertFails(getBytes(ajena));
  await assertFails(uploadBytes(ref(storage, 'complejos/c1/reclamos/residente-2/otra.png'), imagen, { contentType: 'image/png' }));
  await assertFails(uploadBytes(ref(storage, 'complejos/c2/reclamos/residente-1/evidencia.png'), imagen, { contentType: 'image/png' }));
  await assertFails(uploadBytes(ref(storage, 'complejos/c1/reclamos/residente-1/programa.exe'), imagen, { contentType: 'application/octet-stream' }));
});

test('un responsable de obra solo carga y lee fotos de las obras asignadas', async () => {
  const storage = entorno.authenticatedContext('obra-1', {
    rol: 'responsable_obra', complejoId: 'c1', obraIds: ['obra-propia'],
  }).storage();
  const imagen = new Uint8Array([137, 80, 78, 71]);
  const asignada = ref(storage, 'complejos/c1/obras/obra-propia/avance.png');
  const ajena = ref(storage, 'complejos/c1/obras/obra-ajena/avance.png');
  const storageAdmin = entorno.authenticatedContext('admin-1', {
    rol: 'admin_complejo', complejoId: 'c1',
  }).storage();
  await assertSucceeds(uploadBytes(asignada, imagen, { contentType: 'image/png' }));
  await assertSucceeds(uploadBytes(ref(storageAdmin, ajena.fullPath), imagen, { contentType: 'image/png' }));
  await assertSucceeds(getBytes(asignada));
  await assertFails(uploadBytes(ajena, imagen, { contentType: 'image/png' }));
  await assertFails(getBytes(ajena));
});


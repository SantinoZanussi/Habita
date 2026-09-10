const esLocal = ['localhost', '127.0.0.1'].includes(location.hostname);

const configuracionLocal = {
  apiUrl: 'http://127.0.0.1:8787/api',
  firebase: {
    apiKey: 'demo-habita',
    authDomain: 'habita-complejos-goiburu.firebaseapp.com',
    projectId: 'habita-complejos-goiburu',
    storageBucket: 'habita-complejos-goiburu.firebasestorage.app',
    appId: '1:000000000000:web:habita-local',
  },
  emuladores: { activo: true, host: '127.0.0.1', auth: 9099, firestore: 8080 },
};

// En Firebase Hosting, la URL reservada devuelve la configuración del proyecto
// que sirve el panel. Así el mismo build funciona en local, staging y producción
// sin versionar claves ni editar este archivo antes de desplegar.
window.HABITA_CONFIG_PROMISE = esLocal
  ? Promise.resolve(configuracionLocal)
  : fetch('/__/firebase/init.json')
    .then((respuesta) => {
      if (!respuesta.ok) throw new Error('Firebase Hosting no devolvió su configuración.');
      return respuesta.json();
    })
    .then((firebase) => ({
      apiUrl: 'https://habita-api-goiburu.onrender.com/api',
      firebase,
      emuladores: { activo: false },
    }));

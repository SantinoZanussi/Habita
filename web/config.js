const esLocal = ['localhost', '127.0.0.1'].includes(location.hostname);

const configuracionLocal = {
  apiUrl: 'http://127.0.0.1:8787/api',
  firebase: {
    apiKey: 'demo-habita',
    authDomain: 'habita-demo.firebaseapp.com',
    projectId: 'habita-demo',
    storageBucket: 'habita-demo.appspot.com',
    appId: '1:000000000000:web:habita-demo',
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
      apiUrl: '/api',
      firebase,
      emuladores: { activo: false },
    }));

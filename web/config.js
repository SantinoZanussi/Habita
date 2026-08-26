window.HABITA_CONFIG = {
  apiUrl: 'http://127.0.0.1:8787/api',
  firebase: {
    apiKey: 'demo-habita',
    authDomain: 'habita-demo.firebaseapp.com',
    projectId: 'habita-demo',
    storageBucket: 'habita-demo.appspot.com',
    appId: '1:000000000000:web:habita-demo',
  },
  emuladores: {
    activo: ['localhost', '127.0.0.1'].includes(location.hostname),
    host: '127.0.0.1',
    auth: 9099,
    firestore: 8080,
  },
};


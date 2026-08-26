import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

abstract final class HabitaFirebase {
  static FirebaseOptions get opciones {
    if (kIsWeb) {
      return const FirebaseOptions(
        apiKey: 'demo-habita',
        appId: '1:000000000000:web:habita-demo',
        messagingSenderId: '000000000000',
        projectId: 'habita-demo',
        authDomain: 'habita-demo.firebaseapp.com',
        storageBucket: 'habita-demo.appspot.com',
      );
    }
    return const FirebaseOptions(
      apiKey: 'demo-habita',
      appId: '1:000000000000:android:habita-demo',
      messagingSenderId: '000000000000',
      projectId: 'habita-demo',
      storageBucket: 'habita-demo.appspot.com',
    );
  }
}

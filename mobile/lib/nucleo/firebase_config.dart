import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

abstract final class HabitaFirebase {
  static const _apiKey = String.fromEnvironment(
    'FIREBASE_API_KEY',
    defaultValue: 'demo-habita',
  );
  static const _projectId = String.fromEnvironment(
    'FIREBASE_PROJECT_ID',
    defaultValue: 'habita-demo',
  );
  static const _storageBucket = String.fromEnvironment(
    'FIREBASE_STORAGE_BUCKET',
    defaultValue: 'habita-demo.appspot.com',
  );
  static const _senderId = String.fromEnvironment(
    'FIREBASE_MESSAGING_SENDER_ID',
    defaultValue: '000000000000',
  );

  static FirebaseOptions get opciones {
    if (kIsWeb) {
      return const FirebaseOptions(
        apiKey: _apiKey,
        appId: String.fromEnvironment(
          'FIREBASE_WEB_APP_ID',
          defaultValue: '1:000000000000:web:habita-demo',
        ),
        messagingSenderId: _senderId,
        projectId: _projectId,
        authDomain: String.fromEnvironment(
          'FIREBASE_AUTH_DOMAIN',
          defaultValue: 'habita-demo.firebaseapp.com',
        ),
        storageBucket: _storageBucket,
      );
    }
    return const FirebaseOptions(
      apiKey: _apiKey,
      appId: String.fromEnvironment(
        'FIREBASE_ANDROID_APP_ID',
        defaultValue: '1:000000000000:android:habita-demo',
      ),
      messagingSenderId: _senderId,
      projectId: _projectId,
      storageBucket: _storageBucket,
    );
  }
}

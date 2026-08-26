import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../nucleo/tema/tokens.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController(text: 'residente@habita.demo');
  final _password = TextEditingController(text: 'Habita2026!');
  bool _cargando = false;
  String? _error;

  Future<void> _ingresar() async {
    setState(() {
      _cargando = true;
      _error = null;
    });
    try {
      await FirebaseAuth.instance.signInWithEmailAndPassword(
        email: _email.text.trim(),
        password: _password.text,
      );
    } on FirebaseAuthException catch (error) {
      setState(
        () => _error = error.code == 'invalid-credential'
            ? 'El correo o la contraseña no son correctos.'
            : 'No pudimos iniciar sesión. Revisá los emuladores e intentá de nuevo.',
      );
    } finally {
      if (mounted) setState(() => _cargando = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF071A2D), Color(0xFF0C3454), Color(0xFF08627A)],
        ),
      ),
      child: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 430),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Image.asset(
                      'assets/brand/habita-logotipo.png',
                      width: 190,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 42),
                  Text(
                    'Todo tu complejo,\nen una sola app.',
                    style: HabitaTipografia.titulo1.copyWith(
                      color: Colors.white,
                      fontSize: 34,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Accesos, expensas, visitas y reclamos conectados en tiempo real.',
                    style: HabitaTipografia.cuerpoGrande.copyWith(
                      color: const Color(0xFFC8DCEA),
                    ),
                  ),
                  const SizedBox(height: 30),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(22),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Text(
                            'Ingresá a Habita',
                            style: HabitaTipografia.titulo2,
                          ),
                          const SizedBox(height: 6),
                          const Text(
                            'Elegí un perfil demo o usá tus credenciales.',
                            style: TextStyle(color: HabitaColores.textoSuave),
                          ),
                          const SizedBox(height: 20),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              _Perfil(
                                texto: 'Residente',
                                activo: _email.text.startsWith('residente'),
                                onTap: () => setState(
                                  () => _email.text = 'residente@habita.demo',
                                ),
                              ),
                              _Perfil(
                                texto: 'Guardia',
                                activo: _email.text.startsWith('guardia'),
                                onTap: () => setState(
                                  () => _email.text = 'guardia@habita.demo',
                                ),
                              ),
                              _Perfil(
                                texto: 'Obra',
                                activo: _email.text.startsWith('obra'),
                                onTap: () => setState(
                                  () => _email.text = 'obra@habita.demo',
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 18),
                          TextField(
                            controller: _email,
                            keyboardType: TextInputType.emailAddress,
                            autofillHints: const [AutofillHints.username],
                            decoration: const InputDecoration(
                              labelText: 'Correo electrónico',
                              prefixIcon: Icon(Icons.mail_outline_rounded),
                            ),
                          ),
                          const SizedBox(height: 12),
                          TextField(
                            controller: _password,
                            obscureText: true,
                            autofillHints: const [AutofillHints.password],
                            onSubmitted: (_) => _ingresar(),
                            decoration: const InputDecoration(
                              labelText: 'Contraseña',
                              prefixIcon: Icon(Icons.lock_outline_rounded),
                            ),
                          ),
                          if (_error != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 12),
                              child: Text(
                                _error!,
                                style: const TextStyle(
                                  color: HabitaColores.estadoErrorTexto,
                                ),
                              ),
                            ),
                          const SizedBox(height: 18),
                          FilledButton(
                            onPressed: _cargando ? null : _ingresar,
                            child: _cargando
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Colors.white,
                                    ),
                                  )
                                : const Text('Ingresar'),
                          ),
                          const SizedBox(height: 10),
                          const Text(
                            'Demo: Habita2026!',
                            textAlign: TextAlign.center,
                            style: HabitaTipografia.micro,
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

class _Perfil extends StatelessWidget {
  const _Perfil({
    required this.texto,
    required this.activo,
    required this.onTap,
  });
  final String texto;
  final bool activo;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => ChoiceChip(
    label: Text(texto),
    selected: activo,
    onSelected: (_) => onTap(),
  );
}

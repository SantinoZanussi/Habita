import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../nucleo/tema/tokens.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({
    super.key,
    this.auth,
    this.usarEmuladores = const bool.fromEnvironment(
      'USE_FIREBASE_EMULATORS',
      defaultValue: !kReleaseMode,
    ),
  });
  final bool usarEmuladores;
  final FirebaseAuth? auth;
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  late final _email = TextEditingController(
    text: widget.usarEmuladores ? 'residente@habita.demo' : '',
  );
  late final _password = TextEditingController(
    text: widget.usarEmuladores ? 'Habita2026!' : '',
  );
  bool _cargando = false;
  bool _mostrarPassword = false;
  String? _error;
  String? _aviso;

  FirebaseAuth get _auth => widget.auth ?? FirebaseAuth.instance;

  Future<void> _recuperarPassword() async {
    if (_cargando) return;
    final email = _email.text.trim();
    if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) {
      setState(() {
        _error = 'Ingresá un correo válido para recuperar tu contraseña.';
        _aviso = null;
      });
      return;
    }
    setState(() {
      _cargando = true;
      _error = null;
      _aviso = null;
    });
    try {
      await _auth.sendPasswordResetEmail(email: email);
      if (mounted) _mostrarAvisoRecuperacion();
    } on FirebaseAuthException catch (error) {
      if (!mounted) return;
      if (error.code == 'user-not-found') {
        _mostrarAvisoRecuperacion();
      } else {
        setState(
          () => _error = switch (error.code) {
            'invalid-email' => 'Revisá el formato del correo electrónico.',
            'network-request-failed' =>
              'No hay conexión. Revisá internet e intentá de nuevo.',
            'too-many-requests' =>
              'Hubo demasiados intentos. Esperá unos minutos.',
            _ => 'No pudimos enviar el correo. Intentá de nuevo más tarde.',
          },
        );
      }
    } catch (_) {
      if (mounted) {
        setState(
          () => _error =
              'No pudimos enviar el correo. Intentá de nuevo más tarde.',
        );
      }
    } finally {
      if (mounted) setState(() => _cargando = false);
    }
  }

  void _mostrarAvisoRecuperacion() => setState(() {
    _aviso =
        'Si el correo tiene una cuenta, recibirás un enlace para cambiar tu contraseña. Revisá también spam.';
  });

  Future<void> _ingresar() async {
    if (_cargando) return;
    if (_email.text.trim().isEmpty || _password.text.isEmpty) {
      setState(() => _error = 'Completá tu correo y contraseña.');
      return;
    }
    setState(() {
      _cargando = true;
      _error = null;
      _aviso = null;
    });
    try {
      await _auth.signInWithEmailAndPassword(
        email: _email.text.trim(),
        password: _password.text,
      );
    } on FirebaseAuthException catch (error) {
      if (!mounted) return;
      setState(
        () => _error = switch (error.code) {
          'invalid-credential' || 'user-not-found' || 'wrong-password' =>
            'El correo o la contraseña no son correctos. Usá la cuenta que te asignó la administración.',
          'invalid-email' => 'Revisá el formato del correo electrónico.',
          'network-request-failed' =>
            'No hay conexión. Revisá internet e intentá de nuevo.',
          'too-many-requests' =>
            'Hubo demasiados intentos. Esperá unos minutos.',
          'user-disabled' =>
            'La cuenta está deshabilitada. Contactá a la administración.',
          'operation-not-allowed' =>
            'El acceso por correo no está habilitado. Contactá a la administración.',
          _ => 'No pudimos iniciar sesión. Intentá de nuevo más tarde.',
        },
      );
    } finally {
      if (mounted) setState(() => _cargando = false);
    }
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
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
                  Row(
                    children: [
                      Image.asset(
                        'assets/brand/habita-isotipo.png',
                        width: 72,
                        height: 72,
                        semanticLabel: 'Isotipo de Habita',
                      ),
                      const SizedBox(width: 16),
                      const Text(
                        'HABITA',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 28,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
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
                          Text(
                            widget.usarEmuladores
                                ? 'Elegí un perfil demo o usá tus credenciales.'
                                : 'Usá la cuenta asignada por tu administración.',
                            style: const TextStyle(
                              color: HabitaColores.textoSuave,
                            ),
                          ),
                          const SizedBox(height: 20),
                          if (widget.usarEmuladores)
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
                            enabled: !_cargando,
                            textInputAction: TextInputAction.next,
                            autocorrect: false,
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
                            enabled: !_cargando,
                            obscureText: !_mostrarPassword,
                            autocorrect: false,
                            enableSuggestions: false,
                            textInputAction: TextInputAction.done,
                            autofillHints: const [AutofillHints.password],
                            onSubmitted: (_) => _ingresar(),
                            decoration: InputDecoration(
                              labelText: 'Contraseña',
                              prefixIcon: const Icon(
                                Icons.lock_outline_rounded,
                              ),
                              suffixIcon: IconButton(
                                tooltip: _mostrarPassword
                                    ? 'Ocultar contraseña'
                                    : 'Mostrar contraseña',
                                onPressed: () => setState(
                                  () => _mostrarPassword = !_mostrarPassword,
                                ),
                                icon: Icon(
                                  _mostrarPassword
                                      ? Icons.visibility_off_outlined
                                      : Icons.visibility_outlined,
                                ),
                              ),
                            ),
                          ),
                          Align(
                            alignment: Alignment.centerRight,
                            child: TextButton(
                              onPressed: _cargando ? null : _recuperarPassword,
                              child: const Text('Olvidé mi contraseña'),
                            ),
                          ),
                          if (_aviso != null)
                            Semantics(liveRegion: true, child: Text(_aviso!)),
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
                          if (widget.usarEmuladores)
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

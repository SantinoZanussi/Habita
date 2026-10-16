import 'dart:js_interop';

const esWeb = true;
@JS('window.open')
external JSObject? _open(String url, String target);

bool abrir(String url) {
  final ventana = _open(url, '_blank');
  return ventana != null;
}
